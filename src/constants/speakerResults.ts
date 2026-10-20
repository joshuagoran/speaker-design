// The Speaker page's results pane (src/pages/speaker): the saving row's nouns, the 2D views' ids and words, the checks' row
// labels and the Details fold's bullets. It imports nothing, so the Node checks (tests/mobile-check.mjs) can read it.

/**
 * The 2D drawing's views, by id: the speaker seen from the front, cut through its center from the side, or cut through
 * each chamber's middle height from above.
 */
export const SPEAKER_VIEW = { front: "front", side: "side", top: "top" } as const;
export type SpeakerView = (typeof SPEAKER_VIEW)[keyof typeof SPEAKER_VIEW];

/** Each 2D view's button. */
export const SPEAKER_VIEW_NAMES = {
  front: "Front",
  side: "Side",
  top: "Top",
} as const satisfies Record<SpeakerView, string>;

/** The line under each 2D view. */
export const SPEAKER_VIEW_HINTS = {
  front: "Drag a driver to move it.",
  side: "Cut through the center. Front at the left.",
  top: "Cut through the middle. Front at the bottom.",
} as const satisfies Record<SpeakerView, string>;

/**
 * A driver position's axes, by id (the spec's `position` keeps x and y; a horn on the top keeps its depth in y): across
 * from the chamber's center line, up from its bottom, back from its front edge.
 */
export const POSITION_AXIS = { across: "across", up: "up", back: "back" } as const;
export type PositionAxis = (typeof POSITION_AXIS)[keyof typeof POSITION_AXIS];

/** The saving row's nouns on the Speaker page (`SaveRowWords`, constants/saveRow). */
export const SPEAKER_SAVE_WORDS = {
  namePlaceholder: "Speaker name",
  savedList: "Saved Speakers",
  pick: (n: number) => `Saved Speakers (${n})`,
  noSaved: "No saved Speakers yet",
  newFromTip: "Starts a new Speaker from a template. It replaces the current design.",
} as const;

/** The checks' row labels: a band's, by its name, and a chamber's, by its place. */
export const CHECK_ROW_TEXT = {
  band: (name: string) => `${name} band`,
  chamber: (n: number) => `Chamber ${n}`,
  /** the checks' group name, as screen readers hear it */
  checks: "Checks",
} as const;

/** A chamber's bracing tile, by its place (absent with one chamber), and its value with no bracing. */
export const BRACING_TILE_TEXT = {
  label: (n: number | null) => (n === null ? "Bracing" : `Bracing ${n}`),
  none: "None",
  /** the unit after the count of window braces and ribs (Details lists each kind) */
  unit: "braces",
} as const;

/** The bracing check on each braced chamber: its title and its tooltip, with the target in words. */
export const BRACING_CHIP_TEXT = {
  meets: "Braced to target",
  meetsTip: (target: string) => `Every panel is above ${target}.`,
  under: "Under bracing target",
  underTip: (target: string) =>
    `Not enough braces fit round the drivers, the vent and the horn. Some panels stay under ${target}, or over a strength limit. Details lists them.`,
} as const;

/** The Details fold's groups, by chart, and their bullets: short sentences, one fact each. */
export const SPEAKER_DETAILS_TEXT = {
  response: "Response",
  responseLines: [
    "On axis, at 1 m, in half space.",
    "Every band gets 2.83 V.",
    "It does not include the baffle step, the room or the driver positions yet.",
    "The Space page adds them.",
  ],
  fbLine: "Fb marks the tuning of each ported chamber.",
  maxOutput: "Maximum output",
  maxOutputLines: [
    "On axis, at 1 m.",
    "Each band gets the full power of its amp, up to its first limit.",
    "The limits are cone travel, port air speed, radiator travel, the program rating (2 × AES) and the amp.",
    "You set the port air speed limit in the chamber.",
    "The max of a band is for music, with one drive for the whole band.",
    "The sum uses one input for all bands.",
    "A band limits the sum only where the band has signal.",
  ],
  price: "Price",
  priceLines: [
    "The total of the purchased parts: drivers, horns, radiators, port tubes and hardware.",
    "It does not include the plywood.",
    "The Cutlist tab lists every part.",
  ],
  partialLine: "Some parts have no price. The real total is higher (+).",
  bracing: "Bracing and weight",
  /** a braced chamber's rule, by its place and its target in words */
  bracedLine: (n: number, target: string) =>
    `Chamber ${n} gets braces until every panel is above ${target}.`,
  /** a braced chamber's braces, by its place and the braces in words */
  bracesLine: (n: number, braces: string) => `Chamber ${n}: ${braces}.`,
  unbracedLine: (n: number) =>
    `Chamber ${n} has no bracing: no braces in the cutlist, the weight or the net air.`,
  underLine: (n: number, target: string) =>
    `Chamber ${n} does not get to ${target}. Not enough braces fit.`,
  netAirLine:
    "The net air subtracts the braces, the vent walls, the baffle cleats and the hardware.",
  weightLine: "The weight includes the panels, braces, drivers, horns, radiators and hardware.",
  views: "Views",
  viewsLines: [
    "Front: the speaker seen from the front.",
    "Side: cut through the center, the front at the left.",
    "Top: each chamber cut through its middle height, the front at the bottom.",
    "Top: stacked chambers show one above the other, the highest at the top.",
    "Top: a drawn fold shows the boards where the cut crosses them.",
    "Top: a dashed vent or horn is below or above the cut.",
    "Each driver shows in the color of its band.",
  ],
  /** a straight horn in the Side and Top views */
  hornLines: [
    "Side and Top show a straight horn cut through its center.",
    "The walls of a horn follow its flare sections.",
    "They start just in front of the cones and cover their outer parts.",
    "In Top, the dashed box is the front chamber, between the cones and the back edges of the walls.",
    "A folded path turns at the walls.",
    "A slot on a front side runs back along the side wall.",
  ],
  checks: "Checks",
  checksLines: [
    "Each chip shows its full text in its tooltip.",
    "Green is OK, orange needs a check, red needs a change.",
  ],
} as const;
