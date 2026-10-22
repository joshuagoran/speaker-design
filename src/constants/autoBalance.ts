// Calculate gains on the Speaker and Stack pages (lib/speaker/autoBalance): its result's kinds, and the words the pages
// show for it (src/components/ui/CalculateGainsButton).
import { CALCULATE_GAINS_LABEL, GAIN_LABEL, PAD_LABEL } from "./controlLabels";

/** What Calculate gains gives, by id. */
export const AUTO_BALANCE_STATUS = {
  /** every band (or box) has a balanced level */
  balanced: "balanced",
  /** fewer than two modeled bands (or boxes): nothing to balance, the levels stay */
  oneBand: "oneBand",
  /** a band a driver feeds has no model: the levels stay */
  unmodeled: "unmodeled",
  /** a crossover is outside the model's frequency range, so a band has no level there: the levels stay */
  outOfRange: "outOfRange",
} as const;

export const AUTO_BALANCE_TEXT = {
  button: CALCULATE_GAINS_LABEL,
  /** the button's tooltip on the Speaker page */
  speakerTip: `Sets each band's **${GAIN_LABEL}** or **${PAD_LABEL}**, so that the bands play at the same level at each crossover. Each driver's sensitivity sets it.`,
  /** the button's tooltip on the Stack page */
  stackTip: `Sets each box's **${GAIN_LABEL}**, so that the boxes play at the same level at each crossover. The bands of each Speaker do not change.`,
  /** the bands that stop it: bands a driver feeds that the model cannot calculate */
  unmodeled: (names: readonly string[]) =>
    `**${CALCULATE_GAINS_LABEL}** did not change the gains. The app cannot calculate: ${names.join(", ")}.`,
  /** a crossover outside the model's frequency range (the frequency charts' axis), Hz */
  outOfRange: (minHz: number, maxHz: number) =>
    `**${CALCULATE_GAINS_LABEL}** did not change the gains. A crossover is outside the range the app calculates: ${minHz} Hz to ${maxHz} Hz.`,
} as const;
