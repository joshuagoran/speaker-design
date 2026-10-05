import type { HifiPlanner } from "../hifi/useHifiPlanner";
import { hifiCutParts } from "../../lib/hifi/cutlist";
import { RADIATOR_PANEL } from "../../lib/hifi/hifi";
import { CutlistPage } from "./CutlistPage";
import { useHifiCutlistOptions } from "./useHifiCutlistOptions";

interface Props {
  hifi: Pick<
    HifiPlanner,
    "speakerConfig" | "woofer" | "tweeterWithWaveguide" | "wallThicknessIn" | "panelMaterial"
  >;
}

/** The Hi-fi speaker's Cutlist page: the Hi-fi page's box as a pair, with its own cutlist choices. */
export function HifiCutlistPage({ hifi }: Props) {
  const options = useHifiCutlistOptions();
  const { parts, also } = hifiCutParts({
    cfg: hifi.speakerConfig,
    woofer: hifi.woofer,
    tweeter: hifi.tweeterWithWaveguide,
    joint: options.cornerJoint,
    prPanel: RADIATOR_PANEL,
  });
  return (
    <CutlistPage
      project="hifi"
      options={options}
      parts={parts}
      also={also}
      wall={hifi.wallThicknessIn}
      material={hifi.panelMaterial}
    />
  );
}
