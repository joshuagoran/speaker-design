// Hi-fi optimizer: woofer × box × tuning × plywood, then × tweeter × crossover, scored like the page scores them.
// Same rules as the PA optimizer: goals in tap order (the first ranks, the main card must beat your design on
// every one), each card's label true against your design, unlocked amps searched at their slider maximum and
// trimmed to the least power that keeps the card's level, and a card applies only the fields searched.
import {
  hifiSystem,
  hifiBox,
  hifiSystemFromBox,
  hifiGridTop,
  hifiWeightLb,
  tweeterMaxLevel,
  driversFitBaffle,
  driverLayout,
  belowTweeterMinXo,
  nearTweeterResonance,
  type HifiBox,
  hifiChips,
  grossVolumeLiters,
  linkwitzRileyFilter,
  logSpacedFrequencies,
  portMaxLength,
  passiveRadiatorMassFor,
  passiveRadiatorFits,
  hifiSlotEndCorrection,
  slotWidth,
  slotMaxLength,
  needsWaveguide,
} from "./hifi";
import { ventTuning } from "../pa/calc";
import {
  passiveRadiatorMassMax,
  ownGuideCfg,
  HIFI_WOOFERS,
  HIFI_TWEETERS,
  HIFI_PASSIVES,
} from "../data";
import type {
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
import { selectCards } from "../optimizer/selectCards";
import { keepGap, outOfReachNotice, type Keep } from "../optimizer/shortfall";

/** A design the search evaluates: the page's config with the wall and the tweeter amp set. */
type SearchConfig = HifiConfig & { wall: number; tAmpW: number };
interface RunResult {
  sys: HifiSystem;
  chips: HifiChip[];
  cfg: SearchConfig;
  tt: HifiTweeter;
}
/** A box on the search grid: its woofer and config (no crossover yet), its model, and how many things it changes. */
interface BoxEntry {
  w: HifiWoofer;
  cfg: SearchConfig;
  b: HifiBox;
  ch: number;
}
/** A box at one crossover that passes the box's own checks: the woofer's F3 and level (indices into the box and crossover lists). */
interface Rec {
  bi: number;
  xi: number;
  f3: number;
  wLevel: number;
  level: number;
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
      short: "Cheaper",
      name: "Same level, cheaper",
      why: "Cheapest pair of drivers that keeps the bass and the level.",
    },
    lighter: {
      short: "Lighter",
      name: "Same level, lighter",
      why: "Lightest box that keeps the bass and the level.",
    },
    lower: { short: "Lower", name: "Go lower", why: "Lowest in-room F3 that keeps the level." },
    louder: { short: "Louder", name: "Louder", why: "Most clean level at the seat." },
  };
export const HIFI_AMP_WATTS_MAX = { wAmpW: 500, tAmpW: 200 };
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
export const HIFI_LOCK_KEYS: HifiLockKey[] = [
  "woofer",
  "tweeter",
  "box",
  "wall",
  "xo",
  "wAmpW",
  "tAmpW",
];

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
const keeps = (cur: HifiMetrics): Record<HifiGoal, Keep> => ({
  cheaper: { db: cur.level - 0.5, f3: cur.f3 + 2 },
  lighter: { db: cur.level - 0.5, f3: cur.f3 + 2 },
  lower: { db: cur.level - 1.5, f3: Infinity },
  louder: { db: -Infinity, f3: cur.f3 + 3 },
});
const gapTo = (k: Keep, x: HifiMetrics) => keepGap(k, { db: x.level, f3: x.f3 });
// the checks that depend on the tweeter (made per tweeter in the search; every other check is the box's own)
const TWEETER_PROBLEMS = new Set([
  "Drivers won't fit the baffle",
  "Below the tweeter's minimum crossover",
  "Close to the tweeter's resonance",
  "Tweeter runs out first",
]);
// warnings that rule a design out (the soft ones stay on the card)
const HARD = new Set([
  "Below the tweeter's minimum crossover",
  "Close to the tweeter's resonance",
  "Woofer past its usable range",
  "Tweeter runs out first",
]);
export const hifiDesignProblems = (sys: HifiSystem | null, chips: HifiChip[]): string[] =>
  !sys
    ? ["can't be modelled"]
    : chips
        .filter(([k, h]) => k === "bad" || (k === "warn" && (HARD.has(h) || h.startsWith("Qtc"))))
        .map(([, h]) => h);

