// Runs the optimizer off the main thread. runOptimizer.ts imports it with ?worker&inline, so Vite bundles it into the page.
import { optimizePaStack } from "./optimize";
import type { OptimizerMessage, OptimizerRequest, OptimizerResponse } from "../../types";
// Under the DOM lib `self` is a Window, whose onmessage and one-argument postMessage match what a worker does.
self.onmessage = (e: MessageEvent<OptimizerRequest>) => {
  const { id, input } = e.data;
  try {
    // progress goes out as it comes (the search passes it on about ten times a second), then the result
    const out = optimizePaStack(input, (progress) =>
      self.postMessage({ id, progress } satisfies OptimizerMessage),
    );
    self.postMessage({ id, out } satisfies OptimizerResponse);
  } catch (err) {
    // boundary cast: a catch variable is unknown; whatever was thrown is read for a message, as before
    self.postMessage({
      id,
      error: String((err && (err as Error).message) || err),
    } satisfies OptimizerResponse);
  }
};
