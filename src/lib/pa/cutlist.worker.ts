// Packs the cutlist off the main thread, one job per worker. runCutlist.ts imports it with ?worker&inline, so Vite
// bundles it into the page. There is no time cap here: the full search always finishes, so the result depends only on
// the input, and a stale job is stopped by terminating its worker.
import { SEARCH_RUNS, layoutCutlist } from "./cutlist";
import type {
  CutlistLayout,
  CutlistRequest,
  OptimizerRequest,
  OptimizerResponse,
} from "../../types";
// Under the DOM lib `self` is a Window, whose onmessage and one-argument postMessage match what a worker does.
self.onmessage = (e: MessageEvent<OptimizerRequest<CutlistRequest>>) => {
  const { id, input } = e.data;
  try {
    self.postMessage({
      id,
      out: layoutCutlist(input.parts, input.settings, {
        runs: SEARCH_RUNS,
        countsOnly: input.countsOnly,
      }),
    } satisfies OptimizerResponse<CutlistLayout>);
  } catch (err) {
    // boundary cast: a catch variable is unknown; whatever was thrown is read for a message
    self.postMessage({
      id,
      error: String((err && (err as Error).message) || err),
    } satisfies OptimizerResponse<CutlistLayout>);
  }
};
