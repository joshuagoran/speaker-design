import type { PanelMaterial, PanelNominal } from "../types";

/**
 * The nominal panel sizes the PA plywood and Hi-fi thickness settings offer, by id: each pairs an imperial size with
 * the near-equal metric one sold beside it, under one name (`name`), and `short` is the imperial size alone, as a
 * thickness reads in a sentence. The boxes are worked out at the thickness the Cutlist page has measured for each
 * (`panelIn` in `src/lib/panel.ts`); the catalogue (`src/data/catalog/plywood.ts`) holds each size's weights.
 */
export const PANEL_NOMINAL_NAMES = {
  "3/4": { name: "¾″ / 18 mm", short: "¾″" },
  "5/8": { name: "⅝″ / 15 mm", short: "⅝″" },
  "1/2": { name: "½″ / 12 mm", short: "½″" },
} as const;

/** Plywood's material id: the PA stack's boxes are always plywood, and so is a Hi-fi config that names no material. */
export const PLYWOOD_MATERIAL = "ply" satisfies PanelMaterial;

/**
 * The PA side ducts' dividers' nominal size before one is picked, and the size designs saved before the choice load
 * at: two per duct, bracing its inner wall to the side wall across the throat.
 */
export const DUCT_DIVIDER_DEFAULT = "1/2" satisfies PanelNominal;
