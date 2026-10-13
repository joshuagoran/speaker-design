import { useMemo, useState } from "react";
import { runSpeakerOptimizer } from "../../lib/speaker/optimize/runOptimizer";
import { toggled } from "../../lib/lists";
import { useDesignPreview } from "../../hooks/useDesignPreview";
import { useOptimizerRun } from "../../hooks/useOptimizerRun";
import { useStoredStateFrom } from "../../hooks/useStoredState";
import {
  allKept,
  countKept,
  isKept,
  keepItems,
  pruneKept,
  toggleKeep,
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
  /** how many times the page replaced the chamber list: the locks name parts by place, so they start over with it */
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

/**
 * The Speaker optimizer: goals in tap order, the target level and limits, the locks, the search, and loading a card
 * (one edit, with Undo). The two limits are remembered per viewer; the goals, the target and the locks are not.
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
  // the locks name parts by place: they belong to the chamber list they were set on
  const [held, setHeld] = useState<{ round: number; locks: SpeakerOptimizerLocks }>({
    round,
    locks: {},
  });
  const items = useMemo(() => keepItems(spec), [spec]);
  const locks = held.round === round ? pruneKept(held.locks, items) : {};
  const setLocks = (next: SpeakerOptimizerLocks) => setHeld({ round, locks: next });
  const run = useOptimizerRun<SpeakerOptimizerResult>();
  const preview = useDesignPreview<SpeakerOptimizerCard, SpeakerSpec>({
    snapshot: () => spec,
    applyCard: (card) => loadSpec(card.spec),
    restore: loadSpec,
  });
  const yours = current.musicDb === null ? 0 : Math.round(current.musicDb);
  const targetDb = target ?? yours;
  const input = (over: Partial<SpeakerOptimizerLimits> = {}): SpeakerOptimizerInput => ({
    spec,
    goals,
    limits: { targetDb, ...limits, ...over },
    locks,
  });
  /** searches; given limits (the near miss's option) it sets them first */
  const search = async (over?: Partial<SpeakerOptimizerLimits>) => {
    if (run.isOptimizing || !goals.length) return;
    if (over?.targetDb !== undefined) setTarget(over.targetDb);
    if (over?.budget !== undefined || over?.maxLb !== undefined)
      setLimits((l) => ({ budget: over.budget ?? l.budget, maxLb: over.maxLb ?? l.maxLb }));
    await run.runOptimizerSearch((options) => runSpeakerOptimizer(input(over), options));
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
    result: run.optimizerResult,
    isOptimizing: run.isOptimizing,
    error: run.optimizerError,
    progress: run.optimizerProgress,
    search,
    cancel: run.cancelOptimizerSearch,
    /** replaces your design with the card's, as one edit; Undo goes back to the design from before the first load in a row */
    load: preview.loadOptimizerResult,
    canUndo: preview.undoSnapshot !== null,
    undoLoad: preview.undoOptimizerLoad,
  };
}

/** What `useSpeakerOptimizer` returns. */
export type SpeakerOptimizer = ReturnType<typeof useSpeakerOptimizer>;
