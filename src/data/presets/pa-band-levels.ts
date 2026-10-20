// The PA presets' band Levels, dB: the PA music balance of the default PA design (DEFAULT_PA) in each layout, worked
// out once by lib/speaker/autoBalance `autoBalanceStack` (lib/speaker/paBalance's balance to within 0.01 dB) and saved
// here. The Stack and Space pages' PA presets read them
// (src/pages/stack/stackPresets).
//
// Generated: `vp run preset-levels` (tests/update-preset-levels.ts) rewrites this file after a change to the starting
// design or the models; tests/stack-presets.test.ts fails when a rewrite would change it. Do not edit by hand.
import type { PaBandLevels } from "../../lib/speaker/paBalance";
import type { PaLayout } from "../../types";

export const PA_PRESET_BAND_LEVELS: Record<PaLayout, PaBandLevels> = {
  stack: { low: 0, mid: -3.866, high: -19.397 },
  pole: { low: 0, mid: -3.866, high: -19.397 },
  tower: { low: 0, mid: -3.339, high: -18.907 },
  satellite: { low: 0, mid: -3.866, high: -19.397 },
};
