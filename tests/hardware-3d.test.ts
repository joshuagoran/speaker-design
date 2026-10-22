// The hardware in the 3D view: the H1105 drawn from its STEP model, the size and way around the catalog mounts it, and
// no part (flange, recess, grip, jack, post) floating off the cabinet it is fitted to.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { H1105_MESH } from "../src/data/meshes/h1105";
import { HARDWARE_MESHES } from "../src/data/meshes";
import { HANDLES } from "../src/data/catalog/cabinet-hardware";
import { mountedFlange } from "../src/lib/build/hardware";
import { IN_PER_MM } from "../src/constants/units";
test("the committed H1105 mesh matches the catalog: flange 220 × 162 × 5 mm, recess to its depth, within the weld grid", () => {
  const [w, h, z0, z1] = [
    H1105_MESH.max[0] - H1105_MESH.min[0],
    H1105_MESH.max[1] - H1105_MESH.min[1],
    H1105_MESH.min[2],
    H1105_MESH.max[2],
  ];
  assert.ok(Math.abs(w - 162) <= 1 && Math.abs(h - 220) <= 1, `${w} × ${h} mm`);
  assert.ok(Math.abs(z0 + 58) <= 0.5 && Math.abs(z1 - 5) <= 0.5, `z ${z0} .. ${z1}`);
  assert.equal(H1105_MESH.indices.length % 3, 0);
  assert.ok(H1105_MESH.indices.every((i) => i >= 0 && i < H1105_MESH.positions.length / 3));
  // the catalog's flange is the same part: 220 × 162 mm on Parts Express's drawing
  const part = HANDLES.find((p) => p.id === "H1105");
  assert.ok(part && HARDWARE_MESHES[part.id] === H1105_MESH);
  const f = mountedFlange(part);
  assert.ok(f);
  assert.ok(Math.abs(f.up - h * IN_PER_MM) < 0.05 && Math.abs(f.across - w * IN_PER_MM) < 0.05);
  // and its recess reaches the catalog's depth from the panel's face (z = 0)
  assert.ok(part.depthIn && Math.abs(-z0 * IN_PER_MM - part.depthIn) < 0.05, `recess ${-z0} mm`);
});
