import * as THREE from "three";

/** What a port tube's parts are drawn with, and where they go. */
export interface TubeStyle {
  /** the tube's radius */
  r: number;
  material: THREE.Material;
  /** the meshes' name, so a check can find them */
  name: string;
  parent: THREE.Object3D;
}

/** A straight length of tube between two centerline points (nothing when they meet). */
export function addPipe(
  { r, material, name, parent }: TubeStyle,
  a: THREE.Vector3,
  b: THREE.Vector3,
) {
  const len = a.distanceTo(b);
  if (len < 1e-3) return;
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 32, 1, true), material);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  m.name = name;
  parent.add(m);
}

/** A quarter-torus elbow of centerline radius `bend` about `c`, its arc from local +X to +Y laid on the axes `ax`, `ay`. */
export function addElbow(
  { r, material, name, parent }: TubeStyle,
  bend: number,
  c: THREE.Vector3,
  ax: THREE.Vector3,
  ay: THREE.Vector3,
) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(bend, r, 16, 12, Math.PI / 2), material);
  m.setRotationFromMatrix(new THREE.Matrix4().makeBasis(ax, ay, ax.clone().cross(ay)));
  m.position.copy(c);
  m.name = name;
  parent.add(m);
}
