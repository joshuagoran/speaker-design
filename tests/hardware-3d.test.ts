// The hardware in the 3D view: the H1105 drawn from its STEP model, the size and way round the catalogue mounts it, and
// no part (flange, recess, grip, jack, post) floating off the cabinet it is fitted to.
import { test } from "vite-plus/test";
import assert from "node:assert";
import * as THREE from "three";
import { buildStackScene } from "../src/components/stack-view/buildStackScene";
import { HARDWARE_MESH_NAME } from "../src/components/stack-view/buildHardware";
import { ROUNDOVER_IN } from "../src/components/stack-view/stackHeights";
import { H1105_MESH } from "../src/data/meshes/h1105";
import { HARDWARE_MESHES } from "../src/data/meshes";
import { HANDLES } from "../src/data/catalog/cabinet-hardware";
import { mountedFlange } from "../src/lib/pa/hardware";
import { midHardwarePlan, subHardwarePlan } from "../src/lib/pa/calc";
import { DEFAULT_PA } from "../src/lib/defaults";
import type { BoxHandles, HandleChoice } from "../src/types";
import { scenePropsOf } from "./scene-cases";

const d = DEFAULT_PA;
const MM_IN = 1 / 25.4;
const defaultCase = {
  sub: d.sub.id,
  mid: d.mid.id,
  horn: d.horn.id,
  midBox: d.midBox.id,
  portStyle: d.portStyle,
  cDim: d.cDim,
  cVent: d.cVent,
  mDim: d.mDim,
  wall: d.wall,
  inset: d.inset,
  layout: d.layout,
};
/** The default stack's scene with `model` handles, and its hardware meshes' world boxes. */
function scene(model: HandleChoice, cutaway: boolean) {
  const handles: BoxHandles = { model, upIn: 0, backIn: 0 };
  const subHardware = subHardwarePlan(
    d.cDim,
    d.wall,
    d.inset,
    d.portStyle,
    d.cVent,
    d.sub,
    undefined,
    handles,
  );
  const midHardware = midHardwarePlan(d.mDim, d.wall, d.inset, d.mid, d.layout, undefined, handles);
  const g = buildStackScene({
    ...scenePropsOf({ ...defaultCase, cutaway }),
    subHardware,
    midHardware,
  });
  g.updateMatrixWorld(true);
  const parts: { mesh: THREE.Mesh; box: THREE.Box3 }[] = [];
  g.traverse((o) => {
    if (o instanceof THREE.Mesh && o.name === HARDWARE_MESH_NAME)
      parts.push({ mesh: o, box: new THREE.Box3().setFromObject(o) });
  });
  return { g, parts, subHardware };
}

test("the H1105's mesh: the STEP model's flange (220 × 162 × 5 mm) and recess (to −58 mm), within the weld grid", () => {
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
  // the catalogue's flange is the same part: 8 5/8 × 6 3/8″
  const part = HANDLES.find((p) => p.id === "H1105");
  assert.ok(part && HARDWARE_MESHES[part.id] === H1105_MESH);
  const f = mountedFlange(part);
  assert.ok(f);
  assert.ok(Math.abs(f.up - h * MM_IN) < 0.05 && Math.abs(f.across - w * MM_IN) < 0.05);
});

test("the H1105 is drawn from its model on each side, tall (its 220 mm up the panel), its recess going into the box", () => {
  const { parts, subHardware } = scene("H1105", false);
  const side = subHardware.parts.find((p) => p.panel === "sideL");
  assert.ok(side);
  // the left handle: the mesh with the most triangles on the sub's left side
  const left = parts
    .filter(({ mesh }) => mesh.geometry.getAttribute("position").count > 100)
    .sort((a, b) => a.box.min.x - b.box.min.x)[0];
  assert.ok(left, "a model mesh is drawn");
  const size = left.box.getSize(new THREE.Vector3());
  assert.ok(Math.abs(size.y - 220 * MM_IN) < 0.05, `up the panel ${size.y.toFixed(2)}″`);
  assert.ok(Math.abs(size.z - 162 * MM_IN) < 0.05, `across ${size.z.toFixed(2)}″`);
  assert.ok(Math.abs(size.x - 63 * MM_IN) < 0.05, `deep ${size.x.toFixed(2)}″`);
  // the flange stands 5 mm off the side's face and the recess runs into the box
  const face = -d.cDim.w / 2 - ROUNDOVER_IN;
  assert.ok(Math.abs(left.box.min.x - (face - 5 * MM_IN)) < 0.01, `${left.box.min.x}`);
  assert.ok(Math.abs(left.box.max.x - (face + 58 * MM_IN)) < 0.01, `${left.box.max.x}`);
});

test("no hardware floats: every flange, recess, grip, jack and post meets its cabinet's outside face", () => {
  for (const model of ["H1105", "30769"] as const)
    for (const cutaway of [false, true]) {
      const { g, parts } = scene(model, cutaway);
      // the cabinets' outsides: the frames and baffles (extrusions) and the backs (boxes the size of a cabinet)
      const shells: THREE.Box3[] = [];
      g.traverse((o) => {
        if (!(o instanceof THREE.Mesh) || o.name === HARDWARE_MESH_NAME) return;
        const b = new THREE.Box3().setFromObject(o);
        if (o.geometry.type === "ExtrudeGeometry" || b.getSize(new THREE.Vector3()).y > 10)
          shells.push(b);
      });
      // each part meets a cabinet, or a part that does (an opening on its flange, a jack on its opening)
      const meets = (a: THREE.Box3, b: THREE.Box3) =>
        a.clone().expandByScalar(0.005).intersectsBox(b);
      const held = parts.map(({ box }) => shells.some((sh) => meets(sh, box)));
      for (let pass = 0; pass < parts.length; pass++)
        parts.forEach(({ box }, i) => {
          if (!held[i]) held[i] = parts.some((q, j) => held[j] && meets(q.box, box));
        });
      const tag = `${model}${cutaway ? " cutaway" : ""}`;
      parts.forEach(({ mesh, box }, i) => {
        assert.ok(held[i], `${tag}: a ${mesh.geometry.type} floats at ${JSON.stringify(box)}`);
        // and none stands off: within 0.6″ of a cabinet (the binding posts stand 1/2″ proud of the lid)
        assert.ok(
          shells.some((sh) => sh.clone().expandByScalar(0.6).containsBox(box)),
          `${tag}: a ${mesh.geometry.type} stands off`,
        );
      });
    }
});
