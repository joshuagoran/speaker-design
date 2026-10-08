import * as THREE from "three";
import { PARTS_3D } from "../../styles/palette";
import type { PartMesh } from "../../types";
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
  const NS = 40,
    NP = 112,
    pos: number[] = [],
    idx: number[] = [];
  for (let i = 0; i <= NS; i++) {
    const t = i / NS,
      g = Math.pow(t, 1.7);
    const a = throatRadius + (mouthWidth / 2 - throatRadius) * g,
      b = throatRadius + (mouthHeight / 2 - throatRadius) * g;
    const n = 2 + 7 * Math.pow(t, 1.4); // superellipse exponent: circle -> squarish
    for (let j = 0; j < NP; j++) {
      const th = (j / NP) * Math.PI * 2,
        c = Math.cos(th),
        sn = Math.sin(th);
      pos.push(
        a * Math.sign(c) * Math.pow(Math.abs(c), 2 / n),
        b * Math.sign(sn) * Math.pow(Math.abs(sn), 2 / n),
        depth * t,
      );
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

/** Pictogram silhouette of a person, billboarded and semi-transparent, `heightIn` inches tall (standing on y = 0). */
export function createScaleFigure(heightIn: number) {
  const u = heightIn / 100;
  const figure = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({
    color: PARTS_3D.figure,
    transparent: true,
    opacity: 0.38,
    side: THREE.DoubleSide,
  });
  const body = new THREE.Shape();
  const outline = [
    [6.5, 85],
    [10.0, 82],
    [11.0, 70],
    [8.0, 50],
    [6.5, 30],
    [5.5, 1],
    [1.0, 1],
    [0, 40],
    [-1.0, 1],
    [-5.5, 1],
    [-6.5, 30],
    [-8.0, 50],
    [-11.0, 70],
    [-10.0, 82],
    [-6.5, 85],
  ];
  body.moveTo(outline[0][0] * u, outline[0][1] * u);
  outline.slice(1).forEach(([x, y]) => body.lineTo(x * u, y * u));
  body.closePath();
  figure.add(new THREE.Mesh(new THREE.ShapeGeometry(body), material));
  const head = new THREE.Shape();
  head.absarc(0, 92.5 * u, 6 * u, 0, Math.PI * 2, false);
  figure.add(new THREE.Mesh(new THREE.ShapeGeometry(head), material));
  return figure;
}

/** Millimeters to the scene's inches. */
export const MM_IN = 1 / 25.4;

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
  const k = m.unitMm * MM_IN;
  const center =
    place === "bounds"
      ? [(m.min[0] + m.max[0]) / 2, (m.min[1] + m.max[1]) / 2, 0].map((c) => c * MM_IN)
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
  const k = m.unitMm * MM_IN;
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
