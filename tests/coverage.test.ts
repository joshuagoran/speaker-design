import { test } from "vite-plus/test";
import assert from "node:assert";
import {
  audienceAverage,
  autoSubDelayMs,
  balanceLevels,
  bandTarget,
  contourSegments,
  coverageBoxes,
  coverageFrequencies,
  coverageGrid,
  coverageResponse,
  coverageScene,
  coverageSlots,
  coverageStats,
  curveLevelAt,
  levelAtPoint,
  ONE_METRE_FT,
  oneMetreSpot,
  pistonQ,
  withOwnPhase,
} from "../src/lib/pa/coverage";
import {
  highpassPhase,
  midSystem,
  phasedCurve,
  subMusicThroughLowpass,
  subSystem,
} from "../src/lib/pa/calc";
import { MID_OPTIONS, SUB_OPTIONS } from "../src/lib/data";
import { paResponseAt, paStackSources } from "../src/lib/pa/dispersion";
import { materialAlpha, surfaceReflection } from "../src/lib/pa/roomAcoustics";
import {
  DEFAULT_COVERAGE_LAYOUT,
  boxReach,
  fitted,
  fromStored,
  stackInRoom,
} from "../src/pages/coverage/useCoverageLayout";
import {
  COVERAGE_LEVEL_REF,
  COVERAGE_TARGET_DB,
  LEGACY_LEVEL_MODE,
} from "../src/constants/coverageLevel";
import { LISTENER_TARGET_DB } from "../src/lib/pa/optimize";
import { baffleStepGain, logSpacedFrequencies, type Complex } from "../src/lib/hifi/hifi";
import { METERS_PER_FOOT as FT } from "../src/constants/units";
import type {
  CoverageLayout,
  CoverageLevels,
  CoverageRoom,
  CoverageStack,
  HighpassType,
  RoomMaterial,
} from "../src/types";

const stack: CoverageStack = {
  sub: { zIn: 12, Sd: 1200 },
  mid: { zIn: 36, Sd: 530 },
  horn: { zIn: 50, covH: 90, covV: 40, wIn: 14, hIn: 8 },
  xoLo: 120,
  xoHi: 900,
  orderLo: 4,
  orderHi: 4,
  footprint: { w: 24, d: 24 },
  midW: 24,
  subDelayMs: 0,
};

/** Every band at `db` at 1 m, through its crossover's magnitude, as the planner's curves are; no phase of its own. */
const levels = (db: number, s: CoverageStack = stack): CoverageLevels => {
  const freqs = logSpacedFrequencies(12, 20000, 400);
  const curve = (band: "sub" | "mid" | "horn") => {
    const o = paStackSources(s).find((src) => src.band === band);
    if (!o) throw new Error(band); // the test stack has all three
    return freqs.map((f) => {
      const h = o.filt(f);
      return { f, spl: db + 20 * Math.log10(Math.max(1e-9, Math.hypot(h.re, h.im))), phase: 0 };
    });
  };
  return { sub: curve("sub"), mid: curve("mid"), horn: curve("horn") };
};

const OPEN: CoverageRoom["materials"] = {
  front: "open",
  back: "open",
  left: "open",
  right: "open",
  ceiling: "open",
};

const layout = (o: Partial<CoverageLayout> = {}): CoverageLayout => ({
  room: {
    widthFt: 40,
    lengthFt: 50,
    ceilingFt: 14,
    materials: OPEN,
    crowd: "empty",
    outdoors: true,
  },
  stacks: [
    { x: -8, y: 3, aim: 0 },
    { x: 8, y: 3, aim: 0 },
  ],
  subs: "stacks",
  cluster: { x: 0, y: 3 },
  mirror: true,
  band: "sub",
  freqHz: 50,
  targetDb: 105,
  levelRef: "audience",
  earFt: 5,
  listener: { x: 0, y: 25 },
  ...o,
});

const at = (
  l: CoverageLayout,
  band: CoverageLayout["band"],
  freq: number,
  x: number,
  y: number,
) => {
  const { freqs, coherent } = coverageFrequencies(band, freq);
  const scene = coverageScene(stack, l);
  return levelAtPoint(
    scene,
    coverageSlots(scene, levels(110), freqs, coherent),
    x * FT,
    y * FT,
    l.earFt * FT,
  );
};

test("coverage: curve levels interpolate on log frequency and are silent outside the curve", () => {
  const c = [
    { f: 100, spl: 90 },
    { f: 1000, spl: 100 },
  ];
  assert.equal(curveLevelAt(c, 100), 90);
  assert.ok(Math.abs((curveLevelAt(c, Math.sqrt(1e5)) ?? 0) - 95) < 1e-9);
  assert.equal(curveLevelAt(c, 50), null);
  assert.equal(curveLevelAt(c, 2000), null);
});

