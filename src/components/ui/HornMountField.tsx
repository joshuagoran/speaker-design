import { ToggleGroup } from "./ToggleGroup";
import {
  HORN_MOUNT_LABEL,
  HORN_MOUNT_NAMES,
  HORN_MOUNT_PLY,
  HORN_MOUNT_PLY_UNAVAILABLE,
} from "../../constants/hornMount";
import { keysOf } from "../../lib/records";
import type { HornMountChoice } from "../stack-view/hornMountChoice";
import type { HornMountId } from "../../types";

interface Props {
  choice: HornMountChoice;
  onChange: (mount: HornMountId) => void;
  className?: string;
}

/** The horn mount setting (aluminum plate or plywood), the ply shown off where the driver's bolts don't fit it. */
export function HornMountField({ choice, onChange, className }: Props) {
  return (
    <ToggleGroup
      label={HORN_MOUNT_LABEL}
      value={choice.shown}
      onChange={onChange}
      disabled={
        choice.plyFits ? undefined : { values: [HORN_MOUNT_PLY], why: HORN_MOUNT_PLY_UNAVAILABLE }
      }
      options={keysOf(HORN_MOUNT_NAMES).map(
        (id) => [id, HORN_MOUNT_NAMES[id], choice.tips[id]] as const,
      )}
      className={className}
    />
  );
}
