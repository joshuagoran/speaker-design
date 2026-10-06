// The notes under the PA Bracing setting: each panel a cabinet's bracing leaves under the target (lib/bracing's
// braceShortfalls), worded with the cabinet and the panel (constants/bracing).
import { braceShortfalls } from "./bracing";
import { formatHz } from "./format";
import { braceUnderNote, bracePanelName } from "../constants/bracing";
import type { BoxBracing } from "../types";

/** One line per panel under the target, each naming the cabinet (`cabinet`: "Sub") and the panel. */
export function braceNoteLines(
  cabinet: string,
  b: Pick<BoxBracing, "panels" | "targetHz">,
): string[] {
  return braceShortfalls(b).map((p) =>
    braceUnderNote(bracePanelName(cabinet, p.id), formatHz(p.hz), formatHz(b.targetHz)),
  );
}
