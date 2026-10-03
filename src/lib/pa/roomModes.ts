// The low end indoors: the room's modes. Below the crossover the map sums the modes of a rectangular room with rigid
// walls (Kuttruff, Room Acoustics, ch. 3), each driver a monopole at its place:
//   p(r) = jωρQ · Σn ψn(r) ψn(r0) / (V Λn (kn² − k² + j·2kδ/c)),   ψn = cos(nx π x/Lx) cos(ny π y/Ly) cos(nz π z/Lz)
// with Λn = 1/(εx εy εz), ε = 1 for a 0 index and 2 otherwise (so that V Λn = ∫ψn² dV), and |p| = ρωQ / 4πr in the
// free field, so jωρQ = 4π × the driver's free-field pressure at 1 m (with its alignment's phase).
// Damping is uniform: every mode decays at δ = 6.91 / T60, Sabine's T60 from all six surfaces and the air. Damped
// that way the sum is exactly the rigid box's image lattice in a lossy medium (k̃² = k² − j·2kδ/c): every image at R
// arrives R/c late and has decayed by e^(−δR/c), standing in for the reflections it took on the way. For the direct
// sound and the images up to second order the map knows better, so it swaps those terms for the real ones: no decay,
// each reflection as its surface reflects it (an open side: nothing). The rest, the room's ringing, stays modal.
// The modal sum stops at a highest mode, which smooths the field within about a wavelength of that mode around each
// driver; the swapped terms don't change that.
import type { Complex } from "../hifi/hifi";
import type { StackBand } from "./dispersion";

const C = 343;

/** The modes a room sums: its size and how many indices each axis runs to. */
export interface RoomModes {
  /** room size, m: across (x), down the room (y), up (z); the origin in a floor corner */
  size: [x: number, y: number, z: number];
  /** mode indices along each axis run 0 to n − 1 */
  n: [x: number, y: number, z: number];
  /** the highest mode wavenumber summed, rad/m */
  kmax: number;
}

/** A driver as the modal sum sees it: a monopole at its place in the room, its mode shapes there, its images. */
export interface ModalSource {
  band: StackBand;
  /** how much the box's DSP delays it, as a path length, m (see SceneSource.alignM) */
  alignM: number;
  /** cos(n π x / Lx) at the driver, n from 0, and likewise along y and z */
  cx: Float64Array;
  cy: Float64Array;
  cz: Float64Array;
  /** where it and its images up to second order are, [x, y, z] each, in IMAGE_HITS order */
  images: Float64Array;
}

/** The surfaces an image's reflections are counted on, in this order. */
export const MODAL_SURFACES = ["front", "back", "left", "right", "ceiling", "floor"] as const;

/** One axis's images up to second order: the position from the source's, and the hits on the low and high wall. */
const AXIS_IMAGES: {
  order: number;
  at: (p: number, len: number) => number;
  lo: number;
  hi: number;
}[] = [
  { order: 0, at: (p) => p, lo: 0, hi: 0 },
  { order: 1, at: (p) => -p, lo: 1, hi: 0 },
  { order: 1, at: (p, len) => 2 * len - p, lo: 0, hi: 1 },
  { order: 2, at: (p, len) => p + 2 * len, lo: 1, hi: 1 },
  { order: 2, at: (p, len) => p - 2 * len, lo: 1, hi: 1 },
];
/**
 * The direct sound and every image up to second order: which axis image each takes, and how often it hits each
 * surface (MODAL_SURFACES order). x runs from the left side to the right, y from the front to the back, z up.
 */
const IMAGE_HITS: { axes: [number, number, number]; hits: number[] }[] = [];
for (const [ix, ax] of AXIS_IMAGES.entries())
  for (const [iy, ay] of AXIS_IMAGES.entries())
    for (const [iz, az] of AXIS_IMAGES.entries())
      if (ax.order + ay.order + az.order <= 2)
        IMAGE_HITS.push({
          axes: [ix, iy, iz],
          hits: [ay.lo, ay.hi, ax.lo, ax.hi, az.hi, az.lo],
        });

/** One frequency of the modal sum. */
export interface ModalSlot {
  /** the modal sum's share of the level, power, 0–1; the image sources and the diffuse field carry the rest */
  weight: number;
  k: number;
  /** 2kδ/c, the damping's imaginary part of kn² − k², 1/m² */
  damp: number;
  /** the lossy wavenumber the damped modes amount to: k̃ = re − j·im */
  kt: Complex;
  /** each source's jωρQ: 4π × its free-field pressure at 1 m with its alignment's phase, re and im interleaved */
  u: Float64Array;
  /** the pressure the direct sound and each image keep after their reflections, IMAGE_HITS order */
  keep: Float64Array;
  /**
   * The sum over the z modes at one receiver height, and over the y modes along one row too: kept while the receiver
   * stays at that height (and on that row), so a grid row costs one pass over the modes plus one per cell over x.
   */
  cache: { z: number; e: Float64Array; y: number; fy: Float64Array };
}

