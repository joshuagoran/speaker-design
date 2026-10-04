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
} as const;

/** Every box a cutlist part belongs to, by id (`CutPart.box`), and the name the cutlist shows for it. */
export const CUT_BOX_NAMES = {
  sub: "Sub",
  mid: "Mid",
} as const;
