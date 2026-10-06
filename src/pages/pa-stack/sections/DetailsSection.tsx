import { DetailsDropdown } from "../../../components/ui/DetailsDropdown";
import { UI_TEXT } from "../../../constants/uiText";
import type { PaPlanner } from "../hooks/usePaPlanner";
import { FONT } from "../../../styles/fonts";
import { panelThicknessName } from "../../../lib/panel";

interface Props {
  planner: Pick<
    PaPlanner,
    | "subDriver"
    | "midDriver"
    | "hornOption"
    | "compressionDriver"
    | "subMidCrossoverHz"
    | "midHornCrossoverHz"
    | "wallThicknessIn"
    | "wallPanel"
    | "baffleInsetIn"
    | "effectiveMidBoxDims"
    | "subBox"
    | "port"
    | "subGrossLiters"
    | "subNetLiters"
    | "midBoxLiters"
    | "stackHeightIn"
    | "hornCenterHeightIn"
  >;
}

/** The Details drop-down: the written details of the sub, mid-bass cube and horn, and the parts' notes. */
export function DetailsSection({ planner }: Props) {
  const {
    subDriver,
    midDriver,
    hornOption,
    compressionDriver,
    subMidCrossoverHz,
    midHornCrossoverHz,
    wallThicknessIn,
    wallPanel,
    baffleInsetIn,
    effectiveMidBoxDims,
    subBox,
    port,
    subGrossLiters,
    subNetLiters,
    midBoxLiters,
    stackHeightIn,
    hornCenterHeightIn,
  } = planner;
  return (
    <div className="min-w-0" style={{ fontFamily: FONT }}>
      <DetailsDropdown summary={UI_TEXT.details}>
        <div>
          <span className="font-medium text-stone-900">Sub.</span> {subDriver.name} in a {subBox.w}×
          {subBox.h}×{subBox.d} in cabinet, {subGrossLiters.toFixed(0)} L gross,{" "}
          {subNetLiters.toFixed(0)} L net. Vent: {port.desc}. 3/4″ baffle set {baffleInsetIn}″
          behind the frame, {panelThicknessName(wallPanel, wallThicknessIn)} birch walls, 1/4″
          roundovers on the front edges.
        </div>
        <div>
          <span className="font-medium text-stone-900">{UI_TEXT.midBass} cube.</span>{" "}
          {midDriver.name} in a {effectiveMidBoxDims.w}×{effectiveMidBoxDims.h}×
          {effectiveMidBoxDims.d} in sealed box, gross {midBoxLiters.toFixed(0)} L, lightly stuffed.
          Covers {subMidCrossoverHz} Hz to {midHornCrossoverHz} Hz. Same construction, flush-mounted
          driver.
        </div>
        <div>
          <span className="font-medium text-stone-900">Horn.</span> {hornOption.name} with{" "}
          {compressionDriver.name}, crossed at {midHornCrossoverHz} Hz (maker suggests{" "}
          {hornOption.xo}). Sits on a short block so the mouth clears the cube. Total stack height
          about {stackHeightIn.toFixed(0)} in, horn center at {hornCenterHeightIn.toFixed(0)} in.
        </div>
        {[midDriver, compressionDriver, hornOption].map(
          (part) =>
            part.note && (
              <div key={part.name}>
                <span className="font-medium text-stone-900">{part.name}.</span> {part.note}
              </div>
            ),
        )}
      </DetailsDropdown>
    </div>
  );
}
