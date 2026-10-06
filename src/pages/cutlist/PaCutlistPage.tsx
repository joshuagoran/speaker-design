import type { PaPlanner } from "../pa-stack/hooks/usePaPlanner";
import type { CutlistOptions } from "../pa-stack/hooks/useCutlistOptions";
import { cutParts } from "../../lib/pa/calc";
import { CutlistPage } from "./CutlistPage";

interface Props {
  planner: CutlistOptions &
    Pick<
      PaPlanner,
      | "subDriver"
      | "midDriver"
      | "subBox"
      | "effectiveMidBoxDims"
      | "wallThicknessIn"
      | "baffleInsetIn"
      | "portStyle"
      | "subVentSpec"
      | "layout"
      | "braceStyle"
    >;
}

/** The PA stack's Cutlist page: the sub and mid boxes from the Design page, with the planner's cutlist choices. */
export function PaCutlistPage({ planner }: Props) {
  const { parts, vent } = cutParts({
    sub: planner.subDriver,
    mid: planner.midDriver,
    subBox: planner.subBox,
    midDims: planner.effectiveMidBoxDims,
    wall: planner.wallThicknessIn,
    inset: planner.baffleInsetIn,
    joint: planner.cornerJoint,
    portStyle: planner.portStyle,
    cVent: planner.subVentSpec,
    layout: planner.layout,
    braceStyle: planner.braceStyle,
  });
  return (
    <CutlistPage
      project="pa"
      options={planner}
      parts={parts}
      also={vent}
      wall={planner.wallThicknessIn}
      material="ply"
    />
  );
}
