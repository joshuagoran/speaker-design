// What each optimizer goal keeps from your design, for both optimizers: the level it may give up and the F3 it may
// add. The PA and Hi-fi keep tables are built from it, and the panels' Details line says it in words.
import type { HifiGoal, PaGoal } from "../../types";
import type { Keep } from "./shortfall";

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
export const goalKeeps = (db: number, f3: number): Record<KeepGoal, Keep> => ({
  cheaper: { db: db - GOAL_KEEPS.cheaper.db, f3: f3 + GOAL_KEEPS.cheaper.hz },
  lighter: { db: db - GOAL_KEEPS.lighter.db, f3: f3 + GOAL_KEEPS.lighter.hz },
  lower: { db: db - GOAL_KEEPS.lower.db, f3: f3 + GOAL_KEEPS.lower.hz },
  louder: { db: db - GOAL_KEEPS.louder.db, f3: f3 + GOAL_KEEPS.louder.hz },
});

/** How an optimizer words the level a goal may give up, given the allowance ("0.5 dB"), plus an optional footnote. */
export interface KeepWords {
  level: (db: string) => string;
  note?: string;
}

/** Hi-fi keeps your design's own clean level at the seat. */
export const HIFI_KEEP_WORDS: KeepWords = {
  level: (db) => `your level drops at most ${db}`,
  note: "Level is the clean level at the seat; F3 is measured in the room.",
};

/** PA keeps the target output: your output or the room's need, whichever is higher. */
export const PA_KEEP_WORDS: KeepWords = {
  level: (db) => `output stays at most ${db} under the target`,
  note: "The target is your output or the room's need, whichever is higher.",
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
