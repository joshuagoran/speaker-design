import { DetailsDropdown } from "../../../components/ui/DetailsDropdown";
import { UI_TEXT } from "../../../constants/uiText";
import type { PaPlanner } from "../hooks/usePaPlanner";
import { FONT } from "../../../styles/fonts";
import { PanelResonanceTable } from "../../../components/stats/PanelResonanceTable";
import { BRACE_PANEL_NAMES, BRACE_STYLE_NAMES } from "../../../constants/bracing";
import {
  DRIVER_CLEARANCE_IN,
  PA_BRACING_CROSSOVER_HZ,
  PANEL_TARGET_CROSSOVER_MULTIPLE,
} from "../../../lib/pa/bracing";
import { formatHz, formatInches } from "../../../lib/format";
import { panelThicknessName } from "../../../lib/panel";
import type { BoxBracing } from "../../../types";

/** A box's braces and ribs in words: "1 window brace, 6 ribs", or none. */
const braceCount = (b: BoxBracing) => {
  const w = b.windows.x.length + b.windows.y.length + b.windows.z.length,
    r = b.ribs.reduce((a, x) => a + x.at.length, 0);
  const words = [
    w && `${w} window brace${w > 1 ? "s" : ""}`,
    r && `${r} rib${r > 1 ? "s" : ""}`,
  ].filter(Boolean);
  return words.length ? words.join(", ") : "none needed";
};

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
    | "subBracing"
    | "midBracing"
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
    subBracing,
    midBracing,
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
          {hornOption.xo}). A block lifts the mouth clear of the cube. Stack height about{" "}
          {stackHeightIn.toFixed(0)} in, horn center at {hornCenterHeightIn.toFixed(0)} in.
        </div>
        <div>
          <span className="font-medium text-stone-900">Bracing.</span> Braces and ribs, best gain
          per wood first, until each panel&rsquo;s first resonance is above{" "}
          {formatHz(subBracing.targetHz)} ({PANEL_TARGET_CROSSOVER_MULTIPLE} ×{" "}
          {PA_BRACING_CROSSOVER_HZ} Hz, the highest sub-to-mid crossover the optimizers pick). Sub,{" "}
          {BRACE_STYLE_NAMES[subBracing.style].toLowerCase()}: {braceCount(subBracing)}
          {midBracing
            ? `; ${UI_TEXT.midBass.toLowerCase()} cube, ${BRACE_STYLE_NAMES[midBracing.style].toLowerCase()}: ${braceCount(midBracing)}`
            : ""}
          . Panels are simply supported plates; glued edges make real values higher. Braces stay{" "}
          {formatInches(DRIVER_CLEARANCE_IN)}″ clear of the driver and the vent.
          {(
            [
              ["Sub", subBracing],
              [UI_TEXT.midBass, midBracing],
            ] as const
          ).map(
            ([name, b]) =>
              b && (
                <div key={name}>
                  <PanelResonanceTable
                    caption={`${name} panels, first resonance`}
                    panels={b.panels}
                    targetHz={b.targetHz}
                  />
                  {!b.meets && (
                    <div className="text-red-700">
                      Under the target:{" "}
                      {b.panels
                        .filter((p) => p.hz < b.targetHz - 1e-9)
                        .map((p) => BRACE_PANEL_NAMES[p.id].toLowerCase())
                        .join(", ")}
                      . No other clear brace position raises them. Try{" "}
                      {BRACE_STYLE_NAMES.both.toLowerCase()} or thicker walls.
                    </div>
                  )}
                </div>
              ),
          )}
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
