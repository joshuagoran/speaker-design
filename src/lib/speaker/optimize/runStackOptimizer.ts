// The Stack page's way to run the Stack optimizer: in its worker, or on the main thread where workers are blocked.
// `runStackOptimizer(input, { onProgress, signal })` resolves with the result; a new run with an aborted signal is
// canceled (lib/makeOptimizerRunner).
import { optimizeStackInput } from "./optimizeStack";
import { makeOptimizerRunner } from "../../makeOptimizerRunner";
import StackOptimizerWorker from "./optimizeStack.worker.ts?worker&inline";
import type { StackOptimizerInput, StackOptimizerResult } from "../../../types";

export const runStackOptimizer = makeOptimizerRunner<StackOptimizerInput, StackOptimizerResult>(
  StackOptimizerWorker,
  optimizeStackInput,
);
