// The notes under the PA Bracing setting: where a cabinet's bracing departs from the style (lib/bracing's
// braceFallbacks), worded with the cabinet and the panel (constants/bracing).
import { braceFallbacks } from "./bracing";
import { formatHz } from "./format";
import { BRACE_FALLBACK_NOTES, bracePanelName } from "../constants/bracing";
import type { BoxBracing } from "../types";

/** One line per panel whose bracing departs from the style, each naming the cabinet (`cabinet`: "Sub") and the panel. */
export function braceNoteLines(
  cabinet: string,
  b: Pick<BoxBracing, "style" | "windows" | "ribs" | "panels" | "targetHz">,
): string[] {
  return braceFallbacks(b).map((f) => {
    const name = bracePanelName(cabinet, f.panel);
    // "under" always carries the panel's first mode (braceFallbacks); without one it reads as at the target
    return f.kind === "under"
      ? BRACE_FALLBACK_NOTES.under(name, formatHz(f.hz ?? b.targetHz), formatHz(b.targetHz))
      : BRACE_FALLBACK_NOTES[f.kind](name);
  });
}
