// The Speaker page's way to run the Speaker optimizer: in its worker, or on the main thread where workers are blocked.
// `runSpeakerOptimizer(input, { onProgress, signal })` resolves with the result; a new run with an aborted signal is
// canceled (lib/makeOptimizerRunner).
import { optimizeSpeakerInput } from "./optimizeSpeaker";
import { makeOptimizerRunner } from "../../makeOptimizerRunner";
import OptimizerWorker from "./optimize.worker.ts?worker&inline";
import type { SpeakerOptimizerInput, SpeakerOptimizerResult } from "../../../types";

export const runSpeakerOptimizer = makeOptimizerRunner<
  SpeakerOptimizerInput,
  SpeakerOptimizerResult
>(OptimizerWorker, optimizeSpeakerInput);
