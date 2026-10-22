// The Stack optimizer's ids and words (lib/speaker/optimize/optimizeStack). The goals, the alternatives, the fixes and the "nothing beats" notices are the Speaker optimizer's
// (constants/speakerOptimizer); these are the words that name a stack, its boxes or its height. Code compares the ids,
// never the words.
import {
  LOOSEN_PERCENT,
  SPEAKER_GOAL_TEXT,
  SPEAKER_NEAR_MISS_TEXT,
  SPEAKER_PROBLEM,
} from "./speakerOptimizer";
import { SPEAKER_OPTIMIZER_TEXT } from "./speakerOptimizerText";
import { STACK_TEXT } from "./stack";

/** Each goal's words for the first card, where the stack's differ from a speaker's (a lighter stack, smaller boxes). */
export const STACK_GOAL_TEXT = {
  ...SPEAKER_GOAL_TEXT,
  lighter: {
    ...SPEAKER_GOAL_TEXT.lighter,
    why: "Lightest stack that still reaches the target level.",
  },
  smaller: {
    ...SPEAKER_GOAL_TEXT.smaller,
    why: "Smallest boxes that still reach the target level.",
  },
} as const;

/** What a stack fails, by id: what a box's speaker fails, and the stack's height. */
export const STACK_PROBLEM = { ...SPEAKER_PROBLEM, height: "height" } as const;

/** Each problem in words, as the near miss lists them. */
export const STACK_PROBLEM_TEXT = {
  unmodeled: "the app cannot calculate part of your Stack",
  driverFit: "a driver or horn no longer fits its chamber",
  ventFit: "a vent does not fit its chamber",
  fitChip: "a duct, tube, or hardware fit check fails",
  budget: "the parts cost more than the budget",
  weight: "a box weighs more than the limit",
  size: "a box is larger than its size limit",
  height: "the stack is taller than the height limit",
} as const satisfies Record<keyof typeof STACK_PROBLEM, string>;

/** The near miss's options: a limit loosened so a card fits (the weight limit is per box); and its closest stack's words. */
export const STACK_NEAR_MISS_TEXT = {
  ...SPEAKER_NEAR_MISS_TEXT,
  weight: `Raise box limit by ${LOOSEN_PERCENT}%`,
  weightTip: (lb: number) => `New limit: ${lb} lb a box`,
  height: `Raise height limit by ${LOOSEN_PERCENT}%`,
  heightTip: (inches: number) => `New limit: ${inches} in`,
  /** the closest stack's weight where the weight limit blocks it: its heaviest box's */
  heaviest: (lb: string) => `heaviest box ${lb} lb`,
  short: (db: string, target: string) =>
    `the closest stack plays ${db} dB at 1 m, short of the ${target} dB target`,
} as const;

/** The notice when your stack has no box the model runs: there is nothing to score. */
export const STACK_UNMODELED = "Cannot calculate your Stack: it has no box that plays.";

/**
 * The Stack page's optimizer fold and result cards: the Speaker page's words (`SPEAKER_OPTIMIZER_TEXT`), with those
 * that name a stack, its boxes or its height. The results' heading, the stale notice and the buttons are the same.
 */
export const STACK_OPTIMIZER_TEXT = {
  ...SPEAKER_OPTIMIZER_TEXT,
  budgetField: "Most all the parts cost",
  weight: "Weight per box",
  weightField: "Most a box weighs",
  height: "Stack height",
  heightField: "Tallest the stack may stand",
  curveLabel: "Maximum output with one input, this Stack against yours",
  failing: (problems: string) =>
    `Your Stack fails: ${problems}. Fixes may cost more, weigh more, or stand taller.`,
  /** a box's locks, after its name: its crossover, its gain and its delay */
  memberLock: {
    crossovers: "crossover",
    levels: STACK_TEXT.gain.toLowerCase(),
    delays: STACK_TEXT.delay.toLowerCase(),
  },
  /** the card's line of box sizes */
  boxes: "Boxes",
  summaryHeight: (inches: number | null) =>
    inches === null ? "no height limit" : `up to ${inches} in tall`,
  summaryWeight: (lb: number | null) => (lb === null ? "no weight limit" : `up to ${lb} lb a box`),
} as const;
