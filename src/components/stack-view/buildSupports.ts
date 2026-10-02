import * as THREE from "three";
import type { SceneContext } from "./sceneContext";

/** Column diameter and height of the satellite layout's stands, inches. */
export const SATELLITE_COLUMN_D_IN = 8;
export const SATELLITE_COLUMN_H_IN = 34;

/**
 * Three-post spacer between the sub and the mid: 6 in discs top and bottom, three 1.25 in posts on a 4 in circle,
 * 35 mm spigots into the cabinets at each end. `y` is the sub's top, `rise` the spacer's height.
 */
export function buildPoleSpacer(
  ctx: SceneContext,
  { y, rise, parent }: { y: number; rise: number; parent: THREE.Object3D },
) {
  const { wood: birch, black } = ctx.materials;
  const DR = 3,
    DT = 1,
    PR = 0.625,
    PCIRC = 2,
    SPIG = 0.69;
  const yBot = y,
    yTop = y + rise;
  [yBot + DT / 2, yTop - DT / 2].forEach((yy) => {
    const d = new THREE.Mesh(new THREE.CylinderGeometry(DR, DR, DT, 44), birch); // cabinet finish
    d.position.set(0, yy, 0);
    parent.add(d);
  });
  const postLen = rise - 2 * DT;
  for (let i = 0; i < 3; i++) {
    const a = (i * 2 * Math.PI) / 3 + Math.PI / 6;
    const p = new THREE.Mesh(new THREE.CylinderGeometry(PR, PR, postLen, 28), birch);
    p.position.set(PCIRC * Math.cos(a), yBot + DT + postLen / 2, PCIRC * Math.sin(a));
    parent.add(p);
    // threaded rod up the middle of each post, visible in cutaway
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, rise, 12), black);
    rod.position.set(PCIRC * Math.cos(a), yBot + rise / 2, PCIRC * Math.sin(a));
    parent.add(rod);
  }
  // spigots buried in each cabinet
  [
    [yBot - 1.25, 2.5],
    [yTop + 1.25, 2.5],
  ].forEach(([yy, len]) => {
    const sp = new THREE.Mesh(new THREE.CylinderGeometry(SPIG, SPIG, len, 20), black);
    sp.position.set(0, yy, 0);
    parent.add(sp);
  });
}

/** The satellite layout's round stands (column, cap and base) at each x. */
export function buildSatelliteColumns(ctx: SceneContext, { xs }: { xs: number[] }) {
  const { wood: birch } = ctx.materials;
  const COL_D = SATELLITE_COLUMN_D_IN,
    COL_H = SATELLITE_COLUMN_H_IN;
  xs.forEach((x) => {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(COL_D / 2, COL_D / 2, COL_H, 40), birch);
    col.position.set(x, COL_H / 2, 0);
    ctx.group.add(col);
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(COL_D / 2 + 1, COL_D / 2 + 1, 1, 40),
      birch,
    );
    cap.position.set(x, COL_H + 0.5, 0);
    ctx.group.add(cap);
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(COL_D / 2 + 2.5, COL_D / 2 + 2.5, 1.5, 40),
      birch,
    );
    base.position.set(x, 0.75, 0);
    ctx.group.add(base);
  });
}
