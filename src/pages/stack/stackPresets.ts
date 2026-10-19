// Where a new stack (Stack page) or space (Space page) starts: a preset, read in through the L1 adapters as speakers, a
// stack and a space. A PA preset takes its music balance from its saved band Levels
// (src/data/presets/pa-band-levels.ts). Pure.
import type { DesignLayers, PaLayout, SpecIdentity } from "../../types";
import { layersFromPa } from "../../lib/speaker/paSpec";
import { layersFromHifi } from "../../lib/speaker/hifiSpec";
import { withBandLevels } from "../../lib/speaker/paBalance";
import { DEFAULT_COVERAGE_LAYOUT } from "../../lib/pa/coverageLayout";
import { DEFAULT_HIFI, DEFAULT_HIFI_LOOK } from "../../lib/defaults";
import { PA_PRESET_BAND_LEVELS } from "../../data/presets/pa-band-levels";
import { STACK_PRESET, type StackPreset } from "../../constants/stackPresets";
import { defaultPaDesign } from "../speaker/speakerTemplates";

/** The PA layout each PA preset takes. */
const PA_PRESET_LAYOUTS = {
  paStack: "stack",
  paPole: "pole",
  paSatellite: "satellite",
  paTower: "tower",
} as const satisfies Partial<Record<StackPreset, PaLayout>>;

/** A PA preset: the default PA design in `layout`, on the default floor layout, with its saved Levels. */
const paPreset = (layout: PaLayout, identity: SpecIdentity) =>
  withBandLevels(
    layersFromPa(defaultPaDesign(layout), identity, DEFAULT_COVERAGE_LAYOUT),
    PA_PRESET_BAND_LEVELS[layout],
  );

/** The layers a preset gives under `identity`: a PA preset, or the Hi-fi pair (the default Hi-fi design). */
export function presetLayers(preset: StackPreset, identity: SpecIdentity): DesignLayers {
  return preset === STACK_PRESET.hifiPair
    ? layersFromHifi(DEFAULT_HIFI, DEFAULT_HIFI_LOOK, identity)
    : paPreset(PA_PRESET_LAYOUTS[preset], identity);
}

/** Every preset, in the picker's order. */
export const STACK_PRESETS: readonly StackPreset[] = Object.values(STACK_PRESET);
