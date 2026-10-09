import * as THREE from "three";
import type { SceneContext } from "./sceneContext";

/** How far a cone's membrane sits behind the baffle face, inches: what a part in its center (a coaxial's HF) stands on. */
export const CONE_FACE_BACK_IN = 0.3;

/**
 * A driver cone of radius `r` centered at (x, y) just behind the baffle face at `z`; nothing in the cutaway. `cap: false`
 * leaves out the dust cap, for a part that takes its place (a coaxial's HF).
 */
export function buildCone(
  ctx: SceneContext,
  {
    r,
    y,
    z,
    x = 0,
    parent = ctx.group,
    cap: withCap = true,
  }: { r: number; y: number; z: number; x?: number; parent?: THREE.Object3D; cap?: boolean },
) {
  if (ctx.cutaway) return;
  const { black } = ctx.materials;
  // membrane: a filled disc just behind the baffle face
  const disc = new THREE.Mesh(new THREE.CircleGeometry(r * 0.99, 48), black);
  disc.position.set(x, y, z - CONE_FACE_BACK_IN);
  parent.add(disc);
  // shallow cone from the surround down to the dust cap
  const c = new THREE.Mesh(new THREE.ConeGeometry(r * 0.9, r * 0.22, 48, 1, true), black);
  c.rotation.x = -Math.PI / 2;
  c.position.set(x, y, z - CONE_FACE_BACK_IN - r * 0.11);
  parent.add(c);
  const surround = new THREE.Mesh(new THREE.TorusGeometry(r * 0.93, r * 0.055, 12, 48), black);
  surround.position.set(x, y, z - 0.18);
  parent.add(surround);
  if (!withCap) return;
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(r * 0.26, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    black,
  );
  cap.scale.set(1, 0.45, 1);
  cap.rotation.x = Math.PI / 2;
  cap.position.set(x, y, z - 0.42);
  parent.add(cap);
}
