// Edge diffraction off a rectangular baffle: a simple edge-source model in the spirit of The Edge.
// Each sharp baffle edge re-radiates the driver's sound as a secondary source, inverted and delayed by the extra path
// (driver -> edge -> listener). The edge is cut into segments by equal angles seen from the driver, so each segment
// carries 1/N of the edge's total strength, -1/2: at low frequency every path is the same length and the sum is
// 1 - 1/2 = 1/2, the 6 dB baffle step. Higher up the delays differ and the sum ripples. A segment's own delay spread is
// integrated across it (linear phase -> sinc), so the far, long segments fade at high frequency as a real edge does.
// A roundover weakens an edge once the wavelength is shorter than about 4 x its radius. Pure functions, no DOM.
import type { Dims2 } from "../../types";

const C = 343,
  IN = 0.0254;

/** A point on the baffle, inches: `x` across from the centre line (+ toward the inside of the pair), `y` up from the box bottom. */
export interface BafflePoint {
  x: number;
  y: number;
}

/** A listening point in front of the baffle, inches: `x`, `y` as on the baffle, `z` out from its face. */
export interface FieldPoint extends BafflePoint {
  z: number;
}

/**
 * One edge segment as the listener hears it: its share of the edge strength scaled by spreading (`amp`, negative:
 * inverted), its extra path over the direct sound and that path's spread across the segment (m), and the direction
 * from the driver to it on the baffle (`ux`, `uy`, a unit vector), for the driver's level toward the edge.
 */
export interface EdgeSegment {
  amp: number;
  delayM: number;
  spanM: number;
  ux: number;
  uy: number;
}

/** Rays per driver: enough that segments stay short against the delays that matter (to ~5 kHz on a hi-fi box). */
export const EDGE_RAYS = 48;

// where a ray from `s` in direction (ux, uy) leaves the baffle rectangle [-w/2, w/2] x [0, h], inches
function rayExit(dim: Dims2, s: BafflePoint, ux: number, uy: number): BafflePoint {
  const tx = ux > 1e-12 ? (dim.w / 2 - s.x) / ux : ux < -1e-12 ? (-dim.w / 2 - s.x) / ux : Infinity;
  const ty = uy > 1e-12 ? (dim.h - s.y) / uy : uy < -1e-12 ? -s.y / uy : Infinity;
  const t = Math.max(0, Math.min(tx, ty));
  return { x: s.x + t * ux, y: s.y + t * uy };
}

const dist3 = (a: BafflePoint, p: FieldPoint) => Math.hypot(p.x - a.x, p.y - a.y, p.z);
const dist2 = (a: BafflePoint, b: BafflePoint) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * The edge segments of a `dim` (w x h, inches) baffle for a driver at `src`, heard at `p`. The driver is clamped onto
 * the baffle. Work this out once per listening point; `edgeRipple` then costs one complex term per segment per frequency.
 */
export function edgeSegments(
  dim: Dims2,
  src: BafflePoint,
  p: FieldPoint,
  rays = EDGE_RAYS,
): EdgeSegment[] {
  const s = {
    x: Math.max(-dim.w / 2, Math.min(dim.w / 2, src.x)),
    y: Math.max(0, Math.min(dim.h, src.y)),
  };
  const direct = dist3(s, p);
  const pathAt = (phi: number) => {
    const e = rayExit(dim, s, Math.cos(phi), Math.sin(phi));
    return dist2(s, e) + dist3(e, p) - direct;
  };
  const out: EdgeSegment[] = [];
  const dphi = (2 * Math.PI) / rays;
  for (let i = 0; i < rays; i++) {
    const phi = (i + 0.5) * dphi,
      ux = Math.cos(phi),
      uy = Math.sin(phi);
    const e = rayExit(dim, s, ux, uy);
    const toListener = dist3(e, p);
    out.push({
      amp: (-0.5 / rays) * (direct / Math.max(1e-6, toListener)),
      delayM: (dist2(s, e) + toListener - direct) * IN,
      spanM: Math.abs(pathAt(phi + dphi / 2) - pathAt(phi - dphi / 2)) * IN,
      ux,
      uy,
    });
  }
  return out;
}

/**
 * How strongly a rounded edge re-radiates at `f` Hz, against a sharp one (1): first-order roll-off above the frequency
 * whose wavelength is 4 x the radius (`radiusIn`, inches), so a 1.5″ roundover works from about 2.2 kHz up.
 */
export function roundoverEdgeFactor(f: number, radiusIn: number) {
  if (!(radiusIn > 0)) return 1;
  const fr = C / (4 * radiusIn * IN);
  return 1 / Math.sqrt(1 + (f / fr) ** 2);
}

/** The frequency a roundover of `radiusIn` inches starts to work at: wavelength = 4 x radius. Infinity for a sharp edge. */
export const roundoverOnsetHz = (radiusIn: number) =>
  radiusIn > 0 ? C / (4 * radiusIn * IN) : Infinity;

const sinc = (x: number) => (Math.abs(x) < 1e-6 ? 1 : Math.sin(x) / x);

/**
 * The edge diffraction ripple at `f` Hz: the direct sound plus every edge's, over the same sum with each edge's delay
 * smoothed into a first-order lag (1 / (1 + jkΔ)), [re, im]. The smoothed sum is the baffle step's own trend (it has
 * the 6 dB step's shape, with no ripple), so the ratio is 1 at low frequency, 1 on average high up, and holds only the
 * ripple: the baffle step itself stays with `baffleStepGain`. `towardEdge(ux, uy)` is the driver's level (0-1) toward
 * the baffle edge in that direction, 90° off its axis; `radiusIn` the roundover radius, inches.
 */
export function edgeRipple(
  segs: readonly EdgeSegment[],
  f: number,
  radiusIn: number,
  towardEdge: (ux: number, uy: number) => number,
): [re: number, im: number] {
  const k = (2 * Math.PI * f) / C,
    g = roundoverEdgeFactor(f, radiusIn);
  let re = 1,
    im = 0,
    sre = 1,
    sim = 0;
  for (const s of segs) {
    const a = s.amp * g * towardEdge(s.ux, s.uy),
      x = k * s.delayM,
      b = a * sinc((k * s.spanM) / 2);
    re += b * Math.cos(x);
    im -= b * Math.sin(x);
    // a / (1 + jx)
    const d = 1 + x * x;
    sre += a / d;
    sim -= (a * x) / d;
  }
  const d = sre * sre + sim * sim;
  return [(re * sre + im * sim) / d, (im * sre - re * sim) / d];
}

/** Half the peak-to-peak spread of a dB curve between `lo` and `hi` Hz: the ±dB ripple. */
export function rippleDb(curve: readonly { f: number; spl: number }[], lo: number, hi: number) {
  const band = curve.filter((o) => o.f >= lo && o.f <= hi).map((o) => o.spl);
  return band.length ? (Math.max(...band) - Math.min(...band)) / 2 : 0;
}
