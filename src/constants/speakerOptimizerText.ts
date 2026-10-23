// The Speaker page's optimizer fold and result cards: fixed words. A leaf file with no imports, so the phone check
// (tests/mobile-check.mjs, run by Node) can read it.

/** The Speaker page's optimizer fold and its result cards: fixed words. */
export const SPEAKER_OPTIMIZER_TEXT = {
  /** the results block's heading */
  results: "Optimizer",
  target: "Goal level at 1 m",
  targetUnit: "dB SPL",
  /** under the goal level while it is louder than the design now, by the whole dB between them */
  goalAbove: (db: number) => `${db} dB above the current design.`,
  /** the limits' two choices, and the name of each number's box */
  noLimit: "No limit",
  limit: "Limit",
  budget: "Parts budget",
  budgetField: "Most the parts cost",
  weight: "Weight",
  weightField: "Most the box weighs",
  run: "Find designs",
  load: "Load",
  /** the notice over cards searched for a design edited since (their Load is off) */
  stale: "The design changed after this search. Run it again.",
  undoLoad: "Undo load",
  curveLabel: "Maximum output with one input, this design against yours",
  /** a result card's tiles, and the line of what it changes */
  tile: { weight: "Weight", level: "Level at 1 m", f3: "F3", volume: "Volume" },
  changes: "Changes",
  changesNone: "none",
  failing: (problems: string) => `Your design fails: ${problems}. Fixes may cost or weigh more.`,
  chamber: (n: number) => `Chamber ${n}`,
  axis: { w: "Width", h: "Height", d: "Depth" },
  /** a chamber axis's size lock beside its padlock and after its name in the Locked line: up to this size, exactly it */
  sizeMark: { max: "≤", exact: "=" },
  summaryNoGoal: "no goal picked",
  summaryKeeps: (n: number) => `${n} locked`,
  summaryTarget: (db: number) => `target ${db} dB`,
  summaryBudget: (dollars: number | null) =>
    dollars === null ? "no budget limit" : `budget $${dollars}`,
  /** the weight limit, with its unit, or none */
  summaryWeight: (weight: string | null) =>
    weight === null ? "no weight limit" : `up to ${weight}`,
} as const;
