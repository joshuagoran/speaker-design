// The Stack optimizer (docs/speaker-designer-plan.md, "Design: the Stack optimizer"; #167): a stack design, the goals in
// tap order, a target level at 1 m, a budget, a weight per box, a height and locks in; up to three cards and a near miss
// out. It runs the Speaker optimizer's search on each speaker (./optimizeSpeaker searchSpeaker) and changes what is
// between the boxes: the crossovers, the members' levels (each keeps its passband, so the balance stays) and the set
// delays (aligned). It scores the whole stack, so it can trade between boxes. Never a box added or removed, a pose, a
// chamber kind or a band count.
//
// Search: each speaker's pool from the Speaker search on its crossover now; on each other crossover setting, each pool's
// best designs run again; the pools combined per setting, estimated (the level calibrated on your stack); the finalists
// built on the field steps and run in full (./stackEvaluate); the cards chosen from those designs only (selectCards).
// Nothing changes a design after it is chosen (#75). Pure; runs in a Web Worker (./optimizeStack.worker) or on the main
// thread.
import type {
  BandId,
  ChangeName,
  OptimizerProgressCallback,
  SpeakerGoal,
  SpeakerOptimizerCatalog,
  SpeakerSpec,
  StackDesign,
  StackMember,
  StackNearMiss,
  StackOptimizerCard,
  StackOptimizerDelta,
  StackOptimizerInput,
  StackOptimizerLimits,
  StackOptimizerLocks,
  StackOptimizerMetrics,
  StackOptimizerResult,
} from "../../../types";
import { crossingPairs, memberSpeaker, stackResponse } from "../stackResponse";
import { passbandCenterHz, passbandDb } from "../speakerResponse";
import { stackHeightIn } from "../speakerTotals";
import { selectCards, type SelectedCard } from "../../optimizer/selectCards";
import { keepsFrom, SPEAKER_GOAL_KEEPS } from "../../optimizer/goalKeeps";
import { keepGap, outOfReachNotice, type Keep } from "../../optimizer/shortfall";
import { throttledProgress } from "../../optimizer/progress";
import { keysOf } from "../../records";
import { CARD_LABELS, CARD_WHY, CHANGE_NAMES } from "../../../constants/optimizerText";
import {
  SPEAKER_ALT_TEXT,
  SPEAKER_FIX_WHY,
  SPEAKER_GOAL,
  SPEAKER_NO_GOAL,
  SPEAKER_REACH_WORDS,
} from "../../../constants/speakerOptimizer";
import {
  STACK_GOAL_TEXT,
  STACK_NEAR_MISS_TEXT,
  STACK_PROBLEM_TEXT,
  STACK_UNMODELED,
} from "../../../constants/stackOptimizer";
import { AUTO_DELAY } from "../../../constants/speakerSpec";
import { STACK_STEPS } from "../../../constants/speakerSteps";
import {
  capsOf,
  evaluateSpeaker,
  f3Of,
  maxCurveOf,
  problemsOf,
  type SizeCaps,
  type SpeakerEval,
} from "./evaluate";
import {
  evaluateStack,
  memberRoomDb,
  speakerOf,
  stackProblemsOf,
  type StackEval,
} from "./stackEvaluate";
import { FULL_TRIM_DB, partsKey, searchSpeaker, specKey, totalAmpW } from "./optimizeSpeaker";
import { changesOf, trimAmps } from "./build";
import {
  CROSSOVER_FACTORS,
  SPEAKER_OPTIMIZER_CATALOG,
  crossoverPairs,
  movedFilter,
  onStep,
  type CrossoverPair,
} from "./space";
import { THIN_FACTORS } from "./screen";
import {
  ALT_LEVEL_DB,
  BEATS,
  LOOSEN,
  OBJECTIVE,
  SAME_LEVEL_DB,
  SAME_VOLUME,
  TARGET_STEP_DB,
  altAxesOf,
  checkCards,
  firstCardRole,
  nothingBeatsText,
  type Metric,
} from "./goals";

/** How many finalists each goal sends to the full run (see the plan's search method), and the cap on them all. */
const FINALISTS = { cards: 8, outside: 2, looser: 3, closest: 5, single: 1, cap: 64 } as const;
/** While no first card is found, this many more designs by the estimate are built, up to BATCHES times. */
const BATCH = 12;
const BATCHES = 2;
/** The most crossover settings; past it each pair tries THIN_FACTORS, then the later pairs only yours. */
const SETTINGS_CAP = 9;
/** On each other crossover setting, the most designs of a speaker that run again, and how they are picked. */
const RERUN = { cap: 8, perGoal: 2, closest: 1 } as const;
/** How far a design's estimate may miss a goal's keep and still run again on another setting (the estimate's error). */
const ESTIMATE_SLACK = 0.3;
/** The combine step's most combinations per setting; past it each speaker keeps fewer designs. */
const COMBO_CAP = 20_000;
/** Progress: each speaker's search counts as this many runs, each finalist as FINALIST_RUNS. */
const SEARCH_RUNS = 1000;
const FINALIST_RUNS = 20;

