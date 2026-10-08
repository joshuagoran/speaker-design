// Hi-fi optimizer: woofer × box × tuning × plywood, then × tweeter × crossover, scored like the page scores them.
// Same rules as the PA optimizer: goals in tap order (the first ranks, the main card must beat your design on
// every one), each card's label true against your design, unlocked amps searched at their slider maximum (turned
// down where the band above can't keep up) and trimmed to the least power that keeps the card's level, and a card
// applies only the fields searched.
import {
  hifiSystem,
  hifiBox,
  hifiPortElbows,
  hifiVentPort,
  hifiWooferPrep,
  hifiWooferLevel,
  wooferFitsBaffle,
  wooferPastRange,
  qtcInRange,
  hifiGridTop,
  hifiWeightLb,
  tweeterMaxLevel,
  driversFitBaffle,
  driverLayout,
  belowTweeterMinXo,
  nearTweeterResonance,
  hifiChips,
  grossVolumeLiters,
  linkwitzRileyFilter,
  logSpacedFrequencies,
  hifiRoundEndCorrection,
  hifiTubeRoom,
  passiveRadiatorMassFor,
  passiveRadiatorFits,
  hifiSlotEndCorrection,
  slotWidth,
  slotMaxLength,
  needsWaveguide,
} from "./hifi";
import { ampVoltage, ventTuning } from "../pa/calc";
import { ELBOW_COUNTS, ownSpans, tubeElbows, tubeSpan } from "../tubeFold";
import { throttledProgress } from "../optimizer/progress";
import {
  passiveRadiatorMassMax,
  ownGuideCfg,
  HIFI_WOOFERS,
  HIFI_TWEETERS,
  HIFI_PASSIVES,
} from "../data";
import type {
  ChangeName,
  ChipId,
  Dims3,
  DimensionLockMode,
  HifiBoxKind,
  HifiChip,
  HifiConfig,
  HifiGoal,
  HifiLockKey,
  HifiMetrics,
  HifiOptimizedField,
  HifiOptimizerCurrent,
  HifiOptimizerInput,
  HifiGridBox,
  HifiOptimizerJob,
  HifiOptimizerJobResult,
  OptimizerProgressCallback,
  HifiScoredBox,
  HifiOptimizerResult,
  HifiPort,
  HifiSystem,
  HifiTweeter,
  HifiWoofer,
  PassiveRadiator,
  PassiveRadiatorChoice,
  PassiveRadiatorHandover,
  RoundPort,
  SlotPort,
} from "../../types";
import { keysOf } from "../records";
import { byId } from "../tables";
import { defaultPanelIn } from "../panel";
import { HIFI_OPTIMIZER_PANEL } from "../../constants/optimizerPanels";
import { PLYWOOD_MATERIAL } from "../../constants/panelSizes";
import { selectCards } from "../optimizer/selectCards";
import { keepGap, outOfReachNotice, type Keep } from "../optimizer/shortfall";
import { goalKeeps } from "../optimizer/goalKeeps";
import {
  CARD_LABELS,
  CARD_WHY,
  CHANGE_NAMES,
  DESIGN_PROBLEM_TEXT,
  GOAL_SHORT_NAMES,
  SHARED_GOAL_NAMES,
} from "../../constants/optimizerText";
import { ampForGain, type AmpSteps } from "../optimizer/ampSteps";

/** A design the search evaluates: the page's config with the wall and the tweeter amp set. */
type SearchConfig = HifiConfig & { wall: number; tAmpW: number };
interface RunResult {
  sys: HifiSystem;
  chips: HifiChip[];
  cfg: SearchConfig;
  tt: HifiTweeter;
}
/** A box on the search grid: its woofer and config (no crossover yet), its volume and radiators, and how many things it changes. */
interface BoxEntry {
  w: HifiWoofer;
  cfg: SearchConfig;
  gross: number;
  pr: PassiveRadiatorChoice | null;
  ch: number;
}
/** A box on the grid: its woofer, its config, a key that names it and its place in the grid's order. */
interface GridEntry extends HifiGridBox {
  w: HifiWoofer;
  cfg: SearchConfig;
  key: string;
  order: HifiScoredBox["order"];
  /** the tuning its port or radiators were sized for (null for a sealed box or your own box) */
  fb: number | null;
}
/** A box at one crossover that passes the box's own checks: the woofer's F3 and level (indices into the box and crossover lists). */
interface Rec {
  bi: number;
  xi: number;
  f3: number;
  /** the woofer's clean level at 1 m at the searched power, and what the amp alone and the driver alone allow */
  wLevel: number;
  ampDb: number;
  drvDb: number;
}
/** A finished design from the second pass: drivers, config, model and score. */
interface PoolEntry {
  w: HifiWoofer;
  t: HifiTweeter;
  c: SearchConfig;
  sys: HifiSystem;
  chips: HifiChip[];
  m: HifiMetrics;
}

// the PA planner's goals, in its order
export const HIFI_OPTIMIZER_GOALS: Record<HifiGoal, { short: string; name: string; why: string }> =
  {
    cheaper: {
      short: GOAL_SHORT_NAMES.cheaper,
      name: "Same level, cheaper",
      why: "Cheapest pair of drivers that keeps the bass and the level.",
    },
    lighter: {
      short: GOAL_SHORT_NAMES.lighter,
      name: "Same level, lighter",
      why: "Lightest box that keeps the bass and the level.",
    },
    lower: {
      short: GOAL_SHORT_NAMES.lower,
      name: SHARED_GOAL_NAMES.lower,
      why: "Lowest in-room F3 that keeps the level.",
    },
    louder: {
      short: GOAL_SHORT_NAMES.louder,
      name: SHARED_GOAL_NAMES.louder,
      why: "Most clean level at the seat.",
    },
  };
