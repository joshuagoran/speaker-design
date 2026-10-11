// A chamber's clear face inside its walls, with the partition rule of `SpeakerChamber.dims`: two chambers that touch
// share one wall, the lower (or left) chamber's. Pure.
//
// Symbols kept short are the established ones: t is the wall's thickness, in (as lib/pa/calc and lib/hifi name it).
import type { Dims2, SpeakerCabinet, SpeakerChamber } from "../../types";

/** How close two edges count as touching, in. */
const TOUCH_IN = 1e-9;

/** Whether the spans [a0, a1] and [b0, b1] overlap by more than a point. */
const overlaps = (a0: number, a1: number, b0: number, b1: number) => a0 < b1 && b0 < a1;

/**
 * The chamber's clear width and height, in: its size less a wall on each side, except where another chamber of the
 * cabinet stands right under it or right left of it (that chamber's top or right wall is the partition). Any overlap
 * along the touching edge counts as a shared wall, a partial one too (a narrower box stacked in the same shell).
 */
export function chamberClearFace(
  cabinet: Pick<SpeakerCabinet, "chambers" | "panel">,
  chamber: SpeakerChamber,
): Dims2 {
  const t = cabinet.panel.thicknessIn;
  const { at, dims } = chamber;
  /** the cabinet's other chambers */
  const others = cabinet.chambers.filter((c) => c !== chamber);
  /** a chamber right under this one: its top wall is this one's floor */
  const below = others.some(
    (c) =>
      Math.abs(c.at.yIn + c.dims.h - at.yIn) < TOUCH_IN &&
      overlaps(c.at.xIn, c.at.xIn + c.dims.w, at.xIn, at.xIn + dims.w),
  );
  /** a chamber right left of this one: its right wall is this one's left side */
  const left = others.some(
    (c) =>
      Math.abs(c.at.xIn + c.dims.w - at.xIn) < TOUCH_IN &&
      overlaps(c.at.yIn, c.at.yIn + c.dims.h, at.yIn, at.yIn + dims.h),
  );
  return { w: dims.w - (left ? 1 : 2) * t, h: dims.h - (below ? 1 : 2) * t };
}
