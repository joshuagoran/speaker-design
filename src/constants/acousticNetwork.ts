// Ids for the acoustic network engine (lib/acoustics/network): its parts, its openings' loads, the horn layouts its
// presets build, and the Hornresp reader's layouts and reasons.

/**
 * The kinds of part a network holds, by id (`NetworkPart`):
 * - driver: the cones, a pressure source behind their own impedance, between their rear node and their front node;
 * - chamber: an air volume's compliance from a node to the outside air, with an optional absorbing loss beside it;
 * - duct: horn sections (exact two-ports) or a straight duct between two nodes, with an optional loss at its input;
 * - mass: a lumped acoustic mass and resistance between two nodes (a vent with no radiation load, as the box models);
 * - opening: a node's way out to the air (a mouth, a vent's exit or a leak), whose flow radiates.
 */
export const NETWORK_PART = {
  driver: "driver",
  chamber: "chamber",
  duct: "duct",
  mass: "mass",
  opening: "opening",
} as const;

/**
 * What loads an opening (`OpeningLoad`), by id:
 * - piston: a round piston's radiation impedance in the network's solid angle, beside its other boxes;
 * - resistance: a pure resistance to the outside air (a leak);
 * - open: no load at all, the node opens to the outside air (the box models' mode, with no radiation load).
 */
export const OPENING_LOAD = {
  piston: "piston",
  resistance: "resistance",
  open: "open",
} as const;

/**
 * Where a horn path's presets put the driver (lib/acoustics/network/presets), by id:
 * - frontLoaded: the cones' fronts at the throat (through the throat chamber), their rears in a sealed or vented rear
 *   chamber;
 * - offsetDriver: as front-loaded, but the fronts tap the path between its closed end and its mouth (Hornresp's OD);
 * - tapped: the fronts and the rears each tap the one path, closed at its start, at two points (Hornresp's TH).
 */
export const HORN_LAYOUT = {
  frontLoaded: "frontLoaded",
  offsetDriver: "offsetDriver",
  tapped: "tapped",
} as const;

/**
 * Hornresp's flags for its driver layouts, as a record's "Key = value" lines may give them (a nonzero value sets the
 * layout). A record with neither is front-loaded, or a direct radiator when it has no horn.
 */
export const HORNRESP_LAYOUT_KEY = {
  offsetDriver: "OD",
  tapped: "TH",
} as const;

/**
 * What a horn path's driver rears drive in the presets' general builder, by id: a sealed or vented chamber of their own
 * (front-loaded and offset-driver horns), or a tap on the path (a tapped horn).
 */
export const REAR_SIDE = {
  chamber: "chamber",
  tap: "tap",
} as const;

/** The start of every reason the Hornresp reader gives for a record it cannot map yet. */
export const NOT_SUPPORTED_YET = "not supported yet: ";

/** The start of the reason the Hornresp reader gives for a record that misses a value it needs. */
export const MISSING_VALUE = "missing value: ";
