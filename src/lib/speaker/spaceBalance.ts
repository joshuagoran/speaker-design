// The Space page's target across the bands and where it is measured (the PA Coverage page's "Measured at" and music
// balance, lib/pa/coverage balancedTarget and useCoverageMap). Pure.
//
// The target is the venue's level in the lowest band. Each band above a crossover of the space's stacks is the music
// balance's step lower there (lib/speaker/autoBalance tiltAt: flat 0 dB; the PA music tilt the mid below the sub at a
// sub crossover, the horn below the mid above it), so the PA presets' targets are the PA page's. A band's target is the
// target at its center (or at the one frequency). The reference the space is turned down to: the listening area's
// average, the listener, or the mean of the levels 1 m in front of each placement, on its aim.
import type { FloorPoint, SpaceDesign, SpaceVenue } from "../../types";
import { oneMeterSpot } from "../pa/coverage";
import { AUTO_BALANCE_TILT, tiltAt } from "./autoBalance";
import { placementStack, resolvedPlacement } from "./spaceLayout";
import { stackCrossoversHz } from "./stackResponse";
import type { AutoBalanceMode } from "../../constants/autoBalance";

/**
 * Every crossover the space plays, Hz, low to high, once each: of its stacks' members and their speakers' bands, and
 * between placements (a sub alone and the tops on their stands cross between their input ranges).
 */
export function spaceCrossoversHz(design: Pick<SpaceDesign, "space" | "stacks" | "speakers">) {
  const members = design.space.placements.flatMap(
    (_, k) =>
      placementStack(design, resolvedPlacement(design.space.placements, k).item)?.stack.members ??
      [],
  );
  return stackCrossoversHz({ members }, design.speakers);
}

/** The target at `f`, dB: the lowest band's, less the music balance's step at each crossover at or below `f`. */
export const spaceTargetAt = (
  targetDb: number,
  f: number,
  crossovers: readonly number[],
  balance: AutoBalanceMode,
) =>
  crossovers.reduce(
    (t, hz) => (hz <= f ? t - tiltAt(hz, AUTO_BALANCE_TILT[balance]) : t),
    targetDb,
  );

/** A placement's footprint as `oneMeterSpot` takes it: none, its spot is already its front. */
const FRONT_SPOT = { w: 0, d: 0 };

/**
 * The spots 1 m in front of each placement, ft: from its base's front center along its aim, at ear height (the PA
 * page's "1 m from the stacks", lib/pa/coverage oneMeterSpot), kept on the floor.
 */
export function oneMeterSpots(
  design: Pick<SpaceDesign, "space">,
  room: Pick<SpaceVenue["room"], "widthFt" | "lengthFt">,
): FloorPoint[] {
  return design.space.placements.map((_, k) => {
    const p = resolvedPlacement(design.space.placements, k);
    // its spot is its front: no depth to step past
    return oneMeterSpot({ x: p.x, y: p.y, aim: p.aim.yawDeg }, FRONT_SPOT, room);
  });
}
