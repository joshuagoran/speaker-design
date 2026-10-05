// The exact PA search ("Fully optimize"): the best design for the goals and locks over a stated grid, guaranteed, with
// the quick search's card rules (lib/pa/optimize hands over its setup and card selection; see `PaExactHook`).
//
// The grid (PA_EXACT_GRID, paExactGridText): every priced sub driver of every size, both plywoods, all 7 vent styles
// and every vent size the quick search knows; net volumes on a 2 % ladder, each in every box with whole-inch width and
// height whose depth holds it exactly with the duct; tunings every 2 Hz with the duct length solved for each; the quick
// search's highpass choices; every mid box, crossover and horn pair; amps as the quick search sets them.
//
// How it stays exact and fast:
//   1. The sub's response depends on the net volume and the tuning only (lib/pa/exactSub), so the planner's circuit
//      runs once per sub, rung, tuning and highpass (the model step, split across workers by sub driver) and every box
//      shape, plywood and vent shares it; a vent adds its area (the port limit), a shape its weight and fit.
//   2. Boxes with the same volume, tuning and vent area are the same design apart from weight: only the lightest that
//      fits is kept, per vent area (a slot's area follows the box width, a side duct's its height).
//   3. The mid and horn side is tabled in full per plywood and lower crossover and cut to the options no other option
//      beats on price, weight, warnings, changes and level (the only ways they reach a design's ranking and checks).
//   4. Each card is a search in its goal's order with bounds that can't drop a design (the curve's F3, its output with
//      the port ignored, the lightest box that holds the volume, the cheapest mid and horn); the card selection runs on
//      a pool that grows until no design on the grid beats one of its picks, and every pick is checked with the
//      planner's own evaluateDesign (a design the fast path got wrong is set aside and the cards are picked again).
import { throttledProgress } from "../optimizer/progress";
import {
  ALT_OUTPUT_DB,
  AMP_WATTS_STEPS,
  SUB_BAND_HZ,
  SAME_VOLUME,
  SUB_BOX_RANGE,
  VENT_STYLES,
  XO_HI_OPTIONS,
  XO_LO_OPTIONS,
  WALL_OPTIONS,
  highpassOptions,
  designProblems,
  evaluateDesign,
  optimizePaStack,
  paSearchAmps,
  paSearchDesign,
  rangeOf,
  ventSizesFor,
} from "./optimize";
import {
  boxInternalLiters,
  hornResponse,
  isRoundPort,
  linkwitzRileyLowpass,
  keeleFrequency,
  midWeightLb,
  pistonBeamWidthDeg,
  subGeometry,
  subWeightLb,
} from "./calc";
import {
  ductFit,
  driverClearance,
  hornChips,
  subDriverClearanceNeededIn,
  KEEP_UP_SLACK_DB,
} from "./chips";
import {
  ductLengthFor,
  effectiveLengthFor,
  gridFrequency,
  gridIndexNear,
  highpassTable,
  musicAt,
  outputAt,
  solveShape,
  subCircuit,
  subLimitOf,
  ventShape,
  ventedCurves,
  subNetLiters,
  sealedQtc,
  sealedMid,
  midGridIndexNear,
  type CurveSummary,
  type SubCircuit,
  type SubLimit,
  type VentShape,
} from "./exactSub";
import { MID_OPTIONS, SUB_OPTIONS } from "../data";
import { byId } from "../tables";
import { keepGap } from "../optimizer/shortfall";
import { ampForGain, onSlider } from "../optimizer/ampSteps";
import { LIMIT_CHIP_IDS } from "../../constants/chipIds";
import type {
  Dims3,
  HornHf,
  MidDriver,
  OptimizerProgress,
  OptimizerProgressCallback,
  PaChoose,
  PaChosen,
  PaDesignConfig,
  PaExactHook,
  PaExactJob,
  PaExactJobResult,
  PaExactGrid,
  PaExactScored,
  PaGoal,
  PaHornEntry,
  PaMetric,
  PaOptimizerInput,
  PaOptimizerResult,
  PaPoolEntry,
  PaProblemLimits,
  PaResolvedLocks,
  PaScore,
  PaSearchContext,
  PortStyle,
  SubDriver,
  VentSpec,
} from "../../types";

// the most vent sizes any style has (a cache key's stride)
const MAX_VENT_SIZES = Math.max(...VENT_STYLES.map((st) => ventSizesFor(st).length));

/** The grid's steps (see `PaExactGrid`). */
export const PA_EXACT_GRID: PaExactGrid = {
  volumeStep: 0.02,
  minNetL: 20,
  fb: { from: 20, to: 50, step: 2 },
  minDuctIn: 2,
};
// the most entries a cache that grows with the boxes looked at keeps before it starts again
const CACHE_MAX = 4096;
// the most numbers the cached box pairs hold (8 bytes each: 192 MB a cache at most; a lower cap measured no lower peak
// memory, as the rest of the search dominates, and up to twice the time)
const PAIR_FLOATS_MAX = 24_000_000;
/**
 * A cache of packed box pairs held to a size: a hit moves to the back, and once the pairs it holds pass the budget the
 * least recently used go (they rebuild the same).
 */
class PairCache<V extends { size: number }> {
  private m = new Map<number, V>();
  private floats = 0;
  get(k: number) {
    const v = this.m.get(k);
    if (v) {
      this.m.delete(k);
      this.m.set(k, v);
    }
    return v;
  }
  set(k: number, v: V) {
    this.m.set(k, v);
    this.floats += v.size;
    for (const [old, o] of this.m) {
      if (this.floats <= PAIR_FLOATS_MAX || old === k) break;
      this.m.delete(old);
      this.floats -= o.size;
    }
  }
  get count() {
    return this.m.size;
  }
  get held() {
    return this.floats;
  }
}
// the tower's mid box height, in (evaluateDesign's)
const TOWER_MID_H = 15.5;
const GOALS: readonly PaGoal[] = ["cheaper", "lighter", "lower", "louder"];
const perGoal = <T>(f: (g: PaGoal) => T): Record<PaGoal, T> => ({
  cheaper: f("cheaper"),
  lighter: f("lighter"),
  lower: f("lower"),
  louder: f("louder"),
});
// how much better a design must rank than a pick for the pool to take it (the fast path matches the planner to ~1e-12)
const TOL = 1e-9;

// ---- the grid ----

/** What every part of the search derives from the input: your design, the amps and locks, and the grid's lists. */
interface ExactSpace {
  grid: PaExactGrid;
  cur: PaDesignConfig;
  locks: PaResolvedLocks;
  amps: Pick<PaDesignConfig, "ampW" | "mAmpW" | "hfAmpW">;
  volts: number;
  portMax: number;
  subs: SubDriver[];
  walls: number[];
  styles: readonly PortStyle[];
  fbs: number[];
  /** per tuning, the highpasses tried */
  hps: number[][];
  rungs: number[];
  xoLos: number[];
  /** the grid points nearest each lower crossover */
  xoIdx: number[];
  /** the box's ranges, the side solved for the volume (null: the box is locked) and the whole-inch sides */
  sr: Record<keyof Dims3, [number, number]>;
  free: keyof Dims3 | null;
  fixed: [keyof Dims3, number[]][];
  /** the heaviest sub box on the grid: the near miss's 10 % over the limit */
  cap: number;
  /** the tower layout: its mid (your mid, in a box on the sub's footprint; none when the tables lack it) */
  tower: { mid: MidDriver | undefined } | null;
}
// whole inches from the bottom of a range, and its top (a half-inch "up to" value stays reachable), as the quick search
const inchSteps = ([lo, hi]: [number, number]) => {
  if (lo === hi) return [lo];
  const v = Array.from({ length: Math.floor(hi - lo) + 1 }, (_, i) => lo + i);
  if (v[v.length - 1] !== hi) v.push(hi);
  return v;
};
function exactSpace(input: PaOptimizerInput, grid: PaExactGrid): ExactSpace {
  const cur = paSearchDesign(input);
  const locks: PaResolvedLocks = { subDim: {}, midDim: {}, ...input.locks };
  const amps = paSearchAmps(cur, locks);
  const curSub = byId(SUB_OPTIONS, cur.sub);
  // every sub of every size the budget allows (a locked one only if the tables have it)
  const subs = locks.sub
    ? curSub
      ? [curSub]
      : []
    : SUB_OPTIONS.filter((o) => o.ts && o.price <= input.budget);
  const fbs: number[] = [];
  for (let f = grid.fb.from; f <= grid.fb.to; f += grid.fb.step) fbs.push(f);
  const hps = fbs.map((fb) =>
    locks.hpf ? [cur.hpf] : highpassOptions(fb).filter((h, i, a) => a.indexOf(h) === i),
  );
  const sr = {
    w: rangeOf(locks.subDim.w, cur.cDim.w, SUB_BOX_RANGE.w),
    h: rangeOf(locks.subDim.h, cur.cDim.h, SUB_BOX_RANGE.h),
    d: rangeOf(locks.subDim.d, cur.cDim.d, SUB_BOX_RANGE.d),
  };
  // depth holds the volume unless it is locked; then height, then width
  const free = (["d", "h", "w"] as const).find((k) => sr[k][0] !== sr[k][1]) ?? null;
  const fixed = (["w", "h", "d"] as const)
    .filter((k) => k !== free)
    .map((k): [keyof Dims3, number[]] => [k, inchSteps(sr[k])]);
  const walls = locks.wall ? [cur.wall] : WALL_OPTIONS;
  const top = boxInternalLiters(sr.w[1], sr.h[1], sr.d[1], Math.min(...walls), cur.inset);
  const rungs: number[] = [];
  if (free) for (let v = grid.minNetL; v <= top; v *= 1 + grid.volumeStep) rungs.push(v);
  const xoLos = locks.xoLo ? [cur.xoLo] : XO_LO_OPTIONS;
  return {
    grid,
    cur,
    locks,
    amps,
    volts: Math.sqrt(amps.ampW * 8),
    portMax: cur.portMax,
    subs,
    walls,
    styles: locks.vent ? [cur.portStyle] : VENT_STYLES,
    fbs,
    hps,
    rungs,
    xoLos,
    xoIdx: xoLos.map(gridIndexNear),
    sr,
    free,
    fixed,
    cap: Math.ceil(input.maxLb * 1.1),
    tower: cur.layout === "tower" ? { mid: byId(MID_OPTIONS, cur.mid) } : null,
  };
}

