// The PA presets' band Levels, dB: the PA page's music balance for its starting design (DEFAULT_PA) in each layout,
// worked out once by lib/speaker/paBalance `paBandLevels` and saved here (docs/speaker-designer-plan.md, L3f "Band
// levels in the preset"). The Stack and Space pages' PA presets read them (src/pages/stack/stackPresets).
//
// Generated: `vp run preset-levels` (tests/update-preset-levels.ts) rewrites this file after a change to the starting
// design or the models; tests/stack-presets.test.ts fails when a rewrite would change it. Do not edit by hand.
import type { PaBandLevels } from "../../lib/speaker/paBalance";
import type { PaLayout } from "../../types";

export const PA_PRESET_BAND_LEVELS: Record<PaLayout, PaBandLevels> = {
  stack: { low: 0, mid: -3.847, high: -19.909 },
  pole: { low: 0, mid: -3.847, high: -19.909 },
  tower: { low: 0, mid: -3.26, high: -19.353 },
  satellite: { low: 0, mid: -3.847, high: -19.909 },
};
