import { LOCK_KEYS } from "../../../constants/lockKeys";
import { PA_RUNNERS } from "../../../lib/pa/runOptimizer";
import { evaluateDesign as evaluateConfig, pickOptimizedFields } from "../../../lib/pa/optimize";
import { useDesignPreview } from "../../../hooks/useDesignPreview";
import { useOptimizerLocks } from "../../../hooks/useOptimizerLocks";
import { useOptimizerRun } from "../../../hooks/useOptimizerRun";
import { useStoredState, useStoredStateFrom } from "../../../hooks/useStoredState";
import type {
  ConfigDb,
  OptimizerProgress,
  CutlistSettings,
  PaDesignConfig,
  PaGoal,
  PaLockKey,
  PaOptimizerCard,
  PaOptimizerInputState,
  PaOptimizerLocks,
  PaOptimizerResult,
  PaPlannerLocks,
  PaRunMode,
  PaSearchOverrides,
  Setter,
} from "../../../types";
import { useState } from "react";

interface Props {
  /** the whole design as it is now */
  snapshot: () => PaDesignConfig;
  /** loads a design; fields it lacks keep their defaults */
  restore: (c: Partial<PaDesignConfig>) => void;
  /** the saved-config database; null when there is none, so results can't be saved */
  db: ConfigDb | null;
  /** the Cutlist tab's sheet and stack count, for the cards' sheet counts */
  cutlist: Pick<CutlistSettings, "sheet" | "stacks">;
}

export interface PaOptimizer
  extends
    Pick<
      ReturnType<typeof useOptimizerLocks<PaLockKey, "subDim" | "midDim", PaOptimizerLocks>>,
      "renderLockButton" | "renderDimensionLock" | "lockBar"
    >,
    Pick<
      ReturnType<typeof useDesignPreview<PaOptimizerCard, PaDesignConfig>>,
      | "designPreview"
      | "undoSnapshot"
      | "previewOptimizerResult"
      | "exitPreview"
      | "undoOptimizerLoad"
    > {
  isOptimizerOn: boolean;
  setIsOptimizerOn: (v: boolean) => void;
  optimizerInput: PaOptimizerInputState;
  updateOptimizerInput: (o: Partial<PaOptimizerInputState>) => void;
  optimizerResult: PaOptimizerResult | null;
  isOptimizing: boolean;
  optimizerError: string;
  /** how far the running search has got; null before its first report */
  optimizerProgress: OptimizerProgress | null;
  /** stops the running search and goes back to idle */
  cancelOptimizerSearch: () => void;
  /** which search is running; null when none is */
  runningMode: PaRunMode | null;
  toastMessage: string;
  setToastMessage: Setter<string>;
  startOptimizerSearch: (over?: PaSearchOverrides, mode?: PaRunMode) => Promise<void>;
  loadOptimizerResult: (k: PaOptimizerCard) => Promise<void>;
  saveOptimizerResult: (k: PaOptimizerCard) => Promise<void>;
  /** the current design's clean sub output in dB; null when the optimizer is off or the design can't be scored */
  currentDesignOutput: number | null;
}

/** What an earlier run stored under `planner.optIn`; `budgetPer` and `goal` are from older versions and dropped on load. */
type StoredOptimizerInput = Partial<PaOptimizerInputState> & { budgetPer?: number; goal?: PaGoal };

const ALL_LOCKED: PaPlannerLocks = {
  ...Object.fromEntries(LOCK_KEYS.map((k) => [k, true])),
  subDim: { w: "exact", h: "exact", d: "exact" },
  midDim: { w: "exact", h: "exact", d: "exact" },
};

const today = () => new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" });

