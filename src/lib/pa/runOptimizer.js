import { optimizePaStack } from "./optimize.js";
import { makeOptimizerRunner } from "../makeOptimizerRunner.js";
// the optimizer's worker, bundled separately by Vite and inlined in the page (it starts from a Blob URL)
import OptimizerWorker from "./optimize.worker.js?worker&inline";

export const runPaOptimizer = makeOptimizerRunner(OptimizerWorker, optimizePaStack);
