// Cabinet finishes for the 3-D view: named wood finishes (color / inner are 0xRRGGBB, rough 0–1, swatch a CSS hex)
// and paint swatches [hex, name]. To add one, extend the table; the compiler checks it (src/types.ts).
import type { CabinetFinish, FinishId, PaintSwatch } from "../../types";

export const PAINT_SWATCHES: readonly PaintSwatch[] = [
  ["#e8b4a8", "Dusty pink"],
  ["#2b2725", "Near black"],
  ["#c8cdc4", "Pale sage"],
  ["#eeff00", "Acid yellow"],
  ["#8fa3ad", "Slate blue"],
  ["#b23a2f", "Oxide red"],
  ["#efe8dc", "Bone"],
  ["#4a5d4e", "Deep green"],
];

export const CABINET_FINISHES: Record<FinishId, CabinetFinish> = {
  birch: { name: "Birch", color: 0xd7b98a, inner: 0xc9a875, rough: 0.85, swatch: "#d7b98a" },
  walnut: { name: "Walnut", color: 0x5c3a24, inner: 0x4f3220, rough: 0.7, swatch: "#5c3a24" },
};
