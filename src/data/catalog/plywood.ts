// Panel stock: the plywood sheet sizes the cutlist packs onto (w and h in inches, name as the picker shows it) and the
// nominal panel sizes the design pages pick from, with each material's default thickness and weight.
// To add a sheet size, add its id to PlywoodSheetKind (src/types.ts) and an entry here. To add a nominal size, add its
// id and name to PANEL_NOMINAL_NAMES (src/constants/panelSizes.ts): the compiler then requires its entry here.
import type { PanelNominal, PanelStock, PlywoodSheet, PlywoodSheetKind } from "../../types";

export const PLYWOOD_SHEETS: Record<PlywoodSheetKind, PlywoodSheet> = {
  "4x8": { w: 48, h: 96, name: "4 × 8 ft" },
  "5x5": { w: 60, h: 60, name: "5 × 5 ft" },
};

/**
 * Each nominal size, thickest first: `in` the imperial size (inches) and `mm` the metric one it is paired with; for
 * birch plywood (`ply`) and MDF (`mdf`), the thickness the boxes are worked out at until the Cutlist page has a
 * measured one (`t`, inches) and the panel's weight at that thickness (`lb`, lb/ft²). Both start at the imperial size:
 * plywood at its nominal size, MDF because it is milled to its full size. The PA baffle stays 3/4″ whatever the walls.
 */
export const PANEL_STOCK: Record<PanelNominal, PanelStock> = {
  "3/4": { in: 0.75, mm: 18, ply: { t: 0.75, lb: 2.3 }, mdf: { t: 0.75, lb: 3.4 } },
  "5/8": { in: 0.625, mm: 15, ply: { t: 0.625, lb: 1.95 }, mdf: { t: 0.625, lb: 2.85 } },
  "1/2": { in: 0.5, mm: 12, ply: { t: 0.5, lb: 1.6 }, mdf: { t: 0.5, lb: 2.3 } },
};
