import type { CoverageLevelRef } from "../types";

/** Where the coverage map's target can be measured, by id. */
export const COVERAGE_LEVEL_REF = {
  listener: "listener",
  audience: "audience",
  stacks: "stacks",
} as const satisfies Record<CoverageLevelRef, CoverageLevelRef>;

/** The "Measured at" choice for the mean over the floor. */
const AUDIENCE_AVERAGE = "Audience average";

/** The "Measured at" choices, with their names, in display order. */
export const COVERAGE_LEVEL_REFS = [
  [COVERAGE_LEVEL_REF.listener, "Listener"],
  [COVERAGE_LEVEL_REF.audience, AUDIENCE_AVERAGE],
  [COVERAGE_LEVEL_REF.stacks, "1 m from the stacks"],
] as const satisfies readonly (readonly [CoverageLevelRef, string])[];

/** Each reference as a sentence names it ("the target at …"). */
export const COVERAGE_LEVEL_REF_PLACE = {
  listener: "the listener",
  audience: `the **${AUDIENCE_AVERAGE}**`,
  stacks: "1 m from the stacks",
} as const satisfies Record<CoverageLevelRef, string>;

/** The coverage edge, dB against the target: the coverage map's medium line and the "≥ −6 dB" share of the floor. */
export const COVERAGE_EDGE_DB = -6;

/** The target level slider's range, dB SPL. */
export const COVERAGE_TARGET_DB: [lo: number, hi: number] = [85, 125];
