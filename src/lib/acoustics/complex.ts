// Complex arithmetic for the horn engine's two-ports. The short names follow math notation, and each one says what it
// does below. Plain objects: the horn model runs once per design, not in the optimizers' inner loops (the box models
// there keep their inline real arithmetic).
import type { Complex, Matrix2 } from "../../types";

/** A complex number from its real and imaginary parts ("cx" for complex). */
export const cx = (re: number, im = 0): Complex => ({ re, im });
/** 0 + 0j */
export const ZERO = cx(0);
/** 1 + 0j */
export const ONE = cx(1);

/** a + b */
export const add = (a: Complex, b: Complex): Complex => cx(a.re + b.re, a.im + b.im);
/** a − b */
export const sub = (a: Complex, b: Complex): Complex => cx(a.re - b.re, a.im - b.im);
/** a · b */
export const mul = (a: Complex, b: Complex): Complex =>
  cx(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
/** a · k, k real */
export const scale = (a: Complex, k: number): Complex => cx(a.re * k, a.im * k);
/** a / b */
export const div = (a: Complex, b: Complex): Complex => {
  const m = b.re * b.re + b.im * b.im;
  return cx((a.re * b.re + a.im * b.im) / m, (a.im * b.re - a.re * b.im) / m);
};
/** 1 / a: the inverse ("inv"), e.g. an admittance from an impedance */
export const inv = (a: Complex): Complex => div(ONE, a);
/** |a|: the magnitude ("abs" for absolute value) */
export const abs = (a: Complex) => Math.hypot(a.re, a.im);
/** The angle of a, radians, from −π to π ("arg" for argument, the phase) */
export const arg = (a: Complex) => Math.atan2(a.im, a.re);
/** e^z for a complex z */
export const exp = (z: Complex): Complex => {
  const m = Math.exp(z.re);
  return cx(m * Math.cos(z.im), m * Math.sin(z.im));
};
/** j·x for a real x ("jx"): a pure reactance, such as jωM for an acoustic mass M */
export const jx = (x: number): Complex => cx(0, x);

/** The 2 × 2 identity matrix: a two-port that changes nothing. */
export const IDENTITY: Matrix2 = [ONE, ZERO, ZERO, ONE];

/** m · n, two 2 × 2 matrices: two two-ports in a row, m first. */
export const mulMatrix = (m: Matrix2, n: Matrix2): Matrix2 => [
  add(mul(m[0], n[0]), mul(m[1], n[2])),
  add(mul(m[0], n[1]), mul(m[1], n[3])),
  add(mul(m[2], n[0]), mul(m[3], n[2])),
  add(mul(m[2], n[1]), mul(m[3], n[3])),
];

/** m⁻¹, a 2 × 2 matrix: [[d, −b], [−c, a]] over its determinant ad − bc. */
export const invertMatrix = (m: Matrix2): Matrix2 => {
  const determinant = sub(mul(m[0], m[3]), mul(m[1], m[2]));
  return [
    div(m[3], determinant),
    div(scale(m[1], -1), determinant),
    div(scale(m[2], -1), determinant),
    div(m[0], determinant),
  ];
};
