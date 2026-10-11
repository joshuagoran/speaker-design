// Complex arithmetic: the one set the planner uses (the hi-fi crossover sums, the PA dispersion map, the horn
// engine's two-ports). Plain objects: none of these run in the optimizers' inner loops, where the box models keep
// their inline real arithmetic. `abs`, `arg` and `exp` keep their standard math names.
import type { Complex, Matrix2 } from "../../types";

/** A complex number from its real and imaginary parts. */
export const complex = (re: number, im = 0): Complex => ({ re, im });
/** 0 + 0j */
export const ZERO = complex(0);
/** 1 + 0j */
export const ONE = complex(1);

/** a + b */
export const add = (a: Complex, b: Complex): Complex => complex(a.re + b.re, a.im + b.im);
/** a − b */
export const subtract = (a: Complex, b: Complex): Complex => complex(a.re - b.re, a.im - b.im);
/** a · b */
export const multiply = (a: Complex, b: Complex): Complex =>
  complex(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
/** a · factor, for a real factor */
export const scale = (a: Complex, factor: number): Complex => complex(a.re * factor, a.im * factor);
/** a / b */
export const divide = (a: Complex, b: Complex): Complex => {
  /** |b|² */
  const sizeSquared = b.re * b.re + b.im * b.im;
  return complex(
    (a.re * b.re + a.im * b.im) / sizeSquared,
    (a.im * b.re - a.re * b.im) / sizeSquared,
  );
};
/** 1 / a, for example an admittance from an impedance */
export const reciprocal = (a: Complex): Complex => divide(ONE, a);
/** |a|, the magnitude */
export const abs = (a: Complex) => Math.hypot(a.re, a.im);
/** The angle (argument) of a, radians, from −π to π: its phase */
export const arg = (a: Complex) => Math.atan2(a.im, a.re);
/** e^z for a complex z */
export const exp = (z: Complex): Complex => {
  /** e^(re z): the result's magnitude */
  const size = Math.exp(z.re);
  return complex(size * Math.cos(z.im), size * Math.sin(z.im));
};
/** e^(jθ): a unit phasor at angle θ, radians */
export const phasor = (angle: number): Complex => complex(Math.cos(angle), Math.sin(angle));
/** j·x for a real x: a pure imaginary number, such as the reactance jωM of an acoustic mass M */
export const imaginary = (x: number): Complex => complex(0, x);

/** The 2 × 2 identity matrix: a two-port that changes nothing. */
export const IDENTITY: Matrix2 = [ONE, ZERO, ZERO, ONE];

/** first · second, two 2 × 2 matrices: two two-ports in a row, `first` nearer the source. */
export const multiplyMatrix = (first: Matrix2, second: Matrix2): Matrix2 => [
  add(multiply(first[0], second[0]), multiply(first[1], second[2])),
  add(multiply(first[0], second[1]), multiply(first[1], second[3])),
  add(multiply(first[2], second[0]), multiply(first[3], second[2])),
  add(multiply(first[2], second[1]), multiply(first[3], second[3])),
];

/** The inverse of a 2 × 2 matrix [[a, b], [c, d]]: [[d, −b], [−c, a]] over its determinant ad − bc. */
export const invertMatrix = (matrix: Matrix2): Matrix2 => {
  /** ad − bc */
  const determinant = subtract(multiply(matrix[0], matrix[3]), multiply(matrix[1], matrix[2]));
  return [
    divide(matrix[3], determinant),
    divide(scale(matrix[1], -1), determinant),
    divide(scale(matrix[2], -1), determinant),
    divide(matrix[0], determinant),
  ];
};
