// The draft boundary's decisions (src/components/ui/DraftBoundary), without a DOM: the state a throw leaves, when the
// app starts again, what shows between, and what shows when the new start throws too.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import {
  boundaryAfterCatch,
  boundaryView,
  DraftBoundary,
  type BoundaryState,
} from "../src/components/ui/DraftBoundary";

const FRESH: BoundaryState = { failed: null, round: 0 };

test("draft boundary: a throw is held, and the first one starts the app again once", () => {
  const error = new Error("a draft broke it");
  const held = { ...FRESH, ...DraftBoundary.getDerivedStateFromError(error) };
  assert.deepEqual(held, { failed: { error }, round: 0 });
  // the first catch clears the throw and counts a start
  assert.deepEqual(boundaryAfterCatch(held), { failed: null, round: 1 });
  // a throw after that is not a draft's: the state stays, with the error held
  const again: BoundaryState = { failed: { error }, round: 1 };
  assert.strictEqual(boundaryAfterCatch(again), again);
});

test("draft boundary: what shows for each state", () => {
  const error = new Error("boom");
  assert.deepEqual(boundaryView(FRESH), { show: "app", draftFailed: false });
  // between the throw and the new start nothing renders (the broken tree is not rendered again)
  assert.deepEqual(boundaryView({ failed: { error }, round: 0 }), { show: "nothing" });
  // after a start, the app is told a draft was dropped
  assert.deepEqual(boundaryView({ failed: null, round: 1 }), { show: "app", draftFailed: true });
  // the new start threw too: the error goes on
  assert.deepEqual(boundaryView({ failed: { error }, round: 1 }), { show: "throw", error });
});

test("draft boundary: it renders the app, told no draft failed, until something throws", () => {
  const html = renderToString(
    createElement(DraftBoundary, { children: (failed) => (failed ? "dropped" : "fine") }),
  );
  assert.equal(html, "fine");
});
