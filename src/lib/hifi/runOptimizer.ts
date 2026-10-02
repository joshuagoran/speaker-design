import { optimizeHifiSpeaker } from "./optimize.ts";
import { makeOptimizerRunner } from "../makeOptimizerRunner.ts";
import OptimizerWorker from "./optimize.worker.ts?worker&inline";

export const runHifiOptimizer = makeOptimizerRunner(OptimizerWorker, optimizeHifiSpeaker);
