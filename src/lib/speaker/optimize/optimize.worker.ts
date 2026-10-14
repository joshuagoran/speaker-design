// Runs the Speaker optimizer off the main thread. runOptimizer.ts imports it with ?worker&inline, so Vite bundles it into
// the page.
import { optimizeSpeakerInput } from "./optimizeSpeaker";
import type {
  OptimizerMessage,
  OptimizerRequest,
  OptimizerResponse,
  SpeakerOptimizerInput,
  SpeakerOptimizerResult,
} from "../../../types";
// Under the DOM lib `self` is a Window, whose onmessage and one-argument postMessage match what a worker does.
self.onmessage = (e: MessageEvent<OptimizerRequest<SpeakerOptimizerInput>>) => {
  const { id, input } = e.data;
  try {
    // progress goes out as it comes (the search passes it on about ten times a second), then the result
    const out = optimizeSpeakerInput(input, (progress) =>
      self.postMessage({ id, progress } satisfies OptimizerMessage<SpeakerOptimizerResult>),
    );
    self.postMessage({ id, out } satisfies OptimizerResponse<SpeakerOptimizerResult>);
  } catch (err) {
    // boundary cast: a catch variable is unknown; whatever was thrown is read for a message
    self.postMessage({
      id,
      error: String((err && (err as Error).message) || err),
    } satisfies OptimizerResponse<SpeakerOptimizerResult>);
  }
};
