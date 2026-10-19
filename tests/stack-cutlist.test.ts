// The Stack page's Cutlist tab (lib/speaker/stackBuild) on the PA presets against the PA box models' cutlist
// (lib/acoustics/boxModels cutParts): the same pieces, so the same sheets, with each member's boxes tagged apart.
import { describe, expect, test } from "vite-plus/test";
import { cutParts } from "../src/lib/acoustics/boxModels";
import { layoutCutlist, CUTLIST_DEFAULTS } from "../src/lib/build/cutlist";
import { stackCutParts } from "../src/lib/speaker/stackBuild";
import { presetLayers } from "../src/pages/stack/stackPresets";
import { defaultPaDesign } from "../src/pages/speaker/speakerTemplates";
import { HORN_OPTIONS, MID_OPTIONS, SUB_OPTIONS } from "../src/lib/data";
import { STACK_PRESET } from "../src/constants/stackPresets";
import { cutBoxName, cutBoxTag } from "../src/constants/cutParts";
import type { CornerJoint, CutPart, CutlistSettings, PaLayout } from "../src/types";

/** The presets whose boxes the PA box models cut as the speakers do (the tower's mid chamber takes the rule's braces too). */
const PRESETS = [
  [STACK_PRESET.paStack, "stack"],
  [STACK_PRESET.paPole, "pole"],
  [STACK_PRESET.paSatellite, "satellite"],
] as const satisfies readonly (readonly [string, PaLayout])[];

/** A cutlist's pieces by part and size, whatever the box, row and note: each part's count at each size. */
function pieces(parts: readonly CutPart[]) {
  const out = new Map<string, number>();
  for (const p of parts) {
    const k = `${p.part} ${p.a.toFixed(4)} × ${p.b.toFixed(4)} × ${p.t.toFixed(4)}`;
    out.set(k, (out.get(k) ?? 0) + p.qty);
  }
  return out;
}

const SETTINGS: CutlistSettings = { ...CUTLIST_DEFAULTS, joint: "butt", sheet: "4x8", stacks: 1 };

describe("Stack cutlist: the PA presets cut as the PA box models cut them", () => {
  for (const [preset, layout] of PRESETS)
    for (const joint of ["butt", "rabbet", "miter"] as const satisfies readonly CornerJoint[])
      test(`${preset} (${joint})`, () => {
        const cfg = defaultPaDesign(layout);
        const { stack, speakers } = presetLayers(preset, { id: "test", name: "test" });
        const ours = stackCutParts(stack, speakers, joint, {}).parts;
        const sub = SUB_OPTIONS.find((o) => o.id === cfg.sub);
        const mid = MID_OPTIONS.find((o) => o.id === cfg.mid);
        const horn = HORN_OPTIONS.find((o) => o.id === cfg.horn);
        if (!sub || !mid || !horn) throw new Error(`${preset}: a part is missing from the catalog`);
        const page = cutParts({
          sub,
          mid,
          subBox: cfg.cDim,
          midDims: cfg.mDim,
          wall: cfg.wall,
          inset: cfg.inset,
          joint,
          portStyle: cfg.portStyle,
          cVent: cfg.cVent,
          layout,
          braceStyle: cfg.braceStyle,
          backJoint: cfg.backJoint,
          hardware: cfg.hardware,
          horn,
        }).parts;
        expect(Object.fromEntries(pieces(ours))).toEqual(Object.fromEntries(pieces(page)));
        // the same pieces on the same sheets
        const sheets = (parts: CutPart[]) =>
          layoutCutlist(parts, { ...SETTINGS, joint }, { countsOnly: true }).groups.reduce(
            (n, g) => n + g.sheets.length,
            0,
          );
        expect(sheets(ours)).toBe(sheets(page));
        // each member's boxes named and tagged apart
        const boxes = [...new Set(ours.map((p) => p.box))];
        expect(new Set(boxes.map(cutBoxTag)).size).toBe(boxes.length);
        expect(boxes.map(cutBoxName)).toEqual(boxes.map((_, k) => `Box ${k + 1}, chamber 1`));
      });
});
