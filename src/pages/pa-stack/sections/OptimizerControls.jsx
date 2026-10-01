import { Button } from "../../../components/ui/Button.jsx";
import { LOCK_KEYS } from "../../../constants/lockKeys.js";
import { OptimizerPanel } from "../../../components/optimizer/OptimizerPanel.jsx";
import { OptimizerBar } from "../../../components/optimizer/OptimizerBar.jsx";

/** Optimizer switch and lock-all buttons, the optimizer panel, the preview banner and the result toast. */
export function OptimizerControls({ planner }) {
  const {
    db,
    isOptimizerOn,
    setIsOptimizerOn,
    optimizerInput,
    updateOptimizerInput,
    optimizerLocks,
    setOptimizerLocks,
    optimizerResult,
    isOptimizing,
    optimizerError,
    designPreview,
    undoSnapshot,
    toastMessage,
    setToastMessage,
    startOptimizerSearch,
    previewOptimizerResult,
    exitPreview,
    loadOptimizerResult,
    undoOptimizerLoad,
    saveOptimizerResult,
    currentDesignOutput,
  } = planner;
  return (
    <>
      <section
        className="max-w-6xl mx-auto px-4 md:px-8 pb-3"
        style={{ fontFamily: "var(--font)" }}
      >
        {(() => {
          const n = Object.entries(optimizerLocks).reduce(
            (a, [k, v]) =>
              a +
              (k.endsWith("Dim")
                ? Object.values(v).filter((m) => m && m !== "free").length
                : v
                  ? 1
                  : 0),
            0,
          );
          /** lock everything (box sizes exact), then unlock the one or two things you want the optimizer to change */
          const all = {
            ...Object.fromEntries(LOCK_KEYS.map((k) => [k, true])),
            subDim: { w: "exact", h: "exact", d: "exact" },
            midDim: { w: "exact", h: "exact", d: "exact" },
          };
          return (
            <OptimizerBar
              on={isOptimizerOn}
              onToggle={() => setIsOptimizerOn(!isOptimizerOn)}
              hint="Find cheaper, lighter or louder designs inside your limits."
              nLocks={n}
              lockMax={LOCK_KEYS.length + 6}
              onLockAll={() => setOptimizerLocks(() => all)}
              onClear={() => setOptimizerLocks(() => ({ subDim: {}, midDim: {} }))}
            />
          );
        })()}
      </section>
      {isOptimizerOn && (
        <OptimizerPanel
          optIn={optimizerInput}
          setOpt={updateOptimizerInput}
          run={startOptimizerSearch}
          busy={isOptimizing}
          res={optimizerResult}
          err={optimizerError}
          curOut={currentDesignOutput}
          previewCard={designPreview && designPreview.card}
          canSave={!!db}
          onPreview={previewOptimizerResult}
          onLoad={loadOptimizerResult}
          onSave={saveOptimizerResult}
        />
      )}
      {designPreview && (
        <div
          className="fixed top-0 inset-x-0 z-50 bg-stone-900 text-white border-b-4 border-cmy-y px-4 py-2 flex flex-wrap items-center justify-center gap-3 text-sm"
          style={{ fontFamily: "var(--font)" }}
        >
          <span>
            Previewing: <b className="font-semibold">{designPreview.label}</b>
          </span>
          <Button
            variant="primary"
            size="xs"
            onClick={() => loadOptimizerResult(designPreview.card)}
          >
            Load
          </Button>
          <button
            onClick={exitPreview}
            className="px-3 py-1.5 rounded border border-stone-900 bg-white"
          >
            Back
          </button>
        </div>
      )}
      {toastMessage && (
        <div
          className="fixed left-1/2 -translate-x-1/2 bottom-20 md:bottom-6 z-50 w-[calc(100%-2rem)] max-w-xl bg-stone-900 text-stone-50 rounded-lg px-4 py-2.5 flex items-center gap-3 text-sm shadow-lg"
          style={{ fontFamily: "var(--font)" }}
          role="status"
        >
          <span className="flex-1">{toastMessage}</span>
          {undoSnapshot && (
            <button
              onClick={undoOptimizerLoad}
              className="px-3 py-1.5 rounded border border-stone-500"
            >
              Undo
            </button>
          )}
          <button
            onClick={() => setToastMessage("")}
            aria-label="Dismiss"
            className="px-2 py-1.5 rounded border border-stone-900"
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}