export const HIFI_AMP_WATTS_MAX = { wAmpW: 500, tAmpW: 200 };
/** The amps the Hi-fi optimizer searches. */
type HifiAmpKey = keyof typeof HIFI_AMP_WATTS_MAX;
// the amp sliders' steps and minimums: an amp the search turns down stays on a step, never under the minimum
export const HIFI_AMP_WATTS_STEPS: Record<HifiAmpKey, AmpSteps> = {
  wAmpW: { step: 10, min: 10 },
  tAmpW: { step: 5, min: 5 },
};
export const HIFI_OPTIMIZED_FIELDS: readonly HifiOptimizedField[] = [
  "woofer",
  "tweeter",
  "box",
  "dim",
  "port",
  "pr",
  "wall",
  "xo",
  "wAmpW",
  "tAmpW",
];
// every on/off lock the optimizer reads (box sizes are separate: dim)
export const HIFI_LOCK_KEYS: HifiLockKey[] = ["woofer", "tweeter", "box", "xo", "wAmpW", "tAmpW"];

// a card's label must be true against your design by at least this much (PA: $ any, 3 lb, 2 Hz, 1 dB; the boxes are smaller here)
const beats: Record<HifiGoal, (x: HifiMetrics, y: HifiMetrics) => boolean> = {
  cheaper: (x, y) => x.price < y.price,
  lighter: (x, y) => x.lb <= y.lb - 1,
  lower: (x, y) => x.f3 <= y.f3 - 2,
  louder: (x, y) => x.level >= y.level + 1,
};
const obj: Record<HifiGoal, (x: HifiMetrics) => number> = {
  cheaper: (x) => x.price,
  lighter: (x) => x.lb,
  lower: (x) => x.f3,
  louder: (x) => -x.level,
};
// what each goal keeps from your design (as the PA optimizer: same output, F3 within a couple of Hz): the level it has
// to reach and the F3 it can't pass
const keeps = (cur: HifiMetrics): Record<HifiGoal, Keep> => goalKeeps(cur.level, cur.f3);
// (one scratch pair, refilled per call: the search asks this of millions of designs)
const gapPoint: Keep = { db: 0, f3: 0 };
const gapTo = (k: Keep, x: HifiMetrics) => {
  gapPoint.db = x.level;
  gapPoint.f3 = x.f3;
  return keepGap(k, gapPoint);
};
// warnings that rule a design out (the soft ones stay on the card)
const HARD = new Set<ChipId<"hifi">>([
  "hifiTweeterMinXo",
  "hifiTweeterResonance",
  "hifiWooferRange",
  "hifiTweeterLevel",
  "hifiQtc",
]);
/** The checks a design fails: every "bad" one, and the warnings in `HARD`. */
const failedChecks = (chips: HifiChip[]) =>
  chips.filter(([k, , , id]) => k === "bad" || (k === "warn" && HARD.has(id)));
/** What fails in a design, as the checks' titles (empty when it passes). */
export const hifiDesignProblems = (sys: HifiSystem | null, chips: HifiChip[]): string[] =>
  !sys ? [DESIGN_PROBLEM_TEXT.unmodeled] : failedChecks(chips).map(([, h]) => h);

const XOS: number[] = [1500, 1800, 2000, 2200, 2500, 3000];
const range = (lock: DimensionLockMode | undefined, cur: number, vals: number[]) =>
  lock === "exact" ? [cur] : lock === "max" ? vals.filter((v) => v <= cur + 1e-9) : vals;

// port length for a target tuning (bisection; the port's own volume comes out of the box): the shortest that tunes it,
// trying the elbow counts fewest first, each inside the lengths it fits (each elbow's bend correction tunes the port
// higher, so a count may need a longer port than the last one reached, or none)
function portFor(
  w: HifiWoofer,
  dim: Dims3,
  wall: number,
  n: number,
  dia: number,
  Fb: number,
  maxElbows = 2,
): RoundPort | null {
  const g = grossVolumeLiters(dim, wall),
    disp = w.ts.disp != null ? w.ts.disp : Math.max(0.2, Math.pow(w.size / 6.5, 3) * 0.6);
  const A = n * Math.PI * (dia / 2) ** 2,
    fb = (len: number, e: number) =>
      ventTuning(
        Math.max(1, g * 0.97 - disp - (A * len * 16.387) / 1e3),
        A,
        len,
        n,
        hifiRoundEndCorrection({ dia }, e),
      ).Fb;
  const room = hifiTubeRoom(dim, wall);
  // each count over the lengths where it is the one the model takes, a quarter inch past the fewer counts' (the length
  // is cut to the quarter inch, and must stay on the count it was tuned with)
  for (const { e, span } of ownSpans(
    ELBOW_COUNTS.map((k) => tubeSpan(room, dia, k)),
    0.25,
  )) {
    if (e > maxElbows) break;
    const lo = Math.ceil(Math.max(0.5, span[0]) * 4) / 4,
      hi = Math.floor(span[1] * 4) / 4;
    let a = lo,
      b = hi;
    if (b <= a || fb(a, e) < Fb || fb(b, e) > Fb) continue;
    for (let i = 0; i < 20; i++) {
      const m = (a + b) / 2;
      if (fb(m, e) > Fb) a = m;
      else b = m;
    }
    const len = Math.min(hi, Math.max(lo, Math.round(((a + b) / 2) * 4) / 4));
    if (tubeElbows(room, dia, len) === e) return { n, dia, len, elbows: e };
  }
  return null;
}

// slot length for a target tuning (the slot and its shelf come out of the box; the inner end correction depends on the length)
export function slotFor(
  w: HifiWoofer,
  dim: Dims3,
  wall: number,
  h: number,
  Fb: number,
): SlotPort | null {
  const g = grossVolumeLiters(dim, wall),
    disp = w.ts.disp != null ? w.ts.disp : Math.max(0.2, Math.pow(w.size / 6.5, 3) * 0.6);
  const sw = slotWidth(dim, wall),
    A = h * sw;
  let a = 0.5,
    b = slotMaxLength(dim, wall, { h });
  // the inner end correction reads the length (the shelf's run, and the gap behind the mouth), so take it at each length
  // as the planner does; it never falls as fast as the length grows, so the tuning still falls with the length
  const fb = (len: number) =>
    ventTuning(
      Math.max(1, g * 0.97 - disp - ((A + wall * sw) * len * 16.387) / 1e3),
      A,
      len,
      1,
      hifiSlotEndCorrection(dim, wall, { h, w: sw, len }),
    ).Fb;
  if (b <= a || fb(a) < Fb || fb(b) > Fb) return null;
  for (let i = 0; i < 20; i++) {
    const m = (a + b) / 2;
    if (fb(m) > Fb) a = m;
    else b = m;
  }
  const len = Math.floor(((a + b) / 2) * 4) / 4;
  return len >= 0.5 ? { shape: "slot", n: 1, h, len } : null;
}

