// The general speaker model (lib/speaker/speakerResponse) against today's engines: the golden Hi-fi and PA designs,
// read through the L1 adapters, give the same curves, net air and tuning as the Hi-fi and PA models.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { configs, type GoldenConfig } from "./golden-configs";
import { speakerResponse, SPEAKER_RESPONSE_FREQUENCIES } from "../src/lib/speaker/speakerResponse";
import { speakerFromHifi } from "../src/lib/speaker/hifiSpec";
import { systemFromPa } from "../src/lib/speaker/paSpec";
import { lrFilter, speakerIdentity } from "../src/lib/speaker/specParts";
import { filterTransfer, filtersTransfer } from "../src/lib/speaker/bandFilter";
import { deriveHifiDesign } from "../src/pages/hifi/hifiDesign";
import { hifiBox, hifiGridTop, linkwitzRileyFilter } from "../src/lib/hifi/hifi";
import {
  boxModel,
  closedBox,
  highpassGain,
  hornResponse,
  linkwitzRileyHighpass,
  linkwitzRileyLowpass,
  midSystem,
  subSystem,
} from "../src/lib/pa/calc";
import { paSearchDesign } from "../src/lib/pa/optimize";
import { towerMidDims } from "../src/lib/pa/tower";
import { savedHardware } from "../src/lib/pa/hardware";
import { panelNominalNear } from "../src/lib/panel";
import { abs, add, complex, multiply, phasor, scale } from "../src/lib/acoustics/complex";
import { chamberVentModel } from "../src/lib/speaker/chamberAir";
import {
  CD_OPTIONS,
  HIFI_COAXES,
  HIFI_TWEETERS,
  HIFI_WAVEGUIDES,
  HORN_OPTIONS,
  MID_BOXES,
  MID_OPTIONS,
  SUB_OPTIONS,
} from "../src/lib/data";
import { DEFAULT_HIFI, DEFAULT_HIFI_LOOK, DEFAULT_PA } from "../src/lib/defaults";
import { needsWaveguide } from "../src/lib/hifi/hifi";
import { HORN_MOUNT_DEFAULT } from "../src/constants/hornMount";
import { HORN_PROFILE } from "../src/constants/hornEngine";
import { hornModel } from "../src/lib/acoustics/hornModel";
import { hornDesignOf } from "../src/lib/speaker/hornDesign";
import {
  CHAMBER_LOAD,
  DRIVER_KIND,
  FIRST_ORDER_FILTER,
  HORN_DRIVE,
  HORN_ENGINE_GAP,
  HORN_PATH,
  PORT_SHAPE,
  SPEAKER_BAND,
  SPEAKER_MODEL_GAP,
  SPEAKER_PART,
  SPEAKER_RESPONSE_VOLTS,
  VENT_KIND,
} from "../src/constants/speakerSpec";
import type {
  BandId,
  Complex,
  CoverageLayout,
  FrequencyPoint,
  HifiDesignState,
  PaPlannerDesign,
  SpeakerChamber,
  SpeakerSpec,
  SystemWithSpeakers,
} from "../src/types";

/** A level relative to the model's drive: the engines run at the amp's voltage, the model at 2.83 V. */
const atModelVolts = (volts: number) => 20 * Math.log10(volts / SPEAKER_RESPONSE_VOLTS);

/** A curve's level at `f`, read between its points on a log-frequency axis; null outside it. */
function levelAt(curve: readonly FrequencyPoint[], f: number): number | null {
  if (f < curve[0].f || f > curve[curve.length - 1].f) return null;
  const i = Math.max(
    1,
    curve.findIndex((o) => o.f >= f),
  );
  const a = curve[i - 1],
    b = curve[i];
  const k = b.f === a.f ? 0 : Math.log(f / a.f) / Math.log(b.f / a.f);
  return a.spl + k * (b.spl - a.spl);
}

/** How far below a reference curve's highest point the comparison still reads, dB: deeper, only the skirts are left. */
const WINDOW_DB = 30;

/**
 * The largest difference between the model's curve and a reference, dB: over the model's frequencies inside the
 * reference's span (and `fmax`), where the reference is within WINDOW_DB of its highest point.
 */
