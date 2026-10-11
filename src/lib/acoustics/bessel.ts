// The Bessel and Struve functions a baffled piston's radiation impedance needs (lib/acoustics/radiation), from their
// integral forms. The mouth's 2ka (twice the wave number times the mouth's radius) runs to about 60 for a 1.9 m² mouth
// at 2 kHz, where power series lose their digits; the integrals stay accurate there and need no tables.

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
