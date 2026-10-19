// The Stack page's phone strip (src/pages/stack/stackSummary) on the PA presets against the PA page's sub strip
// (src/pages/pa-stack/sections/MobileSummaryStrip): the same tuning, about the same level at 35 Hz, the same limit.
import { describe, expect, test } from "vite-plus/test";
import { derivePaDesign, paDesignInputsOf } from "../src/lib/pa/paDesign";
import { nearestPoint } from "../src/lib/pa/calc";
import { stackLimits, stackResponse } from "../src/lib/speaker/stackResponse";
import { stackTotals } from "../src/lib/speaker/speakerTotals";
import { stackSummary } from "../src/pages/stack/stackSummary";
import { presetLayers } from "../src/pages/stack/stackPresets";
import { defaultPaDesign } from "../src/pages/speaker/speakerTemplates";
import { STACK_PRESET } from "../src/constants/stackPresets";
import { LIMIT_NAMES } from "../src/constants/limits";
import { SUMMARY_LOW_HZ } from "../src/constants/summaryStrip";
import type { PaLayout } from "../src/types";

const PRESETS = [
  [STACK_PRESET.paStack, "stack"],
  [STACK_PRESET.paPole, "pole"],
  [STACK_PRESET.paSatellite, "satellite"],
  [STACK_PRESET.paTower, "tower"],
] as const satisfies readonly (readonly [string, PaLayout])[];

/**
 * How far apart the two 35 Hz levels may be, dB: the PA page's is the sub alone at its limits, the stack's the stack at
 * one input with its crossover ahead of the amps.
 */
const LOW_DB = 1;

describe("Stack phone strip: the PA presets read as the PA page's strip", () => {
  for (const [preset, layout] of PRESETS)
    test(preset, () => {
      const cfg = defaultPaDesign(layout);
      const page = derivePaDesign(paDesignInputsOf(cfg)).subModeled;
      expect(page).toBeTruthy();
      if (!page) return;
      const { stack, speakers } = presetLayers(preset, { id: "test", name: "test" });
      const response = stackResponse(stack, speakers);
      const items = stackSummary(
        response,
        stackLimits(stack, response),
        stackTotals(stack, speakers).lb,
      );
      expect(items).toBeTruthy();
      if (!items) return;
      const [fb, low, , limit] = items;
      expect(Math.abs(Number(fb[1]) - page.mdl.Fb)).toBeLessThan(0.051);
      const pageLow = nearestPoint(page.maxCurve, SUMMARY_LOW_HZ).spl;
      expect(Math.abs(Number(low[1]) - pageLow)).toBeLessThanOrEqual(LOW_DB);
      expect(limit[1]).toBe(LIMIT_NAMES[page.lim.who]);
    });
});
