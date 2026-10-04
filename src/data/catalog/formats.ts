// System sizes for the PA planner: sub and mid diameters in inches.
// To add one, append to the table; the compiler checks the shape (Format in src/types.ts).
import type { Format } from "../../types";

export const FORMATS: readonly Format[] = [
  {
    id: "full",
    name: 'Full — 18" sub, 12" mid',
    sub: 18,
    mid: 12,
    note: "~110-123 lb sub depending on cabinet. System F3 ~37 Hz, ~121 dB at 35 Hz per box. The show system.",
  },
  {
    id: "mid",
    name: 'Middle — 15" sub, 12" mid',
    sub: 15,
    mid: 12,
    note: "19 in square footprint, ~80 lb sub, 62 in stack. About 3 dB down on the 18. Best compromise if home use matters.",
  },
  {
    id: "compact",
    name: 'Compact — 15" sub, 10" mid',
    sub: 15,
    mid: 10,
    note: "Smallest boxes, 10 in mid is 3 dB down on the 12. Fits a room; least headroom outdoors.",
  },
];
