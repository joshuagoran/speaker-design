import { runHifiJob } from "./optimize";
import { makeOptimizerRunner } from "../makeOptimizerRunner";
import OptimizerWorker from "./optimize.worker.ts?worker&inline";
import type { HifiOptimizerInput, HifiOptimizerResult } from "../../types";

// the box step splits across this many workers (each its own runner, so each falls back to the page on its own)
const PARTS = Math.max(
  1,
  Math.min(4, (typeof navigator !== "undefined" && navigator.hardwareConcurrency) || 1),
);
const runners = Array.from({ length: PARTS }, () =>
  makeOptimizerRunner(OptimizerWorker, runHifiJob),
);

/** The Hi-fi search: the box step in parts on several workers, then the rest on the first. */
export async function runHifiOptimizer(input: HifiOptimizerInput): Promise<HifiOptimizerResult> {
  const t0 = Date.now();
  const shares = await Promise.all(
    runners.map((run, part) => run({ kind: "score", input, part, parts: PARTS })),
  );
  const scored = shares.flatMap((r) => (r.kind === "scored" ? [r.scored] : []));
  const done = await runners[0]({ kind: "select", input, scored });
  if (done.kind !== "result") throw new Error("the search returned no result");
  // the time the whole search took, not only its last job
  return { ...done.result, stats: { ...done.result.stats, ms: Date.now() - t0 } };
}
