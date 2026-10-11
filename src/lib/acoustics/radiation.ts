// A horn mouth's radiation impedance: a circular piston of the mouth's area in a baffle, in the design's solid angle,
// with any boxes beside it. Impedances are acoustic, Pa·s/m³ (pressure over volume velocity).
import type { Complex, RadiationAngle } from "../../types";
import { AIR_DENSITY, SPEED_OF_SOUND } from "../../constants/acoustics";
import { besselJ, struveH1 } from "./bessel";
import { complex } from "./complex";

/**
 * A rigid circular piston of area S (m²) in an infinite baffle (half space), at frequency `f` (Hz):
 * Z = (ρc/S)·[1 − J₁(2ka)/(ka) + j·H₁(2ka)/(ka)].
 *
 * a is the piston's radius and k = 2πf/c the wave number, so ka compares the piston's size with the wavelength. ρc/S
 * is the impedance of a plane wave across the same area, which the piston approaches when it is large (ka ≫ 1).
 */
export function pistonImpedance(areaM2: number, f: number): Complex {
  /** the piston's radius a, m */
  const radius = Math.sqrt(areaM2 / Math.PI),
    ka = ((2 * Math.PI * f) / SPEED_OF_SOUND) * radius;
  /** ρc/S, Pa·s/m³ */
  const planeWave = (AIR_DENSITY * SPEED_OF_SOUND) / areaM2;
  if (ka < 1e-6) return complex(0);
  return complex(planeWave * (1 - besselJ(1, 2 * ka) / ka), (planeWave * struveH1(2 * ka)) / ka);
}

/**
 * One mouth's radiation impedance at frequency `f` (Hz), in a solid angle of `angle`·π, beside `count − 1` identical
 * mouths it touches.
 *
 * Boundaries and neighbors work by images. A mouth in a quarter space (π) moves together with its mirror image in the
 * wall: the pair is one piston of twice the area in half space, and each half carries Z = 2·Z_piston(2S). The same
 * holds for the boxes of a stack. Images that only touch at an edge, not along a full side, make this an
 * approximation.
 */
export function mouthImpedance(
  areaM2: number,
  f: number,
  angle: RadiationAngle,
  count: number,
): Complex {
  // how many mouths, real and mirrored, move together as one piston
  const pistons = (2 / angle) * count;
  /** the impedance of those mouths as one piston */
  const together = pistonImpedance(areaM2 * pistons, f);
  return complex(together.re * pistons, together.im * pistons);
}

/**
 * The end correction of a rectangular opening a × b in a baffle (any length unit; the result is in the same unit): the
 * low-frequency radiation mass of a uniform rectangular piston, ρ·I/(2π·S²), as a length I/(2π·a·b). I is the double
 * area integral of 1/distance over the piston (the closed form below). A circle gives the familiar 0.85 r.
 */
export function rectangleEndCorrectionIntegral(a: number, b: number) {
  const d = Math.hypot(a, b);
  return (
    (2 / 3) * (a ** 3 + b ** 3 - d ** 3) +
    2 * a * b * (a * Math.log((b + d) / a) + b * Math.log((a + d) / b))
  );
}
export const rectangleEndCorrection = (a: number, b: number) =>
  rectangleEndCorrectionIntegral(a, b) / (2 * Math.PI * a * b);
/** Both ends' correction over a flanged end's: a flanged outer end plus a free inner end, 1.46 r = 0.85 r + 0.61 r. */
export const BOTH_ENDS_CORRECTION_RATIO = 1 + 0.61 / 0.85;
/** A flanged circular piston's end correction over its radius: 8/(3π) ≈ 0.85 (the low-frequency radiation mass). */
export const FLANGED_CIRCLE_END_RATIO = 8 / (3 * Math.PI);
