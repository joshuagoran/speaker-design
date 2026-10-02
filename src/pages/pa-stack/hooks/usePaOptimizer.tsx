import { readStoredJson, writeStoredJson } from "../../../lib/storage.ts";
import { LockButton } from "../../../components/lock/LockButton.tsx";
import { DimensionLock } from "../../../components/lock/DimensionLock.tsx";
import { runPaOptimizer } from "../../../lib/pa/runOptimizer.ts";
import { evaluateDesign as evaluateConfig, pickOptimizedFields } from "../../../lib/pa/optimize.ts";
import type {
  ConfigDb,
  Dims3,
  PaDesignConfig,
  PaGoal,
  PaLockKey,
  PaOptimizerCard,
  PaOptimizerLocks,
  PaOptimizerResult,
  PaRoom,
} from "../../../types.ts";
import type { PaDesign } from "./usePaDesign.ts";
import { useState } from "react";

/** The optimizer's inputs on the page: the room, the heaviest box and the budget, and the goals in tap order. */
export interface PaOptimizerInputState {
  room: PaRoom;
  maxLb: number;
  budget: number;
  goals: PaGoal[];
}

/** The optimizer locks as the page holds them: both box-dimension modes are always present. */
export interface PaPlannerLocks extends PaOptimizerLocks {
  subDim: NonNullable<PaOptimizerLocks["subDim"]>;
  midDim: NonNullable<PaOptimizerLocks["midDim"]>;
}

/** The card being previewed, and the design to go back to when the preview ends. */
export interface DesignPreview {
  label: string;
  before: PaDesignConfig;
  card: PaOptimizerCard;
}

/** What `startOptimizerSearch` takes: input fields to change for this run, or the click event when it is used as a handler. */
export type PaSearchOverrides = Partial<PaOptimizerInputState> & { nativeEvent?: Event };

interface Props {
  snapshot: PaDesign["snapshot"];
  restore: PaDesign["restore"];
  /** the saved-config database; null when there is none, so results can't be saved */
  db: ConfigDb | null;
}

export interface PaOptimizer {
  isOptimizerOn: boolean;
  setIsOptimizerOnState: React.Dispatch<React.SetStateAction<boolean>>;
  setIsOptimizerOn: (v: boolean) => void;
  optimizerInput: PaOptimizerInputState;
  setOptimizerInputState: React.Dispatch<React.SetStateAction<PaOptimizerInputState>>;
  updateOptimizerInput: (o: Partial<PaOptimizerInputState>) => void;
  optimizerLocks: PaPlannerLocks;
  setOptimizerLocksState: React.Dispatch<React.SetStateAction<PaPlannerLocks>>;
  setOptimizerLocks: (f: (p: PaPlannerLocks) => PaPlannerLocks) => void;
  renderLockButton: (key: PaLockKey, what: string) => React.ReactNode;
  renderDimensionLock: (
    box: "subDim" | "midDim",
    dim: keyof Dims3,
    what: string,
  ) => React.ReactNode;
  optimizerResult: PaOptimizerResult | null;
  setOptimizerResult: React.Dispatch<React.SetStateAction<PaOptimizerResult | null>>;
  isOptimizing: boolean;
  setIsOptimizing: React.Dispatch<React.SetStateAction<boolean>>;
  optimizerError: string;
  setOptimizerError: React.Dispatch<React.SetStateAction<string>>;
  designPreview: DesignPreview | null;
  setDesignPreview: React.Dispatch<React.SetStateAction<DesignPreview | null>>;
  undoSnapshot: PaDesignConfig | null;
  setUndoSnapshot: React.Dispatch<React.SetStateAction<PaDesignConfig | null>>;
  toastMessage: string;
  setToastMessage: React.Dispatch<React.SetStateAction<string>>;
  today: () => string;
  startOptimizerSearch: (over?: PaSearchOverrides) => Promise<void>;
  previewOptimizerResult: (k: PaOptimizerCard) => void;
  exitPreview: () => void;
  loadOptimizerResult: (k: PaOptimizerCard) => Promise<void>;
  undoOptimizerLoad: () => void;
  saveOptimizerResult: (k: PaOptimizerCard) => Promise<void>;
  /** the current design's clean sub output in dB; null when the optimizer is off or the design can't be scored */
  currentDesignOutput: number | null;
}

/** What an earlier run stored under `planner.optIn`; `budgetPer` and `goal` are from older versions and dropped on load. */
type StoredOptimizerInput = Partial<PaOptimizerInputState> & { budgetPer?: number; goal?: PaGoal };

