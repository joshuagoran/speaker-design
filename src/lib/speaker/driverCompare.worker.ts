// Runs the Speaker page's driver comparison off the main thread. runDriverCompare.ts imports it with ?worker&inline, so
// Vite bundles it into the page.
import { runOptions, type DriverCompareInput, type DriverCompareRun } from "./driverCompare";
import type { OptimizerRequest, OptimizerResponse } from "../../types";
// Under the DOM lib `self` is a Window, whose onmessage and one-argument postMessage match what a worker does.
self.onmessage = (e: MessageEvent<OptimizerRequest<DriverCompareInput>>) => {
  const { id, input } = e.data;
  try {
    self.postMessage({ id, out: runOptions(input) } satisfies OptimizerResponse<
      DriverCompareRun[]
    >);
  } catch (err) {
    // boundary cast: a catch variable is unknown; whatever was thrown is read for a message
    self.postMessage({
      id,
      error: String((err && (err as Error).message) || err),
    } satisfies OptimizerResponse<DriverCompareRun[]>);
  }
};
