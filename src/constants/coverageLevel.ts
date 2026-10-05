import type { CoverageLevelMode, CoverageLevelRef } from "../types";

/** Where the coverage map's target can be measured, by id. */
export const COVERAGE_LEVEL_REF = {
  listener: "listener",
  audience: "audience",
  stacks: "stacks",
} as const satisfies Record<CoverageLevelRef, CoverageLevelRef>;

/** The "Measured at" choices, with their names, in display order. */
export const COVERAGE_LEVEL_REFS = [
  [COVERAGE_LEVEL_REF.listener, "The listener"],
  [COVERAGE_LEVEL_REF.audience, "Audience average"],
  [COVERAGE_LEVEL_REF.stacks, "1 m from the stacks"],
] as const satisfies readonly (readonly [CoverageLevelRef, string])[];

/** Each reference as a sentence names it ("the target at …"). */
export const COVERAGE_LEVEL_REF_PLACE = {
  listener: "the listener",
  audience: "the audience average",
  stacks: "1 m from the stacks",
} as const satisfies Record<CoverageLevelRef, string>;

/** The old level setting's values, for loading layouts saved before the target level. */
export const LEGACY_LEVEL_MODE = {
  limit: "limit",
  listener: "listener",
} as const satisfies Record<CoverageLevelMode, CoverageLevelMode>;

/** The target level slider's range, dB SPL. */
export const COVERAGE_TARGET_DB: [lo: number, hi: number] = [85, 125];
