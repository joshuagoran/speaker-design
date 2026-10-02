import { HIFI_WOOFERS, HIFI_TWEETERS, HIFI_PASSIVES } from "../../lib/data";
import { readStoredJson, writeStoredJson } from "../../lib/storage";
import { runHifiOptimizer } from "../../lib/hifi/runOptimizer";
import type {
  HifiCardConfig,
  HifiGoal,
  HifiOptimizerCard,
  HifiOptimizerLocks,
  HifiOptimizerResult,
  Setter,
} from "../../types";
import type { HifiDesign } from "./hifiDesign";
import { useState } from "react";

/** The optimizer locks as the page holds them: the box-dimension modes are always present. */
export interface HifiPlannerLocks extends HifiOptimizerLocks {
  dim: NonNullable<HifiOptimizerLocks["dim"]>;
}

/** The card being previewed, and the design to go back to when the preview ends. */
export interface HifiDesignPreview {
  label: string;
  before: HifiCardConfig;
  card: HifiOptimizerCard;
}

interface Props {
  /** the fields of the design a card applies: what the search starts from, and what undo and preview go back to */
  snapshot: () => HifiCardConfig;
  /** sets those fields from a card or a snapshot */
  applyDesign: (c: HifiCardConfig) => void;
  speakerConfig: HifiDesign["speakerConfig"];
  compressionWaveguide: HifiDesign["compressionWaveguide"];
  seatDistanceM: HifiDesign["seatDistanceM"];
  /** what the picked waveguide costs, $ */
  guidePrice: number;
}

export interface HifiOptimizer {
  isOptimizerOn: boolean;
  setIsOptimizerOn: (v: boolean) => void;
  optimizerGoals: HifiGoal[];
  setOptimizerGoals: Setter<HifiGoal[]>;
  optimizerBudget: number;
  setOptimizerBudget: (v: number) => void;
  optimizerLocks: HifiPlannerLocks;
  setOptimizerLocks: (f: (p: HifiPlannerLocks) => HifiPlannerLocks) => void;
  optimizerResult: HifiOptimizerResult | null;
  isOptimizing: boolean;
  optimizerError: string;
  designPreview: HifiDesignPreview | null;
  undoSnapshot: HifiCardConfig | null;
  runOptimizerSearch: () => Promise<void>;
  previewOptimizerResult: (k: HifiOptimizerCard) => void;
  exitPreview: () => void;
  loadOptimizerResult: (k: HifiOptimizerCard) => void;
  undoOptimizerLoad: () => void;
  /** Drops the result, any preview and the undo (a restored saved design makes them stale). */
  clearOptimizerResults: () => void;
}

/** The Hi-fi optimizer: switch, goals, budget, locks, search, previewing, loading and undo. Switch, budget and locks are remembered per viewer. */
export function useHifiOptimizer({
  snapshot,
  applyDesign,
  speakerConfig,
  compressionWaveguide,
  seatDistanceM,
  guidePrice,
}: Props): HifiOptimizer {
  // optimizer: same rules and layout as the PA planner's (switch, locks on the controls, goals in tap order)
  const [isOptimizerOn, setIsOptimizerOnState] = useState(() => readStoredJson("hifi.opt", false));
  const setIsOptimizerOn = (v: boolean) => {
    setIsOptimizerOnState(v);
    writeStoredJson("hifi.opt", v);
  };
  const [optimizerGoals, setOptimizerGoals] = useState<HifiGoal[]>([]);
  const [optimizerBudget, setOptimizerBudgetState] = useState(() =>
    readStoredJson("hifi.budget", 800),
  );
  const setOptimizerBudget = (v: number) => {
    setOptimizerBudgetState(v);
    writeStoredJson("hifi.budget", v);
  };
  const [optimizerLocks, setOptimizerLocksState] = useState<HifiPlannerLocks>(() => {
    const l = readStoredJson<HifiOptimizerLocks>("hifi.locks", {}) || {};
    return { ...l, dim: { ...l.dim } };
  });
  const setOptimizerLocks = (f: (p: HifiPlannerLocks) => HifiPlannerLocks) =>
    setOptimizerLocksState((p) => {
      const n = f(p);
      writeStoredJson("hifi.locks", n);
      return n;
    });
  const [optimizerResult, setOptimizerResult] = useState<HifiOptimizerResult | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizerError, setOptimizerError] = useState("");
  const [designPreview, setDesignPreview] = useState<HifiDesignPreview | null>(null);
  const [undoSnapshot, setUndoSnapshot] = useState<HifiCardConfig | null>(null);
  // ---- optimizer actions ----
  const runOptimizerSearch = async () => {
    setIsOptimizing(true);
    setOptimizerError("");
    const base = designPreview ? designPreview.before : snapshot();
    try {
      setOptimizerResult(
        await runHifiOptimizer({
          cur: { ...speakerConfig, ...base, guide: compressionWaveguide },
          woofers: HIFI_WOOFERS,
          tweeters: HIFI_TWEETERS,
          passives: HIFI_PASSIVES,
          goals: optimizerGoals,
          locks: optimizerLocks,
          budget: optimizerBudget,
          seatM: seatDistanceM,
          guidePrice,
        }),
      );
    } catch (e) {
      // boundary cast: a catch variable is unknown; whatever was thrown is read for a message, as before
      setOptimizerError("The search failed: " + ((e && (e as Error).message) || e));
    }
    setIsOptimizing(false);
  };
  const previewOptimizerResult = (k: HifiOptimizerCard) => {
    const before = designPreview ? designPreview.before : snapshot();
    applyDesign(k.config);
    setDesignPreview({ label: k.label, before, card: k });
  };
  const exitPreview = () => {
    if (designPreview) applyDesign(designPreview.before);
    setDesignPreview(null);
  };
  const loadOptimizerResult = (k: HifiOptimizerCard) => {
    const before = designPreview ? designPreview.before : snapshot();
    applyDesign(k.config);
    setDesignPreview(null);
    setUndoSnapshot(before);
  };
  const undoOptimizerLoad = () => {
    if (undoSnapshot) applyDesign(undoSnapshot);
    setUndoSnapshot(null);
  };
  const clearOptimizerResults = () => {
    setDesignPreview(null);
    setUndoSnapshot(null);
    setOptimizerResult(null);
  };
  return {
    isOptimizerOn,
    setIsOptimizerOn,
    optimizerGoals,
    setOptimizerGoals,
    optimizerBudget,
    setOptimizerBudget,
    optimizerLocks,
    setOptimizerLocks,
    optimizerResult,
    isOptimizing,
    optimizerError,
    designPreview,
    undoSnapshot,
    runOptimizerSearch,
    previewOptimizerResult,
    exitPreview,
    loadOptimizerResult,
    undoOptimizerLoad,
    clearOptimizerResults,
  };
}
