// Directivity and the baffle step: a rigid piston's and a waveguide's patterns off axis, the baffle step as a shelf
// with its phase, and the grid every dispersion map is sampled on. Pure functions, no DOM.
import { complex, divide } from "./complex";
import { keeleFrequency } from "./boxModels";
import { BAFFLE_STEP_HZ_M } from "../../constants/acoustics";
import type { Complex, HifiDispersionMap } from "../../types";
import {
  DISPERSION_ANGLE_MAX_DEG,
  DISPERSION_ANGLE_STEP_DEG,
  DISPERSION_FREQ_POINTS,
  DISPERSION_FREQ_MAX_HZ,
  DISPERSION_FREQ_MIN_HZ,
} from "../../constants/chartScales";
const C = 343,
  IN = 0.0254;

// ---- baffle step, placement, compensation (magnitude shelves; the baffle step also with its phase) ----
/** The baffle step's −3 dB point for a baffle `baffleWIn` inches wide, Hz (`BAFFLE_STEP_HZ_M`). */
export const baffleStepF3 = (baffleWIn: number) => BAFFLE_STEP_HZ_M / (baffleWIn * IN);
// the same step with its phase: the first-order shelf 0.5 (1 + 2jx) / (1 + jx), whose magnitude is baffleStepGain
export function baffleStepShelf(f: number, baffleWIn: number): Complex {
  const x = (0.707 * f) / baffleStepF3(baffleWIn);
  return divide(complex(0.5, x), complex(1, x));
}
// ---- directivity ----
// Bessel J1 (Numerical Recipes rational approximation)
function j1(x: number) {
  const ax = Math.abs(x);
  if (ax < 8) {
    const y = x * x;
    const a =
      x *
      (72362614232 +
        y *
          (-7895059235 +
            y * (242396853.1 + y * (-2972611.439 + y * (15704.4826 + y * -30.16036606)))));
    const b =
      144725228442 +
      y * (2300535178 + y * (18583304.74 + y * (99447.43394 + y * (376.9991397 + y))));
    return a / b;
  }
  const z = 8 / ax,
    y = z * z,
    xx = ax - 2.356194491;
  const p =
    1 + y * (0.183105e-2 + y * (-0.3516396496e-4 + y * (0.2457520174e-5 + y * -0.240337019e-6)));
  const q =
    0.04687499995 +
    y * (-0.2002690873e-3 + y * (0.8449199096e-5 + y * (-0.88228987e-6 + y * 0.105787412e-6)));
  const v = Math.sqrt(0.636619772 / ax) * (Math.cos(xx) * p - z * Math.sin(xx) * q);
  return x < 0 ? -v : v;
}
/** A rigid piston's pattern, 2·J1(x)/x, at x = ka·sin θ. */
export const pistonPattern = (x: number) => (x < 1e-6 ? 1 : Math.abs((2 * j1(x)) / x));
// rigid piston of radius a (m) in a baffle, off-axis by theta (rad): 2·J1(x)/x, x = ka·sin θ
export function pistonDirectivity(f: number, a: number, theta: number) {
  return pistonPattern(
    ((2 * Math.PI * f) / C) * a * Math.sin(Math.min(Math.abs(theta), Math.PI / 2)),
  );
}
// ---- a horn's mouth: one plane at a time ----
/**
 * Where a line piston's pattern |sin x / x| falls to half (−6 dB): x = 1.8955. With x = (kW/2)·sin θ, its −6 dB full
 * angle at small angles is about 23 700 / (f·W) degrees (W in m), within about 7% of Keele's 25 400 (see
 * `keeleFrequency`).
 */
const LINE_PISTON_HALF_X = 1.8955;
/**
 * A line piston's (a strip's) pattern, pressure, at x = (kW/2)·sin θ: |sin x / x|. Source: L. E. Kinsler, A. R. Frey,
 * A. B. Coppens and J. V. Sanders, "Fundamentals of Acoustics", 4th ed. (2000), the continuous line source. A
 * rectangular piston's pattern is the product of one for each side.
 * Shortcoming: a rigid, flat, in-phase piston in a baffle; a real mouth has a curved wavefront and diffracts at its
 * edges.
 */
export const linePistonPattern = (x: number) =>
  Math.abs(x) < 1e-6 ? 1 : Math.abs(Math.sin(x) / x);
