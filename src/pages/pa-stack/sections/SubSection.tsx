import { PAL } from "../../../styles/palette";
import { WarningChips } from "../../../components/chips/WarningChips";
import { StatTileGrid } from "../../../components/stats/StatTileGrid";
import { FoldHeading } from "../../../components/ui/FoldHeading";
import { ResponseChart } from "../../../components/charts/ResponseChart";
import { MAX_SPL_TIP, StatRow } from "../../../components/optimizer/StatRow";
import { subChips } from "../../../lib/pa/chips";
import { nearestPoint } from "../../../lib/pa/calc";
import type { PaPlanner } from "../hooks/usePaPlanner";
import { xmaxRows } from "../../../lib/xmax";

interface Props {
  planner: Pick<
    PaPlanner,
    | "expandedSections"
    | "toggleSection"
    | "sectionClass"
    | "subDriver"
    | "portStyle"
    | "subVentSpec"
    | "subAmpWatts"
    | "subMidCrossoverHz"
    | "midHornCrossoverHz"
    | "format"
    | "subBox"
    | "PT"
    | "port"
    | "subGrossLiters"
    | "subNetLiters"
    | "subAmpVoltage"
    | "subModelled"
    | "midModelled"
    | "midMaxBand"
    | "hornModel"
    | "subWeightLoadedLb"
  >;
}

/** Sub results: headline stats, system response chart, details table and warning chips. */
export function SubSection({ planner }: Props) {
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
    subModelled,
    midModelled,
    midMaxBand,
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
          {subModelled && (
            <StatTileGrid
              tiles={[
                ["Net volume", subNetLiters.toFixed(0), "L"],
                ["Tuning Fb", subModelled.mdl.Fb.toFixed(1), "Hz"],
                ["System F3", subModelled.mdl.f3.toFixed(0), "Hz"],
                ["Max SPL @ 35 Hz", nearestPoint(subModelled.maxCurve, 35).spl.toFixed(1), "dB"],
                ["Weight", subWeightLoadedLb.toFixed(0), "lb"],
              ]}
            />
          )}
          {subModelled && (
            <div className="mb-4">
              <ResponseChart
                fmax={20000}
                series={[
                  {
                    curve: subModelled.throughLowpass,
                    band: subModelled.throughLowpassBand,
                    label: "Sub",
                    stroke: PAL.ink,
                    tint: PAL.alpha(PAL.ink, 0.07),
                  },
                  ...(midModelled
                    ? [
                        {
                          curve: midModelled.max,
                          band: midMaxBand,
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
                  { f: subModelled.mdl.Fb, label: "Fb" },
                  { f: subMidCrossoverHz, label: "XO" },
                  { f: midHornCrossoverHz, label: "XO" },
                ]}
              />
            </div>
          )}
          {subModelled ? (
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
                  `${(subModelled.mdl.ref - 20 * Math.log10(subAmpVoltage / 2.83)).toFixed(1)} dB`,
                  "2.83 V, half space, 1 m",
                ],
                ...[30, 35, 45, 60].map((f) => {
                  const m = nearestPoint(subModelled.maxCurve, f);
                  return [
                    `Max SPL at ${f} Hz`,
                    `${m.spl.toFixed(1)} dB`,
                    `sine, ${m.who}-limited`,
                    MAX_SPL_TIP,
                  ];
                }),
                [
                  "First limit, music",
                  subModelled.lim.who,
                  `at ${Math.round(subModelled.lim.W / 10) * 10} W`,
                  `at ${Math.round(subModelled.lim.W / 10) * 10} W${subModelled.lim.who === "cone travel (Xmax)" ? `, reached first at ${subModelled.mdl.peakXF.toFixed(0)} Hz` : subModelled.lim.who === "port air speed" ? `, reached first at ${subModelled.mdl.peakVelF.toFixed(0)} Hz` : ""}; the two rows below are at this power.`,
                ],
                [
                  "Peak port velocity",
                  `${subModelled.lim.vel.toFixed(1)} m/s`,
                  `at ${subModelled.mdl.peakVelF.toFixed(0)} Hz`,
                ],
                [
                  "Peak excursion",
                  `${((subModelled.mdl.peakX * subModelled.lim.V) / subAmpVoltage).toFixed(1)} mm`,
                  `${subModelled.lim.xPct.toFixed(0)}% of Xmax, at ${subModelled.mdl.peakXF.toFixed(0)} Hz`,
                ],
                ...xmaxRows(subDriver.ts),
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
          {subModelled && (
            <WarningChips
              chips={subChips({
                subSize: format.sub,
                subBox,
                portStyle,
                cVent: subVentSpec,
                PT,
                subLbLoaded: subWeightLoadedLb,
                lim: subModelled.lim,
                peakXF: subModelled.mdl.peakXF,
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
