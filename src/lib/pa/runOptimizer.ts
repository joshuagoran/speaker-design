import { optimizePaStack } from "./optimize";
import { runPaExactJob } from "./optimizeExact";
import { makeOptimizerRunner } from "../makeOptimizerRunner";
// the optimizers' workers, bundled separately by Vite and inlined in the page (they start from Blob URLs)
import OptimizerWorker from "./optimize.worker.ts?worker&inline";
import ExactWorker from "./optimizeExact.worker.ts?worker&inline";
import type {
  OptimizerProgress,
  OptimizerRunOptions,
  PaOptimizerInput,
  PaOptimizerResult,
  PaRunMode,
} from "../../types";

export const runPaOptimizer = makeOptimizerRunner(OptimizerWorker, optimizePaStack);

// the exact search's model step splits across this many workers (each its own runner, so each falls back to the page
// on its own)
const PARTS = Math.max(
  1,
  Math.min(4, (typeof navigator !== "undefined" && navigator.hardwareConcurrency) || 1),
);
// the search step can go a while between reports (one card slot's search), so the stall guard waits longer
const EXACT_STALL_MS = 120_000;
const exactRunners = Array.from({ length: PARTS }, () =>
  makeOptimizerRunner(ExactWorker, runPaExactJob, EXACT_STALL_MS),
);

// the model step's share of the progress bar; the search step, whose work grows as it goes, has the rest
const MODEL_SHARE = 0.3;

/**
 * The exact search (Fully optimize): the model step in parts on several workers, then the search on the first. Progress
 * is a share of a fixed 1000: every part's model work summed, then the search step's units settled; it never goes back
 * when the search step finds more to settle. The signal cancels every part.
 */
export async function runPaExactOptimizer(
  input: PaOptimizerInput,
  { onProgress, signal }: OptimizerRunOptions = {},
): Promise<PaOptimizerResult> {
  const t0 = Date.now();
  let shown = 0;
  const show = (share: number, best?: string) => {
    shown = Math.max(shown, Math.min(1, share));
    onProgress?.({ done: Math.round(1000 * shown), total: 1000, best });
  };
  const parts: OptimizerProgress[] = exactRunners.map(() => ({ done: 0, total: 0 }));
  const shares = await Promise.all(
    exactRunners.map((go, part) =>
      go(
        { kind: "score", input, part, parts: PARTS },
        {
          signal,
          onProgress: (p) => {
            parts[part] = p;
            let done = 0,
              total = 0;
            for (const q of parts) {
              done += q.done;
              total += q.total;
            }
            if (total) show((MODEL_SHARE * done) / total);
          },
        },
      ),
    ),
  );
  const scored = shares.flatMap((r) => (r.kind === "scored" ? [r.scored] : []));
  const done = await exactRunners[0](
    { kind: "select", input, scored },
    {
      signal,
      onProgress: (p) =>
        show(MODEL_SHARE + (p.total ? ((1 - MODEL_SHARE) * p.done) / p.total : 0), p.best),
    },
  );
  if (done.kind !== "result") throw new Error("the search returned no result");
  // the time the whole search took, not only its last job
  return { ...done.result, stats: { ...done.result.stats, ms: Date.now() - t0 } };
}

/** The PA searches by run mode. */
export const PA_RUNNERS: Record<
  PaRunMode,
  (input: PaOptimizerInput, options?: OptimizerRunOptions) => Promise<PaOptimizerResult>
> = { improve: runPaOptimizer, full: runPaExactOptimizer };
