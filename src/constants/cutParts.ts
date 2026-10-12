import type { ChamberCutBoxId, CutBoxId, NamedCutBoxId } from "../types";

/**
 * Every cutlist part's id and the name the cutlist shows for it. Parts carry the id (`CutPart.part`), so code decides
 * on the id and never on the name; pages look the name up here.
 */
export const CUT_PART_NAMES = {
  side: "Side",
  topBottom: "Top / bottom",
  bottom: "Bottom",
  sideTopSideStrip: "Side-top-side strip",
  back: "Back",
  baffle: "Baffle",
  baffleCleat: "Baffle cleat",
  windowBrace: "Window brace",
  rib: "Rib",
  ductShelf: "Duct shelf",
  ductFin: "Duct fin",
  ductRearWall: "Duct rear wall",
  sideDuctWall: "Side duct wall",
  ductDivider: "Duct divider",
  slotShelf: "Slot shelf",
  partition: "Partition",
  archTop: "Arched top",
} as const;

/**
 * Every named box a cutlist part belongs to, by id (`CutPart.box`), and the name the cutlist shows for it: the PA's and
 * the Hi-fi's boxes, and the Speaker page's shell (one shell round chambers that share it). A Speaker-page chamber's parts
 * carry its own id (`chamberCutBox`).
 */
export const CUT_BOX_NAMES = {
  sub: "Sub",
  mid: "Mid",
  hifi: "Hi-fi",
  shell: "Shell",
} as const;

/**
 * The letter each box's parts are tagged with: a row of the cutlist and its pieces on the sheet drawings share a tag
 * (S1, S2 … for the sub, M1 … for the mid, H1 … for the Hi-fi speaker), so a row is easy to find on the sheets and back.
 * The Speaker page's shell is K; its chambers are A, B, C … in order (`cutBoxTag`).
 */
export const CUT_BOX_TAGS: Record<keyof typeof CUT_BOX_NAMES, string> = {
  sub: "S",
  mid: "M",
  hifi: "H",
  shell: "K",
};

/** The palette tint each box's tags and pieces are filled with, so a row's tag and its pieces on the sheets match. */
export const CUT_BOX_TINTS = {
  sub: "subTint",
  mid: "midTint",
  hifi: "subTint",
  // the Speaker page's shell in the light gray, apart from its chambers' tints
  shell: "edge",
} as const satisfies Record<keyof typeof CUT_BOX_NAMES, string>;

/** Each named box's heading over its rows in the cutlist. */
const CUT_BOX_HEADINGS = {
  sub: "Sub box",
  mid: "Mid box",
  hifi: "Hi-fi box",
  shell: "Shell",
} as const satisfies Record<keyof typeof CUT_BOX_NAMES, string>;

/** The Speaker page's shell box: the parts of one shell round chambers that share it. */
export const SHELL_CUT_BOX = "shell" satisfies keyof typeof CUT_BOX_NAMES;

/** The prefix of a Speaker-page chamber's cutlist box id: "chamber1", "chamber2" … */
const CHAMBER_CUT_BOX = "chamber";
/** The tag letters the Speaker page's chambers take in order. */
const CHAMBER_TAG_LETTERS = "ABCDEFGHIJ";

/** The cutlist box id of the Speaker page's chamber at index `i` (its place in the cabinet). */
export const chamberCutBox = (i: number): ChamberCutBoxId => `${CHAMBER_CUT_BOX}${i + 1}`;
/** Whether a box id is a named box (`CUT_BOX_NAMES`), not a Speaker-page chamber's. */
const isNamedBox = (box: CutBoxId): box is NamedCutBoxId => Object.hasOwn(CUT_BOX_NAMES, box);
/** A Speaker-page chamber box id's index in the cabinet. */
const chamberIndexOf = (box: ChamberCutBoxId) => Number(box.slice(CHAMBER_CUT_BOX.length)) - 1;

/** The name the cutlist shows for a box: a named box's, or "Chamber 2". */
export const cutBoxName = (box: CutBoxId): string =>
  isNamedBox(box) ? CUT_BOX_NAMES[box] : `Chamber ${chamberIndexOf(box) + 1}`;
/** A box's heading over its rows in the cutlist: a named box's, or "Chamber 2". */
export const cutBoxHeading = (box: CutBoxId): string =>
  isNamedBox(box) ? CUT_BOX_HEADINGS[box] : cutBoxName(box);
/** The letter a box's rows are tagged with: a named box's, or its chamber's (A, B …; past J, its number and a dot). */
export function cutBoxTag(box: CutBoxId): string {
  if (isNamedBox(box)) return CUT_BOX_TAGS[box];
  const i = chamberIndexOf(box);
  return CHAMBER_TAG_LETTERS[i] ?? `${i + 1}.`;
}
/** The tint a box's tags and pieces take: a named box's, or the chambers' in turn (the mid's, then the sub's). */
export const cutBoxTint = (box: CutBoxId): (typeof CUT_BOX_TINTS)[NamedCutBoxId] =>
  isNamedBox(box)
    ? CUT_BOX_TINTS[box]
    : chamberIndexOf(box) % 2 === 0
      ? CUT_BOX_TINTS.mid
      : CUT_BOX_TINTS.sub;

/** Each panel material's names on the Cutlist page: in a sentence, after a thickness (3/4″ ply), and as a column head. */
export const PANEL_MATERIAL_NAMES = {
  ply: { word: "plywood", short: "ply", column: "Ply" },
  mdf: { word: "MDF", short: "MDF", column: "MDF" },
} as const;

/**
 * How a panel's face grain can look on the box, by id, and the name the Cutlist grain settings show for it: each panel
 * offers two of these for its sides along the grain, and `any` lets the layout turn it.
 */
export const GRAIN_LOOK_NAMES = {
  vertical: "Vertical",
  horizontal: "Horizontal",
  across: "Across",
  frontToBack: "Front-to-back",
  any: "Any",
} as const;
export type GrainLook = keyof typeof GRAIN_LOOK_NAMES;

/** The panels a driver, a vent or a passive radiator is cut into, by id (their cutlist part ids). */
export const PANEL = {
  baffle: "baffle",
  back: "back",
  side: "side",
} as const satisfies Record<string, keyof typeof CUT_PART_NAMES>;
