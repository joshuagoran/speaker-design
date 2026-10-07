import { alpha } from "../../../styles/palette";
import { usePalette } from "../../../hooks/useTheme";
import { WarningChips } from "../../../components/chips/WarningChips";
import { StatTileGrid } from "../../../components/stats/StatTileGrid";
import { FoldBody, FoldHeading } from "../../../components/ui/FoldHeading";
import { ResponseChart } from "../../../components/charts/ResponseChart";
import { hornChips } from "../../../lib/pa/chips";
import { nearestPoint } from "../../../lib/pa/calc";
import type { PaPlanner } from "../hooks/usePaPlanner";
import { FONT } from "../../../styles/fonts";
import { UI_TEXT } from "../../../constants/uiText";

interface Props {
  planner: Pick<
    PaPlanner,
    | "expandedSections"
    | "toggleSection"
    | "midSize"
    | "hornOption"
    | "compressionDriver"
    | "hornAmpWatts"
    | "hornBelowMidDb"
    | "midHornCrossoverHz"
    | "midModeled"
    | "hornSpec"
    | "hornModel"
    | "midBeamWidthDeg"
    | "beamCurves"
  >;
}

/** Horn results: headline stats, beamwidth chart and warning chips (the dispersion map sits above the totals). */
export function HornSection({ planner }: Props) {
  const pal = usePalette();
  const {
    expandedSections,
    toggleSection,
    midSize,
    hornOption,
    compressionDriver,
    hornAmpWatts,
    hornBelowMidDb,
    midHornCrossoverHz,
    midModeled,
    hornSpec,
    hornModel,
    midBeamWidthDeg,
    beamCurves,
  } = planner;
  return (
    <>
      <section className="mt-2" style={{ fontFamily: FONT }}>
        <FoldHeading
          id="horn"
          title={UI_TEXT.horn}
          folds={expandedSections}
          toggle={toggleSection}
          className="mb-3"
        />
        <FoldBody open={expandedSections.horn}>
          {hornModel ? (
            <>
              <StatTileGrid
                tiles={[
                  ["Sensitivity", hornModel.hf.sens.toFixed(1), "dB"],
                  ["Power used", Math.round(hornModel.P), "W"],
                  ["Max SPL", hornModel.flat.toFixed(1), "dB"],
                  [
                    "Coverage",
                    hornSpec.covH
                      ? `${hornSpec.covH}\u00b0\u00d7${hornSpec.covV || "?"}\u00b0`
                      : "\u2014",
                    "",
                  ],
                  [
                    "Mid beam at XO",
                    midBeamWidthDeg ? Math.round(midBeamWidthDeg) : "\u2014",
                    midBeamWidthDeg ? "\u00b0" : "",
                  ],
                ]}
              />
              <div className="mb-4">
                <ResponseChart
                  fmin={200}
                  fmax={10000}
                  top={180}
                  bot={0}
                  step={30}
                  H={220}
                  yLabel="horizontal beamwidth, °"
                  unit="°"
                  series={[
                    ...(beamCurves.midB.length
                      ? [
                          {
                            curve: beamCurves.midB,
                            label: `${UI_TEXT.midBass} ${midSize}″`,
                            stroke: pal.magenta,
                            tint: alpha(pal.magenta, 0),
                          },
                        ]
                      : []),
                    ...(beamCurves.hornB.length
                      ? [
                          {
                            curve: beamCurves.hornB,
                            label: hornOption.name,
                            stroke: pal.cyan,
                            tint: alpha(pal.cyan, 0),
                          },
                        ]
                      : []),
                  ]}
                  marks={[
                    { f: midHornCrossoverHz, label: "XO" },
                    ...(beamCurves.fK ? [{ f: beamCurves.fK, label: "horn control" }] : []),
                  ]}
                />
              </div>
              <WarningChips
                chips={hornChips({
                  hf: hornModel.hf,
                  hz: hornSpec,
                  horn: hornOption,
                  xoHi: midHornCrossoverHz,
                  hornModel,
                  hfAmpW: hornAmpWatts,
                  midAtXoHi: midModeled
                    ? nearestPoint(midModeled.max, midHornCrossoverHz).spl
                    : null,
                  hornBelowMidDb,
                  hornAtXo: nearestPoint(hornModel.curve, midHornCrossoverHz).spl,
                  midBeam: midBeamWidthDeg,
                  fK: beamCurves.fK,
                })}
              />
            </>
          ) : (
            <p className="text-sm text-stone-500">
              {compressionDriver.name} can't be modeled yet: sensitivity or power rating missing.
            </p>
          )}
        </FoldBody>
      </section>
    </>
  );
}
