// Computes the Space page's floor map off the main thread. runSpace.ts imports it with ?worker&inline, so Vite bundles it into the page.
import { computeSpaceGrid, type SpaceGridRequest } from "./spaceCoverage";
import type { CoverageGrid, OptimizerRequest, OptimizerResponse } from "../../types";
// Under the DOM lib `self` is a Window, whose onmessage and one-argument postMessage match what a worker does.
self.onmessage = (e: MessageEvent<OptimizerRequest<SpaceGridRequest>>) => {
  const { id, input } = e.data;
  try {
    self.postMessage({
      id,
      out: computeSpaceGrid(input),
    } satisfies OptimizerResponse<CoverageGrid>);
  } catch (err) {
    // boundary cast: a catch variable is unknown; whatever was thrown is read for a message
    self.postMessage({
      id,
      error: String((err && (err as Error).message) || err),
    } satisfies OptimizerResponse<CoverageGrid>);
  }
};
