// Auto balance (lib/speaker/autoBalance): its result's kinds, and the words the Speaker, Stack and Space pages show for
// it (src/components/ui/AutoBalanceButton).

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

/** The band balance options, by id: flat (the default) or More bass (the PA music tilt). */
export const AUTO_BALANCE_MODE = {
  /** every band at the same level at each crossover */
  flat: "flat",
  /** More bass (the PA's music balance): each higher band below the lower band at each crossover */
  moreBass: "moreBass",
} as const;
export type AutoBalanceMode = (typeof AUTO_BALANCE_MODE)[keyof typeof AUTO_BALANCE_MODE];

/** The options' labels, as the toggle shows them. */
export const AUTO_BALANCE_MODE_LABEL: Record<AutoBalanceMode, string> = {
  [AUTO_BALANCE_MODE.flat]: "Flat",
  [AUTO_BALANCE_MODE.moreBass]: "More bass",
};

/** The button that sets the band Levels, which its notes name. */
const AUTO_BALANCE_NAME = "Auto balance";

export const AUTO_BALANCE_TEXT = {
  /** the toggle's field label (its tooltip is `tip`) */
  label: "Band balance",
  button: AUTO_BALANCE_NAME,
  /** the label's tooltip: both options, the steps of More bass, dB, and the highest crossover that takes the first, Hz */
  tip: (subStepDb: number, stepDb: number, subMaxHz: number) =>
    `**${AUTO_BALANCE_MODE_LABEL[AUTO_BALANCE_MODE.flat]}**: each band plays at the same level. **${AUTO_BALANCE_MODE_LABEL[AUTO_BALANCE_MODE.moreBass]}**: each band is quieter than the band below it. The step is ${subStepDb} dB at a crossover of ${subMaxHz} Hz or lower, and ${stepDb} dB above ${subMaxHz} Hz.`,
  /** what the Stack page's tooltip adds */
  stackTip: "Each box gain goes to 0 dB.",
  /** under the button with More bass: each band's level, from the lowest band, dB (a true minus sign, as the charts write it) */
  levels: (bands: readonly { name: string; levelDb: number }[]) =>
    bands
      .map(({ name, levelDb }) => {
        const db = Math.round(levelDb * 10) / 10;
        return `${name} ${db < 0 ? `−${-db}` : db} dB`;
      })
      .join(", "),
  oneBand: `**${AUTO_BALANCE_NAME}** needs two or more bands that play.`,
  /** the bands that stop it: bands a driver feeds that the model cannot calculate */
  unmodeled: (names: readonly string[]) =>
    `**${AUTO_BALANCE_NAME}** did not change the gains. The app cannot calculate: ${names.join(", ")}.`,
  /** a crossover outside the model's frequency range (the frequency charts' axis), Hz */
  outOfRange: (minHz: number, maxHz: number) =>
    `**${AUTO_BALANCE_NAME}** did not change the gains. A crossover is outside the range the app calculates: ${minHz} Hz to ${maxHz} Hz.`,
  /**
   * boxes that use the same speaker with different crossovers, numbered from 1: the balance takes the first
   * box's crossover (lib/speaker/autoBalance `sharedCrossovers`)
   */
  sharedCrossover: (boxes: readonly number[]) =>
    `Boxes ${boxes.slice(0, -1).join(", ")} and ${boxes[boxes.length - 1]} are the same Speaker with different crossovers. **${AUTO_BALANCE_NAME}** uses box ${boxes[0]}'s crossover.`,
  /** a band of a stack box's speaker, as the notice names it */
  memberBand: (speaker: string, band: string) => `${speaker} (${band})`,
} as const;
