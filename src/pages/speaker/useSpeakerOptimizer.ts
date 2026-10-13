import { useMemo, useRef, useState } from "react";
import { runSpeakerOptimizer } from "../../lib/speaker/optimize/runOptimizer";
import { toggled } from "../../lib/lists";
import { useOptimizerRun } from "../../hooks/useOptimizerRun";
import { useStoredStateFrom } from "../../hooks/useStoredState";
import {
  allKept,
  countKept,
  driverLayout,
  heldLocks,
  isKept,
  keepItems,
  toggleKeep,
  type HeldLocks,
  type KeepItem,
} from "./speakerKeeps";
import type {
  DimensionLockMode,
  Dims3,
  SpeakerGoal,
  SpeakerOptimizerCard,
  SpeakerOptimizerInput,
  SpeakerOptimizerLimits,
  SpeakerOptimizerLocks,
  SpeakerOptimizerResult,
  SpeakerSpec,
} from "../../types";

interface Props {
  /** the speaker as the page has it now */
  spec: SpeakerSpec;
  /** puts a spec in as one edit, with no settings reset (a card's design has the same chambers and bands as yours) */
  loadSpec: (spec: SpeakerSpec) => void;
  /**
   * how many times the page replaced the chamber list (or lost a chamber): the locks name parts by place, so they start
   * over with it
   */
  round: number;
  /** your design's numbers: its level at 1 m (null when it can't be modeled), price and weight */
  current: { musicDb: number | null; price: number; lb: number };
}

/** What the optimizer remembers per viewer: the two limits (the target and the goals start over with the design). */
type StoredLimits = Pick<SpeakerOptimizerLimits, "budget" | "maxLb">;

/** A limit read from storage: a number, or none. */
const storedLimit = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/** The budget a limit starts at when it is turned on: your price, to the next $25. */
const BUDGET_STEP = 25;
/** The weight a limit starts at when it is turned on: your weight, to the next 5 lb. */
const WEIGHT_STEP_LB = 5;

/** A search's result and the spec it searched from. */
export interface SpeakerSearched {
  from: SpeakerSpec;
  result: SpeakerOptimizerResult;
}

/** What Undo after loads puts back: the spec from before the first load in a row, and the spec the last load set. */
export interface SpeakerLoadUndo {
  before: SpeakerSpec;
  loaded: SpeakerSpec;
}

/** Whether two specs are the same design: everything a search reads and a card replaces (all but the id and name). */
export const sameDesign = (a: SpeakerSpec, b: SpeakerSpec): boolean =>
  a.cabinet === b.cabinet && a.bands === b.bands && a.input === b.input && a.look === b.look;

/**
 * The optimizer's results and Undo against the spec as it is now. Undo holds while the design is the one the last load
 * set (any design edit since ends it). The cards are stale once the design changed after the search: it is neither the
 * design searched from nor a card loaded since (Load is off then, the page asks for a new search).
 */
export function speakerOptimizerView(
  searched: SpeakerSearched | null,
  undo: SpeakerLoadUndo | null,
  spec: SpeakerSpec,
) {
  const canUndo = undo !== null && sameDesign(undo.loaded, spec);
  const stale = searched !== null && !sameDesign(spec, searched.from) && !canUndo;
  return { result: searched?.result ?? null, stale, canUndo };
}

/** A card's design as Load puts it in: the card's spec under your spec's id and name. */
export const loadedSpec = (card: Pick<SpeakerOptimizerCard, "spec">, spec: SpeakerSpec) => ({
  ...card.spec,
  id: spec.id,
  name: spec.name,
});

/**
 * The Speaker optimizer: goals in tap order, the target level and limits, the locks, the search, and loading a card
 * (one edit, with Undo). The two limits are remembered per viewer; the goals, the target and the locks are not.
 * `clearResults` drops the result and Undo (the page calls it when it replaces the whole spec).
 */