function maxDiff(
  model: readonly FrequencyPoint[],
  ref: readonly FrequencyPoint[],
  fmax = Infinity,
) {
  const top = Math.max(...ref.map((o) => o.spl));
  let most = 0;
  for (const o of model) {
    if (o.f > fmax) continue;
    const r = levelAt(ref, o.f);
    if (r === null || r < top - WINDOW_DB) continue;
    most = Math.max(most, Math.abs(o.spl - r));
  }
  return most;
}

function bandCurve(response: ReturnType<typeof speakerResponse>, id: BandId) {
  const band = response.bands.find((b) => b.id === id);
  assert.ok(band, `a ${id} band`);
  return band.curve;
}

test("speaker model: a band filter's magnitude is the box models' highpass and Linkwitz-Riley gains", () => {
  for (const f of [20, 63, 120, 400, 2500]) {
    for (const type of ["BW24", "LR24", "BW48", "LR48"] as const)
      assert.ok(
        Math.abs(
          abs(filterTransfer(f, { hz: 100, type }, "highpass")) - highpassGain(f, 100, type),
        ) < 1e-12,
        `${type} highpass at ${f} Hz`,
      );
    for (const order of [4, 8] as const) {
      const type = order === 4 ? "LR24" : "LR48";
      assert.ok(
        Math.abs(
          abs(filterTransfer(f, { hz: 100, type }, "lowpass")) -
            linkwitzRileyLowpass(f, 100, order),
        ) < 1e-12,
      );
      assert.ok(
        Math.abs(
          abs(filterTransfer(f, { hz: 100, type }, "highpass")) -
            linkwitzRileyHighpass(f, 100, order),
        ) < 1e-12,
      );
    }
    // first order: −3 dB at the corner, 6 dB/oct
    const x = f / 100;
    assert.ok(
      Math.abs(
        abs(filterTransfer(f, { hz: 100, type: FIRST_ORDER_FILTER }, "highpass")) -
          x / Math.hypot(1, x),
      ) < 1e-12,
    );
  }
});

// ---- Hi-fi ----

const waveguideTweeter = HIFI_TWEETERS.find((t) => needsWaveguide(t) && !t.ownGuide);
const roundGuide = HIFI_WAVEGUIDES.find((h) => !h.rect);
const coax = HIFI_COAXES.find((c) => c.tweeter);
assert.ok(waveguideTweeter && roundGuide && coax?.tweeter, "the catalog has each case");

/** Hi-fi designs covering each box kind, port shape, a waveguide, a coaxial, LR48 and passive drive. */
const hifiCases: { name: string; state: HifiDesignState }[] = [
  { name: "DEFAULT_HIFI", state: DEFAULT_HIFI },
  { name: "sealed", state: { ...DEFAULT_HIFI, boxType: VENT_KIND.sealed } },
  { name: "radiator", state: { ...DEFAULT_HIFI, boxType: VENT_KIND.radiator } },
  {
    name: "slot",
    state: { ...DEFAULT_HIFI, portSpec: { shape: PORT_SHAPE.slot, n: 1, h: 1, len: 6 } },
  },
  {
    name: "two ports, LR48",
    state: { ...DEFAULT_HIFI, portSpec: { n: 2, dia: 1.5, len: 5 }, crossoverOrder: 8 },
  },
  {
    name: "compression driver on a round waveguide",
    state: {
      ...DEFAULT_HIFI,
      tweeter: waveguideTweeter,
      selectedWaveguide: roundGuide,
      crossoverHz: 1600,
    },
  },
  { name: "coaxial", state: { ...DEFAULT_HIFI, woofer: coax.woofer, tweeter: coax.tweeter } },
  { name: "passive", state: { ...DEFAULT_HIFI, drive: "passive" } },
];

/**
 * Tolerances for the Hi-fi parity, dB. Each band runs the engine's own arithmetic on the model's grid, so it differs
 * only by reading the engine's curve between its points (196 points over 15 Hz–2 kHz): 0.05 dB. The sum also takes
 * each box's own phase and the subsonic's, which the Hi-fi engine leaves out of its sum (it multiplies the woofer's
 * level by the crossover alone): a few degrees at a 1.6–2 kHz crossover, 0.1 dB at most.
 */
const HIFI_BAND_DB = 0.05;
const HIFI_SUM_DB = 0.1;

