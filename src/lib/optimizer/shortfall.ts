// How far a design falls short of what a goal keeps from your design, and the notice both optimizers show when the
// first card only comes closest. Each engine keeps its own level (PA output, Hi-fi level at the seat) and wording.
import { OUT_OF_REACH_LEAD } from "../../constants/optimizerText";

/** What a goal keeps from your design: the level it has to reach, dB, and the F3 it can't pass, Hz. */
export interface Keep {
  db: number;
  f3: number;
}

/** How far a design falls short of a keep: dB of level, plus a dB for every 5 Hz of F3 over it; 0 when it keeps it. */
export const keepGap = (k: Keep, x: Keep) =>
  Math.max(0, k.db - x.db) + Math.max(0, x.f3 - k.f3) / 5;

/**
 * The notice when the first card only comes closest: what the goals keep that it misses, and what it reaches.
 * `level` names the level ("of output", "at the seat"), `f3` the F3 ("an F3", "an in-room F3"), `both` the pair.
 */
export function outOfReachNotice(
  keeps: readonly Keep[],
  got: Keep,
  words: { level: string; f3: string; both: string },
): string {
  const needDb = Math.max(...keeps.map((k) => k.db)),
    maxF3 = Math.min(...keeps.map((k) => k.f3));
  const missed = [
    got.db < needDb ? `${needDb.toFixed(1)} dB ${words.level}` : null,
    got.f3 > maxF3 ? `${words.f3} of ${maxF3.toFixed(0)} Hz or lower` : null,
  ].filter((x) => x != null);
  const reached = `${got.db.toFixed(1)} dB, F3 ${got.f3.toFixed(0)} Hz`;
  return missed.length
    ? `${OUT_OF_REACH_LEAD}: ${missed.join(" with ")}. Closest (first card): ${reached}.`
    : `No passing design keeps your ${words.both}. Closest (first card): ${reached}.`;
}
