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
 * The least distance each speaker's Hi-fi level at the seat, and the dispersion map, are worked out at, m (pages/hifi
 * hifiDesign): a seat at the speakers can't send the level to infinity. A near-field use case passes less (each
 * driver's own path keeps a floor of its own, lib/hifi/nearField driverPathFloorM).
 */
export const HIFI_SEAT_FLOOR_M = 1;

/**
 * The distance the Hi-fi model's far-field figures hold from, m (lib/hifi/nearField): each driver's level falling as
 * 1 / the speaker's distance, the full 6 dB baffle step and the placement's boundary gain (an in-room figure for a
 * listening distance). Hi-fi seats are worked out at 1 m or more (the default seat floor), so from here out the model
 * is exactly as it was: the driver-height and baffle-size terms it leaves out are about 0.1 dB at 1 m and shrink as
 * 1 / distance² beyond. Closer in, the near-field forms take over, each relative to its value here, so they join the
 * far-field figures continuously: no step in value, though the slope kinks a little at 1 m.
 */
export const HIFI_NEAR_FIELD_M = 1;

/**
 * Two speakers' levels at a seat add in power, dB above one of them when they are equally loud: 10 · log10 2 = 3.01,
 * rounded as the page has always shown it (lib/hifi nearField hifiPairLevelDb).
 */
export const HIFI_PAIR_SUM_DB = 3;

/** The port air speed the Hi-fi woofer's clean level stops at, m/s, sine peak (lib/hifi hifiWooferPrep). */
export const HIFI_PORT_MAX_MS = 17;
