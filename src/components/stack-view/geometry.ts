import * as THREE from "three";
import type { Dims2, PartMesh } from "../../types";
import { IN_PER_MM } from "../../constants/units";
/** Rounded rectangle outline centered on the origin, as a THREE.Shape. */
export function roundedRectShape(width: number, height: number, radius: number) {
  const x = width / 2,
    y = height / 2,
    shape = new THREE.Shape();
  const r = radius;
  shape.moveTo(-x + r, -y);
  shape.lineTo(x - r, -y);
  shape.quadraticCurveTo(x, -y, x, -y + r);
  shape.lineTo(x, y - r);
  shape.quadraticCurveTo(x, y, x - r, y);
  shape.lineTo(-x + r, y);
  shape.quadraticCurveTo(-x, y, -x, y - r);
  shape.lineTo(-x, -y + r);
  shape.quadraticCurveTo(-x, -y, -x + r, -y);
  return shape;
}

/** Rounded rectangle hole outline centered on (centerX, centerY), as a THREE.Path. */
export function roundedRectPath(
  centerX: number,
  centerY: number,
  width: number,
  height: number,
  radius: number,
) {
  const x = width / 2,
    y = height / 2,
    cx = centerX,
    cy = centerY,
    r = radius,
    path = new THREE.Path();
  path.moveTo(cx - x + r, cy - y);
  path.lineTo(cx + x - r, cy - y);
  path.quadraticCurveTo(cx + x, cy - y, cx + x, cy - y + r);
  path.lineTo(cx + x, cy + y - r);
  path.quadraticCurveTo(cx + x, cy + y, cx + x - r, cy + y);
  path.lineTo(cx - x + r, cy + y);
  path.quadraticCurveTo(cx - x, cy + y, cx - x, cy + y - r);
  path.lineTo(cx - x, cy - y + r);
  path.quadraticCurveTo(cx - x, cy - y, cx - x + r, cy - y);
  return path;
}

/** Circular hole outline centered on (centerX, centerY), as a THREE.Path. */
export function circlePath(centerX: number, centerY: number, radius: number) {
  const path = new THREE.Path();
  path.absarc(centerX, centerY, radius, 0, Math.PI * 2, true);
  return path;
}

/**
 * Adds an arch-topped outline to a THREE.Shape (or Path): flat bottom at `bottomY`, straight sides up to
 * `archCenterY`, then a semicircle of `radius` across the top.
 */
export function archOutlinePath<P extends THREE.Path>(
  shape: P,
  halfWidth: number,
  bottomY: number,
  archCenterY: number,
  radius: number,
) {
  shape.moveTo(-halfWidth, bottomY);
  shape.lineTo(halfWidth, bottomY);
  shape.lineTo(halfWidth, archCenterY);
  shape.absarc(0, archCenterY, radius, 0, Math.PI, false);
  shape.lineTo(-halfWidth, bottomY);
  return shape;
}

/**
 * Rectangular horn flare as a mesh geometry: a circular throat of `throatRadius` growing along z over
 * `depth` into a superellipse that squares up toward a `mouthWidth` by `mouthHeight` mouth.
 */
export function rectangularHornGeometry(
  mouthWidth: number,
  mouthHeight: number,
  depth: number,
  throatRadius = 0.5,
) {
  return flareGeometry({
    throat: { w: 2 * throatRadius, h: 2 * throatRadius },
    mouth: { w: mouthWidth, h: mouthHeight },
    depth,
    squareness: (t) => 2 + 7 * Math.pow(t, 1.4), // circle -> squarish
  });
}

/** How many points go round each of a flare's sections (and its mouth's outline, `flareMouthPath`). */
const FLARE_SECTION_POINTS = 112;

/** The `j`th of a flare section's points: on the superellipse of half axes `a`, `b` and exponent `n`. */
function superellipsePoint(a: number, b: number, n: number, j: number) {
  const th = (j / FLARE_SECTION_POINTS) * Math.PI * 2,
    c = Math.cos(th),
    sn = Math.sin(th);
  return [
    a * Math.sign(c) * Math.pow(Math.abs(c), 2 / n),
    b * Math.sign(sn) * Math.pow(Math.abs(sn), 2 / n),
  ] as const;
}

