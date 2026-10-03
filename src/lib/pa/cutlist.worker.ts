// Packs the cutlist off the main thread. runCutlist.ts imports it with ?worker&inline, so Vite bundles it into the page.
import { SEARCH_CAP_MS, SEARCH_RUNS, layoutCutlist } from "./cutlist";
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
      out: layoutCutlist(input.parts, input.settings, { runs: SEARCH_RUNS, capMs: SEARCH_CAP_MS }),
    } satisfies OptimizerResponse<CutlistLayout>);
  } catch (err) {
    // boundary cast: a catch variable is unknown; whatever was thrown is read for a message
    self.postMessage({
      id,
      error: String((err && (err as Error).message) || err),
    } satisfies OptimizerResponse<CutlistLayout>);
  }
};