/** A searched speaker: the members that name it (it is searched on the first one's crossover), and its runs. */
interface Unit {
  id: SpeakerSpec["id"];
  speaker: SpeakerSpec;
  members: number[];
  /** your speaker on the first member's crossover */
  start: SpeakerEval;
  /** its crossovers in the box (`changesOf` reads them) */
  pairs: CrossoverPair[];
  /** each band's top amp power and the amp groups the search trims (empty: none) */
  amps: ReadonlyMap<BandId, number>;
  groups: readonly BandId[][];
  /** it stays exactly as it is (`StackOptimizerLocks.keep`) */
  kept: boolean;
}

/** One way to set a speaker on one crossover setting: its run and what the combine step reads of it. */
interface Entry {
  ev: SpeakerEval;
  /** your speaker as it is (its parts, sizes, vents, filters and amps), on any crossover */
  own: boolean;
  /** the speaker's identity, its crossover left out */
  key: string;
  /** its box's identity (what sets the stack's height) */
  boxKey: string;
  changed: ChangeName[];
  ch: number;
  /** its weakest band's music headroom over its passband, dB (−∞: not modeled), and its passband, dB */
  room: number;
  passDb: number;
  /** its lowest band: where its passband is, Hz, and its F3, Hz */
  low: { hz: number; f3: number } | null;
}

/** A crossover setting: each member's crossover under it, and how many crossovers it moves. */
interface Setting {
  crossovers: StackMember["crossover"][];
  moved: number;
}

/** A combination by the estimate: a setting, one entry per unit, its estimated numbers and its key. */
interface Combo {
  setting: number;
  picks: readonly Entry[];
  m: Metric & { boxLb: number };
  key: string;
}

/** A built stack in the pool: its full evaluation, what it changes, and its keys. */
interface PoolEntry {
  ev: StackEval;
  changed: ChangeName[];
  speakers: StackOptimizerCard["speakers"];
  ch: number;
  /** its parts (each speaker's drivers and horns), to tell designs apart */
  parts: string;
  key: string;
}

/** The members' amp power in total, W (a speaker two members name counts twice). */
const stackAmpW = (design: StackDesign) =>
  design.stack.members.reduce((sum, m) => {
    const s = speakerOf(design, m);
    return sum + (s ? totalAmpW(s) : 0);
  }, 0);

/** A stack design's identity: what the search may change in it. */
const stackKey = (design: StackDesign) =>
  JSON.stringify([
    design.speakers.map(specKey),
    design.stack.members.map((m) => [m.crossover, m.levelDb, m.delayMs]),
  ]);

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** A stack's numbers as the goals compare them. */
const metricOf = (ev: StackEval, ch: number): Metric => ({
  price: ev.metrics.price,
  unpriced: ev.unpriced,
  lb: ev.metrics.lb,
  volumeL: ev.metrics.volumeL,
  musicDb: ev.metrics.musicDb ?? -Infinity,
  f3: ev.metrics.f3 ?? Infinity,
  ch,
  w: ev.warnings.length,
  ampW: stackAmpW(ev.design),
});

/** A card's change from your stack. */
function deltaOf(m: StackOptimizerMetrics, cur: StackOptimizerMetrics): StackOptimizerDelta {
  return {
    price: m.price - cur.price,
    lb: m.lb - cur.lb,
    volumeL: m.volumeL - cur.volumeL,
    heightIn: m.heightIn - cur.heightIn,
    musicDb: m.musicDb !== null && cur.musicDb !== null ? m.musicDb - cur.musicDb : null,
    f3: m.f3 !== null && cur.f3 !== null ? m.f3 - cur.f3 : null,
  };
}

/** The empty result (no goal, or nothing to score). */
function emptyResult(
  goals: SpeakerGoal[],
  limits: StackOptimizerLimits,
  start: StackEval,
  problems: string[],
  goalMissing: string,
  t0: number,
): StackOptimizerResult {
  return {
    goals,
    target: limits.targetDb,
    current:
      start.metrics.musicDb !== null
        ? { metrics: start.metrics, problems, maxCurve: maxCurveOf(start.limits) }
        : null,
    cards: [],
    goalMissing,
    nearMiss: null,
    stats: { screened: 0, evaluated: 1, pool: 0, dropped: 0, ms: Date.now() - t0 },
  };
}

/** A speaker run's lowest band: where its passband is, Hz, and its own F3, Hz (∞: none). */
function lowestBand(ev: SpeakerEval): Entry["low"] {
  let low: Entry["low"] = null;
  for (const b of ev.response.bands) {
    const hz = passbandCenterHz(b.curve);
    if (!low || hz < low.hz) low = { hz, f3: f3Of(b.curve) ?? Infinity };
  }
  return low;
}

/**
 * The stack with each unlocked set delay aligned (`stackResponse`'s auto delay, on the field's step); an auto delay stays
 * auto. Where aligning would move a locked delay (every delay moves up together), the delays stay as they are.
 */
