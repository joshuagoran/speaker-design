// Panel stock: the plywood sheet sizes the cutlist packs onto (w and h in inches, name as the picker shows it) and the
// panel weights the box weights use (lb/ft² per thickness in inches: birch plywood, and MDF for the Hi-fi boxes).
// To add a sheet size, add its id to PlywoodSheetKind (src/types.ts) and an entry here. To add a thickness, add it to
// PanelThickness (src/types.ts): the compiler then requires its plywood and MDF weights here.
import type { PanelThickness, PlywoodSheet, PlywoodSheetKind } from "../../types";

export const PLYWOOD_SHEETS: Record<PlywoodSheetKind, PlywoodSheet> = {
  "4x8": { w: 48, h: 96, name: "4 × 8 ft" },
  "5x5": { w: 60, h: 60, name: "5 × 5 ft" },
};

/** Birch plywood weight, lb/ft². The baffle stays 3/4″ either way. */
export const PLYWOOD_LB_PER_SQ_FT: Record<PanelThickness, number> = { 0.75: 2.3, 0.5: 1.6 };

/** MDF weight, lb/ft². */
export const MDF_LB_PER_SQ_FT: Record<PanelThickness, number> = { 0.75: 3.4, 0.5: 2.3 };
