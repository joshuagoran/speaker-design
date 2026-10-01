import { PAL } from "../../../styles/palette.js";
import { WarningChips } from "../../../components/chips/WarningChips.jsx";
import { StatTileGrid } from "../../../components/stats/StatTileGrid.jsx";
import { FoldHeading } from "../../../components/ui/FoldHeading.jsx";
import { ResponseChart } from "../../../components/charts/ResponseChart.jsx";
import { StatRow } from "../../../components/optimizer/StatRow.jsx";
import { subChips } from "../../../lib/pa/chips.js";

/** Sub results: headline stats, system response chart, details table and warning chips. */
export function SubSection({ planner }) {
  const {
    expandedSections,
    toggleSection,
    sectionClass,
    subDriver,
    portStyle,
    subVentSpec,
    subAmpWatts,
    subMidCrossoverHz,
    midHornCrossoverHz,
    format,
    subBox,
    PT,
    port,
    subGrossLiters,
    subNetLiters,
    subAmpVoltage,
    subModel,
    subLimits,
    subMaxCurveNearest,
    midMaxCurve,
    subThroughLowpassCurve,
    hornModel,
    subWeightLoadedLb,
  } = planner;
  return (
    <>
      <section className="mt-1" style={{ fontFamily: "var(--font)" }}>
        <FoldHeading
          id="sub"
          title="Sub"
          folds={expandedSections}
          toggle={toggleSection}
          className="mb-3 md:hidden"
        />
        <div className={sectionClass("sub")}>
          {subModel && subLimits && (
            <StatTileGrid
              tiles={[
                ["Net volume", subNetLiters.toFixed(0), "L"],
                ["Tuning Fb", subModel.Fb.toFixed(1), "Hz"],
                ["System F3", subModel.f3.toFixed(0), "Hz"],
                ["Max SPL @ 35 Hz", subMaxCurveNearest(35).spl.toFixed(1), "dB"],
                ["Weight", subWeightLoadedLb.toFixed(0), "lb"],
              ]}
            />
          )}
          {subModel && subLimits && (
            <div className="mb-4">
              <ResponseChart
                fmax={20000}
                series={[
                  {
                    curve: subThroughLowpassCurve,
                    label: "Sub",
                    stroke: PAL.ink,
                    tint: PAL.alpha(PAL.ink, 0.07),
                  },
                  ...(midMaxCurve
                    ? [
                        {
                          curve: midMaxCurve,
                          label: "Mid-bass",
                          stroke: PAL.magenta,
                          tint: PAL.alpha(PAL.magenta, 0.06),
                        },
                      ]
                    : []),
                  ...(hornModel
                    ? [
                        {
                          curve: hornModel.curve,
                          label: "Horn",
                          stroke: PAL.cyan,
                          tint: PAL.alpha(PAL.cyan, 0.06),
                        },
                      ]
                    : []),
                ]}
                marks={[
                  { f: subModel.Fb, label: "Fb" },
                  { f: subMidCrossoverHz, label: "XO" },
                  { f: midHornCrossoverHz, label: "XO" },
                ]}
              />
            </div>
          )}
          {subModel ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-0.5 text-sm">
              {[
                ["Gross internal", `${subGrossLiters.toFixed(0)} L`],
                [
                  "Port area",
                  `${port.area.toFixed(1)} in²`,
                  `${((port.area / (subDriver.ts.Sd / 6.4516)) * 100).toFixed(0)}% of cone area`,
                ],
                [
                  "Hydraulic diameter",
                  `${port.dh.toFixed(2)}″`,
                  port.dh < 2 ? "low — flare the mouths" : "acceptable with flares",
                ],
                [
                  "Midband sensitivity",
                  `${(subModel.ref - 20 * Math.log10(subAmpVoltage / 2.83)).toFixed(1)} dB`,
                  "2.83 V, half space, 1 m",
                ],
                ...[30, 35, 45, 60].map((f) => {
                  const m = subMaxCurveNearest(f);
                  return [`Max SPL at ${f} Hz`, `${m.spl.toFixed(1)} dB`, `sine, ${m.who}-limited`];
                }),
                [
                  "First limit, music",
                  subLimits.who,
                  `at ${Math.round(subLimits.W / 10) * 10} W`,
                  `at ${Math.round(subLimits.W / 10) * 10} W${subLimits.who === "cone travel (Xmax)" ? `, reached first at ${subModel.peakXF.toFixed(0)} Hz` : subLimits.who === "port air speed" ? `, reached first at ${subModel.peakVelF.toFixed(0)} Hz` : ""}; the two rows below are at this power.`,
                ],
                [
                  "Peak port velocity",
                  `${subLimits.vel.toFixed(1)} m/s`,
                  `at ${subModel.peakVelF.toFixed(0)} Hz`,
                ],
                [
                  "Peak excursion",
                  `${((subModel.peakX * subLimits.V) / subAmpVoltage).toFixed(1)} mm`,
                  `${subLimits.xPct.toFixed(0)}% of Xmax, at ${subModel.peakXF.toFixed(0)} Hz`,
                ],
              ].map(([k, v, note, tip]) => (
                <StatRow key={k} k={k} v={v} note={note} tip={tip} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-stone-500 ">
              {subDriver.name} can't be modelled yet: its parameters are incomplete.{" "}
              {subDriver.note}
            </p>
          )}
          {subModel && subLimits && (
            <WarningChips
              chips={subChips({
                subSize: format.sub,
                subBox,
                portStyle,
                cVent: subVentSpec,
                PT,
                subLbLoaded: subWeightLoadedLb,
                lim: subLimits,
                peakXF: subModel.peakXF,
                aes: subDriver.ts.aes,
                ampW: subAmpWatts,
              })}
              className="mt-4"
            />
          )}
        </div>
      </section>
    </>
  );
}