test("speaker model: the Hi-fi designs match the Hi-fi engine before the room (bands, sum, net air, tuning)", () => {
  for (const { name, state } of hifiCases) {
    const spec = speakerFromHifi(state, DEFAULT_HIFI_LOOK, { id: "hifi", name });
    const response = speakerResponse(spec);
    const design = deriveHifiDesign(state);
    const sys = design.speakerModel?.speakerSystem;
    assert.ok(sys, name);
    const cfg = design.speakerConfig;
    const box = hifiBox(state.woofer, cfg, hifiGridTop(cfg.xo));
    assert.ok(box, name);
    const order = cfg.order;
    const lowRaw = box.m.curve.map((o) => ({ f: o.f, spl: o.spl - atModelVolts(box.V) }));
    const lowRef = lowRaw.map((o) => ({
      f: o.f,
      spl: o.spl + 20 * Math.log10(abs(linkwitzRileyFilter(o.f, cfg.xo, order, "lp"))),
    }));
    const tweeterDb = sys.tSens283 + sys.trim;
    const highRef = SPEAKER_RESPONSE_FREQUENCIES.map((f) => ({
      f,
      spl: tweeterDb + 20 * Math.log10(abs(linkwitzRileyFilter(f, cfg.xo, order, "hp"))),
    }));
    const lowDiff = maxDiff(bandCurve(response, SPEAKER_BAND.low), lowRef);
    const highDiff = maxDiff(bandCurve(response, SPEAKER_BAND.high), highRef);
    // the Hi-fi engine's on-axis sum before the room: the woofer's level times the crossover, plus the tweeter's
    const top = box.m.curve[box.m.curve.length - 1].f;
    const sumRef = SPEAKER_RESPONSE_FREQUENCIES.filter((f) => f <= top).map((f) => {
      const w = scale(
        linkwitzRileyFilter(f, cfg.xo, order, "lp"),
        10 ** ((levelAt(lowRaw, f) ?? 0) / 20),
      );
      const t = scale(linkwitzRileyFilter(f, cfg.xo, order, "hp"), 10 ** (tweeterDb / 20));
      return { f, spl: 20 * Math.log10(abs(add(w, t))) };
    });
    const sumDiff = maxDiff(response.sum, sumRef);
    assert.ok(lowDiff <= HIFI_BAND_DB, `${name}: woofer band off by ${lowDiff.toFixed(3)} dB`);
    assert.ok(highDiff <= HIFI_BAND_DB, `${name}: tweeter band off by ${highDiff.toFixed(3)} dB`);
    assert.ok(sumDiff <= HIFI_SUM_DB, `${name}: sum off by ${sumDiff.toFixed(3)} dB`);
    const [chamber] = response.chambers;
    assert.ok(Math.abs(chamber.netLiters - box.net) < 1e-9 * box.net, `${name}: net air`);
    if (sys.kind === "sealed")
      assert.ok(chamber.qtc !== null && Math.abs(chamber.qtc - sys.Qtc) < 1e-9, name);
    else
      assert.ok(
        chamber.fb !== null && Math.abs(chamber.fb - sys.Fb) < 1e-9 * sys.Fb,
        `${name}: Fb`,
      );
    assert.deepEqual(chamber.gaps, [], name);
  }
});

// ---- PA ----

/** The coverage page's stack spots, left then right (they don't move the speakers' responses). */
const STACKS: CoverageLayout["stacks"] = [
  { x: -9, y: 3, aim: 12 },
  { x: 9, y: 3, aim: -12 },
];

/** A golden PA design as the planner holds it (as tests/speaker-spec.test.ts reads it). */
function paDesign(c: GoldenConfig): PaPlannerDesign {
  const cfg = paSearchDesign({ cur: c });
  return {
    ...cfg,
    mDim: c.mDim || (MID_BOXES.find((b) => b.id === c.midBox) || MID_BOXES[0]).box,
    panel: c.panel ?? panelNominalNear(cfg.wall),
    hornMount: c.hornMount ?? HORN_MOUNT_DEFAULT,
    spacerH: c.spacerH ?? DEFAULT_PA.spacerH,
  };
}

/** A speaker of the system by part, with the filters its source feeds it. */
function speakerAndFeed(
  read: SystemWithSpeakers,
  part: (typeof SPEAKER_PART)[keyof typeof SPEAKER_PART],
) {
  const id = speakerIdentity(read.system, part).id;
  const spec = read.speakers.find((s) => s.id === id);
  const source = read.system.sources.find((s) => s.speakerId === id);
  assert.ok(spec && source, part);
  return { spec, feed: source.filters };
}

