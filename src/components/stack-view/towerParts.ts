import * as THREE from "three";
import { roundedRectPath, circlePath, partMeshSilhouette, polygonPath } from "./geometry";
import { HORN_MESHES } from "../../data/meshes";
import {
  HORN_CUTOUT_SHAPE,
  towerHornCutout,
  TOWER_HORN_WALL_GAP_IN,
} from "../../lib/speaker/tower";
import type { Dims3, Horn } from "../../types";

/**
 * A PA horn's cutout in a baffle `box.w` wide inside walls `wall` thick, its axis at (x, y), as the tower opens it
 * (lib/speaker/tower towerHornCutout). A horn drawn from its mesh: the hole follows its silhouette round its axis, and like
 * the full-width concept's it stops half an inch inside the side walls (a hole past the baffle's edge would leave the
 * baffle untriangulated).
 */
export function hornBaffleHole(
  box: Pick<Dims3, "w">,
  wall: number,
  horn: Horn,
  x: number,
  y: number,
): THREE.Path {
  const model = HORN_MESHES[horn.id];
  const cut = towerHornCutout(box, wall, horn);
  const halfW = (box.w - 2 * wall) / 2 - TOWER_HORN_WALL_GAP_IN;
  return model
    ? polygonPath(
        x,
        y,
        partMeshSilhouette(model).map(
          (p) => new THREE.Vector2(THREE.MathUtils.clamp(p.x, -halfW, halfW), p.y),
        ),
      )
    : cut.shape === HORN_CUTOUT_SHAPE.circle
      ? circlePath(x, y, cut.w / 2)
      : roundedRectPath(x, y, cut.w, cut.h, cut.r);
}
