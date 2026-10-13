// The Speaker optimizer (docs/speaker-designer-plan.md, "Design: the Speaker optimizer"): any speaker spec, the goals
// in tap order, a target level at 1 m, a budget, a weight and size per axis, and locks in; up to three cards and a near
// miss out. It changes only the unlocked parts and sizes: drivers of the same kind and size, chamber sizes, vents,
// crossovers in the box, amps. Never the chamber kind, the band count or the input range.
//
// Search: each unit screened alone on a coarse grid of the page's model (./screen); the units' options combined with
// the box shapes, estimated (calibrated on your design); the finalists built on the page's field steps and run in full
// (./build, ./evaluate), their amps trimmed two ways; the cards chosen from those designs only (selectCards). Nothing
// changes a design after it is chosen, so a card's label, slot and notes are its final design's (#75). Pure; runs in a
// Web Worker (./optimize.worker) or on the main thread.
import type {
  BandId,
  ChangeName,
  OptimizerProgressCallback,
  SpeakerGoal,
  SpeakerNearMiss,
  SpeakerOptimizerCard,
  SpeakerOptimizerCatalog,
  SpeakerOptimizerInput,
  SpeakerOptimizerLimits,
  SpeakerOptimizerLocks,
  SpeakerOptimizerMetrics,
  SpeakerOptimizerResult,
  SpeakerSpec,
} from "../../../types";
import { passbandCenterHz } from "../speakerResponse";
import { selectCards, type SelectedCard } from "../../optimizer/selectCards";
import { keepsFrom, SPEAKER_GOAL_KEEPS } from "../../optimizer/goalKeeps";
import { keepGap, outOfReachNotice, type Keep } from "../../optimizer/shortfall";
import { throttledProgress } from "../../optimizer/progress";
import { keysOf } from "../../records";
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
  type Metric,
} from "./goals";
import { CARD_LABELS, CARD_WHY } from "../../../constants/optimizerText";
import {
  SPEAKER_ALT_TEXT,
  SPEAKER_FIX_WHY,
  SPEAKER_GOAL,
  SPEAKER_GOAL_MISSING,
  SPEAKER_GOAL_TEXT,
  SPEAKER_GOAL_THAN,
  SPEAKER_NEAR_MISS_TEXT,
  SPEAKER_NO_GOAL,
  SPEAKER_PROBLEM_TEXT,
  SPEAKER_REACH_WORDS,
  SPEAKER_UNMODELED,
} from "../../../constants/speakerOptimizer";
import {
  evaluateSpeaker,
  maxCurveOf,
  problemsOf,
  withAmps,
  SIZE_SLACK_IN,
  type SizeCaps,
  type SpeakerEval,
} from "./evaluate";
import {
  SPEAKER_OPTIMIZER_CATALOG,
  ampGroups,
  crossoverPairs,
  searchUnits,
  shapeCandidates,
  shapeEstimate,
  shapeFor,
  sizeModel,
  topAmps,
  unitBands,
  volumeLadder,
  type BoxShape,
  type SizeModel,
} from "./space";
import { screenAll, screenRuns, type UnitOption } from "./screen";
import { buildChoice, changesOf, trimAmps, type BuildInput, type Choice } from "./build";

/** The volume steps a sized chamber tries. */
const VOLUME_STEPS = 7;
/** How many finalists each goal sends to the full run (see the plan's search method), and the cap on them all. */
const FINALISTS = { cards: 8, outside: 2, looser: 3, closest: 5, single: 1, cap: 48 } as const;
/** While no first card is found, this many more designs by the estimate are built, up to BATCHES times. */
const BATCH = 12;
const BATCHES = 2;
/** How far an option's estimate may miss a goal's keep and still be kept for the combine step (the screen's error). */
const SCREEN_SLACK = 0.3;
/** The options closest to every goal each unit keeps besides (for the near miss). */
const CLOSEST_PER_UNIT = 2;
/** The combine step's most combinations; past it each unit keeps fewer options. */
const COMBO_CAP = 40_000;
/** How much the full trim leaves under the level the top power reaches, dB (the trim's step). */
const FULL_TRIM_DB = 0.05;
/** A built design in the pool: its full evaluation, what it changes, and its key. */
interface PoolEntry {
  ev: SpeakerEval;
  changed: ChangeName[];
  ch: number;
  /** its parts (each driver and horn), to tell designs apart */
  parts: string;
  key: string;
}