/** The spec with one chamber's net air set. */
const withNet = (spec: SpeakerSpec, chamber: SpeakerChamber, netLiters: number): SpeakerSpec => ({
  ...spec,
  cabinet: {
    ...spec.cabinet,
    chambers: spec.cabinet.chambers.map((c) => (c === chamber ? { ...c, netLiters } : c)),
  },
});

/** Today's PA models of a design: the sub, mid and horn as the planner runs them (the golden evaluation's configs). */
function paModels(cfg: PaPlannerDesign) {
  const sub = SUB_OPTIONS.find((o) => o.id === cfg.sub);
  const mid = MID_OPTIONS.find((o) => o.id === cfg.mid);
  const cd = CD_OPTIONS.find((o) => o.id === cfg.cd);
  const horn = HORN_OPTIONS.find((o) => o.id === cfg.horn);
  assert.ok(sub && mid && cd?.hf && horn?.hf);
  const midDims = cfg.layout === "tower" ? towerMidDims(cfg.cDim) : cfg.mDim;
  const hardware = savedHardware(cfg.hardware);
  const s = subSystem(sub, mid, {
    subBox: cfg.cDim,
    midDims,
    wall: cfg.wall,
    inset: cfg.inset,
    portStyle: cfg.portStyle,
    cVent: cfg.cVent,
    hpf: cfg.hpf,
    hpType: cfg.hpType,
    ampW: cfg.ampW,
    portMax: cfg.portMax,
    layout: cfg.layout,
    braceStyle: cfg.braceStyle,
    hardware,
    xoLo: cfg.xoLo,
  });
  const m = midSystem(mid, {
    layout: cfg.layout,
    braceStyle: cfg.braceStyle,
    hardware,
    midDims,
    wall: cfg.wall,
    inset: cfg.inset,
    xoLo: cfg.xoLo,
    xoHi: cfg.xoHi,
    xoLoOrder: cfg.xoLoOrder,
    xoHiOrder: cfg.xoHiOrder,
    mAmpW: cfg.mAmpW,
  });
  // the horn at 1 W into 8 Ω: 2.83 V
  const h = hornResponse(cd.hf, horn.hf, cfg.xoHi, 1, cfg.xoHiOrder);
  assert.ok(s.mdl && m.mdl && h);
  return { s, sub: s.mdl, m, mid: m.mdl, horn: h };
}

/** Each golden PA design's differences from today's models, dB and %. */
interface PaRow {
  name: string;
  port: string;
  /** with the net air set to today's (the box models and filters alone) */
  subDb: number;
  midDb: number;
  hornDb: number;
  fbPct: number;
  /** with the net air the model works out from the size */
  subFreeDb: number;
  midFreeDb: number;
  netPct: number;
  midNetPct: number;
}

/**
 * Tolerances for the PA parity. With the net air set to today's, every band runs the engines' own arithmetic (the sub's
 * vent by the PA's port rules: the letterbox's fins and fold, the flared tubes, the side ducts): PA_EXACT_DB, reading
 * today's curves between their points, and Fb to rounding. With the net air worked out from the size, the model takes
 * 3% for bracing where the PA counts its braces, vent walls and hardware recesses: up to PA_SUB_FREE_DB on the sub (its
 * tuning moves with the air) and PA_MID_FREE_DB on the sealed mid (its curve hardly moves).
 *
 * On the goldens (Oct 2026), from the size: the sub's net air is −4.2% to +1.7% of the PA's (up to 0.43 dB), the
 * mid's −3.1% to +7.1% (up to 0.30 dB, the ½″ walls with a 1.5″ inset: the PA takes a ¾″ baffle whatever the walls).
 */
const PA_EXACT_DB = 0.05;
const PA_FB_PCT = 1e-9;
const PA_SUB_FREE_DB = 0.5;
const PA_MID_FREE_DB = 0.35;

