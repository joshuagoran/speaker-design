import { RADIATOR_PANEL, tweeterOffset } from "../../lib/hifi/hifi";
import type { HifiSceneProps } from "../../components/stack-view/buildHifiScene";
import type { HifiDesign, HifiDesignState, HifiSystem, SavedHifiConfig } from "../../types";

/**
 * What the Hi-fi page's 3D view draws for a design: the same numbers the model works on (the system's driver layout,
 * the tweeter offset it keeps on the baffle, the vent or radiators the box uses), the design's look, and the view's
 * cutaway.
 */
export function hifiSceneProps(
  state: Pick<
    HifiDesignState,
    "woofer" | "tweeter" | "selectedWaveguide" | "portSpec" | "roundoverIn"
  >,
  design: Pick<
    HifiDesign,
    "wallThicknessIn" | "waveguideSpec" | "radiator" | "speakerConfig" | "tweeterWithWaveguide"
  >,
  system: Pick<HifiSystem, "kind" | "lay">,
  look: Required<Pick<SavedHifiConfig, "cabFinish" | "baffleColor">>,
  cutaway: boolean,
): HifiSceneProps {
  const { waveguideSpec } = design;
  return {
    dim: design.speakerConfig.dim,
    wall: design.wallThicknessIn,
    roundoverIn: state.roundoverIn,
    woofer: state.woofer,
    tweeter: state.tweeter,
    lay: system.lay,
    tweeterOffsetIn: tweeterOffset(design.speakerConfig, design.tweeterWithWaveguide, system.lay),
    port: system.kind === "vented" ? state.portSpec : null,
    radiators: system.kind === "radiator" ? design.radiator : null,
    radiatorPanel: RADIATOR_PANEL,
    guide: waveguideSpec,
    waveguide: waveguideSpec && !state.tweeter.ownGuide ? state.selectedWaveguide : null,
    cabFinish: look.cabFinish,
    baffleColor: look.baffleColor,
    cutaway,
  };
}
