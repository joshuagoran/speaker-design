// Auto balance (lib/speaker/autoBalance): its result's kinds, and the words the Speaker and Stack pages show for it.

/** What an auto balance gives, by id. */
export const AUTO_BALANCE_STATUS = {
  /** every band has a balanced Level */
  balanced: "balanced",
  /** fewer than two modeled bands: nothing to balance, the Levels stay */
  oneBand: "oneBand",
  /** a band a driver feeds has no model: the Levels stay */
  unmodeled: "unmodeled",
} as const;

export const AUTO_BALANCE_TEXT = {
  button: "Auto balance",
  tip: "Sets each band's level for music. At each crossover, the band above is set below the band under it: 6 dB at a crossover to a sub, 3 dB at higher crossovers. The highest level is 0 dB.",
  stackTip:
    "Sets the level of each band of each member for music. At each crossover, the band above is set below the band under it: 6 dB at a crossover to a sub, 3 dB at higher crossovers. The highest level is 0 dB, and each member's level goes to 0 dB.",
  /** the bands that stop it: a band a driver feeds that the model can't work out */
  unmodeled: (names: readonly string[]) =>
    `Auto balance did not change the levels. The model cannot calculate ${names.join(", ")}.`,
} as const;
