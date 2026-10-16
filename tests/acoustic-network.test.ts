// The acoustic network engine (lib/acoustics/network) against the planner's own models, and the physics its new
// presets must obey.
//
// - Parity: with the same parts it gives the horn engine's results (lib/acoustics/hornModel) for every Hornresp case
//   that engine passes, and the box models' (lib/pa/calc closedBox and boxModel). The task's bar is 0.01 dB in level
//   and 0.1 % in excursion; the checks hold it to rounding (1e-9).
// - Physics: an offset-driver horn tapped at its throat is the front-loaded horn; a tapped horn's response moves
//   smoothly as its taps move; every node's flows add to zero; a tapped horn rolls off below its path's quarter wave.
//
// Words used below: "flow" is volume velocity (m³/s); a "tap" is a segment boundary where a driver side meets the path.
import { test } from "vite-plus/test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { hornModel } from "../src/lib/acoustics/hornModel";
import { abs, add, complex, scale } from "../src/lib/acoustics/complex";
import { networkResponse, solveNetworkAt } from "../src/lib/acoustics/network/solve";
import {
  frontLoadedHorn,
  offsetDriverHorn,
  presetModel,
  sealedBox,
  tappedHorn,
  ventedBox,
} from "../src/lib/acoustics/network/presets";
import { NETWORK_PART } from "../src/constants/acousticNetwork";
import { SPEED_OF_SOUND } from "../src/constants/acoustics";
import { HORN_PROFILE } from "../src/constants/hornEngine";
import { CM_PER_M } from "../src/constants/units";
import { boxModel, closedBox, highpassGain } from "../src/lib/pa/calc";
import { DEFAULT_PA } from "../src/lib/defaults";
import type {
  AcousticNetwork,
  BoxModelTS,
  HornDesign,
  HornModel,
  HornPoint,
  HornSegment,
  PresetNetwork,
  TappedHornDesign,
} from "../src/types";
import { CASES, HORNRESP_DIR, designOf, resultsOf } from "./hornresp-records";

/** How close two runs of the same parts must come: dB, and relative for excursion, Ze, speeds and delay. */
const SAME_DB = 1e-9,
  SAME_RELATIVE = 1e-9;
/** The inductances the box-model checks run with, mH: none, and a coil like a 12″ mid's. */
const BOX_MODEL_INDUCTANCES = [0, 1.5];

/** Asserts that two numbers differ by at most `tolerance`. */
const near = (actual: number, expected: number, tolerance: number, what: string) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${what}: ${actual} vs ${expected} (tolerance ${tolerance})`,
  );
/** Asserts that two numbers differ by at most `tolerance` of the expected one's size (or an absolute floor). */
const nearRelative = (actual: number, expected: number, tolerance: number, what: string) =>
  near(actual, expected, tolerance * Math.max(Math.abs(expected), 1e-12), what);

/** A preset that must build. */
function built(preset: PresetNetwork | null): PresetNetwork {
  assert.ok(preset, "the preset should build");
  return preset;
}
/** A model that must exist. */
function modeled(model: HornModel | null): HornModel {
  assert.ok(model, "the design should be modelable");
  return model;
}

/** Asserts that two horn curves agree point by point, every readout. */
function sameCurve(network: HornPoint[], engine: HornPoint[], what: string) {
  assert.strictEqual(network.length, engine.length);
  engine.forEach((expected, i) => {
    const actual = network[i];
    const at = `${what} at ${expected.f.toFixed(1)} Hz`;
    near(actual.spl, expected.spl, SAME_DB, `${at}: SPL`);
    near(actual.powerSpl, expected.powerSpl, SAME_DB, `${at}: power SPL`);
    near(actual.phase, expected.phase, 1e-9, `${at}: phase`);
    nearRelative(actual.delay, expected.delay, 1e-6, `${at}: delay`);
    nearRelative(actual.xmm, expected.xmm, SAME_RELATIVE, `${at}: excursion`);
    nearRelative(actual.ze, expected.ze, SAME_RELATIVE, `${at}: Ze`);
    nearRelative(actual.portSpeed, expected.portSpeed, SAME_RELATIVE, `${at}: vent speed`);
    nearRelative(actual.throatSpeed, expected.throatSpeed, SAME_RELATIVE, `${at}: throat speed`);
  });
}

for (const c of CASES) {
  test(`the network gives the horn engine's results: ${c.name}, ${c.boxes} box(es) of ${c.drivers} driver(s)`, () => {
    const { design, volts, losses } = designOf(
      fs.readFileSync(path.join(HORNRESP_DIR, `${c.name}.txt`), "latin1"),
      c.boxes,
      c.drivers,
    );
    const hornresp = resultsOf(
      fs.readFileSync(path.join(HORNRESP_DIR, `${c.name}-results.txt`), "utf8"),
    );
    const freqs = hornresp.map((p) => p.f);
    const engine = modeled(hornModel(design, freqs, volts, losses));
    const preset = built(frontLoadedHorn(design, losses));
    const network = modeled(presetModel(preset, freqs, volts));
    sameCurve(network.curve, engine.curve, c.name);
    assert.strictEqual(network.fb, engine.fb);
    // and so Hornresp's own results, as closely as the horn engine comes (tests/hornresp.test.ts)
    hornresp.forEach((expected, i) => {
      const point = network.curve[i];
      near(point.powerSpl, expected.spl, c.spl, `${c.name} vs Hornresp at ${expected.f} Hz`);
    });
  });
}