/** Where a line piston's pattern first falls `fallDb` (0 up to the first null), x = (kW/2)·sin θ. */
export function linePistonX(fallDb: number): number {
  const target = Math.pow(10, -fallDb / 20);
  let lo = 0,
    hi = Math.PI;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (linePistonPattern(mid) > target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
/**
 * One plane of a horn mouth's pattern at one frequency: a line piston as wide as the mouth in that plane (`kHalfW`,
 * its kW/2), or held at the walls' half angle (`half`, radians).
 */
export type MouthPlane =
  | { kHalfW: number; half?: undefined }
  | { half: number; kHalfW?: undefined };
/**
 * One plane of a horn mouth's pattern at `f`, from the mouth's size in that plane (in) and its walls' included angle
 * (degrees; null where the walls are parallel). The mouth radiates as a line piston as wide as itself, narrowing as the
 * frequency rises, until its −6 dB half angle reaches the walls' half angle; above that the walls hold the pattern at
 * their angle. Parallel walls never hold it: the plane stays a piston and keeps narrowing.
 * Source: D. B. Keele Jr., "What's So Sacred About Exponential Horns?", AES preprint 1038 (1975): a horn holds its
 * wall angle down to where its mouth is wide enough for that angle (the pattern-control frequency), and below that its
 * pattern widens as the mouth's own. Taking that wider pattern as a line piston's, and the change at the piston's own
 * −6 dB angle, is our approximation.
 * Shortcomings: the angle is held exactly above the change (real horns narrow or widen a little there: mid-range
 * narrowing, waistbanding); the change is sharp, not gradual; the mouth is a flat rigid piston in a baffle (no mouth
 * diffraction or reflection from its edges).
 */
export function mouthPlane(f: number, widthIn: number, wallDeg: number | null): MouthPlane {
  const kHalfW = ((2 * Math.PI * f) / C) * ((widthIn * IN) / 2);
  if (wallDeg === null) return { kHalfW };
  const wallHalf = (wallDeg / 2) * (Math.PI / 180);
  const pistonHalf =
    kHalfW > LINE_PISTON_HALF_X ? Math.asin(LINE_PISTON_HALF_X / kHalfW) : Math.PI / 2;
  return pistonHalf > wallHalf ? { kHalfW } : { half: wallHalf };
}
/** A mouth plane's −6 dB half angle, radians: the walls' where they hold it, else the piston's (a quarter turn at most). */
export const mouthPlaneHalf = (plane: MouthPlane) =>
  plane.half ??
  (plane.kHalfW > LINE_PISTON_HALF_X ? Math.asin(LINE_PISTON_HALF_X / plane.kHalfW) : Math.PI / 2);
/**
 * A mouth plane's level (pressure) at `angle` radians off its axis in that plane: the piston's pattern, or where the
 * walls hold it the same −6·(θ/half)² dB fall as a waveguide's (`waveguideGain`; our approximation of a horn's beam,
 * not a measured shape), −40 dB at most. Behind the mouth (past a quarter turn) both kinds keep their value at a
 * quarter turn; what the box lets through behind it is the caller's (lib/acoustics/coverage `boxShadow`), one rule for
 * both planes. Shortcoming: the sound behind a mouth is its edge value less the box's shadow, not a modeled rear lobe.
 */
export function mouthPlaneGain(angle: number, plane: MouthPlane): number {
  const off = Math.min(Math.abs(angle), Math.PI / 2);
  if (plane.half !== undefined)
    return Math.pow(10, Math.max(-40, -6 * (off / plane.half) ** 2) / 20);
  return linePistonPattern(plane.kHalfW * Math.sin(off));
}
/**
 * A horn mouth's level (pressure) at `th` radians off its axis across and `tv` up: one plane's times the other's.
 * Shortcoming: a pattern per plane, multiplied (as a rectangular piston's): no full balloon, so off both axes at once
 * it is only an estimate.
 */
export const mouthGain = (th: number, tv: number, [h, v]: readonly [MouthPlane, MouthPlane]) =>
  mouthPlaneGain(th, h) * mouthPlaneGain(tv, v);
/**
 * A waveguide's half coverage angles at `f`, radians, horizontal and vertical: its rated coverage above the mouth's
 * control frequency, wider below it.
 */
export function waveguideHalfAngles(
  f: number,
  covH: number,
  covV: number,
  mouthWIn: number,
  mouthHIn: number,
): [h: number, v: number] {
  const fh = keeleFrequency(covH, mouthWIn),
    fv = covV && mouthHIn ? keeleFrequency(covV, mouthHIn) : fh;
  const bh = Math.min(180, f >= fh ? covH : (covH * fh) / f),
    bv = Math.min(180, f >= fv ? covV || covH : ((covV || covH) * fv) / f);
  return [((bh / 2) * Math.PI) / 180, ((bv / 2) * Math.PI) / 180];
}
/** A waveguide's level (pressure) at `th`, `tv` radians off axis, given its half angles: −6 dB at the edges, −40 dB at most. */
export function waveguideGain(th: number, tv: number, [h, v]: [h: number, v: number]) {
  const db = -6 * ((th / h) ** 2 + (tv / v) ** 2);
  return Math.pow(10, Math.max(-40, db) / 20);
}
// waveguide: constant coverage (−6 dB at the edges) above the mouth's control frequency, wider below it
export function waveguideDirectivity(
  f: number,
  covH: number,
  covV: number,
  mouthWIn: number,
  mouthHIn: number,
  th: number,
  tv: number,
) {
  return waveguideGain(th, tv, waveguideHalfAngles(f, covH, covV, mouthWIn, mouthHIn));
}

export const logSpacedFrequencies = (a: number, b: number, n: number) =>
  Array.from({ length: n }, (_, i) => a * Math.pow(b / a, i / (n - 1)));

/** The grid every dispersion map (PA and Hi-fi, both planes) is sampled on: −90..90° at one step, the dispersion frequency axis (50 Hz-20 kHz). */
export const dispersionGrid = (): Pick<HifiDispersionMap, "angles" | "freqs"> => ({
  angles: Array.from(
    { length: (2 * DISPERSION_ANGLE_MAX_DEG) / DISPERSION_ANGLE_STEP_DEG + 1 },
    (_, i) => -DISPERSION_ANGLE_MAX_DEG + i * DISPERSION_ANGLE_STEP_DEG,
  ),
  freqs: logSpacedFrequencies(
    DISPERSION_FREQ_MIN_HZ,
    DISPERSION_FREQ_MAX_HZ,
    DISPERSION_FREQ_POINTS,
  ),
});
