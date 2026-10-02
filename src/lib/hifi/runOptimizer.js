import { optimizeHifiSpeaker } from "./optimize.js";
import { makeOptimizerRunner } from "../makeOptimizerRunner.js";
import OptimizerWorker from "./optimize.worker.js?worker&inline";

export const runHifiOptimizer = makeOptimizerRunner(OptimizerWorker, optimizeHifiSpeaker);
