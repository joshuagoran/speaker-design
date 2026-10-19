// The general speaker model (lib/speaker/speakerResponse): the Hi-fi and PA designs, read through the L1 adapters, keep
// the PA rules' net air; each chamber's cones run through the horn engine and the bands sum with their phase.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { ohmsOf } from "../src/lib/power";
import { configs } from "./pa-configs";
import {
  PA_FLOOR,
  bandCurve,
  levelAt,
  paDesign,
  paSubGeometry,
  speakerAndFeed,
} from "./speaker-cases";
import { speakerResponse, SPEAKER_RESPONSE_FREQUENCIES } from "../src/lib/speaker/speakerResponse";
import { speakerFromHifi } from "../src/lib/speaker/hifiSpec";
import { layersFromPa } from "../src/lib/speaker/paSpec";
import { flushBracing } from "../src/lib/speaker/specParts";
import { filterTransfer, filtersTransfer } from "../src/lib/speaker/bandFilter";
import { highpassGain, STUFFING_VOLUME_GAIN } from "../src/lib/acoustics/boxModels";
import { abs, add, complex, multiply, phasor, scale } from "../src/lib/acoustics/complex";
import { chamberHornPort } from "../src/lib/speaker/chamberAir";
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

test("speaker model: a band filter's magnitude is the highpass gain and the Linkwitz-Riley closed form", () => {
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
      // an LR of order n: 1/(1 + xⁿ) below, xⁿ/(1 + xⁿ) above, x = f/fc
      const xn = Math.pow(f / 100, order);
      assert.ok(
        Math.abs(abs(filterTransfer(f, { hz: 100, type }, "lowpass")) - 1 / (1 + xn)) < 1e-12,
      );
      assert.ok(
        Math.abs(abs(filterTransfer(f, { hz: 100, type }, "highpass")) - xn / (1 + xn)) < 1e-12,
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

/**
 * Tolerance for the PA sub's net air: worked out from the size (lib/speaker speakerBuild: the braces, vent walls,
 * cleats, and hardware recesses counted as the PA rules count them), it is the PA rules' to rounding.
 */
const PA_NET_PCT = 1e-9;

test("speaker model: the PA designs' subs keep the PA rules' net air", () => {
  for (const c of configs) {
    const cfg = paDesign(c);
    const tower = cfg.layout === "tower";
    const read = layersFromPa(cfg, { id: "pa", name: c.name }, PA_FLOOR);
    const { netL } = paSubGeometry(cfg);
    const subSide = speakerAndFeed(read, tower ? SPEAKER_PART.tower : SPEAKER_PART.sub);
    const response = speakerResponse(subSide.spec, { feed: subSide.feed });
    const netPct = (100 * (response.chambers[0].netLiters - netL)) / netL;
    assert.ok(response.chambers[0].fb !== null, c.name);
    assert.ok(Math.abs(netPct) <= PA_NET_PCT, `${c.name}: sub's net air off by ${netPct}%`);
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

test("speaker model: two alike woofers in one chamber play as a bank (twice the air: the same Qtc, about +6 dB at the same voltage)", () => {
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
  // the two cones radiate as one piston of twice the area: each carries a little more of the air's mass, so above the
  // box's resonance the bank is a little under +6 dB (0.2 dB at 300 Hz for these 6.5″ woofers)
  for (const f of [40, 100, 300])
    assert.ok(
      Math.abs(at(two, f) - at(one, f) - 20 * Math.log10(2)) < 0.25,
      `a bank of two at ${f} Hz: ${at(two, f) - at(one, f)}`,
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
  const volts = SPEAKER_RESPONSE_VOLTS;
  const stack = configs.find((c) => c.layout !== "tower");
  const towerSeed = configs.find((c) => c.layout === "tower");
  assert.ok(stack && towerSeed);
  for (const seed of [stack, towerSeed]) {
    const cfg = paDesign(seed);
    const tower = cfg.layout === "tower";
    const read = layersFromPa(cfg, { id: "pa", name: seed.name }, PA_FLOOR);
    const { spec, feed } = speakerAndFeed(read, tower ? SPEAKER_PART.tower : SPEAKER_PART.top);
    const { netL: subNetL } = paSubGeometry(cfg);
    const sub = SUB_OPTIONS.find((o) => o.id === cfg.sub);
    const mid = MID_OPTIONS.find((o) => o.id === cfg.mid);
    const cd = CD_OPTIONS.find((o) => o.id === cfg.cd);
    const horn = HORN_OPTIONS.find((o) => o.id === cfg.horn);
    assert.ok(sub && mid && cd?.hf && horn?.hf);
    // the sub chamber at the PA rules' net air, the mid chamber at its own as built
    const midIndex = spec.cabinet.chambers.findIndex((c) =>
      c.drivers.some((d) => d.kind === "mid"),
    );
    const midNetL = speakerResponse(spec, { feed }).chambers[midIndex].netLiters;
    const set: SpeakerSpec = {
      ...spec,
      cabinet: {
        ...spec.cabinet,
        chambers: spec.cabinet.chambers.map((c, i) =>
          c.drivers.some((d) => d.kind === "sub")
            ? { ...c, netLiters: subNetL }
            : i === midIndex
              ? { ...c, netLiters: midNetL }
              : c,
        ),
      },
    };
    const response = speakerResponse(set, { feed });
    // each band's pressure from the horn engine on the model's grid (the cones straight on the air), with its phase,
    // then its filters, the feed and level (the mid chamber's stuffing is the PA's 15%)
    const direct = (
      driver: typeof mid.ts,
      liters: number,
      port: ReturnType<typeof chamberHornPort>,
    ) =>
      hornModel(
        {
          driver,
          drivers: 1,
          count: 1,
          throatChamber: 0,
          segments: [],
          rear: { liters, port },
          angle: 2,
          portOffset: 0,
        },
        SPEAKER_RESPONSE_FREQUENCIES,
        volts,
      );
    const midBox = direct(mid.ts, midNetL * STUFFING_VOLUME_GAIN, null);
    const subChamber = set.cabinet.chambers[0];
    const port = tower ? chamberHornPort(set.cabinet, subChamber) : null;
    const subBox = port && direct(sub.ts, subNetL, port);
    assert.ok(midBox && (!tower || subBox));
    const hornFlat = cd.hf.sens + 10 * Math.log10(8 / ohmsOf(cd.hf));
    const { lowHz } = horn.hf;
    const at = (o: { spl: number; phase: number }) => scale(phasor(o.phase), 10 ** (o.spl / 20));
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
