// The Bessel and Struve functions a baffled piston's radiation impedance needs (lib/acoustics/radiation), from their
// integral forms. The mouth's 2ka (twice the wave number times the mouth's radius) runs to about 60 for a 1.9 m² mouth
// at 2 kHz, where power series lose their digits; the integrals stay accurate there and need no tables. The parabolic
// flare's solutions (lib/acoustics/hornSegments) need both kinds of orders 0 and 1 at arguments far past that, at every
// frequency: `besselPair` gives them from their series and Hankel's expansion.

/** Quadrature steps per unit of x, on top of a base: enough to resolve every oscillation of the integrand. */
const STEPS_PER_UNIT = 4,
  BASE_STEPS = 96;
/** The number of quadrature steps for argument x: even, for Simpson's rule. */
const stepsFor = (x: number) => {
  /** the step count before rounding up to even */
  const steps = Math.ceil(Math.abs(x) * STEPS_PER_UNIT) + BASE_STEPS;
  return steps + (steps % 2);
};

/**
 * Bessel function of the first kind, J_n(x) = (1/π) ∫₀^π cos(nτ − x·sin τ) dτ, for a whole order n. The integrand is
 * smooth and periodic, so the trapezoid rule converges exponentially.
 */
export function besselJ(n: number, x: number): number {
  // the number of steps, their width (radians), the integrand of τ, and the running trapezoid sum
  const steps = stepsFor(x),
    stepWidth = Math.PI / steps;
  const integrand = (tau: number) => Math.cos(n * tau - x * Math.sin(tau));
  let sum = 0.5 * (integrand(0) + integrand(Math.PI));
  for (let i = 1; i < steps; i++) sum += integrand(i * stepWidth);
  return (sum * stepWidth) / Math.PI;
}

/**
 * Struve function of order 1, H₁(x) = (2x/π) ∫₀^{π/2} cos²φ · sin(x·sin φ) dφ (from (2x/π) ∫₀¹ √(1 − t²)·sin(xt) dt
 * with t = sin φ), by Simpson's rule.
 */
export function struveH1(x: number): number {
  // Simpson's error falls as the step width to the fourth power but, unlike the periodic trapezoid above, not
  // exponentially: four times the steps
  // the number of steps, their width (radians), the integrand of φ, and the running Simpson sum
  const steps = 4 * stepsFor(x),
    stepWidth = Math.PI / 2 / steps;
  const integrand = (phi: number) => Math.cos(phi) ** 2 * Math.sin(x * Math.sin(phi));
  let sum = integrand(0) + integrand(Math.PI / 2);
  for (let i = 1; i < steps; i++) sum += (i % 2 ? 4 : 2) * integrand(i * stepWidth);
  return ((2 * x) / Math.PI) * ((sum * stepWidth) / 3);
}

/** Bessel functions of orders 0 and 1 at one argument, both kinds (J the first, Y the second). */
export interface BesselPair {
  j0: number;
  j1: number;
  y0: number;
  y1: number;
}

/**
 * Where `besselPair` changes from its power series to Hankel's expansion: the series' largest term grows as about
 * e^x / √(2πx), so at 15 it keeps 11 digits; the expansion's smallest term is about e^(−2x), 1e-13 at 15.
 */
const PAIR_SERIES_LIMIT = 15;
/** Euler's constant γ, which the second kind's series carries */
const EULER_GAMMA = 0.5772156649015329;
/** The most terms either form adds (each stops sooner, where its terms no longer count). */
const PAIR_MAX_TERMS = 80;
/** A term this small against the sum's size no longer counts. */
const PAIR_TERM_FLOOR = 1e-17;

