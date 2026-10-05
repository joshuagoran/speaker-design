import type { PortStyle } from "../types";

/**
 * The sub's rectangular vent layouts, by port style id, and the name the vent picker shows for each. Code decides on
 * the id.
 */
export const SLOT_LAYOUT_NAMES = {
  slots: "Bottom",
  vslots: "Both sides",
  vslot1: "One side",
} as const satisfies Partial<Record<PortStyle, string>>;

/**
 * The retired "Bottom, folded" layout's id. A bottom slot (`slots`) now folds up the back wall by itself when it is too
 * long to run straight, so saved designs and share links with this id load as `slots`.
 */
export const RETIRED_FOLDED_PORT_STYLE = "folded";
/** A saved design's port style as the planner takes it: the retired folded layout becomes the bottom slot. */
export const savedPortStyle = (style: PortStyle | typeof RETIRED_FOLDED_PORT_STYLE): PortStyle =>
  style === RETIRED_FOLDED_PORT_STYLE ? "slots" : style;
