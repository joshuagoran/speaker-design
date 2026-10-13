// The part of a page's Speaker-style optimizer that the Speaker and Stack pages share: the goals in tap order, the
// target level and the limits, the search, and loading a card as one edit with Undo (the cards go stale once the design
// changed after the search). Each page adds its own locks and its own call to the search
// (pages/speaker/useSpeakerOptimizer, pages/stack/useStackOptimizer).
import { useRef, useState } from "react";
import { toggled } from "../lib/lists";
import { useOptimizerRun } from "./useOptimizerRun";
import { useStoredStateFrom } from "./useStoredState";
import type { OptimizerRunOptions, SpeakerGoal } from "../types";

/** The limits a viewer's browser remembers: a number or none for each (the page names the keys). */
export type StoredLimits = Record<string, number | null>;

/** A limit read from storage: a number, or none. */
export const storedLimit = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/** The budget a limit starts at when it is turned on: your price, to the next $25. */
const BUDGET_STEP = 25;
/** The weight a limit starts at when it is turned on: your weight, to the next 5 lb. */
const WEIGHT_STEP_LB = 5;

/** What a limit starts at when it is turned on: your design's price, to the next $25. */
export const budgetStart = (dollars: number) =>
  Math.max(BUDGET_STEP, Math.ceil(dollars / BUDGET_STEP) * BUDGET_STEP);
/** What a limit starts at when it is turned on: your design's weight, to the next 5 lb. */
export const weightStart = (lb: number) =>
  Math.max(WEIGHT_STEP_LB, Math.ceil(lb / WEIGHT_STEP_LB) * WEIGHT_STEP_LB);

/** A search's result and the design it searched from. */
export interface Searched<Design, Result> {
  from: Design;
  result: Result;
}

/** What Undo after loads puts back: the design from before the first load in a row, and the design the last load set. */
export interface LoadUndo<Design> {
  before: Design;
  loaded: Design;
}

/**
 * The optimizer's results and Undo against the design as it is now. Undo holds while the design is the one the last
 * load set (any design edit since ends it). The cards are stale once the design changed after the search: it is neither
 * the design searched from nor a card loaded since (Load is off then, the page asks for a new search).
 */
export function optimizerView<Design, Result>(
  searched: Searched<Design, Result> | null,
  undo: LoadUndo<Design> | null,
  design: Design,
  sameDesign: (a: Design, b: Design) => boolean,
) {
  const canUndo = undo !== null && sameDesign(undo.loaded, design);
  const stale = searched !== null && !sameDesign(design, searched.from) && !canUndo;
  return { result: searched?.result ?? null, stale, canUndo };
}

interface Config<Design, Stored extends StoredLimits, Card, Result> {
  /** the design as the page has it now */
  design: Design;
  /** puts a design in as one edit */
  loadDesign: (design: Design) => void;
  /** whether two designs are the same one: everything a search reads and a card replaces (not the id or name) */
  sameDesign: (a: Design, b: Design) => boolean;
  /** a card's design as Load puts it in: under your design's id and name */
  loaded: (card: Card, yours: Design) => Design;
  /** an earlier design as Undo puts it back: under your design's id and name */
  restored: (before: Design, yours: Design) => Design;
  /** your design's level at 1 m (null when it can't be modeled), for the target's start */
  musicDb: number | null;
  /** where the limits are remembered (the key), and how a stored value reads (every limit a number or none) */
  storage: { key: string; read: (stored: Partial<Record<keyof Stored, unknown>>) => Stored };
  /** the search on this design with these goals and limits (the page adds its locks) */
  run: (
    goals: SpeakerGoal[],
    limits: { targetDb: number } & Stored,
    options: OptimizerRunOptions,
  ) => Promise<Result>;
}

/**
 * The goals in tap order, the target level and the limits, the search, and loading a card (one edit, with Undo). The
 * limits are remembered per viewer; the goals and the target are not. A search that comes back for a design changed
 * since is dropped. `clearResults` stops a running search and drops the result and Undo (the page calls it when it
 * replaces the whole design).
 */
export function useDesignOptimizer<
  Design,
  Stored extends StoredLimits,
  Card,
  Result extends { cards: readonly Card[] },
>({
  design,
  loadDesign,
  sameDesign,
  loaded,
  restored,
  musicDb,
  storage,
  run: runSearch,
}: Config<Design, Stored, Card, Result>) {
  const [goals, setGoals] = useState<SpeakerGoal[]>([]);
  // null: the target follows your design's level
  const [target, setTarget] = useState<number | null>(null);
  const [limits, setLimits] = useStoredStateFrom(storage.key, {}, storage.read);
  // null: no result, or one dropped because it came back for a design changed since
  const run = useOptimizerRun<Searched<Design, Result> | null>();
  const [undo, setUndo] = useState<LoadUndo<Design> | null>(null);
  const view = optimizerView(run.optimizerResult, undo, design, sameDesign);
  // the design as the page has it now, for a search that comes back later
  const latest = useRef(design);
  latest.current = design;
  // the field shows whole dB; following your design, the search takes your level as it is, so "Same level" holds
  const yours = musicDb === null ? 0 : Math.round(musicDb);
  /** searches; given limits (the near miss's option) it sets them first */
  const search = async (over: Partial<{ targetDb: number } & Stored> = {}) => {
    if (run.isOptimizing || !goals.length) return;
    const { targetDb, ...moved } = over;
    if (targetDb !== undefined) setTarget(targetDb);
    // the search reads the limits as they will be: the page's state updates after this render
    const set = { targetDb: targetDb ?? target ?? musicDb ?? 0, ...limits, ...moved };
    if (Object.keys(moved).length) setLimits((l) => storage.read({ ...l, ...moved }));
    const from = design;
    await run.runOptimizerSearch(async (options) => {
      const result = await runSearch(goals, set, options);
      // the design changed while it ran: its cards would load over the edits, so it is dropped
      return sameDesign(latest.current, from) ? { from, result } : null;
    });
  };
  /** loads the card (not on stale cards); Undo goes back to the design from before the first load in a row */
  const load = (card: Card) => {
    if (view.stale) return;
    const next = loaded(card, design);
    loadDesign(next);
    setUndo({ before: view.canUndo && undo ? undo.before : design, loaded: next });
  };
  const undoLoad = () => {
    if (!view.canUndo || !undo) return;
    loadDesign(restored(undo.before, design));
    setUndo(null);
  };
  return {
    goals,
    tapGoal: (g: SpeakerGoal) => setGoals((list) => toggled(list, g)),
    targetDb: target ?? yours,
    /** whether the target is your design's level (not one typed in) */
    targetIsYours: target === null,
    yoursDb: musicDb,
    setTarget: (db: number) => setTarget(db),
    useYoursForTarget: () => setTarget(null),
    limits,
    setLimit: (key: keyof Stored, value: number | null) =>
      setLimits((l) => ({ ...l, [key]: value })),
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
    /** stops a running search and drops the result and Undo: the page replaced the whole design */
    clearResults: () => {
      run.cancelOptimizerSearch();
      run.clearOptimizerResult();
      setUndo(null);
    },
  };
}
