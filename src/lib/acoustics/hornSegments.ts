// A horn segment's transfer matrix, from the wave solutions of the 1-D horn (Webster) equation.
//
// Inside a segment the pressure is a mix of two independent solutions with unknown amounts (a, b). At any point x, a
// 2 × 2 "wave matrix" W(x) maps (a, b) to the pressure p and the flow U there. So the segment's transfer matrix, which
// maps the far end's (p₂, U₂) to the near end's (p₁, U₁), is W(x₁)·W(x₂)⁻¹. One construction serves every flare law:
// each needs only its two solutions and their slopes.
//
// Words and symbols used below:
// - "flow" (U) is volume velocity, m³/s; "impedance" is acoustic impedance, Pa·s/m³; p is pressure, Pa.
// - ω is the angular frequency 2πf, rad/s; k = ω/c is the wave number, rad/m; ρ is air's density, c the speed of sound.
// - m is an exponential horn's flare constant, 1/m: its area grows as S = S₁·e^(m·x).
// - A transfer matrix [[A, B], [C, D]] gives p₁ = A·p₂ + B·U₂ and U₁ = C·p₂ + D·U₂ (stored row by row as Matrix2).
import type { Complex, HornSegment, Matrix2 } from "../../types";
import { AIR_DENSITY, SPEED_OF_SOUND } from "../../constants/acoustics";
import { HORN_PROFILE } from "../../constants/hornEngine";
import { CM_PER_M, SQ_CM_PER_SQ_M } from "../../constants/units";
import {
  add,
  complex,
  divide,
  invertMatrix,
  multiply,
  multiplyMatrix,
  scale,
  IDENTITY,
} from "./complex";

/** Areas within this ratio of each other make a straight duct: the conical law divides by the flare there. */
const STRAIGHT_RATIO = 1e-4;
/**
 * Whether a segment's sizes can be modeled and drawn: both areas and its length positive and finite (a zero, negative
 * or missing size is a gap, never NaN).
 */
export const isSizedSegment = (segment: HornSegment) =>
  [segment.s1, segment.s2, segment.length].every((v) => Number.isFinite(v) && v > 0);

/** Whether a segment's two areas are equal (within `STRAIGHT_RATIO`): a straight duct, whatever its profile. */
export const isStraightSegment = (segment: HornSegment) =>
  Math.abs(segment.s2 / segment.s1 - 1) < STRAIGHT_RATIO;

/**
 * The area of a segment `x` cm along it from its start, cm², by its flare law, as the transfer matrix takes it
 * (`segmentMatrix`): an exponential's grows as S₁·e^(m·x), a conical's radius (so the square root of its area) grows
 * linearly, and a segment with equal areas is straight. `x` is held to the segment's length. The drawings read it, so
 * they follow the model's flare.
 */
export function segmentAreaAt(segment: HornSegment, x: number): number {
  const along = Math.min(Math.max(x, 0), segment.length) / segment.length;
  if (isStraightSegment(segment)) return segment.s1;
  if (segment.profile === HORN_PROFILE.exponential)
    return segment.s1 * (segment.s2 / segment.s1) ** along;
  const radius = Math.sqrt(segment.s1) + (Math.sqrt(segment.s2) - Math.sqrt(segment.s1)) * along;
  return radius * radius;
}

/** Below this |(γx)²| the exponential solutions use their series form (see expSolutions). */
const SERIES_LIMIT = 1e-8;

/** A segment's two solutions at one point: each one's pressure, and its pressure's slope dp/dx (Pa/m). */
interface SolutionPair {
  pressure: readonly [Complex, Complex];
  slope: readonly [Complex, Complex];
}

/**
 * The wave matrix W(x) from the two solutions and the area at x (m²). The flow follows from the slope by Euler's
 * equation: U = S·u with u = −(1/(jωρ))·dp/dx.
 */
function waveMatrix(solutions: SolutionPair, areaM2: number, omega: number): Matrix2 {
  // −S/(jωρ) = j·S/(ωρ)
  /** j·S/(ωρ): turns a pressure slope into a flow */
  const slopeToFlow = complex(0, areaM2 / (omega * AIR_DENSITY));
  return [
    solutions.pressure[0],
    solutions.pressure[1],
    multiply(slopeToFlow, solutions.slope[0]),
    multiply(slopeToFlow, solutions.slope[1]),
  ];
}

/**
 * Exponential flare, S = S₁·e^(m·x); a straight duct is the case m = 0. The pressure is e^(−mx/2) times a mix of
 * cos(γx) and sin(γx)/γ, with γ² = k² − m²/4.
 *
 * γ² > 0 (above the flare's cutoff): the waves travel. γ² < 0 (below it): cos and sin become cosh and sinh, and the
 * wave dies away along the horn. These two solutions stay independent at the cutoff itself (γ = 0), where
 * sin(γx)/γ → x; the travelling-wave pair e^(∓jγx) would merge there and leave W(x) singular.
 */
