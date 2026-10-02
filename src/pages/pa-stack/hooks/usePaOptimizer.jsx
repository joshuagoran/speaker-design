import { readStoredJson, writeStoredJson } from "../../../lib/storage.ts";
import { LockButton } from "../../../components/lock/LockButton.jsx";
import { DimensionLock } from "../../../components/lock/DimensionLock.jsx";
import { runPaOptimizer } from "../../../lib/pa/runOptimizer.ts";
import { evaluateDesign as evaluateConfig, pickOptimizedFields } from "../../../lib/pa/optimize.ts";
import { useState } from "react";

/** The PA optimizer: switch, inputs, locks, search, previewing, loading and undo. Switch, inputs and locks are remembered per viewer. */
export function usePaOptimizer({ snapshot, restore, db }) {
  // optimizer: switch, inputs and locks remembered per viewer
  const [isOptimizerOn, setIsOptimizerOnState] = useState(() =>
    readStoredJson("planner.opt", false),
  );
  const setIsOptimizerOn = (v) => {
    setIsOptimizerOnState(v);
    writeStoredJson("planner.opt", v);
  };
  // goals start empty on every load (not restored), so a search always starts from a goal you just picked
  const [optimizerInput, setOptimizerInputState] = useState(() => {
    const { budgetPer, goal, goals, ...o } = readStoredJson("planner.optIn", {}) || {};
    return { room: 1000, maxLb: 125, budget: 900, ...o, goals: [] };
  });
  const updateOptimizerInput = (o) =>
    setOptimizerInputState((p) => {
      const n = { ...p, ...o };
      writeStoredJson("planner.optIn", n);
      return n;
    });
  const [optimizerLocks, setOptimizerLocksState] = useState(() => {
    const l = readStoredJson("planner.locks", {}) || {};
    return { ...l, subDim: { ...(l.subDim || {}) }, midDim: { ...(l.midDim || {}) } };
  });
  const setOptimizerLocks = (f) =>
    setOptimizerLocksState((p) => {
      const n = f(p);
      writeStoredJson("planner.locks", n);
      return n;
    });
  const renderLockButton = (key, what) =>
    isOptimizerOn ? (
      <LockButton
        on={!!optimizerLocks[key]}
        what={what}
        onClick={() => setOptimizerLocks((p) => ({ ...p, [key]: !p[key] }))}
      />
    ) : null;
  const renderDimensionLock = (box, dim, what) =>
    isOptimizerOn ? (
      <DimensionLock
        mode={optimizerLocks[box][dim] || "free"}
        what={what}
        onChange={(m) => setOptimizerLocks((p) => ({ ...p, [box]: { ...p[box], [dim]: m } }))}
      />
    ) : null;
  const [optimizerResult, setOptimizerResult] = useState(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizerError, setOptimizerError] = useState("");
  const [designPreview, setDesignPreview] = useState(null); // { label, before }
  const [undoSnapshot, setUndoSnapshot] = useState(null);
  const [toastMessage, setToastMessage] = useState("");
  // ---- optimizer actions ----
  const today = () => new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const startOptimizerSearch = async (over) => {
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
      setOptimizerError("The search failed: " + ((e && e.message) || e));
    }
    setIsOptimizing(false);
  };
  // a result only sets the fields the search changes; finish, colours, layout and balance stay as they are now
  const previewOptimizerResult = (k) => {
    const before = designPreview ? designPreview.before : snapshot();
    restore({ ...snapshot(), ...pickOptimizedFields(k.config) });
    setDesignPreview({ label: k.label, before, card: k });
  };
  const exitPreview = () => {
    if (designPreview) restore(designPreview.before);
    setDesignPreview(null);
  };
  const loadOptimizerResult = async (k) => {
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
  const saveOptimizerResult = async (k) => {
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
