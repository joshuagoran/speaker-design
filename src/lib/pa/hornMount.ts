// The horn mount setting: which designs it applies to, and what a saved design holds.
import {
  HORN_MOUNT_DEFAULT,
  HORN_MOUNT_NAMES,
  RETIRED_HORN_MOUNT_BRACKET,
} from "../../constants/hornMount";
import { HORN_PLACEMENT } from "../../constants/speakerSpec";
import type { Horn, HornMountId, HornPlacement, PaLayout } from "../../types";

const isHornMountId = (x: unknown): x is HornMountId =>
  typeof x === "string" && Object.hasOwn(HORN_MOUNT_NAMES, x);

/**
 * A saved design's horn mount; a save from before the setting, one holding the retired L-bracket, or a bad value: the
 * aluminum plate.
 */
export const savedHornMount = (x: unknown): HornMountId =>
  x !== RETIRED_HORN_MOUNT_BRACKET && isHornMountId(x) ? x : HORN_MOUNT_DEFAULT;

/**
 * Whether a horn mount applies to a horn where it sits: the driver bolts straight to the horn (no throat adapter, whose
 * own flange the bracket bolts to) and stands on a lid (a horn in the baffle has none under the driver).
 */
export const takesHornMountAt = (horn: Pick<Horn, "adapter">, placement: HornPlacement) =>
  !horn.adapter && placement === HORN_PLACEMENT.top;

/** Whether the PA design's horn mount setting applies: the tower has its horn in the baffle, the other layouts on a lid. */
export const takesHornMount = (horn: Pick<Horn, "adapter">, layout: PaLayout) =>
  takesHornMountAt(horn, layout === "tower" ? HORN_PLACEMENT.baffle : HORN_PLACEMENT.top);
