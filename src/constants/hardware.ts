/**
 * Cabinet hardware ids and the words the pages use for them (lib/pa/hardware places the parts; their names come from
 * data/catalog/cabinet-hardware). Code decides on the ids, the pages look the words up here.
 */

/** A box's handle setting when it takes none. */
export const NO_HANDLES = "none";
/** That choice's label in the settings. */
export const NO_HANDLES_LABEL = "No handles";

/** What each placed part is, in a sentence ("Sub left handle"). */
export const HARDWARE_KIND_NAMES = {
  handle: "handle",
  plate: "input dish",
  posts: "horn binding posts",
} as const;

/** Each panel a part goes on, in a sentence ("left side"). */
export const HARDWARE_PANEL_WORDS = {
  sideL: "left side",
  sideR: "right side",
  back: "back",
  top: "top",
} as const;

/** What a part can run into, in a sentence ("hits a rib"). */
export const HARDWARE_OBSTACLE_NAMES = {
  window: "a window brace",
  rib: "a rib",
  driver: "the driver",
  vent: "the vent",
  edge: "the panel's edge or joint",
  part: "another part",
} as const;

/** The settings' labels for a box's handle offsets. */
export const HANDLE_OFFSET_LABELS = {
  upIn: "Handle height from the centre of gravity",
  backIn: "Handle front-back from the preset",
} as const;

/** The handle offset sliders' range and step, in: either way from the preset. */
export const HANDLE_OFFSET_SLIDER = { min: -8, max: 8, step: 0.25 } as const;

/** The fit chip's titles. */
export const HARDWARE_FIT_TITLES = {
  fits: "Hardware fits",
  clash: "Hardware doesn't fit",
} as const;
