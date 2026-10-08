// The horn mount setting: which designs it applies to, and what a saved design holds.
import {
  HORN_MOUNT_DEFAULT,
  HORN_MOUNT_NAMES,
  RETIRED_HORN_MOUNT_BRACKET,
} from "../../constants/hornMount";
import type { Horn, HornMountId, PaLayout } from "../../types";

const isHornMountId = (x: unknown): x is HornMountId =>
  typeof x === "string" && Object.hasOwn(HORN_MOUNT_NAMES, x);

/**
 * A saved design's horn mount; a save from before the setting, one holding the retired L-bracket, or a bad value: the
 * aluminum plate.
 */
export const savedHornMount = (x: unknown): HornMountId =>
  x !== RETIRED_HORN_MOUNT_BRACKET && isHornMountId(x) ? x : HORN_MOUNT_DEFAULT;

/**
 * Whether the horn mount setting applies: the driver bolts straight to the horn (no throat adapter, whose own flange
 * the bracket bolts to) and stands on a lid (the tower has none under the driver).
 */
export const takesHornMount = (horn: Pick<Horn, "adapter">, layout: PaLayout) =>
  !horn.adapter && layout !== "tower";
