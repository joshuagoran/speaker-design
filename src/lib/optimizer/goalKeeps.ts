// What each optimizer goal keeps from your design, for both optimizers: the level it may give up and the F3 it may
// add. The PA and Hi-fi keep tables are built from it.
import type { HifiGoal, PaGoal, SpeakerGoal } from "../../types";
import type { Keep } from "./shortfall";
import { keysOf } from "../records";

/** A goal both optimizers offer. */
export type KeepGoal = PaGoal & HifiGoal;

/** How far a goal may fall from your design: dB of level below it, Hz of F3 above it (Infinity: no limit). */
export const GOAL_KEEPS: Record<KeepGoal, { db: number; hz: number }> = {
  cheaper: { db: 0.5, hz: 2 },
  lighter: { db: 0.5, hz: 2 },
  lower: { db: 1.5, hz: Infinity },
  louder: { db: Infinity, hz: 3 },
};

/** The Speaker optimizer's keeps: the shared goals' own, and smaller keeps what lighter keeps. */
export const SPEAKER_GOAL_KEEPS: Record<SpeakerGoal, { db: number; hz: number }> = {
  ...GOAL_KEEPS,
  smaller: GOAL_KEEPS.lighter,
};

/** Each goal's keep in `table` from a level to hold (dB) and your design's F3 (Hz). */
export const keepsFrom = <G extends string>(
  table: Record<G, { db: number; hz: number }>,
  db: number,
  f3: number,
): Record<G, Keep> =>
  // boundary cast: Object.fromEntries types its result as an index signature; the keys are exactly the table's own
  Object.fromEntries(
    keysOf(table).map((g) => [g, { db: db - table[g].db, f3: f3 + table[g].hz }]),
  ) as Record<G, Keep>;