function alignedDelays(design: StackDesign, locked: ReadonlySet<number>): StackDesign {
  const { members } = design.stack;
  const free = members.flatMap((m, k) => (m.delayMs !== AUTO_DELAY && !locked.has(k) ? [k] : []));
  if (!free.length) return design;
  const trial = members.map((m, k): StackMember =>
    free.includes(k) ? { ...m, delayMs: AUTO_DELAY } : m,
  );
  const run = stackResponse({ members: trial }, design.speakers);
  const holds = members.every(
    (m, k) =>
      free.includes(k) ||
      m.delayMs === AUTO_DELAY ||
      Math.abs((run.members[k]?.delayMs ?? m.delayMs) - m.delayMs) < 1e-9,
  );
  if (!holds) return design;
  return {
    ...design,
    stack: {
      ...design.stack,
      members: members.map((m, k) => {
        const ms = run.members[k]?.delayMs;
        return free.includes(k) && ms !== undefined
          ? { ...m, delayMs: onStep(ms, STACK_STEPS.delayMs) }
          : m;
      }),
    },
  };
}

/**
 * The crossover settings: every combination of the factors each free crossover between members tries (both its sides
 * move together, on the corner step), yours first. A crossover moves only when neither member's crossover is locked and
 * each side is in one crossover only.
 */
function crossoverSettings(
  members: readonly StackMember[],
  modeled: readonly boolean[],
  locked: ReadonlySet<number>,
): Setting[] {
  const all = crossingPairs(members);
  const count = (side: "lower" | "upper", i: number) => all.filter((p) => p[side] === i).length;
  const free = all.filter(
    (p) =>
      modeled[p.lower] &&
      modeled[p.upper] &&
      members[p.lower].speakerId !== members[p.upper].speakerId &&
      !locked.has(p.lower) &&
      !locked.has(p.upper) &&
      count("lower", p.lower) === 1 &&
      count("upper", p.upper) === 1,
  );
  // the factors each pair tries: all of them while the settings stay under the cap, then the thin ones, then yours
  const lists: (readonly number[])[] = free.map(() => CROSSOVER_FACTORS);
  const product = () => lists.reduce((x, l) => x * l.length, 1);
  for (let i = 0; i < lists.length && product() > SETTINGS_CAP; i++) lists[i] = THIN_FACTORS;
  for (let i = lists.length - 1; i >= 0 && product() > SETTINGS_CAP; i--) lists[i] = [1];
  let combos: number[][] = [[]];
  for (const l of lists) combos = combos.flatMap((c) => l.map((f) => [...c, f]));
  // yours first
  combos.sort((a, b) => Number(a.some((f) => f !== 1)) - Number(b.some((f) => f !== 1)));
  const out: Setting[] = [];
  const seen = new Set<string>();
  for (const factors of combos) {
    const crossovers = members.map((m) => m.crossover);
    let moved = 0;
    factors.forEach((f, i) => {
      const { lower, upper } = free[i];
      const lp = crossovers[lower].lowpass,
        hp = crossovers[upper].highpass;
      if (f === 1 || !lp || !hp) return;
      crossovers[lower] = { ...crossovers[lower], lowpass: movedFilter(lp, f) };
      crossovers[upper] = { ...crossovers[upper], highpass: movedFilter(hp, f) };
      moved++;
    });
    const key = JSON.stringify(crossovers);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ crossovers, moved });
  }
  return out;
}

/**
 * The search. `catalog` names the candidate parts (default: the app catalog); `onProgress` hears how far it has got
 * (each speaker's search, then the runs on the other crossovers and the finalists' builds).
 */