test("speaker model: the golden PA designs match the PA models (sub, mid and horn bands, net air, tuning)", () => {
  const rows: PaRow[] = [];
  for (const c of configs) {
    const cfg = paDesign(c);
    const tower = cfg.layout === "tower";
    const read = systemFromPa(cfg, { id: "pa", name: c.name }, STACKS);
    const models = paModels(cfg);
    const subSide = speakerAndFeed(read, tower ? SPEAKER_PART.tower : SPEAKER_PART.sub);
    const topSide = speakerAndFeed(read, tower ? SPEAKER_PART.tower : SPEAKER_PART.top);
    const subChamber = subSide.spec.cabinet.chambers[0];
    const midChamber = topSide.spec.cabinet.chambers.find((ch) =>
      ch.drivers.some((d) => d.kind === "mid"),
    );
    assert.ok(midChamber, c.name);
    // today's curves at 2.83 V, with the crossovers each band takes (the sub's lowpass, the top's highpass: the system's
    // outside the tower)
    const subRef = models.sub.curve.map((o) => ({
      f: o.f,
      spl:
        o.spl -
        atModelVolts(models.s.AMP_V) +
        20 * Math.log10(linkwitzRileyLowpass(o.f, cfg.xoLo, cfg.xoLoOrder)),
    }));
    const midBand = topSide.spec.bands.find((b) => b.id === SPEAKER_BAND.mid);
    const highBand = topSide.spec.bands.find((b) => b.id === SPEAKER_BAND.high);
    assert.ok(midBand && highBand, c.name);
    // each band at its level (the tower's mid and horn carry the music balance)
    const midRef = models.mid.curve.map((o) => ({
      f: o.f,
      spl: o.spl - atModelVolts(models.m.V) + midBand.levelDb,
    }));
    const hornRef = models.horn.curve.map((o) => ({
      f: o.f,
      spl:
        o.spl +
        highBand.levelDb +
        (tower
          ? 0
          : 20 *
            Math.log10(abs(filterTransfer(o.f, lrFilter(cfg.xoLo, cfg.xoLoOrder), "highpass")))),
    }));
    // the boxes with today's net air (the mid's stuffing is the chamber's own: the PA's 15%)
    const subSet = speakerResponse(withNet(subSide.spec, subChamber, models.s.netL), {
      feed: subSide.feed,
    });
    const topSpec = tower ? withNet(subSide.spec, subChamber, models.s.netL) : topSide.spec;
    const midSet = speakerResponse(withNet(topSpec, midChamber, models.m.netL), {
      feed: topSide.feed,
    });
    const subFree = speakerResponse(subSide.spec, { feed: subSide.feed });
    const topFree = speakerResponse(topSide.spec, { feed: topSide.feed });
    const midIndex = topSide.spec.cabinet.chambers.indexOf(midChamber);
    const fb = subSet.chambers[0].fb;
    const qtc = midSet.chambers[midIndex].qtc;
    assert.ok(fb !== null && qtc !== null, c.name);
    assert.ok(Math.abs(qtc - models.mid.Qtc) < 1e-9, `${c.name}: mid Qtc`);
    rows.push({
      name: c.name,
      port: cfg.portStyle,
      subDb: maxDiff(bandCurve(subSet, SPEAKER_BAND.low), subRef),
      midDb: maxDiff(bandCurve(midSet, SPEAKER_BAND.mid), midRef),
      hornDb: maxDiff(bandCurve(midSet, SPEAKER_BAND.high), hornRef),
      fbPct: (100 * Math.abs(fb - models.sub.Fb)) / models.sub.Fb,
      subFreeDb: maxDiff(bandCurve(subFree, SPEAKER_BAND.low), subRef),
      midFreeDb: maxDiff(bandCurve(topFree, SPEAKER_BAND.mid), midRef),
      netPct: (100 * (subFree.chambers[0].netLiters - models.s.netL)) / models.s.netL,
      midNetPct: (100 * (topFree.chambers[midIndex].netLiters - models.m.netL)) / models.m.netL,
    });
  }
  for (const r of rows) {
    assert.ok(r.midDb <= PA_EXACT_DB, `${r.name}: mid band off by ${r.midDb.toFixed(3)} dB`);
    assert.ok(r.hornDb <= PA_EXACT_DB, `${r.name}: horn band off by ${r.hornDb.toFixed(3)} dB`);
    assert.ok(r.subDb <= PA_EXACT_DB, `${r.name}: sub band off by ${r.subDb.toFixed(3)} dB`);
    assert.ok(r.fbPct <= PA_FB_PCT, `${r.name}: Fb off by ${r.fbPct}%`);
    assert.ok(
      r.subFreeDb <= PA_SUB_FREE_DB,
      `${r.name}: sub as read, ${r.subFreeDb.toFixed(2)} dB`,
    );
    assert.ok(
      r.midFreeDb <= PA_MID_FREE_DB,
      `${r.name}: mid as read, ${r.midFreeDb.toFixed(2)} dB`,
    );
  }
});

