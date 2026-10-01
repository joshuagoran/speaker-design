// Runs the optimizer off the main thread. build.sh bundles this and inlines it as text in the page.
import { optimize } from "./optimize.js";
self.onmessage = (e) => {
  const { id, input } = e.data;
  try {
    self.postMessage({ id, out: optimize(input) });
  } catch (err) {
    self.postMessage({ id, error: String((err && err.message) || err) });
  }
};