/** The grid in words, for the page's "guaranteed best over: …" (one line per part of the design). */
export function paExactGridText(input: PaOptimizerInput, grid = PA_EXACT_GRID): string[] {
  const s = exactSpace(input, grid);
  const n = (k: number, one: string, many = `${one}s`) => `${k} ${k === 1 ? one : many}`;
  const sizes = s.styles.reduce((k, st) => k + ventSizesFor(st).length, 0);
  const inches = ([lo, hi]: [number, number]) => (lo === hi ? `${lo}″` : `${lo}–${hi}″`);
  const free = s.free;
  const box = free
    ? [
        `net volume every ${grid.volumeStep * 100} % from ${grid.minNetL} L in every box of ${s.fixed
          .map(([k]) => `${DIM_WORDS[k]} ${inches(s.sr[k])}`)
          .join(" and ")} (whole inches), ${DIM_WORDS[free]} ${inches(s.sr[free])} cut to hold it`,
        "and your box as it is",
      ].join(", ")
    : "your box size";
  const xoHis = s.locks.xoHi ? [s.cur.xoHi] : XO_HI_OPTIONS;
  return [
    `${s.locks.sub ? "your sub driver" : `${n(s.subs.length, "sub driver")} of every size`}, ${n(s.walls.length, "plywood")}, ${n(s.styles.length, "vent style")} in ${n(sizes, "size")}`,
    box,
    `tuning every ${grid.fb.step} Hz from ${grid.fb.from} to ${grid.fb.to} Hz, the duct (${grid.minDuctIn}″ or longer) cut for it`,
    s.locks.hpf ? "your highpass" : "highpass at 0.85 × and 1 × the tuning",
    `crossovers at ${s.xoLos.join(", ")} Hz and ${xoHis.join(", ")} Hz`,
    s.tower
      ? "your mid in the tower's box, every horn pair"
      : "every mid and mid box the quick search tries, every horn pair",
  ];
}
const DIM_WORDS: Record<keyof Dims3, string> = { w: "width", h: "height", d: "depth" };

// the bare box for a volume: gross less the driver and the window braces only (no duct, no cleats), so any real box
// holding that net volume is at least this big; it is linear in the free side
function bareFree(
  s: ExactSpace,
  fixedDims: Dims3,
  t: number,
  disp: number,
  V: number,
): number | null {
  const free = s.free;
  if (!free) return null;
  const at = (x: number) => {
    const b = { ...fixedDims, [free]: x };
    const iw = b.w - 2 * t,
      inD = b.d - s.cur.inset - 0.75 - t;
    const gross = ((b.w - 2 * t) * (b.h - 2 * t) * inD * 16.387) / 1000;
    const braces = Math.max(0, 4 * (iw + inD) - 16) * t * (t === 0.5 ? 3 : 2);
    return gross - disp - (braces * 16.387) / 1000;
  };
  const [lo, hi] = s.sr[free];
  const a = at(lo),
    b = at(hi);
  if (b < V) return null; // the biggest box on the range can't hold it
  return a >= V ? lo : lo + ((V - a) * (hi - lo)) / (b - a);
}

/**
 * Box shapes on a rung, packed (`PAIR` numbers each; there are millions): the two whole-inch sides, a floor on the free
 * side and the weight there (a floor for any real box of that shape), lightest first.
 */
type Pairs = Float64Array;
const PAIR = 4;
const pairCount = (p: Pairs) => p.length / PAIR;
const pairLb = (p: Pairs, i: number) => p[i * PAIR + 3];
const pairX = (p: Pairs, i: number) => p[i * PAIR + 2];
const lightestOf = (p: Pairs) => (p.length ? pairLb(p, 0) : Infinity);
const pairDims = (s: ExactSpace, p: Pairs, i: number): Dims3 => {
  const [[ka], [kb]] = s.fixed;
  return { w: 0, h: 0, d: 0, [ka]: p[i * PAIR], [kb]: p[i * PAIR + 1] };
};
// packs shapes [a, b, x, lb], lightest first
const packPairs = (rows: number[]): Pairs => {
  const n = rows.length / PAIR;
  const order = Int32Array.from({ length: n }, (_, i) => i).sort(
    (i, j) => rows[i * PAIR + 3] - rows[j * PAIR + 3] || i - j,
  );
  const out = new Float64Array(rows.length);
  order.forEach((i, k) => out.set(rows.slice(i * PAIR, i * PAIR + PAIR), k * PAIR));
  return out;
};
// the tower's mid takes the sub's footprint: a box whose mid can't fit, or whose Qtc is under the checks' 0.5 at this
// smallest size, is under it in every real box of the shape (bigger, so a lower Qtc)
const towerMidFails = (s: ExactSpace, box: Dims3, t: number) => {
  if (!s.tower) return false;
  const m = s.tower.mid;
  const mb = { w: box.w, h: TOWER_MID_H, d: box.d };
  return !m || Math.min(mb.w, mb.h) < m.size + 1.2 || sealedQtc(m, mb, t, s.cur.inset) < 0.5 - 1e-9;
};
// per sub, plywood and rung: every whole-inch pair that can hold the volume under the weight cap, lightest first
function barePairs(s: ExactSpace, sub: SubDriver, t: number, V: number): Pairs {
  const free = s.free;
  if (!free) return new Float64Array(0);
  const need = subDriverClearanceNeededIn(sub.size);
  const [[ka, as], [kb, bs]] = s.fixed;
  const out: number[] = [];
  for (const a of as)
    for (const b of bs) {
      // the clearance only shrinks the baffle further (vents), so a fixed side under it never fits
      if (
        ((ka === "w" || ka === "h") && a < need - 0.01) ||
        ((kb === "w" || kb === "h") && b < need - 0.01)
      )
        continue;
      const dims = { w: 0, h: 0, d: 0, [ka]: a, [kb]: b };
      const x = bareFree(s, dims, t, sub.ts.disp, V);
      if (x === null) continue;
      const box = { ...dims, [free]: x };
      const lb = subWeightLb(box, t, sub.lb);
      if (lb > s.cap + 1e-9 || towerMidFails(s, box, t)) continue;
      out.push(a, b, x, lb);
    }
  return packPairs(out);
}

// ---- the model step (split across workers by sub driver) ----

/** The model step's count of work: a sub's rung and tuning (the share of progress the model step reports). */
const modelSteps = (s: ExactSpace, subs: number) => subs * s.rungs.length * s.fbs.length;

/** A curve row: rung, tuning index, highpass index, F3, band minimum, excursion share, air speed × area, crossover levels. */
const ROW_HEAD = 7;
/**
 * One share of the model step: for every `parts`-th sub driver, its curves at every rung some box under the weight cap
 * can hold, every tuning and every highpass.
 */
export function paExactScore(
  input: PaOptimizerInput,
  part = 0,
  parts = 1,
  onProgress?: OptimizerProgressCallback,
  grid = PA_EXACT_GRID,
): PaExactScored[] {
  const s = exactSpace(input, grid);
  const out: PaExactScored[] = [];
  const mine = s.subs.map((_, i) => i).filter((i) => i % parts === part);
  const report = throttledProgress(onProgress);
  let done = 0;
  const total = modelSteps(s, mine.length);
  for (const si of mine) {
    const sub = s.subs[si];
    const c = subCircuit(sub.ts, s.volts, SUB_BAND_HZ);
    const rows: number[] = [];
    for (let ri = 0; ri < s.rungs.length; ri++) {
      const V = s.rungs[ri];
      const holds = s.walls.some((t) => pairCount(barePairs(s, sub, t, V)) > 0);
      for (let fi = 0; fi < s.fbs.length; fi++, done++) {
        if (!holds) continue;
        const tables = s.hps[fi].map((h) => highpassTable(h, s.cur.hpType));
        ventedCurves(c, V, s.fbs[fi], tables, s.xoIdx).forEach((cs, hi) =>
          rows.push(ri, fi, hi, cs.f3, cs.bandMin, cs.xmaxPct, cs.velArea, ...cs.xoSpl),
        );
      }
      report(done, total);
    }
    out.push({ sub: si, rows: Float64Array.from(rows) });
  }
  report(done, total, true);
  return out;
}

// ---- the search ----

