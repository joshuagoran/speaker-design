import { PAL } from "../../../styles/palette";
import { WarningChips } from "../../../components/chips/WarningChips";
import { StatTileGrid } from "../../../components/stats/StatTileGrid";
import { ToggleButton } from "../../../components/ui/ToggleButton";
import { FoldHeading } from "../../../components/ui/FoldHeading";
import { ResponseChart } from "../../../components/charts/ResponseChart";
import { DispersionMap } from "../../../components/charts/DispersionMap";
import { hornChips } from "../../../lib/pa/chips";
import { nearestPoint } from "../../../lib/pa/calc";
import type { PaPlanner } from "../hooks/usePaPlanner";

interface Props {
  planner: Pick<
    PaPlanner,
    | "dispersionPlane"
    | "setDispersionPlane"
    | "expandedSections"
    | "toggleSection"
    | "sectionClass"
    | "midSize"
    | "hornOption"
    | "compressionDriver"
    | "hornAmpWatts"
    | "hornBandTiltDb"
    | "midHornCrossoverHz"
    | "midModelled"
    | "compressionDriverSpec"
    | "hornSpec"
    | "hornModel"
    | "hornSplAt"
    | "midBeamWidthDeg"
    | "beamCurves"
    | "dispersionMapDistanceM"
    | "paDispersion"
    | "midHornGapIn"
    | "midHornNullAngleDeg"
  >;
}

/** Horn results: headline stats, beamwidth chart, dispersion map and warning chips. */
export function HornSection({ planner }: Props) {
  const {
    dispersionPlane,
    setDispersionPlane,
    expandedSections,
    toggleSection,
    sectionClass,
    midSize,
    hornOption,
    compressionDriver,
    hornAmpWatts,
    hornBandTiltDb,
    midHornCrossoverHz,
    midModelled,
    compressionDriverSpec,
    hornSpec,
    hornModel,
    hornSplAt,
    midBeamWidthDeg,
    beamCurves,
    dispersionMapDistanceM,
    paDispersion,
    midHornGapIn,
    midHornNullAngleDeg,
  } = planner;
  return (
    <>
      <section className="mt-2" style={{ fontFamily: "var(--font)" }}>
        <FoldHeading
          id="horn"
          title="Horn"
          folds={expandedSections}
          toggle={toggleSection}
          className="mb-3"
        />
        <div className={sectionClass("horn")}>
          {hornModel ? (
            // `compressionDriverSpec!` below: hornModel is null when the driver has no spec
            <>
              <StatTileGrid
                tiles={[
                  ["Sensitivity", compressionDriverSpec!.sens.toFixed(1), "dB"],
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
                  series={[
                    ...(beamCurves.midB.length
                      ? [
                          {
                            curve: beamCurves.midB,
                            label: `Mid-bass ${midSize}″`,
                            stroke: PAL.magenta,
                            tint: PAL.alpha(PAL.magenta, 0),
                          },
                        ]
                      : []),
                    ...(beamCurves.hornB.length
                      ? [
                          {
                            curve: beamCurves.hornB,
                            label: hornOption.name,
                            stroke: PAL.cyan,
                            tint: PAL.alpha(PAL.cyan, 0),
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
              {paDispersion && (
                <div className="mb-4">
                  <div className="flex gap-1 mb-2">
                    {(
                      [
                        ["v", "Vertical"],
                        ["h", "Horizontal"],
                      ] as const
                    ).map(([v, l]) => (
                      <ToggleButton
                        key={v}
                        size="xs"
                        on={dispersionPlane === v}
                        onClick={() => setDispersionPlane(v)}
                      >
                        {l}
                      </ToggleButton>
                    ))}
                  </div>
                  <DispersionMap
                    map={paDispersion}
                    title={
                      dispersionPlane === "v"
                        ? `Vertical dispersion at ${dispersionMapDistanceM} m: below (−) to above (+) the horn axis`
                        : `Horizontal dispersion at ${dispersionMapDistanceM} m, at horn height (0° is on axis)`
                    }
                  />
                  <div className="text-xs text-stone-500 mt-1">
                    Mid and horn centers {midHornGapIn.toFixed(1)}″ apart:{" "}
                    {midHornNullAngleDeg
                      ? `the first null at the ${midHornCrossoverHz} Hz crossover is about ${midHornNullAngleDeg.toFixed(0)}° above and below the horn axis.`
                      : `under half a wavelength at ${midHornCrossoverHz} Hz, so no null at the crossover.`}
                  </div>
                </div>
              )}
              <WarningChips
                chips={hornChips({
                  hf: compressionDriverSpec!,
                  hz: hornSpec,
                  horn: hornOption,
                  xoHi: midHornCrossoverHz,
                  hornModel,
                  hfAmpW: hornAmpWatts,
                  midAtXoHi: midModelled
                    ? nearestPoint(midModelled.max, midHornCrossoverHz).spl
                    : null,
                  hfTilt: hornBandTiltDb,
                  hornAtXo: hornSplAt(midHornCrossoverHz),
                  midBeam: midBeamWidthDeg,
                  fK: beamCurves.fK,
                })}
              />
            </>
          ) : (
            <p className="text-sm text-stone-500">
              {compressionDriver.name} can't be modelled yet: sensitivity or power rating missing.
            </p>
          )}
        </div>
      </section>
    </>
  );
}
