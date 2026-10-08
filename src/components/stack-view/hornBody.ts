import * as THREE from "three";
import { partMeshGeometry, rectangularHornGeometry, type PartMeshDrawing } from "./geometry";
import { HORN_MESHES } from "../../data/meshes";
import type { Horn } from "../../types";

/** A horn's CAD mesh: shaded smooth, and placed by its origin, which build/horn-mesh.mjs puts on the driver's axis. */
export const HORN_MESH_DRAWING: PartMeshDrawing = { shading: "smooth", place: "origin" };

/**
 * A horn's body as drawn, its throat on the origin and its mouth toward +z: its CAD mesh at its own size, else its
 * profile turned and stretched to its mouth and depth, else a rectangular flare `mouthW` wide (the full-width concept's
 * box or tower width; any other horn passes its own mouth). Whether the geometry is shared (a CAD mesh's, built once)
 * is `shared`: only a geometry that isn't may be disposed.
 */
export function hornBody(
  horn: Pick<Horn, "id" | "profile" | "size" | "exit">,
  mouthW: number,
  material: THREE.Material,
): { body: THREE.Mesh; shared: boolean } {
  const hz = horn.size;
  const model = HORN_MESHES[horn.id];
  if (model) {
    // its own mesh at its own size, its origin on the axis: the flange's back face on the throat plane, the mouth
    // toward +z
    return {
      body: new THREE.Mesh(partMeshGeometry(model, HORN_MESH_DRAWING), material),
      shared: true,
    };
  }
  if (horn.profile) {
    // the profile stretched to the mouth's width and height and the body's depth
    const maxR = Math.max(...horn.profile.map(([r]) => r));
    const maxX = Math.max(...horn.profile.map(([, x]) => x));
    const body = new THREE.Mesh(
      new THREE.LatheGeometry(
        horn.profile.map(([r, x]) => new THREE.Vector2(r, x)),
        96,
      ),
      material,
    );
    body.rotation.x = Math.PI / 2; // lathe axis (y) -> z, mouth toward +z
    body.scale.set(hz.w / 2 / maxR, hz.d / maxX, hz.h / 2 / maxR); // local x = width, y = depth, z = height
    return { body, shared: false };
  }
  return {
    body: new THREE.Mesh(rectangularHornGeometry(mouthW, hz.h, hz.d, horn.exit / 2), material),
    shared: false,
  };
}
