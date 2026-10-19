// The general speaker model (lib/speaker/speakerResponse) against today's engines: the golden Hi-fi and PA designs,
// read through the L1 adapters, give the same curves, net air and tuning as the Hi-fi and PA models.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { ohmsOf } from "../src/lib/power";
import { configs } from "./golden-configs";
import {
  PA_FLOOR,
  atModelVolts,
  bandCurve,
  levelAt,
  maxDiff,
  paDesign,
  paModels,
  speakerAndFeed,
  withNet,
} from "./speaker-cases";
import { speakerResponse, SPEAKER_RESPONSE_FREQUENCIES } from "../src/lib/speaker/speakerResponse";
import { speakerFromHifi } from "../src/lib/speaker/hifiSpec";
import { layersFromPa } from "../src/lib/speaker/paSpec";
import { flushBracing, lrFilter } from "../src/lib/speaker/specParts";
import { filterTransfer, filtersTransfer } from "../src/lib/speaker/bandFilter";
import {
  boxModel,
  closedBox,
  highpassGain,
  linkwitzRileyHighpass,
  linkwitzRileyLowpass,
} from "../src/lib/acoustics/boxModels";
import { abs, add, complex, multiply, phasor, scale } from "../src/lib/acoustics/complex";
import { chamberVentModel } from "../src/lib/speaker/chamberAir";
import { CD_OPTIONS, HORN_OPTIONS, MID_OPTIONS, SUB_OPTIONS } from "../src/lib/data";
import {
  DEFAULT_HIFI,
  DEFAULT_HIFI_LOOK,
  DEFAULT_PA,
  DEFAULT_SPEAKER_BAND,
} from "../src/lib/defaults";
import { HORN_PROFILE } from "../src/constants/hornEngine";
import { HIFI_PORT_MAX_MS } from "../src/constants/hifiEngine";
import { hornModel } from "../src/lib/acoustics/hornModel";
import { hornDesignOf } from "../src/lib/speaker/hornDesign";
import { frontLoadedOf, roomOf } from "./horn-room";
import {
  CHAMBER_LOAD,
  DRIVER_KIND,
  FIRST_ORDER_FILTER,
  HORN_DRIVE,
  HORN_ENGINE_GAP,
  HORN_PATH,
  PORT_SHAPE,
  SPEAKER_BAND,
  SPEAKER_BAND_NAMES,
  SPEAKER_MODEL_GAP,
  SPEAKER_PART,
  SPEAKER_RESPONSE_VOLTS,
  VENT_KIND,
} from "../src/constants/speakerSpec";
import type { BandId, Complex, SpeakerChamber, SpeakerSpec } from "../src/types";

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
 * today's curves between their points, and Fb to rounding. With the net air worked out from the size (lib/speaker
 * speakerBuild: the braces, vent walls, cleats and hardware recesses counted as the PA counts them), the sub's net air is
 * the PA's (PA_FB_PCT) and its band within PA_EXACT_DB. The mid's is less than the PA's by up to PA_MID_NET_PCT: the
 * model counts its baffle cleats, as the PA counts the sub's (the PA's mid leaves them out), and in the tower the braces
 * its rule gives the mid chamber (the PA page leaves that chamber unbraced). Its sealed curve moves by up to
 * PA_MID_FREE_DB.
 *
 * On the goldens (Oct 2026), from the size: the mid's net air is −1.0% to −2.7% of the PA's in a box of its own (up to
 * 0.13 dB), −3.7% in the tower (0.01 dB).
 */
const PA_EXACT_DB = 0.05;
const PA_FB_PCT = 1e-9;
const PA_MID_NET_PCT = 4;
const PA_MID_FREE_DB = 0.15;

