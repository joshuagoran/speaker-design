// A horn mouth's radiation impedance: a circular piston of the mouth's area in a baffle, in the design's solid angle,
// with any boxes beside it.
import type { Complex, RadiationAngle } from "../../types";
import { AIR_DENSITY, SOUND_SPEED } from "../../constants/hornEngine";
import { besselJ, struveH1 } from "./bessel";
import { cx } from "./complex";

/**
 * A rigid circular piston of area S (m²) in an infinite baffle (half space), acoustic impedance (Pa·s/m³):
 * Z = (ρc/S)·[1 − J₁(2ka)/(ka) + j·H₁(2ka)/(ka)], a the piston's radius.
 */
export function pistonImpedance(areaM2: number, f: number): Complex {
  const a = Math.sqrt(areaM2 / Math.PI),
    ka = ((2 * Math.PI * f) / SOUND_SPEED) * a;
  const z0 = (AIR_DENSITY * SOUND_SPEED) / areaM2;
  if (ka < 1e-6) return cx(0);
  return cx(z0 * (1 - besselJ(1, 2 * ka) / ka), (z0 * struveH1(2 * ka)) / ka);
}

/**
 * One mouth's radiation impedance in a solid angle of `angle`·π, beside `count − 1` identical mouths it touches.
 *
 * Boundaries and neighbors work by images: a mouth in a quarter space (π) and its mirror image move together, as one
 * piston of twice the area in half space, so each carries Z = 2·Z_piston(2S). The same holds for the boxes of a stack.
 * Images that only touch at an edge, not a full side, make this an approximation.
 */
export function mouthImpedance(
  areaM2: number,
  f: number,
  angle: RadiationAngle,
  count: number,
): Complex {
  const n = (2 / angle) * count;
  const z = pistonImpedance(areaM2 * n, f);
  return cx(z.re * n, z.im * n);
}