function expSolutions(k: number, m: number, x: number): SolutionPair {
  /** γ², rad²/m² */
  const gammaSquared = k * k - (m * m) / 4;
  /** (γx)²: how far along the wave is, squared */
  const gammaXSquared = gammaSquared * x * x;
  /** cos(γx), real for either sign of γ² */
  let cosine: number;
  /** sin(γx)/γ, real for either sign of γ² */
  let sineOverGamma: number;
  if (Math.abs(gammaXSquared) < SERIES_LIMIT) {
    cosine = 1 - gammaXSquared / 2;
    sineOverGamma = x * (1 - gammaXSquared / 6);
  } else if (gammaSquared > 0) {
    /** γ above the cutoff: the wave number the flare leaves, rad/m */
    const gamma = Math.sqrt(gammaSquared);
    cosine = Math.cos(gamma * x);
    sineOverGamma = Math.sin(gamma * x) / gamma;
  } else {
    /** |γ| below the cutoff: how fast the wave dies away, 1/m */
    const decay = Math.sqrt(-gammaSquared);
    cosine = Math.cosh(decay * x);
    sineOverGamma = Math.sinh(decay * x) / decay;
  }
  /** e^(−mx/2): the pressure falls as the area grows */
  const envelope = Math.exp((-m * x) / 2);
  // d/dx of e^(−mx/2)·cos(γx) = e^(−mx/2)·(−(m/2)·cos(γx) − γ²·sin(γx)/γ)
  // d/dx of e^(−mx/2)·sin(γx)/γ = e^(−mx/2)·(−(m/2)·sin(γx)/γ + cos(γx))
  return {
    pressure: [complex(envelope * cosine), complex(envelope * sineOverGamma)],
    slope: [
      complex(envelope * ((-m / 2) * cosine - gammaSquared * sineOverGamma)),
      complex(envelope * ((-m / 2) * sineOverGamma + cosine)),
    ],
  };
}

/** Conical flare, x the distance from the cone's apex (S ∝ x²): p = (a·e^(−jkx) + b·e^(jkx))/x, spherical waves. */
function conSolutions(k: number, x: number): SolutionPair {
  /** e^(−jkx) and e^(jkx): the outgoing and the returning wave */
  const forward = complex(Math.cos(k * x), -Math.sin(k * x)),
    backward = complex(Math.cos(k * x), Math.sin(k * x));
  /** 1/x, 1/m */
  const inverseX = 1 / x;
  return {
    pressure: [scale(forward, inverseX), scale(backward, inverseX)],
    // d/dx of e^(∓jkx)/x = e^(∓jkx)·(∓jk/x − 1/x²)
    slope: [
      multiply(forward, complex(-inverseX * inverseX, -k * inverseX)),
      multiply(backward, complex(-inverseX * inverseX, k * inverseX)),
    ],
  };
}

/** The segment's transfer matrix at frequency `f` (Hz): [p₁, U₁] = M·[p₂, U₂], in SI acoustic units. */
export function segmentMatrix(segment: HornSegment, f: number): Matrix2 {
  /** ω and k (see the header) */
  const omega = 2 * Math.PI * f,
    k = omega / SPEED_OF_SOUND;
  /** the areas at the segment's two ends, m², and its length, m */
  const startArea = segment.s1 / SQ_CM_PER_SQ_M,
    endArea = segment.s2 / SQ_CM_PER_SQ_M,
    length = segment.length / CM_PER_M;
  if (length <= 0) return IDENTITY;
  /** equal areas: a straight duct, whatever the profile */
  const straight = Math.abs(endArea / startArea - 1) < STRAIGHT_RATIO;
  /** W at the segment's start and at its end */
  let atStart: Matrix2, atEnd: Matrix2;
  if (straight || segment.profile === HORN_PROFILE.exponential) {
    /** the flare constant, 1/m: 0 for a straight duct */
    const m = straight ? 0 : Math.log(endArea / startArea) / length;
    atStart = waveMatrix(expSolutions(k, m, 0), startArea, omega);
    atEnd = waveMatrix(expSolutions(k, m, length), endArea, omega);
  } else {
    // the radius grows linearly, so the apex sits L·r₁/(r₂ − r₁) before the start. When the cone narrows that distance
    // is negative (the apex lies past the end); S ∝ x² holds either way.
    /** √area at each end: proportional to the radius, which is all the apex distance needs */
    const startRadius = Math.sqrt(startArea),
      endRadius = Math.sqrt(endArea);
    /** the distance from the apex to the segment's start, m */
    const apexDistance = (length * startRadius) / (endRadius - startRadius);
    atStart = waveMatrix(conSolutions(k, apexDistance), startArea, omega);
    atEnd = waveMatrix(conSolutions(k, apexDistance + length), endArea, omega);
  }
  return multiplyMatrix(atStart, invertMatrix(atEnd));
}

/** The whole horn's transfer matrix, throat to mouth: its segments' matrices multiplied in order (identity if none). */
export const chainMatrix = (segments: readonly HornSegment[], f: number): Matrix2 =>
  segments.reduce<Matrix2>(
    (product, segment) => multiplyMatrix(product, segmentMatrix(segment, f)),
    IDENTITY,
  );

/** The impedance a two-port's input shows with `load` on its output: (A·Z + B)/(C·Z + D), Z the load. */
export const inputImpedance = (matrix: Matrix2, load: Complex): Complex =>
  divide(add(multiply(matrix[0], load), matrix[1]), add(multiply(matrix[2], load), matrix[3]));

/** The flow out of a two-port per unit of flow in, with `load` on its output: U₂/U₁ = 1/(C·Z + D). */
export const outputFlowRatio = (matrix: Matrix2, load: Complex): Complex =>
  divide(complex(1), add(multiply(matrix[2], load), matrix[3]));