const XOS: number[] = [1500, 1800, 2000, 2200, 2500, 3000];
const range = (lock: DimensionLockMode | undefined, cur: number, vals: number[]) =>
  lock === "exact" ? [cur] : lock === "max" ? vals.filter((v) => v <= cur + 1e-9) : vals;

// port length for a target tuning (bisection; the port's own volume comes out of the box), with the fewest elbows that fit
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
    fb = (len: number) =>
      ventTuning(Math.max(1, g * 0.97 - disp - (A * len * 16.387) / 1e3), A, len, n).Fb;
  let a = 0.5,
    b = portMaxLength(dim, wall, { dia, elbows: maxElbows });
  if (b <= a || fb(a) < Fb || fb(b) > Fb) return null;
  for (let i = 0; i < 20; i++) {
    const m = (a + b) / 2;
    if (fb(m) > Fb) a = m;
    else b = m;
  }
  const len = Math.round(((a + b) / 2) * 4) / 4;
  const elbows = [0, 1, 2].find(
    (e) => e <= maxElbows && len <= portMaxLength(dim, wall, { dia, elbows: e }) + 1e-9,
  );
  return elbows == null ? null : { n, dia, len, elbows };
}

// slot length for a target tuning (the slot and its shelf come out of the box; the inner end correction depends on the length)
function slotFor(w: HifiWoofer, dim: Dims3, wall: number, h: number, Fb: number): SlotPort | null {
  const g = grossVolumeLiters(dim, wall),
    disp = w.ts.disp != null ? w.ts.disp : Math.max(0.2, Math.pow(w.size / 6.5, 3) * 0.6);
  const sw = slotWidth(dim, wall),
    A = h * sw;
  let a = 0.5,
    b = slotMaxLength(dim, wall, { h });
  // the inner end correction barely changes with the gap behind the slot: take it once, at mid length
  const ec = hifiSlotEndCorrection(dim, wall, { h, w: sw, len: (a + b) / 2 });
  const fb = (len: number) =>
    ventTuning(Math.max(1, g * 0.97 - disp - ((A + wall * sw) * len * 16.387) / 1e3), A, len, 1, ec)
      .Fb;
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
  return out.sort((a, b) => a.n * a.drv.price - b.n * b.drv.price).slice(0, 1);
}