// passive radiators for a target tuning: the cheapest (pair price) that fit the back, can move 1.5× the
// woofer's air and reach Fb within their added-mass range
function prsFor(
  w: HifiWoofer,
  dim: Dims3,
  wall: number,
  passives: readonly PassiveRadiator[],
  Fb: number,
): PassiveRadiatorChoice[] {
  const net =
    grossVolumeLiters(dim, wall) * 0.97 -
    (w.ts.disp != null ? w.ts.disp : Math.max(0.2, Math.pow(w.size / 6.5, 3) * 0.6));
  const out = [];
  for (const drv of passives)
    for (const n of [1, 2]) {
      if (
        !drv.Xmax ||
        !drv.Cms ||
        n * drv.Sd * drv.Xmax < 1.5 * w.ts.Sd * w.ts.Xmax ||
        !passiveRadiatorFits(dim, wall, { drv, n })
      )
        continue;
      const addG = passiveRadiatorMassFor(drv, n, net, Fb);
      if (addG == null || addG > passiveRadiatorMassMax(drv)) continue;
      out.push({ drv, n, addG });
    }
  return out.sort((a, b) => a.n * a.drv.price - b.n * b.drv.price);
}

// input: { cur: page cfg + { woofer, tweeter } ids, woofers, tweeters, passives, goals, locks: { woofer, tweeter, box, wall, xo, wAmpW, tAmpW,
//          dim: {w,h,d} }, budget (pair, drivers), seatM (listening distance), guidePrice }
/**
 * What the search covers for these inputs: your design resolved (its radiator looked up), the drivers, the amps it
 * searches at, the crossovers and tweeters, and every box on the grid (woofer × size × type × plywood × port or
 * radiator, and your box on each plywood the search allows), not yet modeled. Null when your drivers aren't in the
 * tables.
 */
