// Low-frequency potential flow through a slot vent into its box, in the box's 2D section: what the slot inner-end table
// (src/data/acoustics/slot-inner-end.ts) is computed from, and what its tests check it against.
//
// At low frequency the box's pressure is uniform, so the air everywhere in it compresses at the same rate: the flow is a
// potential flow with a uniform sink in the box air, fed by the duct (Rayleigh, Theory of Sound II §§ 303–306; the same
// incompressible-flow method gives Kergomard & Garcia's 2D discontinuity corrections, J. Sound Vib. 114, 1987). The
// flow's kinetic energy over the flux squared is the acoustic mass; the inner end correction is what it adds over plane
// flow (the duct's own length, and the box's 1D flow, the flux split by volume between the space over the shelf and the
// pocket behind the mouth): the modal (piston) end correction's definition, here without its piston assumption and
// with the open space over the shelf. Cells are square, `n` per slot height; five-point finite volumes, conjugate
// gradients.

/** Cell kinds: solid, duct air (no sink), box air (sink). */
const SOLID = 0,
  DUCT = 1,
  BOX = 2;

/** The flow's acoustic mass over the flux squared (per unit width, ρ = 1, cell side 1), from the cells and the inlet. */
function flowMass(nz: number, ny: number, kind: Uint8Array, inlet: number[]) {
  const n = nz * ny;
  const air = (i: number, j: number) =>
    i >= 0 && i < nz && j >= 0 && j < ny && kind[j * nz + i] !== SOLID;
  let nBox = 0;
  for (let k = 0; k < n; k++) if (kind[k] === BOX) nBox++;
  const Q = inlet.length;
  const b = new Float64Array(n);
  for (const k of inlet) b[k] += 1;
  for (let k = 0; k < n; k++) if (kind[k] === BOX) b[k] -= Q / nBox;
  const deg = new Float64Array(n);
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nz; i++)
      if (air(i, j))
        deg[j * nz + i] = +air(i - 1, j) + +air(i + 1, j) + +air(i, j - 1) + +air(i, j + 1);
  const apply = (x: Float64Array, y: Float64Array) => {
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nz; i++) {
        const k = j * nz + i;
        if (kind[k] === SOLID) {
          y[k] = 0;
          continue;
        }
        let s = deg[k] * x[k];
        if (air(i - 1, j)) s -= x[k - 1];
        if (air(i + 1, j)) s -= x[k + 1];
        if (air(i, j - 1)) s -= x[k - nz];
        if (air(i, j + 1)) s -= x[k + nz];
        y[k] = s;
      }
  };
  // the graph Laplacian is singular (Neumann walls) but b sums to zero, so CG converges to a solution
  const x = new Float64Array(n),
    r = Float64Array.from(b),
    z = new Float64Array(n),
    p = new Float64Array(n),
    Ap = new Float64Array(n);
  const precondition = () => {
    for (let k = 0; k < n; k++) z[k] = deg[k] ? r[k] / deg[k] : 0;
  };
  precondition();
  p.set(z);
  let rz = 0;
  for (let k = 0; k < n; k++) rz += r[k] * z[k];
  let b2 = 0;
  for (let k = 0; k < n; k++) b2 += b[k] * b[k];
  for (let it = 0; it < 50_000; it++) {
    apply(p, Ap);
    let pAp = 0;
    for (let k = 0; k < n; k++) pAp += p[k] * Ap[k];
    const a = rz / pAp;
    let rr = 0;
    for (let k = 0; k < n; k++) {
      x[k] += a * p[k];
      r[k] -= a * Ap[k];
      rr += r[k] * r[k];
    }
    if (rr < 1e-20 * b2) break;
    precondition();
    let rz2 = 0;
    for (let k = 0; k < n; k++) rz2 += r[k] * z[k];
    const beta = rz2 / rz;
    rz = rz2;
    for (let k = 0; k < n; k++) p[k] = z[k] + beta * p[k];
  }
  // the kinetic energy (the sum over faces of the potential's steps squared) is x · b
  let ke = 0;
  for (let k = 0; k < n; k++) ke += x[k] * b[k];
  return ke / (Q * Q);
}

/** 1D uniform-sink flow's mass over a run `len` of height `H` that takes the share `q` of the flux. */
const bulk = (q: number, len: number, H: number) => (len > 0 ? (q * q * len) / (3 * H) : 0);

/**
 * A straight bottom slot's inner end correction, in slot heights: slot height 1 on the floor, shelf `t` over it running
 * `run` from the baffle to the mouth, the box `span` tall, the back wall `gap` behind the mouth. `closedAbove` walls off
 * the space over the shelf (the modal model's geometry, for checking against it).
 */
export function straightSlotInnerEnd(
  { t, span, gap, run }: { t: number; span: number; gap: number; run: number },
  n = 16,
  closedAbove = false,
) {
  const nz = Math.round((run + gap) * n),
    ny = Math.round(span * n),
    nt = Math.max(1, Math.round(t * n)),
    nm = Math.round(run * n);
  const kind = new Uint8Array(nz * ny);
  const inlet: number[] = [];
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nz; i++) {
      let k = BOX;
      if (i < nm) k = j < n ? DUCT : j < n + nt || closedAbove ? SOLID : BOX;
      kind[j * nz + i] = k;
      if (k === DUCT && i === 0) inlet.push(j * nz + i);
    }
  const M = flowMass(nz, ny, kind, inlet);
  const Hf = (ny - n - nt) / n,
    Lf = nm / n,
    Hb = ny / n,
    Lb = (nz - nm) / n;
  const Af = closedAbove ? 0 : Hf * Lf,
    Ab = Hb * Lb;
  const M1D = Lf + bulk(Af / (Af + Ab), Lf, Hf) + bulk(Ab / (Af + Ab), Lb, Hb);
  // the inlet cell's centre starts the duct's plane flow half a cell in
  return M - M1D + 0.5 / n;
}

/**
 * A folded bottom slot's inner end beyond its centreline (the floor run to the rear channel's middle, then up to the
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
  const inlet: number[] = [];
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nz; i++) {
      let k = BOX;
      if (j < n || (i >= nz - n && j < nm)) k = DUCT;
      else if ((i < zWall && j < n + nt) || (i >= zWall && j < nm)) k = SOLID;
      kind[j * nz + i] = k;
      if (k === DUCT && i === 0) inlet.push(j * nz + i);
    }
  const M = flowMass(nz, ny, kind, inlet);
  const D = nz / n,
    ym = nm / n,
    centre = D - 0.5 + (ym - 0.5);
  const Wf = zWall / n,
    Lf = Math.max(0, ym - 1 - nt / n),
    Wb = D,
    Lb = ny / n - ym;
  const Af = Wf * Lf,
    Ab = Wb * Lb;
  return M - (centre + bulk(Af / (Af + Ab), Lf, Wf) + bulk(Ab / (Af + Ab), Lb, Wb)) + 0.5 / n;
}
