import { test } from "vite-plus/test";
import assert from "node:assert";
import { foldedSlotInnerEnd, modalInnerEnd, straightSlotInnerEnd } from "./slot-flow";
import { SHARP_BEND_CORRECTION, SLOT_INNER_END } from "../src/data/acoustics/slot-inner-end";
import { slotMouthCorrection } from "../src/lib/pa/calc";

// The slot inner-end table and the potential-flow solver behind it (tests/slot-flow.ts), at a coarser grid than the
// table's (8 cells a slot height, not 16) so the checks stay quick; the two grids agree to within 2–3 %.

test("slot flow: with the space over the shelf walled off it is the modal (piston) correction, a little under it", () => {
  // a uniform piston bounds the flow's mass from above (the real flow is not uniform across the mouth)
  for (const gap of [1, 2, 4]) {
    const flow = straightSlotInnerEnd({ t: 0.25, span: 9.5, gap, run: 4 }, 8, true);
    const modal = modalInnerEnd(1, 9.5, gap);
    assert.ok(flow < modal && flow > 0.97 * modal, `gap ${gap}: ${flow} vs ${modal}`);
  }
});
test("slot inner-end table: the solver gives its values back", () => {
  const { gap, span, wall, run, ecOverH } = SLOT_INNER_END;
  // (a quarter-slot gap, the last row, is only two cells on this grid, and the thinnest shelf half a cell)
  for (const [a, b, c, d] of [
    [3, 3, 2, 3],
    [6, 4, 1, 4],
    [8, 5, 3, 1],
    [7, 3, 2, 5],
    [5, 7, 2, 3],
    [6, 6, 4, 2],
  ] as const) {
    const flow = straightSlotInnerEnd(
      { t: wall[c], span: 1 / span[b], gap: 1 / gap[a], run: run[d] },
      8,
    );
    const table = ecOverH[a][b][c][d];
    assert.ok(Math.abs(flow / table - 1) < 0.03, `${a} ${b} ${c} ${d}: ${flow} vs ${table}`);
    // and the planner reads the table at its own points
    assert.ok(
      Math.abs(
        slotMouthCorrection(3, 3 / span[b], 3 / gap[a], 3 * wall[c], 3 * run[d]) - 3 * table,
      ) < 1e-9,
    );
  }
});
test("slot flow: a folded slot's inner end is its mouth's (turned on its side) plus a sharp 90° bend's", () => {
  // the floor leg turns into the rear channel as a mitred bend of equal widths: about 0.44 slot heights under the
  // centreline (0.42 on this grid), whatever the rise and the box
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
