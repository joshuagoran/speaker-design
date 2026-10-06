import type { PaPlanner } from "../pa-stack/hooks/usePaPlanner";
import type { CutlistOptions } from "../pa-stack/hooks/useCutlistOptions";
import { cutParts } from "../../lib/pa/calc";
import { CutlistPage } from "./CutlistPage";
import { PLYWOOD_MATERIAL } from "../../constants/panelSizes";
import { CUT_BOX_NAMES } from "../../constants/cutParts";

interface Props {
  planner: CutlistOptions &
    Pick<
      PaPlanner,
      | "subDriver"
      | "midDriver"
      | "subBox"
      | "effectiveMidBoxDims"
      | "wallThicknessIn"
      | "wallPanel"
      | "baffleInsetIn"
      | "portStyle"
      | "subVentSpec"
      | "layout"
      | "effectiveBraceStyle"
      | "hardware"
      | "subHardware"
      | "midHardware"
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
    braceStyle: planner.effectiveBraceStyle,
    hardware: planner.hardware,
  });
  // the parts each box is fitted with, from the catalogue (the panels' rows carry their cutouts)
  const fitted = [planner.subHardware, planner.midHardware].flatMap((plan) =>
    plan
      ? [
          `${CUT_BOX_NAMES[plan.box]} box hardware: ${plan.bought
            .map(
              ({ part, qty }) => `${qty} × ${part.name} ($${part.price.toFixed(2)}, ${part.src})`,
            )
            .join(", ")}`,
        ]
      : [],
  );
  return (
    <CutlistPage
      project="pa"
      options={planner}
      parts={parts}
      also={[...vent, ...fitted]}
      wall={planner.wallThicknessIn}
      panel={planner.wallPanel}
      material={PLYWOOD_MATERIAL}
    />
  );
}
