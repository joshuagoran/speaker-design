import { WarningChips } from "../../../components/chips/WarningChips";
import { StatTileGrid } from "../../../components/stats/StatTileGrid";
import { FoldBody, FoldHeading } from "../../../components/ui/FoldHeading";
import { MAX_SPL_TIP, STATS } from "../../../components/optimizer/StatRow";
import { StatRowGrid, type StatRowItem } from "../../../components/stats/StatRowGrid";
import { midChips } from "../../../lib/pa/chips";
import { nearestPoint } from "../../../lib/pa/calc";
import type { PaPlanner } from "../hooks/usePaPlanner";
import { xmaxRows } from "../../../lib/xmax";
import { LIMIT_NAMES } from "../../../constants/limits";
import { FONT } from "../../../styles/fonts";
import { UI_TEXT } from "../../../constants/uiText";

interface Props {
  planner: Pick<
    PaPlanner,
    | "expandedSections"
    | "toggleSection"
    | "midDriver"
    | "midAmpWatts"
    | "midBandTiltDb"
    | "midSize"
    | "subMidCrossoverHz"
    | "effectiveMidBoxDims"
    | "midVoltage"
    | "midGrossL"
    | "midNetL"
    | "midEffL"
    | "midModelled"
    | "midThermalVoltage"
    | "midUsedVoltage"
    | "midWeightLoadedLb"
    | "subMusicAtCrossover"
  >;
}

/** Mid-bass results: headline stats, details table and warning chips. */
export function MidSection({ planner }: Props) {
  const {
    expandedSections,
    toggleSection,
    midDriver,
    midAmpWatts,
    midBandTiltDb,
    midSize,
    subMidCrossoverHz,
    effectiveMidBoxDims,
    midVoltage,
    midGrossL,
    midNetL,
    midEffL,
    midModelled,
    midThermalVoltage,
    midUsedVoltage,
    midWeightLoadedLb,
    subMusicAtCrossover,
  } = planner;
  return (
    <>
      <section className="mt-2" style={{ fontFamily: FONT }}>
        <FoldHeading
          id="mid"
          title={UI_TEXT.midBass}
          folds={expandedSections}
          toggle={toggleSection}
          className="mb-3"
        />
        <FoldBody open={expandedSections.mid}>
          {midModelled ? (
            <>
              <StatTileGrid
                tiles={[
                  [STATS.netVolume, midNetL.toFixed(0), "L"],
                  ["Box resonance Fc", midModelled.mdl.Fc.toFixed(0), "Hz"],
                  ["Box F3", midModelled.mdl.f3.toFixed(0), "Hz"],
                  [
                    `Max SPL @ ${subMidCrossoverHz} Hz`,
                    nearestPoint(midModelled.max, subMidCrossoverHz).spl.toFixed(1),
                    "dB",
                  ],
                  ["Weight", midWeightLoadedLb.toFixed(0), "lb"],
                ]}
              />
              <StatRowGrid
                rows={[
                  [
                    STATS.grossInternal,
                    `${midGrossL.toFixed(0)} L`,
                    `acts like ${midEffL.toFixed(0)} L stuffed`,
                  ],
                  [
                    STATS.qtc,
                    midModelled.mdl.Qtc.toFixed(2),
                    midModelled.mdl.Qtc > 0.8
                      ? "peaky"
                      : midModelled.mdl.Qtc < 0.5
                        ? "very damped"
                        : "well damped",
                  ],
                  [
                    STATS.midbandSensitivity,
                    `${(midModelled.mdl.ref - 20 * Math.log10(midVoltage / 2.83)).toFixed(1)} dB`,
                    UI_TEXT.splConditions,
                  ],
                  ...[subMidCrossoverHz, 200, 500].map((f): StatRowItem => {
                    const m = nearestPoint(midModelled.max, f);
                    return [
                      `Max SPL at ${f} Hz`,
                      `${m.spl.toFixed(1)} dB`,
                      `sine, ${LIMIT_NAMES[m.who]}-limited`,
                      MAX_SPL_TIP,
                    ];
                  }),
                  [
                    STATS.peakExcursion,
                    `${((midModelled.mdl.peakX * midUsedVoltage) / midVoltage).toFixed(1)} mm`,
                    `${(((midModelled.mdl.peakX * midUsedVoltage) / midVoltage / midDriver.ts.Xmax) * 100).toFixed(0)}% of Xmax`,
                    `At ${Math.round((midUsedVoltage * midUsedVoltage) / 8)} W, with the ${subMidCrossoverHz} Hz highpass.`,
                  ],
                  ...xmaxRows(midDriver.ts),
                ]}
              />
              <WarningChips
                chips={midChips({
                  midSize,
                  midDims: effectiveMidBoxDims,
                  Qtc: midModelled.mdl.Qtc,
                  f3: midModelled.mdl.f3,
                  peakX: midModelled.mdl.peakX,
                  xoLo: subMidCrossoverHz,
                  ts: midDriver.ts,
                  V: midVoltage,
                  useV: midUsedVoltage,
                  vTherm: midThermalVoltage,
                  mAmpW: midAmpWatts,
                  subMusicAtXo: subMusicAtCrossover,
                  tilt: midBandTiltDb,
                  midAtXo:
                    subMusicAtCrossover != null
                      ? nearestPoint(midModelled.max, subMidCrossoverHz)
                      : null,
                })}
                className="mt-4"
              />
            </>
          ) : (
            <p className="text-sm text-stone-500">
              {midDriver.name} can't be modelled yet: its parameters are incomplete.{" "}
              {midDriver.note}
            </p>
          )}
        </FoldBody>
      </section>
    </>
  );
}
