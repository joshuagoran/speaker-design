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
  /** a crossover is outside the model's frequency range, so a band has no level there: the Levels stay */
  outOfRange: "outOfRange",
} as const;

/** The auto balance options, by id: flat (the default) or the PA music tilt. */
export const AUTO_BALANCE_MODE = {
  /** every band at the same level at each crossover */
  flat: "flat",
  /** the PA page's music balance: the higher band below the lower band at each crossover */
  paMusic: "paMusic",
} as const;
export type AutoBalanceMode = (typeof AUTO_BALANCE_MODE)[keyof typeof AUTO_BALANCE_MODE];

/** The options' labels, as the toggle next to the button shows them. */
export const AUTO_BALANCE_MODE_LABEL: Record<AutoBalanceMode, string> = {
  [AUTO_BALANCE_MODE.flat]: "Flat",
  [AUTO_BALANCE_MODE.paMusic]: "PA music tilt",
};

export const AUTO_BALANCE_TEXT = {
  button: "Auto balance",
  /** the term next to the button that opens its tooltip */
  what: "What it does",
  /** the Flat option's tooltip */
  flatTip:
    "Sets the band levels so that the bands are at the same level at each crossover. The highest level is 0 dB.",
  /** the PA music tilt option's tooltip: the tilt's two steps, dB, and the highest crossover that takes the first, Hz */
  paMusicTip: (subStepDb: number, stepDb: number, subMaxHz: number) =>
    `Sets the band levels for PA music. At each crossover, the higher band goes below the lower band: ${subStepDb} dB at ${subMaxHz} Hz or less, ${stepDb} dB above. The highest level is 0 dB.`,
  /** what the Stack page's tooltip adds */
  stackTip: "Each box level goes to 0 dB.",
  oneBand: "Auto balance needs two or more bands that play.",
  /** the bands that stop it: bands a driver feeds that the model cannot calculate */
  unmodeled: (names: readonly string[]) =>
    `Auto balance did not change the levels. The model cannot calculate: ${names.join(", ")}.`,
  /** a crossover outside the model's frequency range (the frequency charts' axis), Hz */
  outOfRange: (minHz: number, maxHz: number) =>
    `Auto balance did not change the levels. A crossover is out of the range of the model: ${minHz} Hz to ${maxHz} Hz.`,
  /**
   * boxes that use the same speaker with different crossovers, numbered from 1: auto balance takes the first
   * box's crossover (lib/speaker/autoBalance `sharedCrossovers`)
   */
  sharedCrossover: (boxes: readonly number[]) =>
    `Boxes ${boxes.slice(0, -1).join(", ")} and ${boxes[boxes.length - 1]} use the same speaker with different crossovers. Auto balance uses the crossover of box ${boxes[0]}.`,
  /** a band of a stack box's speaker, as the notice names it */
  memberBand: (speaker: string, band: string) => `${speaker} (${band})`,
} as const;
