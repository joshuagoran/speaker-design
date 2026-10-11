import type { PaLayout } from "../types";

/** The PA stack's layouts, by id, and the name the layout picker and the settings summary show for each. */
export const PA_LAYOUT_NAMES = {
  stack: "Two stacks",
  pole: "Tops on spacers",
  tower: "Tower",
  satellite: "One sub + satellites",
} as const satisfies Record<PaLayout, string>;

/** The tower's mid chamber height, in: the chamber has the sub's footprint (lib/pa/tower `towerMidDims`). */
export const TOWER_MID_HEIGHT_IN = 15.5;

/** Gap between the sub's top and the mid box in the stack layout, in. */
export const MID_GAP_IN = 0.4;

/** Satellite layout: the stands' height, which is where the mid boxes sit, in. */
export const SATELLITE_COLUMN_H_IN = 34;
