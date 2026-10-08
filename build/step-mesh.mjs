// Shared by the scripts that turn a part's STEP model into the compact mesh the 3D view draws (build/handle-mesh.mjs,
// build/horn-mesh.mjs). occt-import-js (OpenCascade compiled to wasm, a dev dependency) meshes each face of the model
// to a linear and an angular deflection; the vertices are then welded on a grid, which drops the duplicate vertices
// along the face seams and collapses slivers, and stored as integers of that grid. The STEP files stay out of the repo:
// the page and the tests only ever read the generated meshes, so neither needs the STEP file or CAD tooling.
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/**
 * Tessellates a STEP file (mm) and welds its vertices on a `quantMm` grid. `perFace` welds each B-rep face on its own,
 * so the vertices along a face's edges stay apart and a smooth-shaded view keeps the edges between faces crisp;
 * otherwise every vertex on the same grid point is one. Returns the grid positions (three integers
 * per vertex), the triangles (three vertex indices each), how many triangles occt made and the bounds, mm.
 */
export async function tessellateStep(
  path,
  { linearDeflectionMm, angularDeflection, quantMm, perFace = false },
) {
  const occt = await require("occt-import-js")();
  const res = occt.ReadStepFile(new Uint8Array(fs.readFileSync(path)), {
    linearUnit: "millimeter",
    linearDeflectionType: "absolute_value",
    linearDeflection: linearDeflectionMm,
    angularDeflection,
  });
  if (!res.success || !res.meshes.length) throw new Error(`${path} didn't read`);

  const pos = [];
  const idx = [];
  let inTris = 0;
  let key = new Map();
  for (const m of res.meshes) {
    const p = m.attributes.position.array;
    const ix = m.index.array;
    inTris += ix.length / 3;
    const weld = (v) => {
      const q = [0, 1, 2].map((k) => Math.round(p[3 * v + k] / quantMm));
      const k = q.join();
      let id = key.get(k);
      if (id === undefined) {
        id = pos.length / 3;
        key.set(k, id);
        pos.push(...q);
      }
      return id;
    };
    // welded together: every vertex in the mesh's order, the triangles after
    if (!perFace) for (let v = 0; v < p.length / 3; v++) weld(v);
    // each B-rep face's triangle range, or the whole mesh as one
    const groups =
      perFace && m.brep_faces?.length ? m.brep_faces : [{ first: 0, last: ix.length / 3 - 1 }];
    for (const { first, last } of groups) {
      if (perFace) key = new Map();
      for (let t = first; t <= last; t++) {
        const [a, b, c] = [weld(ix[3 * t]), weld(ix[3 * t + 1]), weld(ix[3 * t + 2])];
        if (a !== b && b !== c && a !== c) idx.push(a, b, c);
      }
    }
  }
  const lo = [0, 1, 2].map((k) => Math.min(...pos.filter((_, i) => i % 3 === k)) * quantMm);
  const hi = [0, 1, 2].map((k) => Math.max(...pos.filter((_, i) => i % 3 === k)) * quantMm);
  return { meshCount: res.meshes.length, pos, idx, inTris, lo, hi };
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
