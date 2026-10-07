// First modes of panels and ribs whose edges are held by springs against turning (lib/bracing reads these).
//
// A glued joint holds a panel's edge between hinged (simply supported) and fixed (clamped): the panel or rib on the
// other side of the joint bends with it and resists it as a rotational spring. Every calculation here is the
// Rayleigh–Ritz method (A. W. Leissa, "Vibration of Plates", NASA SP-160, 1969, §1.3; R. D. Blevins, "Formulas for
// Natural Frequency and Mode Shape", 1979, ch. 8 and 11), its trial functions on each span ξ ∈ [0, 1]
//     φᵢ(ξ) = ξ (1 − ξ) Pᵢ(2ξ − 1)    (Pᵢ Legendre's polynomials),
// which hold the deflection at both ends and leave the slope free; a spring of k per unit length at an edge adds
// ½ k (∂w/∂n)² along it to the strain energy. With no springs these give the hinged values exactly in the limit (a
// hinged square plate: 2π² = 19.739, Leissa Table 4.21); with stiff springs the clamped ones (a clamped square plate:
// 35.985, Leissa Table 4.23; a clamped beam: (4.730/π)² = 2.267 × the hinged one) — tests/plate-modes.test.ts holds them.
//
// A plate with no hole takes Warburton's separable shape: w = X(x)·Y(y), each the first mode of a beam over that span
// with the edges' springs (G. B. Warburton, "The vibration of rectangular plates", Proc. IMechE 168, 1954), so
//     ω² ρh = Dₓ Λₓ / a⁴ + D_y Λ_y / b⁴ + 2H ηₓ η_y / (a² b²),
// Λ the beam's frequency parameter (ω² μ L⁴ / EI, its springs as ψ = kL / EI), η = ∫X′² / ∫X² on a unit span, and H
// Huber's √(Dₓ D_y) as in lib/bracing's header. Hinged on all four edges it is exactly lib/bracing's plateFirstModeHz.
// A plate with a round hole (the driver's cutout) takes the full Ritz series: the whole plate's integrals exactly (by
// Gauss's rule along each span), less the hole's (by Gauss's rule along its radius and evenly round it).
import type { PlateHole, PlateStock } from "../types";

const IN_M = 0.0254;
/** lb/ft² to kg/m² */
const LB_FT2_KG_M2 = 0.45359237 / 0.09290304;
/** A spring stiff enough to stand for a fixed edge (ψ = kL / EI). */
const PSI_FIXED = 1e7;
/** Terms per span in the series: the beams' and the holed plate's (each holed plate solves BASIS_HOLE² of them). */
const BASIS_BEAM = 8;
const BASIS_HOLE = 8;
/** The hole's integration points: along its radius and round it. */
const HOLE_RADIAL = 12;
const HOLE_ROUND = 48;

type Matrix = number[][];
const zeros = (n: number): Matrix =>
  Array.from({ length: n }, () => Array.from({ length: n }, () => 0));

/** Gauss–Legendre nodes and weights on [−1, 1]. */
function gaussLegendre(n: number) {
  const x: number[] = [],
    w: number[] = [];
  for (let i = 1; i <= n; i++) {
    let z = Math.cos((Math.PI * (i - 0.25)) / (n + 0.5)),
      dp = 1;
    for (let it = 0; it < 100; it++) {
      let p1 = 1,
        p2 = 0;
      for (let j = 1; j <= n; j++) {
        const p3 = p2;
        p2 = p1;
        p1 = ((2 * j - 1) * z * p2 - (j - 1) * p3) / j;
      }
      dp = (n * (z * p1 - p2)) / (z * z - 1);
      const step = p1 / dp;
      z -= step;
      if (Math.abs(step) < 1e-15) break;
    }
    x.push(z);
    w.push(2 / ((1 - z * z) * dp * dp));
  }
  return { x, w };
}

