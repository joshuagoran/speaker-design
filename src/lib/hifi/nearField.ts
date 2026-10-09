// The Hi-fi model close in: the level at a seat from each speaker and driver at its own distance, and the baffle step
// and boundary gain as a near listener hears them. From HIFI_NEAR_FIELD_M out every term here is exactly the far-field
// model's (1 / distance from the speaker, the full baffle step, the placement's full gain); closer in, each takes its
// near-field form relative to its value at that distance, so the two join without a step. Pure functions, no DOM.
import { HIFI_NEAR_FIELD_M, HIFI_PAIR_SUM_DB } from "../../constants/hifiEngine";
import { edgeSegments, type BafflePoint } from "./diffraction";
import type { Dims2, HifiSeatPaths, HifiSystem } from "../../types";

const IN = 0.0254;

/**
 * The least path a driver's level is worked out at, m: half its radius. On a piston's axis at low frequency the
 * pressure at its face (ρc·U·ka) is what the far-field 1 / r law reaches at r = a / 2, so nothing closer can be louder
 * than that, and a seat at the driver stays finite.
 */
export const driverPathFloorM = (radiusM: number) => radiusM / 2;

/**
 * A near-field term's share of its far-field value at `distM`, m: its value there over its value at HIFI_NEAR_FIELD_M,
 * at most 1, and exactly 1 from there out (`at` rises toward its far-field value with distance).
 */
const shareAt = (distM: number, at: (d: number) => number) =>
  distM >= HIFI_NEAR_FIELD_M ? 1 : Math.min(1, at(distM) / at(HIFI_NEAR_FIELD_M));

/**
 * A driver's path to a listener `distM` from the speaker whose ear is `offM` off the driver's axis (its height above
 * or below the driver), m. Far away that offset is negligible and the model uses `distM` (the far-field level falls
 * as 1 / distance from the speaker); closer in, the true path (hypot) over its value at HIFI_NEAR_FIELD_M, which
 * matters when the woofer and tweeter sit inches apart a foot from the ear.
 */
export const nearFieldPathM = (distM: number, offM: number) =>
  distM >= HIFI_NEAR_FIELD_M
    ? distM
    : (Math.hypot(distM, offM) * HIFI_NEAR_FIELD_M) / Math.hypot(HIFI_NEAR_FIELD_M, offM);

/**
 * How much of the baffle step's edge wave a listener `distM` out on the axis of a driver at `src` (inches on a `dim`
 * baffle) hears, against a far listener: the edge-source model of ./diffraction (each edge re-radiates −1/2 of the
 * driver's sound, weakened by its longer path to the listener; Vanderkooy, "A simple theory of cabinet edge
 * diffraction", JAES 39(12), 1991), averaged round the edges, over its value at HIFI_NEAR_FIELD_M. 1 from there out,
 * falling toward 0 as the listener nears the baffle and it looks infinite to them (half space: no step).
 */
export const baffleEdgeShare = (dim: Dims2, src: BafflePoint, distM: number) =>
  shareAt(distM, (d) => {
    const segs = edgeSegments(dim, src, { ...src, z: d / IN });
    // the edge waves' strength (each segment's is negative), over the −1/2 a far listener hears
    let sum = 0;
    for (const s of segs) sum -= s.amp;
    return 2 * sum;
  });

/**
 * The near baffle step over the far one, as a gain, at the shelf's `x` (0.707 f / f3, lib/hifi baffleStepShelf): the
 * same first-order shelf with its low-frequency floor raised from 1/2 (full space) to 1 − share / 2, so the step is
 * 6 dB far away and none at the baffle.
 */
export function nearBaffleStepGain(x: number, share: number) {
  if (share >= 1) return 1;
  const lo = 1 - share / 2;
  return Math.sqrt((lo * lo + x * x) / (0.25 + x * x));
}

/**
 * How much of the placement's boundary gain a listener `distM` in front of a speaker `wallM` from the wall behind it
 * hears, against a far listener: the wall's image source is 2 · `wallM` further away than the speaker, so its share of
 * the direct sound is distM / (distM + 2 wallM), over its value at HIFI_NEAR_FIELD_M. 1 from there out, falling to 0
 * at the speaker, where the direct sound swamps the boundary's.
 */
export const boundaryShare = (distM: number, wallM: number) =>
  shareAt(distM, (d) => d / (d + 2 * wallM));

/**
 * The near boundary gain over the far one, at the shelf's `x` (f / (c / 4 wallM), lib/hifi boundaryGain): the
 * placement's low-frequency gain `farGain` (pressure) with its excess over 1 scaled by `share`.
 */
export function nearBoundaryGain(x: number, farGain: number, share: number) {
  if (share >= 1 || farGain === 1) return 1;
  const g = 1 + (farGain - 1) * share;
  return Math.sqrt((g * g + x * x) / (farGain * farGain + x * x));
}

/**
 * The pair's clean level at the seat, dB: each speaker's lesser of its woofer's and its tweeter's 1 m levels, each
 * falling with its own path, then the two speakers added in power. Power, not pressure: the two arrive over different
 * paths (and with the room's reflections), so across a music band their phases are as good as random and they add
 * +3 dB when equal, not the +6 dB of a coherent sum, which only holds low down at a seat exactly between them. Equal
 * speakers give each one's level + HIFI_PAIR_SUM_DB; a much closer speaker gives about its own level alone.
 */
export function hifiPairLevelDb(
  levels: Pick<HifiSystem, "wLevel" | "tLevel">,
  [left, right]: readonly [HifiSeatPaths, HifiSeatPaths],
) {
  const at = (p: HifiSeatPaths) =>
    Math.min(levels.wLevel - 20 * Math.log10(p.wM), levels.tLevel - 20 * Math.log10(p.tM));
  const a = at(left),
    b = at(right),
    hi = Math.max(a, b);
  // each speaker's power over the louder one's, averaged: 1 for an equal pair
  return (
    hi + HIFI_PAIR_SUM_DB + 10 * Math.log10((1 + Math.pow(10, (Math.min(a, b) - hi) / 10)) / 2)
  );
}
