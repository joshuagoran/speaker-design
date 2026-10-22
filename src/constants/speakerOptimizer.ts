// The Speaker optimizer's ids and words (lib/speaker/optimize). The goals the page offers, the cards' headings and sentences, the problems a design can fail and the near
// miss's options. Code compares the ids, never the words.
import { GOAL_SHORT_NAMES, SHARED_GOAL_NAMES } from "./optimizerText";

/** The goals, by id, in the order the page shows them (the user taps them in any order). */
export const SPEAKER_GOAL = {
  cheaper: "cheaper",
  lighter: "lighter",
  smaller: "smaller",
  lower: "lower",
  louder: "louder",
} as const;

/**
 * Each goal's button word, its long name (the first card's heading when it is the only goal and the target is your
 * design's level), the heading for a target you typed in (`atTarget`) and the card's sentence.
 */
export const SPEAKER_GOAL_TEXT = {
  cheaper: {
    short: GOAL_SHORT_NAMES.cheaper,
    name: "Same level, cheaper",
    atTarget: "At the target, cheaper",
    why: "Cheapest parts that still reach the target level.",
  },
  lighter: {
    short: GOAL_SHORT_NAMES.lighter,
    name: "Same level, lighter",
    atTarget: "At the target, lighter",
    why: "Lightest box that still reaches the target level.",
  },
  smaller: {
    short: "Smaller",
    name: "Same level, smaller",
    atTarget: "At the target, smaller",
    why: "Smallest box that still reaches the target level.",
  },
  lower: {
    short: GOAL_SHORT_NAMES.lower,
    name: SHARED_GOAL_NAMES.lower,
    atTarget: SHARED_GOAL_NAMES.lower,
    why: "Lowest F3 that keeps the target level.",
  },
  louder: {
    short: GOAL_SHORT_NAMES.louder,
    name: SHARED_GOAL_NAMES.louder,
    atTarget: SHARED_GOAL_NAMES.louder,
    why: "Loudest inside your limits.",
  },
} as const;

/** How the first card's heading joins a later goal ("Cheaper + lighter"). */
export const SPEAKER_GOAL_THAN = {
  cheaper: "cheaper",
  lighter: "lighter",
  smaller: "smaller",
  lower: "lower",
  louder: "louder",
} as const;

/** How the first card's sentence says a later goal ("…, and costs less than your design."). */
export const SPEAKER_GOAL_ALSO = {
  cheaper: "costs less",
  lighter: "weighs less",
  smaller: "is smaller",
  lower: "goes lower",
  louder: "is louder",
} as const;

/** An alternative card's heading and sentence, by its goal. */
export const SPEAKER_ALT_TEXT = {
  cheaper: {
    label: GOAL_SHORT_NAMES.cheaper,
    why: "Costs less than your design, close to the target.",
  },
  lighter: {
    label: GOAL_SHORT_NAMES.lighter,
    why: "Lighter than your design, close to the target.",
  },
  smaller: { label: "Smaller", why: "Smaller than your design, close to the target." },
  lower: { label: "Goes lower", why: "Goes lower than your design." },
  louder: { label: GOAL_SHORT_NAMES.louder, why: "Louder than your design." },
} as const;

/** A fix's sentence (your design fails a check), by the first goal. */
export const SPEAKER_FIX_WHY = {
  cheaper: "Cheapest design that passes the checks.",
  lighter: "Lightest design that passes the checks.",
  smaller: "Smallest design that passes the checks.",
  lower: "Lowest F3 that passes the checks.",
  louder: "Loudest design that passes the checks.",
} as const;

/** The notice when nothing beats your design on the one goal. */
export const SPEAKER_GOAL_MISSING = {
  cheaper: "Nothing cheaper than your design passes the checks.",
  lighter: "Nothing lighter than your design passes the checks.",
  smaller: "Nothing smaller than your design passes the checks.",
  lower: "Nothing goes lower than your design and keeps the level.",
  louder: "Nothing louder than your design passes the checks.",
} as const;

/** The notice when your design has no band the model runs: there is nothing to score. */
export const SPEAKER_UNMODELED = "Cannot calculate your design: it has no band that plays.";

/** The notice when no goal is picked: the search waits for one. */
export const SPEAKER_NO_GOAL = "Pick a goal to search.";

/** How the notice names the level, the F3 and the pair when the first card only comes closest. */
export const SPEAKER_REACH_WORDS = { level: "at 1 m", f3: "an F3", both: "level and bass" };

/** What a design fails, by id. */
export const SPEAKER_PROBLEM = {
  unmodeled: "unmodeled",
  driverFit: "driverFit",
  ventFit: "ventFit",
  fitChip: "fitChip",
  budget: "budget",
  weight: "weight",
  size: "size",
} as const;

/** Each problem in words, as the near miss lists them. */
export const SPEAKER_PROBLEM_TEXT = {
  unmodeled: "the app cannot calculate a chamber or band in your design",
  driverFit: "a driver or horn no longer fits its chamber",
  ventFit: "a vent does not fit its chamber",
  fitChip: "a duct, tube, or hardware fit check fails",
  budget: "the parts cost more than the budget",
  weight: "the box weighs more than the limit",
  size: "the box is larger than the size limit",
} as const;

/** The near miss loosens the weight, the budget (and the stack's height) by this share, and the target by TARGET_STEP_DB. */
export const LOOSEN = 0.1;
export const TARGET_STEP_DB = 1;
/** LOOSEN as the buttons say it, in percent. */
export const LOOSEN_PERCENT = Math.round(LOOSEN * 100);

/**
 * The near miss's options: a limit loosened so a card fits. Each button says the change; its tip (`*Tip`) says the new
 * value.
 */
export const SPEAKER_NEAR_MISS_TEXT = {
  weight: `Raise weight limit by ${LOOSEN_PERCENT}%`,
  weightTip: (lb: number) => `New limit: ${lb} lb`,
  budget: `Raise budget by ${LOOSEN_PERCENT}%`,
  budgetTip: (dollars: number) => `New budget: $${dollars}`,
  target: `Lower target by ${TARGET_STEP_DB} dB`,
  targetTip: (db: number) => `New target: ${db} dB`,
  short: (db: string, target: string) =>
    `the closest design plays ${db} dB at 1 m, short of the ${target} dB target`,
  none: "no design fits these limits and locks",
} as const;
