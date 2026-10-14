// Runs the Stack optimizer off the main thread. runStackOptimizer.ts imports it with ?worker&inline, so Vite bundles it
// into the page.
import { optimizeStackInput } from "./optimizeStack";
import type {
  OptimizerMessage,
  OptimizerRequest,
  OptimizerResponse,
  StackOptimizerInput,
  StackOptimizerResult,
} from "../../../types";
// Under the DOM lib `self` is a Window, whose onmessage and one-argument postMessage match what a worker does.
self.onmessage = (e: MessageEvent<OptimizerRequest<StackOptimizerInput>>) => {
  const { id, input } = e.data;
  try {
    // progress goes out as it comes (the search passes it on about ten times a second), then the result
    const out = optimizeStackInput(input, (progress) =>
      self.postMessage({ id, progress } satisfies OptimizerMessage<StackOptimizerResult>),
    );
    self.postMessage({ id, out } satisfies OptimizerResponse<StackOptimizerResult>);
  } catch (err) {
    // boundary cast: a catch variable is unknown; whatever was thrown is read for a message
    self.postMessage({
      id,
      error: String((err && (err as Error).message) || err),
    } satisfies OptimizerResponse<StackOptimizerResult>);
  }
};
