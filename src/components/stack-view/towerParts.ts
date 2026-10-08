import * as THREE from "three";
import { roundedRectPath, circlePath, partMeshSilhouette, polygonPath } from "./geometry";
import { HORN_MESHES } from "../../data/meshes";
import { towerSpec, TOWER_MID_HEIGHT_IN } from "./stackHeights";
import type { SceneContext } from "./sceneContext";
import type { Dims3, Horn, MidDriver } from "../../types";

/** The mid and horn cutouts on the tower's baffle; `baffleCy` is the absolute center of the baffle. */
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
  // a horn drawn from its mesh: the hole follows its silhouette round its axis
  const model = HORN_MESHES[horn.id];
  return [
    circlePath(0, plinth + box.h + TOWER_MID_HEIGHT_IN / 2 - baffleCy, mid.size / 2 - 0.9),
    model
      ? polygonPath(0, hy, partMeshSilhouette(model))
      : horn.rect
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
