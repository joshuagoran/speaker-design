// Low-frequency potential flow through a slot vent into its box, in the box's 2D section: what the slot inner-end table
// (src/data/acoustics/slot-inner-end.ts) is computed from, and what its tests check it against.
//
// At low frequency the box's pressure is uniform, so the air everywhere in it compresses at the same rate: the flow is a
// potential flow with a uniform sink in the box air, fed by the duct (Rayleigh, Theory of Sound II §§ 303–306; the same
// incompressible-flow method gives Kergomard & Garcia's 2D discontinuity corrections, J. Sound Vib. 114, 1987). The
// flow's kinetic energy over the flux squared is the acoustic mass; the inner end correction is what it adds over plane
// flow (the duct's own length, and the box's 1D flow, the flux split by volume between the space over the shelf and the
// pocket behind the mouth): the modal (piston) end correction's definition, here without its piston assumption and
// with the open space over the shelf.
//
// The grid is rectilinear: cells `1/n` of a slot height square near the mouth, the shelf and the walls, growing by a
// fixed ratio a cell away from them where the flow is smooth, up to a quarter of a slot height along the slot and a slot
// height across it (the straight slot's; the folded slot's grid is uniform). Five-point finite volumes, each face's flux
// its length times the potential's step over the distance between the cell centers, so the scheme stays conservative on
// the uneven grid; conjugate gradients preconditioned by a modified incomplete Cholesky factorization, one box cell
// pinned to make the Neumann problem definite.

import os from "node:os";
import { Worker } from "node:worker_threads";

/** Cell kinds: solid, duct air (no sink), box air (sink). */
const SOLID = 0,
  DUCT = 1,
  BOX = 2;

/** The modified incomplete Cholesky's share of the dropped fill kept on the diagonal (1 keeps A's row sums exactly). */
const MIC = 0.995;

/** A solve's result: the acoustic mass over the flux squared, and the potential (to start a neighboring solve from). */
interface Flow {
  mass: number;
  phi: Float64Array;
  iterations: number;
}

/**
 * The flow's acoustic mass over the flux squared (per unit width, ρ = 1, in slot heights), on the rectilinear grid of
 * column widths `dx` and row heights `dy`, fed through the duct cells of the first column; `warm`, a potential on the
 * same grid, starts the iteration.
 */
