/**
 * The Hi-fi engine's drive options, by id, and their names: an amp channel per driver behind a DSP crossover, or one
 * amp channel and a passive network (lib/hifi tweeterAmpWatts). A design that names none is active.
 */
export const HIFI_DRIVE_NAMES = {
  active: "Active, two amp channels",
  passive: "Passive, one amp channel",
} as const;

/** The drive ids, for code that decides on one. */
export const HIFI_DRIVE = {
  active: "active",
  passive: "passive",
} as const satisfies { [K in keyof typeof HIFI_DRIVE_NAMES]: K };

/**
 * The least seat distance the Hi-fi level at the seat and the dispersion map are worked out at, m (pages/hifi
 * hifiDesign): a seat at the speakers can't send the level to infinity. A near-field use case passes less.
 */
export const HIFI_SEAT_FLOOR_M = 1;

/** The port air speed the Hi-fi woofer's clean level stops at, m/s, sine peak (lib/hifi hifiWooferPrep). */
export const HIFI_PORT_MAX_MS = 17;