/** A sub box on the grid with its vent, highpass and model: everything a design takes from the sub side. */
interface SubDesign {
  /** its amp before any mid turns it down: the searched power, or under the port's limit when the port set it */
  ampW: number;
  portLimited: boolean;
  si: number;
  t: number;
  style: PortStyle;
  vent: VentSpec;
  box: Dims3;
  hpf: number;
  lb: number;
  area: number;
  cs: CurveSummary;
  lim: SubLimit;
  out0: number;
  /** per lower crossover, what the mid must reach there: the sub at its music limit through the lowpass, less the tilt */
  need: number[];
  chS: number;
  vol: number;
  key: string;
}
/** A mid box at a crossover pair with a horn pair: everything a design takes from above the sub. */
interface Upper {
  mid: MidDriver;
  /** the box the planner evaluates, and the one the card's config carries (they differ in the tower layout) */
  bx: Dims3;
  mDim: Dims3;
  xoHi: number;
  hp: PaHornEntry;
  mAmpW: number;
  midP: number;
  cdP: number;
  midLb: number;
  w: number;
  chU: number;
  /** the mid's level at the lower crossover once the horn keeps up, dB */
  lo: number;
}
/** The uppers for one plywood and lower crossover: the options nothing else beats, and what the bounds and scans read off them. */
interface UpperSet {
  list: Upper[];
  /** per goal, the scan order: by the upper's part of the objective (Louder: the loudest mid first) */
  order: Record<PaGoal, Int32Array>;
  /** per goal, each upper's part of the objective */
  keys: Record<PaGoal, Float64Array>;
  /** the levels at the crossover, loudest first, and per goal the least upper part among that many of the loudest */
  loDesc: Float64Array;
  stair: Record<PaGoal, Float64Array>;
  minPrice: number;
  minLb: number;
}
/** A whole design the search found: the sub side, the lower crossover's index, the upper and the sub's amp. */
interface Found {
  sd: SubDesign;
  xi: number;
  u: Upper;
  /** the upper's place in its set (the same whenever the set is built) */
  ui: number;
  ampW: number;
  m: PaMetric & { w: number };
  rank: [number, number];
  /** the query that found it, whose test the planner's own numbers must pass too */
  q: Query;
}
/** What a card needs: thresholds every design it can be must meet (for the bounds), and the exact test. */
interface Need {
  outMin: number;
  f3Max: number;
  priceMax: number;
  heaviestMax: number;
  chMax: number;
}
interface Query {
  /** the goal whose own objective ranks it, so the bounds and the scan can split that into sub and upper parts (null: `rank` is something else, and every upper is scanned) */
  axis: PaGoal | null;
  rank: (m: PaMetric) => [number, number];
  need: Need;
  limits: PaProblemLimits | null;
  ok: (m: PaMetric) => boolean;
  /** the cards a design has to differ from (selectCards' `differs`) */
  avoid: readonly PaPoolEntry[];
}
const ANY: Need = {
  outMin: -Infinity,
  f3Max: Infinity,
  priceMax: Infinity,
  heaviestMax: Infinity,
  chMax: Infinity,
};
const both = (a: Need, b: Partial<Need>): Need => ({
  outMin: Math.max(a.outMin, b.outMin ?? -Infinity),
  f3Max: Math.min(a.f3Max, b.f3Max ?? Infinity),
  priceMax: Math.min(a.priceMax, b.priceMax ?? Infinity),
  heaviestMax: Math.min(a.heaviestMax, b.heaviestMax ?? Infinity),
  chMax: Math.min(a.chMax, b.chMax ?? Infinity),
});
// bounds are compared with a little room, so rounding never prunes a design that passes
const EPS = 1e-6;
const fails = (n: Need, m: PaMetric) =>
  m.out < n.outMin - EPS ||
  m.f3 > n.f3Max + EPS ||
  m.price > n.priceMax + EPS ||
  m.heaviest > n.heaviestMax + EPS ||
  m.ch > n.chMax;
const before = (a: readonly [number, number], b: readonly [number, number]) =>
  a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);
// The axis each goal compares on, and whether more of it is better.
const AXIS: Record<PaGoal, { key: keyof PaScore; up: boolean }> = {
  cheaper: { key: "price", up: false },
  lighter: { key: "heaviest", up: false },
  lower: { key: "f3", up: false },
  louder: { key: "out", up: true },
};
/**
 * What the card rules' own `beats` asks of a design against `y` on a goal's axis, as a threshold for the bounds: found
 * by bisection on that axis alone, at the last value that doesn't beat (so a bound never prunes one that does).
 */
function beatsNeed(beats: PaSearchContext["beats"], g: PaGoal, y: PaScore): Partial<Need> {
  const { key, up } = AXIS[g];
  const at = (d: number) => beats[g]({ ...y, [key]: y[key] + d }, y);
  let a = up ? 1e3 : -1e3, // beats
    b = -a; // doesn't
  if (!at(a)) return up ? { outMin: Infinity } : { priceMax: -Infinity };
  if (at(b)) return {};
  for (let i = 0; i < 80; i++) {
    const m = (a + b) / 2;
    if (at(m)) a = m;
    else b = m;
  }
  const v = y[key] + b;
  return key === "price"
    ? { priceMax: v }
    : key === "heaviest"
      ? { heaviestMax: v }
      : key === "f3"
        ? { f3Max: v }
        : { outMin: v };
}

/** A unit of the search: one curve (a sub, rung, tuning and highpass), or one of your boxes as it is. */
interface Unit {
  si: number;
  cs: CurveSummary;
  ri: number;
  fi: number;
  hi: number;
  /** your box as it is, on one plywood (null for a rung's curve) */
  own: SubDesign | null;
}

/**
 * The exact search's hook: built from the model step's shares, it searches when the card selection first runs (with the
 * quick search's context) and reports progress.
 */
