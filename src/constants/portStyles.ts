import type { PortStyle } from "../types";

/**
 * The sub's rectangular vent layouts, by port style id, and the name the vent picker shows for each. Code decides on
 * the id; a chip that suggests another layout names it from here.
 */
export const SLOT_LAYOUT_NAMES = {
  slots: "Bottom",
  folded: "Bottom, folded",
  vslots: "Both sides",
  vslot1: "One side",
} as const satisfies Partial<Record<PortStyle, string>>;