function flowMass(dx: Float64Array, dy: Float64Array, kind: Uint8Array, warm?: Float64Array): Flow {
  const nz = dx.length,
    ny = dy.length,
    n = nz * ny;
  const air = (i: number, j: number) =>
    i >= 0 && i < nz && j >= 0 && j < ny && kind[j * nz + i] !== SOLID;
  // the flux in at the inlet column (1 in all, by height) and out through the box air (by area)
  let boxArea = 0,
    inletHeight = 0;
  for (let j = 0; j < ny; j++) {
    if (kind[j * nz] === DUCT) inletHeight += dy[j];
    for (let i = 0; i < nz; i++) if (kind[j * nz + i] === BOX) boxArea += dx[i] * dy[j];
  }
  const b = new Float64Array(n);
  let pin = -1;
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nz; i++) {
      const k = j * nz + i;
      if (kind[k] === BOX) {
        b[k] = (-dx[i] * dy[j]) / boxArea;
        pin = k;
      }
      if (i === 0 && kind[k] === DUCT) b[k] += dy[j] / inletHeight;
    }
  // face conductances (length over center distance) to the east and north neighbors, 0 where either side is solid
  const cE = new Float64Array(n),
    cN = new Float64Array(n),
    diag = new Float64Array(n);
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nz; i++) {
      const k = j * nz + i;
      if (!air(i, j)) continue;
      if (air(i + 1, j)) cE[k] = dy[j] / ((dx[i] + dx[i + 1]) / 2);
      if (air(i, j + 1)) cN[k] = dx[i] / ((dy[j] + dy[j + 1]) / 2);
    }
  for (let k = 0; k < n; k++) {
    diag[k] += cE[k] + cN[k];
    if (cE[k]) diag[k + 1] += cE[k];
    if (cN[k]) diag[k + nz] += cN[k];
  }
  // the pinned cell is held at 0 (the potential is defined up to a constant, and b sums to 0, so its equation is the
  // others' sum): its row and column leave the system, its faces stay in its neighbors' diagonals
  const active = new Uint8Array(n);
  for (let k = 0; k < n; k++) active[k] = kind[k] !== SOLID && k !== pin ? 1 : 0;
  const west = (k: number) => (k % nz > 0 && active[k - 1] ? cE[k - 1] : 0),
    south = (k: number) => (k >= nz && active[k - nz] ? cN[k - nz] : 0),
    east = (k: number) => (k % nz < nz - 1 && active[k + 1] ? cE[k] : 0),
    north = (k: number) => (k + nz < n && active[k + nz] ? cN[k] : 0);
  const cW = new Float64Array(n),
    cS = new Float64Array(n),
    cEa = new Float64Array(n),
    cNa = new Float64Array(n);
  for (let k = 0; k < n; k++)
    if (active[k]) {
      cW[k] = west(k);
      cS[k] = south(k);
      cEa[k] = east(k);
      cNa[k] = north(k);
    }
  const apply = (x: Float64Array, y: Float64Array) => {
    for (let k = 0; k < n; k++) {
      if (!active[k]) {
        y[k] = 0;
        continue;
      }
      let s = diag[k] * x[k];
      if (cW[k]) s -= cW[k] * x[k - 1];
      if (cEa[k]) s -= cEa[k] * x[k + 1];
      if (cS[k]) s -= cS[k] * x[k - nz];
      if (cNa[k]) s -= cNa[k] * x[k + nz];
      y[k] = s;
    }
  };
  // modified incomplete Cholesky, no fill (the five-point stencil's): M = (D + L) D⁻¹ (D + Lᵀ), L the stencil's lower
  // part, the dropped fill (all but 1 − MIC of it) moved onto the diagonal so M keeps A's row sums, which the smooth
  // errors (the slow ones for plain incomplete Cholesky) feel
  const d = new Float64Array(n);
  for (let k = 0; k < n; k++)
    if (active[k])
      d[k] =
        diag[k] -
        (cW[k] ? (cW[k] * (cW[k] + MIC * cNa[k - 1])) / d[k - 1] : 0) -
        (cS[k] ? (cS[k] * (cS[k] + MIC * cEa[k - nz])) / d[k - nz] : 0);
  for (let k = 0; k < n; k++)
    if (active[k] && !(d[k] > 0)) throw new Error(`incomplete Cholesky pivot ${d[k]} at cell ${k}`);
  const precondition = (r: Float64Array, z: Float64Array) => {
    for (let k = 0; k < n; k++) {
      if (!active[k]) {
        z[k] = 0;
        continue;
      }
      let s = r[k];
      if (cW[k]) s += cW[k] * z[k - 1];
      if (cS[k]) s += cS[k] * z[k - nz];
      z[k] = s / d[k];
    }
    for (let k = n - 1; k >= 0; k--) {
      if (!active[k]) continue;
      let s = 0;
      if (cEa[k]) s += cEa[k] * z[k + 1];
      if (cNa[k]) s += cNa[k] * z[k + nz];
      z[k] += s / d[k];
    }
  };
  const x = new Float64Array(n),
    r = new Float64Array(n),
    z = new Float64Array(n),
    p = new Float64Array(n),
    Ap = new Float64Array(n);
  if (warm && warm.length === n && pin >= 0)
    for (let k = 0; k < n; k++) x[k] = active[k] ? warm[k] - warm[pin] : 0;
  apply(x, Ap);
  let b2 = 0;
  for (let k = 0; k < n; k++) {
    r[k] = active[k] ? b[k] - Ap[k] : 0;
    b2 += active[k] ? b[k] * b[k] : 0;
  }
  precondition(r, z);
  p.set(z);
  let rz = 0;
  for (let k = 0; k < n; k++) rz += r[k] * z[k];
  // the table's grids converge in a few hundred iterations; one that reaches the cap fails rather than give a wrong value
  const MAX_ITERATIONS = 20_000;
  let it = 0;
  for (; ; it++) {
    let rr = 0;
    for (let k = 0; k < n; k++) rr += r[k] * r[k];
    if (rr < 1e-18 * b2) break;
    if (it === MAX_ITERATIONS)
      throw new Error(
        `slot flow: CG did not converge in ${MAX_ITERATIONS} iterations (${n} cells)`,
      );
    apply(p, Ap);
    let pAp = 0;
    for (let k = 0; k < n; k++) pAp += p[k] * Ap[k];
    const a = rz / pAp;
    for (let k = 0; k < n; k++) {
      x[k] += a * p[k];
      r[k] -= a * Ap[k];
    }
    precondition(r, z);
    let rz2 = 0;
    for (let k = 0; k < n; k++) rz2 += r[k] * z[k];
    const beta = rz2 / rz;
    rz = rz2;
    for (let k = 0; k < n; k++) p[k] = z[k] + beta * p[k];
  }
  // the kinetic energy (the sum over faces of conductance × the potential's step squared) is x · b
  let ke = 0;
  for (let k = 0; k < n; k++) ke += x[k] * b[k];
  return { mass: ke, phi: x, iterations: it };
}

