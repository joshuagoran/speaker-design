// Complex arithmetic for the horn engine's two-ports. Plain objects: the horn model runs once per design, not in the
// optimizers' inner loops (the box models there keep their inline real arithmetic).
import type { Complex, Matrix2 } from "../../types";

export const cx = (re: number, im = 0): Complex => ({ re, im });
export const ZERO = cx(0);
export const ONE = cx(1);

export const add = (a: Complex, b: Complex): Complex => cx(a.re + b.re, a.im + b.im);
export const sub = (a: Complex, b: Complex): Complex => cx(a.re - b.re, a.im - b.im);
export const mul = (a: Complex, b: Complex): Complex =>
  cx(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
export const scale = (a: Complex, k: number): Complex => cx(a.re * k, a.im * k);
export const div = (a: Complex, b: Complex): Complex => {
  const m = b.re * b.re + b.im * b.im;
  return cx((a.re * b.re + a.im * b.im) / m, (a.im * b.re - a.re * b.im) / m);
};
export const inv = (a: Complex): Complex => div(ONE, a);
export const abs = (a: Complex) => Math.hypot(a.re, a.im);
export const arg = (a: Complex) => Math.atan2(a.im, a.re);
/** e^z */
export const exp = (z: Complex): Complex => {
  const m = Math.exp(z.re);
  return cx(m * Math.cos(z.im), m * Math.sin(z.im));
};
/** j·x for a real x: a pure reactance */
export const jx = (x: number): Complex => cx(0, x);
/** Two impedances in parallel. */
export const parallel = (a: Complex, b: Complex): Complex => div(mul(a, b), add(a, b));

export const IDENTITY: Matrix2 = [ONE, ZERO, ZERO, ONE];

export const mulMatrix = (m: Matrix2, n: Matrix2): Matrix2 => [
  add(mul(m[0], n[0]), mul(m[1], n[2])),
  add(mul(m[0], n[1]), mul(m[1], n[3])),
  add(mul(m[2], n[0]), mul(m[3], n[2])),
  add(mul(m[2], n[1]), mul(m[3], n[3])),
];

export const invertMatrix = (m: Matrix2): Matrix2 => {
  const det = sub(mul(m[0], m[3]), mul(m[1], m[2]));
  return [div(m[3], det), div(scale(m[1], -1), det), div(scale(m[2], -1), det), div(m[0], det)];
};
