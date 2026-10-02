import { optimizeHifiSpeaker } from "./optimize";
import { makeOptimizerRunner } from "../makeOptimizerRunner";
import OptimizerWorker from "./optimize.worker.ts?worker&inline";

export const runHifiOptimizer = makeOptimizerRunner(OptimizerWorker, optimizeHifiSpeaker);
