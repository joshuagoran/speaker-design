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
  ribs: "Edge strips in rings on the walls; window braces on the baffle.",
  window: "Plywood frames across the box; ribs where no frame reaches.",
  both: "Ribs or window braces, best gain per wood first",
} as const satisfies Record<keyof typeof BRACE_STYLE_NAMES, string>;

/** Each style in a folded settings section's summary line ("braced with …"). */
export const BRACE_STYLE_SUMMARY = {
  ribs: "ribs",
  window: "window braces",
  both: "ribs and window braces",
} as const satisfies Record<keyof typeof BRACE_STYLE_NAMES, string>;

/**
 * The notes under the Bracing setting where the rule couldn't do as the style says, by kind (`BraceFallback`): a panel
 * braced the other way, or left under the target. Each takes the panel's name with its cabinet ("Sub baffle") and, for
 * "under", the panel's first mode and the target, already in words.
 */
export const BRACE_FALLBACK_NOTES = {
  windows: (panel: string) => `${panel}: window braces (ribs can't cross the driver)`,
  ribs: (panel: string) => `${panel}: ribs (no window brace clears the driver or the vent)`,
  under: (panel: string, hz: string, target: string) => `${panel}: ${hz}, under ${target}`,
} as const;

/** A panel's name with its cabinet's, as the bracing notes start ("Sub baffle", "Mid left side"). */
export const bracePanelName = (cabinet: string, panel: keyof typeof BRACE_PANEL_NAMES) =>
  `${cabinet} ${BRACE_PANEL_NAMES[panel].toLowerCase()}`;

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

/** The field designs saved by earlier builds (one style per box) kept the sub's style in: it stands for the stack's. */
export const LEGACY_SUB_BRACE_STYLE_KEY = "subBraceStyle";

/** A saved design's brace style: one of the ids, else absent (the plywood's default). */
export const savedBraceStyle = (s: unknown) => keysOf(BRACE_STYLE_NAMES).find((k) => k === s);

/**
 * A saved design's style for the stack: its own, else (a save from earlier builds, one style per box) the sub's; each
 * taken only when it is a style, so a stale value under the new key doesn't hide a good one under the old.
 */
export const savedStackBraceStyle = (c: { braceStyle?: unknown }) =>
  savedBraceStyle(c.braceStyle) ?? savedBraceStyle(Reflect.get(c, LEGACY_SUB_BRACE_STYLE_KEY));
