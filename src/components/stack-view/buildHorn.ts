import * as THREE from "three";
import { rectangularHornGeometry } from "./geometry";
import { HORN_LIFT_IN, PLAIN_HORN_LIFT_IN, PLAIN_HORN_BEVEL_IN } from "./stackHeights";
import type { SceneContext } from "./sceneContext";
import type { BodyStep, Dims3, Horn } from "../../types";

/** The horn body's mesh. */
export const HORN_MESH_NAME = "horn";
/** The throat adapter's meshes. */
export const ADAPTER_MESH_NAME = "hornAdapter";
/** The compression driver's meshes. */
export const CD_MESH_NAME = "compressionDriver";

/** A lathe or rect horn's mouth stands this far in front of the mid box's center plane plus half its depth. */
const MOUTH_PROUD_IN = 1;
/** The plain block's bevel depth, front and back. */
const PLAIN_BEVEL_THICKNESS_IN = 1.2;

/**
 * Turned steps along the z axis, front face at `z0`, drawn backward (toward −z) and centered on (x, y). Returns the z
 * of the last step's back face.
 */
function addSteps(
  ctx: SceneContext,
  steps: readonly BodyStep[],
  at: { x: number; y: number; z0: number },
  material: THREE.Material,
  name: string,
): number {
  let z = at.z0;
  for (const [dia, len] of steps) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(dia / 2, dia / 2, len, 48), material);
    m.rotation.x = Math.PI / 2;
    m.position.set(at.x, at.y, z - len / 2);
    m.name = name;
    ctx.group.add(m);
    z -= len;
  }
  return z;
}

/**
 * The parts behind the horn's throat: its throat adapter, when it has one, and the compression driver, whose front
 * face sits on the adapter's back face (or on the throat).
 */
function addThroatParts(
  ctx: SceneContext,
  horn: Horn,
  at: { x: number; y: number; throatZ: number },
) {
  const { black, cream } = ctx.materials;
  const cdFront = horn.adapter
    ? addSteps(
        ctx,
        horn.adapter.steps,
        { x: at.x, y: at.y, z0: at.throatZ },
        cream,
        ADAPTER_MESH_NAME,
      )
    : at.throatZ;
  const cdLen = 4;
  const cd = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.6, cdLen, 32), black);
  cd.rotation.x = Math.PI / 2; // the narrow end (+y) to the front (+z)
  cd.position.set(at.x, at.y, cdFront - cdLen / 2);
  cd.name = CD_MESH_NAME;
  ctx.group.add(cd);
}

/**
 * The horn, its throat adapter and its compression driver, one per x: a rectangular horn, a lathe profile, or the plain
 * flared block. `y` is the base of the horn (the top of the box below) and `mount` the footprint it sits on. In the tower
 * the horn sits on the shared shell instead: `tower` gives its center height, the z of its throat, the mouth width and
 * the section height. Returns the y of the horn envelope's top.
 */
export function buildHorn(
  ctx: SceneContext,
  {
    horn,
    y: hornY,
    xs = [0],
    mount,
    tower,
  }: {
    horn: Horn;
    y: number;
    xs?: number[];
    mount: Pick<Dims3, "w" | "d">;
    tower?: { cy: number; z: number; width: number; sectionH: number };
  },
): { top: number } {
  const { black, cream, hornShell } = ctx.materials;
  const hz = horn.size;
  if (!horn.profile && !horn.rect && !tower) {
    const stand = new THREE.Mesh(new THREE.BoxGeometry(hz.w * 0.5, 1.2, hz.d * 0.5), black);
    stand.position.set(xs[0], hornY + 0.6, 0);
    ctx.group.add(stand);
  }
  // a lathe or rect horn: the throat (z of the body's back), the mouth `hz.d` in front of it
  const throatZ = tower ? tower.z : mount.d / 2 + MOUTH_PROUD_IN - hz.d;
  const cy = tower ? tower.cy : hornY + hz.h / 2 + HORN_LIFT_IN;
  xs.forEach((hx) => {
    if (horn.rect) {
      const rm = new THREE.Mesh(
        rectangularHornGeometry(tower ? tower.width : mount.w, hz.h, hz.d),
        hornShell,
      );
      rm.position.set(hx, cy, throatZ);
      rm.name = HORN_MESH_NAME;
      ctx.group.add(rm);
      addThroatParts(ctx, horn, { x: hx, y: cy, throatZ });
    } else if (horn.profile) {
      // the profile stretched to the mouth's width and height and the body's depth
      const maxR = Math.max(...horn.profile.map(([r]) => r));
      const maxX = Math.max(...horn.profile.map(([, x]) => x));
      const lathe = new THREE.LatheGeometry(
        horn.profile.map(([r, x]) => new THREE.Vector2(r, x)),
        96,
      );
      const lm = new THREE.Mesh(lathe, hornShell);
      lm.rotation.x = Math.PI / 2; // lathe axis (y) -> z, mouth toward +z
      lm.scale.set(hz.w / 2 / maxR, hz.d / maxX, hz.h / 2 / maxR); // local x = width, y = depth, z = height
      lm.position.set(hx, cy, throatZ);
      lm.name = HORN_MESH_NAME;
      ctx.group.add(lm);
      addThroatParts(ctx, horn, { x: hx, y: cy, throatZ });
    } else {
      const hornShape = new THREE.Shape();
      const rw = hz.w / 2,
        rh = hz.h / 2,
        r = Math.min(rw, rh) * 0.5;
      hornShape.moveTo(-rw + r, -rh);
      hornShape.lineTo(rw - r, -rh);
      hornShape.quadraticCurveTo(rw, -rh, rw, -rh + r);
      hornShape.lineTo(rw, rh - r);
      hornShape.quadraticCurveTo(rw, rh, rw - r, rh);
      hornShape.lineTo(-rw + r, rh);
      hornShape.quadraticCurveTo(-rw, rh, -rw, rh - r);
      hornShape.lineTo(-rw, -rh + r);
      hornShape.quadraticCurveTo(-rw, -rh, -rw + r, -rh);
      const hornGeo = new THREE.ExtrudeGeometry(hornShape, {
        depth: hz.d,
        bevelEnabled: true,
        bevelSize: PLAIN_HORN_BEVEL_IN,
        bevelThickness: PLAIN_BEVEL_THICKNESS_IN,
        bevelSegments: 6,
      });
      const hornMesh = new THREE.Mesh(hornGeo, cream);
      hornMesh.position.set(
        hx,
        tower ? tower.cy : hornY + PLAIN_HORN_LIFT_IN + rh,
        tower ? tower.z : -hz.d / 2 + 2,
      );
      hornMesh.name = HORN_MESH_NAME;
      ctx.group.add(hornMesh);
      addThroatParts(ctx, horn, {
        x: hx,
        y: hornMesh.position.y,
        throatZ: hornMesh.position.z - PLAIN_BEVEL_THICKNESS_IN,
      });
    }
  });
  const lift = horn.rect || horn.profile ? HORN_LIFT_IN : PLAIN_HORN_LIFT_IN + PLAIN_HORN_BEVEL_IN;
  return { top: hornY + (tower ? tower.sectionH : lift + hz.h) };
}