// input: { cur: page cfg + { woofer, tweeter } ids, woofers, tweeters, passives, goals, locks: { woofer, tweeter, box, wall, xo, wAmpW, tAmpW,
//          dim: {w,h,d} }, budget (pair, drivers), seatM (listening distance), guidePrice }
export function optimizeHifiSpeaker(input: HifiOptimizerInput): HifiOptimizerResult {
  const t0 = Date.now();
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
  const goals = (input.goals || []).filter(
    (g, i, a) => HIFI_OPTIMIZER_GOALS[g] && a.indexOf(g) === i,
  );
  if (!goals.length) return { cards: [], goals, curProblems: [], stats: { evaluated: 0, ms: 0 } };
  const goal = goals[0],
    also = goals.slice(1);
  const dl: NonNullable<typeof locks.dim> = locks.dim || {};
  const seat = input.seatM || 2.5,
    levelOf = (sys: HifiSystem) => sys.maxLevel - 20 * Math.log10(seat) + 3;
  // your drivers: from the lists the search uses, else from the full tables (a budget or size filter doesn't remove them from your design)
  const W0 = byId(woofers, cur.woofer) ?? byId(HIFI_WOOFERS, cur.woofer),
    T0 = byId(tweeters, cur.tweeter) ?? byId(HIFI_TWEETERS, cur.tweeter);
  if (!W0 || !T0)
    return {
      goals,
      cards: [],
      cur: null,
      curProblems: [`${W0 ? "tweeter" : "woofer"} isn't in the driver tables`],
      curCurve: null,
      goalMissing: null,
      stats: { evaluated: 0, ms: Date.now() - t0 },
    };
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
    : [curPrMissing ? "the passive radiator isn't in the driver tables" : "can't be modelled"];
  const curFails = curProblems.length > 0;

  // 1. every box on the grid (woofer × size × type × plywood × port or radiator, and your box on each plywood the
  //    search allows), modelled once to the top crossover's grid
  const wList: HifiWoofer[] = locks.woofer
    ? [W0]
    : woofers.filter((o) => o.ts && o.ts.Fs && o.ts.Sd);
  const passives = input.passives || [];
  const boxes: HifiBoxKind[] = locks.box
    ? [cur.box]
    : passives.length
      ? ["sealed", "vented", "radiator"]
      : ["sealed", "vented"];
  const walls = locks.wall ? [cur.wall] : [0.75, 0.5];
  const tList: HifiTweeter[] = locks.tweeter
    ? [T0]
    : tweeters.filter((t) => t.hf && t.hf.sens != null && (!needsWaveguide(t) || guide));
  const xos = locks.xo ? [cur.xo] : XOS.includes(cur.xo) ? XOS : [...XOS, cur.xo];
  const top = hifiGridTop(Math.max(...xos));
  const face =
    needsWaveguide(T0) && guide ? (guide.freestanding ? { w: 0, h: -1 } : guide) : T0.faceplate;
  const boxList: BoxEntry[] = [];
  const seen = new Set<string>();
  const addBox = (
    w: HifiWoofer,
    dim: Dims3,
    box: HifiBoxKind,
    wall: number,
    port: HifiPort | null,
    pr: PassiveRadiatorChoice | null | undefined,
  ) => {
    const key = `${w.id}|${box}|${wall}|${dim.w}|${dim.h}|${dim.d}|${box === "vented" && port ? JSON.stringify(port) : ""}|${box === "radiator" && pr ? `${pr.drv.id}|${pr.n}|${pr.addG}` : ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    const cfg: SearchConfig = {
      ...cur,
      ...amps,
      box,
      dim,
      wall,
      port: port || cur.port,
      pr: pr || cur.pr,
    };
    evals++;
    const b = hifiBox(w, cfg, top);
    if (!b) return;
    const ch = changes({ w, t: T0, c: { ...cfg, xo: cur.xo } }, cur).filter(
      (x) => x !== "amp power",
    ).length;
    boxList.push({ w, cfg, b, ch });
  };
  for (const w of wList) {
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
                  for (const port of [
                    ...[1.5, 2, 2.5, 3]
                      .map((dia) => portFor(w, dim, wall, 1, dia, Fb))
                      .filter(Boolean)
                      .slice(0, 2),
                    ...[0.75, 1, 1.5]
                      .map((h) => slotFor(w, dim, wall, h, Fb))
                      .filter(Boolean)
                      .slice(0, 1),
                  ])
                    addBox(w, dim, box, wall, port, null);
                }
              else if (box === "radiator")
                for (const k of [0.8, 1, 1.2])
                  for (const pr of prsFor(w, dim, wall, passives, w.ts.Fs * k))
                    addBox(w, dim, box, wall, null, pr);
              else addBox(w, dim, box, wall, null, null);
            }
  }
  // your box as it is, on each plywood (the smallest change for Lighter; a new tweeter or crossover keeps it)
  if (curR && wList.includes(W0) && boxes.includes(cur.box))
    for (const wall of walls) addBox(W0, cur.dim, cur.box, wall, cur.port, cur.pr);

  // 2. each crossover on each box: the box's own checks with any tweeter, then each tweeter's checks, exactly as the
  //    page makes them (its level, its crossover limits and the baffle), so every design on the grid is scored
  const tRef = tList.find((t) => tweeterCfg(t));
  const tRefCfg = tRef && tweeterCfg(tRef);
  const recs: Rec[] = [];
  if (tRef && tRefCfg)
    for (let bi = 0; bi < boxList.length; bi++) {
      const e = boxList[bi];
      for (let xi = 0; xi < xos.length; xi++) {
        const c = { ...e.cfg, xo: xos[xi], guide: guideOf(tRef) };
        evals++;
        const sys = hifiSystemFromBox(e.b, e.w, tRefCfg, c, { band: false });
        if (!sys) continue;
        if (
          hifiDesignProblems(sys, hifiChips(sys, e.w, tRefCfg, c)).some(
            (h) => !TWEETER_PROBLEMS.has(h),
          )
        )
          continue;
        recs.push({
          bi,
          xi,
          f3: sys.f3,
          wLevel: sys.wLevel,
          // a design that passes has the woofer setting the level (the tweeter running out first rules it out)
          level: sys.wLevel - 20 * Math.log10(seat) + 3,
        });
      }
    }
  // the tweeters' own checks per crossover: its limits and its clean level
  const tws = tList.flatMap((t) => {
    const tt = tweeterCfg(t);
    if (!tt) return [];
    const g = guideOf(t);
    return [
      {
        t,
        tt,
        onTop: !!(g && g.freestanding),
        xoOk: xos.map((xo) => !belowTweeterMinXo(tt, xo) && !nearTweeterResonance(tt, xo)),
        tLevel: xos.map(
          (xo) => tweeterMaxLevel(tt, { xo, tAmpW: amps.tAmpW, guideGain: cur.guideGain }).tLevel,
        ),
      },
    ];
  });
  // every design that passes: a box at a crossover with a tweeter (index arrays; metrics read through them)
  const dRec: number[] = [],
    dTw: number[] = [],
    dPrice: number[] = [],
    dLb: number[] = [];
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
        bLb[ti] = hifiWeightLb(e.w, x.tt, e.cfg, e.b.pr);
        bFits[ti] = driversFitBaffle(driverLayout(e.w, x.tt, e.cfg.dim, x.onTop), e.w, e.cfg);
      }
    }
    for (let ti = 0; ti < tws.length; ti++) {
      const x = tws[ti];
      if (!bFits[ti] || !x.xoOk[r.xi] || x.tLevel[r.xi] < r.wLevel) continue;
      if (input.budget && bPrice[ti] > input.budget + 1e-9) continue;
      dRec.push(ri);
      dTw.push(ti);
      dPrice.push(bPrice[ti]);
      dLb.push(bLb[ti]);
    }
  }
  const metricsAt = (i: number): HifiMetrics => {
    const r = recs[dRec[i]];
    return {
      gross: boxList[r.bi].b.gross,
      f3: r.f3,
      price: dPrice[i],
      level: r.level,
      lb: dLb[i],
    };
  };
  const pool = dRec.map((_, i) => i);

  const K = curM ? keeps(curM) : null;
  const label = also.length
    ? goals.map((g, i) => (i ? g : HIFI_OPTIMIZER_GOALS[g].short)).join(" + ")
    : HIFI_OPTIMIZER_GOALS[goal].name;
  const ALT_WHY: Record<HifiGoal, string> = {
    cheaper: "Costs less than your design.",
    lighter: "Lighter than your design.",
    lower: "Goes lower than your design.",
    louder: "Louder than your design.",
  };
  const boxOf = (i: number) => boxList[recs[dRec[i]].bi];
  const picked = selectCards<number, HifiGoal>({
    pool,
    goal,
    goals,
    objective: (g, i) => obj[g](metricsAt(i)),
    beatsCurrent: (g, i) => !curM || beats[g](metricsAt(i), curM),
    beats: (g, a, b) => beats[g](metricsAt(a), metricsAt(b)),
    meets: (i) => !K || goals.every((g) => gapTo(K[g], metricsAt(i)) === 0),
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
          Math.abs(p.b.gross / k.b.gross - 1) >= 0.15
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
    tieBreak: (a, b) => dPrice[a] - dPrice[b],
    // stacked goals: each goal alone first; a single goal's own axis is the first card
    altAxes: [...(also.length ? goals : []), ...keysOf(obj)].filter(
      (g, i, a) => a.indexOf(g) === i && (also.length || g !== goal),
    ),
    // an alternative keeps what its own goal keeps
    altFilter: (g, i) => !K || gapTo(K[g], metricsAt(i)) === 0,
    labels: {
      first: { label, why: HIFI_OPTIMIZER_GOALS[goal].why },
      fix: {
        label: "Fixes your design",
        why: "Your design fails a check; this is the best that passes.",
      },
      // nothing that passes keeps what the goals keep: the one that comes closest (the notice says what it misses)
      closest: {
        label: "Fixes your design",
        why: "Passes the checks and comes closest to your goal.",
      },
      alt: (g) => ({ label: HIFI_OPTIMIZER_GOALS[g].short, why: ALT_WHY[g] }),
    },
  });
  // the chosen designs, modelled whole (as the page models them)
  const cards = picked.cards.flatMap(({ p: i, label, why }) => {
    const e = boxOf(i),
      t = tws[dTw[i]].t,
      r = run(e.w, t, { ...e.cfg, xo: xos[recs[dRec[i]].xi] });
    return r
      ? [{ w: e.w, t, c: r.cfg, sys: r.sys, chips: r.chips, m: metricOf(r, e.w, t), label, why }]
      : [];
  });

  // trim unlocked amps: the least power (slider steps) that keeps the card's clean level and keeps the tweeter up
  const trim = (p: PoolEntry) => {
    let c = { ...p.c },
      r = { sys: p.sys, chips: p.chips };
    const ok = (rr: RunResult | null, lvl: number): rr is RunResult =>
      rr !== null && !hifiDesignProblems(rr.sys, rr.chips).length && levelOf(rr.sys) >= lvl - 0.01;
    const lowest = (keyName: "wAmpW" | "tAmpW", lo: number, step: number, lvl: number) => {
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
    lowest("wAmpW", 10, 10, lvl);
    lowest("tAmpW", 5, 5, lvl);
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
      warnings: k.chips.filter(([kind]) => kind === "warn").map(([, h]) => h),
      names: { woofer: k.w.name, tweeter: k.t.name },
      lay: k.sys.lay,
      guided: needsWaveguide(k.t),
      ownGuide: !!k.t.ownGuide,
      changed: changes(k, cur),
      curve: curveOf(k.sys),
      whoW: k.sys.whoW,
    })),
    stats: { evaluated: evals, ms: Date.now() - t0, pool: pool.length },
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
function changes(p: Pick<PoolEntry, "w" | "t" | "c">, cur: HifiOptimizerCurrent): string[] {
  const c = p.c,
    out = [];
  if (p.w.id !== cur.woofer) out.push("woofer");
  if (p.t.id !== cur.tweeter) out.push("tweeter");
  if (c.box !== cur.box) out.push("box type");
  if (c.dim.w !== cur.dim.w || c.dim.h !== cur.dim.h || c.dim.d !== cur.dim.d) out.push("box size");
  if (c.box === "vented" && cur.box === "vented" && portsDiffer(c.port, cur.port)) out.push("port");
  if (
    c.box === "radiator" &&
    cur.box === "radiator" &&
    c.pr &&
    cur.pr &&
    (c.pr.drv.id !== cur.pr.drv.id || c.pr.n !== cur.pr.n || c.pr.addG !== cur.pr.addG)
  )
    out.push("radiator");
  if (c.wall !== cur.wall) out.push("plywood");
  if (c.xo !== cur.xo) out.push("crossover");
  if (c.wAmpW !== cur.wAmpW || c.tAmpW !== cur.tAmpW) out.push("amp power");
  return out;
}
