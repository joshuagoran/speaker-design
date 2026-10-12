// The Designer's starting points (src/pages/designer/designerStarts, designerTemplates): their ids, names, groups and
// the controls that pick one. It imports nothing, so the Node checks (tests/mobile-check.mjs,
// tests/three-memory-check.mjs) can read it.

/**
 * The templates, by id: each builds a new speaker from the catalog and the defaults (src/pages/designer/
 * designerTemplates). A template sets only the first values; a saved speaker keeps no template or role.
 */
export const DESIGNER_TEMPLATE = {
  empty: "empty",
  paSubBox: "paSubBox",
  paMidHighBox: "paMidHighBox",
  paTowerBaffleHorn: "paTowerBaffleHorn",
  paTowerTopHorn: "paTowerTopHorn",
  hifiTwoWay: "hifiTwoWay",
  monitorCoax: "monitorCoax",
  monitorHorn: "monitorHorn",
  fill: "fill",
  paV2SubBinOne: "paV2SubBinOne",
  paV2SubBinTwo: "paV2SubBinTwo",
  paV2MidBox: "paV2MidBox",
} as const;
export type DesignerTemplate = (typeof DESIGNER_TEMPLATE)[keyof typeof DESIGNER_TEMPLATE];

/** The starts that read a design you have now (the L1 adapters), by id. */
export const DESIGNER_CURRENT_START = {
  hifi: "hifi",
  paSub: "paSub",
  paTop: "paTop",
  paTower: "paTower",
} as const;
export type DesignerCurrentStart =
  (typeof DESIGNER_CURRENT_START)[keyof typeof DESIGNER_CURRENT_START];

/** Where a new design starts, by id: a template, or a design you have now. */
export const DESIGNER_START = { ...DESIGNER_TEMPLATE, ...DESIGNER_CURRENT_START } as const;
export type DesignerStart = DesignerTemplate | DesignerCurrentStart;

/** What each start shows in the picker. */
export const DESIGNER_START_NAMES = {
  empty: "Empty speaker",
  paSubBox: "PA sub",
  paMidHighBox: "PA mid/high box",
  paTowerBaffleHorn: "PA tower, horn in the baffle",
  paTowerTopHorn: "PA tower, horn on top",
  hifiTwoWay: "Hi-fi 2-way",
  monitorCoax: "DJ booth monitor, coaxial",
  monitorHorn: "DJ booth monitor, woofer and small horn",
  fill: "Fill",
  paV2SubBinOne: "PA v2 sub bin, one driver",
  paV2SubBinTwo: "PA v2 sub bin, two drivers",
  paV2MidBox: "PA v2 mid box",
  hifi: "The Hi-fi design",
  paSub: "The PA design's sub",
  paTop: "The PA design's mid/high box",
  paTower: "The PA design's tower",
} as const satisfies Record<DesignerStart, string>;

/** The name a new design takes, by start (a saved speaker keeps its own). */
export const DESIGNER_START_SPEAKER_NAMES = {
  empty: "New speaker",
  paSubBox: "PA sub",
  paMidHighBox: "PA mid/high box",
  paTowerBaffleHorn: "PA tower",
  paTowerTopHorn: "PA tower",
  hifiTwoWay: "Hi-fi speaker",
  monitorCoax: "Booth monitor",
  monitorHorn: "Booth monitor",
  fill: "Fill",
  paV2SubBinOne: "Sub bin",
  paV2SubBinTwo: "Sub bin",
  paV2MidBox: "Mid box",
  hifi: "Hi-fi speaker",
  paSub: "PA sub",
  paTop: "PA mid/high box",
  paTower: "PA tower",
} as const satisfies Record<DesignerStart, string>;

/** The picker's groups: the templates, then the designs you have now. */
export const DESIGNER_START_GROUPS = {
  templates: "Templates",
  current: "Your current designs",
} as const;

/** The start picker's label and its button (the Node checks find them by these). */
export const DESIGNER_START_TEXT = {
  startFrom: "Start from",
  startOver: "Start over from this",
} as const;