test("speaker model: cones of different ids in one chamber are a named gap, not a guess", () => {
  const spec = speakerFromHifi(DEFAULT_HIFI, DEFAULT_HIFI_LOOK, { id: "hifi", name: "mixed" });
  const [chamber] = spec.cabinet.chambers;
  const [woofer] = chamber.drivers;
  const mixed: SpeakerSpec = {
    ...spec,
    cabinet: {
      ...spec.cabinet,
      chambers: [
        {
          ...chamber,
          drivers: [...chamber.drivers, { ...woofer, kind: "mid", driverId: MID_OPTIONS[0].id }],
        },
      ],
    },
  };
  const response = speakerResponse(mixed);
  assert.deepEqual(response.chambers[0].gaps, [SPEAKER_MODEL_GAP.mixedDrivers]);
  // the tweeter still plays
  assert.deepEqual(
    response.bands.map((b) => b.id),
    [SPEAKER_BAND.high],
  );
});

test("speaker model: two alike woofers in one chamber play as a bank (twice the air: the same Qtc, +6 dB at the same voltage)", () => {
  const sealed = { ...DEFAULT_HIFI, boxType: VENT_KIND.sealed };
  const spec = speakerFromHifi(sealed, DEFAULT_HIFI_LOOK, { id: "hifi", name: "bank" });
  const one = speakerResponse(spec);
  const [chamber] = spec.cabinet.chambers;
  const two = speakerResponse({
    ...spec,
    cabinet: {
      ...spec.cabinet,
      chambers: [
        {
          ...chamber,
          netLiters: 2 * one.chambers[0].netLiters,
          drivers: chamber.drivers.map((d) => (d.kind === "woofer" ? { ...d, count: 2 } : d)),
        },
      ],
    },
  });
  const [qtcOne, qtcTwo] = [one, two].map((r) => r.chambers[0].qtc);
  assert.ok(qtcOne !== null && qtcTwo !== null && Math.abs(qtcTwo - qtcOne) < 1e-9, "same Qtc");
  const at = (r: typeof one, f: number) => levelAt(bandCurve(r, SPEAKER_BAND.low), f) ?? NaN;
  for (const f of [40, 100, 300])
    assert.ok(
      Math.abs(at(two, f) - at(one, f) - 20 * Math.log10(2)) < 1e-6,
      `a bank of two at ${f} Hz`,
    );
});

test("speaker model: a horn built into the box runs through the horn engine; a tapped horn is a named gap", () => {
  const bin: SpeakerChamber = {
    at: { xIn: 0, yIn: 0 },
    dims: { w: 24, h: 32, d: 30 },
    netLiters: 120,
    stuffingPct: 0,
    vent: { kind: VENT_KIND.vented, port: { shape: PORT_SHAPE.round, n: 2, dia: 4, len: 8 } },
    load: {
      kind: CHAMBER_LOAD.horn,
      horn: {
        throatChamber: 2,
        segments: [
          { profile: HORN_PROFILE.exponential, s1: 600, s2: 2400, length: 60 },
          { profile: HORN_PROFILE.conical, s1: 2400, s2: 6000, length: 50 },
        ],
        portOffset: 30,
        drive: { kind: HORN_DRIVE.front },
        path: HORN_PATH.folded,
      },
    },
    drivers: [
      {
        kind: DRIVER_KIND.sub,
        driverId: DEFAULT_PA.sub.id,
        count: 1,
        position: { xIn: 0, yIn: 16 },
        bands: [SPEAKER_BAND.low],
        horn: null,
      },
    ],
  };
  const spec = speakerFromHifi(DEFAULT_HIFI, DEFAULT_HIFI_LOOK, { id: "bin", name: "bin" });
  const binSpec: SpeakerSpec = {
    ...spec,
    cabinet: { ...spec.cabinet, chambers: [bin] },
    bands: [{ id: SPEAKER_BAND.low, highpass: null, lowpass: null, levelDb: 0, drive: "active" }],
  };
  const response = speakerResponse(binSpec);
  const read = hornDesignOf(bin, { count: 1, angle: 2 });
  assert.ok(read.ok);
  const model = hornModel(read.design, SPEAKER_RESPONSE_FREQUENCIES, SPEAKER_RESPONSE_VOLTS);
  assert.ok(model);
  const low = bandCurve(response, SPEAKER_BAND.low);
  assert.ok(
    low.every((o, i) => Math.abs(o.spl - model.curve[i].spl) < 1e-9),
    "the engine's curve",
  );
  assert.deepEqual([response.chambers[0].netLiters, response.chambers[0].fb], [120, model.fb]);
  const tapped = speakerResponse({
    ...binSpec,
    cabinet: {
      ...binSpec.cabinet,
      chambers: [
        {
          ...bin,
          load: {
            kind: CHAMBER_LOAD.horn,
            horn: { ...hornOf(bin), drive: { kind: HORN_DRIVE.tapped, frontTap: 0, rearTap: 1 } },
          },
        },
      ],
    },
  });
  assert.deepEqual(tapped.chambers[0].gaps, [HORN_ENGINE_GAP.tapped]);
  assert.deepEqual(tapped.bands, []);
});

