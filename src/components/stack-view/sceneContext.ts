import * as THREE from "three";
import { CABINET_FINISHES, cabinetFinishOf } from "../../lib/data";
import { hornBodyColor } from "../../lib/pa/hornColor";
import { PARTS_3D } from "../../styles/palette";
import type { Props } from "./buildStackScene";
import type { Horn } from "../../types";

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
    /** printed throat adapters */
    adapter: THREE.MeshStandardMaterial;
    /** the horn bracket */
    aluminum: THREE.MeshStandardMaterial;
    /** the horn's plywood mount: clear birch, whatever the cabinet's finish */
    plywood: THREE.MeshStandardMaterial;
    /**
     * a part's hole in its panel (buildHardware): draws no color, only depth, just proud of the face, so the panel
     * behind it isn't drawn there
     */
    holeMask: THREE.MeshBasicMaterial;
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
  horn,
  hornColor,
}: Pick<Props, "baffleColor" | "cutaway" | "hornColor"> &
  Required<Pick<Props, "wall" | "inset" | "cabFinish">> & {
    /** the horn whose body color the context holds: only its catalog finish is read */
    horn: Pick<Horn, "finish">;
  }): SceneContext {
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
    color: hornBodyColor(horn, hornColor),
    roughness: 0.55,
    side: THREE.DoubleSide,
  });
  // a part's hole: drawn after the part and before everything else (buildHardware's render orders), it writes only
  // depth, pulled toward the camera, so the panel behind it fails the depth test and the part's recess shows. A
  // cabinet in front of it is nearer, so it still draws (a stencil mask, drawn first, also cut holes in a nearer box).
  const holeMask = new THREE.MeshBasicMaterial({
    colorWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -4,
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
      brace,
      hornShell,
      hardware,
      adapter: new THREE.MeshStandardMaterial({ color: PARTS_3D.adapter, roughness: 0.6 }),
      aluminum: new THREE.MeshStandardMaterial({
        color: PARTS_3D.aluminum,
        roughness: 0.35,
        metalness: 0.25,
      }),
      plywood: new THREE.MeshStandardMaterial({
        color: CABINET_FINISHES.birch.color,
        roughness: CABINET_FINISHES.birch.rough,
      }),
      holeMask,
    },
    wall,
    inset,
    cutaway,
  };
}
