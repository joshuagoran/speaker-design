// The Speaker page's way to run the driver comparison: in its worker (a woofer list takes well over 100 ms on the main
// thread), or on the main thread where workers are blocked. `runDriverCompare(input, { signal })` resolves with each
// option's run; an aborted signal cancels it (lib/makeOptimizerRunner).
import { runOptions, type DriverCompareInput, type DriverCompareRun } from "./driverCompare";
import { makeOptimizerRunner } from "../makeOptimizerRunner";
import CompareWorker from "./driverCompare.worker.ts?worker&inline";

export const runDriverCompare = makeOptimizerRunner<DriverCompareInput, DriverCompareRun[]>(
  CompareWorker,
  runOptions,
);
