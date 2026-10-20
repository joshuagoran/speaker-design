import type { CoverageLevelRef } from "../types";

/** The point each main box's delay aligns at, as the "Measured at" choice and the map's key name it. */
export const ALIGNMENT_POINT = "Alignment point";

/** Where the coverage map's target can be measured, by id. */
export const COVERAGE_LEVEL_REF = {
  // the alignment point: saves and share links carry "listener", so the key keeps that spelling
  listener: "listener",
  audience: "audience",
  stacks: "stacks",
} as const satisfies Record<CoverageLevelRef, CoverageLevelRef>;

/** The "Measured at" choices, with their names, in display order. */
export const COVERAGE_LEVEL_REFS = [
  [COVERAGE_LEVEL_REF.listener, ALIGNMENT_POINT],
  [COVERAGE_LEVEL_REF.audience, "Audience average"],
  [COVERAGE_LEVEL_REF.stacks, "1 m from the stacks"],
] as const satisfies readonly (readonly [CoverageLevelRef, string])[];

/** Each reference as a sentence names it ("the target at …"). */
export const COVERAGE_LEVEL_REF_PLACE = {
  listener: "the alignment point",
  audience: "the audience average",
  stacks: "1 m from the stacks",
} as const satisfies Record<CoverageLevelRef, string>;

/** The coverage edge, dB against the target: the coverage map's medium line and the "≥ −6 dB" share of the floor. */
export const COVERAGE_EDGE_DB = -6;

/** The target level slider's range, dB SPL. */
export const COVERAGE_TARGET_DB: [lo: number, hi: number] = [85, 125];
