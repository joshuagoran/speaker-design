// The horn mount a driver bolted straight to its horn on a lid shows: the plywood mount only when the driver's bolts fit
// it, else the aluminum plate; the plate, when no bolt can pass through it, gives way to the clamped L-bracket. The 3D
// view draws the same (buildHorn), so the setting and the summaries show what it draws. The Speaker page's driver
// settings read it.
import { plyMountFit } from "./buildPlyMount";
import { plateFit } from "./buildPlate";
import {
  CLAMPED_BRACKET_NAME,
  HORN_MOUNT_DEFAULT,
  HORN_MOUNT_NAMES,
  HORN_MOUNT_PLATE,
  HORN_MOUNT_PLATE_FALLBACK,
  HORN_MOUNT_TIPS,
} from "../../constants/hornMount";
import type { CompressionDriver, Horn, HornMountId } from "../../types";

/** What the mount setting shows for a horn and driver on a lid `mouthW` wide (the box's width), set to `mount`. */
export function hornMountChoice(
  horn: Horn,
  cd: Pick<CompressionDriver, "body">,
  mouthW: number,
  mount: HornMountId,
) {
  const plyFits = plyMountFit(horn, cd, mouthW) !== null;
  const plateFits = plateFit(horn, cd, mouthW) !== null;
  const shown = plyFits ? mount : HORN_MOUNT_DEFAULT;
  return {
    plyFits,
    /** the mount drawn: the setting, or the plate where the ply doesn't fit */
    shown,
    /** its name in a summary: the clamped L-bracket where the plate takes no bolt */
    name: shown === HORN_MOUNT_PLATE && !plateFits ? CLAMPED_BRACKET_NAME : HORN_MOUNT_NAMES[shown],
    tips: {
      ...HORN_MOUNT_TIPS,
      ...(plateFits ? {} : { plate: HORN_MOUNT_PLATE_FALLBACK }),
    },
  };
}

/** What `hornMountChoice` returns. */
export type HornMountChoice = ReturnType<typeof hornMountChoice>;
