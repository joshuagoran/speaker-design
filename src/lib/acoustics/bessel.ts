// The Bessel and Struve functions a baffled piston's radiation impedance needs (lib/acoustics/radiation), from their
// integral forms. The mouth's 2ka runs to about 60 (a 1.9 m² mouth at 2 kHz), where power series lose their digits; the
// integrals stay accurate there and need no tables.

/** Points per unit of x for the quadratures, plus a floor: enough to resolve every oscillation of the integrand. */
const STEPS_PER_UNIT = 4,
  MIN_STEPS = 96;
const stepsFor = (x: number) => {
  const n = Math.max(MIN_STEPS, Math.ceil(Math.abs(x) * STEPS_PER_UNIT) + MIN_STEPS);
  return n + (n % 2); // even, for Simpson's rule
};

/**
 * Bessel J_n(x) = (1/π) ∫₀^π cos(nτ − x sin τ) dτ. The integrand is smooth and periodic, so the trapezoid rule converges
 * exponentially.
 */
export function besselJ(n: number, x: number): number {
  const m = stepsFor(x),
    h = Math.PI / m;
  let s = 0.5 * (Math.cos(0) + Math.cos(n * Math.PI - x * Math.sin(Math.PI)));
  for (let i = 1; i < m; i++) {
    const t = i * h;
    s += Math.cos(n * t - x * Math.sin(t));
  }
  return (s * h) / Math.PI;
}

/**
 * Struve H₁(x) = (2x/π) ∫₀^{π/2} cos²φ · sin(x sin φ) dφ (from (2x/π) ∫₀¹ √(1 − t²) sin(xt) dt with t = sin φ), by
 * Simpson's rule.
 */
export function struveH1(x: number): number {
  // Simpson's error falls as h⁴ but, unlike the periodic trapezoid above, not exponentially: four times the points
  const m = 4 * stepsFor(x),
    h = Math.PI / 2 / m;
  const g = (p: number) => Math.cos(p) ** 2 * Math.sin(x * Math.sin(p));
  let s = g(0) + g(Math.PI / 2);
  for (let i = 1; i < m; i++) s += (i % 2 ? 4 : 2) * g(i * h);
  return ((2 * x) / Math.PI) * ((s * h) / 3);
}
