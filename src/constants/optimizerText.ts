import type { HifiGoal, PaGoal } from "../types";

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

/** How the near miss names the closest design when it is your own design as it is ("Closest: your design (…)"). */
export const NEAR_MISS_YOURS = "your design";

/** The sentence under a card both optimizers word the same way. */
export const CARD_WHY = {
  closest: "Passes the checks. Closest to your goal.",
  smallest: "Changes one thing from your design.",
  altLower: "Goes lower than your design.",
} as const;

/** The optimizer panel and result cards' fixed copy, the same on every page. */
export const OPTIMIZER_PANEL_TEXT = {
  heading: "Find a better design",
  limitedBy: "Limited by:",
  /** after the run stats when there are cards (PA and Hi-fi) */
  cardsPass: " · all pass the checks (warnings on each card)",
  /** the notice when no design fits */
  noFit: "No design fits your limits",
  /** before the near miss's option buttons, when there are cards */
  looserLimit: "Reaches the goal with a looser limit:",
} as const;

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
  highpass: "high-pass",
  crossovers: "crossovers",
  ampPower: "amp power",
  woofer: "woofer",
  tweeter: "tweeter",
  boxType: "box type",
  boxSize: "box size",
  port: "port",
  radiator: "radiator",
  crossover: "crossover",
  coaxial: "coaxial",
  horn: "horn",
  bandLevels: "band levels",
  boxCrossovers: "box crossovers",
  boxLevels: "box levels",
  delays: "delays",
} as const;

/** How the notice starts when the first card only comes closest and misses a level or F3 the goals keep. */
export const OUT_OF_REACH_LEAD = "Out of reach within the checks";
