// A horn segment's transfer matrix, from the wave solutions of the 1-D horn (Webster) equation.
//
// Inside a segment, the pressure is the sum of two waves: a forward one and a backward one, with unknown amplitudes
// (a, b). At any point x, a 2 × 2 "wave matrix" W(x) maps (a, b) to the pressure p and the flow U there. So the
// segment's transfer matrix, which maps the far end's (p₂, U₂) to the near end's (p₁, U₁), is W(x₁)·W(x₂)⁻¹. One
// construction serves every flare law: each needs only its two waves and their slopes.
//
// Words and symbols used below:
// - "flow" (U) is volume velocity, m³/s; "impedance" is acoustic impedance, Pa·s/m³; p is pressure, Pa.
// - ω is the angular frequency 2πf, rad/s; k = ω/c is the wave number, rad/m; ρ is air's density, c the speed of sound.
// - m is an exponential horn's flare constant, 1/m: its area grows as S = S₁·e^(m·x).
// - A transfer matrix [[A, B], [C, D]] gives p₁ = A·p₂ + B·U₂ and U₁ = C·p₂ + D·U₂ (stored row by row as Matrix2).
import type { Complex, HornSegment, Matrix2 } from "../../types";
import { AIR_DENSITY, SOUND_SPEED } from "../../constants/hornEngine";
import { add, cx, div, exp, invertMatrix, mul, mulMatrix, scale, IDENTITY } from "./complex";

const CM2_TO_M2 = 1e-4,
  CM_TO_M = 1e-2;
/** Areas within this ratio of each other make a straight duct: the flare laws divide by the flare there. */
const STRAIGHT_RATIO = 1e-4;

/** A segment's two waves at one point: each one's pressure, and its pressure's slope dp/dx (Pa/m). */
interface WavePair {
  pressure: readonly [Complex, Complex];
  slope: readonly [Complex, Complex];
}

/**
 * The wave matrix W(x) from the two waves and the area at x (m²). The flow follows from the slope by Euler's equation:
 * U = S·u with u = −(1/(jωρ))·dp/dx.
 */
function waveMatrix(waves: WavePair, areaM2: number, omega: number): Matrix2 {
  // −S/(jωρ) = j·S/(ωρ)
  const slopeToFlow = cx(0, areaM2 / (omega * AIR_DENSITY));
  return [
    waves.pressure[0],
    waves.pressure[1],
    mul(slopeToFlow, waves.slope[0]),
    mul(slopeToFlow, waves.slope[1]),
  ];
}

/** Plane waves in a straight duct: p = a·e^(−jkx) + b·e^(jkx). */
function ductWaves(k: number, x: number): WavePair {
  const forward = exp(cx(0, -k * x)),
    backward = exp(cx(0, k * x));
  return {
    pressure: [forward, backward],
    slope: [mul(cx(0, -k), forward), mul(cx(0, k), backward)],
  };
}

/**
 * Exponential flare, S = S₁·e^(m·x): p = e^(−mx/2)·(a·e^(−jγx) + b·e^(jγx)).
 *
 * γ (`propagation`) = √(k² − m²/4) is the wave number the flare leaves. Above the cutoff (k > m/2) it is real and the
 * waves travel; below it, it is imaginary and the forward wave dies away along the horn.
 */
function expWaves(k: number, m: number, x: number): WavePair {
  const squared = k * k - (m * m) / 4;
  const propagation = squared >= 0 ? cx(Math.sqrt(squared)) : cx(0, -Math.sqrt(-squared));
  const envelope = Math.exp((-m * x) / 2);
  const forward = scale(exp(mul(cx(0, -x), propagation)), envelope),
    backward = scale(exp(mul(cx(0, x), propagation)), envelope);
  // d/dx of e^(−mx/2)·e^(∓jγx) = e^(−mx/2)·e^(∓jγx)·(−m/2 ∓ jγ)
  const halfFlare = cx(-m / 2);
  return {
    pressure: [forward, backward],
    slope: [
      mul(add(halfFlare, mul(cx(0, -1), propagation)), forward),
      mul(add(halfFlare, mul(cx(0, 1), propagation)), backward),
    ],
  };
}

/** Conical flare, x the distance from the cone's apex (S ∝ x²): p = (a·e^(−jkx) + b·e^(jkx))/x, spherical waves. */
function conWaves(k: number, x: number): WavePair {
  const forward = exp(cx(0, -k * x)),
    backward = exp(cx(0, k * x));
  const inverseX = 1 / x;
  return {
    pressure: [scale(forward, inverseX), scale(backward, inverseX)],
    // d/dx of e^(∓jkx)/x = e^(∓jkx)·(∓jk/x − 1/x²)
    slope: [
      mul(forward, cx(-inverseX * inverseX, -k * inverseX)),
      mul(backward, cx(-inverseX * inverseX, k * inverseX)),
    ],
  };
}

/** The segment's transfer matrix at frequency `f` (Hz): [p₁, U₁] = M·[p₂, U₂], in SI acoustic units. */
export function segmentMatrix(segment: HornSegment, f: number): Matrix2 {
  const omega = 2 * Math.PI * f,
    k = omega / SOUND_SPEED;
  const startArea = segment.s1 * CM2_TO_M2,
    endArea = segment.s2 * CM2_TO_M2,
    length = segment.length * CM_TO_M;
  if (length <= 0) return IDENTITY;
  const straight = Math.abs(endArea / startArea - 1) < STRAIGHT_RATIO;
  let atStart: Matrix2, atEnd: Matrix2;
  if (straight) {
    atStart = waveMatrix(ductWaves(k, 0), startArea, omega);
    atEnd = waveMatrix(ductWaves(k, length), endArea, omega);
  } else if (segment.profile === "exp") {
    const m = Math.log(endArea / startArea) / length;
    atStart = waveMatrix(expWaves(k, m, 0), startArea, omega);
    atEnd = waveMatrix(expWaves(k, m, length), endArea, omega);
  } else {
    // the radius grows linearly, so the apex sits L·r₁/(r₂ − r₁) before the start. When the cone narrows that distance
    // is negative (the apex lies past the end); S ∝ x² holds either way.
    const startRadius = Math.sqrt(startArea),
      endRadius = Math.sqrt(endArea);
    const apexDistance = (length * startRadius) / (endRadius - startRadius);
    atStart = waveMatrix(conWaves(k, apexDistance), startArea, omega);
    atEnd = waveMatrix(conWaves(k, apexDistance + length), endArea, omega);
  }
  return mulMatrix(atStart, invertMatrix(atEnd));
}

/** The whole horn's transfer matrix, throat to mouth: its segments' matrices multiplied in order. */
export const chainMatrix = (segments: readonly HornSegment[], f: number): Matrix2 =>
  segments.reduce<Matrix2>(
    (product, segment) => mulMatrix(product, segmentMatrix(segment, f)),
    IDENTITY,
  );

/** The impedance a two-port's input shows with `load` on its output: (A·Z + B)/(C·Z + D), Z the load. */
export const inputImpedance = (matrix: Matrix2, load: Complex): Complex =>
  div(add(mul(matrix[0], load), matrix[1]), add(mul(matrix[2], load), matrix[3]));

/** The flow out of a two-port per unit of flow in, with `load` on its output: U₂/U₁ = 1/(C·Z + D). */
export const outputFlowRatio = (matrix: Matrix2, load: Complex): Complex =>
  div(cx(1), add(mul(matrix[2], load), matrix[3]));
