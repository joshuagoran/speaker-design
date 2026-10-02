import * as THREE from "three";
import { roundedRectPath, circlePath } from "./geometry";
import type { SceneContext } from "./sceneContext";
import type { Dims3, Horn, MidDriver } from "../../types";

/** Height of the tower's mid chamber, inches. */
export const TOWER_MID_HEIGHT_IN = 15.5;

/**
 * The tower is one shell and one continuous baffle over the sub's footprint: sub, mid chamber and horn section stacked and
 * divided internally. `archTop` puts a semicircular top on it when the round horn is narrower than the cabinet.
 */
export function towerSpec(box: Dims3, wall: number, horn: Horn) {
  const archTop = !!horn.profile && !horn.scaleX && box.w / 2 - wall > horn.size.w / 2;
  // arched: horn centered on the arch, equal margin below and around it
  const hornSectionH = archTop ? box.w / 2 - wall + box.w / 2 : horn.size.h + 2;
  return { archTop, hornSectionH, extH: TOWER_MID_HEIGHT_IN + hornSectionH };
}

/** The mid and horn cutouts on the tower's baffle; `baffleCy` is the absolute centre of the baffle. */
export function towerBaffleHoles(
  ctx: SceneContext,
  {
    box,
    plinth,
    mid,
    horn,
    baffleCy,
  }: { box: Dims3; plinth: number; mid: Pick<MidDriver, "size">; horn: Horn; baffleCy: number },
): THREE.Path[] {
  const { archTop, hornSectionH } = towerSpec(box, ctx.wall, horn);
  const innerW = box.w - 2 * ctx.wall;
  const hy =
    (archTop
      ? plinth + box.h + TOWER_MID_HEIGHT_IN + (box.w / 2 - ctx.wall)
      : plinth + box.h + TOWER_MID_HEIGHT_IN + hornSectionH / 2) - baffleCy;
  return [
    circlePath(0, plinth + box.h + TOWER_MID_HEIGHT_IN / 2 - baffleCy, mid.size / 2 - 0.9),
    horn.rect
      ? roundedRectPath(0, hy, innerW - 1, horn.size.h, 1.2)
      : horn.profile
        ? circlePath(0, hy, Math.min(horn.size.w, horn.size.h) / 2 - 0.2)
        : roundedRectPath(0, hy, horn.size.w, horn.size.h, 1),
  ];
}

/** Internal partitions: the sub/mid floor, the mid/horn floor. */
export function buildTowerPartitions(
  ctx: SceneContext,
  { box, plinth, parent }: { box: Dims3; plinth: number; parent: THREE.Object3D },
) {
  const T = ctx.wall;
  const innerW = box.w - 2 * T;
  const zF = box.d / 2 - ctx.inset - 0.75,
    zB = -box.d / 2 + T,
    dep = zF - zB;
  [plinth + box.h - T / 2, plinth + box.h + TOWER_MID_HEIGHT_IN - T / 2].forEach((py) => {
    const pp = new THREE.Mesh(new THREE.BoxGeometry(innerW, T, dep), ctx.materials.inner);
    pp.position.set(0, py, (zF + zB) / 2);
    parent.add(pp);
  });
}