/** The trial functions φᵢ and their first two derivatives at ξ, on a unit span. */
function basisAt(n: number, xi: number) {
  const u = 2 * xi - 1;
  const P = [1, u],
    dP = [0, 1],
    ddP = [0, 0];
  for (let k = 1; k < n; k++) {
    P[k + 1] = ((2 * k + 1) * u * P[k] - k * P[k - 1]) / (k + 1);
    dP[k + 1] = dP[k - 1] + (2 * k + 1) * P[k];
    ddP[k + 1] = ddP[k - 1] + (2 * k + 1) * dP[k];
  }
  const g = xi * (1 - xi),
    g1 = 1 - 2 * xi;
  const f: number[] = [],
    f1: number[] = [],
    f2: number[] = [];
  for (let i = 0; i < n; i++) {
    const p = P[i],
      p1 = 2 * dP[i],
      p2 = 4 * ddP[i];
    f.push(g * p);
    f1.push(g1 * p + g * p1);
    f2.push(-2 * p + 2 * g1 * p1 + g * p2);
  }
  return { f, f1, f2 };
}

/** ∫φφ, ∫φ′φ′, ∫φ″φ″ on a unit span and the slopes at its ends. */
function spanMatrices(n: number) {
  const G = gaussLegendre(2 * n + 6);
  const A0 = zeros(n),
    A1 = zeros(n),
    A2 = zeros(n);
  G.x.forEach((z, q) => {
    const { f, f1, f2 } = basisAt(n, (z + 1) / 2),
      wq = G.w[q] / 2;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        A0[i][j] += wq * f[i] * f[j];
        A1[i][j] += wq * f1[i] * f1[j];
        A2[i][j] += wq * f2[i] * f2[j];
      }
  });
  return { A0, A1, A2, s0: basisAt(n, 0).f1, s1: basisAt(n, 1).f1 };
}
const SPAN_BEAM = spanMatrices(BASIS_BEAM);

/** Cholesky factor of a symmetric positive definite matrix (lower triangle). */
function cholesky(A: Matrix): Matrix {
  const n = A.length,
    L = zeros(n);
  for (let i = 0; i < n; i++)
    for (let j = 0; j <= i; j++) {
      let s = A[i][j];
      for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      L[i][j] = i === j ? Math.sqrt(Math.max(s, 1e-300)) : s / L[j][j];
    }
  return L;
}
function choleskySolve(L: Matrix, b: number[]) {
  const n = b.length,
    y = b.slice();
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < i; k++) y[i] -= L[i][k] * y[k];
    y[i] /= L[i][i];
  }
  for (let i = n - 1; i >= 0; i--) {
    for (let k = i + 1; k < n; k++) y[i] -= L[k][i] * y[k];
    y[i] /= L[i][i];
  }
  return y;
}
const mulVec = (A: Matrix, x: number[]) => A.map((r) => r.reduce((s, v, j) => s + v * x[j], 0));
const dot = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * b[i], 0);

/**
 * The lowest mode of K x = λ M x (both symmetric, K positive definite) by inverse iteration: λ and x. The start mixes
 * every term, so a mode of either symmetry is found.
 */
function lowestMode(K: Matrix, M: Matrix) {
  const L = cholesky(K);
  let x = K.map((_, i) => 1 + 0.37 * Math.sin(1.7 * i + 0.3));
  let lam = Infinity;
  for (let it = 0; it < 200; it++) {
    const y = choleskySolve(L, mulVec(M, x));
    const norm = Math.sqrt(dot(y, mulVec(M, y)));
    x = y.map((v) => v / norm);
    const next = dot(x, mulVec(K, x));
    if (Math.abs(next - lam) <= 1e-12 * next) {
      lam = next;
      break;
    }
    lam = next;
  }
  return { lam, x };
}

const beamMemo = new Map<string, { Lam: number; eta: number }>();
const psiKey = (psi: number) => Math.min(psi, PSI_FIXED).toPrecision(5);
/**
 * The first mode of a unit beam (EI = μ = L = 1), hinged against deflection at both ends and held against turning by
 * springs ψ₀ and ψ₁ (kL / EI; 0 hinged, Infinity fixed): its frequency parameter Λ = ω² μ L⁴ / EI and η = ∫X′² / ∫X².
 */
