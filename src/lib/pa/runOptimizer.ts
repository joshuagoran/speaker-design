import { optimizePaStack } from "./optimize";
import { makeOptimizerRunner } from "../makeOptimizerRunner";
// the optimizer's worker, bundled separately by Vite and inlined in the page (it starts from a Blob URL)
import OptimizerWorker from "./optimize.worker.ts?worker&inline";

export const runPaOptimizer = makeOptimizerRunner(OptimizerWorker, optimizePaStack);