test("with the radiation load off the horn preset is the horn engine's box mode too", () => {
  const design: HornDesign = {
    driver: { ...DEFAULT_PA.sub.ts, Le: 1.2 },
    drivers: 2,
    count: 1,
    throatChamber: 3,
    segments: [{ profile: HORN_PROFILE.exponential, s1: 600, s2: 3000, length: 120 }],
    rear: { liters: 90, port: { area: 300, length: 25, slot: { width: 30, height: 10 } } },
    angle: 1,
    portOffset: 20,
  };
  const freqs = [15, 25, 40, 63, 100, 160, 250, 400];
  for (const radiationLoad of [false, true]) {
    const engine = modeled(hornModel(design, freqs, 10, { radiationLoad }));
    const network = modeled(
      presetModel(built(frontLoadedHorn(design, { radiationLoad })), freqs, 10),
    );
    sameCurve(network.curve, engine.curve, `radiation load ${radiationLoad}`);
  }
});

test("the network gives the sealed box model's results, the coil's inductance included", () => {
  for (const Le of BOX_MODEL_INDUCTANCES) {
    const driver: BoxModelTS = { ...DEFAULT_PA.mid.ts, Le };
    const liters = 30,
      volts = 20;
    const sealed = closedBox(driver, liters, null, null, volts, {
      hpOrder: 4,
      lpOrder: 4,
      fmin: 20,
      fmax: 2000,
      N: 120,
      phase: true,
    });
    assert.ok(sealed);
    const network = modeled(
      presetModel(
        sealedBox(driver, liters),
        sealed.curve.map((p) => p.f),
        volts,
      ),
    );
    sealed.curve.forEach((box, i) => {
      const point = network.curve[i];
      const at = `Le ${Le} at ${box.f.toFixed(1)} Hz`;
      near(point.spl, box.raw, SAME_DB, `SPL ${at}`);
      nearRelative(point.xmm, box.xmm, SAME_RELATIVE, `excursion ${at}`);
      near(point.phase, box.rawPhase ?? NaN, 1e-9, `phase ${at}`);
    });
  }
});

