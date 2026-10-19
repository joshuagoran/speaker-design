// What each optimizer goal keeps from your design, for both optimizers: the level it may give up and the F3 it may
// add. The PA and Hi-fi keep tables are built from it, and the panels' Details line says it in words.
import type { HifiGoal, PaGoal, SpeakerGoal } from "../../types";
import type { Keep } from "./shortfall";
import { keysOf } from "../records";
import { SPEAKER_UNMODELED } from "../../constants/speakerOptimizer";

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

/**
 * How an optimizer words the level a goal may give up, given the allowance ("0.5 dB"), plus an optional footnote, and
 * what its goals hold to when your design can't be modeled (there is nothing of it to keep).
 */
export interface KeepWords {
  level: (db: string) => string;
  note?: string;
  unmodeled: string;
}

/** The Speaker optimizer's words: the target is the level at 1 m the page sets (it starts at your design's). */
export const SPEAKER_KEEP_WORDS: KeepWords = {
  level: (db) => `level stays at most ${db} under the target`,
  note: "Level: the music level at 1 m. F3: the lowest band's.",
  unmodeled: SPEAKER_UNMODELED,
};

/** One goal's line from its keep: what it may give up, e.g. "Cheaper: your level drops at most 0.5 dB, your F3 rises at most 2 Hz." */
function keepTextOf(k: { db: number; hz: number }, name: string, words: KeepWords): string {
  const parts = [
    Number.isFinite(k.db) ? words.level(`${k.db} dB`) : null,
    Number.isFinite(k.hz) ? `your F3 rises at most ${k.hz} Hz` : null,
  ].filter((x) => x != null);
  return parts.length ? `${name}: ${parts.join(", ")}.` : `${name}: no limit on level or F3.`;
}

/**
 * The Details lines for the picked goals: what each keeps from your design (named by `defs`, kept by `table`), then
 * the footnote; when your design can't be modeled, the one line saying what the goals hold to instead.
 */
export function keepLinesFrom<G extends string>(
  table: Record<G, { db: number; hz: number }>,
  goals: readonly G[],
  defs: Record<G, { short: string }>,
  words: KeepWords,
  modeled: boolean,
): string[] {
  if (!goals.length) return [];
  if (!modeled) return [words.unmodeled];
  const lines = goals.map((g) => keepTextOf(table[g], defs[g].short, words));
  return words.note ? [...lines, words.note] : lines;
}
