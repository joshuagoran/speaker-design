// The Designer's starting points (src/pages/designer/designerStarts): their ids, names and the controls that pick one.
// It imports nothing, so the Node checks (tests/mobile-check.mjs, tests/three-memory-check.mjs) can read it.

/** Where a new design starts, by id. */
export const DESIGNER_START = {
  empty: "empty",
  hifi: "hifi",
  paSub: "paSub",
  paTop: "paTop",
  paTower: "paTower",
} as const;
export type DesignerStart = (typeof DESIGNER_START)[keyof typeof DESIGNER_START];

/** What each start shows. */
export const DESIGNER_START_NAMES = {
  empty: "Empty speaker",
  hifi: "The Hi-fi design",
  paSub: "The PA design's sub",
  paTop: "The PA design's mid/high box",
  paTower: "The PA design's tower",
} as const satisfies Record<DesignerStart, string>;

/** The name a new design takes, by start (a saved speaker keeps its own). */
export const DESIGNER_START_SPEAKER_NAMES = {
  empty: "New speaker",
  hifi: "Hi-fi speaker",
  paSub: "PA sub",
  paTop: "PA mid/high box",
  paTower: "PA tower",
} as const satisfies Record<DesignerStart, string>;

/** The start picker's label and its button (the Node checks find them by these). */
export const DESIGNER_START_TEXT = {
  startFrom: "Start from",
  startOver: "Start over from this",
} as const;