/**
 * A flare's mouth outline as a hole centered on (centerX, centerY): the same points as `flareGeometry`'s last section
 * for that `mouth` and mouth `squareness`, so a plate cut with it meets the flare with no gap.
 */
export function flareMouthPath(centerX: number, centerY: number, mouth: Dims2, squareness: number) {
  const p = new THREE.Path();
  for (let j = 0; j < FLARE_SECTION_POINTS; j++) {
    const [px, py] = superellipsePoint(mouth.w / 2, mouth.h / 2, squareness, j);
    if (j === 0) p.moveTo(centerX + px, centerY + py);
    else p.lineTo(centerX + px, centerY + py);
  }
  p.closePath();
  return p;
}

/**
 * A flare as a mesh geometry, open at both ends: superellipse sections growing along z over `depth` from the `throat`
 * (at z = 0) to the `mouth` (at z = depth), widening fastest toward the mouth; `squareness(t)` is the sections'
 * exponent from throat (t = 0) to mouth (t = 1): 2 a circle or ellipse, higher a squarer rectangle.
 */
export function flareGeometry({
  throat,
  mouth,
  depth,
  squareness,
}: {
  throat: Dims2;
  mouth: Dims2;
  depth: number;
  squareness: (t: number) => number;
}) {
  const NS = 40,
    NP = FLARE_SECTION_POINTS,
    pos: number[] = [],
    idx: number[] = [];
  for (let i = 0; i <= NS; i++) {
    const t = i / NS,
      g = Math.pow(t, 1.7);
    const a = throat.w / 2 + (mouth.w / 2 - throat.w / 2) * g,
      b = throat.h / 2 + (mouth.h / 2 - throat.h / 2) * g;
    const n = squareness(t);
    for (let j = 0; j < NP; j++) {
      const [px, py] = superellipsePoint(a, b, n, j);
      pos.push(px, py, depth * t);
    }
  }
  for (let i = 0; i < NS; i++)
    for (let j = 0; j < NP; j++) {
      const a0 = i * NP + j,
        a1 = i * NP + ((j + 1) % NP);
      idx.push(a0, a0 + NP, a1, a1, a0 + NP, a1 + NP);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/**
 * How a part's mesh is drawn (partMeshGeometry). Shading flat: every triangle its own vertices, so a part's edges and
 * corners stay crisp; smooth: the vertices shared, so a curved face shades smooth (a mesh split at its sharp edges,
 * as build/horn-mesh.mjs writes them, still keeps those edges crisp). Placed by its bounds: centered on the origin in
 * x and y (a handle's flange); by its origin: the model's own origin at the origin (a horn's axis).
 */
export interface PartMeshDrawing {
  shading: "flat" | "smooth";
  place: "bounds" | "origin";
}
// each mesh's geometry built once per drawing
const PART_MESH_GEOMETRY = new Map<PartMesh, Map<string, THREE.BufferGeometry>>();
/** A part's CAD mesh (data/meshes) as geometry, in inches on the model's axes, the model's z = 0 at z = 0. */
export function partMeshGeometry(m: PartMesh, { shading, place }: PartMeshDrawing) {
  const built = PART_MESH_GEOMETRY.get(m) ?? new Map<string, THREE.BufferGeometry>();
  PART_MESH_GEOMETRY.set(m, built);
  const key = `${shading} ${place}`;
  const hit = built.get(key);
  if (hit) return hit;
  const k = m.unitMm * IN_PER_MM;
  const center =
    place === "bounds"
      ? [(m.min[0] + m.max[0]) / 2, (m.min[1] + m.max[1]) / 2, 0].map((c) => c * IN_PER_MM)
      : [0, 0, 0];
  const at = (v: number, axis: number) => m.positions[3 * v + axis] * k - center[axis];
  const g = new THREE.BufferGeometry();
  // smooth: one vertex per position and the triangles as indices; flat: three vertices per triangle
  const corners = shading === "smooth" ? m.positions.length / 3 : m.indices.length;
  const vertex = (i: number) => (shading === "smooth" ? i : m.indices[i]);
  const pos = new Float32Array(corners * 3);
  for (let i = 0; i < corners; i++)
    for (let axis = 0; axis < 3; axis++) pos[3 * i + axis] = at(vertex(i), axis);
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  if (shading === "smooth") g.setIndex([...m.indices]);
  g.computeVertexNormals();
  built.set(key, g);
  return g;
}

// each horn mesh's silhouette built once
const SILHOUETTES = new Map<PartMesh, THREE.Vector2[]>();
/** How many directions round the axis a silhouette samples. */
const SILHOUETTE_RAYS = 180;
/**
 * A horn mesh's outline seen from the front, in inches round the model's origin (its axis): along each of
 * SILHOUETTE_RAYS directions, the farthest the mesh's triangles reach from the axis (the outside of the mouth's rim,
 * or of a rolled-back lip, or of a wall that stands proud of the rim). The outline of the hole the horn fits through:
 * no part of the horn reaches outside it (between the sampled directions, up to the chord's sag). It is star-shaped
 * from the axis, so where the horn's real outline dents in at a place the axis can't see, the polygon spans the dent,
 * and the points in it are not in front of the horn. The DIY horns' outlines are convex, so they have no such dents.
 * Counterclockwise.
 */
export function partMeshSilhouette(m: PartMesh): THREE.Vector2[] {
  const hit = SILHOUETTES.get(m);
  if (hit) return hit;
  const k = m.unitMm * IN_PER_MM;
  const out: THREE.Vector2[] = [];
  for (let i = 0; i < SILHOUETTE_RAYS; i++) {
    const a = (2 * Math.PI * i) / SILHOUETTE_RAYS;
    const [dx, dy] = [Math.cos(a), Math.sin(a)];
    let far = 0;
    // the ray t (dx, dy) against each triangle edge p + s (q - p) in the xy plane
    for (let t = 0; t < m.indices.length; t += 3)
      for (let e = 0; e < 3; e++) {
        const [p, q] = [m.indices[t + e], m.indices[t + ((e + 1) % 3)]];
        const [px, py] = [m.positions[3 * p] * k, m.positions[3 * p + 1] * k];
        const [ex, ey] = [m.positions[3 * q] * k - px, m.positions[3 * q + 1] * k - py];
        const den = dx * ey - dy * ex;
        if (Math.abs(den) < 1e-12) continue;
        const s = (px * dy - py * dx) / den;
        const along = (px * ey - py * ex) / den;
        if (s >= 0 && s <= 1 && along > far) far = along;
      }
    out.push(new THREE.Vector2(dx * far, dy * far));
  }
  SILHOUETTES.set(m, out);
  return out;
}

/** A closed polygon through `points`, offset to (centerX, centerY), as a THREE.Path. */
export function polygonPath(centerX: number, centerY: number, points: readonly THREE.Vector2[]) {
  const path = new THREE.Path();
  points.forEach((p, i) =>
    i ? path.lineTo(centerX + p.x, centerY + p.y) : path.moveTo(centerX + p.x, centerY + p.y),
  );
  path.closePath();
  return path;
}

/** A rectangle across a duct: its center, where along z it is, and its size, inches. */
export interface DuctSection {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
}

/**
 * A duct as flat panels, open at both ends: four planar sides from each rectangle to the next, each panel with its own
 * vertices so the edges stay sharp (a conical horn segment's walls are straight; a kink shows where two segments meet).
 */
export function ductGeometry(sections: readonly DuctSection[]) {
  /** a rectangle's corners, counterclockwise from its lower left */
  const corners = ({ x, y, z, w, h }: DuctSection) =>
    [
      [x - w / 2, y - h / 2, z],
      [x + w / 2, y - h / 2, z],
      [x + w / 2, y + h / 2, z],
      [x - w / 2, y + h / 2, z],
    ] as const;
  const pos: number[] = [];
  for (let i = 0; i + 1 < sections.length; i++) {
    const a = corners(sections[i]),
      b = corners(sections[i + 1]);
    for (let k = 0; k < 4; k++) {
      const next = (k + 1) % 4;
      // one panel: two triangles
      for (const p of [a[k], a[next], b[next], a[k], b[next], b[k]]) pos.push(...p);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}
