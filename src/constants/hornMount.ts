import { PANEL_NOMINAL_NAMES } from "./panelSizes";
import type { HornMountId, PanelNominal } from "../types";

/**
 * What holds the compression driver on the mid box's lid when it bolts straight to its horn (no throat adapter), by id,
 * and the name the setting and the Build summary show for each. The 3D view draws it (stack-view/buildPlate,
 * stack-view/buildPlyMount).
 */
export const HORN_MOUNT_NAMES = {
  plate: "Aluminum plate",
  ply: "Plywood mount",
} as const;

/** The two mounts' ids, as code compares them. */
export const HORN_MOUNT_PLATE = "plate" satisfies HornMountId;
export const HORN_MOUNT_PLY = "ply" satisfies HornMountId;

/** The mount on first load, and for designs saved before the setting. */
export const HORN_MOUNT_DEFAULT = HORN_MOUNT_PLATE;

/** The retired clamped L-bracket's id: designs saved with it load with the aluminum plate, which replaced it. */
export const RETIRED_HORN_MOUNT_BRACKET = "bracket";

/** The plywood mount's nominal size: its upright, base and gusset are all cut from it. */
export const HORN_MOUNT_PANEL = "1/2" satisfies PanelNominal;

/** The aluminum's thickness, in: the plate's, and the L-bracket's (stack-view/buildBracket draws both). */
export const BRACKET_PLATE_IN = 0.125;
/** The plate's aluminum alloy. */
export const HORN_PLATE_ALLOY = "6061";
/** The clamped bracket that holds the driver when no driver bolt can pass through the plate. */
export const CLAMPED_BRACKET_NAME = "L-bracket";

/** A thickness of aluminum as the tips say it, e.g. 1/8″. */
const aluminumIn = `1/${Math.round(1 / BRACKET_PLATE_IN)}″`;

/** The setting's name, in the settings and the Build summary. */
export const HORN_MOUNT_LABEL = "Horn mount";

/** Each mount's tooltip, one short line. */
export const HORN_MOUNT_TIPS: Record<HornMountId, string> = {
  plate: `${aluminumIn} ${HORN_PLATE_ALLOY} aluminum in front of the throat flange, slotted for the neck and bolted through the flange to the driver, its foot bent back on the lid.`,
  ply: `${PANEL_NOMINAL_NAMES[HORN_MOUNT_PANEL].short} birch ply: an upright saddled under the horn's neck in front of the throat flange, bolted through the flange to the driver, on a base with a gusset.`,
};

/** The plate's tooltip when no driver bolt can pass through it (`plateFit` finds none), and what holds the driver. */
export const HORN_MOUNT_PLATE_FALLBACK = `No driver bolt has room for its washer on the plate beside this horn's neck, so a clamped ${aluminumIn} ${CLAMPED_BRACKET_NAME} holds the driver instead.`;

/** Why the plywood mount can't be picked for a horn and driver (`plyMountFit` finds no room), as its tooltip. */
export const HORN_MOUNT_PLY_UNAVAILABLE =
  "This driver's bolts sit too close to the horn's neck: none has room for its washer on the ply.";