export function beamModeParams(psi0: number, psi1: number) {
  const key = `${psiKey(psi0)}|${psiKey(psi1)}`;
  const hit = beamMemo.get(key);
  if (hit) return hit;
  const { A0, A1, A2, s0, s1 } = SPAN_BEAM;
  const k0 = Math.min(psi0, PSI_FIXED),
    k1 = Math.min(psi1, PSI_FIXED);
  const K = A2.map((r, i) => r.map((v, j) => v + k0 * s0[i] * s0[j] + k1 * s1[i] * s1[j]));
  const { lam, x } = lowestMode(K, A0);
  const out = { Lam: lam, eta: dot(x, mulVec(A1, x)) / dot(x, mulVec(A0, x)) };
  beamMemo.set(key, out);
  return out;
}

/** A beam's first mode, Hz: EI (N·m²), μ (kg/m), span (in), its ends held by springs k₀, k₁ (N·m/rad; 0 hinged). */
export function beamHz(EI: number, mu: number, span: number, k0: number, k1: number) {
  const L = span * IN_M;
  const { Lam } = beamModeParams((k0 * L) / EI, (k1 * L) / EI);
  return Math.sqrt((Lam * EI) / (mu * L ** 4)) / (2 * Math.PI);
}

/** The springs along a plate's four edges, N·m/rad per m of edge: x = 0, x = a, y = 0, y = b (0 hinged). */
export interface EdgeSprings {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}
export const HINGED_EDGES: EdgeSprings = { x0: 0, x1: 0, y0: 0, y1: 0 };

/** The plate's bending stiffnesses (N·m) and mass (kg/m²): the weaker modulus across the shorter span. */
function plateStiffness(a: number, b: number, s: PlateStock) {
  const h = s.t * IN_M,
    k = h ** 3 / (12 * (1 - s.nu * s.nu));
  const Dx = (a <= b ? s.eWeak : s.eStrong) * k,
    Dy = (a <= b ? s.eStrong : s.eWeak) * k;
  const H = Math.sqrt(Dx * Dy),
    D12 = s.nu * H;
  // H = D12 + 2 D66 (Huber); over the whole plate the D12 and D66 terms integrate to 2H ∫w_xy² (w = 0 on its edges),
  // over a part of it (the hole) they don't
  return { Dx, Dy, H, D12, D66: (H - D12) / 2, rhoH: s.lbPerSqFt * LB_FT2_KG_M2 };
}

/** The first mode of an `a` × `b` in plate, its edges held by `k` (header: Warburton's shape), Hz. */
export function restrainedPlateHz(a: number, b: number, s: PlateStock, k: EdgeSprings) {
  const { Dx, Dy, H, rhoH } = plateStiffness(a, b, s);
  const A = a * IN_M,
    B = b * IN_M;
  const X = beamModeParams((k.x0 * A) / Dx, (k.x1 * A) / Dx),
    Y = beamModeParams((k.y0 * B) / Dy, (k.y1 * B) / Dy);
  const w2 =
    (Dx * X.Lam) / A ** 4 + (Dy * Y.Lam) / B ** 4 + (2 * H * X.eta * Y.eta) / (A * A * B * B);
  return Math.sqrt(w2 / rhoH) / (2 * Math.PI);
}

const holeMemo = new Map<string, number>();
const HOLE_MEMO_MAX = 5000;
const SPAN_HOLE = spanMatrices(BASIS_HOLE);
const HOLE_GAUSS = gaussLegendre(HOLE_RADIAL);
/**
 * The first mode of an `a` × `b` in plate with a round hole, its edges held by `k`, Hz: the Ritz series over the
 * plate less the hole (header), with `ringKg` spread round the hole's edge (a driver's frame and motor; 0 for none).
 * The hole's part outside the plate, if any, is left out.
 */
