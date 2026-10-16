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
 * Hornresp's keys for the driver layouts the reader takes: the key of a record's driver count line (the line after Re
 * in its driver section), whose value is the number of drivers. Nd is front-loaded (or a direct radiator when it has no
 * horn), OD the offset-driver horn and TH the tapped horn.
 */
export const HORNRESP_LAYOUT_KEY = {
  frontLoaded: "Nd",
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

/** The start of the reason the Hornresp reader gives for a value it cannot read (blank, not a number, out of range). */
export const INVALID_RECORD = "invalid record: ";

/**
 * The Hornresp record keys the reader reads or checks, by what each one is. A record's horn rows are keyed S1 to S5
 * (`HORNRESP_AREA_KEYS`), its flares by `HORNRESP_FLARE_KEY`, and its driver count line by `HORNRESP_LAYOUT_KEY`.
 */
export const HORNRESP_KEY = {
  // the source and the radiation
  angle: "Ang",
  drive: "Eg",
  sourceResistance: "Rg",
  // the driver
  coneArea: "Sd",
  forceFactor: "Bl",
  compliance: "Cms",
  mechanicalResistance: "Rms",
  movingMass: "Mmd",
  inductance: "Le",
  coilResistance: "Re",
  excursion: "Xmax",
  addedMass: "Added Mass",
  // the chambers and the vent
  rearVolume: "Vrc",
  rearLength: "Lrc",
  ventArea: "Ap",
  ventLength: "Lpt",
  throatVolume: "Vtc",
  throatArea: "Atc",
  endCorrection: "End Correction Flag",
  pathLength: "Acoustic Path Length",
  // the models and the filling the reader does not take yet
  lossyInductance: "Lossy Inductance Model Flag",
  semiInductance: "Semi-Inductance Model Flag",
  dampingModel: "Damping Model Flag",
  closedMouth: "Closed Mouth Flag",
  rearFilling: "Fr",
  rearFillingLength: "Tal",
  hornFilling1: "Fr1",
  hornFilling2: "Fr2",
  hornFilling3: "Fr3",
  hornFilling4: "Fr4",
  highPass: "High Pass Frequency",
  lowPass: "Low Pass Frequency",
} as const;

/** Hornresp's horn area keys, by segment boundary: S1 is the first row's start, S5 the fourth row's end. */
export const HORNRESP_AREA_KEYS = ["S1", "S2", "S3", "S4", "S5"] as const;

/** Hornresp's flare keys, as a horn row names its length. */
export const HORNRESP_FLARE_KEY = {
  conical: "Con",
  exponential: "Exp",
  parabolic: "Par",
} as const;

/** Hornresp's horn row cutoff keys (each row's flare cutoff, Hz, not read), by row. */
export const HORNRESP_CUTOFF_KEYS = ["F12", "F23", "F34", "F45"] as const;

/** The keys a horn row's length takes when the row is unused (zero length), by row. */
export const HORNRESP_UNUSED_LENGTH_KEYS = ["L12", "L23", "L34", "L45"] as const;
