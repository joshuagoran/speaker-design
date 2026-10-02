import * as THREE from "three";
import { cabinetFinishOf } from "../../lib/data";
import type { Props } from "./buildStackScene";

/** What the builders share: the group they add to, the materials, and the cabinet construction. */
export interface SceneContext {
  group: THREE.Group;
  materials: {
    /** cabinet finish: clear birch, walnut veneer, or paint */
    wood: THREE.MeshStandardMaterial;
    black: THREE.MeshStandardMaterial;
    cream: THREE.MeshStandardMaterial;
    /** the cabinet shell: the finish, or a ghost in the cutaway */
    shell: THREE.MeshStandardMaterial;
    /** the painted baffle, or a ghost in the cutaway */
    baffle: THREE.MeshStandardMaterial;
    /** duct fins, shelves and cut edges: the finish a shade darker */
    inner: THREE.MeshStandardMaterial;
    /** port tubes */
    port: THREE.MeshStandardMaterial;
    /** horn bodies */
    hornShell: THREE.MeshStandardMaterial;
  };
  /** side, top, bottom and back plywood, inches */
  wall: number;
  /** how far the baffles sit behind the frame front, inches */
  inset: number;
  cutaway: boolean;
}

export function createSceneContext({
  wall,
  inset,
  cabFinish,
  baffleColor,
  cutaway,
}: Pick<Props, "baffleColor" | "cutaway"> &
  Required<Pick<Props, "wall" | "inset" | "cabFinish">>): SceneContext {
  const finish = cabinetFinishOf(cabFinish);
  const wood = new THREE.MeshStandardMaterial({
    color: finish ? finish.color : new THREE.Color(cabFinish),
    roughness: finish ? finish.rough : 0.8,
  });
  const black = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.9 });
  const cream = new THREE.MeshStandardMaterial({ color: 0xece4c8, roughness: 0.55 });
  const painted = new THREE.MeshStandardMaterial({
    color: new THREE.Color(baffleColor),
    roughness: 0.9,
  });
  const ghost = new THREE.MeshStandardMaterial({
    color: 0xd7b98a,
    roughness: 0.9,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const inner = new THREE.MeshStandardMaterial({
    color: finish ? finish.inner : new THREE.Color(cabFinish).multiplyScalar(0.88),
    roughness: 0.9,
  });
  const port = new THREE.MeshStandardMaterial({
    color: 0x8a7458,
    roughness: 0.95,
    side: THREE.DoubleSide,
  });
  const baffle = cutaway
    ? new THREE.MeshStandardMaterial({
        color: new THREE.Color(baffleColor),
        roughness: 0.9,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    : painted;
  const hornShell = new THREE.MeshStandardMaterial({
    color: 0xece4c8,
    roughness: 0.55,
    side: THREE.DoubleSide,
  });
  return {
    group: new THREE.Group(),
    materials: {
      wood,
      black,
      cream,
      shell: cutaway ? ghost : wood,
      baffle,
      inner,
      port,
      hornShell,
    },
    wall,
    inset,
    cutaway,
  };
}
