// The Stack optimizer's ids and words (lib/speaker/optimize/optimizeStack; docs/speaker-designer-plan.md, "Design: the
// Stack optimizer"). The goals, the alternatives, the fixes and the "nothing beats" notices are the Speaker optimizer's
// (constants/speakerOptimizer); these are the words that name a stack, its boxes or its height. Code compares the ids,
// never the words.
import { SPEAKER_GOAL_TEXT, SPEAKER_NEAR_MISS_TEXT, SPEAKER_PROBLEM } from "./speakerOptimizer";
import { SPEAKER_OPTIMIZER_TEXT } from "./speakerOptimizerText";

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

/** What a stack fails, by id: what a member's speaker fails, and the stack's height. */
export const STACK_PROBLEM = { ...SPEAKER_PROBLEM, height: "height" } as const;

/** Each problem in words, as the near miss lists them. */
export const STACK_PROBLEM_TEXT = {
  unmodeled: "the model can't run a member, chamber or band your stack runs",
  driverFit: "a driver or horn no longer fits its chamber",
  ventFit: "a port doesn't fit its chamber",
  fitChip: "a duct, tube or hardware fit check fails",
  budget: "the parts cost more than the budget",
  weight: "a box weighs more than the limit",
  size: "a box is larger than its size limit",
  height: "the stack is taller than the height limit",
} as const satisfies Record<keyof typeof STACK_PROBLEM, string>;

/** The near miss's options: a limit loosened so a card fits. */
export const STACK_NEAR_MISS_TEXT = {
  ...SPEAKER_NEAR_MISS_TEXT,
  height: (inches: number) => `Allow ${inches} in`,
  short: (db: string, target: string) =>
    `the closest stack plays ${db} dB at 1 m, short of the ${target} dB target`,
} as const;

/** The notice when your stack has no member the model runs: there is nothing to score. */
export const STACK_UNMODELED = "Cannot model your stack: it has no member to score.";

/**
 * The Stack page's optimizer fold and result cards: the Speaker page's words (`SPEAKER_OPTIMIZER_TEXT`), with those
 * that name a stack, its boxes or its height. The results' heading, the stale notice and the buttons are the same.
 */
export const STACK_OPTIMIZER_TEXT = {
  ...SPEAKER_OPTIMIZER_TEXT,
  targetYours: (db: string) => `Your stack plays ${db} dB at 1 m.`,
  budgetField: "Most all the parts cost",
  weight: "Weight per box",
  weightField: "Most a box weighs",
  height: "Stack height",
  heightField: "Tallest the stack may stand",
  keepHint:
    "A locked part stays as it is. Keep a speaker to hold it whole. A locked crossover, level or delay stays as it is. Size: free, up to this size (≤) or exactly this size (=).",
  curveLabel: "Maximum output with one input, this stack against yours",
  failing: (problems: string) =>
    `Your stack fails: ${problems}. Fixes may cost more, weigh more or stand taller.`,
  /** a speaker's lock on the whole speaker, and the label of a lock on a box axis */
  keepWhole: "Keep the whole speaker",
  boxAxis: { w: "Box width", h: "Box height", d: "Box depth" },
  /** the Keep list's group of the members' own settings, and each lock in it */
  members: "Members",
  memberLock: { crossovers: "crossover", levels: "level", delays: "delay" },
  /** the card's line of box sizes */
  boxes: "Boxes",
  summaryHeight: (inches: number | null) =>
    inches === null ? "no height limit" : `up to ${inches} in tall`,
  summaryWeight: (lb: number | null) => (lb === null ? "no weight limit" : `up to ${lb} lb a box`),
} as const;