/** The chamber's built-in horn (the test's bin has one). */
function hornOf(chamber: SpeakerChamber) {
  assert.ok(chamber.load.kind === CHAMBER_LOAD.horn);
  return chamber.load.horn;
}

test("speaker model: the PA top and tower sum their chambers' cones and the horn with phase round the crossovers", () => {
  const grid = { fmin: 15, fmax: 20000, N: SPEAKER_RESPONSE_FREQUENCIES.length };
  const volts = SPEAKER_RESPONSE_VOLTS;
  const stack = configs.find((c) => c.layout !== "tower");
  const towerSeed = configs.find((c) => c.layout === "tower");
  assert.ok(stack && towerSeed);
  for (const seed of [stack, towerSeed]) {
    const cfg = paDesign(seed);
    const tower = cfg.layout === "tower";
    const read = systemFromPa(cfg, { id: "pa", name: seed.name }, STACKS);
    const { spec, feed } = speakerAndFeed(read, tower ? SPEAKER_PART.tower : SPEAKER_PART.top);
    const models = paModels(cfg);
    const sub = SUB_OPTIONS.find((o) => o.id === cfg.sub);
    const mid = MID_OPTIONS.find((o) => o.id === cfg.mid);
    const cd = CD_OPTIONS.find((o) => o.id === cfg.cd);
    const horn = HORN_OPTIONS.find((o) => o.id === cfg.horn);
    assert.ok(sub && mid && cd?.hf && horn?.hf);
    // every cone chamber at today's net air
    const set: SpeakerSpec = {
      ...spec,
      cabinet: {
        ...spec.cabinet,
        chambers: spec.cabinet.chambers.map((c) =>
          c.drivers.some((d) => d.kind === "sub")
            ? { ...c, netLiters: models.s.netL }
            : c.drivers.some((d) => d.kind === "mid")
              ? { ...c, netLiters: models.m.netL }
              : c,
        ),
      },
    };
    const response = speakerResponse(set, { feed });
    // each band's pressure from the engines on the model's grid, with its phase, then its filters, the feed and level
    const midBox = closedBox(mid.ts, models.m.effL, null, null, volts, {
      ...grid,
      hpOrder: 4,
      lpOrder: 4,
      phase: true,
    });
    const subChamber = set.cabinet.chambers[0];
    const port = tower ? chamberVentModel(set.cabinet, subChamber) : null;
    const subBox =
      port &&
      boxModel(sub.ts, models.s.netL, port.areaIn2, port.lenIn, 1, volts, undefined, {
        ...grid,
        nPorts: port.openings,
        ecIn: port.endCorrectionIn,
        phase: true,
      });
    assert.ok(midBox && (!tower || subBox));
    const hornFlat = cd.hf.sens + 10 * Math.log10(8 / cd.hf.imp);
    const { lowHz } = horn.hf;
    const at = (o: { raw: number; rawPhase?: number }) =>
      scale(phasor(o.rawPhase ?? NaN), 10 ** (o.raw / 20));
    const band = (id: BandId) => {
      const found = set.bands.find((b) => b.id === id);
      assert.ok(found);
      return found;
    };
    const through = (p: Complex, f: number, id: BandId) =>
      scale(
        multiply(multiply(p, filtersTransfer(f, band(id))), filtersTransfer(f, feed)),
        10 ** (band(id).levelDb / 20),
      );
    const sum = SPEAKER_RESPONSE_FREQUENCIES.map((f, i) => {
      const hornDb = hornFlat + 20 * Math.log10(Math.min(1, (f / lowHz) ** 2));
      let p = add(
        through(at(midBox.curve[i]), f, SPEAKER_BAND.mid),
        through(complex(10 ** (hornDb / 20)), f, SPEAKER_BAND.high),
      );
      if (subBox) p = add(p, through(at(subBox.curve[i]), f, SPEAKER_BAND.low));
      return { f, spl: 20 * Math.log10(abs(p)) };
    });
    // round each crossover, where the phases matter: within 0.001 dB
    for (const xo of [cfg.xoHi, ...(tower ? [cfg.xoLo] : [])]) {
      const near = response.sum.filter((o) => o.f > xo / 2 && o.f < xo * 2);
      assert.ok(near.length > 5);
      for (const o of near) {
        const r = sum.find((q) => q.f === o.f);
        assert.ok(r && Math.abs(o.spl - r.spl) < 1e-3, `${seed.name} at ${o.f.toFixed(0)} Hz`);
      }
    }
  }
});

