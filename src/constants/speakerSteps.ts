// The Speaker page's field steps: the settings the page's number fields step by. The Speaker optimizer
// (lib/speaker/optimize) builds every design it scores on these steps, so a card is a design the page shows as it is.

/** Each field's step: sizes and places, in; port lengths and sizes, in; filter corners, Hz; levels, dB; power, W. */
export const SPEAKER_STEPS = {
  /** a chamber's width, height, depth and corner, a driver's or a vent's place */
  sizeIn: 0.25,
  /** a port's path length */
  portLenIn: 0.5,
  /** a slot's narrow side */
  slotHIn: 0.125,
  /** a slot's long side, a duct's throat, a tube's diameter */
  portSizeIn: 0.25,
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
