/**
 * Bracing ids and the names the pages show for them (lib/bracing works the braces out). Code decides on the ids, the
 * pages look the names up here.
 */
import { keysOf } from "../lib/records";

/** How a box is braced: ribs on edge along the panels, window braces across the box, or whichever lifts more per inch³. */
export const BRACE_STYLE_NAMES = {
  ribs: "Ribs",
  window: "Window braces",
  both: "Both",
} as const;

/** What each style does, for its button's tooltip. */
export const BRACE_STYLE_TIPS = {
  ribs: "Strips glued on edge along the sides, top, bottom and back, meeting in rings; the baffle, which a rib can't cross for the driver, takes window braces where they clear it",
  window:
    "Plywood frames across the box with the centre cut out, glued to the walls, placed clear of the driver and the vent; a panel no frame can reach takes ribs",
  both: "Ribs or window braces, whichever lifts the panels more for the wood, one at a time",
} as const satisfies Record<keyof typeof BRACE_STYLE_NAMES, string>;

/** Each style in a folded settings section's summary line ("braced with …"). */
export const BRACE_STYLE_SUMMARY = {
  ribs: "ribs",
  window: "window braces",
  both: "ribs and window braces",
} as const satisfies Record<keyof typeof BRACE_STYLE_NAMES, string>;

/** A box's panels, as the bracing readout names them (left and right as you face the baffle). */
export const BRACE_PANEL_NAMES = {
  sideL: "Left side",
  sideR: "Right side",
  top: "Top",
  bottom: "Bottom",
  back: "Back",
  baffle: "Baffle",
} as const;

/** The axes of a box, inches from its inside corner: across the width, up the height, back from the baffle. */
export const BOX_AXIS_NAMES = {
  x: "across",
  y: "up",
  z: "front to back",
} as const;

/** A saved design's brace style: one of the ids, else absent (the plywood's default). */
export const savedBraceStyle = (s: unknown) => keysOf(BRACE_STYLE_NAMES).find((k) => k === s);
