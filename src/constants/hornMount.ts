import { PANEL_NOMINAL_NAMES } from "./panelSizes";
import type { HornMountId, PanelNominal } from "../types";

/**
 * What holds the compression driver on the mid box's lid when it bolts straight to its horn (no throat adapter), by id,
 * and the name the setting and the Build summary show for each. The 3D view draws it (stack-view/buildPlyMount).
 */
export const HORN_MOUNT_NAMES = {
  bracket: "L-bracket",
  ply: "Plywood mount",
} as const;

/** The mount on first load, and for designs saved before the setting. */
export const HORN_MOUNT_DEFAULT = "bracket" satisfies HornMountId;

/** The plywood mount's nominal size: its upright, base and gusset are all cut from it. */
export const HORN_MOUNT_PANEL = "1/2" satisfies PanelNominal;

/** The setting's name, in the settings and the Build summary. */
export const HORN_MOUNT_LABEL = "Horn mount";

/** Each mount's tooltip, one short line. */
export const HORN_MOUNT_TIPS: Record<HornMountId, string> = {
  bracket: "1/8″ aluminum, clamped between the horn's throat flange and the driver.",
  ply: `${PANEL_NOMINAL_NAMES[HORN_MOUNT_PANEL].short} birch ply: an upright saddled under the horn's neck in front of the throat flange, bolted through the flange to the driver, on a base with a gusset.`,
};
