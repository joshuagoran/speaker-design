// The notes under the PA Bracing setting: each panel a cabinet's bracing leaves under the target (lib/bracing's
// braceShortfalls), then each over a strength limit (strengthShortfalls), worded with the cabinet and the panel
// (constants/bracing).
import { braceShortfalls, strengthShortfalls } from "./bracing";
import { formatHz, formatStress } from "./format";
import {
  braceUnderNote,
  bracePanelName,
  STRENGTH_LOAD_NAMES,
  strengthNote,
} from "../constants/bracing";
import type { BoxBracing } from "../types";

/**
 * One line per panel under the target, then one per panel over a strength limit, each naming the cabinet (`cabinet`:
 * "Sub") and the panel.
 */
export function braceNoteLines(
  cabinet: string,
  b: Pick<BoxBracing, "panels" | "targetHz">,
): string[] {
  return [
    ...braceShortfalls(b).map((p) =>
      braceUnderNote(bracePanelName(cabinet, p.id), formatHz(p.hz), formatHz(b.targetHz)),
    ),
    ...strengthShortfalls(b).map((p) =>
      strengthNote(
        bracePanelName(cabinet, p.id),
        formatStress(p.stressPa),
        formatStress(p.limitPa),
        STRENGTH_LOAD_NAMES[p.load],
      ),
    ),
  ];
}
