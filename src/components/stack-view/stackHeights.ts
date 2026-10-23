// The stack's vertical dimensions, in inches. The scene builders place things with these constants and the pages report
// heights from `stackHeights`, so the two cannot drift apart.
import type { Horn } from "../../types";
import { HORN_MESHES } from "../../data/meshes";
import { IN_PER_MM } from "../../constants/units";
/** Roundover on the cabinet frame's edges; it also pushes the frame's outline out by this much. */
export const ROUNDOVER_IN = 0.25;
/**
 * How far a horn's axis is above its bottom: half its height, or for a horn drawn from its mesh, how far the mesh's
 * origin (the driver's axis) is above its lowest point. The reported heights and the 3D view both use it.
 */
export const hornAxisUp = (horn: Horn) => {
  const model = HORN_MESHES[horn.id];
  return model ? -model.min[1] * IN_PER_MM : horn.size.h / 2;
};
