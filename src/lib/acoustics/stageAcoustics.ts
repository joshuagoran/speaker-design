// Stages and risers in the coverage model (lib/acoustics/coverage sums them): what their faces and tops reflect, and
// how much a stage between a source and a listening point takes off its path. Meters: x across from the center line,
// y down the room, z up from the floor.
//
// Reflections: each vertical face of an outline (from the stage's base to its top) and each top is a short wall of the
// stage's material (STAGE_MATERIAL). A face small against the wavelength reflects less: a first-order high-pass in
// pressure, (f/fc)/√(1 + (f/fc)²), with fc = c / (2 × the face's smaller side). A reflection fades out across the
// face's ends and its top edge (a top: across its outline) over the first Fresnel zone there (`edgeFade`), so it
// doesn't stop where its reflection point leaves the surface.
//
// Blocking: a single-edge barrier over the stage's top (Maekawa's curve in the Kurze–Anderson form) on the Fresnel number
// N = 2δ/λ, δ the path's detour over the top in the path's vertical plane. That curve is for a thin screen: it keeps
// about 5 dB at grazing at every frequency. A stage is a low block on the floor, which the low end bends around once it
// is small against the wavelength, so its loss in dB fades by the same high-pass, squared, on the stage's top above the
// floor. Approximations: diffraction around a stage's sides is left out; a thick top's two edges make one rubber band
// (the shortest path over it, Maekawa's δ for a thick barrier); where several stages, or several legs of one path, are
// in the way, the longest detour counts alone.
import { SPEED_OF_SOUND } from "../../constants/acoustics";
import type { SceneDriver } from "./coverage";

/** A stage or riser as the scene takes it: its outline on the floor, and its base and top above the floor, m. */
export interface SceneStage {
  corners: readonly Pick<SceneDriver, "x" | "y">[];
  base: number;
  top: number;
}

