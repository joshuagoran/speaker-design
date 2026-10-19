// The default PA design's mid box: outer inches {w, h, d}; `size` limits a box to one mid size (10 | 12 | 15).
// The compiler checks the shape (MidBox in src/types.ts).
import type { MidBox } from "../../types";

/** The 12 in mid's starting box. */
export const B15: MidBox = {
  id: "b15",
  name: "15 × 15 × 15 in",
  box: { w: 15, h: 15, d: 15 },
  note: "Cube. Exceeds the RX-28 width guidance; fine under a round ATH horn.",
};
