// The stack's vertical dimensions, in inches. The scene builders place things with these constants and the planner reports
// heights from `stackHeights`, so the two cannot drift apart.
import type { Dims3, Horn, PaLayout } from "../../types";
import { HORN_MESHES } from "../../data/meshes";
import { MM_IN } from "./geometry";
import { towerSpec } from "../../lib/pa/tower";

/** Roundover on the cabinet frame's edges; it also pushes the frame's outline out by this much. */
export const ROUNDOVER_IN = 0.25;
/** Gap between the sub's top and the mid box in the stack layout. */
export const MID_GAP_IN = 0.4;
/** Satellite layout: the stands' height, which is where the mid boxes sit. */
export const SATELLITE_COLUMN_H_IN = 34;
/** The horn sits this far above the mid box (its axis = this + hornAxisUp). */
export const HORN_LIFT_IN = 0.3;

/**
 * How far a horn's axis is above its bottom: half its height, or for a horn drawn from its mesh, how far the mesh's
 * origin (the driver's axis) is above its lowest point. The planner's heights and the 3D view both use it.
 */
export const hornAxisUp = (horn: Horn) => {
  const model = HORN_MESHES[horn.id];
  return model ? -model.min[1] * MM_IN : horn.size.h / 2;
};

/** Where the mid box and horn sit and how tall the stack is, as the 3D scene draws them. */
export function stackHeights({
  layout,
  plinth,
  subBox,
  midBox,
  horn,
  wall,
  spacerH,
}: {
  layout: PaLayout;
  plinth: number;
  subBox: Dims3;
  /** the mid chamber's size (in the tower, lib/pa/tower `towerMidDims`) */
  midBox: Dims3;
  horn: Horn;
  wall: number;
  spacerH: number;
}) {
  const subTop = plinth + subBox.h;
  const isTower = layout === "tower";
  const base =
    layout === "satellite"
      ? SATELLITE_COLUMN_H_IN
      : layout === "pole"
        ? subTop + spacerH
        : isTower
          ? subTop
          : subTop + MID_GAP_IN;
  const tower = isTower ? towerSpec(subBox, wall, horn) : null;
  return {
    subTop,
    /** where the mid box starts */
    base,
    hasArchedTop: !!tower?.archTop,
    stack: tower
      ? plinth + tower.height + ROUNDOVER_IN
      : base + midBox.h + HORN_LIFT_IN + horn.size.h,
    hornCenter: tower
      ? plinth + tower.hornCenter
      : base + midBox.h + HORN_LIFT_IN + hornAxisUp(horn),
    midCenter: tower ? plinth + tower.midCenter : base + midBox.h / 2,
  };
}
