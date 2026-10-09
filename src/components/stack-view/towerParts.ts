import * as THREE from "three";
import { roundedRectPath, circlePath, partMeshSilhouette, polygonPath } from "./geometry";
import { HORN_MESHES } from "../../data/meshes";
import { towerHornCutout, towerSpec, TOWER_HORN_WALL_GAP_IN } from "../../lib/pa/tower";
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
  const spec = towerSpec(box, ctx.wall, horn);
  const hy = plinth + spec.hornCenter - baffleCy;
  // a horn drawn from its mesh: the hole follows its silhouette round its axis, and like the full-width concept's it
  // stops half an inch inside the side walls (a hole past the baffle's edge would leave the baffle untriangulated)
  const model = HORN_MESHES[horn.id];
  const cut = towerHornCutout(box, ctx.wall, horn);
  const halfW = (box.w - 2 * ctx.wall) / 2 - TOWER_HORN_WALL_GAP_IN;
  return [
    circlePath(0, plinth + spec.midCenter - baffleCy, mid.size / 2 - 0.9),
    model
      ? polygonPath(
          0,
          hy,
          partMeshSilhouette(model).map(
            (p) => new THREE.Vector2(THREE.MathUtils.clamp(p.x, -halfW, halfW), p.y),
          ),
        )
      : cut.shape === "circle"
        ? circlePath(0, hy, cut.w / 2)
        : roundedRectPath(0, hy, cut.w, cut.h, cut.r),
  ];
}

/** Internal partitions: the sub/mid floor, the mid/horn floor (towerSpec's), each with its top face at its height. */
export function buildTowerPartitions(
  ctx: SceneContext,
  { box, plinth, horn, parent }: { box: Dims3; plinth: number; horn: Horn; parent: THREE.Object3D },
) {
  const T = ctx.wall;
  const innerW = box.w - 2 * T;
  const zF = box.d / 2 - ctx.inset - 0.75,
    zB = -box.d / 2 + T,
    dep = zF - zB;
  towerSpec(box, T, horn).partitions.forEach((top) => {
    const pp = new THREE.Mesh(new THREE.BoxGeometry(innerW, T, dep), ctx.materials.inner);
    pp.position.set(0, plinth + top - T / 2, (zF + zB) / 2);
    parent.add(pp);
  });
}
