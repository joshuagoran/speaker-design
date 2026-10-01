// Runs the optimizer off the main thread. runOptimizer.js imports it with ?worker&inline, so Vite bundles it into the page.
import { optimizePaStack } from "./optimize.js";
self.onmessage = (e) => {
  const { id, input } = e.data;
  try {
    self.postMessage({ id, out: optimizePaStack(input) });
  } catch (err) {
    self.postMessage({ id, error: String((err && err.message) || err) });
  }
};
