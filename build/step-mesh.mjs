// Shared by the scripts that turn a part's STEP model into the compact mesh the 3D view draws (build/handle-mesh.mjs,
// build/horn-mesh.mjs). occt-import-js (OpenCascade compiled to wasm, a dev dependency) meshes each face of the model
// to a linear and an angular deflection; the vertices are then welded on a grid, which drops the duplicate vertices
// along the face seams and collapses slivers, and stored as integers of that grid. The STEP files stay out of the repo:
// the page and the tests only ever read the generated meshes, so neither needs the STEP file or CAD tooling.
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/**
 * Tessellates a STEP file (mm) and welds its vertices on a `quantMm` grid. With `creaseDeg`, a vertex is then split
 * along the edges where the faces on either side meet at more than that angle, so a smooth-shaded view keeps those
 * edges crisp and shades everything else smooth (see splitCreases). Returns the grid positions (three integers per
 * vertex), the triangles (three vertex indices each), how many triangles occt made and the bounds, mm.
 */
export async function tessellateStep(
  path,
  { linearDeflectionMm, angularDeflection, quantMm, creaseDeg = null },
) {
  const occt = await require("occt-import-js")();
  const res = occt.ReadStepFile(new Uint8Array(fs.readFileSync(path)), {
    linearUnit: "millimeter",
    linearDeflectionType: "absolute_value",
    linearDeflection: linearDeflectionMm,
    angularDeflection,
  });
  if (!res.success || !res.meshes.length) throw new Error(`${path} didn't read`);

  // weld every mesh's vertices on the grid, drop the triangles that collapse
  const key = new Map();
  let pos = [];
  let idx = [];
  let inTris = 0;
  for (const m of res.meshes) {
    const p = m.attributes.position.array;
    const ids = [];
    for (let i = 0; i < p.length; i += 3) {
      const q = [p[i], p[i + 1], p[i + 2]].map((v) => Math.round(v / quantMm));
      const k = q.join();
      let id = key.get(k);
      if (id === undefined) {
        id = pos.length / 3;
        key.set(k, id);
        pos.push(...q);
      }
      ids.push(id);
    }
    const ix = m.index.array;
    inTris += ix.length / 3;
    for (let i = 0; i < ix.length; i += 3) {
      const [a, b, c] = [ids[ix[i]], ids[ix[i + 1]], ids[ix[i + 2]]];
      if (a !== b && b !== c && a !== c) idx.push(a, b, c);
    }
  }
  if (creaseDeg !== null) ({ pos, idx } = splitCreases(pos, idx, creaseDeg));
  const lo = [0, 1, 2].map((k) => Math.min(...pos.filter((_, i) => i % 3 === k)) * quantMm);
  const hi = [0, 1, 2].map((k) => Math.max(...pos.filter((_, i) => i % 3 === k)) * quantMm);
  return { meshCount: res.meshes.length, pos, idx, inTris, lo, hi };
}

/**
 * Splits the vertices of a welded mesh along its sharp edges. Round each vertex, the triangles that meet it join one
 * group when they share an edge through it and their normals differ by at most `creaseDeg`; the first group keeps the
 * vertex and every other group gets its own copy. Smooth normals averaged per vertex then stay smooth across a curved
 * surface (and across the seams between its B-rep faces) and turn sharply at a flange's edges.
 */
export function splitCreases(pos, idx, creaseDeg) {
  const cosCrease = Math.cos((creaseDeg * Math.PI) / 180);
  const nTri = idx.length / 3;
  const normal = [];
  for (let t = 0; t < nTri; t++) {
    const [a, b, c] = [0, 1, 2].map((k) => {
      const v = idx[3 * t + k];
      return [pos[3 * v], pos[3 * v + 1], pos[3 * v + 2]];
    });
    const u = [0, 1, 2].map((k) => b[k] - a[k]);
    const w = [0, 1, 2].map((k) => c[k] - a[k]);
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const len = Math.hypot(...n) || 1;
    normal.push(n.map((x) => x / len));
  }
  // the triangles on each edge
  const edges = new Map();
  for (let t = 0; t < nTri; t++)
    for (let k = 0; k < 3; k++) {
      const [a, b] = [idx[3 * t + k], idx[3 * t + ((k + 1) % 3)]];
      const e = a < b ? `${a},${b}` : `${b},${a}`;
      edges.set(e, [...(edges.get(e) ?? []), t]);
    }
  // union-find over (vertex, triangle) corners: join the two triangles on a smooth edge at both of its ends
  const parent = new Map();
  const find = (c) => {
    while (parent.has(c) && parent.get(c) !== c) c = parent.get(c);
    return c;
  };
  const join = (c, d) => {
    const [rc, rd] = [find(c), find(d)];
    if (rc !== rd) parent.set(rd, rc);
  };
  for (const [e, tris] of edges) {
    if (tris.length !== 2) continue;
    const [s, t] = tris;
    const cos = normal[s].reduce((sum, x, k) => sum + x * normal[t][k], 0);
    if (cos < cosCrease) continue;
    for (const v of e.split(",")) join(`${v}:${s}`, `${v}:${t}`);
  }
  // each vertex's first group keeps it; every other group takes a copy
  const out = [...pos];
  const copies = new Map();
  const outIdx = idx.map((v, i) => {
    const group = find(`${v}:${Math.floor(i / 3)}`);
    const seen = copies.get(v) ?? new Map();
    copies.set(v, seen);
    let id = seen.get(group);
    if (id === undefined) {
      id = seen.size ? out.length / 3 : v;
      if (seen.size) out.push(pos[3 * v], pos[3 * v + 1], pos[3 * v + 2]);
      seen.set(group, id);
    }
    return id;
  });
  return { pos: out, idx: outIdx };
}

/** A number array as source lines, 24 numbers to a line. */
export function sourceRows(a) {
  const out = [];
  for (let i = 0; i < a.length; i += 24) out.push(`    ${a.slice(i, i + 24).join(",")},`);
  return out.join("\n");
}

/** Writes a generated source file, making its folder when needed. */
export function writeSource(url, src) {
  fs.mkdirSync(new URL(".", url), { recursive: true });
  fs.writeFileSync(url, src);
}
