// A horn mouth's radiation impedance: a circular piston of the mouth's area in a baffle, in the design's solid angle,
// with any boxes beside it. Impedances are acoustic, Pa·s/m³ (pressure over volume velocity).
import type { Complex, RadiationAngle } from "../../types";
import { AIR_DENSITY, SOUND_SPEED } from "../../constants/hornEngine";
import { besselJ, struveH1 } from "./bessel";
import { cx } from "./complex";

/**
 * A rigid circular piston of area S (m²) in an infinite baffle (half space), at frequency `f` (Hz):
 * Z = (ρc/S)·[1 − J₁(2ka)/(ka) + j·H₁(2ka)/(ka)].
 *
 * a is the piston's radius and k = 2πf/c the wave number, so ka compares the piston's size with the wavelength. ρc/S
 * is the impedance of a plane wave across the same area, which the piston approaches when it is large (ka ≫ 1).
 */
export function pistonImpedance(areaM2: number, f: number): Complex {
  const radius = Math.sqrt(areaM2 / Math.PI),
    ka = ((2 * Math.PI * f) / SOUND_SPEED) * radius;
  const planeWave = (AIR_DENSITY * SOUND_SPEED) / areaM2;
  if (ka < 1e-6) return cx(0);
  return cx(planeWave * (1 - besselJ(1, 2 * ka) / ka), (planeWave * struveH1(2 * ka)) / ka);
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
  const together = pistonImpedance(areaM2 * pistons, f);
  return cx(together.re * pistons, together.im * pistons);
}
