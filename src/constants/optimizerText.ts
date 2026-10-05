import type { HifiGoal, PaGoal, PaRunMode } from "../types";

/** A goal both optimizers offer. */
type SharedGoal = PaGoal & HifiGoal;

/**
 * The words both optimizers (PA and Hi-fi) show. Code tells cards apart by their slot (`CardSlot`: first, fix, closest,
 * smallest, or an alternative's goal), never by these headings; pages and the card selection look the words up here.
 */

/** Each goal's short name: the goal picker's button, a stacked card's heading and an alternative's. */
export const GOAL_SHORT_NAMES = {
  cheaper: "Cheaper",
  lighter: "Lighter",
  lower: "Lower",
  louder: "Louder",
} as const satisfies Record<SharedGoal, string>;

/** The goals whose long name both optimizers share (cheaper and lighter say "Same output" or "Same level"). */
export const SHARED_GOAL_NAMES = {
  lower: "Go lower",
  louder: GOAL_SHORT_NAMES.louder,
} as const satisfies Partial<Record<SharedGoal, string>>;

/** A fix's heading: the closest design, when nothing passing keeps what the goals keep, is headed the same. */
const FIXES = "Fixes your design";

/** The headings of the cards that aren't named after a goal, by slot; the near miss's closest design is `nearMiss`. */
export const CARD_LABELS = {
  fix: FIXES,
  closest: FIXES,
  smallest: "Smallest change",
  nearMiss: "Closest",
} as const;

/** The sentence under a card both optimizers word the same way. */
export const CARD_WHY = {
  closest: "Passes the checks and comes closest to your goal.",
  smallest: "Changes one thing from your design.",
  altLower: "Goes lower than your design.",
} as const;

/** The optimizer panel and result cards' fixed copy, the same on the PA and Hi-fi pages. */
export const OPTIMIZER_PANEL_TEXT = {
  heading: "Find a better design",
  limitedBy: "Limited by:",
} as const;

/** The PA run buttons' words, by run mode (the Details drop-down names them too; the phone check taps Improve). */
export const PA_RUN_LABELS = {
  improve: "Improve",
  full: "Fully optimize",
} as const satisfies Record<PaRunMode, string>;

/**
 * What a card changes from your design, as its "changes" line says it. Code that asks whether a card changed
 * something compares with these, never with a typed-out word.
 */
export const CHANGE_NAMES = {
  subDriver: "sub driver",
  subBox: "sub box",
  vent: "vent",
  plywood: "plywood",
  midDriver: "mid driver",
  midBox: "mid box",
  hf: "HF",
  highpass: "highpass",
  crossovers: "crossovers",
  ampPower: "amp power",
  woofer: "woofer",
  tweeter: "tweeter",
  boxType: "box type",
  boxSize: "box size",
  port: "port",
  radiator: "radiator",
  crossover: "crossover",
} as const;

/** How the notice starts when the first card only comes closest and misses a level or F3 the goals keep. */
export const OUT_OF_REACH_LEAD = "Out of reach within the checks";

/** What fails in a design that isn't a check's title: the optimizers' problem lines. */
export const DESIGN_PROBLEM_TEXT = {
  unmodelled: "can't be modelled",
  exitMismatch: "horn and driver exits differ",
  missingWoofer: "woofer isn't in the driver tables",
  missingTweeter: "tweeter isn't in the driver tables",
  missingRadiator: "the passive radiator isn't in the driver tables",
} as const;