/** Never more modes than this: past it the highest wavenumber comes down (a very large, very live room). */
const MAX_MODES = 40000;

/**
 * The modes to sum for a room up to `kmax` rad/m. The count of modes below k is about V k³ / 6π² (Kuttruff); `kmax`
 * comes down as needed to keep it under MAX_MODES.
 */
export function roomModes(size: [number, number, number], kmax: number): RoomModes {
  const volume = size[0] * size[1] * size[2];
  const k = Math.min(kmax, Math.cbrt((MAX_MODES * 6 * Math.PI ** 2) / volume));
  const n = size.map((s) => Math.floor((k * s) / Math.PI) + 1);
  return { size, n: [n[0], n[1], n[2]], kmax: k };
}

/** cos(i π p / len) for i from 0 to n − 1, by the Chebyshev recurrence. */
export function axisCos(
  n: number,
  len: number,
  p: number,
  out: Float64Array = new Float64Array(n),
): Float64Array {
  const c = Math.cos((Math.PI * p) / len);
  out[0] = 1;
  if (n > 1) out[1] = c;
  for (let i = 2; i < n; i++) out[i] = 2 * c * out[i - 1] - out[i - 2];
  return out;
}

/** A driver at (x, y, z) in the room (m, origin in a floor corner), ready for the modal sum. */
export function modalSource(
  modes: RoomModes,
  band: StackBand,
  alignM: number,
  x: number,
  y: number,
  z: number,
): ModalSource {
  const [W, L, H] = modes.size;
  const images = new Float64Array(3 * IMAGE_HITS.length);
  for (const [i, { axes }] of IMAGE_HITS.entries()) {
    images[3 * i] = AXIS_IMAGES[axes[0]].at(x, W);
    images[3 * i + 1] = AXIS_IMAGES[axes[1]].at(y, L);
    images[3 * i + 2] = AXIS_IMAGES[axes[2]].at(z, H);
  }
  return {
    band,
    alignM,
    cx: axisCos(modes.n[0], W, x),
    cy: axisCos(modes.n[1], L, y),
    cz: axisCos(modes.n[2], H, z),
    images,
  };
}

/**
 * One frequency of the modal sum: each source's strength `u` (jωρQ, re/im), the room's reverberation time there, and
 * the pressure each surface reflects there (MODAL_SURFACES order).
 */
export function modalSlot(
  modes: RoomModes,
  k: number,
  t60: number,
  u: Float64Array,
  reflection: readonly number[],
  weight: number,
): ModalSlot {
  const keep = new Float64Array(IMAGE_HITS.length);
  for (const [i, { hits }] of IMAGE_HITS.entries())
    keep[i] = hits.reduce((g, n, s) => g * reflection[s] ** n, 1);
  const delta = 6.91 / t60,
    damp = (2 * k * delta) / C;
  // k̃² = k² − j·damp: k̃ = a − jb with a² − b² = k², 2ab = damp
  const a = Math.sqrt((k * k + Math.hypot(k * k, damp)) / 2);
  return {
    weight,
    k,
    damp,
    kt: { re: a, im: damp / (2 * a) },
    u,
    keep,
    cache: {
      z: NaN,
      e: new Float64Array(2 * modes.n[0] * modes.n[1]),
      y: NaN,
      fy: new Float64Array(2 * modes.n[0]),
    },
  };
}

// scratch: the receiver's cos tables, and each source's strength times its x-y shape
let rx: Float64Array = new Float64Array(0),
  ry: Float64Array = new Float64Array(0),
  rz: Float64Array = new Float64Array(0),
  sre: Float64Array = new Float64Array(0),
  sim: Float64Array = new Float64Array(0);
// the receiver the image distances were taken for, and the distances (source by source, IMAGE_HITS order)
let at: [number, number, number] = [NaN, NaN, NaN],
  atSources: readonly ModalSource[] | null = null,
  dist: Float64Array = new Float64Array(0);
const grow = (a: Float64Array, n: number): Float64Array => (a.length < n ? new Float64Array(n) : a);

