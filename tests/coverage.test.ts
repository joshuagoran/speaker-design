import { test } from "vite-plus/test";
import assert from "node:assert";
import {
  balanceLevels,
  bandTarget,
  contourSegments,
  coverageFrequencies,
  coverageGrid,
  coverageResponse,
  coverageScene,
  coverageSlots,
  coverageStats,
  curveLevelAt,
  levelAtPoint,
} from "../src/lib/pa/coverage";
import { paResponseAt, paStackSources } from "../src/lib/pa/dispersion";
import { logSpacedFrequencies } from "../src/lib/hifi/hifi";
import { METERS_PER_FOOT as FT } from "../src/constants/units";
import type { CoverageLayout, CoverageLevels, CoverageStack } from "../src/types";

const stack: CoverageStack = {
  sub: { zIn: 12, Sd: 1200 },
  mid: { zIn: 36, Sd: 530 },
  horn: { zIn: 50, covH: 90, covV: 40, wIn: 14, hIn: 8 },
  xoLo: 120,
  xoHi: 900,
  order: 4,
  footprint: { w: 24, d: 24 },
};

/** Every band at `db` at 1 m, through its crossover's magnitude, as the planner's curves are. */
const levels = (db: number, s: CoverageStack = stack): CoverageLevels => {
  const freqs = logSpacedFrequencies(12, 20000, 400);
  const curve = (band: "sub" | "mid" | "horn") => {
    const o = paStackSources(s).find((src) => src.band === band);
    if (!o) throw new Error(band); // the test stack has all three
    return freqs.map((f) => {
      const h = o.filt(f);
      return { f, spl: db + 20 * Math.log10(Math.max(1e-9, Math.hypot(h.re, h.im))) };
    });
  };
  return { sub: curve("sub"), mid: curve("mid"), horn: curve("horn") };
};

const layout = (o: Partial<CoverageLayout> = {}): CoverageLayout => ({
  room: {
    widthFt: 40,
    lengthFt: 50,
    walls: { front: false, back: false, left: false, right: false },
    absorption: 0,
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
  levelMode: "limit",
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
    coverageSlots(stack, levels(110), freqs, coherent),
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
  const mid = (f: number) => {
    const v = coverageSlots(high, cut, [f], true)[0].out.mid;
    return v ? 20 * Math.log10(Math.hypot(v.re, v.im)) : -Infinity;
  };
  const end = cut.mid[cut.mid.length - 1].f;
  assert.ok(Math.abs(mid(end * 1.01) - mid(end)) < 0.5, `${mid(end)} to ${mid(end * 1.01)} dB`);
  // and it matches the full curve an octave on
  const ref = coverageSlots(high, full, [4000], true)[0].out.mid;
  assert.ok(ref && Math.abs(mid(4000) - 20 * Math.log10(Math.hypot(ref.re, ref.im))) < 0.1);
  assert.equal(coverageSlots(high, cut, [4000], true)[0].out.horn, undefined);
});

test("coverage: a box's drivers arrive in phase on its axis at the alignment point, as the dispersion model has them", () => {
  // a tall stack, the horn well above the mid, so a wrong alignment shows plainly at the crossover
  const tall: CoverageStack = {
    ...stack,
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
      coverageSlots(tall, levels(110, tall), [f], true),
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

test("coverage: a solid wall right behind the stacks lifts the bass, and absorption takes some of it back", () => {
  const open = layout({
    stacks: [
      { x: -8, y: 1, aim: 0 },
      { x: 8, y: 1, aim: 0 },
    ],
  });
  const walled = (absorption: number) =>
    layout({
      stacks: open.stacks,
      room: {
        ...open.room,
        outdoors: false,
        absorption,
        walls: { ...open.room.walls, front: true },
      },
    });
  const a = at(open, "sub", 50, 0, 25),
    b = at(walled(0), "sub", 50, 0, 25),
    c = at(walled(0.6), "sub", 50, 0, 25);
  assert.ok(b - a > 4, `wall adds ${(b - a).toFixed(1)} dB`);
  assert.ok(
    c < b && c > a,
    `absorbent wall ${c.toFixed(1)} dB between ${a.toFixed(1)} and ${b.toFixed(1)}`,
  );
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
    coverageGrid(scene, coverageSlots(stack, levels(db), freqs, false), l.room, l.earFt, 12);
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
    { f: 10, spl: db },
    { f: 20000, spl: db },
  ];
  const b = { xoLo: 120, xoHi: 900, tilt: 6, hfTilt: 3 };
  // a loud horn and mid: the sub sets the level, mid 6 under it, horn 3 under the mid
  const loud = balanceLevels({ sub: flat(120), mid: flat(124), horn: flat(130) }, b);
  assert.deepEqual(loud.pads, { sub: 0, mid: -10, horn: -19 });
  // a weak mid: it sets the level and the sub comes down to 6 above it
  const weak = balanceLevels({ sub: flat(120), mid: flat(110), horn: flat(130) }, b);
  assert.deepEqual(weak.pads, { sub: -4, mid: 0, horn: -23 });
  assert.equal(weak.levels.sub?.[0].spl, 116);
  // a weak horn sets the level for both others
  const hornWeak = balanceLevels({ sub: flat(120), mid: flat(114), horn: flat(105) }, b);
  assert.deepEqual(hornWeak.pads, { sub: -6, mid: -6, horn: 0 });
  // no sub: only the mid and horn balance
  assert.deepEqual(balanceLevels({ sub: null, mid: flat(114), horn: flat(130) }, b).pads, {
    sub: 0,
    mid: 0,
    horn: -19,
  });
  assert.equal(bandTarget(105, "sub", 0, b), 105);
  assert.equal(bandTarget(105, "mid", 0, b), 99);
  assert.equal(bandTarget(105, "high", 0, b), 96);
  assert.equal(bandTarget(105, "one", 50, b), 105);
});
