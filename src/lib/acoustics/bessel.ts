// The Bessel and Struve functions a baffled piston's radiation impedance needs (lib/acoustics/radiation), and the
// parabolic flare's solutions (lib/acoustics/hornSegments). Both run at every frequency of a response, at arguments far
// past where power series lose their digits: the mouth's 2ka (twice the wave number times the mouth's radius) runs to
// about 60 for a 1.9 m² mouth at 2 kHz. Each function takes its power series at small arguments and an asymptotic
// expansion at large ones: `besselPair` J and Y of orders 0 and 1, `struveH1` the Struve function H₁.

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
 * lib/acoustics/hornSegments, and the piston's radiation impedance, lib/acoustics/radiation). Below `PAIR_SERIES_LIMIT`, the
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

/**
 * Where `struveH1` changes from its power series to its asymptotic expansion: both are good to about 1e-10 there (the
 * series' largest term grows as about e^x / x; the expansion's smallest term falls as about e^(−x)).
 */
const STRUVE_SERIES_LIMIT = 20;

/**
 * Struve function of order 1, H₁(x), for x ≥ 0 (DLMF 11.2.1 and 11.6.1). Below `STRUVE_SERIES_LIMIT`, its power series:
 *   H₁ = Σ (−1)^k (x/2)^(2k+2) / (Γ(k+3/2)·Γ(k+5/2)).
 * Above it, the expansion of H₁ − Y₁ in 1/x, which needs Y₁ (`besselPair`, which a caller that has it passes in):
 *   H₁ − Y₁ ≈ (1/π) Σ Γ(k+1/2)·(x/2)^(−2k) / Γ(3/2−k) = (2/π)·(1 + 2/x² − 6/x⁴ + …),
 * cut before its terms start to grow.
 *
 * Aarts and Janssen's closed form (J. Acoust. Soc. Am. 113(5), 2003), H₁ ≈ 2/π − J₀ + (16/π − 5)·sin(x)/x +
 * (12 − 36/π)·(1 − cos x)/x², is as fast, but its error (0.1 % at small x, up to 0.005 at large x) moves the horns' Ze
 * past the Hornresp checks' 0.1 % (tests/hornresp.test.ts).
 */
export function struveH1(x: number, y1?: number): number {
  if (x < STRUVE_SERIES_LIMIT) {
    /** −x²/4: each term is the one before times this, over (k + 1/2)(k + 3/2) */
    const step = (-x * x) / 4;
    /** the k = 0 term: (x/2)² / (Γ(3/2)·Γ(5/2)), with Γ(3/2) = √π/2 and Γ(5/2) = 3√π/4 */
    let term = (x * x) / 4 / ((3 * Math.PI) / 8),
      sum = term;
    for (let k = 1; k < PAIR_MAX_TERMS; k++) {
      term *= step / ((k + 0.5) * (k + 1.5));
      sum += term;
      if (Math.abs(term) < PAIR_TERM_FLOOR * Math.max(1, Math.abs(sum))) break;
    }
    return sum;
  }
  /** (x/2)²: each term is the one before times (k − 1/2)(3/2 − k), over this */
  const halfSquared = (x / 2) ** 2;
  // the k = 0 term, Γ(1/2) / Γ(3/2) = 2; the running sum; the size of the term before
  let term = 2,
    sum = 2,
    last = Infinity;
  for (let k = 1; k < PAIR_MAX_TERMS; k++) {
    term *= ((k - 0.5) * (1.5 - k)) / halfSquared;
    const size = Math.abs(term);
    if (size >= last || size < PAIR_TERM_FLOOR) break;
    last = size;
    sum += term;
  }
  return sum / Math.PI + (y1 ?? besselPair(x).y1);
}
