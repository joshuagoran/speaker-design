// The tower layout's cabinet: one shell and one continuous baffle over the sub's footprint, the sub, the mid chamber and
// the horn section stacked and divided internally. The 3D view, the cutlist, the weights and the cards' front view all
// read it from here, so they cannot drift apart.
import type { Dims3, TowerHorn, TowerSpec } from "../../types";
import { TOWER_MID_HEIGHT_IN } from "../../constants/paLayouts";
import { MESHED_HORN_IDS } from "../../data/meshes/meshedHorns";

/** The tower's mid chamber: the sub's footprint, `TOWER_MID_HEIGHT_IN` tall. */
export const towerMidDims = (subBox: Pick<Dims3, "w" | "d">): Dims3 => ({
  w: subBox.w,
  h: TOWER_MID_HEIGHT_IN,
  d: subBox.d,
});

/**
 * The tower's cabinet over the sub box `box`: `archTop` puts a semicircular top on it when the round horn is narrower
 * than the cabinet, and the horn sits centered on the arch, with equal margin below and around it; otherwise the horn
 * section is the horn's height and an inch above and below. Heights are up from the cabinet's bottom.
 */
export function towerSpec(
  box: Pick<Dims3, "w" | "h">,
  wall: number,
  horn: Pick<TowerHorn, "profile" | "size">,
): TowerSpec {
  const archTop =
    !!horn.profile && horn.size.w === horn.size.h && box.w / 2 - wall > horn.size.w / 2;
  const hornSectionH = archTop ? box.w / 2 - wall + box.w / 2 : horn.size.h + 2;
  const extH = TOWER_MID_HEIGHT_IN + hornSectionH;
  const midTop = box.h + TOWER_MID_HEIGHT_IN;
  return {
    archTop,
    hornSectionH,
    extH,
    height: box.h + extH,
    partitions: [box.h, midTop],
    midCenter: box.h + TOWER_MID_HEIGHT_IN / 2,
    hornCenter: midTop + (archTop ? box.w / 2 - wall : hornSectionH / 2),
  };
}

/** The corner radius of a rectangular horn's baffle cutout in the tower, in. */
const TOWER_RECT_HORN_RADIUS_IN = 1.2;
/** The corner radius of a horn's cutout drawn at its listed mouth size, in. */
const TOWER_HORN_RADIUS_IN = 1;
/** How far a round horn's cutout is inside its mouth, in (on the radius). */
const TOWER_ROUND_HORN_INSET_IN = 0.2;
/** How far a meshed or rectangular horn's cutout stays inside each side wall, in. */
export const TOWER_HORN_WALL_GAP_IN = 0.5;

/**
 * The horn's cutout in the tower's baffle, as the 3D view opens it (stack-view/towerParts): a horn drawn from its mesh
 * follows its silhouette, kept half an inch inside the side walls (`outline`, its bounds here); a rectangular mouth
 * runs the width inside the walls less an inch; a round one is a circle just inside the mouth; any other is its mouth
 * size. A meshed horn's bounds are its catalog size (its mesh's); `area` (in²) takes an outline as the ellipse in them.
 */
export function towerHornCutout(
  box: Pick<Dims3, "w">,
  wall: number,
  horn: TowerHorn,
): { shape: "outline" | "rect" | "circle"; w: number; h: number; r: number; area: number } {
  const innerW = box.w - 2 * wall;
  const rounded = (w: number, h: number, r: number) => w * h - (4 - Math.PI) * r * r;
  if (MESHED_HORN_IDS.has(horn.id)) {
    const w = Math.min(horn.size.w, innerW - 2 * TOWER_HORN_WALL_GAP_IN),
      h = horn.size.h;
    return { shape: "outline", w, h, r: 0, area: (Math.PI / 4) * w * h };
  }
  if (horn.rect) {
    const w = innerW - 2 * TOWER_HORN_WALL_GAP_IN,
      h = horn.size.h,
      r = TOWER_RECT_HORN_RADIUS_IN;
    return { shape: "rect", w, h, r, area: rounded(w, h, r) };
  }
  if (horn.profile) {
    const d = Math.min(horn.size.w, horn.size.h) - 2 * TOWER_ROUND_HORN_INSET_IN;
    return { shape: "circle", w: d, h: d, r: d / 2, area: (Math.PI / 4) * d * d };
  }
  const r = TOWER_HORN_RADIUS_IN;
  return {
    shape: "rect",
    w: horn.size.w,
    h: horn.size.h,
    r,
    area: rounded(horn.size.w, horn.size.h, r),
  };
}
