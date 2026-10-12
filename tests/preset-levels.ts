// The PA presets' band Levels as src/data/presets/pa-band-levels.ts saves them: `vp run preset-levels` writes the file
// (tests/update-preset-levels.ts), and tests/stack-presets.test.ts checks that a rewrite would not change it.
import { paBandLevels, type PaBandLevels } from "../src/lib/speaker/paBalance";
import { layersFromPa } from "../src/lib/speaker/paSpec";
import { DEFAULT_COVERAGE_LAYOUT } from "../src/lib/pa/coverageLayout";
import { defaultPaDesign } from "../src/pages/speaker/speakerTemplates";
import { keysOf } from "../src/lib/records";
import { PA_LAYOUT_NAMES } from "../src/constants/paLayouts";
import type { PaLayout } from "../src/types";

/** The file the Levels are saved in. */
export const PRESET_LEVELS_FILE = new URL("../src/data/presets/pa-band-levels.ts", import.meta.url);

/** The saved Levels' precision: a thousandth of a dB. */
const PER_DB = 1000;
/** A Level as the file saves it (never −0). */
const saved = (db: number) => Math.round(db * PER_DB) / PER_DB || 0;

/** Each PA layout's preset Levels, worked out now from the PA page's starting design, as the file saves them. */
export function presetLevels(): Record<PaLayout, PaBandLevels> {
  const out = {} as Record<PaLayout, PaBandLevels>; // boundary: filled for every layout just below
  for (const layout of keysOf(PA_LAYOUT_NAMES)) {
    const cfg = defaultPaDesign(layout);
    const levels = paBandLevels(
      cfg,
      layersFromPa(cfg, { id: "preset", name: "Preset" }, DEFAULT_COVERAGE_LAYOUT),
    );
    if (!levels)
      throw new Error(`The PA page can't balance its starting design in the ${layout} layout`);
    out[layout] = Object.fromEntries(Object.entries(levels).map(([band, db]) => [band, saved(db)]));
  }
  return out;
}

/** The whole file for these Levels. */
export const presetLevelsText = (levels: Record<PaLayout, PaBandLevels>) =>
  `// The PA presets' band Levels, dB: the PA page's music balance for its starting design (DEFAULT_PA) in each layout,
// worked out once by lib/speaker/paBalance \`paBandLevels\` and saved here (docs/speaker-designer-plan.md, L3f "Band
// levels in the preset"). The Stack and Space pages' PA presets read them (src/pages/stack/stackPresets).
//
// Generated: \`vp run preset-levels\` (tests/update-preset-levels.ts) rewrites this file after a change to the starting
// design or the models; tests/stack-presets.test.ts fails when a rewrite would change it. Do not edit by hand.
import type { PaBandLevels } from "../../lib/speaker/paBalance";
import type { PaLayout } from "../../types";

export const PA_PRESET_BAND_LEVELS: Record<PaLayout, PaBandLevels> = {
${entriesText(levels)}
};
`;

/** One line per layout: its Levels by band. */
const entriesText = (levels: Record<PaLayout, PaBandLevels>) =>
  keysOf(levels)
    .map(
      (layout) =>
        `  ${layout}: { ${Object.entries(levels[layout])
          .map(([band, db]) => `${band}: ${db}`)
          .join(", ")} },`,
    )
    .join("\n");
