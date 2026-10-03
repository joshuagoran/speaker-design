import { SEARCH_CAP_MS, SEARCH_RUNS, layoutCutlist } from "./cutlist";
import { makeOptimizerRunner } from "../makeOptimizerRunner";
import type { CutlistRequest } from "../../types";
// the packer's worker, bundled separately by Vite and inlined in the page (it starts from a Blob URL)
import CutlistWorker from "./cutlist.worker.ts?worker&inline";

/** Lays out the cutlist with the full search in a worker, or on the main thread where workers are unavailable. */
export const runCutlistLayout = makeOptimizerRunner(CutlistWorker, (r: CutlistRequest) =>
  layoutCutlist(r.parts, r.settings, { runs: SEARCH_RUNS, capMs: SEARCH_CAP_MS }),
);