test("coverage: past a curve's ends its band rolls off by its crossover, and an empty curve stays silent", () => {
  const c = [
    { f: 100, spl: 90 },
    { f: 1000, spl: 100 },
  ];
  // a skirt falling 12 dB per octave above 1 kHz: an octave past the end is 12 dB under it
  const skirt = (f: number) => Math.min(1, (1000 / f) ** 2);
  assert.ok(Math.abs((curveLevelAt(c, 2000, skirt) ?? 0) - (100 - 20 * Math.log10(4))) < 1e-9);
  assert.equal(curveLevelAt(c, 50, skirt), 90);
  assert.equal(curveLevelAt([], 500, skirt), null);
  // the planner's mid curve stops at 2 kHz: with the horn crossover near it, the mid carries on past 2 kHz smoothly
  const high = { ...stack, xoHi: 1800 };
  const full = levels(110, high);
  const cut = { ...full, mid: full.mid.filter((o) => o.f <= 2000), horn: [] };
  const highScene = coverageScene(high, layout());
  const mid = (f: number) => {
    const v = coverageSlots(highScene, cut, [f], true)[0].out.mid;
    return v ? 20 * Math.log10(Math.hypot(v.re, v.im)) : -Infinity;
  };
  const end = cut.mid[cut.mid.length - 1].f;
  assert.ok(Math.abs(mid(end * 1.01) - mid(end)) < 0.5, `${mid(end)} to ${mid(end * 1.01)} dB`);
  // and it matches the full curve an octave on
  const ref = coverageSlots(highScene, full, [4000], true)[0].out.mid;
  assert.ok(ref && Math.abs(mid(4000) - 20 * Math.log10(Math.hypot(ref.re, ref.im))) < 0.1);
  assert.equal(coverageSlots(highScene, cut, [4000], true)[0].out.horn, undefined);
});

test("coverage: a box's drivers arrive in phase on its axis at the alignment point, as the dispersion model has them", () => {
  // a tall stack, the horn well above the mid, so a wrong alignment shows plainly at the crossover; its baffles so wide
  // their step (and its phase) sits far below it, as the dispersion model has none
  const tall: CoverageStack = {
    ...stack,
    footprint: { w: 1000, d: 24 },
    midW: 1000,
    mid: { zIn: 20, Sd: 530 },
    horn: { ...stack.horn, zIn: 100 },
  };
  const l = layout();
  const scene = coverageScene(tall, l);
  // the left stack alone, no floor: its first path
  const one = { ...scene, sources: scene.sources.filter((s) => s.path === 0) };
  const [box] = l.stacks;
  const distM = 10,
    freqs = [600, 900, 1350];
  const on = paResponseAt(tall, { th: 0, eyeIn: tall.horn.zIn, distM }, freqs);
  for (const [i, f] of freqs.entries()) {
    const db = levelAtPoint(
      one,
      coverageSlots(one, levels(110, tall), [f], true),
      box.x * FT,
      box.y * FT + distM,
      tall.horn.zIn * 0.0254,
    );
    // 110 dB at 1 m, 20 dB down at 10 m; the dispersion model is 0 dB there when the drivers sum flat
    const rel = db - (110 - 20);
    assert.ok(
      Math.abs(rel - on[i].spl) < 1,
      `${f} Hz: ${rel.toFixed(2)} dB, dispersion ${on[i].spl.toFixed(2)} dB`,
    );
    assert.ok(Math.abs(rel) < 1, `${f} Hz: ${rel.toFixed(2)} dB off flat`);
  }
});

test("coverage: the sub and mid sum flat at the low crossover, at LR24 and LR48", () => {
  for (const order of [4, 8] as const) {
    // the horn crossover far above, so the mid's own lowpass adds no phase at the low one
    const s: CoverageStack = { ...stack, orderLo: order, xoHi: 18000 };
    const scene = coverageScene(s, layout());
    const { sub, mid } = coverageSlots(scene, levels(110, s), [s.xoLo], true)[0].out;
    assert.ok(sub && mid, `LR${order * 6}: both bands play at the crossover`);
    // Linkwitz-Riley: each band 6 dB down and in phase, so the two add to the level either plays alone
    const sum = Math.hypot(sub.re + mid.re, sub.im + mid.im),
      apart = Math.hypot(sub.re, sub.im) + Math.hypot(mid.re, mid.im);
    assert.ok(sum / apart > 0.999, `LR${order * 6}: sum ${(sum / apart).toFixed(4)} of in phase`);
  }
});

test("coverage: each band's baffle step follows its own box: a narrower mid box loses level, the sub doesn't", () => {
  const narrow: CoverageStack = { ...stack, midW: 15 };
  const f = 200;
  const out = (s: CoverageStack) =>
    coverageSlots(coverageScene(s, layout()), levels(110, s), [f], true)[0].out;
  const a = out(stack),
    b = out(narrow);
  const db = (v: Complex | undefined) => (v ? 20 * Math.log10(Math.hypot(v.re, v.im)) : -Infinity);
  const step = 20 * Math.log10(baffleStepGain(f, 15) / baffleStepGain(f, 24));
  assert.ok(step < -1, `the 15″ step is ${step.toFixed(2)} dB under the 24″ one at ${f} Hz`);
  assert.ok(
    Math.abs(db(b.mid) - db(a.mid) - step) < 1e-9,
    `mid ${(db(b.mid) - db(a.mid)).toFixed(2)} dB`,
  );
  assert.ok(Math.abs(db(b.sub) - db(a.sub)) < 1e-9, "the sub keeps its footprint's step");
});

test("coverage: two stacks at one low frequency add on the center line and cancel where their paths differ by half a wavelength", () => {
  const l = layout();
  const f = 50,
    lambdaFt = 343 / f / FT;
  const center = at(l, "one", f, 0, 25);
  // walk across the row at y = 25 ft to the first spot where the path difference is half a wavelength
  let x = 0;
  for (; x < 20; x += 0.05) {
    const d = Math.hypot(x + 8, 22) - Math.hypot(x - 8, 22);
    if (d >= lambdaFt / 2) break;
  }
  const dip = at(l, "one", f, x, 25);
  assert.ok(
    center - dip > 10,
    `center ${center.toFixed(1)} dB, dip ${dip.toFixed(1)} dB at ${x.toFixed(1)} ft`,
  );
});

