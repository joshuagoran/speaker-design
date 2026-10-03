// Computes the floor map off the main thread. runCoverage.ts imports it with ?worker&inline, so Vite bundles it into the page.
import { computeCoverageGrid } from "./coverage";
import type {
  CoverageGrid,
  CoverageRequest,
  OptimizerRequest,
  OptimizerResponse,
} from "../../types";
// Under the DOM lib `self` is a Window, whose onmessage and one-argument postMessage match what a worker does.
self.onmessage = (e: MessageEvent<OptimizerRequest<CoverageRequest>>) => {
  const { id, input } = e.data;
  try {
    self.postMessage({
      id,
      out: computeCoverageGrid(input),
    } satisfies OptimizerResponse<CoverageGrid>);
  } catch (err) {
    // boundary cast: a catch variable is unknown; whatever was thrown is read for a message
    self.postMessage({
      id,
      error: String((err && (err as Error).message) || err),
    } satisfies OptimizerResponse<CoverageGrid>);
  }
};
