import * as THREE from "three";
import { cabinetFinishOf } from "../../lib/data";
import { PARTS_3D } from "../../styles/palette";
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
    /** window braces and ribs */
    brace: THREE.MeshStandardMaterial;
    /** horn bodies */
    hornShell: THREE.MeshStandardMaterial;
    /** handles, input dishes and horn posts */
    hardware: THREE.MeshStandardMaterial;
    /**
     * a part's hole in its panel (buildHardware): draws nothing, marks the stencil where the shell then isn't drawn
     */
    holeMask: THREE.MeshBasicMaterial;
  };
  /** side, top, bottom and back plywood, inches */
  wall: number;
  /** how far the baffles sit behind the frame front, inches */
  inset: number;
  cutaway: boolean;
}

/** The stencil value a part's hole mask writes and the shell is not drawn over. */
const HOLE_STENCIL = 1;

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
  const black = new THREE.MeshStandardMaterial({ color: PARTS_3D.black, roughness: 0.9 });
  const cream = new THREE.MeshStandardMaterial({ color: PARTS_3D.cream, roughness: 0.55 });
  const painted = new THREE.MeshStandardMaterial({
    color: new THREE.Color(baffleColor),
    roughness: 0.9,
  });
  const ghost = new THREE.MeshStandardMaterial({
    color: PARTS_3D.ghost,
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
    color: PARTS_3D.port,
    roughness: 0.95,
    side: THREE.DoubleSide,
  });
  const brace = new THREE.MeshStandardMaterial({ color: PARTS_3D.brace, roughness: 0.9 });
  const hardware = new THREE.MeshStandardMaterial({
    color: PARTS_3D.hardware,
    roughness: 0.5,
    metalness: 0.3,
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
    color: PARTS_3D.cream,
    roughness: 0.55,
    side: THREE.DoubleSide,
  });
  // the cabinet shell gives way where a part's hole mask marked the stencil (HOLE_STENCIL), so the panel opens onto the
  // part's recess; every other material ignores the stencil
  const shell = cutaway ? ghost : wood;
  shell.stencilWrite = true;
  shell.stencilRef = HOLE_STENCIL;
  shell.stencilFunc = THREE.NotEqualStencilFunc;
  const holeMask = new THREE.MeshBasicMaterial({
    colorWrite: false,
    depthWrite: false,
    stencilWrite: true,
    stencilRef: HOLE_STENCIL,
    stencilFunc: THREE.AlwaysStencilFunc,
    stencilZPass: THREE.ReplaceStencilOp,
  });
  return {
    group: new THREE.Group(),
    materials: {
      wood,
      black,
      cream,
      shell,
      baffle,
      inner,
      port,
      brace,
      hornShell,
      hardware,
      holeMask,
    },
    wall,
    inset,
    cutaway,
  };
}
