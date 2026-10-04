// Plywood sheet sizes the cutlist packs onto: w and h in inches, name as the picker shows it.
// To add a size, add its id to PlywoodSheetKind (src/types.ts) and an entry here; the compiler checks both match.
import type { PlywoodSheet, PlywoodSheetKind } from "../../types";

export const PLYWOOD_SHEETS: Record<PlywoodSheetKind, PlywoodSheet> = {
  "4x8": { w: 48, h: 96, name: "4 × 8 ft" },
  "5x5": { w: 60, h: 60, name: "5 × 5 ft" },
};