test("coverage: the band average smooths the low-frequency dip a single frequency shows", () => {
  const l = layout();
  const across = (band: CoverageLayout["band"]) => {
    const v = Array.from({ length: 31 }, (_, i) => at(l, band, 50, -15 + i, 25));
    return Math.max(...v) - Math.min(...v);
  };
  assert.ok(
    across("sub") < across("one"),
    `band ${across("sub").toFixed(1)} dB, 50 Hz ${across("one").toFixed(1)} dB`,
  );
});

test("coverage: a hard wall right behind the stacks lifts the bass, and a softer one less so", () => {
  // indoors, the other sides and the ceiling open: only the front wall's material changes
  const room = (front: RoomMaterial): CoverageLayout =>
    layout({
      stacks: [
        { x: -8, y: 1, aim: 0 },
        { x: 8, y: 1, aim: 0 },
      ],
      room: { ...layout().room, outdoors: false, materials: { ...OPEN, front } },
    });
  const a = at(room("open"), "sub", 50, 0, 25),
    b = at(room("concrete"), "sub", 50, 0, 25),
    c = at(room("glass"), "sub", 50, 0, 25);
  assert.ok(b - a > 4, `wall adds ${(b - a).toFixed(1)} dB`);
  assert.ok(c < b && c > a, `glass ${c.toFixed(1)} dB between ${a.toFixed(1)} and ${b.toFixed(1)}`);
});

test("coverage: the horn's coverage shows in the high band, and toeing in moves it", () => {
  const l = layout({
    stacks: [
      { x: -8, y: 3, aim: 0 },
      { x: 8, y: 3, aim: 0 },
    ],
  });
  // 70° off the left stack's axis, out past its 45° half-angle, against the same distance on axis
  const r = 15,
    a = (70 * Math.PI) / 180;
  const off = at(l, "high", 0, -8 - r * Math.sin(a), 3 + r * Math.cos(a));
  const on = at(l, "high", 0, -8, 3 + r);
  assert.ok(on - off > 6, `on axis ${on.toFixed(1)} dB, 70° off ${off.toFixed(1)} dB`);
  const toed = layout({
    stacks: [
      { x: -8, y: 3, aim: -60 },
      { x: 8, y: 3, aim: 60 },
    ],
  });
  assert.ok(
    at(toed, "high", 0, -8 - r * Math.sin(a), 3 + r * Math.cos(a)) > off + 6,
    "toe-out reaches it",
  );
});

test("coverage: the map follows the planner's levels dB for dB", () => {
  const l = layout();
  const scene = coverageScene(stack, l);
  const { freqs } = coverageFrequencies("mid", 0);
  const g = (db: number) =>
    coverageGrid(scene, coverageSlots(scene, levels(db), freqs, false), l.room, l.earFt, 12);
  const a = g(100),
    b = g(106);
  for (let i = 0; i < a.db.length; i++) assert.ok(Math.abs(b.db[i] - a.db[i] - 6) < 1e-3);
  const s = coverageStats(a, l.room, l.stacks, 200);
  assert.equal(s.within6, 0);
  assert.equal(coverageStats(a, l.room, l.stacks, 0).within3, 1);
});

test("coverage: subs as a center pair sum evenly across the room at low frequency", () => {
  const spaced = layout(),
    center = layout({ subs: "center" });
  const spread = (l: CoverageLayout) => {
    const v = Array.from({ length: 21 }, (_, i) => at(l, "one", 60, -15 + 1.5 * i, 25));
    return Math.max(...v) - Math.min(...v);
  };
  assert.ok(
    spread(center) < spread(spaced) / 2,
    `center ${spread(center).toFixed(1)} dB, spaced ${spread(spaced).toFixed(1)} dB`,
  );
});

test("coverage: the listener response covers the PA axis", () => {
  const l = layout();
  const r = coverageResponse(coverageScene(stack, l), levels(110), l.listener, l.earFt);
  assert.equal(Math.round(r[0].f), 15);
  assert.equal(Math.round(r[r.length - 1].f), 20000);
  assert.ok(r.every((o) => Number.isFinite(o.spl)));
});

test("coverage: contours cross between the cells either side of the level", () => {
  const grid = { cols: 3, rows: 2, db: new Float32Array([0, 10, 20, 0, 10, 20]) };
  const segs = contourSegments(grid, 5);
  assert.equal(segs.length, 1);
  const [x1, , x2] = segs[0];
  assert.ok(Math.abs(x1 - 1) < 1e-9 && Math.abs(x2 - 1) < 1e-9, JSON.stringify(segs));
});

test("coverage: balancing turns the bands with more to spare down to the planner's music balance", () => {
  const flat = (db: number) => [
    { f: 10, spl: db, phase: 0 },
    { f: 20000, spl: db, phase: 0 },
  ];
  const b = { xoLo: 120, xoHi: 900, tilt: 6, hfTilt: 3 };
  // a loud horn and mid: the sub sets the level, mid 6 under it, horn 3 under the mid
  const loud = balanceLevels({ sub: flat(120), mid: flat(124), horn: flat(130) }, b, stack);
  assert.deepEqual(loud.pads, { sub: 0, mid: -10, horn: -19 });
  // a weak mid: it sets the level and the sub comes down to 6 above it
  const weak = balanceLevels({ sub: flat(120), mid: flat(110), horn: flat(130) }, b, stack);
  assert.deepEqual(weak.pads, { sub: -4, mid: 0, horn: -23 });
  assert.equal(weak.levels.sub?.[0].spl, 116);
  // a weak horn sets the level for both others
  const hornWeak = balanceLevels({ sub: flat(120), mid: flat(114), horn: flat(105) }, b, stack);
  assert.deepEqual(hornWeak.pads, { sub: -6, mid: -6, horn: 0 });
  // no sub: only the mid and horn balance
  assert.deepEqual(balanceLevels({ sub: null, mid: flat(114), horn: flat(130) }, b, stack).pads, {
    sub: 0,
    mid: 0,
    horn: -19,
  });
  assert.equal(bandTarget(105, "sub", 0, b), 105);
  assert.equal(bandTarget(105, "mid", 0, b), 99);
  assert.equal(bandTarget(105, "high", 0, b), 96);
  assert.equal(bandTarget(105, "one", 50, b), 105);
});