export function useSpeakerOptimizer({ spec, loadSpec, round, current }: Props) {
  const [goals, setGoals] = useState<SpeakerGoal[]>([]);
  // null: the target follows your design's level
  const [target, setTarget] = useState<number | null>(null);
  const [limits, setLimits] = useStoredStateFrom(
    "speaker.optimizerLimits",
    {},
    (stored: Partial<Record<keyof StoredLimits, unknown>>): StoredLimits => ({
      budget: storedLimit(stored?.budget),
      maxLb: storedLimit(stored?.maxLb),
    }),
  );
  // the locks name parts by place: they belong to the chamber list and the driver layout they were set on
  const layout = driverLayout(spec);
  const [held, setHeld] = useState<HeldLocks>({ round, layout, locks: {} });
  const items = useMemo(() => keepItems(spec), [spec]);
  const locks = heldLocks(held, { round, layout }, items);
  const setLocks = (next: SpeakerOptimizerLocks) => setHeld({ round, layout, locks: next });
  // null: no result, or one dropped because it came back for a design changed since
  const run = useOptimizerRun<SpeakerSearched | null>();
  const [undo, setUndo] = useState<SpeakerLoadUndo | null>(null);
  const view = speakerOptimizerView(run.optimizerResult, undo, spec);
  // the spec as the page has it now, for a search that comes back later
  const latest = useRef(spec);
  latest.current = spec;
  // the field shows whole dB; following your design, the search takes your level as it is, so "Same level" holds
  const yours = current.musicDb === null ? 0 : Math.round(current.musicDb);
  const targetDb = target ?? yours;
  const input = (over: Partial<SpeakerOptimizerLimits> = {}): SpeakerOptimizerInput => ({
    spec,
    goals,
    limits: { targetDb: target ?? current.musicDb ?? 0, ...limits, ...over },
    locks,
  });
  /** searches; given limits (the near miss's option) it sets them first */
  const search = async (over?: Partial<SpeakerOptimizerLimits>) => {
    if (run.isOptimizing || !goals.length) return;
    if (over?.targetDb !== undefined) setTarget(over.targetDb);
    if (over?.budget !== undefined || over?.maxLb !== undefined)
      setLimits((l) => ({ budget: over.budget ?? l.budget, maxLb: over.maxLb ?? l.maxLb }));
    const from = spec;
    await run.runOptimizerSearch(async (options) => {
      const result = await runSpeakerOptimizer(input(over), options);
      // the design changed while it ran: its cards would load over the edits, so it is dropped
      return sameDesign(latest.current, from) ? { from, result } : null;
    });
  };
  /** loads the card (not on stale cards); Undo goes back to the spec from before the first load in a row */
  const load = (card: SpeakerOptimizerCard) => {
    if (view.stale) return;
    const next = loadedSpec(card, spec);
    loadSpec(next);
    setUndo({ before: view.canUndo && undo ? undo.before : spec, loaded: next });
  };
  const undoLoad = () => {
    if (!view.canUndo || !undo) return;
    loadSpec({ ...undo.before, id: spec.id, name: spec.name });
    setUndo(null);
  };
  return {
    goals,
    tapGoal: (g: SpeakerGoal) => setGoals((list) => toggled(list, g)),
    targetDb,
    /** whether the target is your design's level (not one typed in) */
    targetIsYours: target === null,
    yoursDb: current.musicDb,
    setTarget: (db: number) => setTarget(db),
    useYoursForTarget: () => setTarget(null),
    budget: limits.budget,
    setBudget: (budget: number | null) => setLimits((l) => ({ ...l, budget })),
    budgetStart: Math.max(BUDGET_STEP, Math.ceil(current.price / BUDGET_STEP) * BUDGET_STEP),
    maxLb: limits.maxLb,
    setMaxLb: (maxLb: number | null) => setLimits((l) => ({ ...l, maxLb })),
    weightStart: Math.max(WEIGHT_STEP_LB, Math.ceil(current.lb / WEIGHT_STEP_LB) * WEIGHT_STEP_LB),
    locks,
    items,
    isKept: (item: KeepItem) => isKept(locks, item),
    toggleKeep: (item: KeepItem) => setLocks(toggleKeep(locks, item)),
    sizeLock: (axis: keyof Dims3): DimensionLockMode => locks.size?.[axis] ?? "free",
    setSizeLock: (axis: keyof Dims3, mode: DimensionLockMode) =>
      setLocks({ ...locks, size: { ...locks.size, [axis]: mode } }),
    lockBar: {
      nLocks: countKept(locks),
      lockMax: items.length + 3,
      onLockAll: () => setLocks(allKept(items)),
      onClear: () => setLocks({}),
    },
    result: view.result,
    /** the design changed after the search: the cards don't load until it runs again */
    stale: view.stale,
    isOptimizing: run.isOptimizing,
    error: run.optimizerError,
    progress: run.optimizerProgress,
    search,
    cancel: run.cancelOptimizerSearch,
    /** replaces your design with the card's (keeping its id and name), as one edit */
    load,
    canUndo: view.canUndo,
    undoLoad,
    /** drops the result and Undo: the page replaced the whole spec (a start, a saved speaker opened) */
    clearResults: () => {
      run.clearOptimizerResult();
      setUndo(null);
    },
  };
}

/** What `useSpeakerOptimizer` returns. */
export type SpeakerOptimizer = ReturnType<typeof useSpeakerOptimizer>;