/**
 * Growth ratio of the cells away from the fine zones, and the largest cells, in slot heights: along the slot (the box's
 * far flow is 1D along it, and its energy's error goes as the cell squared) and across it.
 */
const GROWTH = 1.12,
  COARSEST_ALONG = 0.25,
  COARSEST_ACROSS = 1;

/**
 * One axis of the grid, `len` fine cells long, in fine cells: square fine cells within `zone` of each fine point
 * (`fine`, which are also faces), growing by GROWTH a cell beyond, up to `coarsest`; `uniform` keeps them all fine.
 */
function axis(len: number, fine: number[], zone: number, coarsest: number, uniform: boolean) {
  const points = [...new Set(fine.filter((f) => f >= 0 && f <= len))].sort((a, b) => a - b);
  const size = (x: number) => {
    let dist = Infinity;
    for (const f of points) dist = Math.min(dist, Math.abs(x - f));
    return uniform ? 1 : Math.min(coarsest, 1 + (GROWTH - 1) * Math.max(0, dist - zone));
  };
  const widths: number[] = [];
  for (let s = 0; s + 1 < points.length; s++) {
    const a = points[s],
      L = points[s + 1] - a;
    if (L <= 0) continue;
    // the stretched coordinate ∫ dx / size, sampled finely, then cut into a whole number of equal steps
    const steps = Math.max(1, Math.ceil(L * 8));
    const cum = [0];
    for (let q = 0; q < steps; q++)
      cum.push(cum[q] + L / steps / size(a + ((q + 0.5) * L) / steps));
    const cells = Math.max(1, Math.round(cum[steps] - 1e-9));
    let prev = 0,
      q = 0;
    for (let c = 1; c <= cells; c++) {
      const target = (c / cells) * cum[steps];
      while (q < steps && cum[q + 1] < target - 1e-12) q++;
      const xAt = c === cells ? L : ((q + (target - cum[q]) / (cum[q + 1] - cum[q])) * L) / steps;
      widths.push(xAt - prev);
      prev = xAt;
    }
  }
  return widths;
}

/**
 * 1D uniform-sink flow's mass over a run `len` of height `H` that takes the share `q` of the flux (none where the run has
 * no air: a shelf as thick as the room over the slot walls it off).
 */
const bulk = (q: number, len: number, H: number) =>
  len > 0 && H > 0 ? (q * q * len) / (3 * H) : 0;

/** A straight bottom slot's geometry, in slot heights (see straightSlotInnerEnd). */
export interface StraightSlot {
  t: number;
  span: number;
  gap: number;
  run: number;
}