function exactHook(
  input: PaOptimizerInput,
  scored: readonly (readonly PaExactScored[])[],
  onProgress: OptimizerProgressCallback | undefined,
  grid: PaExactGrid,
): PaExactHook & { stats: () => { designs: number; subDesigns: number } } {
  const s = exactSpace(input, grid);
  const stride = ROW_HEAD + s.xoIdx.length;
  // the shares' curves, per sub, keyed by rung, tuning and highpass
  const curves = s.subs.map(() => new Map<number, CurveSummary>());
  const ckey = (ri: number, fi: number, hi: number) => (ri * s.fbs.length + fi) * 4 + hi;
  for (const share of scored)
    for (const { sub, rows } of share)
      for (let r = 0; r + stride <= rows.length; r += stride)
        curves[sub].set(ckey(rows[r], rows[r + 1], rows[r + 2]), {
          f3: rows[r + 3],
          bandMin: rows[r + 4],
          xmaxPct: rows[r + 5],
          velArea: rows[r + 6],
          xoSpl: Array.from(rows.subarray(r + ROW_HEAD, r + stride)),
        });
  const circuits = new Map<number, SubCircuit>();
  const circuitOf = (si: number) => {
    let c = circuits.get(si);
    if (!c) {
      c = subCircuit(s.subs[si].ts, s.volts, SUB_BAND_HZ);
      circuits.set(si, c);
    }
    return c;
  };
  let designs = 0,
    subDesigns = 0;
  let ctx: PaSearchContext | null = null;
  let units: Unit[] = [];
  const uppersCache = new Map<string, UpperSet>();
  // (the box pairs per sub, plywood and rung, and per vent and tuning: the search's biggest stores, held to a budget)
  const bareCache = new PairCache<{ pairs: Pairs; size: number }>();
  const groupCache = new PairCache<GroupState>();
  const rejected = new Set<string>();
  // progress (the model step reports its own): each card slot an equal share, the slot being searched filled by the units
  // its search has settled. The selection runs the slots again each round and for the near miss, so this can go back;
  // the page's runner shows the furthest it has got.
  const progress = { slot: 0, slots: 1, done: 0, total: 0, best: "" };
  const throttle = throttledProgress(onProgress);
  const SLOT_UNITS = 1000;
  const report = (force = false) =>
    throttle(
      Math.round(
        SLOT_UNITS * (progress.slot + (progress.total ? progress.done / progress.total : 0)),
      ),
      SLOT_UNITS * progress.slots,
      force,
      progress.best || undefined,
    );

  const bare = (si: number, ti: number, ri: number) => {
    const k = (si * s.walls.length + ti) * s.rungs.length + ri;
    let b = bareCache.get(k);
    if (!b) {
      b = { pairs: barePairs(s, s.subs[si], s.walls[ti], s.rungs[ri]), size: 0 };
      b.size = b.pairs.length;
      bareCache.set(k, b);
    }
    return b.pairs;
  };

  /** A solved box on a rung: its weight, vent area, outside size and duct length. */
  interface Shape {
    lb: number;
    area: number;
    box: Dims3;
    len: number;
  }
  // a vent area class: the box sides the area follows (a slot's width, a side duct's height; a round tube's is fixed)
  // (in the tower every shape is its own: the mid's box follows the sub's)
  const classOf = (style: PortStyle, dims: Dims3) =>
    s.tower
      ? null
      : style === "slots" || style === "folded"
        ? s.free === "w"
          ? null
          : dims.w
        : style === "vslots" || style === "vslot1"
          ? s.free === "h"
            ? null
            : dims.h
          : 0;
  /** A group's shapes so far: its box pairs (lightest floor first), how many are solved, and the lightest box per vent area. */
  interface GroupState {
    size: number;
    pairs: Pairs;
    next: number;
    best: Map<number, Shape & { done: boolean }>;
    unique: number;
    list: Shape[] | null;
  }
  // The lightest box that fits, per vent area, for one sub, plywood, vent, tuning and rung, among the pairs solved so far
  // (heaviest area first). Pairs are solved lightest floor first while `more(floor)` says a box that light could still
  // matter (by default, all of them): a vent area whose lightest box weighs at most the last floor passed is final.
  const shapes = (
    si: number,
    ti: number,
    st: number,
    zi: number,
    fi: number,
    ri: number,
    more: (lb: number) => boolean = () => true,
  ): Shape[] => {
    const style = s.styles[st];
    const k =
      ((((si * s.walls.length + ti) * VENT_STYLES.length + VENT_STYLES.indexOf(style)) *
        MAX_VENT_SIZES +
        zi) *
        s.fbs.length +
        fi) *
        s.rungs.length +
      ri;
    const sub = s.subs[si],
      t = s.walls[ti],
      free = s.free;
    const vent: VentSpec = { ...s.cur.cVent, ...ventSizesFor(style)[zi], len: 0 };
    const V = s.rungs[ri];
    let g = groupCache.get(k);
    if (!g) {
      const pairs = pairsFor(si, ti, ri, style, zi, vent, s.fbs[fi]);
      g = {
        size: pairs.length,
        pairs,
        next: 0,
        best: new Map(),
        unique: -1,
        list: null,
      };
      groupCache.set(k, g);
    }
    if (!free) return [];
    const need = subDriverClearanceNeededIn(sub.size);
    const target = { style, vent, t, inset: s.cur.inset, disp: sub.ts.disp, VbL: V, Fb: s.fbs[fi] };
    const [lo, hi] = s.sr[free];
    while (g.next < pairCount(g.pairs)) {
      const i = g.next;
      const floor = pairLb(g.pairs, i);
      if (!more(floor)) break;
      g.next++;
      const dims = pairDims(s, g.pairs, i);
      const ck = classOf(style, dims) ?? g.unique--;
      const b = g.best.get(ck);
      if (b?.done) continue;
      if (b && floor >= b.lb) {
        b.done = true; // every later pair of this class is at least this heavy
        continue;
      }
      const sol = solveShape(target, dims, free, pairX(g.pairs, i));
      if (!sol) continue;
      const x = sol.box[free];
      if (x < lo - 1e-9 || x > hi + 1e-9) continue;
      const v = { ...vent, len: sol.len };
      if (sol.len < s.grid.minDuctIn || sol.len > ductFit(sol.box, style, v, t).fit) continue;
      const { clearW, clearH } = driverClearance(sol.box, style, v, t);
      if (Math.min(clearW, clearH) < need) continue;
      const lb = subWeightLb(sol.box, t, sub.lb);
      if (lb > s.cap + 1e-9) continue;
      if (!b || lb < b.lb) {
        g.best.set(ck, { lb, area: sol.area, box: sol.box, len: sol.len, done: false });
        g.list = null;
      }
    }
    g.list ??= [...g.best.values()]
      .map(({ lb, area, box, len }) => ({ lb, area, box, len }))
      .sort((a, b) => b.area - a.area || a.lb - b.lb);
    return g.list;
  };
  // A group's box pairs, each with a floor on its weight. With depth free the vent's area is the pair's own, so the duct
  // length for the tuning is exact where the end correction doesn't read the gap behind the duct, and otherwise lies
  // between the length with no correction and the one with the correction at its largest (the smallest gap). A duct
  // shorter than the shortest allowed, or longer than the deepest box holds, rules the pair out; the duct's own air makes
  // the box at least that much bigger, so heavier.
  // the vent's shape in the deepest box of a pair (the duct's far end at the back wall), per plywood, vent and pair
  const deepShapes = new Map<string, VentShape>();
  const deepShape = (ti: number, style: PortStyle, zi: number, vent: VentSpec, dims: Dims3) => {
    const k = `${ti}|${style}|${zi}|${dims.w}|${dims.h}|${dims.d}`;
    let v = deepShapes.get(k);
    if (!v) {
      if (deepShapes.size >= 200_000) deepShapes.clear();
      v = ventShape(style, dims, { ...vent, len: 1e9 }, s.walls[ti]);
      deepShapes.set(k, v);
    }
    return v;
  };
  const pairsFor = (
    si: number,
    ti: number,
    ri: number,
    style: PortStyle,
    zi: number,
    vent: VentSpec,
    fb: number,
  ) => {
    const sub = s.subs[si],
      t = s.walls[ti],
      V = s.rungs[ri];
    const all = bare(si, ti, ri);
    if (s.free !== "d") return all;
    const [lo, hi] = s.sr.d;
    const fixedEc = isRoundPort(style) || style === "folded";
    const out: number[] = [];
    for (let i = 0; i < pairCount(all); i++) {
      const dims = pairDims(s, all, i);
      const deepest = { ...dims, d: hi };
      const vs = deepShape(ti, style, zi, vent, deepest);
      const Leff = effectiveLengthFor(vs.area, V, fb);
      const lenHi = fixedEc ? ductLengthFor(vs, Leff) : Leff / 0.0254;
      const lenLo = ductLengthFor(vs, Leff);
      if (lenHi < s.grid.minDuctIn) continue;
      if (lenLo > ductFit(deepest, style, { ...vent, len: lenLo }, t).fit) continue;
      const x = bareFree(
        s,
        dims,
        t,
        sub.ts.disp,
        V + (vs.area * Math.max(0, lenLo) * 16.387) / 1000,
      );
      if (x === null) continue;
      const box = { ...dims, d: Math.max(x, lo) };
      const lb = subWeightLb(box, t, sub.lb);
      if (lb > s.cap + 1e-9 || towerMidFails(s, box, t)) continue;
      out.push(all[i * PAIR], all[i * PAIR + 1], box.d, lb);
    }
    return packPairs(out);
  };

  // a sub design from a shape (or your box) on a curve
  const subDesign = (
    si: number,
    t: number,
    style: PortStyle,
    vent: VentSpec,
    box: Dims3,
    hpf: number,
    lb: number,
    area: number,
    cs: CurveSummary,
    key: string,
  ): SubDesign | null => {
    const sub = s.subs[si];
    let lim = subLimitOf(cs, area, sub.ts, s.volts, s.portMax);
    let ampW = s.amps.ampW;
    // A sub its port limits fails the checks; with its amp free it comes down, as in the quick search, to the highest
    // slider step under the port's limit (then the amp sets the level). A locked amp leaves it out.
    const portLimited = lim.who === "port";
    if (portLimited) {
      const w = s.locks.ampW ? null : onSlider((lim.V * (1 - 1e-9)) ** 2 / 8, AMP_WATTS_STEPS.ampW);
      if (w === null) return null;
      ampW = w;
      lim = { who: "amp", V: Math.sqrt(w * 8), W: w };
    }
    subDesigns++;
    return {
      ampW,
      portLimited,
      si,
      t,
      style,
      vent,
      box,
      hpf,
      lb,
      area,
      cs,
      lim,
      out0: outputAt(cs, lim, s.volts),
      need: s.xoLos.map(
        (xo, xi) =>
          musicAt(cs.xoSpl[xi], gridFrequency(s.xoIdx[xi]), xo, s.cur.xoLoOrder, lim, s.volts) -
          s.cur.tilt,
      ),
      chS:
        (sub.id !== s.cur.sub ? 1 : 0) +
        (style !== s.cur.portStyle ? 1 : 0) +
        (t !== s.cur.wall ? 1 : 0),
      vol: box.w * box.h * box.d,
      key,
    };
  };
  // a unit's sub designs: on a rung, per plywood, style and size, the lightest box per vent area, and of the areas
  // where the port no longer sets the limit only the lightest (they are the same design)
  function* expand(c: PaSearchContext, u: Unit, q: Query, best: () => readonly [number, number]) {
    if (u.own) {
      yield u.own;
      return;
    }
    const sub = s.subs[u.si];
    const outUb = outputAt(u.cs, subLimitOf(u.cs, Infinity, sub.ts, s.volts, s.portMax), s.volts);
    for (let ti = 0; ti < s.walls.length; ti++) {
      const t = s.walls[ti];
      const pairs = bare(u.si, ti, u.ri);
      if (!pairCount(pairs)) continue;
      for (let st = 0; st < s.styles.length; st++) {
        const style = s.styles[st];
        const chS =
          (sub.id !== s.cur.sub ? 1 : 0) +
          (style !== s.cur.portStyle ? 1 : 0) +
          (t !== s.cur.wall ? 1 : 0);
        // the group's floor: the curve's F3 and output with the port ignored, the bare box's weight, its changes
        const r = floorOf(
          c,
          q,
          ti,
          { price: sub.price, lb: pairLb(pairs, 0), out: outUb, chS },
          u.cs,
          null,
        );
        if (!r || !before(r, best())) continue;
        const sizes = ventSizesFor(style);
        for (let zi = 0; zi < sizes.length; zi++) {
          // solved only as far as a box could still win: lightest first, while the floor at that weight is ahead
          const list = shapes(u.si, ti, st, zi, u.fi, u.ri, (lb) => {
            const f = floorOf(c, q, ti, { price: sub.price, lb, out: outUb, chS }, u.cs, null);
            return f !== null && before(f, best());
          });
          let freeLim: number | null = null;
          for (const sh of list) {
            const vent = { ...s.cur.cVent, ...sizes[zi], len: sh.len };
            const sd = subDesign(
              u.si,
              t,
              style,
              vent,
              sh.box,
              s.hps[u.fi][u.hi],
              sh.lb,
              sh.area,
              u.cs,
              `${u.si}|${u.ri}|${u.fi}|${u.hi}|${ti}|${st}|${zi}|${sh.area}`,
            );
            if (!sd) continue;
            // areas run largest first: once the port stops setting the limit, the next port-free one is only heavier
            // (in the tower, a different box and so a different mid)
            if (!sd.portLimited && !s.tower) {
              if (freeLim !== null && sh.lb >= freeLim) continue;
              freeLim = sh.lb;
            }
            yield sd;
          }
        }
      }
    }
  }

  // ---- uppers ----
  const hornModels = new Map<string, number>();
  // the warnings a mid with a horn pair at a crossover carries that count against a design (soft horn warnings)
  const hornWarnings = (m: MidDriver, hp: PaHornEntry, xoHi: number, c: PaSearchContext) => {
    const k = `${m.id}|${hp.cd.id}|${hp.h.id}|${xoHi}`;
    const hit = hornModels.get(k);
    if (hit !== undefined) return hit;
    const hz: Partial<HornHf> = hp.h.hf || {};
    const hm = hornResponse(hp.cd.hf, hz, xoHi, c.amps.hfAmpW, c.cur.xoHiOrder);
    const n = hm
      ? hornChips({
          hf: hm.hf,
          hz,
          horn: hp.h,
          xoHi,
          hornModel: hm,
          hfAmpW: c.amps.hfAmpW,
          midAtXoHi: null,
          hfTilt: c.cur.hfTilt,
          hornAtXo: null,
          midBeam: pistonBeamWidthDeg(m.ts.Sd, xoHi),
          fK: hz.covH && hp.h.size ? keeleFrequency(hz.covH, hp.h.size.w) : null,
        }).filter(([kind, , , id]) => kind === "warn" && !LIMIT_CHIP_IDS.has(id)).length
      : 0;
    hornModels.set(k, n);
    return n;
  };
  // every mid box, upper crossover and horn pair for a plywood and lower crossover that passes the mid's and horn's own
  // checks, with the mid turned down until the horn keeps up (as the quick search's combine step)
  const buildUppers = (
    c: PaSearchContext,
    t: number,
    xoLo: number,
    boxes: (m: MidDriver) => { bx: Dims3; mDim: Dims3 }[],
    mids: readonly MidDriver[],
  ): UpperSet => {
    const all: Upper[] = [];
    const { cur, amps, locks } = c;
    for (const m of mids)
      for (const { bx, mDim } of boxes(m)) {
        // midSystem's checks and levels, read where the search looks (lib/pa/exactSub)
        const mm = sealedMid(m, bx, t, cur.inset, amps.mAmpW, xoLo);
        if (mm.Qtc < 0.5 || mm.Qtc > 0.8 || mm.f3 > xoLo || Math.min(bx.w, bx.h) < m.size + 1.2)
          continue;
        for (const xoHi of c.xoHis) {
          const at = (f: number) =>
            mm.at(midGridIndexNear(f, xoHi), xoLo, xoHi, cur.xoLoOrder, cur.xoHiOrder);
          const lo = at(xoLo),
            hi = at(xoHi);
          const midLb = midWeightLb(bx, t) + (m.lb || 0);
          for (const hp of c.hornTable[xoHi]) {
            const room = hp.at + cur.hfTilt + KEEP_UP_SLACK_DB;
            const mAmpW =
              hi.max <= room
                ? amps.mAmpW
                : locks.mAmpW
                  ? null
                  : ampForGain(amps.mAmpW, room - hi.sig, AMP_WATTS_STEPS.mAmpW);
            if (mAmpW === null) continue;
            all.push({
              mid: m,
              bx,
              mDim,
              xoHi,
              hp,
              mAmpW,
              midP: m.price || 0,
              cdP: hp.cd.price || 0,
              midLb,
              w: hornWarnings(m, hp, xoHi, c),
              chU:
                (m.id !== cur.mid ? 1 : 0) +
                (hp.cd.id !== cur.cd ? 1 : 0) +
                (hp.h.id !== cur.horn ? 1 : 0),
              lo: Math.min(lo.max, lo.sig + 10 * Math.log10(mAmpW / amps.mAmpW)),
            });
          }
        }
      }
    // per mid, the options no other option of that mid beats on the horn's price, the box's weight, the warnings, the
    // changes and the level it leaves the sub (sorted so a beater always comes first)
    const list: Upper[] = [];
    const byMid = new Map<string, Upper[]>();
    for (const e of all) {
      const g = byMid.get(e.mid.id);
      if (g) g.push(e);
      else byMid.set(e.mid.id, [e]);
    }
    for (const g of byMid.values()) {
      g.sort(
        (a, b) => a.cdP - b.cdP || b.lo - a.lo || a.midLb - b.midLb || a.w - b.w || a.chU - b.chU,
      );
      const front: Upper[] = [];
      for (const e of g)
        if (
          !front.some(
            (f) =>
              f.cdP <= e.cdP && f.midLb <= e.midLb && f.w <= e.w && f.chU <= e.chU && f.lo >= e.lo,
          )
        )
          front.push(e);
      list.push(...front);
    }
    // each goal's objective splits into the sub's part and the upper's (the card rules' objectives add up; checked at
    // setup): the upper's part is its objective with the sub's numbers at zero
    const byLo = Int32Array.from(list.map((_, i) => i)).sort(
      (a, b) => list[b].lo - list[a].lo || a - b,
    );
    const keys = perGoal((g) => Float64Array.from(list, (e) => upperPart(c, g, e)));
    // the scan order: the upper's part first, but Louder takes the loudest mid first (the sub can't outdo it)
    const order = perGoal((g) =>
      g === "louder"
        ? byLo
        : Int32Array.from(list.map((_, i) => i)).sort((a, b) => keys[g][a] - keys[g][b] || a - b),
    );
    const stair = perGoal((g) => {
      let run = Infinity;
      return Float64Array.from(byLo, (i) => (run = Math.min(run, keys[g][i])));
    });
    return {
      list,
      order,
      keys,
      loDesc: Float64Array.from(byLo, (i) => list[i].lo),
      stair,
      minPrice: Math.min(...list.map((e) => e.midP + e.cdP)),
      minLb: Math.min(...list.map((e) => e.midLb)),
    };
  };
  const ZERO: PaMetric = { price: 0, heaviest: 0, out: 0, f3: 0, ch: 0, w: 0 };
  const upperPart = (c: PaSearchContext, g: PaGoal, e: Upper) =>
    c.obj[g]({ price: e.midP + e.cdP, heaviest: 0, out: 0, f3: 0, ch: e.chU, w: e.w }) -
    c.obj[g](ZERO);
  const tower = () => s.cur.layout === "tower";
  const curMid = byId(MID_OPTIONS, s.cur.mid);
  const uppers = (c: PaSearchContext, ti: number, xi: number, box: Dims3): UpperSet => {
    const t = s.walls[ti],
      xoLo = s.xoLos[xi];
    // the tower's mid takes the sub's footprint, so its options follow the sub box (a box's are built again once
    // the cache has filled: the depths are solved, so few boxes come back)
    const k = tower() ? `${ti}|${xi}|${box.w}|${box.d}` : `${ti}|${xi}`;
    let u = uppersCache.get(k);
    if (!u) {
      if (uppersCache.size >= CACHE_MAX) uppersCache.clear();
      u = tower()
        ? buildUppers(
            c,
            t,
            xoLo,
            () => [{ bx: { w: box.w, h: TOWER_MID_H, d: box.d }, mDim: s.cur.mDim }],
            s.tower?.mid ? [s.tower.mid] : [],
          )
        : buildUppers(
            c,
            t,
            xoLo,
            (m) => c.midBoxes(m, t).flatMap((bx) => (bx ? [{ bx, mDim: bx }] : [])),
            c.mids,
          );
      uppersCache.set(k, u);
    }
    return u;
  };
  // Once the sub comes down for its mid, its output is the mid's level at the crossover plus a constant of the curve
  // (out0 − need0 doesn't depend on the sub's limit), so with the mid at `lo` the output is at most
  // min(out0, lo + outOverMid): the floor on the amp step only lowers it.
  const outOverMid = (cs: CurveSummary, xi: number) =>
    cs.bandMin -
    cs.xoSpl[xi] -
    20 *
      Math.log10(linkwitzRileyLowpass(gridFrequency(s.xoIdx[xi]), s.xoLos[xi], s.cur.xoLoOrder)) +
    s.cur.tilt +
    KEEP_UP_SLACK_DB;
  // per curve, outOverMid at each lower crossover (the bounds read it for every unit of every search)
  const overs = new WeakMap<CurveSummary, number[]>();
  const oversOf = (cs: CurveSummary) => {
    let o = overs.get(cs);
    if (!o) overs.set(cs, (o = s.xoLos.map((_, xi) => outOverMid(cs, xi))));
    return o;
  };
  const splits = (q: Query): q is Query & { axis: PaGoal } => q.axis !== null;

  /**
   * A floor on the rank of every design with this sub side on plywood `ti` (null: none can pass the query): over the
   * lower crossovers, the uppers loud enough for the query's output, the sub's part of the objective plus the least
   * upper part among them. `sp` holds floors for the sub side (price, weight, output) and its changes; `box` is the sub
   * box when known (the tower's uppers follow it; without it the tower's count as free).
   */
  const floorOf = (
    c: PaSearchContext,
    q: Query,
    ti: number,
    sp: { price: number; lb: number; out: number; chS: number },
    cs: CurveSummary,
    box: Dims3 | null,
  ): [number, number] | null => {
    let best: [number, number] | null = null;
    const cut = splits(q);
    if (tower() && !box) {
      const m = {
        price: sp.price - 1e-6,
        heaviest: sp.lb,
        out: sp.out,
        f3: cs.f3,
        ch: sp.chS,
        w: 0,
      };
      return fails(q.need, m) ? null : cut ? [c.obj[q.axis](m), 0] : q.rank(m);
    }
    for (let xi = 0; xi < s.xoLos.length; xi++) {
      const us = fitted(c, q, ti, xi, box ?? s.cur.cDim, sp.chS);
      const over = oversOf(cs)[xi];
      // how many uppers (loudest first) leave the sub the query's output
      const loMin = q.need.outMin - over - EPS;
      let a = 0,
        b = us.loDesc.length;
      while (a < b) {
        const mid = (a + b) >> 1;
        if (us.loDesc[mid] >= loMin) a = mid + 1;
        else b = mid;
      }
      if (!a) continue;
      const m = {
        price: sp.price + us.minPrice - 1e-6,
        heaviest: Math.max(sp.lb, us.minLb),
        out: Math.min(sp.out, us.loDesc[0] + over),
        f3: cs.f3,
        ch: sp.chS,
        w: 0,
      };
      if (fails(q.need, m)) continue;
      const r: [number, number] = cut
        ? [c.obj[q.axis]({ ...m, price: sp.price - 1e-6 }) + us.stair[a - 1], 0]
        : q.rank(m);
      if (!best || before(r, best)) best = r;
    }
    return best;
  };
  /** The uppers that pass a query's own limits on weight, changes and price, as the bounds read them. */
  // an upper set fitted to a query: its stair for the query's goal only
  type Fitted = Pick<UpperSet, "loDesc" | "minPrice" | "minLb"> & { stair: Float64Array };
  const fittedMemo = new WeakMap<Query, Map<string | number, Fitted>>();
  const cheapestSub = Math.min(...s.subs.map((o) => o.price));
  // a query's uppers for a plywood and lower crossover: those no design of the query can turn down for being too
  // heavy, changing too much or costing too much (with the cheapest sub), loudest first, with the least upper part of
  // the query's objective among that many of the loudest
  const fitted = (
    c: PaSearchContext,
    q: Query,
    ti: number,
    xi: number,
    box: Dims3,
    chS: number,
  ): Fitted => {
    let memo = fittedMemo.get(q);
    if (!memo || memo.size >= CACHE_MAX) fittedMemo.set(q, (memo = new Map()));
    const k = tower()
      ? `${ti}|${xi}|${chS}|${box.w}|${box.d}`
      : (chS * s.walls.length + ti) * s.xoLos.length + xi;
    const hit = memo.get(k);
    if (hit) return hit;
    const us = uppers(c, ti, xi, box);
    const n = q.need;
    const keep = Array.from(us.order.louder).filter((i) => {
      const e = us.list[i];
      return (
        e.midLb <= n.heaviestMax + EPS &&
        chS + e.chU <= n.chMax &&
        cheapestSub + e.midP + e.cdP <= n.priceMax + EPS
      );
    });
    const keys = splits(q) ? us.keys[q.axis] : null;
    let run = Infinity;
    const f: Fitted = {
      loDesc: Float64Array.from(keep, (i) => us.list[i].lo),
      stair: Float64Array.from(keep, (i) => (run = Math.min(run, keys ? keys[i] : 0))),
      minPrice: Math.min(...keep.map((i) => us.list[i].midP + us.list[i].cdP)),
      minLb: Math.min(...keep.map((i) => us.list[i].midLb)),
    };
    memo.set(k, f);
    return f;
  };
  // a unit's floor: your box as it is, or a rung's curve over the plywoods (the port ignored, the bare box's weight)
  // a rung's curve's output with the port ignored and its bare box's weight per plywood, once per unit
  const unitStatics = new WeakMap<Unit, { out: number; lbs: number[] }>();
  const unitFloor = (c: PaSearchContext, q: Query, u: Unit) => {
    const sub = s.subs[u.si];
    if (u.own)
      return floorOf(
        c,
        q,
        s.walls.indexOf(u.own.t),
        { price: sub.price, lb: u.own.lb, out: u.own.out0, chS: u.own.chS },
        u.cs,
        u.own.box,
      );
    let st = unitStatics.get(u);
    if (!st) {
      st = {
        out: outputAt(u.cs, subLimitOf(u.cs, Infinity, sub.ts, s.volts, s.portMax), s.volts),
        lbs: s.walls.map((_, ti) => lightestOf(bare(u.si, ti, u.ri))),
      };
      unitStatics.set(u, st);
    }
    let best: [number, number] | null = null;
    for (let ti = 0; ti < s.walls.length; ti++) {
      const lb = st.lbs[ti];
      if (lb === Infinity) continue;
      // (the vent style is open, so it counts as unchanged)
      const chS = (sub.id !== s.cur.sub ? 1 : 0) + (s.walls[ti] !== s.cur.wall ? 1 : 0);
      const r = floorOf(c, q, ti, { price: sub.price, lb, out: st.out, chS }, u.cs, null);
      if (r && (!best || before(r, best))) best = r;
    }
    return best;
  };

  // ---- one search: the best design for a query (better than `start`), in the query's order with its bounds ----
  const search = (
    c: PaSearchContext,
    q: Query,
    start: [number, number],
    first = false,
  ): Found | null => {
    let best: Found | null = null;
    let bestRank: [number, number] = start;
    const bestNow = () => bestRank;
    const cut = splits(q);
    // the units, each with its floor, best floor first
    const cand: { u: Unit; r: [number, number] }[] = [];
    for (const u of units) {
      const r = unitFloor(c, q, u);
      if (r && before(r, bestRank)) cand.push({ u, r });
    }
    cand.sort((a, b) => a.r[0] - b.r[0] || a.r[1] - b.r[1]);
    progress.done = 0;
    progress.total = cand.length;
    let k = 0;
    for (; k < cand.length; k++) {
      const { u, r } = cand[k];
      if (!before(r, bestRank)) break;
      progress.done++;
      for (const sd of expand(c, u, q, bestNow)) {
        const ti = s.walls.indexOf(sd.t);
        const sub = s.subs[sd.si];
        const fl = floorOf(
          c,
          q,
          ti,
          { price: sub.price, lb: sd.lb, out: sd.out0, chS: sd.chS },
          sd.cs,
          sd.box,
        );
        if (!fl || !before(fl, bestRank)) continue;
        // the mids this design can't take: those of a card it is too like (same sub, vent style, plywood, volume)
        const banned = q.avoid
          .filter(
            (p) =>
              p.c.sub === sub.id &&
              p.c.portStyle === sd.style &&
              p.c.wall === sd.t &&
              Math.abs(sd.vol / (p.c.cDim.w * p.c.cDim.h * p.c.cDim.d) - 1) < SAME_VOLUME,
          )
          .map((p) => p.c.mid);
        // the sub's part of the objective, for the scan's cut
        const subPart = cut
          ? c.obj[q.axis]({
              price: sub.price - 1e-6,
              heaviest: sd.lb,
              out: sd.out0,
              f3: sd.cs.f3,
              ch: sd.chS,
              w: 0,
            })
          : 0;
        for (let xi = 0; xi < s.xoLos.length; xi++) {
          const us = uppers(c, ti, xi, sd.box);
          const order = cut ? us.order[q.axis] : null;
          const over = oversOf(sd.cs)[xi];
          const n = us.list.length;
          for (let j = 0; j < n; j++) {
            const ui = order ? order[j] : j;
            const e = us.list[ui];
            const cap = Math.min(sd.out0, e.lo + over);
            // the scan order's floor on the rest: Louder's loudest mid left, else the sub's part plus the upper's
            if (cut) {
              const floor =
                q.axis === "louder"
                  ? c.obj.louder({ ...ZERO, out: cap, ch: sd.chS })
                  : subPart + us.keys[q.axis][ui];
              if (floor >= bestRank[0]) break;
            }
            // what rules an upper out before the design is worked out: too quiet a mid, too many changes, over the
            // budget or the weight, or a mid of a card this design is too like
            if (
              cap < q.need.outMin - EPS ||
              sd.chS + e.chU > q.need.chMax ||
              sub.price + e.midP + e.cdP > q.need.priceMax + EPS ||
              e.midLb > q.need.heaviestMax + EPS ||
              banned.includes(e.mid.id)
            )
              continue;
            const f = design(c, sd, xi, e, q);
            if (!f || rejected.has(`${sd.key}|${xi}|${ui}`)) continue;
            if (before(f.rank, bestRank)) {
              best = { ...f, sd, xi, u: e, ui, q };
              bestRank = f.rank;
              if (first) {
                progress.best = bestText(c.goals[0], f.m);
                report();
              }
            }
          }
        }
      }
      report();
    }
    progress.done = cand.length;
    report();
    return best;
  };
  // the ranking by a goal's own objective (the queries the bounds can split)
  const byGoal =
    (c: PaSearchContext, g: PaGoal) =>
    (m: PaMetric): [number, number] => [c.obj[g](m), 0];
  // one design's numbers and rank (null when its checks fail or the query turns it down)
  const design = (c: PaSearchContext, sd: SubDesign, xi: number, e: Upper, q: Query) => {
    designs++;
    // the sub comes down until the mid keeps up (when its amp is free), as the quick search's combine step
    const gap = e.lo - sd.need[xi];
    let ampW = sd.ampW,
      out = sd.out0;
    if (gap < -KEEP_UP_SLACK_DB) {
      const w = c.locks.ampW
        ? null
        : ampForGain(sd.lim.W, gap + KEEP_UP_SLACK_DB, AMP_WATTS_STEPS.ampW);
      if (w === null) return null;
      ampW = w;
      out = sd.out0 + 10 * Math.log10(w / sd.lim.W);
    }
    const m = {
      // summed as evaluateDesign sums it: sub, mid, compression driver
      price: 0 + s.subs[sd.si].price + e.midP + e.cdP,
      heaviest: Math.max(sd.lb, e.midLb),
      out,
      f3: sd.cs.f3,
      ch: sd.chS + e.chU,
      w: e.w,
    };
    if (fails(q.need, m)) return null;
    if (q.limits && (m.price > q.limits.budget + 1e-9 || m.heaviest > q.limits.maxLb + 1e-9))
      return null;
    if (!q.ok(m)) return null;
    return { ampW, m, rank: q.rank(m) };
  };
  const bestText = (g: PaGoal, m: PaMetric) => BEST_WORDS[g](m);

  // ---- the design a card would carry, checked with the planner's own model ----
  const materialise = (c: PaSearchContext, f: Found): PaPoolEntry | null => {
    const { sd, u } = f;
    const sub = s.subs[sd.si];
    const cfg: PaDesignConfig = {
      ...c.base,
      sub: sub.id,
      cDim: sd.box,
      wall: sd.t,
      portStyle: sd.style,
      cVent: sd.vent,
      hpf: sd.hpf,
      ampW: f.ampW,
      mAmpW: u.mAmpW,
      xoLo: s.xoLos[f.xi],
      xoHi: u.xoHi,
      mid: u.mid.id,
      mDim: u.mDim,
      cd: u.hp.cd.id,
      horn: u.hp.h.id,
    };
    const m = evaluateDesign(cfg);
    const p = m && { c: cfg, m, ch: c.changes(cfg) };
    const ok =
      p &&
      m &&
      designProblems(m, { maxLb: Infinity, budget: Infinity, allow: c.lim.allow }).length === 0 &&
      m.price === f.m.price &&
      m.heaviest === f.m.heaviest &&
      Math.abs(m.out - f.m.out) < 1e-6 &&
      Math.abs(m.f3 - f.m.f3) < 1e-6 &&
      c.metric(p).w === f.m.w &&
      p.ch === f.m.ch;
    if (!ok || !p) {
      rejected.add(`${sd.key}|${f.xi}|${f.ui}`);
      return null;
    }
    // the fast numbers can sit on a threshold the planner's land just past: the design still joins the pool (another
    // card may take it) but the searches skip it from now on, or the next round would find it again
    if (!f.q.ok(c.metric(p))) rejected.add(`${sd.key}|${f.xi}|${f.ui}`);
    return p;
  };

  // ---- setup on the first card selection ----
  const setup = (c: PaSearchContext) => {
    ctx = c;
    for (const g of GOALS) {
      // the bounds split each objective into the sub's part and the upper's: that needs it to add up
      const a = { price: 400, heaviest: 80, out: 120, f3: 30, ch: 2, w: 0 },
        b = { price: 300, heaviest: 0, out: 0, f3: 0, ch: 1, w: 1 };
      const sum = { price: 700, heaviest: 80, out: 120, f3: 30, ch: 3, w: 1 };
      if (Math.abs(c.obj[g](sum) - (c.obj[g](a) + c.obj[g](b) - c.obj[g](ZERO))) > 1e-6)
        throw new Error(`the exact search needs the ${g} objective to add up over its parts`);
    }
    units = [];
    s.subs.forEach((_, si) => {
      for (const [k, cs] of curves[si]) {
        const hi = k % 4,
          rest = (k - hi) / 4,
          fi = rest % s.fbs.length,
          ri = (rest - fi) / s.fbs.length;
        units.push({ si, cs, ri, fi, hi, own: null });
      }
    });
    units.push(...ownUnits(c));
  };
  // your box as it is (your vent and highpass) on each plywood, when your sub is searched; with the box locked, also
  // every vent size at every tuning in it
  const ownUnits = (c: PaSearchContext): Unit[] => {
    const out: Unit[] = [];
    const cur = c.cur;
    const midForGeom = curMid ?? MID_OPTIONS[0];
    const add = (
      si: number,
      t: number,
      style: PortStyle,
      vent: VentSpec,
      hpf: number,
      tag: string,
    ) => {
      const sub = s.subs[si];
      const box = cur.cDim;
      const g = subGeometry(sub, midForGeom, {
        subBox: box,
        midDims: cur.mDim,
        wall: t,
        inset: cur.inset,
        portStyle: style,
        cVent: vent,
        layout: cur.layout,
      });
      if (!(vent.len > 0) || vent.len > ductFit(box, style, vent, t).fit) return;
      const { clearW, clearH } = driverClearance(box, style, vent, t);
      if (Math.min(clearW, clearH) < subDriverClearanceNeededIn(sub.size)) return;
      const lb = subWeightLb(box, t, sub.lb);
      if (lb > s.cap + 1e-9) return;
      const [cs] = ventedCurves(
        circuitOf(si),
        g.netL,
        g.Fb,
        [highpassTable(hpf, cur.hpType)],
        s.xoIdx,
      );
      const sd = subDesign(
        si,
        t,
        style,
        vent,
        box,
        hpf,
        lb,
        g.port.area,
        cs,
        `own|${si}|${t}|${tag}`,
      );
      if (sd) out.push({ si, cs, ri: -1, fi: -1, hi: -1, own: sd });
    };
    const si = s.subs.findIndex((o) => o.id === cur.sub);
    if (si >= 0 && s.styles.includes(cur.portStyle) && Number.isFinite(cur.cVent.len))
      for (const t of s.walls) add(si, t, cur.portStyle, cur.cVent, cur.hpf, "yours");
    // the box locked on every side: every vent and tuning in it, duct length solved (no rungs then)
    if (!s.free)
      s.subs.forEach((sub, sj) => {
        for (const t of s.walls)
          for (const style of s.styles)
            ventSizesFor(style).forEach((size, zi) =>
              s.fbs.forEach((fb, fi) => {
                const len = lengthFor(sub, t, style, { ...cur.cVent, ...size, len: 0 }, fb);
                if (len === null) return;
                for (const hpf of s.hps[fi])
                  add(
                    sj,
                    t,
                    style,
                    { ...cur.cVent, ...size, len },
                    hpf,
                    `${style}|${zi}|${fi}|${hpf}`,
                  );
              }),
            );
      });
    return out;
  };
  // the duct length that tunes your box to `fb` (bisection on the planner's geometry, fast), null under the shortest duct
  const lengthFor = (sub: SubDriver, t: number, style: PortStyle, vent: VentSpec, fb: number) => {
    const box = s.cur.cDim;
    const tune = (len: number) => {
      const v = { ...vent, len };
      const vs = ventShape(style, box, v, t);
      const V = subNetLiters(style, box, t, s.cur.inset, v, vs.area, sub.ts.disp);
      const Leff =
        len * 0.0254 +
        (vs.ec !== null
          ? vs.ec * 0.0254
          : 1.46 * Math.sqrt((vs.area * 0.00064516) / vs.n / Math.PI));
      return (343 / (2 * Math.PI)) * Math.sqrt((vs.area * 0.00064516) / ((V / 1000) * Leff));
    };
    let a = s.grid.minDuctIn,
      b = ductFit(box, style, { ...vent, len: 0 }, t).fit;
    if (b < a || tune(a) < fb || tune(b) > fb) return null;
    for (let i = 0; i < 60; i++) {
      const m = (a + b) / 2;
      if (tune(m) > fb) a = m;
      else b = m;
    }
    return (a + b) / 2;
  };

  // ---- the card selection, checked slot by slot against the whole grid ----
  const close = (choose: PaChoose, c: PaSearchContext): PaChoose => {
    if (!ctx) setup(c);
    let closestAdded = false;
    return (L, tgt) => {
      for (let round = 0; round < 200; round++) {
        const r = choose(L, tgt);
        const add = missing(c, r, L, tgt);
        if (!add && !closestAdded && (!r || r.fixMisses)) {
          // the near miss shows the pool's closest design (fewest problems, then the goal): the grid's must be in it
          closestAdded = true;
          const f = search(c, problemsQuery(c), [Infinity, Infinity]);
          const p = f && materialise(c, f);
          if (p) c.pool.push(p);
          continue;
        }
        if (!add) {
          report(true);
          return r;
        }
        const p = materialise(c, add);
        if (p) c.pool.push(p);
      }
      return choose(L, tgt);
    };
  };
  // what each card slot asks of a design, as selectCards and lib/pa/optimize's choose ask it
  const meetsOf = (c: PaSearchContext, tgt: number) => (m: PaMetric) =>
    c.goals.every((g) => keepGap(c.keep[g], { db: m.out + (c.target - tgt), f3: m.f3 }) === 0);
  const meetsNeed = (c: PaSearchContext, tgt: number): Partial<Need> => ({
    outMin: Math.max(...c.goals.map((g) => c.keep[g].db)) - (c.target - tgt),
    f3Max: Math.min(...c.goals.map((g) => c.keep[g].f3)),
  });
  const beatsAllOf = (c: PaSearchContext) => (m: PaMetric) =>
    !c.curMet || c.goals.every((g) => c.beats[g](m, c.curMet ?? m));
  const beatsAllNeed = (c: PaSearchContext): Need =>
    c.curMet ? c.goals.reduce((n, g) => both(n, beatsNeed(c.beats, g, c.curMet ?? m0)), ANY) : ANY;
  const m0: PaMetric = { price: 0, heaviest: 0, out: 0, f3: 0, ch: 0 };
  const limitsNeed = (L: PaProblemLimits): Partial<Need> => ({
    priceMax: L.budget,
    heaviestMax: L.maxLb,
  });
  const problemsQuery = (c: PaSearchContext): Query => ({
    axis: null,
    rank: (m) => [
      (m.heaviest > c.lim.maxLb + 1e-9 ? 1 : 0) + (m.price > c.lim.budget + 1e-9 ? 1 : 0),
      c.obj[c.goals[0]](m),
    ],
    need: ANY,
    limits: null,
    ok: () => true,
    avoid: [],
  });
  // the first slot that the grid fills better than the pool (or fills where the pool can't), as the design to add
  const missing = (c: PaSearchContext, r: PaChosen | null, L: PaProblemLimits, tgt: number) => {
    const goal = c.goals[0];
    const cards = r ? r.cards : [];
    const meets = meetsOf(c, tgt),
      beatsAll = beatsAllOf(c);
    const limited = both(ANY, limitsNeed(L));
    // the grid's best for a slot when it ranks clearly ahead of the pool's pick, or when the pool has none (null: the
    // pick stands)
    // the slots this selection fills (up to three cards: the first, the smallest change, alternatives), for progress
    progress.slots = Math.min(3, 1 + (c.curMet ? 1 : 0) + c.altAxes.length);
    const check = (q: Query, pick: PaPoolEntry | undefined, first = false) => {
      progress.slot = Math.min(taken.length, progress.slots - 1);
      const pr = pick ? q.rank(c.metric(pick)) : null;
      const f = search(c, q, pr ?? [Infinity, Infinity], first);
      return f &&
        (!pr || f.rank[0] < pr[0] - TOL || (f.rank[0] <= pr[0] + TOL && f.rank[1] < pr[1] - TOL))
        ? f
        : null;
    };
    let i = 0;
    const taken: PaPoolEntry[] = [];
    const at = (kind: string) => (cards[i] && cards[i].slot.kind === kind ? cards[i] : undefined);
    const firstCard = at("first");
    const qFirst: Query = {
      axis: goal,
      rank: byGoal(c, goal),
      need: both(both(limited, meetsNeed(c, tgt)), beatsAllNeed(c)),
      limits: L,
      ok: (m) => meets(m) && beatsAll(m),
      avoid: [],
    };
    const f1 = check(qFirst, firstCard?.p, true);
    if (f1) return f1;
    if (firstCard) {
      taken.push(firstCard.p);
      i++;
    } else if (c.curFails) {
      const fix = at("fix");
      const qFix: Query = {
        axis: goal,
        rank: byGoal(c, goal),
        need: both(limited, meetsNeed(c, tgt)),
        limits: L,
        ok: meets,
        avoid: [],
      };
      const ff = check(qFix, fix?.p);
      if (ff) return ff;
      if (fix) {
        taken.push(fix.p);
        i++;
      } else {
        const close = at("closest");
        const shortfall = (m: PaMetric) =>
          c.goals.reduce(
            (sum, g) => sum + keepGap(c.keep[g], { db: m.out + (c.target - tgt), f3: m.f3 }),
            0,
          );
        const qClose: Query = {
          axis: null,
          rank: (m) => [shortfall(m), c.obj[goal](m)],
          need: limited,
          limits: L,
          ok: () => true,
          avoid: [],
        };
        const fc = check(qClose, close?.p);
        if (fc) return fc;
        if (close) {
          taken.push(close.p);
          i++;
        }
      }
    }
    if (c.curMet) {
      const small = at("smallest");
      const avoid = [...taken];
      const qSmall: Query = {
        axis: goal,
        rank: byGoal(c, goal),
        need: both(both(both(limited, meetsNeed(c, tgt)), beatsAllNeed(c)), { chMax: 1 }),
        limits: L,
        ok: (m) => m.ch <= 1 && meets(m) && beatsAll(m),
        avoid,
      };
      const fs = check(qSmall, small?.p);
      if (fs) return fs;
      if (small) {
        taken.push(small.p);
        i++;
      }
    }
    const firstM = firstCard && c.metric(firstCard.p);
    for (const g of c.altAxes) {
      if (taken.length >= 3) break;
      const card = cards[i];
      const alt = card && card.slot.kind === "alt" && card.slot.axis === g ? card : undefined;
      let need = both(
        both(limited, { outMin: tgt - ALT_OUTPUT_DB }),
        c.curMet ? beatsNeed(c.beats, g, c.curMet) : {},
      );
      if (firstM) need = both(need, beatsNeed(c.beats, g, firstM));
      const qAlt: Query = {
        axis: g,
        rank: byGoal(c, g),
        need,
        limits: L,
        ok: (m) =>
          m.out >= tgt - ALT_OUTPUT_DB &&
          (!c.curMet || c.beats[g](m, c.curMet)) &&
          (!firstM || c.beats[g](m, firstM)),
        avoid: [...taken],
      };
      const fa = check(qAlt, alt?.p);
      if (fa) return fa;
      if (alt) {
        taken.push(alt.p);
        i++;
      }
    }
    return null;
  };

  // the lightest sub box on the grid that works (fits its vent and driver), lightest bare box first
  const lightestSubLb = () => {
    let best = Infinity;
    const order = units
      .map((u) => ({
        u,
        lb: u.own
          ? u.own.lb
          : Math.min(...s.walls.map((_, ti) => lightestOf(bare(u.si, ti, u.ri)))),
      }))
      .sort((a, b) => a.lb - b.lb);
    for (const { u } of order) {
      if (u.own) {
        best = Math.min(best, u.own.lb);
        continue;
      }
      for (let ti = 0; ti < s.walls.length; ti++) {
        const floor = lightestOf(bare(u.si, ti, u.ri));
        if (floor >= best) continue;
        for (let st = 0; st < s.styles.length; st++)
          ventSizesFor(s.styles[st]).forEach((_, zi) => {
            for (const sh of shapes(u.si, ti, st, zi, u.fi, u.ri)) best = Math.min(best, sh.lb);
          });
      }
    }
    return best === Infinity ? null : best;
  };
  return {
    close,
    lightestSubLb,
    stats: () => ({ designs, subDesigns }),
  };
}
const BEST_WORDS: Record<PaGoal, (m: PaMetric) => string> = {
  cheaper: (m) => `$${Math.round(m.price)}`,
  lighter: (m) => `${m.heaviest.toFixed(0)} lb`,
  lower: (m) => `${m.f3.toFixed(1)} Hz`,
  louder: (m) => `${m.out.toFixed(1)} dB`,
};