export function hifiSearchSpace(
  input: HifiOptimizerInput,
  {
    part = 0,
    parts = 1,
    withGrid = true,
  }: { part?: number; parts?: number; withGrid?: boolean } = {},
) {
  const { woofers, tweeters, locks = {} } = input;
  // boundary cast: `pr` may still lack its driver here; the block below looks it up
  const cur = { wall: 0.75, ...(input.cur as HifiOptimizerCurrent) };
  // the page hands over its radiator as { id, n, addG }; the model wants the driver itself. The current design is looked up in
  // the offered list first and then in the full table, so a short list can't change what "your design" is.
  let curPrMissing = cur.box === "radiator" && !cur.pr;
  if (cur.pr && !cur.pr.drv) {
    // boundary cast: a radiator without `drv` is the { id, n, addG } form
    const id = (cur.pr as PassiveRadiatorChoice & PassiveRadiatorHandover).id;
    const drv = byId(input.passives || [], id) ?? byId(HIFI_PASSIVES, id);
    cur.pr = drv ? { ...cur.pr, drv } : undefined;
    curPrMissing = cur.box === "radiator" && !drv; // a sealed or vented design may carry a leftover id
  }
  // your drivers: from the lists the search uses, else from the full tables (a budget or size filter doesn't remove them from your design)
  const W0 = byId(woofers, cur.woofer) ?? byId(HIFI_WOOFERS, cur.woofer),
    T0 = byId(tweeters, cur.tweeter) ?? byId(HIFI_TWEETERS, cur.tweeter);
  if (!W0 || !T0) return { cur, W0, T0, space: null };
  const dl: NonNullable<typeof locks.dim> = locks.dim || {};
  const guide = cur.guide || null,
    gp = input.guidePrice || 0;
  const tweeterCfg = (t: HifiTweeter): HifiTweeter | null =>
    needsWaveguide(t) ? (guide ? { ...t, faceplate: { w: guide.w, h: guide.h } } : null) : t;
  const prPrice = (c: HifiConfig) =>
    c && c.box === "radiator" && c.pr && c.pr.drv ? c.pr.n * (c.pr.drv.price || 0) : 0;
  const priceOf = (w: HifiWoofer, t: HifiTweeter, c: HifiConfig) =>
    2 * ((w.price || 0) + (t.price || 0) + (needsWaveguide(t) ? gp : 0) + prPrice(c)); // a ribbon's own waveguide is in its price
  const guideOf = (t: HifiTweeter) => ownGuideCfg(t) || (needsWaveguide(t) ? guide : null);
  // unlocked amps: searched at the top of their sliders, trimmed per card at the end
  const amps = {
    wAmpW: locks.wAmpW ? cur.wAmpW : HIFI_AMP_WATTS_MAX.wAmpW,
    tAmpW: locks.tAmpW ? cur.tAmpW : HIFI_AMP_WATTS_MAX.tAmpW,
  };
  const wList: HifiWoofer[] = locks.woofer
    ? [W0]
    : woofers.filter((o) => o.ts && o.ts.Fs && o.ts.Sd);
  const passives = input.passives || [];
  const boxes: HifiBoxKind[] = locks.box
    ? [cur.box]
    : passives.length
      ? ["sealed", "vented", "radiator"]
      : ["sealed", "vented"];
  // the one plywood the search designs in, for now (HIFI_OPTIMIZER_PANEL), at its measured thickness
  const walls = [input.wall ?? defaultPanelIn(HIFI_OPTIMIZER_PANEL, cur.mat ?? PLYWOOD_MATERIAL)];
  const tList: HifiTweeter[] = locks.tweeter
    ? [T0]
    : tweeters.filter((t) => t.hf && t.hf.sens != null && (!needsWaveguide(t) || guide));
  const xos = locks.xo ? [cur.xo] : XOS.includes(cur.xo) ? XOS : [...XOS, cur.xo];
  const face =
    needsWaveguide(T0) && guide ? (guide.freestanding ? { w: 0, h: -1 } : guide) : T0.faceplate;
  // a design's config from its box fields (the rest is yours, at the amps the search uses)
  const cfgOf = (box: HifiGridBox): SearchConfig => ({
    ...cur,
    ...amps,
    box: box.box,
    dim: box.dim,
    wall: box.wall,
    port: box.port || cur.port,
    pr: box.pr || cur.pr,
  });
  const grid: GridEntry[] = [];
  const seen = new Set<string>();
  // the grid's order: woofer by woofer in list order, each woofer's boxes as generated, your box last
  let wi = 0,
    li = 0;
  // a box on the grid (null when it is already there), at its place in the grid's order
  const entry = (
    w: HifiWoofer,
    dim: Dims3,
    box: HifiBoxKind,
    wall: number,
    port: HifiPort | null,
    pr: PassiveRadiatorChoice | null | undefined,
    fb: number | null,
    order: GridEntry["order"],
  ): GridEntry | null => {
    // a port by its own shape's fields (a saved port may carry the other shape's leftovers, or another field order)
    const portKey = !port
      ? ""
      : port.shape === "slot"
        ? `slot ${port.n} ${port.h} ${port.len}`
        : `round ${port.n} ${port.dia} ${port.len}`;
    const key = `${w.id}|${box}|${wall}|${dim.w}|${dim.h}|${dim.d}|${box === "vented" ? portKey : ""}|${box === "radiator" && pr ? `${pr.drv.id}|${pr.n}|${pr.addG}` : ""}`;
    if (seen.has(key)) return null;
    seen.add(key);
    const gb: HifiGridBox = { box, dim, wall, port, pr: pr || null };
    return { ...gb, w, key, order, fb, cfg: cfgOf(gb) };
  };
  const add = (
    w: HifiWoofer,
    dim: Dims3,
    box: HifiBoxKind,
    wall: number,
    port: HifiPort | null,
    pr: PassiveRadiatorChoice | null | undefined,
    fb: number | null = null,
  ) => {
    const e = entry(w, dim, box, wall, port, pr, fb, [wi, li++, 0]);
    if (e) grid.push(e);
  };
  // the same radiator box with the next radiator option at the same tuning, placed right after it in the grid's
  // order: tried when the radiators' travel sets the box's level, so a bigger radiator is in the running (null when
  // there is none; a vented box has its biggest port on the grid already)
  const bigger = (e: GridEntry): GridEntry | null => {
    const { w, dim, wall, fb, pr } = e;
    if (fb == null || e.box !== "radiator" || !pr) return null;
    const options = prsFor(w, dim, wall, passives, fb),
      i = options.findIndex((o) => o.drv.id === pr.drv.id && o.n === pr.n);
    return i >= 0 && i + 1 < options.length
      ? entry(w, dim, "radiator", wall, null, options[i + 1], fb, [
          e.order[0],
          e.order[1],
          e.order[2] + 1,
        ])
      : null;
  };
  // a share of the grid for one worker: every `parts`-th woofer, and your box in part 0
  for (const [i, w] of wList.entries()) {
    if (!withGrid || i % parts !== part) continue;
    wi = i;
    li = 0;
    const minW = Math.max(w.size + 1.5, face.w + 1),
      minH = face.h + w.size + 3;
    const ws = range(
      dl.w,
      cur.dim.w,
      [minW, minW + 1.5, minW + 3].map((v) => Math.ceil(v * 4) / 4),
    );
    const hs = range(
      dl.h,
      cur.dim.h,
      [0, 2, 4, 7, 11, 16, 22].map((v) => Math.ceil((minH + v) * 4) / 4),
    ).filter((h) => h <= 44);
    const ds = range(dl.d, cur.dim.d, [7, 8.5, 10, 11.5, 13, 14.5]);
    for (const bw of ws)
      for (const bh of hs)
        for (const bd of ds)
          for (const box of boxes)
            for (const wall of walls) {
              const dim = { w: bw, h: bh, d: bd };
              if (box === "vented")
                for (const k of [0.8, 1, 1.2]) {
                  const Fb = w.ts.Fs * k;
                  // the smallest round port that fits (the shortest), the largest (the most air before it chuffs) and
                  // the largest slot: a box limited by its port's air speed always has its biggest port in the running
                  const rounds = [1.5, 2, 2.5, 3]
                    .map((dia) => portFor(w, dim, wall, 1, dia, Fb))
                    .filter((o) => o !== null);
                  const slots = [0.75, 1, 1.5]
                    .map((h) => slotFor(w, dim, wall, h, Fb))
                    .filter((o) => o !== null);
                  for (const port of [
                    rounds[0],
                    rounds[rounds.length - 1],
                    slots[slots.length - 1],
                  ])
                    if (port) add(w, dim, box, wall, port, null, Fb);
                }
              else if (box === "radiator")
                for (const k of [0.8, 1, 1.2])
                  for (const pr of prsFor(w, dim, wall, passives, w.ts.Fs * k).slice(0, 1))
                    add(w, dim, box, wall, null, pr, w.ts.Fs * k);
              else add(w, dim, box, wall, null, null);
            }
  }
  // your box as it is: on the other plywood always (the smallest change for Lighter), and on yours when your woofer is
  // in the offered list (a new tweeter or crossover keeps it; a filtered list leaves your woofer out of the search)
  if (withGrid && part === 0 && !curPrMissing) {
    wi = wList.length;
    li = 0;
    for (const wall of walls)
      if (wall !== cur.wall || wList.includes(W0))
        add(W0, cur.dim, cur.box, wall, cur.port, cur.pr);
  }
  return {
    cur,
    W0,
    T0,
    space: {
      curPrMissing,
      guide,
      tweeterCfg,
      guideOf,
      priceOf,
      amps,
      wList,
      tList,
      xos,
      grid,
      cfgOf,
      bigger,
    },
  };
}