test("the network gives the vented box model's results, the coil's inductance included", () => {
  for (const Le of BOX_MODEL_INDUCTANCES) {
    const driver: BoxModelTS = { ...DEFAULT_PA.sub.ts, Le };
    const liters = 180,
      ventSquareInches = 40,
      ventInches = 14,
      highpassHz = 31,
      volts = 50;
    for (const opts of [{}, { nPorts: 2, QL: 10, Qp: 30 }]) {
      const vented = boxModel(
        driver,
        liters,
        ventSquareInches,
        ventInches,
        highpassHz,
        volts,
        "BW24",
        {
          ...opts,
          phase: true,
          N: 160,
        },
      );
      assert.ok(vented);
      const preset = ventedBox(driver, liters, ventSquareInches, ventInches, opts);
      const network = modeled(
        presetModel(
          preset,
          vented.curve.map((p) => p.f),
          volts,
        ),
      );
      near(network.fb ?? 0, vented.Fb, 1e-12, "tuning");
      vented.curve.forEach((box, i) => {
        const point = network.curve[i];
        // the box model's excursion and vent speed include its highpass; the network's are before any filter
        const highpass = highpassGain(box.f, highpassHz, "BW24");
        const at = `Le ${Le} at ${box.f.toFixed(1)} Hz`;
        near(point.spl, box.raw, SAME_DB, `SPL ${at}`);
        nearRelative(point.xmm * highpass, box.xmm, SAME_RELATIVE, `excursion ${at}`);
        nearRelative(point.portSpeed * highpass, box.vel, SAME_RELATIVE, `vent speed ${at}`);
        near(point.phase, box.rawPhase ?? NaN, 1e-9, `phase ${at}`);
      });
    }
  }
});

/** A sub bin: a 15″ PA sub on four parabolic sections, a 120 L sealed rear chamber. */
const SUB_BIN: HornDesign = {
  driver: { ...DEFAULT_PA.sub.ts, Le: 1.6 },
  drivers: 1,
  count: 1,
  throatChamber: 2,
  segments: [
    { profile: HORN_PROFILE.parabolic, s1: 500, s2: 700, length: 40 },
    { profile: HORN_PROFILE.parabolic, s1: 700, s2: 1200, length: 80 },
    { profile: HORN_PROFILE.parabolic, s1: 1200, s2: 2000, length: 70 },
  ],
  rear: { liters: 120, port: null },
  angle: 2,
  portOffset: 0,
};
/** A log grid of frequencies, Hz. */
const grid = (from: number, to: number, count: number) =>
  Array.from({ length: count }, (_, i) => from * Math.pow(to / from, i / (count - 1)));

test("an offset-driver horn tapped at its throat is the front-loaded horn", () => {
  const freqs = grid(15, 1000, 80);
  const front = modeled(presetModel(built(frontLoadedHorn(SUB_BIN)), freqs, 10));
  // tap 0: the very same network
  const atThroat = modeled(presetModel(built(offsetDriverHorn({ ...SUB_BIN, tap: 0 })), freqs, 10));
  sameCurve(atThroat.curve, front.curve, "tap 0");
  // a closed stub that shrinks to nothing converges on it: 10 µm of path before the tap
  const stub: HornSegment = { profile: HORN_PROFILE.parabolic, s1: 499.99, s2: 500, length: 0.001 };
  const nearThroat = modeled(
    presetModel(
      built(offsetDriverHorn({ ...SUB_BIN, segments: [stub, ...SUB_BIN.segments], tap: 1 })),
      freqs,
      10,
    ),
  );
  front.curve.forEach((expected, i) => {
    near(
      nearThroat.curve[i].powerSpl,
      expected.powerSpl,
      0.01,
      `SPL at ${expected.f.toFixed(1)} Hz`,
    );
    nearRelative(
      nearThroat.curve[i].xmm,
      expected.xmm,
      1e-3,
      `excursion at ${expected.f.toFixed(1)} Hz`,
    );
  });
});

/**
 * A Thorn-like 10″ tapped horn: a 200 cm path, closed at its start, its taps at 30 cm and 120 cm. The path is
 * parabolic, so a tap can move anywhere along it (`atTaps`).
 */
const TAPPED_PATH = { start: 200, end: 900, length: 200 } as const;
const TAPPED_DRIVER: BoxModelTS = {
  Sd: 350,
  Bl: 17,
  Re: 5.3,
  Le: 0.9,
  Mms: 55,
  Fs: 48,
  Qms: 6,
  Xmax: 7,
};
/** The path's area (cm²) at `x` cm from its closed end: parabolic, so it grows linearly. */
const pathArea = (x: number) =>
  TAPPED_PATH.start + ((TAPPED_PATH.end - TAPPED_PATH.start) * x) / TAPPED_PATH.length;
