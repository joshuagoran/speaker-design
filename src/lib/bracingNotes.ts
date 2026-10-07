// The notes under the PA Bracing setting: each panel a cabinet's bracing leaves under the target (lib/bracing's
// braceShortfalls), worded with the cabinet and the panel, then the driver rocking the baffle on its own weight where
// that is under the target too (constants/bracing).
import { braceShortfalls } from "./bracing";
import { formatHz } from "./format";
import { braceUnderNote, bracePanelName, driverOnBaffleNote } from "../constants/bracing";
import type { BoxBracing } from "../types";

/**
 * One line per panel under the target, each naming the cabinet (`cabinet`: "Sub") and the panel, and one for the driver
 * on the baffle when its mode is under the target.
 */
export function braceNoteLines(
  cabinet: string,
  b: Pick<BoxBracing, "panels" | "targetHz" | "driverOnBaffleHz">,
): string[] {
  const driver = b.driverOnBaffleHz;
  return [
    ...braceShortfalls(b).map((p) =>
      braceUnderNote(bracePanelName(cabinet, p.id), formatHz(p.hz), formatHz(b.targetHz)),
    ),
    ...(driver !== null && driver < b.targetHz - 1e-9
      ? [driverOnBaffleNote(cabinet, formatHz(driver))]
      : []),
  ];
}
