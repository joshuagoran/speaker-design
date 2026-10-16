// A folded horn path's runs as the Horn settings edit them (`HornRun`, lengths in cm): one run changed, added or
// removed, and a run's wall named by where it faces. Pure.
import type { HornMount, HornRun } from "../../types";
import { SPEAKER_TEXT } from "../../constants/speakerPage";

/** A new run's length over the last run's, and the turn it takes from it, degrees: a quarter turn, as a fold. */
const NEW_RUN_SHARE = 0.5;
const NEW_RUN_TURN_DEG = 90;

/** The runs with run `i` changed; a length or angle that is not a finite number leaves them as they are. */
export function withRunEdited(
  runs: readonly HornRun[],
  i: number,
  change: Partial<HornRun>,
): HornRun[] {
  if (Object.values(change).some((v) => !Number.isFinite(v))) return [...runs];
  return runs.map((r, k) => (k === i ? { ...r, ...change } : r));
}

/** The runs with one more at the mouth's end: half the last run's length, a quarter turn from it. */
export function withRunAdded(runs: readonly HornRun[]): HornRun[] {
  const last = runs[runs.length - 1];
  if (!last) return [...runs];
  return [
    ...runs,
    {
      lengthCm: last.lengthCm * NEW_RUN_SHARE,
      angleDeg: (last.angleDeg + NEW_RUN_TURN_DEG) % 360,
    },
  ];
}

/** The runs without run `i`. */
export const withRunRemoved = (runs: readonly HornRun[], i: number) =>
  runs.filter((_, k) => k !== i);

/**
 * The drivers' spot after run `removed` goes: on a later run, that run's new number; on the removed run, none (the
 * fold then picks the spot closest to the drive's taps).
 */
export function mountAfterRemoval(mount: HornMount, removed: number): HornMount | undefined {
  if (mount.run === removed) return undefined;
  return mount.run > removed ? { ...mount, run: mount.run - 1 } : mount;
}

/**
 * A run's wall named by the way it faces in the side view: a run more along the depth than up has an upper and a lower
 * wall, one more up the box a front and a back wall. `side` 1 is the left of the run's way, −1 its right.
 */
export function wallName(angle: number, side: 1 | -1): string {
  /** the wall's outward normal: the run's left normal, or its right */
  const nz = -Math.sin(angle) * side,
    ny = Math.cos(angle) * side;
  if (Math.abs(ny) >= Math.abs(nz)) return ny > 0 ? SPEAKER_TEXT.wallUpper : SPEAKER_TEXT.wallLower;
  return nz > 0 ? SPEAKER_TEXT.wallBack : SPEAKER_TEXT.wallFront;
}