/** A combination by the estimate: a choice and its estimated numbers. */
interface Combo {
  choice: Choice;
  m: Metric;
  key: string;
}

const metricOf = (
  ev: Pick<SpeakerEval, "metrics" | "unpriced">,
  ch: number,
  w: number,
  ampW: number,
): Metric => ({
  price: ev.metrics.price,
  unpriced: ev.unpriced,
  lb: ev.metrics.lb,
  volumeL: ev.metrics.volumeL,
  musicDb: ev.metrics.musicDb ?? -Infinity,
  f3: ev.metrics.f3 ?? Infinity,
  ch,
  w,
  ampW,
});

const totalAmpW = (spec: SpeakerSpec) => spec.bands.reduce((sum, b) => sum + b.ampW, 0);

const partsKey = (spec: SpeakerSpec) =>
  spec.cabinet.chambers
    .map((c) => c.drivers.map((d) => `${d.driverId}/${d.horn?.hornId ?? ""}`).join(","))
    .join(";");

/** A design's identity: what the search may change in it. */
const specKey = (spec: SpeakerSpec) =>
  JSON.stringify([
    spec.cabinet.chambers.map((c) => [
      c.at,
      c.dims,
      c.netLiters,
      c.vent,
      c.drivers.map((d) => [d.driverId, d.horn]),
    ]),
    spec.bands.map((b) => [b.highpass, b.lowpass, b.levelDb, b.ampW]),
  ]);

/** The empty result (no goal, or nothing to score). */
function emptyResult(
  goals: SpeakerGoal[],
  limits: SpeakerOptimizerLimits,
  start: SpeakerEval | null,
  problems: string[],
  goalMissing: string,
  t0: number,
): SpeakerOptimizerResult {
  return {
    goals,
    target: limits.targetDb,
    current:
      start && start.metrics.musicDb !== null
        ? { metrics: start.metrics, problems, maxCurve: maxCurveOf(start.limits) }
        : null,
    cards: [],
    goalMissing,
    nearMiss: null,
    stats: { screened: 0, evaluated: start ? 1 : 0, pool: 0, dropped: 0, ms: Date.now() - t0 },
  };
}

/** The box's size caps from the size locks: your size, as a most on a "max" axis and exactly on an "exact" one. */
const capsOf = (
  outer: SpeakerOptimizerMetrics["sizeIn"],
  size: SpeakerOptimizerLocks["size"] = {},
): SizeCaps =>
  Object.fromEntries(
    (["w", "h", "d"] as const).flatMap((k) =>
      size[k] === "max" || size[k] === "exact"
        ? [[k, { in: outer[k], exact: size[k] === "exact" }]]
        : [],
    ),
  );

/**
 * What the search leaves besides its result: your design's run, every design it built and ran in full (on the field
 * steps), each band's top amp power and the amp groups it trims. The Stack optimizer combines these.
 */
export interface SpeakerSearch {
  result: SpeakerOptimizerResult;
  start: SpeakerEval;
  pool: SpeakerEval[];
  amps: ReadonlyMap<BandId, number>;
  groups: readonly BandId[][];
}

/**
 * The search. `catalog` names the candidate parts (default: the app catalog); `onProgress` hears how far it has got
 * (screen runs, then the finalists' builds).
 */
export const optimizeSpeaker = (
  spec: SpeakerSpec,
  goals: readonly SpeakerGoal[],
  limits: SpeakerOptimizerLimits,
  locks: SpeakerOptimizerLocks = {},
  catalog: SpeakerOptimizerCatalog = SPEAKER_OPTIMIZER_CATALOG,
  onProgress?: OptimizerProgressCallback,
): SpeakerOptimizerResult => searchSpeaker(spec, goals, limits, locks, catalog, onProgress).result;