export function optimizeStack(
  design: StackDesign,
  goalsIn: readonly SpeakerGoal[],
  limits: StackOptimizerLimits,
  locks: StackOptimizerLocks = {},
  catalog: SpeakerOptimizerCatalog = SPEAKER_OPTIMIZER_CATALOG,
  onProgress?: OptimizerProgressCallback,
): StackOptimizerResult {
  const t0 = Date.now();
  const goals = goalsIn.filter((g, i, a) => keysOf(SPEAKER_GOAL).includes(g) && a.indexOf(g) === i);
  const start = evaluateStack(design);
  let evaluated = 1,
    screened = 0;
  const { members } = design.stack;

  // the speakers the search changes, each on its first member's crossover
  // By design, not a bug: a speaker that two boxes share is searched once, with the first box's crossover. The full
  // stack run (./stackEvaluate) then checks every box, with its own crossover, before a design can become a card.
  const kept = new Set(locks.keep ?? []);
  const units: Unit[] = [];
  /** each member's unit, by index (−1: its speaker is missing) */
  const unitOf: number[] = [];
  members.forEach((m, k) => {
    const speaker = speakerOf(design, m),
      ev = start.members[k];
    const at = units.findIndex((u) => u.id === m.speakerId);
    if (at >= 0) units[at].members.push(k);
    else if (speaker && ev)
      units.push({
        id: speaker.id,
        speaker,
        members: [k],
        start: ev,
        pairs: crossoverPairs(speaker, locks.speakers?.[speaker.id] ?? {}),
        amps: new Map(),
        groups: [],
        kept: kept.has(speaker.id),
      });
    unitOf.push(units.findIndex((u) => u.id === m.speakerId));
  });
  const caps = new Map<SpeakerSpec["id"], SizeCaps>(
    units.map((u) => [u.id, capsOf(u.start.metrics.sizeIn, locks.speakers?.[u.id]?.size)]),
  );
  const problemText = (ev: StackEval, L: StackOptimizerLimits) =>
    stackProblemsOf(ev, start, L, caps).map((p) => STACK_PROBLEM_TEXT[p]);
  const curProblems = problemText(start, limits);
  if (!goals.length) return emptyResult(goals, limits, start, curProblems, SPEAKER_NO_GOAL, t0);
  if (start.metrics.musicDb === null || !units.length)
    return emptyResult(goals, limits, start, curProblems, STACK_UNMODELED, t0);
  const startMusic = start.metrics.musicDb;
  const goal = goals[0],
    also = goals.slice(1);
  const target = limits.targetDb;
  const report = throttledProgress(onProgress);

  // what each goal keeps, and the goals' gaps
  const curF3 = start.metrics.f3 ?? Infinity;
  const keepsAt = (t: number) => keepsFrom(SPEAKER_GOAL_KEEPS, t, curF3);
  const keep = keepsAt(target);
  const gapOf = (k: Record<SpeakerGoal, Keep>, g: SpeakerGoal, m: Metric) =>
    keepGap(k[g], { db: m.musicDb, f3: m.f3 });
  const gapSum = (k: Record<SpeakerGoal, Keep>, m: Metric) =>
    goals.reduce((sum, g) => sum + gapOf(k, g, m), 0);

  // the level, calibrated on your stack: the stack's passband less each member's headroom (its speaker's weakest band
  // less its level), so the estimate of your stack is its level
  const levelNow = members.map((m) => m.levelDb);
  const rooms = members.flatMap((m, k) => {
    const ev = start.members[k];
    const room = ev && start.response.members[k] ? memberRoomDb(ev, m.levelDb) : null;
    return room === null ? [] : [room];
  });
  const passNow = startMusic - Math.min(...rooms);
  const passStart = members.map((_, k) => {
    const ev = start.members[k];
    return ev ? passbandDb(ev.response.sum) : 0;
  });
  const lockedLevels = new Set(locks.levels ?? []);
  /** the levels hold a balance only between two members or more: a member alone keeps its level */
  const balanced = rooms.length > 1;
  /** member k's level with a speaker whose passband is `passDb`: the balance kept, on the level step */
  const levelFor = (k: number, passDb: number) => {
    const moved = passStart[k] - passDb;
    return lockedLevels.has(k) || !balanced || !Number.isFinite(moved)
      ? levelNow[k]
      : levelNow[k] + onStep(moved, STACK_STEPS.levelDb);
  };
  /** the level a member's speaker needs for the stack to reach `t`, dB at 1 m */
  const needOf = (ev: SpeakerEval, k: number, t = target) => {
    const pass = passbandDb(ev.response.sum);
    return t - passNow + pass + levelFor(k, pass);
  };

  const settings = crossoverSettings(
    members,
    members.map((_, k) => start.members[k] !== null && start.response.members[k] !== null),
    new Set(locks.crossovers ?? []),
  );
  let total = units.length * SEARCH_RUNS + FINALISTS.cap * FINALIST_RUNS;
  let done = 0;

  /**
   * A speaker run as an entry; null when it fails a check against your speaker (the box's weight is the combine step's:
   * the near miss's looser weight reads it).
   */
  const entryOf = (u: Unit, ev: SpeakerEval, own: boolean): Entry | null => {
    if (!own && problemsOf(ev, u.start, { budget: null, maxLb: null }, caps.get(u.id) ?? {}).length)
      return null;
    const { changed, count } = changesOf(ev.spec, u.speaker, u.pairs);
    return {
      ev,
      own,
      key: specKey(ev.spec),
      boxKey: JSON.stringify(ev.spec.cabinet),
      changed,
      ch: count,
      room: memberRoomDb(ev, 0) ?? -Infinity,
      passDb: passbandDb(ev.response.sum),
      low: lowestBand(ev),
    };
  };
  const unique = (list: readonly (Entry | null)[]) => {
    const seen = new Set<string>();
    return list.filter((e): e is Entry => {
      if (!e || seen.has(e.key)) return false;
      seen.add(e.key);
      return true;
    });
  };

  // each speaker's pool: the Speaker search on its crossover now, toward the level it needs
  const base: Entry[][] = units.map((u, ui) => {
    const own = entryOf(u, u.start, true);
    if (u.kept) {
      done += SEARCH_RUNS;
      return unique([own]);
    }
    const k = u.members[0];
    const s = searchSpeaker(
      memberSpeaker(members[k], u.speaker),
      goals,
      { targetDb: needOf(u.start, k), budget: null, maxLb: limits.maxLb },
      locks.speakers?.[u.id] ?? {},
      catalog,
      (p) =>
        report(ui * SEARCH_RUNS + Math.round((SEARCH_RUNS * p.done) / Math.max(1, p.total)), total),
    );
    done += SEARCH_RUNS;
    screened += s.result.stats.screened;
    evaluated += s.result.stats.evaluated;
    u.amps = s.amps;
    u.groups = s.groups;
    return unique([own, ...s.pool.map((ev) => entryOf(u, ev, false))]);
  });

  /** the combination's numbers by the estimate: price, weight and size summed, the level from each member's headroom */
  const heights = new Map<string, number>();
  const designOf = (si: number, picks: readonly Entry[]): StackDesign => ({
    stack: {
      ...design.stack,
      members: members.map((m, k) => {
        const e = unitOf[k] >= 0 ? picks[unitOf[k]] : null;
        return {
          ...m,
          crossover: settings[si].crossovers[k],
          levelDb: e ? levelFor(k, e.passDb) : m.levelDb,
        };
      }),
    },
    speakers: design.speakers.map((s) => {
      const ui = units.findIndex((u) => u.id === s.id);
      const e = ui >= 0 ? picks[ui] : null;
      return !e || e.own ? s : { ...e.ev.spec, input: s.input };
    }),
  });
  /** the stack's height with these speakers, in (exact; only the boxes set it) */
  const heightOf = (picks: readonly Entry[]) => {
    const key = picks.map((e) => e.boxKey).join("#");
    let h = heights.get(key);
    if (h === undefined) {
      const d = designOf(0, picks);
      h = stackHeightIn(d.stack, d.speakers);
      heights.set(key, h);
    }
    return h;
  };
  const estimate = (si: number, picks: readonly Entry[]): Combo["m"] => {
    let price = 0,
      lb = 0,
      volumeL = 0,
      boxLb = 0,
      minRoom = Infinity,
      ch = settings[si].moved;
    let low: Entry["low"] = null;
    for (let k = 0; k < members.length; k++) {
      const ui = unitOf[k];
      if (ui < 0) continue;
      const e = picks[ui];
      price += e.ev.metrics.price;
      lb += e.ev.metrics.lb;
      volumeL += e.ev.metrics.volumeL;
      boxLb = Math.max(boxLb, e.ev.metrics.lb);
      // a speaker the model can't run sets no limit (as in stackLimits)
      if (Number.isFinite(e.room)) minRoom = Math.min(minRoom, e.room - levelFor(k, e.passDb));
      if (e.low && (!low || e.low.hz < low.hz)) low = e.low;
    }
    for (const e of picks) ch += e.ch;
    const unpriced = [
      ...new Set(picks.flatMap((e) => (e.ev.unpriced ? e.ev.unpriced.split("|") : []))),
    ]
      .sort()
      .join("|");
    return {
      price,
      unpriced,
      lb,
      volumeL,
      musicDb: passNow + minRoom,
      f3: low?.f3 ?? Infinity,
      ch,
      w: 0,
      ampW: 0,
      boxLb,
    };
  };
  const inLimits = (
    c: Pick<Combo, "m" | "picks">,
    L: Pick<StackOptimizerLimits, "budget" | "maxLb" | "maxHeightIn">,
  ) =>
    (L.budget === null || c.m.price <= L.budget + 1e-9) &&
    (L.maxLb === null || c.m.boxLb <= L.maxLb + 1e-9) &&
    (L.maxHeightIn === null || heightOf(c.picks) <= L.maxHeightIn + 1e-9);

  // on each other setting: each pool's best designs (by the estimate of the stack with that speaker changed alone) run
  // again on the moved crossover, their amps at the top, then trimmed two ways
  const ownPicks = base.map((list) => list[0]);
  const rerunPicks = base.map((list, ui) => {
    const at = (e: Entry) =>
      estimate(
        0,
        ownPicks.map((o, j) => (j === ui ? e : o)),
      );
    const est = new Map(list.map((e) => [e, at(e)]));
    const m = (e: Entry) => est.get(e) ?? at(e);
    const picked = new Set<Entry>([list[0]]);
    const take = (sorted: Entry[], n: number) => {
      let added = 0;
      for (const e of sorted) {
        if (added >= n || picked.size >= RERUN.cap) break;
        if (!picked.has(e)) {
          picked.add(e);
          added++;
        }
      }
    };
    for (const g of [...goals, ...keysOf(SPEAKER_GOAL).filter((x) => !goals.includes(x))])
      take(
        list
          .filter((e) => gapOf(keep, g, m(e)) <= ESTIMATE_SLACK)
          .sort((a, b) => OBJECTIVE[g](m(a)) - OBJECTIVE[g](m(b))),
        RERUN.perGoal,
      );
    take(
      [...list].sort((a, b) => gapSum(keep, m(a)) - gapSum(keep, m(b))),
      RERUN.closest,
    );
    return [...picked];
  });
  const rerun = (u: Unit, e: Entry, k: number, crossover: StackMember["crossover"]) => {
    const out: (Entry | null)[] = [];
    const spec: SpeakerSpec = { ...e.ev.spec, input: crossover };
    if (e.own) {
      out.push(entryOf(u, evaluateSpeaker(spec), true));
      evaluated++;
    }
    if (u.kept || !u.groups.length) return out;
    const top = evaluateSpeaker({
      ...spec,
      bands: spec.bands.map((b) => ({ ...b, ampW: u.amps.get(b.id) ?? b.ampW })),
    });
    evaluated++;
    const level = top.metrics.musicDb;
    if (level === null) return out;
    out.push(entryOf(u, trimAmps(top, level - FULL_TRIM_DB, u.groups), false));
    evaluated++;
    const need = needOf(top, k);
    if (level > need + FULL_TRIM_DB) {
      out.push(entryOf(u, trimAmps(top, need, u.groups), false));
      evaluated++;
    }
    return out;
  };
  const moves = (si: number, ui: number) =>
    !sameJson(
      settings[si].crossovers[units[ui].members[0]],
      members[units[ui].members[0]].crossover,
    );
  total += settings.reduce(
    (sum, _, si) =>
      sum + units.reduce((n, u, ui) => n + (moves(si, ui) ? rerunPicks[ui].length : 0), 0),
    0,
  );
  const entries: Entry[][][] = settings.map((st, si) =>
    units.map((u, ui) => {
      if (!moves(si, ui)) return base[ui];
      const k = u.members[0];
      return unique(
        rerunPicks[ui].flatMap((e) => {
          report(++done, total);
          return rerun(u, e, k, st.crossovers[k]);
        }),
      );
    }),
  );

  // the combine step: on each setting, every combination of the speakers' entries (fewer per speaker past COMBO_CAP)
  const combos: Combo[] = [];
  entries.forEach((lists0, si) => {
    let lists = lists0;
    const product = () => lists.reduce((x, l) => x * Math.max(1, l.length), 1);
    for (let n = Math.max(...lists.map((l) => l.length)); product() > COMBO_CAP && n > 1; n--)
      lists = lists0.map((l) => l.slice(0, n));
    if (lists.some((l) => !l.length)) return;
    const pick: Entry[] = [];
    const walk = (ui: number) => {
      if (ui === lists.length) {
        const picks = [...pick];
        combos.push({
          setting: si,
          picks,
          m: estimate(si, picks),
          key: `${si}|${picks.map((e) => e.key).join("#")}`,
        });
        return;
      }
      for (const e of lists[ui]) {
        pick[ui] = e;
        walk(ui + 1);
      }
    };
    walk(0);
  });

  const curMetric = metricOf(start, 0);
  const looser: { text: string; set: Partial<StackOptimizerLimits>; L: StackOptimizerLimits }[] = [
    ...(limits.maxLb !== null
      ? [
          {
            text: STACK_NEAR_MISS_TEXT.weight(Math.ceil(limits.maxLb * (1 + LOOSEN))),
            set: { maxLb: Math.ceil(limits.maxLb * (1 + LOOSEN)) },
          },
        ]
      : []),
    ...(limits.budget !== null
      ? [
          {
            text: STACK_NEAR_MISS_TEXT.budget(Math.ceil(limits.budget * LOOSEN)),
            set: { budget: limits.budget + Math.ceil(limits.budget * LOOSEN) },
          },
        ]
      : []),
    ...(limits.maxHeightIn !== null
      ? [
          {
            text: STACK_NEAR_MISS_TEXT.height(Math.ceil(limits.maxHeightIn * (1 + LOOSEN))),
            set: { maxHeightIn: Math.ceil(limits.maxHeightIn * (1 + LOOSEN)) },
          },
        ]
      : []),
    {
      // a whole dB, at least TARGET_STEP_DB under the target (which may be your stack's level, unrounded)
      text: STACK_NEAR_MISS_TEXT.target(Math.floor(target - TARGET_STEP_DB + 1e-9)),
      set: { targetDb: Math.floor(target - TARGET_STEP_DB + 1e-9) },
    },
  ].map((o) => ({ ...o, L: { ...limits, ...o.set } }));

  // the finalists by the estimate
  const finalists = new Map<string, Combo>();
  const add = (list: readonly Combo[], n: number) => {
    for (const c of list.slice(0, n)) if (finalists.size < FINALISTS.cap) finalists.set(c.key, c);
  };
  const ranked = (g: SpeakerGoal, k: Record<SpeakerGoal, Keep>) =>
    combos
      .filter((c) => gapOf(k, g, c.m) === 0)
      .sort((a, b) => OBJECTIVE[g](a.m) - OBJECTIVE[g](b.m));
  const beatsAllEst = (m: Metric) => also.every((g) => BEATS[g](m, curMetric));
  add(
    combos
      .filter((c) => goals.every((g) => gapOf(keep, g, c.m) === 0) && beatsAllEst(c.m))
      .sort((a, b) => OBJECTIVE[goal](a.m) - OBJECTIVE[goal](b.m))
      .filter((c) => inLimits(c, limits)),
    FINALISTS.cards,
  );
  for (const g of [...goals, ...keysOf(SPEAKER_GOAL).filter((x) => !goals.includes(x))]) {
    const r = ranked(g, keep);
    add(
      r.filter((c) => inLimits(c, limits)),
      FINALISTS.cards,
    );
    add(r, FINALISTS.outside);
  }
  for (const o of looser)
    add(
      ranked(goal, keepsAt(o.L.targetDb)).filter((c) => inLimits(c, o.L)),
      FINALISTS.looser,
    );
  add(
    combos.filter((c) => inLimits(c, limits)).sort((a, b) => gapSum(keep, a.m) - gapSum(keep, b.m)),
    FINALISTS.closest,
  );
  // the smallest changes: one speaker changed on your crossovers, or one crossover moved
  const single = combos.filter(
    (c) =>
      c.m.ch <= 1 &&
      (c.setting === 0
        ? c.picks.filter((e, ui) => e !== ownPicks[ui]).length <= 1
        : c.picks.every((e) => e.own)) &&
      inLimits(c, limits) &&
      goals.every((g) => gapOf(keep, g, c.m) === 0),
  );
  for (const [ui] of units.entries())
    add(
      single
        .filter((c) => c.setting === 0 && c.picks[ui] !== ownPicks[ui])
        .sort((a, b) => OBJECTIVE[goal](a.m) - OBJECTIVE[goal](b.m)),
      FINALISTS.single,
    );
  add(
    single
      .filter((c) => c.setting !== 0)
      .sort((a, b) => OBJECTIVE[goal](a.m) - OBJECTIVE[goal](b.m)),
    FINALISTS.single,
  );
  total = done + finalists.size * FINALIST_RUNS;

  // the full runs: each finalist as the page builds it (levels and delays on their steps), the whole stack run
  const lockedDelays = new Set(locks.delays ?? []);
  const pool: PoolEntry[] = [];
  const pooled = new Set<string>();
  const built = new Set<string>();
  const toPool = (ev: StackEval) => {
    const key = stackKey(ev.design);
    if (pooled.has(key)) return;
    pooled.add(key);
    const changed = new Set<ChangeName>();
    let ch = 0;
    const speakers: StackOptimizerCard["speakers"] = [];
    for (const u of units) {
      const now = ev.design.speakers.find((s) => s.id === u.id);
      if (!now) continue;
      const c = changesOf(now, u.speaker, u.pairs);
      ch += c.count;
      for (const n of c.changed) changed.add(n);
      if (c.changed.length) speakers.push({ id: u.id, changed: c.changed });
    }
    ev.design.stack.members.forEach((m, k) => {
      const was = members[k];
      if (!sameJson(m.crossover, was.crossover)) changed.add(CHANGE_NAMES.boxCrossovers);
      if (m.levelDb !== was.levelDb) changed.add(CHANGE_NAMES.boxLevels);
      if (m.delayMs !== was.delayMs) changed.add(CHANGE_NAMES.delays);
    });
    const moved = crossingPairs(ev.design.stack.members).filter(
      (p) => !sameJson(ev.design.stack.members[p.lower].crossover, members[p.lower].crossover),
    ).length;
    pool.push({
      ev,
      changed: [...changed],
      speakers,
      ch: ch + moved,
      parts: ev.design.speakers.map(partsKey).join("#"),
      key,
    });
  };
  const buildAll = (list: readonly Combo[]) => {
    for (const c of list) {
      if (built.has(c.key)) continue;
      built.add(c.key);
      const d = alignedDelays(designOf(c.setting, c.picks), lockedDelays);
      // a member's speaker run is the entry's where it is the same speaker on the same crossover
      const known = d.stack.members.map((m, k) => {
        const e = unitOf[k] >= 0 ? c.picks[unitOf[k]] : null;
        return e && sameJson(e.ev.spec.input, m.crossover) ? e.ev : undefined;
      });
      toPool(evaluateStack(d, known));
      evaluated++;
      done += FINALIST_RUNS;
      report(done, total);
    }
  };
  buildAll([...finalists.values()]);

  // the cards
  const metric = (p: PoolEntry) => metricOf(p.ev, p.ch);
  const startFails = (L: StackOptimizerLimits) => stackProblemsOf(start, start, L, caps).length > 0;
  const passes = (p: PoolEntry, L: StackOptimizerLimits) =>
    stackProblemsOf(p.ev, start, L, caps).length === 0;
  // "Same level, ..." only when the target is your level; else the heading names the target
  const sameLevel = Math.abs(target - startMusic) <= SAME_LEVEL_DB;
  const first = firstCardRole(goals, sameLevel, STACK_GOAL_TEXT);
  const altAxes = altAxesOf(goals);
  const differs = (p: PoolEntry, chosen: readonly PoolEntry[]) =>
    chosen.every(
      (k) =>
        k.parts !== p.parts ||
        Math.abs(p.ev.metrics.volumeL / k.ev.metrics.volumeL - 1) >= SAME_VOLUME,
    );
  const chooseFrom = (L: StackOptimizerLimits) => {
    const k = keepsAt(L.targetDb);
    const ok = pool.filter((p) => passes(p, L));
    const r = selectCards<PoolEntry, SpeakerGoal>({
      pool: ok,
      goal,
      goals,
      objective: (g, p) => OBJECTIVE[g](metric(p)),
      beatsCurrent: (g, p) => BEATS[g](metric(p), curMetric),
      beats: (g, a, b) => BEATS[g](metric(a), metric(b)),
      meets: (p) => goals.every((g) => gapOf(k, g, metric(p)) === 0),
      shortfall: (p) => gapSum(k, metric(p)),
      differs,
      changeCount: (p) => p.ch,
      currentFails: startFails(L),
      hasCurrent: true,
      tieBreak: (a, b) => stackAmpW(a.ev.design) - stackAmpW(b.ev.design),
      altAxes,
      altFilter: (_g, p) => metric(p).musicDb >= L.targetDb - ALT_LEVEL_DB,
      labels: {
        first,
        fix: { label: CARD_LABELS.fix, why: SPEAKER_FIX_WHY[goal] },
        closest: { label: CARD_LABELS.closest, why: CARD_WHY.closest },
        alt: (g) => SPEAKER_ALT_TEXT[g],
      },
    });
    return { ...r, keeps: k };
  };
  let chosen = chooseFrom(limits);
  // no first card yet: more designs by the estimate join the pool, a batch at a time
  for (let b = 0; b < BATCHES && chosen.cards[0]?.slot.kind !== "first"; b++) {
    const next = combos
      .filter(
        (c) =>
          !built.has(c.key) &&
          goals.every((g) => gapOf(keep, g, c.m) === 0) &&
          beatsAllEst(c.m) &&
          inLimits(c, limits),
      )
      .sort((a, b2) => OBJECTIVE[goal](a.m) - OBJECTIVE[goal](b2.m))
      .slice(0, BATCH);
    if (!next.length) break;
    total += next.length * FINALIST_RUNS;
    buildAll(next);
    chosen = chooseFrom(limits);
  }

  // the last check: each card keeps its slot's promises on its own final design (never fails: nothing changed it)
  const checked = checkCards(chosen.cards, {
    meets: (p) => goals.every((g) => gapOf(keep, g, metric(p)) === 0),
    beatsCurrent: (g, p) => BEATS[g](metric(p), curMetric),
    beats: (g, a, b) => BEATS[g](metric(a), metric(b)),
    passes: (p) => passes(p, limits),
    goals,
  });
  const cardOf = (
    k: Pick<SelectedCard<PoolEntry, SpeakerGoal>, "label" | "why" | "slot" | "p">,
  ): StackOptimizerCard => ({
    label: k.label,
    why: k.why,
    slot: k.slot,
    design: k.p.ev.design,
    metrics: k.p.ev.metrics,
    delta: deltaOf(k.p.ev.metrics, start.metrics),
    changed: k.p.changed,
    speakers: k.p.speakers,
    warnings: k.p.ev.warnings,
    maxCurve: maxCurveOf(k.p.ev.limits),
  });
  const cards = checked.kept.map(cardOf);

  // the near miss
  const curKeeps = !startFails(limits) && goals.every((g) => gapOf(keep, g, curMetric) === 0);
  /** a card for the goals themselves: the first, or a fix of your stack */
  const answers = (list: readonly { slot: { kind: string } }[]) =>
    list.some((k) => k.slot.kind === "first" || k.slot.kind === "fix");
  let nearMiss: StackNearMiss | null = null;
  const fixMisses = chosen.fixMisses;
  if ((!answers(cards) && !curKeeps) || fixMisses) {
    const worked = looser.filter((o) => {
      const r = chooseFrom(o.L);
      return answers(r.cards) && !r.fixMisses;
    });
    const ownEntry: PoolEntry = {
      ev: start,
      changed: [],
      speakers: [],
      ch: 0,
      parts: design.speakers.map(partsKey).join("#"),
      key: stackKey(design),
    };
    const problemCount = (p: PoolEntry) => stackProblemsOf(p.ev, start, limits, caps).length;
    const nearest = [ownEntry, ...pool].sort(
      (a, b) =>
        problemCount(a) - problemCount(b) ||
        gapSum(keep, metric(a)) - gapSum(keep, metric(b)) ||
        OBJECTIVE[goal](metric(a)) - OBJECTIVE[goal](metric(b)),
    )[0];
    const blocking = problemText(nearest.ev, limits);
    nearMiss = {
      options: worked.map(({ text, set }) => ({ text, set })),
      closest: cardOf({
        p: nearest,
        label: CARD_LABELS.nearMiss,
        why: "",
        slot: { kind: "closest" },
      }),
      closestIsYours: nearest === ownEntry,
      blocking: blocking.length
        ? blocking
        : [
            STACK_NEAR_MISS_TEXT.short(
              (nearest.ev.metrics.musicDb ?? 0).toFixed(1),
              target.toFixed(0),
            ),
          ],
    };
  }
  // nothing beats your stack, and your stack keeps every goal: that is the answer (the near miss covers the rest)
  const nothingBeats = !answers(cards) && curKeeps;
  const goalMissing =
    fixMisses && cards[0]
      ? outOfReachNotice(
          goals.map((g) => chosen.keeps[g]),
          { db: cards[0].metrics.musicDb ?? -Infinity, f3: cards[0].metrics.f3 ?? Infinity },
          SPEAKER_REACH_WORDS,
        )
      : nothingBeats
        ? nothingBeatsText(goals)
        : null;
  report(total, total, true);
  return {
    goals,
    target,
    current: { metrics: start.metrics, problems: curProblems, maxCurve: maxCurveOf(start.limits) },
    cards,
    goalMissing,
    nearMiss,
    stats: {
      screened,
      evaluated,
      pool: pool.length,
      dropped: checked.dropped,
      ms: Date.now() - t0,
    },
  };
}

/** The search on the worker's input: what the Stack page posts (`StackOptimizerInput`). */
export const optimizeStackInput = (
  input: StackOptimizerInput,
  onProgress?: OptimizerProgressCallback,
): StackOptimizerResult =>
  optimizeStack(input.design, input.goals, input.limits, input.locks, input.catalog, onProgress);