/** The tapped horn with its front tap at `front` cm and its rear tap at `rear` cm along the path. */
function atTaps(front: number, rear: number): TappedHornDesign {
  const cuts = [0, front, rear, TAPPED_PATH.length];
  return {
    driver: TAPPED_DRIVER,
    drivers: 1,
    count: 1,
    frontChamber: null,
    rearChamber: null,
    angle: 2,
    segments: cuts.slice(1).map((end, i) => ({
      profile: HORN_PROFILE.parabolic,
      s1: pathArea(cuts[i]),
      s2: pathArea(end),
      length: end - cuts[i],
    })),
    frontTap: 1,
    rearTap: 2,
  };
}

test("a tapped horn's response is continuous as its taps move", () => {
  const freqs = grid(15, 500, 120);
  const curveAt = (front: number, rear: number) =>
    modeled(presetModel(built(tappedHorn(atTaps(front, rear))), freqs, 2.83)).curve;
  const base = curveAt(30, 120);
  /** a level in dB as a pressure, relative */
  const pressureOf = (spl: number) => Math.pow(10, spl / 20);
  /** the base curve's loudest pressure */
  const loudest = Math.max(...base.map((p) => pressureOf(p.powerSpl)));
  // the gap to a moved tap, as a share of the loudest pressure (a notch's level in dB jumps as it moves past a
  // frequency, its pressure does not), shrinks with the move: 1 cm, then 1 mm
  const largestGap = (other: HornPoint[]) =>
    Math.max(
      ...base.map(
        (p, i) => Math.abs(pressureOf(p.powerSpl) - pressureOf(other[i].powerSpl)) / loudest,
      ),
    );
  for (const [front, rear] of [
    [31, 120],
    [30, 121],
  ]) {
    const coarse = largestGap(curveAt(front, rear));
    const fine = largestGap(curveAt(30 + (front - 30) / 10, 120 + (rear - 120) / 10));
    assert.ok(coarse < 0.1, `a 1 cm move changes the pressure by ${coarse} of the loudest`);
    assert.ok(fine < coarse / 5, `a 1 mm move changes it by ${fine}, a 1 cm one by ${coarse}`);
  }
  // splitting a section where no driver taps changes nothing
  const split = atTaps(30, 120);
  const [first, second, third] = split.segments;
  const half = first.length / 2;
  const middle = pathArea(half);
  const splitCurve = modeled(
    presetModel(
      built(
        tappedHorn({
          ...split,
          segments: [
            { ...first, s2: middle, length: half },
            { ...first, s1: middle, length: half },
            second,
            third,
          ],
          frontTap: 2,
          rearTap: 3,
        }),
      ),
      freqs,
      2.83,
    ),
  ).curve;
  base.forEach((p, i) =>
    near(splitCurve[i].powerSpl, p.powerSpl, 1e-6, `split at ${p.f.toFixed(1)} Hz`),
  );
});

test("a tapped horn whose two taps meet plays nothing: the cone's two sides cancel", () => {
  const design = atTaps(30, 120);
  const network = modeled(
    presetModel(built(tappedHorn({ ...design, rearTap: design.frontTap })), [40, 80], 2.83),
  );
  network.curve.forEach((p) => assert.ok(p.spl < -100, `SPL ${p.spl} at ${p.f} Hz`));
});

/** Asserts that every node's flows add to zero, and returns the largest flow it saw (m³/s). */
function assertConserved(network: AcousticNetwork, f: number) {
  const state = solveNetworkAt(network, f, 10);
  assert.ok(state);
  /** each node's flows out, summed, and the largest flow seen */
  const sums = Array.from({ length: network.nodeCount }, () => complex(0));
  let largest = 0;
  /** adds `flow` leaving `node` */
  const leaves = (node: number, flow: { re: number; im: number }) => {
    sums[node] = add(sums[node], flow);
    largest = Math.max(largest, abs(flow));
  };
  network.parts.forEach((part, i) => {
    const flow = state.flows[i];
    switch (part.kind) {
      case NETWORK_PART.driver:
        leaves(part.rear, flow.in);
        leaves(part.front, scale(flow.out, -1));
        return;
      case NETWORK_PART.chamber:
      case NETWORK_PART.opening:
        leaves(part.node, flow.in);
        return;
      case NETWORK_PART.duct:
      case NETWORK_PART.mass:
        leaves(part.from, flow.in);
        leaves(part.to, scale(flow.out, -1));
        return;
    }
  });
  sums.forEach((sum, node) =>
    assert.ok(
      abs(sum) <= 1e-12 * largest,
      `node ${node} at ${f} Hz: flows add to ${abs(sum)} of ${largest}`,
    ),
  );
}

