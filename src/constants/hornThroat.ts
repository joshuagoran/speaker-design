// A horn's throat where its side walls cover the outer parts of the cones (lib/speaker/hornThroat): the estimates the
// front chamber and the walls' clearance take, where the catalog has no figure.

/**
 * How far a cone's surround rises in front of the driver's frame, as a share of the cone's radius (from its Sd): a
 * half-roll about this high, 12 mm on an 18″ and 6 mm on a 10″.
 */
export const CONE_SURROUND_RISE_SHARE = 0.06;

/**
 * How far the walls' back edges stay clear of the cone's front, as a multiple of its Xmax: the cone can go past its
 * linear travel before it stops.
 */
export const CONE_TRAVEL_MARGIN = 1.5;

/**
 * How deep a cone's dish is, as a share of the driver's depth behind the baffle's front (its catalog depth, or the
 * fallback for its size): about 83 mm on the B&C 18NBX100's 208 mm. The dish holds a third of its depth times its area.
 */
export const CONE_DISH_PER_DEPTH = 0.4;

/** The compression ratio a starting horn takes, and the most and the least the setting takes. */
export const COMPRESSION_RATIO = { start: 1, min: 0.25, max: 8, step: 0.25 } as const;