/** The PA optimizer: switch, inputs, locks, search, previewing, loading and undo. Switch, inputs and locks are remembered per viewer. */
export function usePaOptimizer({ snapshot, restore, db, cutlist }: Props): PaOptimizer {
  const [isOptimizerOn, setIsOptimizerOn] = useStoredState("planner.opt", false);
  // goals start empty on every load (not restored), so a search always starts from a goal you just picked
  const [optimizerInput, setOptimizerInput] = useStoredStateFrom(
    "planner.optIn",
    {},
    (stored: StoredOptimizerInput): PaOptimizerInputState => {
      const { budgetPer, goal, goals, ...o } = stored || {};
      return { room: 1000, maxLb: 125, budget: 900, ...o, goals: [] };
    },
  );
  const updateOptimizerInput = (o: Partial<PaOptimizerInputState>) =>
    setOptimizerInput((p) => ({ ...p, ...o }));
  const { optimizerLocks, renderLockButton, renderDimensionLock, lockBar } = useOptimizerLocks<
    PaLockKey,
    "subDim" | "midDim",
    PaOptimizerLocks
  >({
    key: "planner.locks",
    empty: {},
    fromStored: (l) => ({ ...l, subDim: { ...l.subDim }, midDim: { ...l.midDim } }),
    allLocked: ALL_LOCKED,
    none: { subDim: {}, midDim: {} },
    enabled: isOptimizerOn,
  });
  // a result only sets the fields the search changes; finish, colours, layout and balance stay as they are now
  const preview = useDesignPreview<PaOptimizerCard, PaDesignConfig>({
    snapshot,
    applyCard: (k) => restore({ ...snapshot(), ...pickOptimizedFields(k.config) }),
    restore,
  });
  const {
    optimizerResult,
    isOptimizing,
    optimizerError,
    optimizerProgress,
    runOptimizerSearch,
    cancelOptimizerSearch,
  } = useOptimizerRun<PaOptimizerResult>();
  const [toastMessage, setToastMessage] = useState("");
  const [runMode, setRunMode] = useState<PaRunMode>("improve");
  const startOptimizerSearch = async (over?: PaSearchOverrides, mode: PaRunMode = "improve") => {
    if (isOptimizing) return;
    const inp = { ...optimizerInput, ...(over && over.nativeEvent ? {} : over || {}) };
    if (over && !over.nativeEvent) updateOptimizerInput(over);
    if (!inp.goals.length) return;
    setRunMode(mode);
    await runOptimizerSearch((options) =>
      PA_RUNNERS[mode](
        {
          cur: preview.baseDesign(),
          room: inp.room,
          maxLb: inp.maxLb,
          budget: inp.budget,
          goals: inp.goals,
          locks: optimizerLocks,
          cutlist,
        },
        options,
      ),
    );
  };
  const loadOptimizerResult = async (k: PaOptimizerCard) => {
    const before = preview.loadOptimizerResult(k);
    let msg = `Loaded "${k.label}".`;
    if (db) {
      const name = `Before optimizer, ${today()}`;
      try {
        await db
          .collection("configs")
          .doc()
          .set({ ...before, name, savedAt: Date.now() });
        msg += ` Your previous design was saved as "${name}".`;
      } catch {
        msg += " Undo brings your previous design back.";
      }
    } else msg += " Undo brings your previous design back.";
    setToastMessage(msg);
  };
  const undoOptimizerLoad = () => {
    preview.undoOptimizerLoad();
    setToastMessage("");
  };
  const saveOptimizerResult = async (k: PaOptimizerCard) => {
    if (!db) return;
    const name = window.prompt("Name this design", `${k.label} · ${today()}`);
    if (!name) return;
    const m = k.metrics;
    try {
      await db
        .collection("configs")
        .doc()
        .set({
          ...snapshot(),
          ...pickOptimizedFields(k.config),
          name: name.slice(0, 60),
          savedAt: Date.now(),
          summary: `${k.names.sub} · ${k.config.cDim.w}×${k.config.cDim.h}×${k.config.cDim.d}″ · ${m.Fb.toFixed(1)} Hz`,
        });
      setToastMessage(`Saved "${name.slice(0, 60)}".`);
    } catch {
      setToastMessage("Couldn't save — try again");
    }
  };
  const currentDesignOutput = isOptimizerOn
    ? (() => {
        try {
          const m = evaluateConfig(preview.baseDesign());
          return m ? m.out : null;
        } catch {
          return null;
        }
      })()
    : null;
  return {
    isOptimizerOn,
    setIsOptimizerOn,
    optimizerInput,
    updateOptimizerInput,
    renderLockButton,
    renderDimensionLock,
    lockBar,
    optimizerResult,
    isOptimizing,
    optimizerError,
    optimizerProgress,
    cancelOptimizerSearch,
    runningMode: isOptimizing ? runMode : null,
    designPreview: preview.designPreview,
    undoSnapshot: preview.undoSnapshot,
    toastMessage,
    setToastMessage,
    startOptimizerSearch,
    previewOptimizerResult: preview.previewOptimizerResult,
    exitPreview: preview.exitPreview,
    loadOptimizerResult,
    undoOptimizerLoad,
    saveOptimizerResult,
    currentDesignOutput,
  };
}
