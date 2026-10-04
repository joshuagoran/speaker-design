import { runHifiJob } from "./optimize";
import { makeOptimizerRunner } from "../makeOptimizerRunner";
import { throttledProgress } from "../optimizer/progress";
import OptimizerWorker from "./optimize.worker.ts?worker&inline";
import type {
  HifiOptimizerInput,
  HifiOptimizerResult,
  OptimizerProgress,
  OptimizerRunOptions,
} from "../../types";

// the box step splits across this many workers (each its own runner, so each falls back to the page on its own)
const PARTS = Math.max(
  1,
  Math.min(4, (typeof navigator !== "undefined" && navigator.hardwareConcurrency) || 1),
);
const runners = Array.from({ length: PARTS }, () =>
  makeOptimizerRunner(OptimizerWorker, runHifiJob),
);
/** the select step's share of the progress bar: the last few % (it reports nothing of its own) */
const SELECT_SHARE = 0.05;

/**
 * The Hi-fi search: the box step in parts on several workers, then the rest on the first. Progress is every part's boxes
 * done of their grids, summed, with the select step as the last few %; the signal cancels every part.
 */
let runs = 0;
export async function runHifiOptimizer(
  input: HifiOptimizerInput,
  { onProgress, signal }: OptimizerRunOptions = {},
): Promise<HifiOptimizerResult> {
  const t0 = Date.now(),
    run = `${t0}-${++runs}`;
  const report = throttledProgress(onProgress);
  const parts: OptimizerProgress[] = runners.map(() => ({ done: 0, total: 0 }));
  const sum = (final = false) => {
    let done = 0,
      total = 0;
    for (const p of parts) {
      done += p.done;
      total += p.total;
    }
    report(done, total + Math.ceil(total * SELECT_SHARE), final);
  };
  // the first worker keeps its own share for the select job it runs next; the others send theirs over
  const shares = await Promise.all(
    runners.map((go, part) =>
      go(
        { kind: "score", input, part, parts: PARTS, keep: part === 0 ? run : undefined },
        {
          signal,
          onProgress: (p) => {
            parts[part] = p;
            sum();
          },
        },
      ),
    ),
  );
  sum(true);
  const scored = shares.slice(1).flatMap((r) => (r.kind === "scored" ? [r.scored] : []));
  const done = await runners[0](
    {
      kind: "select",
      input,
      scored,
      kept: { run, part: 0, parts: PARTS },
    },
    { signal },
  );
  if (done.kind !== "result") throw new Error("the search returned no result");
  // the time the whole search took, not only its last job
  return { ...done.result, stats: { ...done.result.stats, ms: Date.now() - t0 } };
}
