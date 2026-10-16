// A horn design's response by its layout: the horn engine (lib/acoustics/hornModel) for a front-loaded horn or a
// direct radiator, the acoustic network's presets (lib/acoustics/network/presets) for an offset or tapped horn. Both
// take the box models' losses. Pure.
import type { HornLayoutDesign, HornModel } from "../../types";
import { hornModel } from "../acoustics/hornModel";
import { hornLayoutNetwork, presetModel } from "../acoustics/network/presets";
import { HORN_LAYOUT } from "../../constants/acousticNetwork";

/** The design's response at `volts` on `freqs`; null when the engine cannot model it. */
export function hornLayoutModel(
  design: HornLayoutDesign,
  freqs: readonly number[],
  volts: number,
): HornModel | null {
  if (design.layout === HORN_LAYOUT.frontLoaded) return hornModel(design, freqs, volts);
  const preset = hornLayoutNetwork(design);
  return preset && presetModel(preset, freqs, volts);
}