/** The search, with what it leaves besides its result (`SpeakerSearch`). */
export function searchSpeaker(
  spec: SpeakerSpec,
  goalsIn: readonly SpeakerGoal[],
  limits: SpeakerOptimizerLimits,
  locks: SpeakerOptimizerLocks = {},
  catalog: SpeakerOptimizerCatalog = SPEAKER_OPTIMIZER_CATALOG,
  onProgress?: OptimizerProgressCallback,
): SpeakerSearch {
  const t0 = Date.now();
  const goals = goalsIn.filter((g, i, a) => keysOf(SPEAKER_GOAL).includes(g) && a.indexOf(g) === i);
  const start = evaluateSpeaker(spec);
  let evaluated = 1;
  const caps = capsOf(start.metrics.sizeIn, locks.size);
  const problemText = (ev: SpeakerEval, L: Pick<SpeakerOptimizerLimits, "budget" | "maxLb">) =>
    problemsOf(ev, start, L, caps).map((p) => SPEAKER_PROBLEM_TEXT[p]);
  const curProblems = problemText(start, limits);
  const empty = (goalMissing: string): SpeakerSearch => ({
    result: emptyResult(goals, limits, start, curProblems, goalMissing, t0),
    start,
    pool: [],
    amps: new Map(),
    groups: [],
  });
  if (!goals.length) return empty(SPEAKER_NO_GOAL);
  if (start.metrics.musicDb === null) return empty(SPEAKER_UNMODELED);
  const goal = goals[0],
    also = goals.slice(1);
  const target = limits.targetDb;
  const report = throttledProgress(onProgress);

  // the space
  const units = searchUnits(spec, locks, catalog);
  const pairs = crossoverPairs(spec, locks);
  const groups = ampGroups(spec.bands, locks);
  const amps = topAmps(spec, units, groups);
  const model: SizeModel = sizeModel(spec, units, start.metrics.sizeIn, locks.size);
  const ladder = volumeLadder(model, VOLUME_STEPS);
  const lowest =
    start.response.bands.reduce<{ id: BandId; hz: number } | null>((low, b) => {
      const hz = passbandCenterHz(b.curve);
      return !low || hz < low.hz ? { id: b.id, hz } : low;
    }, null)?.id ?? null;
  const topSpec: SpeakerSpec = {
    ...spec,
    bands: spec.bands.map((b) => ({ ...b, ampW: amps.get(b.id) ?? b.ampW })),
  };
  const startTop = withAmps(start, topSpec);
  evaluated++;

  // what each goal keeps, and the goals' gaps
  const curF3 = start.metrics.f3 ?? Infinity;
  const keepsAt = (t: number) => keepsFrom(SPEAKER_GOAL_KEEPS, t, curF3);
  const keep = keepsAt(target);
  const gapOf = (k: Record<SpeakerGoal, Keep>, g: SpeakerGoal, m: Metric) =>
    keepGap(k[g], { db: m.musicDb, f3: m.f3 });
  const gapSum = (k: Record<SpeakerGoal, Keep>, m: Metric) =>
    goals.reduce((sum, g) => sum + gapOf(k, g, m), 0);

  // the estimate, calibrated on your design at the top amps: each band's headroom moves by what its unit's option
  // changes in the screen, the price and the weight by the parts' and the wood's change
  const roomTop = new Map(
    startTop.limits.bands.map((b) => [
      b.id,
      b.musicDb - (startTop.response.bands.find((r) => r.id === b.id)?.passbandDb ?? 0),
    ]),
  );
  const levelTop = startTop.metrics.musicDb ?? -Infinity;
  const minRoomTop = Math.min(...roomTop.values());
  const woodLb = start.build.chambers.reduce((sum, c) => sum + c.lb.wood, 0);
  const lowestUnit = units.findIndex((u) => lowest !== null && unitBands(u).includes(lowest));
  const f3Start = start.metrics.f3 ?? Infinity;
  /** the level and F3 with these options (each with its unit's own as the reference) */
  const soundOf = (picks: readonly (readonly [UnitOption, UnitOption])[]) => {
    let minRoom = Infinity;
    for (const [b, r] of roomTop) {
      let room = r;
      for (const [o, mine] of picks) {
        const x = o.room.get(b),
          y = mine.room.get(b);
        if (x !== undefined && y !== undefined) room = r + x - y;
      }
      minRoom = Math.min(minRoom, room);
    }
    const low = picks.find(([o]) => o.unit === lowestUnit);
    const f3 =
      low && low[0].f3 !== null && low[1].f3 !== null && low[1].f3 > 0
        ? (f3Start * low[0].f3) / low[1].f3
        : f3Start;
    return { musicDb: levelTop + minRoom - minRoomTop, f3 };
  };
  /** what an option changes from its unit's own: its part, its vent, its volume */
  const changesIn = (o: UnitOption, mine: UnitOption) =>
    (o.driverId !== mine.driverId || o.hornId !== mine.hornId ? 1 : 0) +
    (o.port !== null || o.addG !== null ? 1 : 0);
  /** a chamber's share of the wood and of the box's clear volume */
  const clearAll = model.clearIn3.reduce((sum, x) => sum + x, 0);
  /** the speaker with one unit's option alone, the box grown or shrunk by its volume */
  const singleEstimate = (o: UnitOption, mine: UnitOption): Metric => {
    const u = units[o.unit];
    const k = u.chamber;
    const wood = start.build.chambers[k]?.lb.wood ?? 0;
    return {
      price: start.metrics.price + o.price - mine.price,
      unpriced: start.unpriced,
      lb: start.metrics.lb + o.lb - mine.lb + wood * (Math.pow(o.v, 2 / 3) - 1),
      volumeL: start.metrics.volumeL * (1 + ((o.v - 1) * model.clearIn3[k]) / clearAll),
      ...soundOf([[o, mine]]),
      ch: changesIn(o, mine) + (Math.abs(o.v - 1) > 1e-9 ? 1 : 0),
      w: 0,
      ampW: 0,
    };
  };
  /** the options a unit keeps: for each goal, the best `perGoal` that keep what it keeps (by the estimate, give or take the screen's error), and the closest */
  const select = (opts: readonly UnitOption[], perGoal: number): UnitOption[] => {
    const mine = opts.find((o) => o.own);
    if (!mine) return [...opts];
    const est = new Map(opts.map((o) => [o, singleEstimate(o, mine)]));
    const at = (o: UnitOption) => est.get(o) ?? singleEstimate(o, mine);
    const picked = new Set<UnitOption>([mine]);
    const take = (list: UnitOption[], n: number) => {
      let added = 0;
      for (const o of list) {
        if (added >= n) break;
        if (!picked.has(o)) {
          picked.add(o);
          added++;
        }
      }
    };
    for (const g of keysOf(SPEAKER_GOAL))
      take(
        opts
          .filter((o) => gapOf(keep, g, at(o)) <= SCREEN_SLACK)
          .sort((a, b) => OBJECTIVE[g](at(a)) - OBJECTIVE[g](at(b))),
        perGoal,
      );
    take(
      [...opts].sort((a, b) => gapSum(keep, at(a)) - gapSum(keep, at(b))),
      CLOSEST_PER_UNIT,
    );
    return [...picked];
  };

  // progress: the screen's runs, then each finalist as this many runs
  const FINALIST_RUNS = 20;
  const screenInput = { spec, start, units, pairs, locks, model, ladder, amps, lowest, select };
  const screenTotal = units.reduce((sum, u) => sum + screenRuns(screenInput, u), 0);
  let total = screenTotal + FINALISTS.cap * FINALIST_RUNS;
  let done = 0;
  let screened = 0;
  const options = screenAll(screenInput, () => {
    screened++;
    report(Math.min(++done, screenTotal), total);
  });
  done = screenTotal;

  // the combine step: every combination of the units' options, with the shapes that hold their volumes
  const own = options.map((list) => list.find((o) => o.own) ?? list[0]);
  const groupOf = (k: number) => model.groups.findIndex((g) => g.chambers.includes(k));
  const shapeCache = new Map<
    string,
    { shape: BoxShape; outer: SpeakerOptimizerMetrics["sizeIn"]; ratio: number }[]
  >();
  const shapesFor = (v: Map<number, number>) => {
    const key = [...v]
      .sort((a, b) => a[0] - b[0])
      .map(([g, x]) => `${g}:${x.toFixed(5)}`)
      .join(",");
    const hit = shapeCache.get(key);
    if (hit) return hit;
    const vals = [...v.values()];
    const vMean = vals.length
      ? Math.exp(vals.reduce((sum, x) => sum + Math.log(x), 0) / vals.length)
      : 1;
    const fits = shapeCandidates(model, vMean).flatMap(([sx, sz]) => {
      const shape = shapeFor(spec, model, v, sx, sz);
      if (!shape) return [];
      const est = shapeEstimate(spec, model, shape);
      // the estimate only bounds the size from above (a part swap can still move an exact axis): the built design's
      // check (problemsOf) holds an exact axis
      const inside = (["w", "h", "d"] as const).every(
        (k) => est.outer[k] <= (caps[k]?.in ?? Infinity) + SIZE_SLACK_IN,
      );
      return inside ? [{ shape, outer: est.outer, ratio: est.surfaceRatio }] : [];
    });
    // the shape nearest yours (the fewest changes), and the lightest
    const off = (x: BoxShape) => Math.abs(Math.log(x.sx)) + Math.abs(Math.log(x.sz));
    const near = [...fits].sort((a, b) => off(a.shape) - off(b.shape))[0];
    const light = [...fits].sort((a, b) => a.ratio - b.ratio)[0];
    const out = [near, light].filter((x, i, arr) => x !== undefined && arr.indexOf(x) === i);
    shapeCache.set(key, out);
    return out;
  };
  // fewer options per unit when the product is too large (each list keeps its own option first)
  let lists = options.map((l, i) => [own[i], ...l.filter((o) => o !== own[i])]);
  const full = lists;
  const product = () => lists.reduce((x, l) => x * Math.max(1, l.length), 1);
  for (let n = Math.max(...lists.map((l) => l.length)); product() > COMBO_CAP && n > 1; n--)
    lists = full.map((l) => l.slice(0, n));
  const volume0 = start.metrics.sizeIn.w * start.metrics.sizeIn.h * start.metrics.sizeIn.d;
  const combos: Combo[] = [];
  const pick: UnitOption[] = [];
  const walk = (ui: number) => {
    if (ui === lists.length) {
      const v = new Map<number, number>();
      for (const [i, o] of pick.entries()) {
        const u = units[i];
        if (u.kind !== "cone" || !u.sized) continue;
        const g = groupOf(u.chamber);
        const was = v.get(g);
        if (was !== undefined && Math.abs(was - o.v) > 1e-9) return;
        v.set(g, o.v);
      }
      const sound = soundOf(pick.map((o, i) => [o, own[i]] as const));
      let price = start.metrics.price,
        lb = start.metrics.lb,
        ch = 0;
      for (const [i, o] of pick.entries()) {
        price += o.price - own[i].price;
        lb += o.lb - own[i].lb;
        ch += changesIn(o, own[i]);
      }
      for (const sh of shapesFor(v)) {
        const moved =
          sh.shape.sx !== 1 || sh.shape.sz !== 1 || sh.shape.g.some((g) => Math.abs(g - 1) > 1e-9);
        const m: Metric = {
          price,
          unpriced: start.unpriced,
          lb: lb + woodLb * (sh.ratio - 1),
          volumeL: (start.metrics.volumeL * (sh.outer.w * sh.outer.h * sh.outer.d)) / volume0,
          ...sound,
          ch: ch + (moved ? 1 : 0),
          w: 0,
          ampW: 0,
        };
        const choice = { options: [...pick], shape: sh.shape };
        combos.push({ choice, m, key: comboKey(choice) });
      }
      return;
    }
    for (const o of lists[ui]) {
      pick[ui] = o;
      walk(ui + 1);
    }
  };
  walk(0);

  const curMetric = metricOf(start, 0, start.warnings.length, totalAmpW(spec));
  const inLimits = (m: Metric, L: Pick<SpeakerOptimizerLimits, "budget" | "maxLb">) =>
    (L.budget === null || m.price <= L.budget + 1e-9) &&
    (L.maxLb === null || m.lb <= L.maxLb + 1e-9);
  const looser: {
    text: string;
    set: Partial<SpeakerOptimizerLimits>;
    L: SpeakerOptimizerLimits;
  }[] = [
    ...(limits.maxLb !== null
      ? [
          {
            text: SPEAKER_NEAR_MISS_TEXT.weight(Math.ceil(limits.maxLb * (1 + LOOSEN))),
            set: { maxLb: Math.ceil(limits.maxLb * (1 + LOOSEN)) },
          },
        ]
      : []),
    ...(limits.budget !== null
      ? [
          {
            text: SPEAKER_NEAR_MISS_TEXT.budget(Math.ceil(limits.budget * LOOSEN)),
            set: { budget: limits.budget + Math.ceil(limits.budget * LOOSEN) },
          },
        ]
      : []),
    {
      // a whole dB, at least TARGET_STEP_DB under the target (which may be your design's level, unrounded)
      text: SPEAKER_NEAR_MISS_TEXT.target(Math.floor(target - TARGET_STEP_DB + 1e-9)),
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
  // the first goal's own designs first, then the stacked goals', then every goal for the alternatives
  {
    const firsts = combos
      .filter((c) => goals.every((g) => gapOf(keep, g, c.m) === 0) && beatsAllEst(c.m))
      .sort((a, b) => OBJECTIVE[goal](a.m) - OBJECTIVE[goal](b.m));
    add(
      firsts.filter((c) => inLimits(c.m, limits)),
      FINALISTS.cards,
    );
  }
  for (const g of [...goals, ...keysOf(SPEAKER_GOAL).filter((x) => !goals.includes(x))]) {
    const r = ranked(g, keep);
    add(
      r.filter((c) => inLimits(c.m, limits)),
      FINALISTS.cards,
    );
    add(r, FINALISTS.outside);
  }
  for (const o of looser) {
    const k = keepsAt(o.L.targetDb);
    add(
      ranked(goal, k).filter((c) => inLimits(c.m, o.L)),
      FINALISTS.looser,
    );
  }
  add(
    combos
      .filter((c) => inLimits(c.m, limits))
      .sort((a, b) => gapSum(keep, a.m) - gapSum(keep, b.m)),
    FINALISTS.closest,
  );
  // the smallest changes: one unit changed, the box as it is
  for (const [ui] of units.entries()) {
    const single = combos.filter(
      (c) =>
        c.m.ch <= 1 &&
        c.choice.options.every((o, i) => i === ui || o === own[i]) &&
        inLimits(c.m, limits) &&
        goals.every((g) => gapOf(keep, g, c.m) === 0),
    );
    add(
      [...single].sort((a, b) => OBJECTIVE[goal](a.m) - OBJECTIVE[goal](b.m)),
      FINALISTS.single,
    );
  }
  total = done + finalists.size * FINALIST_RUNS;

  // the full runs: built on the field steps, run, the amps trimmed two ways
  const buildInput: BuildInput = { spec, start, units, pairs, model, amps };
  const pool: PoolEntry[] = [];
  const pooled = new Set<string>();
  const built = new Set<string>();
  const toPool = (ev: SpeakerEval) => {
    const key = specKey(ev.spec);
    if (pooled.has(key)) return;
    pooled.add(key);
    const { changed, count } = changesOf(ev.spec, spec, pairs);
    pool.push({ ev, changed, ch: count, parts: partsKey(ev.spec), key });
  };
  const withTrims = (top: SpeakerEval) => {
    const level = top.metrics.musicDb;
    if (level === null) return toPool(top);
    const full = trimAmps(top, level - FULL_TRIM_DB, groups);
    evaluated++;
    toPool(full);
    if (level > target + FULL_TRIM_DB) {
      toPool(trimAmps(top, target, groups));
      evaluated++;
    }
  };
  const buildAll = (list: readonly Combo[]) => {
    for (const c of list) {
      if (built.has(c.key)) continue;
      built.add(c.key);
      const s = buildChoice(buildInput, c.choice);
      done += FINALIST_RUNS;
      report(done, total);
      if (!s) continue;
      const ev = evaluateSpeaker(s);
      evaluated++;
      withTrims(ev);
    }
  };
  buildAll([...finalists.values()]);
  // your design with only its amps changed
  if (groups.length) withTrims(startTop);

  // the cards
  const metric = (p: PoolEntry) => metricOf(p.ev, p.ch, p.ev.warnings.length, totalAmpW(p.ev.spec));
  const startFails = (L: SpeakerOptimizerLimits) => problemsOf(start, start, L, caps).length > 0;
  const passes = (p: PoolEntry, L: SpeakerOptimizerLimits) =>
    problemsOf(p.ev, start, L, caps).length === 0;
  // "Same level, ..." only when the target is your level; else the heading names the target
  const sameLevel = Math.abs(target - start.metrics.musicDb) <= SAME_LEVEL_DB;
  const first = firstCardRole(goals, sameLevel, SPEAKER_GOAL_TEXT);
  const altAxes = altAxesOf(goals);
  const volumeOf = (p: PoolEntry) => p.ev.metrics.volumeL;
  const differs = (p: PoolEntry, chosen: readonly PoolEntry[]) =>
    chosen.every(
      (k) => k.parts !== p.parts || Math.abs(volumeOf(p) / volumeOf(k) - 1) >= SAME_VOLUME,
    );
  const chooseFrom = (L: SpeakerOptimizerLimits) => {
    const k = keepsAt(L.targetDb);
    const ok = pool.filter((p) => passes(p, L));
    const beatsCurrent = (g: SpeakerGoal, p: PoolEntry) => BEATS[g](metric(p), curMetric);
    const r = selectCards<PoolEntry, SpeakerGoal>({
      pool: ok,
      goal,
      goals,
      objective: (g, p) => OBJECTIVE[g](metric(p)),
      beatsCurrent,
      beats: (g, a, b) => BEATS[g](metric(a), metric(b)),
      meets: (p) => goals.every((g) => gapOf(k, g, metric(p)) === 0),
      shortfall: (p) => gapSum(k, metric(p)),
      differs,
      changeCount: (p) => p.ch,
      currentFails: startFails(L),
      hasCurrent: true,
      tieBreak: (a, b) => totalAmpW(a.ev.spec) - totalAmpW(b.ev.spec),
      altAxes,
      altFilter: (_g, p) => metric(p).musicDb >= L.targetDb - ALT_LEVEL_DB,
      labels: {
        first,
        fix: { label: CARD_LABELS.fix, why: SPEAKER_FIX_WHY[goal] },
        closest: { label: CARD_LABELS.closest, why: CARD_WHY.closest },
        alt: (g) => SPEAKER_ALT_TEXT[g],
      },
    });
    return { ...r, keeps: k, ok };
  };
  let chosen = chooseFrom(limits);
  // no first card yet: more designs by the estimate join the pool, a batch at a time
  for (let b = 0; b < BATCHES && chosen.cards[0]?.slot.kind !== "first"; b++) {
    const next = combos
      .filter(
        (c) =>
          !built.has(c.key) &&
          inLimits(c.m, limits) &&
          goals.every((g) => gapOf(keep, g, c.m) === 0) &&
          beatsAllEst(c.m),
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
  ): SpeakerOptimizerCard => ({
    label: k.label,
    why: k.why,
    slot: k.slot,
    spec: k.p.ev.spec,
    metrics: k.p.ev.metrics,
    delta: deltaOf(k.p.ev.metrics, start.metrics),
    changed: k.p.changed,
    warnings: k.p.ev.warnings,
    maxCurve: maxCurveOf(k.p.ev.limits),
  });
  const cards = checked.kept.map(cardOf);

  // the near miss
  const curKeeps = !startFails(limits) && goals.every((g) => gapOf(keep, g, curMetric) === 0);
  /** a card for the goals themselves: the first, or a fix of your design */
  const answers = (list: readonly { slot: { kind: string } }[]) =>
    list.some((k) => k.slot.kind === "first" || k.slot.kind === "fix");
  let nearMiss: SpeakerNearMiss | null = null;
  const fixMisses = chosen.fixMisses;
  // no card for the goals and your design doesn't keep them (a limit or the target out of reach), or only the closest
  if ((!answers(cards) && !curKeeps) || fixMisses) {
    const worked = looser.filter((o) => {
      const r = chooseFrom(o.L);
      return answers(r.cards) && !r.fixMisses;
    });
    const ownEntry: PoolEntry = {
      ev: start,
      changed: [],
      ch: 0,
      parts: partsKey(spec),
      key: specKey(spec),
    };
    const nearest = [ownEntry, ...pool].sort(
      (a, b) =>
        problemsOf(a.ev, start, limits, caps).length -
          problemsOf(b.ev, start, limits, caps).length ||
        gapSum(keep, metric(a)) - gapSum(keep, metric(b)) ||
        OBJECTIVE[goal](metric(a)) - OBJECTIVE[goal](metric(b)),
    )[0];
    const blocking = nearest
      ? problemText(nearest.ev, limits).length
        ? problemText(nearest.ev, limits)
        : [
            SPEAKER_NEAR_MISS_TEXT.short(
              (nearest.ev.metrics.musicDb ?? 0).toFixed(1),
              target.toFixed(0),
            ),
          ]
      : [SPEAKER_NEAR_MISS_TEXT.none];
    nearMiss = {
      options: worked.map(({ text, set }) => ({ text, set })),
      closest: nearest
        ? cardOf({ p: nearest, label: CARD_LABELS.nearMiss, why: "", slot: { kind: "closest" } })
        : null,
      closestIsYours: nearest === ownEntry,
      blocking,
    };
  }
  // nothing beats your design, and your design keeps every goal: that is the answer (the near miss covers the rest)
  const nothingBeats = !answers(cards) && curKeeps;
  const goalMissing =
    fixMisses && cards[0]
      ? outOfReachNotice(
          goals.map((g) => chosen.keeps[g]),
          { db: cards[0].metrics.musicDb ?? -Infinity, f3: cards[0].metrics.f3 ?? Infinity },
          SPEAKER_REACH_WORDS,
        )
      : nothingBeats
        ? also.length
          ? `Nothing ${goals.map((g) => SPEAKER_GOAL_THAN[g]).join(" and ")} than your design passes the checks.`
          : SPEAKER_GOAL_MISSING[goal]
        : null;
  report(total, total, true);
  const result: SpeakerOptimizerResult = {
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
  return { result, start, pool: pool.map((p) => p.ev), amps, groups };
}

/** A choice's identity: each unit's option and the shape. */
function comboKey(choice: Choice): string {
  return JSON.stringify([
    choice.options.map((o) => [
      o.driverId,
      o.hornId,
      o.v,
      o.port,
      o.fbHz,
      o.addG,
      o.subsonicHz,
      [...o.xo],
    ]),
    choice.shape,
  ]);
}

/** A card's change from your design. */
function deltaOf(m: SpeakerOptimizerMetrics, cur: SpeakerOptimizerMetrics) {
  return {
    price: m.price - cur.price,
    lb: m.lb - cur.lb,
    volumeL: m.volumeL - cur.volumeL,
    musicDb: m.musicDb !== null && cur.musicDb !== null ? m.musicDb - cur.musicDb : null,
    f3: m.f3 !== null && cur.f3 !== null ? m.f3 - cur.f3 : null,
  };
}

/** The search on the worker's input: what the page posts (`SpeakerOptimizerInput`). */
export const optimizeSpeakerInput = (
  input: SpeakerOptimizerInput,
  onProgress?: OptimizerProgressCallback,
): SpeakerOptimizerResult =>
  optimizeSpeaker(input.spec, input.goals, input.limits, input.locks, input.catalog, onProgress);
