import * as THREE from "three";
import { rectangularHornGeometry } from "./geometry";
import { HORN_LIFT_IN, PLAIN_HORN_LIFT_IN, PLAIN_HORN_BEVEL_IN } from "./stackHeights";
import type { SceneContext } from "./sceneContext";
import type { Dims3, Horn } from "../../types";

/**
 * The horn and its compression-driver throat, one per x: a rectangular horn, a lathe profile, or the plain flared block.
 * `y` is the base of the horn (the top of the box below) and `mount` the footprint it sits on. In the tower the horn sits on
 * the shared shell instead: `tower` gives its centre height, the z of its throat, the mouth width and the section height.
 * Returns the y of the horn envelope's top.
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
  xs.forEach((hx) => {
    if (horn.rect) {
      const mw = tower ? tower.width : mount.w;
      const rm = new THREE.Mesh(rectangularHornGeometry(mw, hz.h, hz.d), hornShell);
      rm.position.set(
        hx,
        tower ? tower.cy : hornY + hz.h / 2 + HORN_LIFT_IN,
        tower ? tower.z : mount.d / 2 - hz.d + 1,
      );
      ctx.group.add(rm);
      const th = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.6, 4, 32), black);
      th.rotation.x = Math.PI / 2;
      th.position.set(hx, rm.position.y, rm.position.z - 2);
      ctx.group.add(th);
    } else if (horn.profile) {
      const sc = horn.scale || 1;
      const pts = horn.profile.map(([r, x]) => new THREE.Vector2(r * sc, x * sc));
      const lathe = new THREE.LatheGeometry(pts, 96);
      const lm = new THREE.Mesh(lathe, hornShell);
      lm.rotation.x = Math.PI / 2; // lathe axis (y) -> z, mouth toward +z
      if (horn.scaleX || horn.scaleY || horn.scaleZ)
        lm.scale.set(horn.scaleX || 1, horn.scaleZ || 1, horn.scaleY || 1); // local x=width, y=depth, z=height
      lm.position.set(
        hx,
        tower ? tower.cy : hornY + hz.h / 2 + HORN_LIFT_IN,
        tower ? tower.z : mount.d / 2 - hz.d + 1,
      );
      ctx.group.add(lm);
      const th = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.6, 4, 32), black);
      th.rotation.x = Math.PI / 2;
      th.position.set(hx, lm.position.y, tower ? tower.z - 2 : -2.2);
      ctx.group.add(th);
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
        bevelThickness: 1.2,
        bevelSegments: 6,
      });
      const hornMesh = new THREE.Mesh(hornGeo, cream);
      hornMesh.position.set(
        hx,
        tower ? tower.cy : hornY + PLAIN_HORN_LIFT_IN + rh,
        tower ? tower.z : -hz.d / 2 + 2,
      );
      ctx.group.add(hornMesh);
      const throat = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.6, 4, 32), black);
      throat.rotation.x = Math.PI / 2;
      throat.position.set(hx, hornMesh.position.y, tower ? tower.z - 2.5 : -hz.d / 2 - 0.5);
      ctx.group.add(throat);
    }
  });
  const lift = horn.rect || horn.profile ? HORN_LIFT_IN : PLAIN_HORN_LIFT_IN + PLAIN_HORN_BEVEL_IN;
  return { top: hornY + (tower ? tower.sectionH : lift + hz.h) };
}