/** Fills the cache's sum over the z modes (and the factors that don't depend on x or y) at height `z`. */
function sumOverZ(modes: RoomModes, sources: readonly ModalSource[], ms: ModalSlot, z: number) {
  const [W, L, H] = modes.size,
    [NX, NY, NZ] = modes.n,
    kmax2 = modes.kmax * modes.kmax,
    V = W * L * H,
    k2 = ms.k * ms.k,
    { damp, u } = ms,
    ns = sources.length;
  rz = axisCos(NZ, H, z, grow(rz, NZ));
  sre = grow(sre, ns);
  sim = grow(sim, ns);
  const e = ms.cache.e;
  e.fill(0);
  for (let ix = 0; ix < NX; ix++) {
    const kx2 = ((ix * Math.PI) / W) ** 2;
    if (kx2 > kmax2) break;
    for (let iy = 0; iy < NY; iy++) {
      const kxy2 = kx2 + ((iy * Math.PI) / L) ** 2;
      if (kxy2 > kmax2) break;
      // ε for x and y, over V
      const exy = ((ix ? 2 : 1) * (iy ? 2 : 1)) / V;
      for (let s = 0; s < ns; s++) {
        const w = sources[s].cx[ix] * sources[s].cy[iy];
        sre[s] = u[2 * s] * w;
        sim[s] = u[2 * s + 1] * w;
      }
      let re = 0,
        im = 0;
      for (let iz = 0; iz < NZ; iz++) {
        const kn2 = kxy2 + ((iz * Math.PI) / H) ** 2;
        if (kn2 > kmax2) break;
        let ar = 0,
          ai = 0;
        for (let s = 0; s < ns; s++) {
          const c = sources[s].cz[iz];
          ar += sre[s] * c;
          ai += sim[s] * c;
        }
        // (ar + j·ai) / (kn² − k² + j·damp), times the normalisation and the receiver's z shape
        const dr = kn2 - k2,
          g = (exy * (iz ? 2 : 1) * rz[iz]) / (dr * dr + damp * damp);
        re += g * (ar * dr + ai * damp);
        im += g * (ai * dr - ar * damp);
      }
      e[2 * (ix * NY + iy)] = re;
      e[2 * (ix * NY + iy) + 1] = im;
    }
  }
  ms.cache.z = z;
  ms.cache.y = NaN;
}

/** The modal sum's mean-square pressure at (x, y, z) in the room (m, origin in a floor corner). */
export function modalPressure2(
  modes: RoomModes,
  sources: readonly ModalSource[],
  ms: ModalSlot,
  x: number,
  y: number,
  z: number,
): number {
  const [W, L] = modes.size,
    [NX, NY] = modes.n,
    { cache } = ms;
  if (cache.z !== z) sumOverZ(modes, sources, ms, z);
  if (cache.y !== y) {
    ry = axisCos(NY, L, y, grow(ry, NY));
    const { e, fy } = cache;
    for (let ix = 0; ix < NX; ix++) {
      let re = 0,
        im = 0;
      for (let iy = 0; iy < NY; iy++) {
        re += e[2 * (ix * NY + iy)] * ry[iy];
        im += e[2 * (ix * NY + iy) + 1] * ry[iy];
      }
      fy[2 * ix] = re;
      fy[2 * ix + 1] = im;
    }
    cache.y = y;
  }
  rx = axisCos(NX, W, x, grow(rx, NX));
  let re = 0,
    im = 0;
  for (let ix = 0; ix < NX; ix++) {
    re += cache.fy[2 * ix] * rx[ix];
    im += cache.fy[2 * ix + 1] * rx[ix];
  }
  // the direct sound and the low-order images as they really are: each term's e^(−jkR) × what it keeps, for the
  // lossy e^(−jk̃R) the sum has, over 4πR, × jωρQ. The distances are kept while the receiver stays put.
  const { kt, keep, u, k } = ms;
  const ni = IMAGE_HITS.length;
  if (x !== at[0] || y !== at[1] || z !== at[2] || sources !== atSources) {
    dist = grow(dist, ni * sources.length);
    for (let s = 0; s < sources.length; s++) {
      const p = sources[s].images;
      for (let i = 0; i < ni; i++)
        dist[s * ni + i] = Math.max(
          0.3,
          Math.hypot(x - p[3 * i], y - p[3 * i + 1], z - p[3 * i + 2]),
        );
    }
    at = [x, y, z];
    atSources = sources;
  }
  // k̃'s real part sits just above k (a − k ≈ b² / 2k): its phase is kR's turned on by a small angle
  const dk = kt.re - k;
  for (let s = 0; s < sources.length; s++) {
    const ur = u[2 * s],
      ui = u[2 * s + 1];
    if (!ur && !ui) continue;
    let tr = 0,
      ti = 0;
    for (let i = 0; i < ni; i++) {
      const R = dist[s * ni + i],
        g = keep[i],
        lossy = Math.exp(-kt.im * R),
        phi = dk * R;
      // the same term both ways: nothing to swap
      if (Math.abs(g - lossy) < 1e-3 && Math.abs(phi) < 1e-3) continue;
      const c = Math.cos(k * R),
        sn = Math.sin(k * R);
      // cos and sin of φ, by their series while φ is small
      const p2 = phi * phi,
        cp = Math.abs(phi) < 0.2 ? 1 - p2 / 2 + (p2 * p2) / 24 : Math.cos(phi),
        sp = Math.abs(phi) < 0.2 ? phi * (1 - p2 / 6 + (p2 * p2) / 120) : Math.sin(phi);
      // e^(−j(k + dk)R) = (c − j·sn)(cp − j·sp)
      const lc = c * cp - sn * sp,
        ls = sn * cp + c * sp;
      tr += (g * c - lossy * lc) / R;
      ti += (lossy * ls - g * sn) / R;
    }
    re += (ur * tr - ui * ti) / (4 * Math.PI);
    im += (ur * ti + ui * tr) / (4 * Math.PI);
  }
  return re * re + im * im;
}
