import * as THREE from "three";
import { ROUNDOVER_IN } from "./stackHeights";
import type { SceneContext } from "./sceneContext";
import type { BoxHardwarePlan, Dims3, PlacedHardware } from "../../types";
import { mountedCutout, mountedFlange } from "../../lib/pa/hardware";
import { HARDWARE_MESHES } from "../../data/meshes";
import type { HardwareMesh } from "../../types";

/** The name the handles, dishes and posts carry, so a check can find them in the scene. */
export const HARDWARE_MESH_NAME = "hardware";
/** A flange's thickness off the panel, in (drawn a hair proud so it reads on every finish). */
const FLANGE_T_IN = 0.08;
/** How far the opening, grip, jacks and posts stand off the flange, in. */
const PROUD_IN = 0.02;
/** Millimeters to the scene's inches. */
const MM_IN = 1 / 25.4;
/** How far the hole's mask stands off the face, in (proud of it, inside the flange's 5 mm). */
const MASK_PROUD_IN = 0.02;
/** The model part draws first, then its hole's mask, then the rest of the scene (three sorts opaque meshes by these). */
const MODEL_RENDER_ORDER = -2;
const MASK_RENDER_ORDER = -1;
/** How far the hole stays inside the recess body's outline, mm: its walls slope in, so the edge pixels stay covered. */
const HOLE_INSET_MM = 1.5;
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

/** Each panel's up direction for a part on it (on the lid: front to back), scene axes. */
const UP: Record<PlacedHardware["panel"], THREE.Vector3> = {
  sideL: new THREE.Vector3(0, 1, 0),
  sideR: new THREE.Vector3(0, 1, 0),
  back: new THREE.Vector3(0, 1, 0),
  top: new THREE.Vector3(0, 0, -1),
};
/**
 * The matrix that puts a part's model on its face: its x across the panel, y up it, z out along the normal (a
 * right-handed frame, so the triangles keep their winding), its origin at `at`.
 */
function faceFrame(p: PlacedHardware, face: ReturnType<typeof faceOf>, at: THREE.Vector3) {
  const up = UP[p.panel];
  const across = new THREE.Vector3().crossVectors(up, face.n);
  return new THREE.Matrix4().makeBasis(across, up, face.n).setPosition(at);
}

// each mesh's geometry built once, in inches, its flange centered on the origin and the panel's face at z = 0
const MESH_GEOMETRY = new Map<HardwareMesh, THREE.BufferGeometry>();
function meshGeometry(m: HardwareMesh) {
  const hit = MESH_GEOMETRY.get(m);
  if (hit) return hit;
  const k = m.unitMm * MM_IN;
  const cx = (m.min[0] + m.max[0]) / 2,
    cy = (m.min[1] + m.max[1]) / 2;
  const pos = new Float32Array(m.indices.length * 3);
  m.indices.forEach((v, i) => {
    pos[3 * i] = m.positions[3 * v] * k - cx * MM_IN;
    pos[3 * i + 1] = m.positions[3 * v + 1] * k - cy * MM_IN;
    pos[3 * i + 2] = m.positions[3 * v + 2] * k;
  });
  // unshared vertices: flat facets, so the flange's edges and the dish's corners stay crisp
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.computeVertexNormals();
  MESH_GEOMETRY.set(m, g);
  return g;
}

/**
 * A part drawn from its CAD model (data/meshes) on its face, and the hole it sits in: the cabinet's panels are solid,
 * so after the part a depth-only mask the size of the recess's outline (sceneContext's holeMask) goes on the face, and
 * the panel behind it fails the depth test, which opens the panel onto the part's recess. Anything nearer the camera,
 * such as another cabinet, still draws over it. The mask faces out only, so it opens the panel only where that face is
 * seen.
 */
function modelPart(
  p: PlacedHardware,
  face: ReturnType<typeof faceOf>,
  m: HardwareMesh,
  mat: THREE.Material,
  mask: THREE.Material,
) {
  const part = new THREE.Mesh(meshGeometry(m), mat);
  part.applyMatrix4(faceFrame(p, face, face.at));
  part.name = HARDWARE_MESH_NAME;
  part.renderOrder = MODEL_RENDER_ORDER;
  // the hole: the recess body's outline, placed on the flange's center as the geometry is
  const [w, h] = [0, 1].map((k) => (m.hole.max[k] - m.hole.min[k] - 2 * HOLE_INSET_MM) * MM_IN);
  const off = [0, 1].map(
    (k) => ((m.hole.min[k] + m.hole.max[k]) / 2 - (m.min[k] + m.max[k]) / 2) * MM_IN,
  );
  const plane = new THREE.PlaneGeometry(w, h).translate(off[0], off[1], 0);
  const hole = new THREE.Mesh(plane, mask);
  hole.applyMatrix4(faceFrame(p, face, face.at.clone().addScaledVector(face.n, MASK_PROUD_IN)));
  hole.renderOrder = MASK_RENDER_ORDER;
  hole.name = HARDWARE_MESH_NAME;
  return [part, hole];
}

/** A flat box on a face: `w` across the panel, `h` up it (front to back on the lid), `t` off the face, at `off` out from it. */
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
  const { hardware: steel, black, holeMask } = ctx.materials;
  for (const p of plan.parts) {
    // each size as mounted (the catalogue's `upright`): across the panel and up it
    const c = mountedCutout(p.part);
    if (!c) continue;
    const face = faceOf(p, box, y, x);
    const model = HARDWARE_MESHES[p.part.id];
    if (model) {
      // the maker's model: its flange, recess and grip as they are (the recess shows in the cutaway too)
      parent.add(...modelPart(p, face, model, steel, holeMask));
      continue;
    }
    const f = mountedFlange(p.part) ?? c;
    parent.add(plate(p, face, f.across, f.up, FLANGE_T_IN, 0, steel));
    parent.add(plate(p, face, c.across, c.up, PROUD_IN, FLANGE_T_IN, black));
    const top = FLANGE_T_IN + PROUD_IN;
    // the grip bar runs across the opening
    if (p.kind === "handle")
      parent.add(plate(p, face, c.across * 0.8, c.up * 0.18, 0.15, top, steel));
    else if (p.kind === "plate")
      for (const du of [-c.across / 4, c.across / 4])
        parent.add(stud(p, face, JACK_DIA_IN, 0.2, top, du, steel));
    else
      for (const du of [-c.across / 5, c.across / 5])
        parent.add(stud(p, face, POST_DIA_IN, 0.4, top, du, steel));
    // the recess in the cutaway: from the outside face, where the flange sits, through the wall to its listed depth
    // (drawn from the inside face before, it floated a wall's thickness off the flange)
    if (ctx.cutaway && p.part.depthIn)
      parent.add(plate(p, face, c.across, c.up, p.part.depthIn, -p.part.depthIn, steel));
  }
}