/** A stage as the barrier test reads it: its outline's corners (collinear runs merged), its plan's bounds, its top. */
export interface StageBlock extends Pick<SceneStage, "top"> {
  xs: number[];
  ys: number[];
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** A vertical face's line on the plan: its first corner, the unit vector along it and its length, its outward normal. */
export interface FaceLine {
  ax: number;
  ay: number;
  ux: number;
  uy: number;
  len: number;
  nx: number;
  ny: number;
}

/** A stage surface that reflects: a vertical face of its outline, or its top (`face` null). */
export interface StageReflector extends Pick<SceneStage, "base" | "top"> {
  /** the stage it belongs to, by its index in the scene's stages */
  stage: number;
  face: FaceLine | null;
  /** its smaller side, m: its reflection fades below c / (2 × size) */
  size: number;
}

/** Nearer than this is the same, m. */
const EPS = 1e-6;
/** The barrier's loss at grazing (N = 0), dB. */
export const BARRIER_GRAZING_DB = 5;
/** The most a stage takes off a path, dB. */
export const BARRIER_CAP_DB = 20;
/** On the bright side the loss has faded to 0 by this Fresnel number. */
export const BARRIER_BRIGHT_N = -0.2;

/**
 * A single-edge barrier's loss at Fresnel number `n` (N = 2δ/λ, negative on the bright side), dB: Kurze–Anderson,
 * 5 + 20·log10(x / tanh x) in the shadow and 5 + 20·log10(x / tan x) on the bright side, x = √(2π|N|); 0 from
 * `BARRIER_BRIGHT_N` down, never past `BARRIER_CAP_DB`.
 */
export function barrierLossDb(n: number): number {
  if (n <= BARRIER_BRIGHT_N) return 0;
  const x = Math.sqrt(2 * Math.PI * Math.abs(n));
  if (x < EPS) return BARRIER_GRAZING_DB;
  const ratio = n > 0 ? x / Math.tanh(x) : x / Math.tan(x);
  return Math.min(BARRIER_CAP_DB, Math.max(0, BARRIER_GRAZING_DB + 20 * Math.log10(ratio)));
}

/**
 * What a surface `sizeM` across keeps at `f` against a large one (pressure): a first-order high-pass at
 * c / (2 × size).
 */
export function sizeFade(f: number, sizeM: number): number {
  const x = (2 * f * sizeM) / SPEED_OF_SOUND;
  return x / Math.hypot(1, x);
}

/**
 * The first Fresnel zone's radius at a reflection point `d1` from the source and `d2` from the listener, at wavelength
 * `lambda`, m: √(λ·d₁d₂/(d₁ + d₂)).
 */
export const fresnelRadius = (lambda: number, d1: number, d2: number) =>
  Math.sqrt((lambda * d1 * d2) / (d1 + d2));

/**
 * How much of a reflection a surface's edge keeps (pressure), by how far inside the edge its reflection point lies
 * (`insideM`, negative outside) against the first Fresnel zone's radius there (`zoneM`): a raised-cosine ramp from 0
 * one radius outside to 1 one radius inside, ½ on the edge. It stands in for the knife edge's Fresnel-integral
 * amplitude, which it follows near the edge, without that curve's ripples and long tail.
 */
export function edgeFade(insideM: number, zoneM: number): number {
  if (insideM >= zoneM) return 1;
  if (insideM <= -zoneM) return 0;
  return 0.5 + 0.5 * Math.sin((Math.PI / 2) * (insideM / zoneM));
}

/** An outline without its repeated corners and the corners in the middle of a straight run. */
function mergedOutline(corners: SceneStage["corners"]): SceneStage["corners"] {
  const pts = corners.filter((p, i) => {
    const q = corners[(i + 1) % corners.length];
    return Math.hypot(q.x - p.x, q.y - p.y) > EPS;
  });
  return pts.filter((p, i) => {
    const a = pts[(i + pts.length - 1) % pts.length],
      b = pts[(i + 1) % pts.length];
    const cross = (p.x - a.x) * (b.y - p.y) - (p.y - a.y) * (b.x - p.x);
    return Math.abs(cross) > EPS * Math.hypot(b.x - a.x, b.y - a.y);
  });
}

/** The stages as the scene sums them: each as a block for the barrier, and each face and top that reflects. */
export function stageGeometry(stages: readonly SceneStage[]): {
  blocks: StageBlock[];
  reflectors: StageReflector[];
} {
  const blocks: StageBlock[] = [],
    reflectors: StageReflector[] = [];
  for (const [stage, s] of stages.entries()) {
    const pts = mergedOutline(s.corners);
    const xs = pts.map((p) => p.x),
      ys = pts.map((p) => p.y);
    const block = {
      xs,
      ys,
      x0: Math.min(...xs),
      x1: Math.max(...xs),
      y0: Math.min(...ys),
      y1: Math.max(...ys),
      top: s.top,
    };
    blocks.push(block);
    if (pts.length < 3) continue;
    // the outline's turn (its signed area): the outward normal is on its right going round counterclockwise
    const turn = Math.sign(
      pts.reduce((a, p, i) => {
        const q = pts[(i + 1) % pts.length];
        return a + p.x * q.y - q.x * p.y;
      }, 0),
    );
    const height = s.top - s.base;
    for (const [i, a] of pts.entries()) {
      const b = pts[(i + 1) % pts.length];
      const len = Math.hypot(b.x - a.x, b.y - a.y),
        ux = (b.x - a.x) / len,
        uy = (b.y - a.y) / len;
      reflectors.push({
        stage,
        face: { ax: a.x, ay: a.y, ux, uy, len, nx: turn * uy, ny: -turn * ux },
        base: s.base,
        top: s.top,
        size: Math.min(len, height),
      });
    }
    reflectors.push({
      stage,
      face: null,
      base: s.base,
      top: s.top,
      size: Math.min(block.x1 - block.x0, block.y1 - block.y0),
    });
  }
  return { blocks, reflectors };
}

/** A point's height over a face's plan line (+ on the face's outer side), m. */
export const faceSide = (f: FaceLine, x: number, y: number) =>
  (x - f.ax) * f.nx + (y - f.ay) * f.ny;

/** How far a point lies inside a block's outline, m (negative outside): its distance from the nearest edge. */
export function outlineDepth(b: StageBlock, x: number, y: number): number {
  const { xs, ys } = b;
  let near = Infinity;
  for (let i = 0, j = xs.length - 1; i < xs.length; j = i++) {
    const ex = xs[i] - xs[j],
      ey = ys[i] - ys[j],
      t = Math.min(
        1,
        Math.max(0, ((x - xs[j]) * ex + (y - ys[j]) * ey) / (ex * ex + ey * ey || 1)),
      );
    near = Math.min(near, Math.hypot(x - xs[j] - t * ex, y - ys[j] - t * ey));
  }
  return insideBlock(b, x, y) ? near : -near;
}

/** Whether a point lies inside a block's outline (even–odd). */
export function insideBlock(b: StageBlock, x: number, y: number): boolean {
  const { xs, ys } = b;
  let hit = false;
  for (let i = 0, j = xs.length - 1; i < xs.length; j = i++)
    if (ys[j] > y !== ys[i] > y && x < ((xs[i] - xs[j]) * (y - ys[j])) / (ys[i] - ys[j]) + xs[j])
      hit = !hit;
  return hit;
}

/** The longest detour found so far over the stages, m (−Infinity: no stage near), and that stage (−1: none). */
export interface Detour {
  delta: number;
  stage: number;
}

/**
 * Raises `best` to the line from a to b's detour over each block (but `skip`) whose plan it runs over, if that is
 * longer: the extra path over the top's edges in the line's vertical plane (negative on the bright side: how far the
 * nearest edge sits under the line). Only the line's part above the floor counts. An end standing over a block (inside
 * its outline, at or above its top) has no edge there: a box on a stage isn't blocked by the top it stands on.
 */
export function lineDetour(
  blocks: readonly StageBlock[],
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  skip: number,
  best: Detour,
): void {
  if (az < 0 && bz < 0) return;
  if (az < 0) {
    const t = az / (az - bz);
    ax += (bx - ax) * t;
    ay += (by - ay) * t;
    az = 0;
  } else if (bz < 0) {
    const t = bz / (bz - az);
    bx += (ax - bx) * t;
    by += (ay - by) * t;
    bz = 0;
  }
  const dx = bx - ax,
    dy = by - ay,
    D = Math.hypot(dx, dy);
  if (D < EPS) return;
  const lx0 = Math.min(ax, bx),
    lx1 = Math.max(ax, bx),
    ly0 = Math.min(ay, by),
    ly1 = Math.max(ay, by);
  for (let s = 0; s < blocks.length; s++) {
    const b = blocks[s];
    if (s === skip || lx1 < b.x0 || lx0 > b.x1 || ly1 < b.y0 || ly0 > b.y1) continue;
    // where the line's plan runs over the outline: from its first entry t1 to its last exit t2 (0 to 1 along it)
    const { xs, ys, top } = b;
    let t1 = 2,
      t2 = -1;
    for (let i = 0, j = xs.length - 1; i < xs.length; j = i++) {
      const ex = xs[i] - xs[j],
        ey = ys[i] - ys[j],
        den = dx * ey - dy * ex;
      if (!den) continue;
      const wx = xs[j] - ax,
        wy = ys[j] - ay,
        t = (wx * ey - wy * ex) / den,
        u = (wx * dy - wy * dx) / den;
      if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
        t1 = Math.min(t1, t);
        t2 = Math.max(t2, t);
      }
    }
    const inA = insideBlock(b, ax, ay),
      inB = insideBlock(b, bx, by);
    if (inA) t1 = 0;
    if (inB) t2 = 1;
    if (t2 < t1) continue;
    const edge1 = !(inA && az >= top),
      edge2 = !(inB && bz >= top);
    if (!edge1 && !edge2) continue;
    const rise = bz - az,
      x1 = t1 * D,
      x2 = t2 * D,
      L = Math.hypot(D, rise),
      // a to each edge and on to b, in the vertical plane
      a1 = Math.hypot(x1, top - az),
      b1 = Math.hypot(D - x1, bz - top),
      a2 = Math.hypot(x2, top - az),
      b2 = Math.hypot(D - x2, bz - top);
    const under1 = edge1 && az + rise * t1 < top,
      under2 = edge2 && az + rise * t2 < top;
    let delta: number;
    if (!under1 && !under2)
      delta = Math.max(edge1 ? L - a1 - b1 : -Infinity, edge2 ? L - a2 - b2 : -Infinity);
    // blocked: over the far edge alone when a is over the top, the near one when b is, else over both
    else if (!edge1 || (edge2 && az >= top)) delta = a2 + b2 - L;
    else if (!edge2 || bz >= top) delta = a1 + b1 - L;
    else delta = a1 + (x2 - x1) + b2 - L;
    if (delta > best.delta) {
      best.delta = delta;
      best.stage = s;
    }
  }
}
