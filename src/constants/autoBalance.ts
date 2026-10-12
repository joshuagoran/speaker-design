// Auto balance (lib/speaker/autoBalance): its result's kinds, and the words the Speaker and Stack pages show for it
// (src/components/ui/AutoBalanceButton).

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
  /** the term next to the button that opens its tooltip */
  what: "What it does",
  /** the tooltip: the music tilt's two steps, dB, and the highest crossover that takes the first, Hz */
  tip: (subStepDb: number, stepDb: number, subMaxHz: number) =>
    `Sets the band levels for music. At each crossover, the higher band goes below the lower band: ${subStepDb} dB at ${subMaxHz} Hz or less, ${stepDb} dB above. The highest level is 0 dB.`,
  /** what the Stack page's tooltip adds */
  stackTip: "Each member level goes to 0 dB.",
  oneBand: "Auto balance needs two or more bands that play.",
  /** the bands that stop it: bands a driver feeds that the model cannot calculate */
  unmodeled: (names: readonly string[]) =>
    `Auto balance did not change the levels. The model cannot calculate: ${names.join(", ")}.`,
  /** a band of a stack member's speaker, as the notice names it */
  memberBand: (speaker: string, band: string) => `${speaker} (${band})`,
} as const;
