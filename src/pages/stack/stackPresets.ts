// Where a new stack (Stack page) or space (Space page) starts: a preset or the current PA design, read in through the L1
// adapters as speakers, a stack and a space. A PA design takes its music balance in its band Levels (lib/speaker/
// paBalance), worked out once here. Pure.
import type { DesignLayers, PaLayout, PaPlannerDesign, SpecIdentity } from "../../types";
import { layersFromPa, type PaFloor } from "../../lib/speaker/paSpec";
import { layersFromHifi } from "../../lib/speaker/hifiSpec";
import { paBalancedLayers } from "../../lib/speaker/paBalance";
import { DEFAULT_COVERAGE_LAYOUT } from "../../lib/pa/coverageLayout";
import { DEFAULT_HIFI, DEFAULT_HIFI_LOOK } from "../../lib/defaults";
import { keysOf } from "../../lib/records";
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

/** A PA design read in on `floor`, its music balance in the band Levels. */
export const paLayers = (cfg: PaPlannerDesign, identity: SpecIdentity, floor: PaFloor) =>
  paBalancedLayers(cfg, layersFromPa(cfg, identity, floor));

/** What the current-design start reads: the PA design as the PA page holds it, and the floor it stands on. */
export interface CurrentPa {
  pa: PaPlannerDesign;
  floor: PaFloor;
}

/**
 * The layers a start gives under `identity`: a PA preset (the PA page's starting design in its layout, on the PA floor's
 * starting layout), the Hi-fi pair (the Hi-fi page's starting design), or the current PA design on its floor.
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
      return paLayers(defaultPaDesign(PA_PRESET_LAYOUTS[start]), identity, DEFAULT_COVERAGE_LAYOUT);
  }
}

/** Every start the picker lists, in order: the presets, then the current PA design. */
export const STACK_STARTS: readonly StackStart[] = keysOf(STACK_START);

/** The picker's group a start is listed under. */
export const startGroup = (start: StackStart) =>
  start === STACK_START.paCurrent ? STACK_START_GROUPS.current : STACK_START_GROUPS.presets;