export function holedPlateHz(
  a: number,
  b: number,
  s: PlateStock,
  k: EdgeSprings,
  hole: PlateHole,
  ringKg = 0,
) {
  const key = [
    a,
    b,
    s.t,
    s.lbPerSqFt,
    s.eStrong,
    s.eWeak,
    k.x0,
    k.x1,
    k.y0,
    k.y1,
    hole.cx,
    hole.cy,
    hole.r,
    ringKg,
  ]
    .map((v) => v.toPrecision(6))
    .join("|");
  const hit = holeMemo.get(key);
  if (hit !== undefined) return hit;
  const { Dx, Dy, H, D12, D66, rhoH } = plateStiffness(a, b, s);
  const n = BASIS_HOLE,
    nb = n * n,
    S = SPAN_HOLE;
  const A = a * IN_M,
    B = b * IN_M;
  const K = zeros(nb),
    M = zeros(nb);
  // the whole plate: each integral a product of the spans' (x = Aξ, y = Bη)
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      for (let p = 0; p < n; p++)
        for (let q = 0; q < n; q++) {
          const r = i * n + j,
            c = p * n + q;
          K[r][c] =
            ((Dx * B) / A ** 3) * S.A2[i][p] * S.A0[j][q] +
            ((Dy * A) / B ** 3) * S.A0[i][p] * S.A2[j][q] +
            ((2 * H) / (A * B)) * S.A1[i][p] * S.A1[j][q] +
            ((k.x0 * S.s0[i] * S.s0[p] + k.x1 * S.s1[i] * S.s1[p]) * B * S.A0[j][q]) / (A * A) +
            ((k.y0 * S.s0[j] * S.s0[q] + k.y1 * S.s1[j] * S.s1[q]) * A * S.A0[i][p]) / (B * B);
          M[r][c] = rhoH * A * B * S.A0[i][p] * S.A0[j][q];
        }
  // less the hole: Gauss along the radius, evenly round (exact for the angle's harmonics)
  const w = new Float64Array(nb),
    wxx = new Float64Array(nb),
    wyy = new Float64Array(nb),
    wxy = new Float64Array(nb);
  for (let ir = 0; ir < HOLE_RADIAL; ir++) {
    const rho = ((HOLE_GAUSS.x[ir] + 1) / 2) * hole.r,
      wr = (HOLE_GAUSS.w[ir] / 2) * hole.r;
    for (let it = 0; it < HOLE_ROUND; it++) {
      const th = (2 * Math.PI * (it + 0.5)) / HOLE_ROUND;
      const x = hole.cx + rho * Math.cos(th),
        y = hole.cy + rho * Math.sin(th);
      if (x <= 0 || x >= a || y <= 0 || y >= b) continue;
      const dA = wr * rho * ((2 * Math.PI) / HOLE_ROUND) * IN_M * IN_M;
      const X = basisAt(n, x / a),
        Y = basisAt(n, y / b);
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          const r = i * n + j;
          w[r] = X.f[i] * Y.f[j];
          wxx[r] = (X.f2[i] * Y.f[j]) / (A * A);
          wyy[r] = (X.f[i] * Y.f2[j]) / (B * B);
          wxy[r] = (X.f1[i] * Y.f1[j]) / (A * B);
        }
      // the upper triangle (mirrored below)
      for (let r = 0; r < nb; r++)
        for (let c = r; c < nb; c++) {
          K[r][c] -=
            dA *
            (Dx * wxx[r] * wxx[c] +
              Dy * wyy[r] * wyy[c] +
              D12 * (wxx[r] * wyy[c] + wyy[r] * wxx[c]) +
              4 * D66 * wxy[r] * wxy[c]);
          M[r][c] -= dA * rhoH * w[r] * w[c];
        }
    }
  }
  if (ringKg > 0)
    for (let it = 0; it < HOLE_ROUND; it++) {
      const th = (2 * Math.PI * (it + 0.5)) / HOLE_ROUND;
      const x = hole.cx + hole.r * Math.cos(th),
        y = hole.cy + hole.r * Math.sin(th);
      // the weight sits only where the cutout's edge is on this plate
      if (x <= 0 || x >= a || y <= 0 || y >= b) continue;
      const X = basisAt(n, x / a),
        Y = basisAt(n, y / b);
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) w[i * n + j] = X.f[i] * Y.f[j];
      for (let r = 0; r < nb; r++)
        for (let c = r; c < nb; c++) M[r][c] += (ringKg / HOLE_ROUND) * w[r] * w[c];
    }
  for (let r = 0; r < nb; r++)
    for (let c = 0; c < r; c++) {
      K[r][c] = K[c][r];
      M[r][c] = M[c][r];
    }
  const hz = Math.sqrt(lowestMode(K, M).lam) / (2 * Math.PI);
  if (holeMemo.size >= HOLE_MEMO_MAX) holeMemo.clear();
  holeMemo.set(key, hz);
  return hz;
}
