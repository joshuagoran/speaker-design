// Runs the exact PA search off the main thread. runOptimizer.ts imports it with ?worker&inline, so Vite bundles it into
// the page. A job is either one share of the model step (several workers run these at once) or the search on the shares.
import { runPaExactJob } from "./optimizeExact";
import type {
  OptimizerMessage,
  OptimizerRequest,
  OptimizerResponse,
  PaExactJob,
  PaExactJobResult,
} from "../../types";
// Under the DOM lib `self` is a Window, whose onmessage and one-argument postMessage match what a worker does.
self.onmessage = (e: MessageEvent<OptimizerRequest<PaExactJob>>) => {
  const { id, input } = e.data;
  try {
    // progress goes out as it comes (the search passes it on about ten times a second), then the result
    const out = runPaExactJob(input, (progress) =>
      self.postMessage({ id, progress } satisfies OptimizerMessage<PaExactJobResult>),
    );
    self.postMessage({ id, out } satisfies OptimizerResponse<PaExactJobResult>);
  } catch (err) {
    // boundary cast: a catch variable is unknown; whatever was thrown is read for a message, as before
    self.postMessage({
      id,
      error: String((err && (err as Error).message) || err),
    } satisfies OptimizerResponse<PaExactJobResult>);
  }
};
