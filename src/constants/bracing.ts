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
  ribs: "Edge strips on the walls only. No rib can cross the driver.",
  window: "Plywood frames across the box only. No ribs.",
  both: "Frames and ribs, whichever adds more stiffness per wood.",
} as const satisfies Record<keyof typeof BRACE_STYLE_NAMES, string>;

/** Each style in a folded settings section's summary line ("braced with …"). */
export const BRACE_STYLE_SUMMARY = {
  ribs: "ribs",
  window: "window braces",
  both: "ribs and window braces",
} as const satisfies Record<keyof typeof BRACE_STYLE_NAMES, string>;

/**
 * The note under the Bracing setting for each panel left under the target: the panel's name with its cabinet
 * ("Sub baffle"), its first mode and the target, already in words.
 */
export const braceUnderNote = (panel: string, hz: string, target: string) =>
  `${panel}: ${hz}, under the ${target} target`;

/**
 * The note under the Bracing setting when the driver's weight rocks the baffle under the target (BoxBracing's
 * driverOnBaffleHz): the cabinet ("Sub") and that mode, already in words.
 */
export const driverOnBaffleNote = (cabinet: string, hz: string) =>
  `${cabinet} driver on the baffle: ${hz} with its weight on the cutout; a brace from the magnet to the back holds it`;

/** The end of a cutlist rib row whose rib crosses a window brace. */
export const RIB_HALF_LAP_NOTE = "; half-lap it where it crosses a window brace";

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

/**
 * How the back panel is fixed: glued, its edges held by the panels round it like the others', or screwed on (to take
 * it off for the wiring), its edges hinged.
 */
export const BACK_JOINT_NAMES = {
  screwed: "Screwed",
  glued: "Glued",
} as const;
/** What each choice does, for its button's tooltip. */
export const BACK_JOINT_TIPS = {
  screwed: "Removable back: its edges count as hinged, so it takes more bracing.",
  glued: "Glued like the other panels: the joints hold its edges.",
} as const satisfies Record<keyof typeof BACK_JOINT_NAMES, string>;
/** The back joint a design takes when none is chosen: screwed, the safe side. */
export const DEFAULT_BACK_JOINT = "screwed" satisfies keyof typeof BACK_JOINT_NAMES;
/** A saved design's back joint: one of the ids, else absent (the default). */
export const savedBackJoint = (s: unknown) => keysOf(BACK_JOINT_NAMES).find((k) => k === s);

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
