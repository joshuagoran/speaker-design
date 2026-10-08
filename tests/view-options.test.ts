// The 3D view's cutaway is a view, like full screen (its card's own state, components/stack-view/Viewer3DCard): a PA
// design neither saves it nor loads it, and saves from before the move, which hold it, still load. The Hi-fi design
// saves its own look (the PA pickers' cabinet finish and baffle color), and older Hi-fi saves load with PA's defaults.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { usePaDesign, type PaDesign } from "../src/pages/pa-stack/hooks/usePaDesign";
import { useHifiPlanner, type HifiPlanner } from "../src/pages/hifi/useHifiPlanner";
import { DEFAULT_HIFI_LOOK, DEFAULT_PA } from "../src/lib/defaults";
import { PAINT_SWATCHES } from "../src/lib/data";

/** Renders `use` once per step, each step's state updates rendering it again for the next; returns the last value. */
function runSteps<T>(use: () => T, steps: ((hook: T) => void)[]) {
  let done = 0;
  function Probe() {
    const hook = use();
    if (done < steps.length) steps[done++](hook);
    return null;
  }
  renderToString(createElement(Probe));
  assert.equal(done, steps.length, "every step ran");
}

test("a PA design saves no cutaway, and a save from before the move (with one) loads, the field ignored", () => {
  const saved: ReturnType<PaDesign["snapshot"]>[] = [];
  runSteps(
    () => usePaDesign({ dispersionPlane: "h" }),
    [
      (h) => {
        const snap = h.snapshot();
        assert.ok(!("cutaway" in snap), "the snapshot has no cutaway");
        assert.notEqual(snap.layout, "tower");
        // an older save: the view's old field beside the design's
        const old: Record<string, unknown> = { ...snap, layout: "tower", cutaway: true };
        h.restore(old);
      },
      (h) => {
        const snap = h.snapshot();
        saved.push(snap);
        assert.equal(snap.layout, "tower", "the rest of the save loads");
        assert.ok(!("cutaway" in snap), "the old cutaway isn't carried on");
      },
    ],
  );
  assert.equal(saved.length, 1);
  assert.ok(!("cutaway" in DEFAULT_PA), "the defaults hold no cutaway");
});

test("a Hi-fi design saves its look, and an older save loads with PA's defaults", () => {
  const paint = PAINT_SWATCHES[0][0];
  runSteps<HifiPlanner>(useHifiPlanner, [
    (h) => {
      assert.equal(h.cabinetFinish, DEFAULT_PA.cabFinish, "PA's finish to start");
      assert.equal(h.baffleColor, DEFAULT_PA.baffleColor, "and PA's baffle color");
      h.setCabinetFinish(paint);
      h.setBaffleColor(paint);
    },
    (h) => {
      const snap = h.savedConfigSnapshot();
      assert.equal(snap.cabFinish, paint);
      assert.equal(snap.baffleColor, paint);
      // a save from before the look
      const { cabFinish: _f, baffleColor: _b, ...old } = snap;
      h.restoreSavedConfig(old);
    },
    (h) => {
      assert.equal(h.cabinetFinish, DEFAULT_HIFI_LOOK.cabFinish);
      assert.equal(h.baffleColor, DEFAULT_HIFI_LOOK.baffleColor);
    },
  ]);
});
