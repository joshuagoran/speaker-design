import { computeSpaceGrid } from "./spaceCoverage";
import { makeOptimizerRunner } from "../makeOptimizerRunner";
// the Space page's floor map worker, bundled separately by Vite and inlined in the page (it starts from a Blob URL)
import SpaceWorker from "./space.worker.ts?worker&inline";

/** Computes a space's floor map in the worker (on the main thread where workers are unavailable). */
export const runSpaceGrid = makeOptimizerRunner(SpaceWorker, computeSpaceGrid);