/** A closed room, `m` on every side and the ceiling, empty. */
const indoors = (
  room: Partial<CoverageRoom>,
  m: RoomMaterial,
  o: Partial<CoverageLayout> = {},
): CoverageLayout =>
  layout({
    ...o,
    room: {
      ...layout().room,
      outdoors: false,
      materials: { front: m, back: m, left: m, right: m, ceiling: m },
      ...room,
    },
  });

test("coverage: a hard room's modes: peaks at the first length and width modes in a corner, a null of the width mode on the center line", () => {
  // 24 × 40 × 12 ft, both stacks against the left wall so the width mode is driven
  const l = indoors({ widthFt: 24, lengthFt: 40, ceilingFt: 12 }, "concrete", {
    stacks: [
      { x: -10, y: 2, aim: 0 },
      { x: -6, y: 2, aim: 0 },
    ],
  });
  const fLength = 343 / (2 * 40 * FT),
    fWidth = 343 / (2 * 24 * FT);
  const corner = (f: number) => at(l, "one", f, 11.5, 39.5);
  // a local peak within 4 % of each mode
  for (const fm of [fLength, fWidth]) {
    const scan = Array.from({ length: 17 }, (_, i) => fm * (0.92 + i * 0.01));
    const levelsHere = scan.map(corner);
    const top = levelsHere.indexOf(Math.max(...levelsHere));
    assert.ok(
      Math.abs(scan[top] / fm - 1) < 0.04 && top > 0 && top < scan.length - 1,
      `peak at ${scan[top].toFixed(1)} Hz for the mode at ${fm.toFixed(1)} Hz`,
    );
    assert.ok(corner(fm) - corner(fm * 0.8) > 6, `${fm.toFixed(1)} Hz stands out`);
  }
  // on the center line the first width mode has its node
  const center = at(l, "one", fWidth, 0, 39.5);
  assert.ok(
    corner(fWidth) - center > 10,
    `corner ${corner(fWidth).toFixed(1)} dB, center ${center.toFixed(1)} dB`,
  );
});

test("coverage: near a box in a large, very absorbent room the modal sum is the free field and floor bounce", () => {
  // 80 × 100 × 40 ft, every side and the ceiling open, the stacks in the middle
  const l = indoors({ widthFt: 80, lengthFt: 100, ceilingFt: 40 }, "open", {
    stacks: [
      { x: -8, y: 50, aim: 0 },
      { x: 8, y: 50, aim: 0 },
    ],
  });
  const scene = coverageScene(stack, l);
  for (const f of [30, 50])
    for (const d of [3, 6]) {
      const [slot] = coverageSlots(scene, levels(110), [f], true);
      assert.equal(slot.modal?.weight, 1);
      const p = [-8 * FT, (50 + d) * FT, l.earFt * FT] as const;
      // the image sources alone: the free field and the floor bounce
      const modal = levelAtPoint(scene, [slot], ...p),
        images = levelAtPoint(scene, [{ ...slot, modal: null }], ...p);
      assert.ok(
        Math.abs(modal - images) < 2,
        `${f} Hz, ${d} ft: modal ${modal.toFixed(1)} dB, images ${images.toFixed(1)} dB`,
      );
    }
});

test("coverage: the reverberant field is the textbook Lw + 10·log10(4/R), from the second reflection on", () => {
  // horn only, 2 kHz: a concrete room, empty
  const l = indoors({ widthFt: 30, lengthFt: 40, ceilingFt: 12 }, "concrete");
  const scene = coverageScene(stack, l);
  const full = levels(110);
  const [slot] = coverageSlots(scene, { sub: null, mid: [], horn: full.horn }, [2000], false);
  // the room by hand at 2 kHz (an octave center): block walls and ceiling 0.09, concrete floor 0.02, ISO air 9.89 dB/km
  const [w, len, h] = [30 * FT, 40 * FT, 12 * FT];
  const walls = 2 * (w + len) * h + w * len,
    floor = w * len,
    volume = w * len * h;
  const sa = 0.09 * walls + 0.02 * floor,
    alpha = sa / (walls + floor),
    A = sa + (4 * volume * 0.00989) / (10 * Math.LOG10E),
    R = A / (1 - alpha);
  // the horn's power from its level at 1 m and Molloy's Q for its coverage at 2 kHz (degrees)
  const horn = curveLevelAt(full.horn, 2000) ?? 0;
  const [hh, hv] = slot.hornHalf.map((a) => (a * 180) / Math.PI);
  const sinDeg = (d: number) => Math.sin((d * Math.PI) / 180);
  const q = 180 / ((Math.asin(sinDeg(hh) * sinDeg(hv)) * 180) / Math.PI);
  // Lw (re ρc = 400): Lp(1 m) + 10·log10(4π / Q); two horns; less (1 − ᾱ) for the first reflection, kept as images
  const lw = horn + 10 * Math.log10((4 * Math.PI) / q);
  const expected = lw + 10 * Math.log10(4 / R) + 10 * Math.log10(2) + 10 * Math.log10(1 - alpha);
  const got = 10 * Math.log10(slot.diffuse);
  assert.ok(
    Math.abs(got - expected) < 0.2,
    `${got.toFixed(2)} dB, expected ${expected.toFixed(2)}`,
  );
});

