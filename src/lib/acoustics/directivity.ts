// Directivity and the baffle step: a rigid piston's and a waveguide's patterns off axis, the baffle step as a shelf
// with its phase, and the grid every dispersion map is sampled on. Pure functions, no DOM.
import { complex, divide } from "./complex";
import { keeleFrequency } from "./boxModels";
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
export const baffleStepF3 = (baffleWIn: number) => 115 / (baffleWIn * IN); // −3 dB point, Hz
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
