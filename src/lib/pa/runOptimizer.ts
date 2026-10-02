import { optimizePaStack } from "./optimize.ts";
import { makeOptimizerRunner } from "../makeOptimizerRunner.ts";
// the optimizer's worker, bundled separately by Vite and inlined in the page (it starts from a Blob URL)
import OptimizerWorker from "./optimize.worker.ts?worker&inline";

export const runPaOptimizer = makeOptimizerRunner(OptimizerWorker, optimizePaStack);
