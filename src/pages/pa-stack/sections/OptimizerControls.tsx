import { Button } from "../../../components/ui/Button";
import { OptimizerPanel } from "../../../components/optimizer/OptimizerPanel";
import { OptimizerBar } from "../../../components/optimizer/OptimizerBar";
import type { PaPlanner } from "../hooks/usePaPlanner";
import { FONT } from "../../../styles/fonts";

interface Props {
  planner: Pick<
    PaPlanner,
    | "db"
    | "isOptimizerOn"
    | "setIsOptimizerOn"
    | "optimizerInput"
    | "updateOptimizerInput"
    | "lockBar"
    | "optimizerResult"
    | "isOptimizing"
    | "optimizerError"
    | "optimizerProgress"
    | "cancelOptimizerSearch"
    | "runningMode"
    | "fullGridLines"
    | "designPreview"
    | "undoSnapshot"
    | "toastMessage"
    | "setToastMessage"
    | "startOptimizerSearch"
    | "retryOptimizerSearch"
    | "previewOptimizerResult"
    | "exitPreview"
    | "loadOptimizerResult"
    | "undoOptimizerLoad"
    | "saveOptimizerResult"
    | "currentDesignOutput"
  >;
}

/** Optimizer switch and lock-all buttons, the optimizer panel, the preview banner and the result toast. */
export function OptimizerControls({ planner }: Props) {
  const {
    db,
    isOptimizerOn,
    setIsOptimizerOn,
    optimizerInput,
    updateOptimizerInput,
    lockBar,
    optimizerResult,
    isOptimizing,
    optimizerError,
    optimizerProgress,
    cancelOptimizerSearch,
    runningMode,
    fullGridLines,
    designPreview,
    undoSnapshot,
    toastMessage,
    setToastMessage,
    startOptimizerSearch,
    retryOptimizerSearch,
    previewOptimizerResult,
    exitPreview,
    loadOptimizerResult,
    undoOptimizerLoad,
    saveOptimizerResult,
    currentDesignOutput,
  } = planner;
  return (
    <>
      <section className="max-w-6xl mx-auto px-4 md:px-8 pb-3" style={{ fontFamily: FONT }}>
        <OptimizerBar
          on={isOptimizerOn}
          onToggle={() => setIsOptimizerOn(!isOptimizerOn)}
          hint="Find cheaper, lighter or louder designs inside your limits."
          {...lockBar}
        />
      </section>
      {isOptimizerOn && (
        <OptimizerPanel
          optIn={optimizerInput}
          setOpt={updateOptimizerInput}
          run={startOptimizerSearch}
          runFull={() => startOptimizerSearch(undefined, "full")}
          retry={retryOptimizerSearch}
          runningMode={runningMode}
          fullGridLines={fullGridLines}
          busy={isOptimizing}
          progress={optimizerProgress}
          onCancel={cancelOptimizerSearch}
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
          style={{ fontFamily: FONT }}
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
          style={{ fontFamily: FONT }}
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
