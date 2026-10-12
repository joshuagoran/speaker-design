// Where a new stack (Stack page) or space (Space page) starts: a preset or the current PA design, read in through the L1
// adapters as speakers, a stack and a space. A PA preset takes its music balance from its saved band Levels
// (src/data/presets/pa-band-levels.ts); the current PA design has it worked out once, here, as it is read in
// (lib/speaker/paBalance). Pure.
import type { DesignLayers, PaLayout, PaPlannerDesign, SpecIdentity } from "../../types";
import { layersFromPa, type PaFloor } from "../../lib/speaker/paSpec";
import { layersFromHifi } from "../../lib/speaker/hifiSpec";
import { paBalancedLayers, withBandLevels } from "../../lib/speaker/paBalance";
import { DEFAULT_COVERAGE_LAYOUT } from "../../lib/pa/coverageLayout";
import { DEFAULT_HIFI, DEFAULT_HIFI_LOOK } from "../../lib/defaults";
import { PA_PRESET_BAND_LEVELS } from "../../data/presets/pa-band-levels";
import {
  STACK_START,
  STACK_START_GROUPS,
  type StackPreset,
  type StackStart,
} from "../../constants/stackPresets";
import { defaultPaDesign } from "../speaker/speakerTemplates";

/** The PA layout each PA preset takes. */
const PA_PRESET_LAYOUTS = {
  paStack: "stack",
  paPole: "pole",
  paSatellite: "satellite",
  paTower: "tower",
} as const satisfies Partial<Record<StackPreset, PaLayout>>;

/** A PA design read in on `floor`, its music balance worked out now and saved in its band Levels. */
export const paLayers = (cfg: PaPlannerDesign, identity: SpecIdentity, floor: PaFloor) =>
  paBalancedLayers(cfg, layersFromPa(cfg, identity, floor));

/** What the current-design start reads: the PA design as the PA page holds it, and the floor it stands on. */
export interface CurrentPa {
  pa: PaPlannerDesign;
  floor: PaFloor;
}

/** A PA preset: the PA page's starting design in `layout`, on the PA floor's starting layout, with its saved Levels. */
const paPreset = (layout: PaLayout, identity: SpecIdentity) =>
  withBandLevels(
    layersFromPa(defaultPaDesign(layout), identity, DEFAULT_COVERAGE_LAYOUT),
    PA_PRESET_BAND_LEVELS[layout],
  );

/**
 * The layers a start gives under `identity`: a PA preset, the Hi-fi pair (the Hi-fi page's starting design), or the
 * current PA design on its floor.
 */
export function startLayers(
  start: StackStart,
  identity: SpecIdentity,
  current: CurrentPa,
): DesignLayers {
  switch (start) {
    case STACK_START.hifiPair:
      return layersFromHifi(DEFAULT_HIFI, DEFAULT_HIFI_LOOK, identity);
    case STACK_START.paCurrent:
      return paLayers(current.pa, identity, current.floor);
    default:
      return paPreset(PA_PRESET_LAYOUTS[start], identity);
  }
}

/** Every start the picker lists, in order: the presets, then the current PA design. */
export const STACK_STARTS: readonly StackStart[] = Object.values(STACK_START);

/** The picker's group a start is listed under. */
export const startGroup = (start: StackStart) =>
  start === STACK_START.paCurrent ? STACK_START_GROUPS.current : STACK_START_GROUPS.presets;