test("every node's flows add to zero (conservation of volume velocity)", () => {
  const vented: HornDesign = {
    ...SUB_BIN,
    rear: { liters: 120, port: { area: 200, length: 30 } },
    portOffset: 10,
  };
  const networks = [
    built(frontLoadedHorn(vented)).network,
    built(offsetDriverHorn({ ...vented, tap: 1 })).network,
    built(
      tappedHorn({
        ...atTaps(30, 120),
        frontChamber: { liters: 1, area: 200 },
        rearChamber: { liters: 4, area: 300 },
      }),
    ).network,
    ventedBox(DEFAULT_PA.sub.ts, 180, 40, 14).network,
  ];
  for (const network of networks)
    for (const f of [12, 37, 90, 250, 900]) assertConserved(network, f);
});

test("a tapped horn rolls off below its path's quarter-wave resonance", () => {
  /** the path's quarter-wave resonance, Hz: c/(4L) */
  const quarterWave = SPEED_OF_SOUND / (4 * (TAPPED_PATH.length / CM_PER_M));
  const freqs = grid(quarterWave / 8, quarterWave, 60);
  const curve = modeled(presetModel(built(tappedHorn(atTaps(30, 120))), freqs, 2.83)).curve;
  // below half the resonance the level falls with every step down
  const below = curve.filter((p) => p.f < quarterWave / 2);
  below
    .slice(1)
    .forEach((p, i) => assert.ok(p.powerSpl > below[i].powerSpl, `rising at ${p.f.toFixed(1)} Hz`));
  // and at least 12 dB an octave over the bottom octave (the cone's two sides cancel there, as a dipole's)
  const bottom = curve[0],
    octaveUp = curve.reduce((best, p) =>
      Math.abs(p.f - 2 * bottom.f) < Math.abs(best.f - 2 * bottom.f) ? p : best,
    );
  assert.ok(
    octaveUp.powerSpl - bottom.powerSpl >= 12,
    `${(octaveUp.powerSpl - bottom.powerSpl).toFixed(1)} dB from ${bottom.f.toFixed(1)} to ${octaveUp.f.toFixed(1)} Hz`,
  );
  // well below the resonance the tapped horn plays far quieter than at it
  assert.ok(curve[curve.length - 1].powerSpl - bottom.powerSpl > 30);
});

test("a network with a size it divides by at zero, or a node out of range, is not modeled", () => {
  const preset = built(frontLoadedHorn(SUB_BIN));
  const broken = (change: Partial<AcousticNetwork>) =>
    networkResponse({ ...preset.network, ...change }, [50], 10);
  assert.strictEqual(broken({ count: 0 }), null);
  assert.strictEqual(broken({ nodeCount: 1 }), null);
  assert.strictEqual(
    broken({ parts: preset.network.parts.filter((p) => p.kind !== NETWORK_PART.driver) }),
    null,
  );
  assert.strictEqual(networkResponse(preset.network, [0], 10), null);
  // a tap off the path's boundaries does not build
  assert.strictEqual(offsetDriverHorn({ ...SUB_BIN, tap: 4 }), null);
  assert.strictEqual(tappedHorn({ ...atTaps(30, 120), rearTap: 1.5 }), null);
  // nor does a tap chamber's passage with no area
  assert.strictEqual(
    tappedHorn({ ...atTaps(30, 120), frontChamber: { liters: 1, area: 0 } }),
    null,
  );
});