test("coverage: air absorbs ISO 9613-1's dB per metre along a long path at 8 kHz", () => {
  const l = layout();
  const scene = coverageScene(stack, l);
  const [slot] = coverageSlots(scene, levels(110), [8000], false);
  // 100 m down the left stack's axis at horn height, with the air and without it
  const p = [-8 * FT, 3 * FT + 100, stack.horn.zIn * 0.0254] as const;
  const loss = levelAtPoint(scene, [slot], ...p) - levelAtPoint(scene, [{ ...slot, air: 0 }], ...p);
  // ISO 9613-1, Table 1: 20 °C, 50 % RH, 8 kHz: 105 dB/km
  assert.ok(Math.abs(loss + 0.105 * 100) < 0.3, `${loss.toFixed(2)} dB over 100 m`);
});

test("coverage: materials interpolate on log frequency and hold flat past the table; old layouts load", () => {
  // drywall: 0.29 at 125 Hz, 0.10 at 250 Hz
  assert.ok(Math.abs(materialAlpha("drywall", Math.sqrt(125 * 250)) - (0.29 + 0.1) / 2) < 1e-9);
  assert.equal(materialAlpha("drywall", 40), 0.29);
  assert.equal(materialAlpha("drywall", 12000), 0.09);
  assert.equal(surfaceReflection("open", 1000), 0);
  assert.ok(Math.abs(surfaceReflection("curtain", 1000) - Math.sqrt(1 - 0.72)) < 1e-9);
  // a layout stored before materials: a wall on or off per side, and one absorption
  const old = fromStored({
    room: {
      widthFt: 30,
      lengthFt: 40,
      walls: { front: true, back: false, left: true, right: false },
      absorption: 0.4,
      outdoors: false,
    },
  });
  assert.deepEqual(old.room.materials, {
    front: "drywall",
    back: "open",
    left: "drywall",
    right: "open",
    ceiling: DEFAULT_COVERAGE_LAYOUT.room.materials.ceiling,
  });
  assert.equal(old.room.widthFt, 30);
  assert.equal(old.room.ceilingFt, DEFAULT_COVERAGE_LAYOUT.room.ceilingFt);
  assert.ok(!("absorption" in old.room) && !("walls" in old.room));
});

test("coverage: a full dance floor takes the top end out of the floor bounce's comb", () => {
  const comb = (crowd: CoverageRoom["crowd"]) => {
    const l = layout({ room: { ...layout().room, crowd } });
    const scene = coverageScene(stack, l);
    // the left stack and its floor bounce only, every frequency with phase
    const one = { ...scene, sources: scene.sources.filter((s) => s.path <= 1) };
    const v = logSpacedFrequencies(2000, 8000, 60).map((f) =>
      levelAtPoint(one, coverageSlots(one, levels(110), [f], true), -8 * FT, 23 * FT, l.earFt * FT),
    );
    return Math.max(...v) - Math.min(...v);
  };
  assert.ok(
    comb("empty") - comb("full") > 6,
    `empty ${comb("empty").toFixed(1)} dB, full ${comb("full").toFixed(1)} dB`,
  );
});

test("coverage: one center sub is 6 dB under the center pair on the center line at low frequency", () => {
  const pair = at(layout({ subs: "center" }), "one", 40, 0, 25),
    single = at(layout({ subs: "single" }), "one", 40, 0, 25);
  assert.ok(
    Math.abs(pair - single - 20 * Math.log10(2)) < 0.3,
    `pair ${pair.toFixed(2)} dB, one ${single.toFixed(2)} dB`,
  );
  assert.equal(
    coverageBoxes(layout({ subs: "single" }), stack).filter((b) => b.kind === "sub").length,
    1,
  );
});

test("coverage: the balance reads the mid past its curve's end when the horn crosses over above it", () => {
  const high = { ...stack, xoHi: 2500 };
  const full = levels(110, high);
  // the planner's mid curve stops at 2 kHz, under the 2.5 kHz crossover
  const cut = { ...full, mid: full.mid.filter((o) => o.f <= 2000) };
  const b = { xoLo: 120, xoHi: 2500, tilt: 6, hfTilt: 3 };
  const a = balanceLevels(cut, b, high).pads,
    ref = balanceLevels(full, b, high).pads;
  assert.ok(a.horn < -1, `horn turned down ${a.horn.toFixed(1)} dB`);
  for (const k of ["sub", "mid", "horn"] as const)
    assert.ok(
      Math.abs(a[k] - ref[k]) < 0.2,
      `${k}: ${a[k].toFixed(2)} against ${ref[k].toFixed(2)}`,
    );
});

test("coverage: a piston's directivity factor is a baffled piston's with no sound behind the box, and 1 at low ka with all of it", () => {
  // J1 by its power series
  const j1 = (x: number) => {
    let t = x / 2,
      s = t;
    for (let m = 1; m < 40; m++) {
      t *= -((x / 2) ** 2) / (m * (m + 1));
      s += t;
    }
    return s;
  };
  // Kinsler: Q = (ka)² / (1 − J1(2ka) / ka) for a piston in an infinite baffle
  for (const ka of [0.5, 1, 2, 4]) {
    const ref = ka ** 2 / (1 - j1(2 * ka) / ka);
    assert.ok(
      Math.abs(pistonQ(ka, 0) / ref - 1) < 0.01,
      `ka ${ka}: ${pistonQ(ka, 0)} against ${ref}`,
    );
  }
  assert.ok(Math.abs(pistonQ(0.01, 1) - 1) < 1e-3);
});