/**
 * One share of the box step (a worker's, or all of it): every box in this part of the grid that passes its own checks,
 * modeled once (to 1.5 × the top crossover: the woofer's limits are read that far), with the woofer's F3 and its clean
 * level at each crossover, exactly as the page reads them. Only these numbers come back, not the box's curve.
 * `onProgress` hears the boxes done of this part's grid (the total grows as bigger radiators join the queue).
 */
export function hifiScoreBoxes(
  input: HifiOptimizerInput,
  part = 0,
  parts = 1,
  onProgress?: OptimizerProgressCallback,
): HifiScoredBox[] {
  const report = throttledProgress(onProgress);
  const { cur, W0, T0, space } = hifiSearchSpace(input, { part, parts });
  if (!W0 || !T0 || !space) {
    report(0, 0, true);
    return [];
  }
  const { xos, grid, bigger } = space;
  const top = Math.max(hifiGridTop(0), 1.5 * Math.max(...xos));
  const out: HifiScoredBox[] = [];
  // the grid, and the next radiators of boxes whose radiators set their level, as they come up
  const queue = [...grid];
  for (let qi = 0; qi < queue.length; qi++) {
    report(qi, queue.length);
    const e = queue[qi];
    const { w, cfg, dim, wall, box, pr } = e;
    if (!wooferFitsBaffle(w, dim)) continue;
    if (box === "vented" && hifiPortElbows(dim, wall, hifiVentPort(cfg)) == null) continue;
    if (box === "radiator" && (!pr || !passiveRadiatorFits(dim, wall, pr))) continue;
    const b = hifiBox(w, cfg, top);
    if (!b || (b.sM && !qtcInRange(b.sM.Qtc))) continue;
    const prep = hifiWooferPrep(b, w, cfg);
    let radiatorLimited = false;
    out.push({
      key: e.key,
      order: e.order,
      wId: w.id,
      box: e.box,
      dim,
      wall,
      port: e.port,
      pr: e.pr,
      gross: b.gross,
      ch: changes({ w, t: T0, c: { ...cfg, xo: cur.xo } }, cur).filter(
        (x) => x !== CHANGE_NAMES.ampPower,
      ).length,
      f3: prep.f3,
      levels: xos.map((xo) => {
        if (wooferPastRange(w, xo)) return null;
        const { wLevel, ampDb, drvDb, whoW } = hifiWooferLevel(b, prep, { ...cfg, xo });
        if (whoW === "radiator") radiatorLimited = true;
        return { wLevel, ampDb, drvDb };
      }),
    });
    if (radiatorLimited) {
      const next = bigger(e);
      if (next) queue.push(next);
    }
  }
  report(queue.length, queue.length, true);
  return out;
}

