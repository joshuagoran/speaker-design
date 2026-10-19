// The Speaker page's field steps: the settings the page's number fields step by. The Speaker optimizer
// (lib/speaker/optimize) builds every design it scores on these steps, so a card is a design the page shows as it is.

/** Each field's step: sizes and places, in; port lengths and sizes, in; filter corners, Hz; levels, dB; power, W. */
export const SPEAKER_STEPS = {
  /** a chamber's width, height, depth and corner, a driver's or a vent's place */
  sizeIn: 0.25,
  /** a port's path length */
  portLenIn: 0.5,
  /** a slot's narrow side (the PA sliders' slot height step) */
  slotHIn: 0.25,
  /** a duct's throat, a tube's diameter */
  portSizeIn: 0.25,
  /** a port's count (tubes, stacked slots) and a letterbox's fins */
  count: 1,
  /** a set net air, L */
  netL: 0.5,
  /** a radiator's added mass, g */
  addG: 5,
  /** a filter's corner */
  filterHz: 10,
  /** a band's level */
  levelDb: 0.5,
  /** a band's amp power */
  ampW: 10,
} as const;

/**
 * The most a chamber's stuffing makes it act larger, %: fiber fill packed full gives about this much; more is not
 * possible with real fill.
 */
export const STUFFING_MAX_PCT = 25;

/** How much a chamber's fiber fill makes it act larger, %, by how full it is: none, lined walls, half full, full. */
export const FILL_LEVEL_PCT = { none: 0, lined: 10, half: 15, full: STUFFING_MAX_PCT } as const;

/** The Stack page's member field steps: a member's level, dB, and its set delay, ms. The Stack optimizer builds on them. */
export const STACK_STEPS = {
  levelDb: 0.5,
  delayMs: 0.1,
} as const;
