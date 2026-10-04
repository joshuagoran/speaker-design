// Mid box presets for the PA planner: outer inches {w, h, d}; size limits a box to one mid size (10 | 12 | 15).
// To add one, append to MID_BOXES; the compiler checks the shape (MidBox in src/types.ts).
import type { MidBox } from "../../types";

/** The 12 in mid's starting box. */
export const B15: MidBox = {
  id: "b15",
  name: "15 × 15 × 15 in",
  box: { w: 15, h: 15, d: 15 },
  note: "Cube. Exceeds the RX-28 width guidance; fine under a round ATH horn.",
};

/** The 15 in mid's starting box. */
export const B18: MidBox = {
  id: "b18",
  size: 15,
  name: "18 × 18 × 16 in",
  box: { w: 18, h: 18, d: 16 },
  note: "~60 L for a 15.",
};

export const MID_BOXES: readonly MidBox[] = [
  {
    id: "b14",
    name: "14 × 14 × 18 in",
    box: { w: 14, h: 14, d: 18 },
    note: "Within the RX-28's 14.2\" width limit at 1100 Hz.",
  },
  {
    id: "b13",
    name: "13 × 13 × 13 in",
    box: { w: 13, h: 13, d: 13 },
    note: 'Cube for a 10" mid, ~25 L sealed.',
  },
  B15,
  {
    id: "b17",
    size: 15,
    name: "17 × 17 × 14 in",
    box: { w: 17, h: 17, d: 14 },
    note: "Smallest practical face for a 15, ~45 L.",
  },
  B18,
];
