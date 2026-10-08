import type { Dims3, SliderSpec } from "../types";

/**
 * Where a Hi-fi speaker's drivers, vent and passive radiators sit, inches, and the room each needs: the model's driver
 * layout (lib/hifi driverLayout), the smallest box that holds them (lib/hifi/boxLayout hifiBoxMin), the 2D front
 * drawing (drawings/HifiFront) and the 3D view (stack-view/buildHifiScene) all read these, so they always agree.
 */
export const HIFI_BOX_LAYOUT = {
  /** the tweeter's faceplate (or the woofer, under a waveguide on the box top): this far below the box top */
  topMarginIn: 1,
  /** the woofer: this far below the tweeter's faceplate */
  driverGapIn: 0.5,
  /** and its bottom this far above the box bottom, or above the vent along the bottom of the baffle */
  wooferFloorIn: 0.5,
  /** the baffle width a woofer needs over its nominal size (its frame, with a little to spare) */
  wooferWidthIn: 0.8,
  /** the baffle width a tweeter's faceplate (or a waveguide set into the baffle) needs over its own and the walls */
  faceplateWidthIn: 0.5,
  /** round ports: side by side across the baffle's center line, this far apart edge to edge */
  portGapIn: 0.6,
  /** and their centers this far above the box bottom plus their radius; each tube's wall (its cutout is its outside) */
  portLiftIn: 1,
  portTubeWallIn: 0.1,
  /** passive radiators: stacked up their panel from this far inside its wall, */
  radiatorMarginIn: 0.25,
  /** each its height plus this apart, */
  radiatorGapIn: 0.5,
  /** and their panel this much wider inside than they are */
  radiatorWidthIn: 0.3,
} as const;

/** The baffle edge roundover radii on offer, inches (0: sharp edges); a router bit's usual sizes. */
export const HIFI_ROUNDOVER_CHOICES = [0, 0.5, 0.75, 1, 1.5, 2] as const;

/** The Hi-fi box sliders' labels. */
export const HIFI_BOX_LABELS = { w: "Width", h: "Height", d: "Depth" } as const satisfies Record<
  keyof Dims3,
  string
>;

/** The Hi-fi box sliders' ranges and step, inches; the width and height also start at what the drivers need. */
export const HIFI_BOX_SLIDERS = {
  w: { min: 6, max: 16, step: 0.25 },
  h: { min: 9, max: 44, step: 0.25 },
  d: { min: 6, max: 16, step: 0.25 },
} as const satisfies Record<keyof Dims3, SliderSpec>;
