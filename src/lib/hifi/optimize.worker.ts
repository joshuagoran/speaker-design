// Runs the optimizer off the main thread. runOptimizer.ts imports it with ?worker&inline, so Vite bundles it into the page.
// A job is either one share of the box step (several workers run these at once) or the rest of the search on the shares.
import { runHifiJob } from "./optimize";
import type {
  HifiOptimizerJob,
  HifiOptimizerJobResult,
  OptimizerMessage,
  OptimizerRequest,
  OptimizerResponse,
} from "../../types";
// Under the DOM lib `self` is a Window, whose onmessage and one-argument postMessage match what a worker does.
self.onmessage = (e: MessageEvent<OptimizerRequest<HifiOptimizerJob>>) => {
  const { id, input } = e.data;
  try {
    // progress goes out as it comes (the box step passes it on about ten times a second), then the result
    const out = runHifiJob(input, (progress) =>
      self.postMessage({ id, progress } satisfies OptimizerMessage<HifiOptimizerJobResult>),
    );
    self.postMessage({ id, out } satisfies OptimizerResponse<HifiOptimizerJobResult>);
  } catch (err) {
    // boundary cast: a catch variable is unknown; whatever was thrown is read for a message, as before
    self.postMessage({
      id,
      error: String((err && (err as Error).message) || err),
    } satisfies OptimizerResponse<HifiOptimizerJobResult>);
  }
};