/** The sub's and mid's outputs at one frequency, for `s` and `lv`, outdoors. */
const outsAt = (s: CoverageStack, lv: CoverageLevels, f: number) =>
  coverageSlots(coverageScene(s, layout()), lv, [f], true)[0].out;
const angle = (v: { re: number; im: number } | undefined) => (v ? Math.atan2(v.im, v.re) : NaN);
const wrapped = (a: number) => a - 2 * Math.PI * Math.round(a / (2 * Math.PI));

test("coverage: a band's own phase and the sub's delay turn its output, and nothing else", () => {
  const base = levels(110),
    f = 60;
  const own: CoverageLevels = {
    ...base,
    sub: base.sub && base.sub.map((o) => ({ ...o, phase: 0.5 })),
  };
  const a = outsAt(stack, base, f),
    b = outsAt(stack, own, f),
    c = outsAt({ ...stack, subDelayMs: 2 }, base, f);
  assert.ok(Math.abs(wrapped(angle(b.sub) - angle(a.sub)) - 0.5) < 1e-9, "own phase");
  assert.ok(
    Math.abs(wrapped(angle(c.sub) - angle(a.sub)) + 2 * Math.PI * f * 0.002) < 1e-9,
    "delay",
  );
  for (const v of [b, c]) {
    assert.ok(
      Math.abs(
        Math.hypot(v.sub?.re ?? 0, v.sub?.im ?? 0) / Math.hypot(a.sub?.re ?? 0, a.sub?.im ?? 0) - 1,
      ) < 1e-12,
    );
    assert.deepStrictEqual(v.mid, a.mid);
  }
});

test("coverage: the auto sub delay puts a sub with its own phase back in phase with the mid at the crossover", () => {
  const base = levels(110);
  // the sub through a subsonic highpass (and a box with no phase), so it leads the mid at the crossover
  const lv: CoverageLevels = {
    ...base,
    sub:
      base.sub &&
      withOwnPhase(
        base.sub,
        base.sub.map((o) => ({ f: o.f, rawPhase: 0 })),
        (f) => highpassPhase(f, 40, "BW24"),
      ),
  };
  const ms = autoSubDelayMs(stack, lv);
  assert.ok(ms != null && ms > 0, `${ms} ms`);
  const sum = (d: number) => {
    const { sub, mid } = outsAt({ ...stack, subDelayMs: d }, lv, stack.xoLo);
    assert.ok(sub && mid);
    return (
      Math.hypot(sub.re + mid.re, sub.im + mid.im) /
      (Math.hypot(sub.re, sub.im) + Math.hypot(mid.re, mid.im))
    );
  };
  assert.ok(sum(ms) > 0.99999, `auto: ${sum(ms)}`);
  assert.ok(sum(ms) >= sum(0), `none: ${sum(0)}`);
  // nothing to match with the mid silent
  assert.equal(autoSubDelayMs(stack, { ...lv, mid: [] }), null);
});

test("coverage: a map of the subs alone doesn't change with their delay, in the stacks or in the middle", () => {
  const lv: CoverageLevels = { ...levels(110), mid: [], horn: [] };
  for (const subs of ["stacks", "center"] as const) {
    const l = layout({ subs, room: { ...layout().room, outdoors: false } });
    const grid = (ms: number) => {
      const scene = coverageScene({ ...stack, subDelayMs: ms }, l);
      const { freqs } = coverageFrequencies("sub", 0);
      return coverageGrid(scene, coverageSlots(scene, lv, freqs, false), l.room, l.earFt, 12).db;
    };
    const a = grid(0),
      b = grid(3.7);
    for (let i = 0; i < a.length; i++)
      assert.ok(Math.abs(a[i] - b[i]) < 1e-3, `${subs}: cell ${i}`);
  }
});

/** The planner's f18fh500 sub and bc12ndl76 mid in a stack, their curves with their boxes' phase. */
function plannerStack(
  xoLo: number,
  hpf: number,
  hpType: HighpassType,
  orderLo: CoverageStack["orderLo"] = 4,
) {
  const mid = MID_OPTIONS.find((o) => o.id === "bc12ndl76"),
    sub = SUB_OPTIONS.find((o) => o.id === "f18fh500");
  assert.ok(mid?.ts && sub?.ts);
  const midDims = { w: 15, h: 15, d: 15 };
  const s = subSystem(sub, mid, {
    subBox: { w: 24, h: 30, d: 26 },
    midDims,
    wall: 0.75,
    inset: 0.75,
    portStyle: "round2",
    cVent: { slotH: 3, nt: 2, dia: 4, throat: 2, len: 12 },
    hpf,
    hpType,
    ampW: 800,
    portMax: 20,
    layout: "stack",
    xoLo,
    phase: true,
  });
  const m = midSystem(mid, {
    midDims,
    wall: 0.75,
    inset: 0.75,
    xoLo,
    xoHi: 900,
    xoLoOrder: orderLo,
    xoHiOrder: 4,
    mAmpW: 400,
    phase: true,
  });
  assert.ok(s.mdl && m.mdl && m.max);
  const planner: CoverageStack = {
    ...stack,
    sub: { zIn: 15, Sd: sub.ts.Sd },
    mid: { zIn: 40, Sd: mid.ts.Sd },
    xoLo,
    orderLo,
    footprint: { w: 24, d: 26 },
    midW: midDims.w,
  };
  const lv = balanceLevels(
    {
      sub: withOwnPhase(
        subMusicThroughLowpass(s.mdl, s.lim, s.AMP_V, xoLo, orderLo),
        phasedCurve(s.mdl.curve),
        (f) => highpassPhase(f, hpf, hpType),
      ),
      mid: withOwnPhase(m.max, phasedCurve(m.mdl.curve)),
      horn: [],
    },
    { xoLo, xoHi: 900, tilt: 6, hfTilt: 3 },
    planner,
  ).levels;
  return { planner, lv };
}

