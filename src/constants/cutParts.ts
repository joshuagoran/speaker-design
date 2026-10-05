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
  ductShelf: "Duct shelf",
  ductFin: "Duct fin",
  ductRearWall: "Duct rear wall",
  sideDuctWall: "Side duct wall",
  ductDivider: "Duct divider",
  slotShelf: "Slot shelf",
} as const;

/** Every box a cutlist part belongs to, by id (`CutPart.box`), and the name the cutlist shows for it. */
export const CUT_BOX_NAMES = {
  sub: "Sub",
  mid: "Mid",
  hifi: "Hi-fi",
} as const;

/**
 * The letter each box's parts are tagged with: a row of the cutlist and its pieces on the sheet drawings share a tag
 * (S1, S2 … for the sub, M1 … for the mid, H1 … for the Hi-fi speaker), so a row is easy to find on the sheets and back.
 */
export const CUT_BOX_TAGS: Record<keyof typeof CUT_BOX_NAMES, string> = {
  sub: "S",
  mid: "M",
  hifi: "H",
};

/** The palette tint each box's tags and pieces are filled with, so a row's tag and its pieces on the sheets match. */
export const CUT_BOX_TINTS = {
  sub: "subTint",
  mid: "midTint",
  hifi: "subTint",
} as const satisfies Record<keyof typeof CUT_BOX_NAMES, string>;

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