test("speaker model: the golden PA designs match the PA models (sub, mid and horn bands, net air, tuning)", () => {
  const rows: PaRow[] = [];
  for (const c of configs) {
    const cfg = paDesign(c);
    const tower = cfg.layout === "tower";
    const read = layersFromPa(cfg, { id: "pa", name: c.name }, PA_FLOOR);
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
    assert.ok(r.subFreeDb <= PA_EXACT_DB, `${r.name}: sub as read, ${r.subFreeDb.toFixed(3)} dB`);
    assert.ok(Math.abs(r.netPct) <= PA_FB_PCT, `${r.name}: sub's net air off by ${r.netPct}%`);
    assert.ok(
      r.midNetPct <= 0 && r.midNetPct >= -PA_MID_NET_PCT,
      `${r.name}: mid's net air off by ${r.midNetPct.toFixed(2)}%`,
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
    bracing: flushBracing(0.75),
    vent: {
      kind: VENT_KIND.vented,
      port: { shape: PORT_SHAPE.round, n: 2, dia: 4, len: 8 },
      maxSpeedMs: HIFI_PORT_MAX_MS,
    },
    load: {
      kind: CHAMBER_LOAD.horn,
      horn: {
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
    bands: [{ id: SPEAKER_BAND.low, name: SPEAKER_BAND_NAMES.low, ...DEFAULT_SPEAKER_BAND }],
  };
  const response = speakerResponse(binSpec);
  const read = hornDesignOf(bin, { count: 1, angle: 2 }, roomOf(bin));
  const model = hornModel(
    frontLoadedOf(read),
    SPEAKER_RESPONSE_FREQUENCIES,
    SPEAKER_RESPONSE_VOLTS,
  );
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
  // the fronts at the closed end: not between two sections
  assert.deepEqual(tapped.chambers[0].gaps, [HORN_ENGINE_GAP.taps]);
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
    const read = layersFromPa(cfg, { id: "pa", name: seed.name }, PA_FLOOR);
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
    const hornFlat = cd.hf.sens + 10 * Math.log10(8 / ohmsOf(cd.hf));
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
          segments: [],
          portOffset: 0,
          drive: { kind: HORN_DRIVE.front },
          path: HORN_PATH.straight,
        },
      },
    },
    { count: 1, angle: 2 },
    roomOf(set),
  );
  assert.ok(
    Math.abs(frontLoadedOf(read).rear.liters - 10 * (1 + chamber.stuffingPct / 100)) < 1e-12,
  );
  assert.equal(chamber.stuffingPct, 10, "the Hi-fi engine's 10%");
});

test("speaker model: a stuffed horn chamber reports its own net air and plays on the stuffed rear chamber", () => {
  const sealed = speakerFromHifi(
    { ...DEFAULT_HIFI, boxType: VENT_KIND.sealed },
    DEFAULT_HIFI_LOOK,
    { id: "hifi", name: "stuffed horn" },
  );
  const [chamber] = sealed.cabinet.chambers;
  const horn: SpeakerChamber = {
    ...chamber,
    netLiters: 10,
    stuffingPct: 20,
    drivers: chamber.drivers.filter((d) => d.kind === "woofer"),
    load: {
      kind: CHAMBER_LOAD.horn,
      horn: {
        segments: [{ profile: HORN_PROFILE.exponential, s1: 150, s2: 600, length: 40 }],
        portOffset: 0,
        drive: { kind: HORN_DRIVE.front },
        path: HORN_PATH.straight,
      },
    },
  };
  const spec: SpeakerSpec = {
    ...sealed,
    cabinet: { ...sealed.cabinet, chambers: [horn] },
    bands: [{ id: SPEAKER_BAND.low, name: SPEAKER_BAND_NAMES.low, ...DEFAULT_SPEAKER_BAND }],
  };
  const response = speakerResponse(spec);
  assert.equal(response.chambers[0].netLiters, 10, "the chamber's own net air, as a direct one");
  const read = hornDesignOf(horn, { count: 1, angle: 2 }, roomOf(horn));
  const design = frontLoadedOf(read);
  assert.ok(Math.abs(design.rear.liters - 12) < 1e-12, "the engine's rear chamber: 20% more");
  const model = hornModel(design, SPEAKER_RESPONSE_FREQUENCIES, SPEAKER_RESPONSE_VOLTS);
  assert.ok(model);
  const low = bandCurve(response, SPEAKER_BAND.low);
  assert.ok(low.every((o, i) => Math.abs(o.spl - model.curve[i].spl) < 1e-9));
});
