/** An amp's output-stage class, as the amps catalog and the Notes page's amp table name it. */
export const AMP_CLASSES = {
  AB: "AB",
  ABB: "AB+B",
  H: "H",
  D: "D",
  TD: "TD",
  I: "I (BCA)",
  EEEngine: "EEEngine",
} as const;

/**
 * The Notes page's amp table: each column's cell name and its header, in the order the table shows them. Code reads a
 * cell by its name, never by its position.
 */
export const AMP_COLUMNS = {
  amp: "Amp",
  ampClass: "Class",
  channels: "Ch",
  w16: "W/ch 16 Ω",
  w8: "W/ch 8 Ω",
  w4: "W/ch 4 Ω",
  w2: "W/ch 2 Ω",
  lb: "Weight",
  gain: "Gain",
  dsp: "DSP",
  usedPrice: "Used (US)",
  note: "Notes",
} as const;