/** How to solve: fine cells a slot height, a uniform grid (no coarse cells), and a potential to start from. */
export interface SolveOptions {
  n?: number;
  closedAbove?: boolean;
  uniform?: boolean;
  warm?: Pick<Flow, "phi"> & { key: string };
}

/**
 * A straight slot's inner end, with the grid's key and the potential (a neighboring point on the same grid can start
 * from it: the grid does not depend on the shelf's thickness, up to a slot height).
 */
export function solveStraightSlot(
  { t, span, gap, run }: StraightSlot,
  { n = 16, closedAbove = false, uniform = false, warm }: SolveOptions = {},
) {
  const nz = Math.round((run + gap) * n),
    ny = Math.round(span * n),
    nt = Math.max(1, Math.round(t * n)),
    nm = Math.round(run * n);
  // fine near the inlet, the mouth and the back wall along the slot; across it, fine from the floor to over the
  // thickest shelf (a slot height) and near the top
  const zone = n;
  const xs = axis(nz, [0, nm, nz], zone, n * COARSEST_ALONG, uniform);
  const top = Math.min(ny, n + Math.max(nt, n));
  const ys = axis(
    ny,
    [0, ...Array.from({ length: top + 1 }, (_, j) => j), ny],
    zone,
    n * COARSEST_ACROSS,
    uniform,
  );
  const dx = Float64Array.from(xs, (w) => w / n),
    dy = Float64Array.from(ys, (w) => w / n);
  const key = `${n} ${uniform} ${xs.join(",")} / ${ys.join(",")}`;
  const kind = new Uint8Array(xs.length * ys.length);
  let yc = 0;
  for (let j = 0; j < ys.length; j++) {
    const yMid = yc + ys[j] / 2;
    let xc = 0;
    for (let i = 0; i < xs.length; i++) {
      const xMid = xc + xs[i] / 2;
      let k = BOX;
      if (xMid < nm) k = yMid < n ? DUCT : yMid < n + nt || closedAbove ? SOLID : BOX;
      kind[j * xs.length + i] = k;
      xc += xs[i];
    }
    yc += ys[j];
  }
  const flow = flowMass(dx, dy, kind, warm && warm.key === key ? warm.phi : undefined);
  const Hf = (ny - n - nt) / n,
    Lf = nm / n,
    Hb = ny / n,
    Lb = (nz - nm) / n;
  const Af = closedAbove ? 0 : Hf * Lf,
    Ab = Hb * Lb;
  const M1D = Lf + bulk(Af / (Af + Ab), Lf, Hf) + bulk(Ab / (Af + Ab), Lb, Hb);
  // the inlet cells' center starts the duct's plane flow half a cell in
  return {
    ec: flow.mass - M1D + dx[0] / 2,
    key,
    phi: flow.phi,
    mass: flow.mass,
    iterations: flow.iterations,
  };
}

/**
 * A straight bottom slot's inner end correction, in slot heights: slot height 1 on the floor, shelf `t` over it running
 * `run` from the baffle to the mouth, the box `span` tall, the back wall `gap` behind the mouth. `closedAbove` walls off
 * the space over the shelf (the modal model's geometry, for checking against it).
 */
export function straightSlotInnerEnd(slot: StraightSlot, n = 16, closedAbove = false) {
  return solveStraightSlot(slot, { n, closedAbove }).ec;
}

/** A group's results from the worker pool, point by point. */
export interface GroupResult {
  ec: number;
  iterations: number;
  cells: number;
}

/**
 * Solves groups of straight slots, one worker per core (tests/slot-flow-worker.mjs), the largest grids first so no
 * worker is left with one at the end; within a group each point starts from the one before (`warm`) where their grids
 * match.
 */
