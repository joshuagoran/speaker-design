// The stack's vertical dimensions, in inches. The scene builders place things with these constants and the planner reports
// heights from `stackHeights`, so the two cannot drift apart.
import type { Dims3, Horn, PaLayout } from "../../types";

/** Roundover on the cabinet frame's edges; it also pushes the frame's outline out by this much. */
export const ROUNDOVER_IN = 0.25;
/** Gap between the sub's top and the mid box in the stack layout. */
export const MID_GAP_IN = 0.4;
/** Satellite layout: the stands' height, which is where the mid boxes sit. */
export const SATELLITE_COLUMN_H_IN = 34;
/** Height of the tower's mid chamber. */
export const TOWER_MID_HEIGHT_IN = 15.5;
/** A rect or lathe horn sits this far above the mid box (center = this + half its height). */
export const HORN_LIFT_IN = 0.3;
/** The plain flared block sits this far above the mid box, and its bevel adds `PLAIN_HORN_BEVEL_IN` on top. */
export const PLAIN_HORN_LIFT_IN = 2.2;
export const PLAIN_HORN_BEVEL_IN = 1.6;

/**
 * The tower is one shell and one continuous baffle over the sub's footprint: sub, mid chamber and horn section stacked and
 * divided internally. `archTop` puts a semicircular top on it when the round horn is narrower than the cabinet.
 */
export function towerSpec(box: Dims3, wall: number, horn: Horn) {
  const archTop =
    !!horn.profile && horn.size.w === horn.size.h && box.w / 2 - wall > horn.size.w / 2;
  // arched: horn centered on the arch, equal margin below and around it
  const hornSectionH = archTop ? box.w / 2 - wall + box.w / 2 : horn.size.h + 2;
  return { archTop, hornSectionH, extH: TOWER_MID_HEIGHT_IN + hornSectionH };
}

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
  /** the mid chamber's size (in the tower, the sub's footprint at `TOWER_MID_HEIGHT_IN`) */
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
  const { archTop, hornSectionH } = towerSpec(subBox, wall, horn);
  const hornLift = horn.rect || horn.profile ? HORN_LIFT_IN : PLAIN_HORN_LIFT_IN;
  return {
    subTop,
    /** where the mid box starts */
    base,
    hasArchedTop: isTower && archTop,
    stack: isTower
      ? base + TOWER_MID_HEIGHT_IN + hornSectionH + ROUNDOVER_IN
      : base +
        midBox.h +
        (horn.rect || horn.profile ? HORN_LIFT_IN : PLAIN_HORN_LIFT_IN + PLAIN_HORN_BEVEL_IN) +
        horn.size.h,
    hornCenter: isTower
      ? base + TOWER_MID_HEIGHT_IN + (archTop ? subBox.w / 2 - wall : (horn.size.h + 2) / 2)
      : base + midBox.h + hornLift + horn.size.h / 2,
    midCenter: isTower ? base + TOWER_MID_HEIGHT_IN / 2 : base + midBox.h / 2,
  };
}
