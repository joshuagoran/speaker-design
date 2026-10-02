// Hi-fi optimizer: woofer × box × tuning × plywood, then × tweeter × crossover, scored like the page scores them.
// Same rules as the PA optimizer: goals in tap order (the first ranks, the main card must beat your design on
// every one), each card's label true against your design, unlocked amps searched at their slider maximum and
// trimmed to the least power that keeps the card's level, and a card applies only the fields searched.
import {
  hifiSystem,
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

/** A design the search evaluates: the page's config with the wall and the tweeter amp set. */
type SearchConfig = HifiConfig & { wall: number; tAmpW: number };
interface RunResult {
  sys: HifiSystem;
  chips: HifiChip[];
  cfg: SearchConfig;
  tt: HifiTweeter;
}
/** A box, port and radiator choice from the first pass. */
interface Candidate {
  w: HifiWoofer;
  dim: Dims3;
  box: HifiBoxKind;
  wall: number;
  port: HifiPort | null | undefined;
  pr: PassiveRadiatorChoice | null | undefined;
}
interface Stage1Entry extends Candidate {
  m: HifiMetrics;
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
interface PlannedCard extends PoolEntry {
  label: string;
  why: string;
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
// what each goal keeps from your design (as the PA optimizer: same output, F3 within a couple of Hz)
const keeps = (cur: HifiMetrics): Record<HifiGoal, (x: HifiMetrics) => boolean> => ({
  cheaper: (x) => x.level >= cur.level - 0.5 && x.f3 <= cur.f3 + 2,
  lighter: (x) => x.level >= cur.level - 0.5 && x.f3 <= cur.f3 + 2,
  lower: (x) => x.level >= cur.level - 1.5,
  louder: (x) => x.f3 <= cur.f3 + 3,
});
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
  const run = (w: HifiWoofer, t: HifiTweeter, c: SearchConfig, N: number): RunResult | null => {
    evals++;
    const tt = tweeterCfg(t);
    if (!tt) return null;
    const cc = { ...c, guide: guideOf(t), N };
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
  const curR = curPrMissing ? null : run(W0, T0, cur, 240);
  const curM = curR && metricOf(curR, W0, T0);
  const curProblems = curR
    ? hifiDesignProblems(curR.sys, curR.chips)
    : [curPrMissing ? "the passive radiator isn't in the driver tables" : "can't be modelled"];
  const curFails = curProblems.length > 0;

  // 1. woofer, box, tuning and plywood (current tweeter and crossover, coarse model)
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
  const face =
    needsWaveguide(T0) && guide ? (guide.freestanding ? { w: 0, h: -1 } : guide) : T0.faceplate;
  const stage1: Stage1Entry[] = [];
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
              const ports =
                box === "vented"
                  ? [0.8, 1, 1.2].flatMap((k) => [
                      ...[1.5, 2, 2.5, 3]
                        .map((dia) => portFor(w, dim, wall, 1, dia, w.ts.Fs * k))
                        .filter(Boolean)
                        .slice(0, 2),
                      ...[0.75, 1, 1.5]
                        .map((h) => slotFor(w, dim, wall, h, w.ts.Fs * k))
                        .filter(Boolean)
                        .slice(0, 1),
                    ])
                  : [null];
              const prs =
                box === "radiator"
                  ? [0.8, 1, 1.2].flatMap((k) => prsFor(w, dim, wall, passives, w.ts.Fs * k))
                  : [null];
              for (const port of ports)
                for (const pr of prs) {
                  if (box === "radiator" && !pr) continue;
                  const r = run(
                    w,
                    T0,
                    { ...cur, ...amps, box, dim, wall, port: port || cur.port, pr: pr || cur.pr },
                    80,
                  );
                  if (!r) continue;
                  if (
                    (box === "vented" && r.sys.whoW === "port") ||
                    (box === "radiator" && r.sys.whoW === "radiator")
                  )
                    continue; // a bigger port or radiator instead
                  if (r.chips.some(([k, h]) => k === "bad" || h.startsWith("Qtc"))) continue;
                  stage1.push({ w, dim, box, wall, port, pr, m: metricOf(r, w, T0) });
                }
            }
  }
  const key = (x: Candidate) =>
    `${x.w.id}|${x.box}|${x.wall}|${x.dim.w}|${x.dim.h}|${x.dim.d}|${x.port && (x.port.shape === "slot" ? `s${x.port.h}` : x.port.dia)}|${x.port && x.port.len}|${x.pr ? `${x.pr.drv.id}${x.pr.n}${x.pr.addG}` : ""}`;
  const keep = new Map<string, Candidate>();
  for (const g of keysOf(obj))
    stage1
      .slice()
      .sort((a, b) => obj[g](a.m) - obj[g](b.m))
      .slice(0, 12)
      .forEach((x) => keep.set(key(x), x));
  for (const w of wList)
    stage1
      .filter((x) => x.w === w)
      .sort((a, b) => a.m.f3 - b.m.f3)
      .slice(0, 2)
      .forEach((x) => keep.set(key(x), x));
  // the current box as it is, on the other plywood (the smallest change for Lighter)
  if (curR && !locks.wall)
    for (const wall of walls)
      if (wall !== cur.wall)
        keep.set("ply", { w: W0, dim: cur.dim, box: cur.box, wall, port: cur.port, pr: cur.pr });

  // 2. tweeter and crossover, exact model
  const tList: HifiTweeter[] = locks.tweeter
    ? [T0]
    : tweeters.filter((t) => t.hf && t.hf.sens != null && (!needsWaveguide(t) || guide));
  const xos = locks.xo ? [cur.xo] : XOS.includes(cur.xo) ? XOS : [...XOS, cur.xo];
  const pool: PoolEntry[] = [];
  for (const x of keep.values())
    for (const t of tList)
      for (const xo of xos) {
        const r = run(
          x.w,
          t,
          {
            ...cur,
            ...amps,
            box: x.box,
            dim: x.dim,
            wall: x.wall,
            port: x.port || cur.port,
            pr: x.pr || cur.pr,
            xo,
          },
          240,
        );
        if (!r || hifiDesignProblems(r.sys, r.chips).length) continue;
        const m = metricOf(r, x.w, t);
        if (input.budget && m.price > input.budget + 1e-9) continue;
        pool.push({ w: x.w, t, c: r.cfg, sys: r.sys, chips: r.chips, m });
      }

  const K = curM ? keeps(curM) : null;
  const meets = (p: PoolEntry) => !K || goals.every((g) => K[g](p.m));
  const trueVsCur = (g: HifiGoal, p: PoolEntry) => !curM || beats[g](p.m, curM);
  const sorted = (list: PoolEntry[], g: HifiGoal) =>
    list.slice().sort((a, b) => obj[g](a.m) - obj[g](b.m) || a.m.price - b.m.price);
  const cards: PlannedCard[] = [];
  const first = sorted(
    pool.filter((p) => meets(p) && goals.every((g) => trueVsCur(g, p))),
    goal,
  )[0];
  const label = also.length
    ? goals.map((g, i) => (i ? g : HIFI_OPTIMIZER_GOALS[g].short)).join(" + ")
    : HIFI_OPTIMIZER_GOALS[goal].name;
  if (first) cards.push({ ...first, label, why: HIFI_OPTIMIZER_GOALS[goal].why });
  else if (curFails) {
    const fix = sorted(pool.filter(meets), goal)[0] || sorted(pool, goal)[0];
    if (fix)
      cards.push({
        ...fix,
        label: "Fixes your design",
        why: "Your design fails a check; this is the best that passes.",
      });
  }
  const differs = (p: PoolEntry) =>
    cards.every(
      (k) =>
        k.w !== p.w ||
        k.t !== p.t ||
        k.c.box !== p.c.box ||
        k.c.wall !== p.c.wall ||
        Math.abs(p.m.gross / k.m.gross - 1) >= 0.15,
    );
  // the smallest change that already beats your design on the goals (e.g. the same box on 1/2" ply)
  if (curM) {
    const chg = (p: PoolEntry) => changes(p, cur).filter((x) => x !== "amp power").length; // amps are trimmed afterwards
    const small = sorted(
      pool.filter(
        (p) => chg(p) <= 1 && differs(p) && meets(p) && goals.every((g) => trueVsCur(g, p)),
      ),
      goal,
    )[0];
    if (small)
      cards.push({
        ...small,
        label: "Smallest change",
        why: "Changes one thing from your design.",
      });
  }
  for (const g of [...(also.length ? goals : []), ...keysOf(obj)].filter(
    (g, i, a) => a.indexOf(g) === i,
  )) {
    if (cards.length >= 3) break;
    if (!also.length && g === goal) continue;
    // an alternative keeps what its own goal keeps, beats your design and the first card on its own axis
    const q = sorted(
      pool.filter(
        (p) =>
          differs(p) && (!K || K[g](p.m)) && trueVsCur(g, p) && (!first || beats[g](p.m, first.m)),
      ),
      g,
    )[0];
    if (q)
      cards.push({
        ...q,
        label: HIFI_OPTIMIZER_GOALS[g].short,
        why: {
          cheaper: "Costs less than your design.",
          lighter: "Lighter than your design.",
          lower: "Goes lower than your design.",
          louder: "Louder than your design.",
        }[g],
      });
  }

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
      const at = (v: number) => run(p.w, p.t, { ...c, [keyName]: v }, 240);
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
      !first && !curFails
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
