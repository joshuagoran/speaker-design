/**
 * Cabinet hardware ids and the words the pages use for them (lib/build/hardware places the parts; their names come from
 * data/catalog/cabinet-hardware). Code decides on the ids, the pages look the words up here.
 */
import type { HardwareBoxId, HardwarePanel } from "../types";

/**
 * The hardware presets by box (lib/build/hardware planBoxHardware): the sub box's (two handles, the input dish and its
 * jacks), and the mid box's, which adds the horn's binding posts on its top.
 */
export const HARDWARE_BOX = { sub: "sub", mid: "mid" } as const satisfies Record<
  string,
  HardwareBoxId
>;

/** A box's handle setting when it takes none. */
export const NO_HANDLES = "none";
/** What each placed part is, in a sentence ("Sub left handle"). */
export const HARDWARE_KIND_NAMES = {
  handle: "handle",
  plate: "input dish",
  posts: "horn binding posts",
} as const;

/** The panels a part can go on, by id. */
export const HARDWARE_PANEL = {
  sideL: "sideL",
  sideR: "sideR",
  back: "back",
  top: "top",
} as const satisfies { [K in HardwarePanel]: K };

/** Each panel a part goes on, in a sentence ("left side"). */
export const HARDWARE_PANEL_WORDS = {
  sideL: "left side",
  sideR: "right side",
  back: "back",
  top: "top",
} as const;

/** What a part can run into, in a sentence ("runs into a rib"). */
export const HARDWARE_OBSTACLE_NAMES = {
  window: "a window brace",
  rib: "a rib",
  driver: "the driver",
  vent: "the vent",
  edge: "the panel's edge or joint",
  part: "another part",
} as const;

/** The section's name wherever the handles and dishes are listed (Details, Notes). */
/** The two ways the handles move on their sides, each a handle offset (BoxHandles' `upIn` and `backIn`). */
export const HANDLE_AXIS_NAMES = {
  upIn: "Height",
  backIn: "Front to back",
} as const;
type HandleAxis = keyof typeof HANDLE_AXIS_NAMES;
/** Each offset's directions, plus then minus. */
const HANDLE_AXIS_SIGNS: Record<HandleAxis, readonly [string, string]> = {
  upIn: ["Up", "down"],
  backIn: ["Back", "forward"],
};
/** Where the preset puts the handles on each axis (the offsets move them from there). */
const HANDLE_PRESET_WORDS: Record<HandleAxis, string> = {
  upIn: "the center-of-gravity height",
  backIn: "the clear spot nearest the center of gravity",
};
/** A placement message: the axis, then where along it ("Height: from the preset"). */
export const placementLabel = (axis: HandleAxis, source: string) =>
  `${HANDLE_AXIS_NAMES[axis]}: ${source}`;
/** A handle offset slider's label, the same for both axes but the axis word. */
export const handleOffsetLabel = (axis: HandleAxis) => placementLabel(axis, "from the preset");
/** A handle offset field's tooltip, one short line. */
export const handleOffsetTip = (axis: HandleAxis) =>
  `${HANDLE_AXIS_SIGNS[axis][0]} (+) or ${HANDLE_AXIS_SIGNS[axis][1]} (−) from ${HANDLE_PRESET_WORDS[axis]}.`;

/** Where each kind of part goes on its box, as the cutlist, Details and the presets say it. */
export const HARDWARE_PLACE_WORDS = {
  handle: "both sides",
  plate: "back, centered side to side",
  // the cutlist row is the top and bottom pair: the posts go in the top only
  posts: "top only, centered side to side",
} as const;
/**
 * A placed part's position, one pattern for every part: where it goes, then its center from each named edge of that
 * panel (`offsets`: the inches, already formatted, and the edge), e.g. "both sides, center 8″ from the front edge and
 * 15 1/2″ from the bottom edge".
 */
export const hardwarePlaceWords = (
  kind: keyof typeof HARDWARE_PLACE_WORDS,
  offsets: readonly (readonly [string, string])[],
) =>
  `${HARDWARE_PLACE_WORDS[kind]}, center ${offsets.map(([inches, edge]) => `${inches}″ from the ${edge} edge`).join(" and ")}`;
/** What a part that doesn't fit runs into, and what to do: one pattern for every part. */
export const hardwareClashLine = (who: string, both: boolean, into: string, advice: string) =>
  `${who} ${both ? "run" : "runs"} into ${into}: ${advice}.`;
/** What to do about each kind of part that doesn't fit. */
export const HARDWARE_ADVICE = {
  handle: "move them with the offsets, or change the handle",
  plate: "no clear place low on the back",
  posts: "no clear place on the lid",
} as const;

/** The handle offset fields' range and step, in: either way from the preset. */
export const HANDLE_OFFSET_RANGE = { min: -8, max: 8, step: 0.25 } as const;

/** The fit chip's line when every part fits, with the liters the recesses take (already formatted). */
export const hardwareFitsLine = (liters: string) =>
  `Clear of the driver, vent, braces, edges and other parts. Recesses take ${liters} L.`;

/** The fit chip's titles. */
export const HARDWARE_FIT_TITLES = {
  fits: "Hardware fits",
  clash: "Hardware doesn't fit",
} as const;
