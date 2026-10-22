// The Speaker page's 3D view of every template: each driver seen from outside the closed box (a cone in the baffle, a
// horn's driver seen through its mouth) is drawn with Cutaway off, not only in the cutaway.
import { describe, expect, test } from "vite-plus/test";
import * as THREE from "three";
import {
  buildSpeakerScene,
  SPEAKER_GROUP_NAMES,
  SPEAKER_MESH_NAMES,
} from "../src/components/stack-view/buildSpeakerScene";
import { SPEAKER_TEMPLATES, templateSpeaker } from "../src/pages/speaker/speakerTemplates";
import type { SpeakerSpec } from "../src/types";

/** The groups and meshes one driver is drawn with. */
const DRIVER_NAMES: ReadonlySet<string> = new Set([
  SPEAKER_GROUP_NAMES.driver,
  SPEAKER_MESH_NAMES.hornDriver,
  SPEAKER_MESH_NAMES.foldDriver,
]);
/** The views the check looks from: along each axis, both ways. */
const VIEWS = [
  [0, 0, -1],
  [0, 0, 1],
  [0, -1, 0],
  [0, 1, 0],
  [-1, 0, 0],
  [1, 0, 0],
].map(([x, y, z]) => new THREE.Vector3(x, y, z));
/** Rays across each driver, per side of the grid. */
const GRID = 7;
/** How far outside the scene each ray starts, in. */
const FAR_IN = 1000;
/** How much nearer than the driver a part must be to hide it, in. */
const HIDES_IN = 1e-3;

/** The driver `o` belongs to (its own group or mesh), or null. */
function driverOf(o: THREE.Object3D | null): THREE.Object3D | null {
  let found: THREE.Object3D | null = null;
  for (let p = o; p; p = p.parent) if (DRIVER_NAMES.has(p.name)) found = p;
  return found;
}

/** Whether `mesh` draws: it and its parents shown, and its material writes color at some opacity. */
function draws(mesh: THREE.Mesh, materialIndex: number | undefined): boolean {
  for (let p: THREE.Object3D | null = mesh; p; p = p.parent) if (!p.visible) return false;
  const material = Array.isArray(mesh.material) ? mesh.material[materialIndex ?? 0] : mesh.material;
  return material.visible && material.colorWrite && material.opacity > 0;
}

/** The meshes `scene` draws, its world matrices updated. */
function drawnMeshes(scene: THREE.Object3D): THREE.Mesh[] {
  scene.updateMatrixWorld(true);
  const out: THREE.Mesh[] = [];
  scene.traverse((o) => {
    if (o instanceof THREE.Mesh) out.push(o);
  });
  return out;
}

/** The first drawn face a ray meets among `meshes`, or undefined. */
function firstDrawn(ray: THREE.Raycaster, meshes: THREE.Mesh[]) {
  return ray
    .intersectObjects(meshes, false)
    .find((h) => h.object instanceof THREE.Mesh && draws(h.object, h.face?.materialIndex));
}

/**
 * Each driver of `spec` (as the cutaway draws them) seen from outside the closed box: the rays from outside that meet it
 * with nothing of the closed box (its drivers left out) in front of it, and how many of those meet a driver drawn in the
 * closed box first.
 */
function driversSeen(spec: Pick<SpeakerSpec, "cabinet" | "look">) {
  const cutaway = buildSpeakerScene({ spec, cutaway: true });
  const bare = drawnMeshes(buildSpeakerScene({ spec, cutaway: false, drivers: false }));
  const closed = drawnMeshes(buildSpeakerScene({ spec, cutaway: false }));
  cutaway.updateMatrixWorld(true);
  const drivers = new Set<THREE.Object3D>();
  cutaway.traverse((o) => {
    const d = driverOf(o);
    if (d) drivers.add(d);
  });
  return [...drivers].map((driver) => {
    const own = drawnMeshes(driver);
    const box = new THREE.Box3().setFromObject(driver);
    const size = box.getSize(new THREE.Vector3());
    let seen = 0,
      shown = 0;
    for (const view of VIEWS) {
      // a grid across the driver's box, square to the view
      const [u, v] = [
        new THREE.Vector3(view.y, view.z, view.x),
        new THREE.Vector3(view.z, view.x, view.y),
      ];
      for (let i = 0; i < GRID; i++)
        for (let j = 0; j < GRID; j++) {
          const at = box
            .getCenter(new THREE.Vector3())
            .addScaledVector(u, ((i + 0.5) / GRID - 0.5) * u.dot(size))
            .addScaledVector(v, ((j + 0.5) / GRID - 0.5) * v.dot(size));
          const ray = new THREE.Raycaster(at.clone().addScaledVector(view, -FAR_IN), view);
          const hit = firstDrawn(ray, own);
          if (!hit) continue;
          const nearer = firstDrawn(ray, bare);
          if (nearer && nearer.distance < hit.distance - HIDES_IN) continue;
          seen++;
          if (driverOf(firstDrawn(ray, closed)?.object ?? null)) shown++;
        }
    }
    return { name: driver.name, seen, shown };
  });
}

describe("speaker scene: the drivers with Cutaway off", () => {
  for (const template of SPEAKER_TEMPLATES)
    test(`${template}: each driver seen from outside is drawn`, () => {
      for (const { name, seen: rays, shown } of driversSeen(templateSpeaker(template)))
        if (rays > 0)
          expect(shown, `${template} ${name}: ${shown} of ${rays} rays`).toBeGreaterThan(0);
    });
});
