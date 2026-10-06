import * as THREE from "three";
import { insideToScene } from "./buildBraces";
import { ROUNDOVER_IN } from "./stackHeights";
import type { SceneContext } from "./sceneContext";
import type { BoxHardwarePlan, Dims3, PlacedHardware } from "../../types";

/** The name the handles, dishes and posts carry, so a check can find them in the scene. */
export const HARDWARE_MESH_NAME = "hardware";
/** A flange's thickness off the panel, in (drawn a hair proud so it reads on every finish). */
const FLANGE_T_IN = 0.08;
/** How far the opening, grip, jacks and posts stand off the flange, in. */
const PROUD_IN = 0.02;
/** A Speakon jack's face and a binding post's diameter, in. */
const JACK_DIA_IN = 1.0;
const POST_DIA_IN = 0.45;

/**
 * Where a part's face sits in the scene, for the cabinet `box` whose bottom is at `y` and centre at `x`: the point on
 * the outside face (past the frame's roundovers on the sides and top) at the cutout's centre, and the outward normal.
 */
function faceOf(p: PlacedHardware, box: Dims3, y: number, x: number) {
  const left = x - box.w / 2;
  switch (p.panel) {
    case "sideL":
      return {
        at: new THREE.Vector3(left - ROUNDOVER_IN, y + p.v, box.d / 2 - p.u),
        n: new THREE.Vector3(-1, 0, 0),
      };
    case "sideR":
      return {
        at: new THREE.Vector3(left + box.w + ROUNDOVER_IN, y + p.v, box.d / 2 - p.u),
        n: new THREE.Vector3(1, 0, 0),
      };
    case "back":
      return {
        at: new THREE.Vector3(left + p.u, y + p.v, -box.d / 2),
        n: new THREE.Vector3(0, 0, -1),
      };
    case "top":
      return {
        at: new THREE.Vector3(left + p.u, y + box.h + ROUNDOVER_IN, box.d / 2 - p.v),
        n: new THREE.Vector3(0, 1, 0),
      };
  }
}

/** A flat box on a face: `w` along the part's width, `h` along its height, `t` off the face, at `off` out from it. */
function plate(
  p: PlacedHardware,
  face: ReturnType<typeof faceOf>,
  w: number,
  h: number,
  t: number,
  off: number,
  mat: THREE.Material,
) {
  // sides: width runs front to back (z), height up (y); back: width across (x), height up; top: width across, height z
  const size: [number, number, number] =
    p.panel === "sideL" || p.panel === "sideR"
      ? [t, h, w]
      : p.panel === "back"
        ? [w, h, t]
        : [w, t, h];
  const m = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
  m.position.copy(face.at).addScaledVector(face.n, off + t / 2);
  m.name = HARDWARE_MESH_NAME;
  return m;
}
/** A short cylinder standing out of a face at `du` along the part's width from its centre. */
function stud(
  p: PlacedHardware,
  face: ReturnType<typeof faceOf>,
  dia: number,
  len: number,
  off: number,
  du: number,
  mat: THREE.Material,
) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(dia / 2, dia / 2, len, 20), mat);
  m.position.copy(face.at).addScaledVector(face.n, off + len / 2);
  if (p.panel === "sideL" || p.panel === "sideR") {
    m.rotation.z = Math.PI / 2;
    m.position.z -= du;
  } else if (p.panel === "back") {
    m.rotation.x = Math.PI / 2;
    m.position.x += du;
  } else m.position.x += du;
  m.name = HARDWARE_MESH_NAME;
  return m;
}

/**
 * A box's handles, input dish and horn posts (lib/pa/hardware) on its faces, for the cabinet `box` whose bottom is at
 * `y` and centre at `x`: each part's flange in steel (PARTS_3D.hardware) with its opening in black, the handle's grip,
 * the dish's two Speakons and the cup's two posts; in the cutaway, each recess's pocket inside the box as well.
 */
export function buildHardware(
  ctx: SceneContext,
  {
    plan,
    box,
    y,
    x = 0,
    parent,
  }: { plan: BoxHardwarePlan; box: Dims3; y: number; x?: number; parent: THREE.Object3D },
) {
  const { hardware: steel, black } = ctx.materials;
  const place = insideToScene(ctx, box, y, x);
  for (const p of plan.parts) {
    const c = p.part.cutout;
    if (!c) continue;
    const f = p.part.flange ?? c;
    const face = faceOf(p, box, y, x);
    parent.add(plate(p, face, f.w, f.h, FLANGE_T_IN, 0, steel));
    parent.add(plate(p, face, c.w, c.h, PROUD_IN, FLANGE_T_IN, black));
    const top = FLANGE_T_IN + PROUD_IN;
    if (p.kind === "handle") parent.add(plate(p, face, c.w * 0.8, c.h * 0.18, 0.15, top, steel));
    else if (p.kind === "plate")
      for (const du of [-c.w / 4, c.w / 4])
        parent.add(stud(p, face, JACK_DIA_IN, 0.2, top, du, steel));
    else
      for (const du of [-c.w / 5, c.w / 5])
        parent.add(stud(p, face, POST_DIA_IN, 0.4, top, du, steel));
    // the pocket behind the panel, where the recess takes room (it shows in the cutaway)
    if (ctx.cutaway && p.litres > 0) {
      const { size, at } = place(p.recess);
      if (size.every((s) => s > 0)) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(...size), steel);
        m.position.copy(at);
        m.name = HARDWARE_MESH_NAME;
        parent.add(m);
      }
    }
  }
}
