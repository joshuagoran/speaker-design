import { computeCoverageGrid } from "./coverage";
import { makeOptimizerRunner } from "../makeOptimizerRunner";
// the floor map's worker, bundled separately by Vite and inlined in the page (it starts from a Blob URL)
import CoverageWorker from "./coverage.worker.ts?worker&inline";

/** Computes a floor map in the worker (on the main thread where workers are unavailable). */
export const runCoverageGrid = makeOptimizerRunner(CoverageWorker, computeCoverageGrid);
