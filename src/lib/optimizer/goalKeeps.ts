// What each optimizer goal keeps from your design, for both optimizers: the level it may give up and the F3 it may
// add. The PA and Hi-fi keep tables are built from it, and the panels' Details line says it in words.
import type { HifiGoal, PaGoal } from "../../types";
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

/** Each goal's keep from a level to hold (dB) and your design's F3 (Hz). */
export const goalKeeps = (db: number, f3: number): Record<KeepGoal, Keep> =>
  // boundary cast: Object.fromEntries types its result as an index signature; the keys are exactly GOAL_KEEPS' own
  Object.fromEntries(
    keysOf(GOAL_KEEPS).map((g) => [g, { db: db - GOAL_KEEPS[g].db, f3: f3 + GOAL_KEEPS[g].hz }]),
  ) as Record<KeepGoal, Keep>;

/**
 * How an optimizer words the level a goal may give up, given the allowance ("0.5 dB"), plus an optional footnote, and
 * what its goals hold to when your design can't be modelled (there is nothing of it to keep).
 */
export interface KeepWords {
  level: (db: string) => string;
  note?: string;
  unmodelled: string;
}

/** Hi-fi keeps your design's own clean level at the seat. */
export const HIFI_KEEP_WORDS: KeepWords = {
  level: (db) => `your level drops at most ${db}`,
  note: "Level is the clean level at the seat; F3 is measured in the room.",
  unmodelled:
    "Your design can't be modelled, so the goals keep nothing from it: a card only has to pass the checks and fit the budget.",
};

/** The F3 the PA goals measure from when your design can't be modelled, Hz. */
export const PA_UNMODELLED_F3_HZ = 40;

/** PA keeps the target output: your output or the room's need, whichever is higher. */
export const PA_KEEP_WORDS: KeepWords = {
  level: (db) => `output stays at most ${db} under the target`,
  note: "The target is your output or the room's need, whichever is higher.",
  unmodelled: `Your design can't be modelled, so the goals measure from the room's need and a ${PA_UNMODELLED_F3_HZ} Hz F3 in place of your output and F3.`,
};

/** One line per goal: what it may give up, e.g. "Cheaper: your level drops at most 0.5 dB, your F3 rises at most 2 Hz." */
export function keepText(goal: KeepGoal, name: string, words: KeepWords): string {
  const k = GOAL_KEEPS[goal];
  const parts = [
    Number.isFinite(k.db) ? words.level(`${k.db} dB`) : null,
    Number.isFinite(k.hz) ? `your F3 rises at most ${k.hz} Hz` : null,
  ].filter((x) => x != null);
  return parts.length ? `${name}: ${parts.join(", ")}.` : `${name}: no limit on level or F3.`;
}

/**
 * The Details lines for the picked goals: what each keeps from your design (named by `defs`), then the footnote; when
 * your design can't be modelled, the one line saying what the goals hold to instead.
 */
export function keepLines(
  goals: readonly KeepGoal[],
  defs: Record<KeepGoal, { short: string }>,
  words: KeepWords,
  modelled: boolean,
): string[] {
  if (!goals.length) return [];
  if (!modelled) return [words.unmodelled];
  const lines = goals.map((g) => keepText(g, defs[g].short, words));
  return words.note ? [...lines, words.note] : lines;
}
