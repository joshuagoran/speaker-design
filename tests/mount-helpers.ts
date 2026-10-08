// What the horn mount tests share (tests/horn-plate.test.ts, tests/horn-ply-mount.test.ts): the default scene with its
// lid hardware, mesh lookups, and the samples of a horn's surface the clearance checks run on.
import * as THREE from "three";
import { buildStackScene, type Props } from "../src/components/stack-view/buildStackScene";
import { MM_IN } from "../src/components/stack-view/geometry";
import { HORN_MESHES } from "../src/data/meshes";
import { DIY_OS90X50, DIY_ROSSE110X50 } from "../src/data/catalog/horns";
import { CD_OPTIONS, HORN_OPTIONS } from "../src/lib/data";
import { DEFAULT_PA } from "../src/lib/defaults";
import { DEFAULT_HARDWARE } from "../src/lib/pa/hardware";
import { midHardwarePlan } from "../src/lib/pa/calc";
import { SCENE_CASE_NAMES, sceneCases } from "./scene-cases";
import type { PaLayout, PartMesh } from "../src/types";

/** How close two faces count as touching, in (meshes are faceted, so a contact is never exact). */
export const CONTACT_IN = 0.01;
/** How far apart two parts must stay to count as clear, in. */
export const CLEAR_IN = 0.01;
/** Samples per triangle edge for the clearance checks. */
const SAMPLES = 12;
/** The layouts with a lid under the driver, where a mount stands. */
export const LID_LAYOUTS: readonly PaLayout[] = ["stack", "pole", "satellite"];

/** The default PA's scene props. */
export const base = (() => {
  const c = sceneCases.find((x) => x.name === SCENE_CASE_NAMES.defaultPa);
  if (!c) throw new Error("no default scene case");
  return c.props;
})();

/** The scene with the mid box's hardware (its horn posts and input dish on the lid and back) drawn too. */
export function scene(props: Partial<Props>) {
  const p = { ...base, ...props };
  const midHardware = midHardwarePlan(
    p.mid.box,
    p.wall ?? DEFAULT_PA.wall,
    p.inset ?? DEFAULT_PA.inset,
    p.mid,
    p.layout,
    undefined,
    DEFAULT_HARDWARE.mid,
  );
  const g = buildStackScene({ ...p, midHardware });
  g.updateMatrixWorld(true);
  return g;
}

export const meshesNamed = (group: THREE.Group, name: string) => {
  const out: THREE.Mesh[] = [];
  group.traverse((o) => o instanceof THREE.Mesh && o.name === name && out.push(o));
  return out;
};
export const boxOf = (o: THREE.Object3D) => new THREE.Box3().setFromObject(o);
/** Whether two boxes overlap by more than the clearance. */
export const overlaps = (a: THREE.Box3, b: THREE.Box3) =>
  a
    .clone()
    .expandByScalar(-CLEAR_IN / 2)
    .intersectsBox(b);
/** Whether a point is inside a box shrunk by the clearance. */
export const inside = (box: THREE.Box3, p: THREE.Vector3) =>
  box.clone().expandByScalar(-CLEAR_IN).containsPoint(p);
/** The center of a box round an object. */
export const centerOf = (o: THREE.Object3D) => boxOf(o).getCenter(new THREE.Vector3());

/** A mesh's vertices in world space. */
export function worldVertices(m: THREE.Mesh) {
  const pos = m.geometry.getAttribute("position");
  return Array.from({ length: pos.count }, (_, i) =>
    new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld),
  );
}

/** Points spread over each of the horn's triangles that reach into `near` (world space). */
export function hornSamples(body: THREE.Mesh, near: THREE.Box3) {
  const pts = worldVertices(body);
  const index = body.geometry.getIndex();
  const n = index ? index.count : pts.length;
  const corner = (i: number) => pts[index ? index.getX(i) : i];
  const out: THREE.Vector3[] = [];
  const zone = near.clone().expandByScalar(0.05);
  for (let t = 0; t + 2 < n; t += 3) {
    const [a, b, c] = [corner(t), corner(t + 1), corner(t + 2)];
    if (!zone.intersectsBox(new THREE.Box3().setFromPoints([a, b, c]))) continue;
    for (let i = 0; i <= SAMPLES; i++)
      for (let j = 0; i + j <= SAMPLES; j++) {
        const k = SAMPLES - i - j;
        out.push(
          new THREE.Vector3()
            .addScaledVector(a, i / SAMPLES)
            .addScaledVector(b, j / SAMPLES)
            .addScaledVector(c, k / SAMPLES),
        );
      }
  }
  return out;
}

/** The throat flange of a horn's CAD mesh, in: its rim radius and its front face's z from the back face. */
export function meshFlange(mesh: PartMesh) {
  const k = mesh.unitMm * MM_IN;
  const v = Array.from({ length: mesh.positions.length / 3 }, (_, i) => ({
    r: Math.hypot(mesh.positions[3 * i], mesh.positions[3 * i + 1]) * k,
    z: mesh.positions[3 * i + 2] * k,
  }));
  const rim = Math.max(...v.filter((p) => p.z === 0).map((p) => p.r));
  const front = Math.min(...v.filter((p) => p.z > 0 && p.r > rim - 1 * MM_IN).map((p) => p.z));
  return { rim, front };
}

/** The DIY horns with their CAD meshes. */
export const meshed = [DIY_OS90X50, DIY_ROSSE110X50].map((horn) => {
  const mesh = HORN_MESHES[horn.id];
  if (!mesh) throw new Error(`no mesh for ${horn.id}`);
  return { horn, mesh };
});

/** Every horn the driver bolts straight to, with every driver that fits its throat. */
export const bolted = HORN_OPTIONS.filter((h) => !h.adapter).map((horn) => ({
  horn,
  cds: CD_OPTIONS.filter((c) => c.exit === horn.exit),
}));