/** The PA optimizer: switch, inputs, locks, search, previewing, loading and undo. Switch, inputs and locks are remembered per viewer. */
export function usePaOptimizer({ snapshot, restore, db }: Props): PaOptimizer {
  // optimizer: switch, inputs and locks remembered per viewer
  const [isOptimizerOn, setIsOptimizerOnState] = useState(() =>
    readStoredJson("planner.opt", false),
  );
  const setIsOptimizerOn = (v: boolean) => {
    setIsOptimizerOnState(v);
    writeStoredJson("planner.opt", v);
  };
  // goals start empty on every load (not restored), so a search always starts from a goal you just picked
  const [optimizerInput, setOptimizerInputState] = useState<PaOptimizerInputState>(() => {
    const { budgetPer, goal, goals, ...o } =
      readStoredJson<StoredOptimizerInput>("planner.optIn", {}) || {};
    return { room: 1000, maxLb: 125, budget: 900, ...o, goals: [] };
  });
  const updateOptimizerInput = (o: Partial<PaOptimizerInputState>) =>
    setOptimizerInputState((p) => {
      const n = { ...p, ...o };
      writeStoredJson("planner.optIn", n);
      return n;
    });
  const [optimizerLocks, setOptimizerLocksState] = useState<PaPlannerLocks>(() => {
    const l = readStoredJson<PaOptimizerLocks>("planner.locks", {}) || {};
    return { ...l, subDim: { ...(l.subDim || {}) }, midDim: { ...(l.midDim || {}) } };
  });
  const setOptimizerLocks = (f: (p: PaPlannerLocks) => PaPlannerLocks) =>
    setOptimizerLocksState((p) => {
      const n = f(p);
      writeStoredJson("planner.locks", n);
      return n;
    });
  const renderLockButton = (key: PaLockKey, what: string) =>
    isOptimizerOn ? (
      <LockButton
        on={!!optimizerLocks[key]}
        what={what}
        onClick={() => setOptimizerLocks((p) => ({ ...p, [key]: !p[key] }))}
      />
    ) : null;
  const renderDimensionLock = (box: "subDim" | "midDim", dim: keyof Dims3, what: string) =>
    isOptimizerOn ? (
      <DimensionLock
        mode={optimizerLocks[box][dim] || "free"}
        what={what}
        onChange={(m) => setOptimizerLocks((p) => ({ ...p, [box]: { ...p[box], [dim]: m } }))}
      />
    ) : null;
  const [optimizerResult, setOptimizerResult] = useState<PaOptimizerResult | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizerError, setOptimizerError] = useState("");
  const [designPreview, setDesignPreview] = useState<DesignPreview | null>(null); // { label, before }
  const [undoSnapshot, setUndoSnapshot] = useState<PaDesignConfig | null>(null);
  const [toastMessage, setToastMessage] = useState("");
  // ---- optimizer actions ----
  const today = () => new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const startOptimizerSearch = async (over?: PaSearchOverrides) => {
    const inp = { ...optimizerInput, ...(over && over.nativeEvent ? {} : over || {}) };
    if (over && !over.nativeEvent) updateOptimizerInput(over);
    if (!inp.goals.length) return;
    setIsOptimizing(true);
    setOptimizerError("");
    try {
      const cur = designPreview ? designPreview.before : snapshot();
      setOptimizerResult(
        await runPaOptimizer({
          cur,
          room: inp.room,
          maxLb: inp.maxLb,
          budget: inp.budget,
          goals: inp.goals,
          locks: optimizerLocks,
        }),
      );
    } catch (e) {
      // boundary cast: the optimizer rejects with an Error (see makeOptimizerRunner), but a catch variable is `unknown`
      setOptimizerError("The search failed: " + ((e && (e as Error).message) || e));
    }
    setIsOptimizing(false);
  };
  // a result only sets the fields the search changes; finish, colours, layout and balance stay as they are now
  const previewOptimizerResult = (k: PaOptimizerCard) => {
    const before = designPreview ? designPreview.before : snapshot();
    restore({ ...snapshot(), ...pickOptimizedFields(k.config) });
    setDesignPreview({ label: k.label, before, card: k });
  };
  const exitPreview = () => {
    if (designPreview) restore(designPreview.before);
    setDesignPreview(null);
  };
  const loadOptimizerResult = async (k: PaOptimizerCard) => {
    const before = designPreview ? designPreview.before : snapshot();
    restore({ ...snapshot(), ...pickOptimizedFields(k.config) });
    setDesignPreview(null);
    setUndoSnapshot(before);
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
    if (undoSnapshot) restore(undoSnapshot);
    setUndoSnapshot(null);
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
          const m = evaluateConfig(designPreview ? designPreview.before : snapshot());
          return m ? m.out : null;
        } catch {
          return null;
        }
      })()
    : null;
  return {
    isOptimizerOn,
    setIsOptimizerOnState,
    setIsOptimizerOn,
    optimizerInput,
    setOptimizerInputState,
    updateOptimizerInput,
    optimizerLocks,
    setOptimizerLocksState,
    setOptimizerLocks,
    renderLockButton,
    renderDimensionLock,
    optimizerResult,
    setOptimizerResult,
    isOptimizing,
    setIsOptimizing,
    optimizerError,
    setOptimizerError,
    designPreview,
    setDesignPreview,
    undoSnapshot,
    setUndoSnapshot,
    toastMessage,
    setToastMessage,
    today,
    startOptimizerSearch,
    previewOptimizerResult,
    exitPreview,
    loadOptimizerResult,
    undoOptimizerLoad,
    saveOptimizerResult,
    currentDesignOutput,
  };
}