test("speaker model: sizes and corners it can't run on are named gaps, never NaN curves", () => {
  const base = speakerFromHifi(DEFAULT_HIFI, DEFAULT_HIFI_LOOK, { id: "hifi", name: "bad" });
  const [chamber] = base.cabinet.chambers;
  const withChamber = (c: SpeakerChamber): SpeakerSpec => ({
    ...base,
    cabinet: { ...base.cabinet, chambers: [c] },
  });
  const finite = (r: ReturnType<typeof speakerResponse>) =>
    r.sum.every((o) => Number.isFinite(o.spl)) &&
    r.bands.every((b) => b.curve.every((o) => Number.isFinite(o.spl)));
  assert.ok(chamber.vent.kind === VENT_KIND.vented);
  for (const c of [
    { ...chamber, netLiters: 0 },
    { ...chamber, netLiters: -5 },
    { ...chamber, vent: { ...chamber.vent, port: { ...chamber.vent.port, len: 0 } } },
    {
      ...chamber,
      vent: { ...chamber.vent, port: { shape: PORT_SHAPE.round, n: 0, dia: 2, len: 6 } },
    },
  ]) {
    const r = speakerResponse(withChamber(c));
    assert.deepEqual(r.chambers[0].gaps, [SPEAKER_MODEL_GAP.noModel]);
    assert.ok(finite(r));
  }
  const badCorner = speakerResponse({
    ...base,
    bands: base.bands.map((b) =>
      b.id === SPEAKER_BAND.low && b.lowpass ? { ...b, lowpass: { ...b.lowpass, hz: 0 } } : b,
    ),
  });
  assert.deepEqual(badCorner.gaps, [SPEAKER_MODEL_GAP.badFilter]);
  assert.deepEqual(
    badCorner.bands.map((b) => b.id),
    [SPEAKER_BAND.high],
  );
  assert.ok(finite(badCorner));
});

test("speaker model: a chamber's stuffing reaches a horn's rear chamber as it does a direct box", () => {
  const sealed = speakerFromHifi(
    { ...DEFAULT_HIFI, boxType: VENT_KIND.sealed },
    DEFAULT_HIFI_LOOK,
    { id: "hifi", name: "stuffed" },
  );
  const [chamber] = sealed.cabinet.chambers;
  // the woofer alone on the throat
  const set = {
    ...chamber,
    netLiters: 10,
    drivers: chamber.drivers.filter((d) => d.kind === "woofer"),
  };
  const read = hornDesignOf(
    {
      ...set,
      load: {
        kind: CHAMBER_LOAD.horn,
        horn: {
          throatChamber: 0,
          segments: [],
          portOffset: 0,
          drive: { kind: HORN_DRIVE.front },
          path: HORN_PATH.straight,
        },
      },
    },
    { count: 1, angle: 2 },
  );
  assert.ok(read.ok);
  assert.ok(Math.abs(read.design.rear.liters - 10 * (1 + chamber.stuffingPct / 100)) < 1e-12);
  assert.equal(chamber.stuffingPct, 10, "the Hi-fi engine's 10%");
});