/** The search; `scored` is the box step already done in parts (by workers), else it runs here. */
export function optimizeHifiSpeaker(
  input: HifiOptimizerInput,
  scored?: readonly (readonly HifiScoredBox[])[],
): HifiOptimizerResult {
  const t0 = Date.now();
  const { locks = {} } = input;
  const goals = (input.goals || []).filter(
    (g, i, a) => HIFI_OPTIMIZER_GOALS[g] && a.indexOf(g) === i,
  );
  if (!goals.length) return { cards: [], goals, curProblems: [], stats: { evaluated: 0, ms: 0 } };
  const goal = goals[0],
    also = goals.slice(1);
  const seat = input.seatM || 2.5,
    levelOf = (sys: HifiSystem) => sys.maxLevel - 20 * Math.log10(seat) + 3;
  const { cur, W0, T0, space } = hifiSearchSpace(input, { withGrid: false });
  if (!W0 || !T0 || !space)
    return {
      goals,
      cards: [],
      cur: null,
      curProblems: [W0 ? DESIGN_PROBLEM_TEXT.missingTweeter : DESIGN_PROBLEM_TEXT.missingWoofer],
      curCurve: null,
      goalMissing: null,
      stats: { evaluated: 0, ms: Date.now() - t0 },
    };
  const { curPrMissing, tweeterCfg, guideOf, priceOf, amps, wList, tList, xos, cfgOf } = space;
  let evals = 0;
  const run = (w: HifiWoofer, t: HifiTweeter, c: SearchConfig): RunResult | null => {
    evals++;
    const tt = tweeterCfg(t);
    if (!tt) return null;
    const cc = { ...c, guide: guideOf(t) };
    const sys = hifiSystem(w, tt, cc);
    return sys && { sys, chips: hifiChips(sys, w, tt, cc), cfg: cc, tt };
  };
  const metricOf = (
    r: Pick<RunResult, "sys" | "cfg">,
    w: HifiWoofer,
    t: HifiTweeter,
  ): HifiMetrics => ({
    gross: r.sys.gross,
    f3: r.sys.f3,
    price: priceOf(w, t, r.cfg),
    level: levelOf(r.sys),
    lb: r.sys.lb,
  });

  // a radiator box whose radiator isn't in any table has no model: say so instead of scoring it as if it had none
  const curR = curPrMissing ? null : run(W0, T0, cur);
  const curM = curR && metricOf(curR, W0, T0);
  const curProblems = curR
    ? hifiDesignProblems(curR.sys, curR.chips)
    : [curPrMissing ? DESIGN_PROBLEM_TEXT.missingRadiator : DESIGN_PROBLEM_TEXT.unmodeled];
  const curFails = curProblems.length > 0;

  // 1. the box step (here or in parts), merged in the grid's order (so a split run picks exactly what one run does),
  //    each box once
  const parts = scored ?? [hifiScoreBoxes(input)];
  const merged = parts
    .flat()
    .sort((a, b) => a.order[0] - b.order[0] || a.order[1] - b.order[1] || a.order[2] - b.order[2]);
  const byWoofer = new Map([...wList, W0].map((w) => [w.id, w]));
  const boxList: BoxEntry[] = [];
  const recs: Rec[] = [];
  const taken = new Set<string>();
  for (const x of merged) {
    const w = byWoofer.get(x.wId);
    if (!w || taken.has(x.key)) continue;
    taken.add(x.key);
    const bi = boxList.length;
    boxList.push({
      w,
      cfg: cfgOf(x),
      gross: x.gross,
      pr: x.box === "radiator" ? x.pr : null,
      ch: x.ch,
    });
    x.levels.forEach((l, xi) => {
      if (l) recs.push({ bi, xi, f3: x.f3, ...l });
    });
  }

  // 2. the tweeters' own checks per crossover: its limits and its clean level
  const tws = tList.flatMap((t) => {
    const tt = tweeterCfg(t);
    if (!tt) return [];
    const g = guideOf(t);
    return [
      {
        t,
        tt,
        onTop: !!(g && g.freestanding),
        xoOk: xos.map((xo) => !belowTweeterMinXo(tt, g, xo) && !nearTweeterResonance(tt, xo)),
        tLevel: xos.map(
          (xo) => tweeterMaxLevel(tt, { xo, tAmpW: amps.tAmpW, guideGain: cur.guideGain }).tLevel,
        ),
      },
    ];
  });
  // what the cards hold a design to: what the goals keep, and the axes the alternatives come from
  const K = curM ? keeps(curM) : null;
  const meets = (m: HifiMetrics) => !K || goals.every((g) => gapTo(K[g], m) === 0);
  // stacked goals: each goal alone first; a single goal's own axis is the first card
  const altAxes = [...(also.length ? goals : []), ...keysOf(obj)].filter(
    (g, i, a) => a.indexOf(g) === i && (also.length || g !== goal),
  );
  // a design that can be a card: every one while your design fails (the fix and the closest are drawn from all), else
  // one that keeps the goals and beats yours on all of them (the first card, the smallest change) or keeps an
  // alternative's goal and beats yours on its axis (that alternative); the rest never reach the card selection
  const canBeCard = (m: HifiMetrics) =>
    curFails ||
    !curM ||
    (meets(m) && goals.every((g) => beats[g](m, curM))) ||
    altAxes.some((g) => (!K || gapTo(K[g], m) === 0) && beats[g](m, curM));
  // two scratch metric records, refilled per call (the card selection compares at most two designs at once)
  const va: HifiMetrics = { gross: 0, f3: 0, price: 0, level: 0, lb: 0 },
    vb: HifiMetrics = { gross: 0, f3: 0, price: 0, level: 0, lb: 0 };
  // every design that passes and can be a card: a box at a crossover with a tweeter, its woofer amp and level (index
  // arrays; metrics read through them)
  const dRec: number[] = [],
    dTw: number[] = [],
    dPrice: number[] = [],
    dLb: number[] = [],
    dLevel: number[] = [],
    dWamp: number[] = [];
  const seatDb = 20 * Math.log10(seat) - 3,
    V0 = ampVoltage(amps.wAmpW);
  let lastBi = -1;
  const bPrice: number[] = [],
    bLb: number[] = [],
    bFits: boolean[] = [];
  for (let ri = 0; ri < recs.length; ri++) {
    const r = recs[ri],
      e = boxList[r.bi];
    if (r.bi !== lastBi) {
      lastBi = r.bi;
      for (let ti = 0; ti < tws.length; ti++) {
        const x = tws[ti];
        bPrice[ti] = priceOf(e.w, x.t, e.cfg);
        bLb[ti] = hifiWeightLb(e.w, x.tt, e.cfg, e.pr);
        bFits[ti] = driversFitBaffle(driverLayout(e.w, x.tt, e.cfg.dim, x.onTop), e.w, e.cfg);
      }
    }
    for (let ti = 0; ti < tws.length; ti++) {
      const x = tws[ti];
      if (!bFits[ti] || !x.xoOk[r.xi]) continue;
      if (input.budget && bPrice[ti] > input.budget + 1e-9) continue;
      // the tweeter runs out first at the searched power: with the woofer amp free, the woofer comes down (slider
      // steps) until the tweeter keeps up, so the tweeter caps the level instead of ruling the design out. Below the
      // searched power the woofer's level is the lesser of its amp-limited level (1 dB per dB of power) and what the
      // driver allows (which doesn't move).
      const tLevel = x.tLevel[r.xi];
      let wAmpW = amps.wAmpW,
        wLevel = r.wLevel;
      if (tLevel < wLevel) {
        const w = locks.wAmpW
          ? null
          : ampForGain(amps.wAmpW, tLevel - r.ampDb, HIFI_AMP_WATTS_STEPS.wAmpW);
        if (w === null) continue;
        wAmpW = w;
        wLevel = Math.min(r.ampDb + 20 * Math.log10(ampVoltage(w) / V0), r.drvDb);
        if (tLevel < wLevel) continue;
      }
      // a design that passes has the woofer setting the level
      va.gross = e.gross;
      va.f3 = r.f3;
      va.price = bPrice[ti];
      va.level = wLevel - seatDb;
      va.lb = bLb[ti];
      if (!canBeCard(va)) continue;
      dRec.push(ri);
      dTw.push(ti);
      dPrice.push(va.price);
      dLb.push(va.lb);
      dLevel.push(va.level);
      dWamp.push(wAmpW);
    }
  }
  const metricsAt = (i: number, o: HifiMetrics = va): HifiMetrics => {
    const r = recs[dRec[i]];
    o.gross = boxList[r.bi].gross;
    o.f3 = r.f3;
    o.price = dPrice[i];
    o.level = dLevel[i];
    o.lb = dLb[i];
    return o;
  };
  const pool = dRec.map((_, i) => i);

  const label = also.length
    ? goals.map((g, i) => (i ? g : HIFI_OPTIMIZER_GOALS[g].short)).join(" + ")
    : HIFI_OPTIMIZER_GOALS[goal].name;
  const ALT_WHY: Record<HifiGoal, string> = {
    cheaper: "Costs less than your design.",
    lighter: "Lighter than your design.",
    lower: CARD_WHY.altLower,
    louder: "Louder than your design.",
  };
  const boxOf = (i: number) => boxList[recs[dRec[i]].bi];
  // the cards, re-picked without any design the page's full model turns down (the search reads the same checks off the
  // same model, so this is a guard against rounding at a check's edge, not a second filter)
  const rejected = new Set<number>();
  const pick = () =>
    selectCards<number, HifiGoal>({
      pool: rejected.size ? pool.filter((i) => !rejected.has(i)) : pool,
      goal,
      goals,
      objective: (g, i) => obj[g](metricsAt(i)),
      beatsCurrent: (g, i) => !curM || beats[g](metricsAt(i), curM),
      beats: (g, a, b) => beats[g](metricsAt(a, va), metricsAt(b, vb)),
      meets: (i) => meets(metricsAt(i)),
      shortfall: (i) => (K ? goals.reduce((sum, g) => sum + gapTo(K[g], metricsAt(i)), 0) : 0),
      differs: (i, chosen) => {
        const p = boxOf(i);
        return chosen.every((j) => {
          const k = boxOf(j);
          return (
            k.w !== p.w ||
            dTw[j] !== dTw[i] ||
            k.cfg.box !== p.cfg.box ||
            k.cfg.wall !== p.cfg.wall ||
            Math.abs(p.gross / k.gross - 1) >= 0.15
          );
        });
      },
      // amps are trimmed afterwards
      changeCount: (i) =>
        boxOf(i).ch +
        (tws[dTw[i]].t.id !== cur.tweeter ? 1 : 0) +
        (xos[recs[dRec[i]].xi] !== cur.xo ? 1 : 0),
      currentFails: curFails,
      hasCurrent: !!curM,
      // designs the goal ties on: the cheaper, then the lighter, then the louder
      tieBreak: (a, b) => dPrice[a] - dPrice[b] || dLb[a] - dLb[b] || dLevel[b] - dLevel[a],
      altAxes,
      // an alternative keeps what its own goal keeps
      altFilter: (g, i) => !K || gapTo(K[g], metricsAt(i)) === 0,
      labels: {
        first: { label, why: HIFI_OPTIMIZER_GOALS[goal].why },
        fix: {
          label: CARD_LABELS.fix,
          why: "Yours fails a check; this is the best that passes.",
        },
        // nothing that passes keeps what the goals keep: the one that comes closest (the notice says what it misses)
        closest: {
          label: CARD_LABELS.closest,
          why: CARD_WHY.closest,
        },
        alt: (g) => ({ label: HIFI_OPTIMIZER_GOALS[g].short, why: ALT_WHY[g] }),
      },
    });
  // the chosen designs, modeled whole (as the page models them)
  const model = (i: number) => {
    const e = boxOf(i),
      t = tws[dTw[i]].t,
      r = run(e.w, t, { ...e.cfg, xo: xos[recs[dRec[i]].xi], wAmpW: dWamp[i] });
    return r && !hifiDesignProblems(r.sys, r.chips).length
      ? { w: e.w, t, c: r.cfg, sys: r.sys, chips: r.chips, m: metricOf(r, e.w, t) }
      : null;
  };
  let picked = pick(),
    modeled = picked.cards.map((k) => model(k.p));
  for (let round = 0; round < 5 && modeled.includes(null); round++) {
    picked.cards.forEach((k, j) => {
      if (!modeled[j]) rejected.add(k.p);
    });
    picked = pick();
    modeled = picked.cards.map((k) => model(k.p));
  }
  const cards = picked.cards.flatMap(({ label, why, slot }, j) => {
    const p = modeled[j];
    return p ? [{ ...p, label, why, slot }] : [];
  });

  // trim unlocked amps: the least power (slider steps) that keeps the card's clean level and keeps the tweeter up
  const trim = (p: PoolEntry) => {
    let c = { ...p.c },
      r = { sys: p.sys, chips: p.chips };
    const ok = (rr: RunResult | null, lvl: number): rr is RunResult =>
      rr !== null && !hifiDesignProblems(rr.sys, rr.chips).length && levelOf(rr.sys) >= lvl - 0.01;
    const lowest = (keyName: HifiAmpKey, lvl: number) => {
      const { min: lo, step } = HIFI_AMP_WATTS_STEPS[keyName];
      if (locks[keyName]) return;
      let a = lo,
        b = c[keyName];
      const at = (v: number) => run(p.w, p.t, { ...c, [keyName]: v });
      const ra = at(a);
      if (ok(ra, lvl)) {
        c = { ...c, [keyName]: a };
        r = ra;
        return;
      }
      while (b - a > step) {
        const m = Math.round((a + b) / 2 / step) * step;
        if (m <= a || m >= b) break;
        if (ok(at(m), lvl)) b = m;
        else a = m;
      }
      const rb = at(b);
      if (ok(rb, lvl)) {
        c = { ...c, [keyName]: b };
        r = rb;
      }
    };
    const lvl = levelOf(p.sys);
    lowest("wAmpW", lvl);
    lowest("tAmpW", lvl);
    return { ...p, c, sys: r.sys, chips: r.chips, m: metricOf({ ...r, cfg: c }, p.w, p.t) };
  };
  const done = cards.map((k) => ({ ...k, ...trim(k) }));
  // clean level at the seat, 15 Hz-20 kHz: the woofer through its low-pass plus the tweeter, level-matched to the
  // woofer's passband, through its high-pass (LR pairs sum in phase), at the woofer's music limit
  const curveOf = (sys: HifiSystem): [number, number][] => {
    const xo = sys.xo,
      order = sys.order,
      last = sys.woofer[sys.woofer.length - 1];
    const at = (f: number) =>
      sys.woofer.reduce((b, o) =>
        Math.abs(Math.log(o.f / f)) < Math.abs(Math.log(b.f / f)) ? o : b,
      );
    const tw = Math.pow(10, sys.ref / 20),
      sc = 20 * Math.log10(sys.sMusic) - 20 * Math.log10(seat) + 3;
    return logSpacedFrequencies(15, 20000, 90).map((f) => {
      const raw = f > last.f ? last.raw : at(f).raw,
        lp = linkwitzRileyFilter(f, xo, order, "lp"),
        hp = linkwitzRileyFilter(f, xo, order, "hp");
      const p = Math.hypot(lp.re, lp.im) * Math.pow(10, raw / 20) + Math.hypot(hp.re, hp.im) * tw;
      return [+f.toFixed(1), +(20 * Math.log10(p) + sc).toFixed(2)];
    });
  };
  return {
    goals,
    cur: curM,
    curProblems,
    curCurve: curR ? curveOf(curR.sys) : null,
    goalMissing:
      picked.fixMisses && K && done[0]
        ? outOfReachNotice(
            goals.map((g) => K[g]),
            { db: done[0].m.level, f3: done[0].m.f3 },
            { level: "at the seat", f3: "an in-room F3", both: "level and bass" },
          )
        : picked.goalMissing
          ? `Nothing ${goals.map((g) => g).join(" and ")} than your design passes the checks.`
          : null,
    cards: done.map((k) => ({
      label: k.label,
      why: k.why,
      slot: k.slot,
      woofer: k.w.id,
      tweeter: k.t.id,
      config: {
        woofer: k.w.id,
        tweeter: k.t.id,
        box: k.c.box,
        dim: k.c.dim,
        port: k.c.port,
        pr:
          k.c.box === "radiator" && k.c.pr
            ? { id: k.c.pr.drv.id, n: k.c.pr.n, addG: k.c.pr.addG }
            : undefined,
        wall: k.c.wall,
        xo: k.c.xo,
        wAmpW: k.c.wAmpW,
        tAmpW: k.c.tAmpW,
      },
      metrics: k.m,
      delta: curM
        ? {
            price: k.m.price - curM.price,
            lb: k.m.lb - curM.lb,
            level: k.m.level - curM.level,
            f3: k.m.f3 - curM.f3,
          }
        : null,
      warnings: k.chips.filter(([kind]) => kind === "warn"),
      names: { woofer: k.w.name, tweeter: k.t.name },
      lay: k.sys.lay,
      guided: needsWaveguide(k.t),
      ownGuide: !!k.t.ownGuide,
      changed: changes(k, cur),
      curve: curveOf(k.sys),
      whoW: k.sys.whoW,
    })),
    // designs checked: every box at every crossover with every tweeter (plus the full runs for the cards)
    stats: { evaluated: recs.length * tws.length + evals, ms: Date.now() - t0, pool: pool.length },
  };
}