export async function solveGroups(groups: StraightSlot[][], warm = true) {
  const results: GroupResult[][] = [];
  const order = groups
    .map((g, i) => ({ i, cells: g.length * (g[0].gap + g[0].run) * g[0].span }))
    .sort((a, b) => b.cells - a.cells)
    .map((g) => g.i);
  let next = 0;
  // the first failure stops the pool: no more groups go out, and every worker is terminated
  let failed = false;
  const workers: Worker[] = [];
  const stopAll = () => {
    failed = true;
    for (const w of workers) void w.terminate();
  };
  await Promise.all(
    Array.from(
      { length: Math.min(os.availableParallelism(), groups.length) },
      () =>
        new Promise<void>((resolve, reject) => {
          const worker = new Worker(new URL("./slot-flow-worker.mjs", import.meta.url));
          workers.push(worker);
          let done = false;
          const fail = (err: unknown) => {
            done = true;
            stopAll();
            reject(err);
          };
          const send = () => {
            if (failed) return;
            if (next < order.length) {
              const i = order[next++];
              worker.postMessage({ i, points: groups[i], warm });
            } else {
              done = true;
              void worker.terminate().then(() => resolve());
            }
          };
          worker.on("message", (m: { i: number; out: GroupResult[] }) => {
            results[m.i] = m.out;
            send();
          });
          worker.on("error", fail);
          worker.on("messageerror", fail);
          // a worker that exits before its last group (not by our terminate) would otherwise leave the pool waiting
          worker.on("exit", (code) => {
            if (!done) fail(new Error(`slot-flow worker exited with code ${code}`));
          });
          send();
        }),
    ),
  );
  return results;
}

/**
 * A folded bottom slot's inner end beyond its centerline (the floor run to the rear channel's middle, then up to the
 * mouth), in slot heights: floor leg 1 tall to the back panel, shelf `t` over it to the rear wall (`t` thick, 1 in front
 * of the back panel), the wall rising `wall` from the roof's underside; the box `span` deep and `height` tall.
 */
export function foldedSlotInnerEnd(
  { t, span, height, wall }: { t: number; span: number; height: number; wall: number },
  n = 16,
) {
  const nz = Math.round(span * n),
    ny = Math.round(height * n),
    nt = Math.max(1, Math.round(t * n)),
    nm = n + Math.round(wall * n),
    zWall = nz - n - nt;
  const kind = new Uint8Array(nz * ny);
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nz; i++) {
      let k = BOX;
      if (j < n || (i >= nz - n && j < nm)) k = DUCT;
      else if ((i < zWall && j < n + nt) || (i >= zWall && j < nm)) k = SOLID;
      kind[j * nz + i] = k;
    }
  const M = flowMass(new Float64Array(nz).fill(1 / n), new Float64Array(ny).fill(1 / n), kind).mass;
  const D = nz / n,
    ym = nm / n,
    center = D - 0.5 + (ym - 0.5);
  const Wf = zWall / n,
    Lf = Math.max(0, ym - 1 - nt / n),
    Wb = D,
    Lb = ny / n - ym;
  const Af = Wf * Lf,
    Ab = Wb * Lb;
  return M - (center + bulk(Af / (Af + Ab), Lf, Wf) + bulk(Ab / (Af + Ab), Lb, Wb)) + 0.5 / n;
}

/**
 * The modal (piston) inner end correction the solver is checked against: a uniform piston `h` high against one wall of a
 * rigid 2D duct `X` tall, its plane rigid out to the far wall, the duct ending `L` behind it (the evanescent cross-modes
 * carry the added mass):
 *   end correction = 2 X² / (π³ h) Σ sin²(m π h / X) coth(m π L / X) / m³
 */
export function modalInnerEnd(h: number, X: number, L = Infinity) {
  let sum = 0;
  for (let m = 1; m <= 2000; m++) {
    const k = (m * Math.PI) / X,
      sn = Math.sin(k * h);
    sum += ((sn * sn) / (m * m * m)) * (Number.isFinite(L) ? 1 / Math.tanh(k * L) : 1);
  }
  return ((2 * X * X) / (Math.PI ** 3 * h)) * sum;
}