/** How far the sub and mid sum under in phase at the crossover, dB. */
function crossoverLoss(planner: CoverageStack, lv: CoverageLevels, subDelayMs: number) {
  const { sub: a, mid: b } = outsAt({ ...planner, subDelayMs }, lv, planner.xoLo);
  assert.ok(a && b);
  const sum = Math.hypot(a.re + b.re, a.im + b.im);
  return 20 * Math.log10(sum / (Math.hypot(a.re, a.im) + Math.hypot(b.re, b.im)));
}

test("coverage: the planner's sub and mid with their boxes' phase lose level at the crossover, and the auto delay wins it back", () => {
  const { planner, lv } = plannerStack(80, 30, "BW24");
  const ms = autoSubDelayMs(planner, lv);
  // a small delay on the sub: it leads the mid at the crossover, though its group delay is the longer
  assert.ok(ms != null && ms > 0 && ms < 5, `${ms} ms`);
  assert.ok(crossoverLoss(planner, lv, 0) < -0.2, "no delay");
  assert.ok(crossoverLoss(planner, lv, ms) > -0.01, "auto");
});

test("coverage: the auto sub delay follows the design smoothly, never a period off", () => {
  for (const xoLo of [60, 80, 120])
    for (const hpType of ["BW24", "LR24"] as const) {
      let last: number | null = null;
      for (let hpf = 20; hpf <= 40; hpf += 2.5) {
        const { planner, lv } = plannerStack(xoLo, hpf, hpType);
        const ms = autoSubDelayMs(planner, lv);
        const at = `${xoLo} Hz, ${hpType} at ${hpf} Hz`;
        assert.ok(ms != null && Math.abs(ms) < 6, `${at}: ${ms} ms`);
        assert.ok(crossoverLoss(planner, lv, ms) > -0.01, `${at}: in phase`);
        if (last != null) assert.ok(Math.abs(ms - last) < 1, `${at}: ${last} to ${ms} ms`);
        last = ms;
      }
    }
});

test("coverage: an LR48 low crossover steepens the planner's skirts an octave either side by 24 dB/oct, and leaves the crossover", () => {
  // xoLo at the kick band's foot, so an octave above it is the band's top, where only the mid should play
  const xoLo = 80;
  const lr24 = plannerStack(xoLo, 30, "BW24", 4),
    lr48 = plannerStack(xoLo, 30, "BW24", 8);
  const db = (v: Complex | undefined) => (v ? 20 * Math.log10(Math.hypot(v.re, v.im)) : -Infinity);
  const band = (p: typeof lr24, b: "sub" | "mid", f: number) => db(outsAt(p.planner, p.lv, f)[b]);
  // Linkwitz-Riley: |H| = 1 / (1 + 2^n) an octave from fc, so LR48 is 20 log10(17 / 257) ≈ −23.6 dB under LR24
  const extra = 20 * Math.log10(17 / 257);
  const above = band(lr48, "sub", 2 * xoLo) - band(lr24, "sub", 2 * xoLo),
    below = band(lr48, "mid", xoLo / 2) - band(lr24, "mid", xoLo / 2);
  assert.ok(Math.abs(above - extra) < 1, `sub an octave above xoLo: ${above.toFixed(2)} dB`);
  assert.ok(Math.abs(below - extra) < 1, `mid an octave below xoLo: ${below.toFixed(2)} dB`);
  // the sub's skirt sits that much further under the mid at the kick band's top
  const gap = (p: typeof lr24) => band(p, "sub", 2 * xoLo) - band(p, "mid", 2 * xoLo);
  assert.ok(
    gap(lr48) - gap(lr24) < extra + 1,
    `${gap(lr24).toFixed(1)} to ${gap(lr48).toFixed(1)} dB`,
  );
  // at the crossover both orders are 6 dB down: each band's level is unchanged
  for (const b of ["sub", "mid"] as const) {
    const d = band(lr48, b, xoLo) - band(lr24, b, xoLo);
    assert.ok(Math.abs(d) < 0.1, `${b} at xoLo: ${d.toFixed(3)} dB`);
  }
});

test("coverage: a box model run without its phase can't be given to the map", () => {
  const sub = SUB_OPTIONS.find((o) => o.id === "f18fh500");
  assert.ok(sub?.ts);
  const plain = subSystem(sub, MID_OPTIONS[0], {
    subBox: { w: 24, h: 30, d: 26 },
    midDims: { w: 15, h: 15, d: 15 },
    wall: 0.75,
    inset: 0.75,
    portStyle: "round2",
    cVent: { slotH: 3, nt: 2, dia: 4, throat: 2, len: 12 },
    hpf: 30,
    hpType: "BW24",
    ampW: 800,
    portMax: 20,
    layout: "stack",
  });
  assert.ok(plain.mdl);
  const curve = plain.mdl.curve;
  assert.throws(() => phasedCurve(curve), /without its phase/);
});

