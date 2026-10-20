// Where a new stack (Stack page) or space (Space page) starts: a preset, read in through the L1 adapters as speakers, a
// stack and a space. A PA preset takes its music balance from its saved band Levels
// (src/data/presets/pa-band-levels.ts). Pure.
import type { DesignLayers, PaLayout, SpecIdentity, StackDesign } from "../../types";
import { layersFromPa } from "../../lib/speaker/paSpec";
import { layersFromHifi } from "../../lib/speaker/hifiSpec";
import { withBandLevels } from "../../lib/speaker/paBalance";
import { DEFAULT_COVERAGE_LAYOUT } from "../../lib/acoustics/coverageLayout";
import { DEFAULT_HIFI, DEFAULT_HIFI_LOOK } from "../../lib/defaults";
import { PA_PRESET_BAND_LEVELS } from "../../data/presets/pa-band-levels";
import {
  EMPTY_START,
  STACK_PRESET,
  STACK_START_DESIGN_NAMES,
  STACK_START_GROUPS,
  STACK_START_NAMES,
  type DesignStart,
  type StackPreset,
} from "../../constants/stackPresets";
import { defaultPaDesign } from "../speaker/speakerTemplates";
import { DRAFT_STACK_ID, emptyStack } from "./stackSaves";

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

/** A start as "New from…" lists it on the Stack and Space pages: its id, its name, and its group. */
export interface DesignStartOption {
  id: DesignStart;
  name: string;
  group: string;
}

/** The starts "New from…" lists: the empty design under `emptyName`, then every preset. */
export const designStartOptions = (emptyName: string): readonly DesignStartOption[] => [
  { id: EMPTY_START, name: emptyName, group: STACK_START_GROUPS.presets },
  ...STACK_PRESETS.map((id) => ({
    id,
    name: STACK_START_NAMES[id],
    group: STACK_START_GROUPS.presets,
  })),
];

/** A new stack from a start: the empty stack, or a preset's, under the preset's name. Its id is the draft id: no save. */
export function stackFromStart(start: DesignStart): StackDesign {
  if (start === EMPTY_START) return emptyStack();
  const { stack, speakers } = presetLayers(start, {
    id: DRAFT_STACK_ID,
    name: STACK_START_DESIGN_NAMES[start],
  });
  return { stack, speakers };
}
