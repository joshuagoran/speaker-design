// A horn segment's transfer matrix from the 1-D horn (Webster) equation's wave solutions. Each flare law has two
// waves, a and b; T(x) maps (a, b) to the pressure and volume velocity at x, and the segment's matrix is
// T(x₁)·T(x₂)⁻¹: [p₁, U₁] = M·[p₂, U₂]. One construction serves every flare law, so each needs only its two waves.
import type { Complex, HornSegment, Matrix2 } from "../../types";
import { AIR_DENSITY, SOUND_SPEED } from "../../constants/hornEngine";
import { add, cx, div, exp, invertMatrix, mul, mulMatrix, scale, IDENTITY } from "./complex";

const CM2_TO_M2 = 1e-4,
  CM_TO_M = 1e-2;
/** Areas within this ratio of each other make a straight duct: the flare laws divide by the flare there. */
const STRAIGHT_RATIO = 1e-4;

/** The two waves' pressure and its slope at x: p = Σ wᵢ, dp/dx = Σ w'ᵢ. */
interface WavePair {
  p: readonly [Complex, Complex];
  dp: readonly [Complex, Complex];
}

/** T(x) from the waves and the area at x: U = S·u, u = −(1/(jωρ))·dp/dx. */
function waveMatrix(w: WavePair, areaM2: number, omega: number): Matrix2 {
  // −S/(jωρ) = j·S/(ωρ)
  const k = cx(0, areaM2 / (omega * AIR_DENSITY));
  return [w.p[0], w.p[1], mul(k, w.dp[0]), mul(k, w.dp[1])];
}

/** Plane waves in a straight duct: p = a·e^(−jkx) + b·e^(jkx). */
function ductWaves(k: number, x: number): WavePair {
  const fwd = exp(cx(0, -k * x)),
    back = exp(cx(0, k * x));
  return { p: [fwd, back], dp: [mul(cx(0, -k), fwd), mul(cx(0, k), back)] };
}

/**
 * Exponential flare S = S₁·e^(mx): p = e^(−mx/2)·(a·e^(−jγx) + b·e^(jγx)), γ = √(k² − m²/4). Below the cutoff
 * (k < m/2) γ is imaginary and the first wave decays along the horn.
 */
function expWaves(k: number, m: number, x: number): WavePair {
  const d = k * k - (m * m) / 4;
  const g = d >= 0 ? cx(Math.sqrt(d)) : cx(0, -Math.sqrt(-d));
  const env = Math.exp((-m * x) / 2);
  const fwd = scale(exp(mul(cx(0, -x), g)), env),
    back = scale(exp(mul(cx(0, x), g)), env);
  const half = cx(-m / 2);
  return {
    p: [fwd, back],
    dp: [mul(add(half, mul(cx(0, -1), g)), fwd), mul(add(half, mul(cx(0, 1), g)), back)],
  };
}

/** Conical flare, x from the apex (S ∝ x²): p = (a·e^(−jkx) + b·e^(jkx))/x. */
function conWaves(k: number, x: number): WavePair {
  const fwd = exp(cx(0, -k * x)),
    back = exp(cx(0, k * x));
  const ix = 1 / x;
  return {
    p: [scale(fwd, ix), scale(back, ix)],
    // d/dx of e^(∓jkx)/x = e^(∓jkx)·(∓jk/x − 1/x²)
    dp: [mul(fwd, cx(-ix * ix, -k * ix)), mul(back, cx(-ix * ix, k * ix))],
  };
}

/** The segment's matrix at frequency f (Hz), [p₁, U₁] = M·[p₂, U₂], in SI acoustic units. */
export function segmentMatrix(seg: HornSegment, f: number): Matrix2 {
  const omega = 2 * Math.PI * f,
    k = omega / SOUND_SPEED;
  const s1 = seg.s1 * CM2_TO_M2,
    s2 = seg.s2 * CM2_TO_M2,
    L = seg.length * CM_TO_M;
  if (L <= 0) return IDENTITY;
  const straight = Math.abs(s2 / s1 - 1) < STRAIGHT_RATIO;
  let t1: Matrix2, t2: Matrix2;
  if (straight) {
    t1 = waveMatrix(ductWaves(k, 0), s1, omega);
    t2 = waveMatrix(ductWaves(k, L), s2, omega);
  } else if (seg.profile === "exp") {
    const m = Math.log(s2 / s1) / L;
    t1 = waveMatrix(expWaves(k, m, 0), s1, omega);
    t2 = waveMatrix(expWaves(k, m, L), s2, omega);
  } else {
    // the radius grows linearly: the apex sits x₁ = L·r₁/(r₂ − r₁) before the throat (behind the mouth when the cone
    // narrows, where x is negative; S ∝ x² holds either way)
    const r1 = Math.sqrt(s1),
      r2 = Math.sqrt(s2);
    const x1 = (L * r1) / (r2 - r1);
    t1 = waveMatrix(conWaves(k, x1), s1, omega);
    t2 = waveMatrix(conWaves(k, x1 + L), s2, omega);
  }
  return mulMatrix(t1, invertMatrix(t2));
}

/** The chain's matrix, throat to mouth. */
export const chainMatrix = (segments: readonly HornSegment[], f: number): Matrix2 =>
  segments.reduce<Matrix2>((m, s) => mulMatrix(m, segmentMatrix(s, f)), IDENTITY);

/** What a two-port's input sees with `load` on its output: (A·Z + B)/(C·Z + D). */
export const inputImpedance = (m: Matrix2, load: Complex): Complex =>
  div(add(mul(m[0], load), m[1]), add(mul(m[2], load), m[3]));

/** The output volume velocity per unit input volume velocity, with `load` on the output: 1/(C·Z + D). */
export const outputFlowRatio = (m: Matrix2, load: Complex): Complex =>
  div(cx(1), add(mul(m[2], load), m[3]));