test("coverage: the audience average is the mean level over the floor the stats count", () => {
  const room = { widthFt: 20, lengthFt: 20 };
  // 4 × 4 cells, 5 ft each: 100 dB everywhere but 130 dB in the cell by the box, which the stats leave out
  const db = new Float32Array(16).fill(100);
  db[0] = 130;
  db[15] = 88;
  const grid = { cols: 4, rows: 4, db };
  const box = { x: -7.5, y: 2.5 };
  const avg = audienceAverage(grid, room, [box]);
  assert.ok(avg != null && Math.abs(avg - (100 * 14 + 88) / 15) < 1e-6, String(avg));
  // consistent with the stats: everything counted is at or above the average − 12
  assert.equal(coverageStats(grid, room, [box], (100 * 14 + 88) / 15).within6, 14 / 15);
  assert.equal(
    audienceAverage({ cols: 1, rows: 1, db: new Float32Array([90]) }, room, [{ x: 0, y: 10 }]),
    null,
  );
});

test("coverage: a stack's 1 m spot is 1 m out from its front along its aim, inside the room", () => {
  const room = { widthFt: 30, lengthFt: 40 };
  const p = oneMetreSpot({ x: -8, y: 3, aim: 0 }, stack.footprint, room);
  assert.ok(Math.abs(p.x + 8) < 1e-9 && Math.abs(p.y - (3 + 1 + ONE_METRE_FT)) < 1e-9);
  const t = oneMetreSpot({ x: -8, y: 3, aim: 30 }, stack.footprint, room);
  assert.ok(Math.abs(Math.hypot(t.x + 8, t.y - 3) - (1 + ONE_METRE_FT)) < 1e-9 && t.x > -8);
  const edge = oneMetreSpot({ x: 14, y: 1, aim: 60 }, stack.footprint, room);
  assert.ok(edge.x <= 15 && edge.x > 14);
});

test("coverage: layouts saved with the old level mode still load", () => {
  const def = fromStored({});
  assert.equal(def.levelRef, COVERAGE_LEVEL_REF.audience);
  assert.equal(def.targetDb, LISTENER_TARGET_DB);
  const atListener = fromStored({ levelMode: LEGACY_LEVEL_MODE.listener });
  assert.equal(atListener.levelRef, COVERAGE_LEVEL_REF.listener);
  assert.equal(atListener.targetDb, LISTENER_TARGET_DB);
  const atLimit = fromStored({ levelMode: LEGACY_LEVEL_MODE.limit });
  assert.equal(atLimit.levelRef, COVERAGE_LEVEL_REF.listener);
  assert.equal(atLimit.targetDb, COVERAGE_TARGET_DB[1]);
  assert.ok(!("levelMode" in atLimit));
  // a newer field wins over the old one
  assert.equal(
    fromStored({ levelMode: LEGACY_LEVEL_MODE.limit, levelRef: COVERAGE_LEVEL_REF.stacks })
      .levelRef,
    COVERAGE_LEVEL_REF.stacks,
  );
});

test("coverage layout: a box can go right against a wall, its edge and no further", () => {
  const room = { widthFt: 30, lengthFt: 40 };
  const footprint = { w: 24, d: 30 }; // 2 ft wide, 2.5 ft deep
  // facing down the room, pushed past the front-left corner: its edges land on both walls
  assert.deepEqual(stackInRoom({ x: -100, y: -100, aim: 0 }, room, footprint), {
    x: -15 + 1,
    y: 1.25,
    aim: 0,
  });
  // and the back-right corner
  assert.deepEqual(stackInRoom({ x: 100, y: 100, aim: 0 }, room, footprint), {
    x: 15 - 1,
    y: 40 - 1.25,
    aim: 0,
  });
  // turned, it reaches by its rotated extent, the same either way
  const r = boxReach(footprint, 30);
  assert.deepEqual(boxReach(footprint, -30), r);
  assert.ok(r.x > 1 && r.x < Math.hypot(1, 1.25));
  const u = stackInRoom({ x: -100, y: 5, aim: 30 }, room, footprint);
  assert.ok(Math.abs(u.x - (-15 + r.x)) < 1e-9);
  // a point well inside is left alone (snapped to a quarter foot)
  assert.deepEqual(stackInRoom({ x: 3.1, y: 7.9, aim: 0 }, room, footprint), {
    x: 3,
    y: 8,
    aim: 0,
  });
});

test("coverage layout: fitted to a smaller room, the boxes stand against its walls", () => {
  const footprint = { w: 24, d: 30 };
  const l = fitted(
    {
      ...DEFAULT_COVERAGE_LAYOUT,
      room: { ...DEFAULT_COVERAGE_LAYOUT.room, widthFt: 16 },
      stacks: [
        { x: -20, y: 0, aim: 0 },
        { x: 20, y: 0, aim: 0 },
      ],
      subs: "center",
      cluster: { x: 20, y: 0 },
      listener: { x: 20, y: 0 },
    },
    footprint,
  );
  // mirrored stacks each with an edge on its side wall and its back on the front wall
  assert.deepEqual(l.stacks, [
    { x: -7, y: 1.25, aim: 0 },
    { x: 7, y: 1.25, aim: 0 },
  ]);
  // the center pair is two boxes side by side about the cluster point: the outer one's edge on the wall
  assert.deepEqual(l.cluster, { x: 6, y: 1.25 });
  // the listener keeps its half-foot margin
  assert.deepEqual(l.listener, { x: 7.5, y: 0.5 });
});