// the selection's progress in fixed units, and the share of it Improve's steps take before the card slots' searches
const SELECT_UNITS = 1000;
const QUICK_SHARE = 0.25;

/**
 * The exact search, with the same input, cards and near miss as `optimizePaStack`. `opts.scored` are the model step's
 * shares already done (by workers; else it runs here); `opts.grid` narrows the grid (tests).
 */
export function optimizePaStackExact(
  input: PaOptimizerInput,
  onProgress?: OptimizerProgressCallback,
  opts: { scored?: readonly (readonly PaExactScored[])[]; grid?: PaExactGrid } = {},
): PaOptimizerResult {
  const t0 = Date.now();
  const grid = opts.grid ?? PA_EXACT_GRID;
  const shares = opts.scored ?? [paExactScore(input, 0, 1, onProgress, grid)];
  // the selection's progress: Improve's steps first (its designs join the pool), then the card slots' searches
  const share = (from: number, to: number) => (p: OptimizerProgress) =>
    onProgress?.({
      done: Math.round(SELECT_UNITS * (from + ((to - from) * p.done) / Math.max(p.total, 1))),
      total: SELECT_UNITS,
      best: p.best,
    });
  const hook = exactHook(input, shares, onProgress && share(QUICK_SHARE, 1), grid);
  const res = optimizePaStack(input, onProgress && share(0, QUICK_SHARE), hook);
  const st = hook.stats();
  return {
    ...res,
    stats: {
      evaluated: res.stats.evaluated + st.designs,
      ms: Date.now() - t0,
      subs: st.subDesigns,
      combos: st.designs,
      pool: res.stats.pool,
    },
  };
}

/** One job for an exact-search worker: a share of the model step, or the search on all the shares. */
export function runPaExactJob(
  job: PaExactJob,
  onProgress?: OptimizerProgressCallback,
): PaExactJobResult {
  if (job.kind === "score")
    return {
      kind: "scored",
      scored: paExactScore(job.input, job.part, job.parts, onProgress, job.grid),
    };
  return {
    kind: "result",
    result: optimizePaStackExact(job.input, onProgress, { scored: job.scored }),
  };
}
