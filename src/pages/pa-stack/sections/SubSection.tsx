import { WarningChips } from "../../../components/chips/WarningChips";
import { FoldBody, FoldHeading } from "../../../components/ui/FoldHeading";
import { MAX_SPL_TIP, STATS } from "../../../components/optimizer/StatRow";
import { StatRowGrid, type StatRowItem } from "../../../components/stats/StatRowGrid";
import { subChips } from "../../../lib/pa/chips";
import { nearestPoint } from "../../../lib/pa/calc";
import type { PaPlanner } from "../hooks/usePaPlanner";
import { xmaxRows } from "../../../lib/xmax";
import { LIMIT_NAMES, SUB_LIMIT_NAMES } from "../../../constants/limits";
import { FONT } from "../../../styles/fonts";
import { UI_TEXT } from "../../../constants/uiText";

interface Props {
  planner: Pick<
    PaPlanner,
    | "expandedSections"
    | "toggleSection"
    | "subDriver"
    | "portStyle"
    | "subVentSpec"
    | "subAmpWatts"
    | "format"
    | "subBox"
    | "PT"
    | "port"
    | "subGrossLiters"
    | "subAmpVoltage"
    | "subModeled"
    | "subWeightLoadedLb"
  >;
  /** shown first inside the fold (the system summary in one column, so it folds with Sub on phones) */
  summary?: React.ReactNode;
}

/** Sub results: details table and warning chips, after `summary` (in one column, the `SystemSummary` tiles and chart). */
export function SubSection({ planner, summary }: Props) {
  const {
    expandedSections,
    toggleSection,
    subDriver,
    portStyle,
    subVentSpec,
    subAmpWatts,
    format,
    subBox,
    PT,
    port,
    subGrossLiters,
    subAmpVoltage,
    subModeled,
    subWeightLoadedLb,
  } = planner;
  return (
    <>
      <section className="mt-2" style={{ fontFamily: FONT }}>
        <FoldHeading
          id="sub"
          title={UI_TEXT.sub}
          folds={expandedSections}
          toggle={toggleSection}
          className="mb-3"
        />
        <FoldBody open={expandedSections.sub}>
          {summary}
          {subModeled ? (
            <StatRowGrid
              rows={[
                [STATS.grossInternal, `${subGrossLiters.toFixed(0)} L`],
                [
                  STATS.portArea,
                  `${port.area.toFixed(1)} in²`,
                  `${((port.area / (subDriver.ts.Sd / 6.4516)) * 100).toFixed(0)}% of cone area`,
                ],
                [
                  STATS.hydraulicDiameter,
                  `${port.dh.toFixed(2)}″`,
                  port.dh < 2 ? "low — flare the mouths" : "acceptable with flares",
                ],
                [
                  STATS.midbandSensitivity,
                  `${(subModeled.mdl.ref - 20 * Math.log10(subAmpVoltage / 2.83)).toFixed(1)} dB`,
                  UI_TEXT.splConditions,
                ],
                ...[30, 35, 45, 60].map((f): StatRowItem => {
                  const m = nearestPoint(subModeled.maxCurve, f);
                  return [
                    `Max SPL at ${f} Hz`,
                    `${m.spl.toFixed(1)} dB`,
                    `sine, ${LIMIT_NAMES[m.who]}-limited`,
                    MAX_SPL_TIP,
                  ];
                }),
                [
                  STATS.firstLimit,
                  SUB_LIMIT_NAMES[subModeled.lim.who],
                  `at ${Math.round(subModeled.lim.W / 10) * 10} W`,
                  `at ${Math.round(subModeled.lim.W / 10) * 10} W${subModeled.lim.who === "Xmax" ? `, reached first at ${subModeled.mdl.peakXF.toFixed(0)} Hz` : subModeled.lim.who === "port" ? `, reached first at ${subModeled.mdl.peakVelF.toFixed(0)} Hz` : ""}. The next two rows use this power.`,
                ],
                [
                  STATS.peakPortVelocity,
                  `${subModeled.lim.vel.toFixed(1)} m/s`,
                  `at ${subModeled.mdl.peakVelF.toFixed(0)} Hz`,
                ],
                [
                  STATS.peakExcursion,
                  `${((subModeled.mdl.peakX * subModeled.lim.V) / subAmpVoltage).toFixed(1)} mm`,
                  `${subModeled.lim.xPct.toFixed(0)}% of Xmax, at ${subModeled.mdl.peakXF.toFixed(0)} Hz`,
                ],
                ...xmaxRows(subDriver.ts),
              ]}
            />
          ) : (
            <p className="text-sm text-stone-500 ">
              {subDriver.name} can't be modeled yet: its parameters are incomplete. {subDriver.note}
            </p>
          )}
          {subModeled && (
            <WarningChips
              chips={subChips({
                subSize: format.sub,
                subDepthIn: subDriver.depthIn,
                subBox,
                portStyle,
                cVent: subVentSpec,
                PT,
                subLbLoaded: subWeightLoadedLb,
                lim: subModeled.lim,
                peakXF: subModeled.mdl.peakXF,
                aes: subDriver.ts.aes,
                ampW: subAmpWatts,
              })}
              className="mt-4"
            />
          )}
        </FoldBody>
      </section>
    </>
  );
}
