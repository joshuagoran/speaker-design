import { HIFI_WOOFERS, HIFI_TWEETERS, HIFI_PASSIVES } from "../../lib/data";
import { toggled } from "../../lib/lists";
import { HIFI_LOCK_KEYS } from "../../lib/hifi/optimize";
import { runHifiOptimizer } from "../../lib/hifi/runOptimizer";
import { useDesignPreview } from "../../hooks/useDesignPreview";
import { useOptimizerLocks } from "../../hooks/useOptimizerLocks";
import { useOptimizerRun } from "../../hooks/useOptimizerRun";
import { useStoredState } from "../../hooks/useStoredState";
import type {
  HifiCardConfig,
  HifiDesign,
  HifiGoal,
  HifiLockKey,
  HifiOptimizerCard,
  HifiOptimizerLocks,
  HifiOptimizerResult,
  HifiPlannerLocks,
  OptimizerProgress,
  PanelExactIn,
  PanelNominal,
} from "../../types";
import { useState } from "react";
import { hifiWallChoicesIn } from "../../lib/panel";
import { PLYWOOD_MATERIAL } from "../../constants/panelSizes";

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
  /** the Cutlist page's measured panel thicknesses: the walls the search tries */
  panelExactIn: PanelExactIn;
  /** the walls' nominal size: the search adds it to ¾″ and ½″ when it is another */
  wallPanel: PanelNominal;
}

export interface HifiOptimizer
  extends
    Pick<
      ReturnType<typeof useOptimizerLocks<HifiLockKey, "dim", HifiOptimizerLocks>>,
      "renderLockButton" | "renderDimensionLock" | "lockBar"
    >,
    Pick<
      ReturnType<typeof useDesignPreview<HifiOptimizerCard, HifiCardConfig>>,
      | "designPreview"
      | "undoSnapshot"
      | "previewOptimizerResult"
      | "exitPreview"
      | "loadOptimizerResult"
      | "undoOptimizerLoad"
    > {
  isOptimizerOn: boolean;
  setIsOptimizerOn: (v: boolean) => void;
  optimizerGoals: HifiGoal[];
  toggleOptimizerGoal: (g: HifiGoal) => void;
  optimizerBudget: number;
  setOptimizerBudget: (v: number) => void;
  optimizerResult: HifiOptimizerResult | null;
  isOptimizing: boolean;
  optimizerError: string;
  /** how far the running search has got; null before its first report */
  optimizerProgress: OptimizerProgress | null;
  /** stops the running search and goes back to idle */
  cancelOptimizerSearch: () => void;
  runOptimizerSearch: () => Promise<void>;
  /** Drops the result, any preview and the undo (a restored saved design makes them stale). */
  clearOptimizerResults: () => void;
}

const ALL_LOCKED: HifiPlannerLocks = {
  ...Object.fromEntries(HIFI_LOCK_KEYS.map((k) => [k, true])),
  dim: { w: "exact", h: "exact", d: "exact" },
};

/** The Hi-fi optimizer: switch, goals, budget, locks, search, previewing, loading and undo. Switch, budget and locks are remembered per viewer. */
export function useHifiOptimizer({
  snapshot,
  applyDesign,
  speakerConfig,
  compressionWaveguide,
  seatDistanceM,
  guidePrice,
  panelExactIn,
  wallPanel,
}: Props): HifiOptimizer {
  const [isOptimizerOn, setIsOptimizerOn] = useStoredState("hifi.opt", false);
  const [optimizerBudget, setOptimizerBudget] = useStoredState("hifi.budget", 800);
  // goals in tap order, not remembered
  const [optimizerGoals, setOptimizerGoals] = useState<HifiGoal[]>([]);
  const { optimizerLocks, renderLockButton, renderDimensionLock, lockBar } = useOptimizerLocks<
    HifiLockKey,
    "dim",
    HifiOptimizerLocks
  >({
    key: "hifi.locks",
    empty: {},
    fromStored: (l) => ({ ...l, dim: { ...l.dim } }),
    allLocked: ALL_LOCKED,
    none: { dim: {} },
    enabled: isOptimizerOn,
  });
  const preview = useDesignPreview<HifiOptimizerCard, HifiCardConfig>({
    snapshot,
    applyCard: (k) => applyDesign(k.config),
    restore: applyDesign,
  });
  const {
    optimizerResult,
    isOptimizing,
    optimizerError,
    optimizerProgress,
    runOptimizerSearch,
    cancelOptimizerSearch,
    clearOptimizerResult,
  } = useOptimizerRun<HifiOptimizerResult>();
  const search = () =>
    runOptimizerSearch((options) =>
      runHifiOptimizer(
        {
          cur: { ...speakerConfig, ...preview.baseDesign(), guide: compressionWaveguide },
          woofers: HIFI_WOOFERS,
          tweeters: HIFI_TWEETERS,
          passives: HIFI_PASSIVES,
          goals: optimizerGoals,
          locks: optimizerLocks,
          budget: optimizerBudget,
          seatM: seatDistanceM,
          guidePrice,
          walls: hifiWallChoicesIn(speakerConfig.mat ?? PLYWOOD_MATERIAL, panelExactIn, {
            wall: speakerConfig.wall,
            panel: wallPanel,
          }),
        },
        options,
      ),
    );
  return {
    isOptimizerOn,
    setIsOptimizerOn,
    optimizerGoals,
    toggleOptimizerGoal: (g) => setOptimizerGoals((p) => toggled(p, g)),
    optimizerBudget,
    setOptimizerBudget,
    renderLockButton,
    renderDimensionLock,
    lockBar,
    optimizerResult,
    isOptimizing,
    optimizerError,
    optimizerProgress,
    cancelOptimizerSearch,
    designPreview: preview.designPreview,
    undoSnapshot: preview.undoSnapshot,
    runOptimizerSearch: search,
    previewOptimizerResult: preview.previewOptimizerResult,
    exitPreview: preview.exitPreview,
    loadOptimizerResult: preview.loadOptimizerResult,
    undoOptimizerLoad: preview.undoOptimizerLoad,
    clearOptimizerResults: () => {
      preview.clearDesignPreview();
      clearOptimizerResult();
    },
  };
}
