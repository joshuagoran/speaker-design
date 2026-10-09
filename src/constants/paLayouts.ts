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
