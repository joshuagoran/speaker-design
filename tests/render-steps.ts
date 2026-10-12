// Runs a hook through steps without a DOM: tests/box-fit.test.ts and tests/old-saves.test.ts drive the pages' hooks so.
import assert from "node:assert";
import { createElement } from "react";
import { renderToString } from "react-dom/server";

/** Renders `use` once per step, each step's state updates rendering it again for the next. */
export function runSteps<T>(use: () => T, steps: ((hook: T) => void)[]) {
  let done = 0;
  function Probe() {
    const hook = use();
    if (done < steps.length) steps[done++](hook);
    return null;
  }
  renderToString(createElement(Probe));
  assert.equal(done, steps.length, "every step ran");
}
