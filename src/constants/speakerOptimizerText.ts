// The Speaker page's optimizer fold and result cards: fixed words. A leaf file with no imports, so the phone check
// (tests/mobile-check.mjs, run by Node) can read it.

/** The Speaker page's optimizer fold and its result cards: fixed words. */
export const SPEAKER_OPTIMIZER_TEXT = {
  /** the results block's heading */
  results: "Optimizer",
  target: "Target level at 1 m",
  targetUnit: "dB",
  targetYours: (db: string) => `Your design plays ${db} dB at 1 m.`,
  targetUseYours: "Use yours",
  /** the limits' two choices, and the name of each number's box */
  noLimit: "No limit",
  limit: "Limit",
  budget: "Parts budget",
  budgetField: "Most the parts cost",
  weight: "Weight",
  weightField: "Most the box weighs",
  keep: "Keep",
  keepHint:
    "A locked part stays as it is. Size: free, up to this size (≤) or exactly this size (=).",
  run: "Find designs",
  load: "Load",
  undoLoad: "Undo load",
  curveLabel: "Maximum output with one input, this design against yours",
  failing: (problems: string) => `Your design fails: ${problems}. Fixes may cost or weigh more.`,
  groups: {
    drivers: "Drivers",
    horns: "Horns",
    vents: "Vents",
    bands: "Filters and amps",
    size: "Box size",
  },
  chamber: (n: number) => `Chamber ${n}`,
  highpass: "highpass",
  lowpass: "lowpass",
  amp: "amp power",
  vent: "vent",
  axis: { w: "Width", h: "Height", d: "Depth" },
  summaryNoGoal: "no goal picked",
  summaryKeeps: (n: number) => `${n} kept`,
  summaryTarget: (db: number) => `target ${db} dB`,
  summaryBudget: (dollars: number | null) =>
    dollars === null ? "no budget limit" : `budget $${dollars}`,
  summaryWeight: (lb: number | null) => (lb === null ? "no weight limit" : `up to ${lb} lb`),
} as const;
