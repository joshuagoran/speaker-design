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

/** The strength checks' loads, as the notes name them (lib/strength). */
export const STRENGTH_LOAD_NAMES = {
  pressure: "the driver's pressure",
  lid: "a load on the lid",
} as const;
/**
 * The note under the Bracing setting for a panel over a strength limit: the panel's name with its cabinet, its stress,
 * the limit and the load, already in words.
 */
export const strengthNote = (panel: string, stress: string, limit: string, load: string) =>
  `${panel}: ${stress} under ${load}, over its ${limit} limit`;

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
  screwed:
    "Removable back: screwed into the rabbet and the window braces' rails; its edges count as hinged.",
  glued: "Glued like the other panels: the joints hold its edges.",
} as const satisfies Record<keyof typeof BACK_JOINT_NAMES, string>;
/** The back joint a design takes when none is chosen: screwed, the safe side. */
export const DEFAULT_BACK_JOINT = "screwed" satisfies keyof typeof BACK_JOINT_NAMES;
/** A glued back: its joints hold its edges (a screwed back's don't); the window braces hold either. */
export const GLUED_BACK = "glued" satisfies keyof typeof BACK_JOINT_NAMES;
/** Each choice in the Build fold's summary line. */
export const BACK_JOINT_SUMMARY = {
  screwed: "screwed back",
  glued: "glued back",
} as const satisfies Record<keyof typeof BACK_JOINT_NAMES, string>;
/** The cutlist's back panel, by its joint: how it goes into the rear rabbet. */
export const BACK_JOINT_CUT_NOTES = {
  screwed: "screwed into the rear rabbet, no glue (it comes off): seal it with foam tape",
  glued: "glued into the rear rabbet",
} as const satisfies Record<keyof typeof BACK_JOINT_NAMES, string>;
/**
 * A screwed back's screws into each window brace's rear rail: their spacing along the rail (in) and their diameter
 * (mm, a #8 wood screw). The cutlist's note names the spacing; the bracing rule's jointed rail (lib/bracing
 * jointedTeeBeam) reads both.
 */
export const BACK_RAIL_SCREW_SPACING_IN = 6;
export const BACK_RAIL_SCREW_DIAMETER_MM = 4.2;
/**
 * The cutlist's back panel where window braces' rear rails meet it, by its joint: a screwed back screws into each rail
 * too (the rule counts the rails as holding it); a glued one needs no more than its row says.
 */
export const BACK_JOINT_RAIL_NOTES = {
  screwed: `screw it into each window brace's rear rail too, about every ${BACK_RAIL_SCREW_SPACING_IN}″, with foam tape on the rails (no glue)`,
  glued: null,
} as const satisfies Record<keyof typeof BACK_JOINT_NAMES, string | null>;
/** How the tower's partitions meet its back, by the back's joint (their cutlist row). */
export const BACK_JOINT_PARTITION_NOTES = {
  screwed:
    "glue and screw to the sides, the baffle to their front edges; the back screws to their rear edges (foam tape, no glue)",
  glued: "glue and screw to the sides and back, the baffle to their front edges",
} as const satisfies Record<keyof typeof BACK_JOINT_NAMES, string>;
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
