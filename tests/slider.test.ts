import { test } from "vite-plus/test";
import assert from "node:assert";
import { rangesOnSteps, snapToRanges } from "../src/components/ui/Slider";
import { ductFit } from "../src/lib/pa/chips";
import { vent } from "./helpers";

test("slider ranges: edges move inward to the steps, and a range with no step drops out", () => {
  assert.deepEqual(
    rangesOnSteps(
      [
        [0, 18.25],
        [22.25, 43.75],
        [50.1, 50.2],
      ],
      3,
      60,
      0.5,
    ),
    [
      [3, 18],
      [22.5, 43.5],
    ],
  );
});
test("slider ranges: stepping or dragging into a gap jumps across it, the way it moves", () => {
  const r = [
    [3, 18],
    [22.5, 43.5],
  ] as const;
  assert.equal(snapToRanges(r, 18, 18.5), 22.5); // one step up past the straight slot: the shortest fold
  assert.equal(snapToRanges(r, 22.5, 22), 18); // one step down from it: back to the longest straight slot
  assert.equal(snapToRanges(r, 10, 20), 22.5); // dragged up into the gap
  assert.equal(snapToRanges(r, 30, 20), 18); // dragged down into it
  assert.equal(snapToRanges(r, 20, 19), 18); // from a saved length in the gap
  assert.equal(snapToRanges(r, 40, 45), 43.5); // never past the longest fold
  assert.equal(snapToRanges(r, 10, 12.5), 12.5);
  assert.equal(snapToRanges([], 10, 12.5), 12.5);
});
test("slider ranges: a bottom slot's duct lengths skip the ones that fit neither way", () => {
  // 24 × 30 × 22, 3 in slot, 3/4 in ply: straight to 18.25, folded from 22.25 to 43.75
  const { spans } = ductFit({ w: 24, h: 30, d: 22 }, "slots", vent({ slotH: 3, len: 14 }), 0.75);
  const r = rangesOnSteps(spans, 3, 50, 0.5);
  assert.deepEqual(r, [
    [3, 18],
    [22.5, 43.5],
  ]);
  assert.equal(snapToRanges(r, 18, 18.5), 22.5);
});
