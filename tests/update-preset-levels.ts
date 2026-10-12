import { test } from "vite-plus/test";
import fs from "node:fs";
import { PRESET_LEVELS_FILE, presetLevels, presetLevelsText } from "./preset-levels";

// Rewrites src/data/presets/pa-band-levels.ts, which tests/stack-presets.test.ts checks: `vp run preset-levels`.
test("write src/data/presets/pa-band-levels.ts", () => {
  fs.writeFileSync(PRESET_LEVELS_FILE, presetLevelsText(presetLevels()));
});