/**
 * J₀, J₁, Y₀ and Y₁ at x > 0, fast enough to call at every frequency of a response (the parabolic flare's solutions,
 * lib/acoustics/hornSegments; `besselJ` above integrates, which is slow at large x). Below `PAIR_SERIES_LIMIT`, the
 * power series:
 *   J₀ = Σ (−x²/4)^k / (k!)², J₁ = (x/2) Σ (−x²/4)^k / (k!(k+1)!),
 *   Y₀ = (2/π)(ln(x/2) + γ)·J₀ − (2/π) Σ H_k (−x²/4)^k / (k!)²,
 *   Y₁ = −2/(πx) + (2/π)(ln(x/2) + γ)·J₁ − (x/(2π)) Σ (H_k + H_{k+1}) (−x²/4)^k / (k!(k+1)!),
 * H_k the k-th harmonic number (H₀ = 0). Above it, Hankel's expansion (Abramowitz and Stegun 9.2.5 to 9.2.10):
 *   J_n = √(2/(πx))·(P cos χ − Q sin χ), Y_n = √(2/(πx))·(P sin χ + Q cos χ), χ = x − (n/2 + 1/4)π,
 * P and Q its two asymptotic series in 1/x (`hankelSeries`).
 */
export function besselPair(x: number): BesselPair {
  if (x < PAIR_SERIES_LIMIT) {
    /** −x²/4: each term is the one before times this, over its factorials */
    const step = (-x * x) / 4;
    // each sum's current term (its harmonic numbers left out), H_k, and the running sums; Y₁'s starts at k = 0's
    // (H₀ + H₁)·1
    let term0 = 1,
      term1 = 1,
      harmonic = 0,
      sumJ0 = 1,
      sumJ1 = 1,
      sumY0 = 0,
      sumY1 = 1;
    for (let k = 1; k < PAIR_MAX_TERMS; k++) {
      term0 *= step / (k * k);
      term1 *= step / (k * (k + 1));
      harmonic += 1 / k;
      sumJ0 += term0;
      sumJ1 += term1;
      sumY0 += harmonic * term0;
      sumY1 += (2 * harmonic + 1 / (k + 1)) * term1;
      if (Math.abs(term0) < PAIR_TERM_FLOOR && Math.abs(term1) < PAIR_TERM_FLOOR) break;
    }
    const j0 = sumJ0,
      j1 = (x / 2) * sumJ1;
    /** (2/π)(ln(x/2) + γ): the logarithm both second-kind functions carry */
    const log = (2 / Math.PI) * (Math.log(x / 2) + EULER_GAMMA);
    return {
      j0,
      j1,
      y0: log * j0 - (2 / Math.PI) * sumY0,
      y1: -2 / (Math.PI * x) + log * j1 - (x / (2 * Math.PI)) * sumY1,
    };
  }
  const [p0, q0] = hankelSeries(0, x),
    [p1, q1] = hankelSeries(1, x);
  /** √(2/(πx)): both kinds' envelope */
  const envelope = Math.sqrt(2 / (Math.PI * x));
  /** χ for each order */
  const chi0 = x - Math.PI / 4,
    chi1 = x - (3 * Math.PI) / 4;
  return {
    j0: envelope * (p0 * Math.cos(chi0) - q0 * Math.sin(chi0)),
    j1: envelope * (p1 * Math.cos(chi1) - q1 * Math.sin(chi1)),
    y0: envelope * (p0 * Math.sin(chi0) + q0 * Math.cos(chi0)),
    y1: envelope * (p1 * Math.sin(chi1) + q1 * Math.cos(chi1)),
  };
}

/**
 * Hankel's P and Q for order n at x: with μ = 4n² and a_k = (μ − 1)(μ − 9)…(μ − (2k − 1)²) / (k!·8^k),
 * P = Σ (−1)^k a_{2k} / x^{2k} and Q = Σ (−1)^k a_{2k+1} / x^{2k+1}, cut before the terms start to grow.
 */
function hankelSeries(n: number, x: number): [p: number, q: number] {
  const mu = 4 * n * n;
  let p = 1,
    q = 0,
    /** a_k / x^k */
    term = 1,
    /** the size of the term before */
    last = Infinity;
  for (let k = 1; k < PAIR_MAX_TERMS; k++) {
    term *= (mu - (2 * k - 1) ** 2) / (k * 8 * x);
    const size = Math.abs(term);
    if (size >= last || size < PAIR_TERM_FLOOR) break;
    last = size;
    // odd k joins Q, even k joins P; the sign changes every second term: +Q, −P, −Q, +P, …
    const sign = Math.floor(k / 2) % 2 === 0 ? 1 : -1;
    if (k % 2 === 1) q += sign * term;
    else p += sign * term;
  }
  return [p, q];
}
