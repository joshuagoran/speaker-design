import { test } from "vite-plus/test";
import assert from "node:assert";
import { foldedSlotInnerEnd, modalInnerEnd, straightSlotInnerEnd } from "./slot-flow";
import { SHARP_BEND_CORRECTION, SLOT_INNER_END } from "../src/data/acoustics/slot-inner-end";
import { slotMouthCorrection } from "../src/lib/pa/calc";

// The slot inner-end table and the potential-flow solver behind it (tests/slot-flow.ts). The table's own points are
// solved on the table's grid (16 cells a slot height, graded); the other checks use a coarser one (8 cells a slot
// height) so they stay quick: the two grids agree to within 2–3 %.

test("slot flow: with the space over the shelf walled off it is the modal (piston) correction, a little under it", () => {
  // a uniform piston bounds the flow's mass from above (the real flow is not uniform across the mouth)
  for (const gap of [1, 2, 4]) {
    const flow = straightSlotInnerEnd({ t: 0.25, span: 9.5, gap, run: 4 }, 8, true);
    const modal = modalInnerEnd(1, 9.5, gap);
    assert.ok(flow < modal && flow > 0.97 * modal, `gap ${gap}: ${flow} vs ${modal}`);
  }
});
test("slot inner-end table: the solver gives its values back", { timeout: 60_000 }, () => {
  const { gap, span, wall, run, ecOverH } = SLOT_INNER_END;
  // every 29th point of the table (29 is prime to every axis's length, so the sample walks all of them), and its corners
  const points: [number, number, number, number][] = [];
  const size = gap.length * span.length * wall.length * run.length;
  for (let k = 0; k < size; k += 29) {
    const d = k % run.length,
      c = Math.floor(k / run.length) % wall.length,
      b = Math.floor(k / run.length / wall.length) % span.length,
      a = Math.floor(k / run.length / wall.length / span.length);
    points.push([a, b, c, d]);
  }
  for (const a of [0, gap.length - 1])
    for (const b of [0, span.length - 1])
      for (const c of [0, wall.length - 1])
        for (const d of [0, run.length - 1]) points.push([a, b, c, d]);
  for (const [a, b, c, d] of points) {
    const flow = straightSlotInnerEnd({
      t: wall[c],
      span: 1 / span[b],
      gap: 1 / gap[a],
      run: run[d],
    });
    const table = ecOverH[a][b][c][d];
    // the table keeps three decimals
    assert.ok(Math.abs(flow - table) < 0.00051, `${a} ${b} ${c} ${d}: ${flow} vs ${table}`);
    // and the planner reads the table at its own points
    assert.ok(
      Math.abs(
        slotMouthCorrection(3, 3 / span[b], 3 / gap[a], 3 * wall[c], 3 * run[d]) - 3 * table,
      ) < 1e-9,
    );
  }
});
test("slot flow: a folded slot's inner end is its mouth's (turned on its side) plus a sharp 90° bend's", () => {
  // the floor leg turns into the rear channel as a mitered bend of equal widths: about 0.44 slot heights under the
  // centerline (0.42 on this grid), whatever the rise and the box
  for (const [span, height, wall] of [
    [6, 9.5, 2],
    [6, 9.5, 5],
    [8, 7, 3],
  ]) {
    const fold = foldedSlotInnerEnd({ t: 0.25, span, height, wall }, 8);
    const run = Math.max(wall - 0.25, 1);
    const mouth = straightSlotInnerEnd({ t: 0.25, span, gap: height - 1 - wall, run }, 8);
    assert.ok(Math.abs(fold - mouth - SHARP_BEND_CORRECTION) < 0.04, `${fold} - ${mouth}`);
  }
});
