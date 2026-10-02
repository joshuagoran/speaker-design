// Runs the optimizer off the main thread. runOptimizer.ts imports it with ?worker&inline, so Vite bundles it into the page.
import { optimizeHifiSpeaker } from "./optimize.ts";
self.onmessage = (e) => {
  const { id, input } = e.data;
  try {
    self.postMessage({ id, out: optimizeHifiSpeaker(input) });
  } catch (err) {
    self.postMessage({ id, error: String((err && err.message) || err) });
  }
};
