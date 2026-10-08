// The horn mount setting: which designs it applies to, and what a saved design holds.
import { HORN_MOUNT_DEFAULT, HORN_MOUNT_NAMES } from "../../constants/hornMount";
import type { Horn, HornMountId, PaLayout } from "../../types";

const isHornMountId = (x: unknown): x is HornMountId =>
  typeof x === "string" && Object.hasOwn(HORN_MOUNT_NAMES, x);

/** A saved design's horn mount; a save from before the setting, or a bad value: the L-bracket. */
export const savedHornMount = (x: unknown): HornMountId =>
  isHornMountId(x) ? x : HORN_MOUNT_DEFAULT;

/**
 * Whether the horn mount setting applies: the driver bolts straight to the horn (no throat adapter, whose own flange
 * the bracket bolts to) and stands on a lid (the tower has none under the driver).
 */
export const takesHornMount = (horn: Pick<Horn, "adapter">, layout: PaLayout) =>
  !horn.adapter && layout !== "tower";
