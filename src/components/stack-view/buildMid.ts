import { circlePath } from "./geometry";
import { buildCabinet } from "./buildCabinet";
import { buildCone } from "./buildCone";
import type { SceneContext } from "./sceneContext";
import type { BoxBracing, Dims3, MidDriver } from "../../types";
import { buildBraces } from "./buildBraces";

/**
 * The mid-bass cube with its driver, one per x. With `baffleZ` the mid sits behind an existing baffle (the tower's)
 * and only its cone is built. Returns the y of the box's top.
 */
export function buildMid(
  ctx: SceneContext,
  {
    mid,
    box,
    y,
    xs = [0],
    baffleZ,
    bracing,
  }: {
    mid: Pick<MidDriver, "size">;
    box: Dims3;
    y: number;
    xs?: number[];
    baffleZ?: number;
    /** the box's braces and ribs (lib/bracing), drawn inside each box */
    bracing?: BoxBracing | null;
  },
): { top: number } {
  const r = mid.size / 2 - 0.9;
  xs.forEach((x) => {
    const z =
      baffleZ ?? buildCabinet(ctx, { dims: box, baffleHoles: [circlePath(0, 0, r)], y, x }).baffleZ;
    if (bracing && baffleZ === undefined)
      buildBraces(ctx, { bracing, box, y, x, parent: ctx.group });
    buildCone(ctx, { r, y: y + box.h / 2, z, x });
  });
  return { top: y + box.h };
}