/**
 * Whether two ports are different designs. Only the fields of the port's own shape count, so a saved design that still
 * carries the other shape's leftovers (`h` on a round port, `dia` on a slot) isn't reported as changed.
 */
export function portsDiffer(a: HifiPort, b: HifiPort): boolean {
  if (a.n !== b.n || a.len !== b.len) return true;
  if (a.shape === "slot") return b.shape !== "slot" || a.h !== b.h;
  return b.shape === "slot" || a.dia !== b.dia;
}

// what a card changes from your design
function changes(p: Pick<PoolEntry, "w" | "t" | "c">, cur: HifiOptimizerCurrent): ChangeName[] {
  const c = p.c,
    out: ChangeName[] = [];
  if (p.w.id !== cur.woofer) out.push(CHANGE_NAMES.woofer);
  if (p.t.id !== cur.tweeter) out.push(CHANGE_NAMES.tweeter);
  if (c.box !== cur.box) out.push(CHANGE_NAMES.boxType);
  if (c.dim.w !== cur.dim.w || c.dim.h !== cur.dim.h || c.dim.d !== cur.dim.d)
    out.push(CHANGE_NAMES.boxSize);
  if (c.box === "vented" && cur.box === "vented" && portsDiffer(c.port, cur.port))
    out.push(CHANGE_NAMES.port);
  if (
    c.box === "radiator" &&
    cur.box === "radiator" &&
    c.pr &&
    cur.pr &&
    (c.pr.drv.id !== cur.pr.drv.id || c.pr.n !== cur.pr.n || c.pr.addG !== cur.pr.addG)
  )
    out.push(CHANGE_NAMES.radiator);
  if (c.wall !== cur.wall) out.push(CHANGE_NAMES.plywood);
  if (c.xo !== cur.xo) out.push(CHANGE_NAMES.crossover);
  if (c.wAmpW !== cur.wAmpW || c.tAmpW !== cur.tAmpW) out.push(CHANGE_NAMES.ampPower);
  return out;
}

/** One job for a worker: a share of the box step (its progress goes to `onProgress`), or the rest of the search on the shares. */
// a share kept by this worker (or the page, without workers) for its run's select job, so it isn't copied out and back
let keptShare: { run: string; scored: HifiScoredBox[] } | null = null;
export function runHifiJob(
  job: HifiOptimizerJob,
  onProgress?: OptimizerProgressCallback,
): HifiOptimizerJobResult {
  if (job.kind === "score") {
    const scored = hifiScoreBoxes(job.input, job.part, job.parts, onProgress);
    if (!job.keep) return { kind: "scored", scored };
    keptShare = { run: job.keep, scored };
    return { kind: "scored", scored: [] };
  }
  const { kept } = job;
  let shares = job.scored;
  if (kept) {
    // the kept share, or (a worker restarted between the jobs) that share scored again here
    const own =
      keptShare && keptShare.run === kept.run
        ? keptShare.scored
        : hifiScoreBoxes(job.input, kept.part, kept.parts);
    shares = [own, ...shares];
    keptShare = null;
  }
  return { kind: "result", result: optimizeHifiSpeaker(job.input, shares) };
}
