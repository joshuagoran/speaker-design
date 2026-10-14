import { FREQ_AXIS_MAX_HZ } from "../../../constants/chartScales";
import { alpha } from "../../../styles/palette";
import { usePalette } from "../../../hooks/useTheme";
import { StatTileGrid } from "../../../components/stats/StatTileGrid";
import { SectionHeading } from "../../../components/ui/SectionHeading";
import { ResponseChart } from "../../../components/charts/ResponseChart";
import { STATS } from "../../../components/optimizer/StatRow";
import { subBassLevel } from "../../../lib/pa/calc";
import type { PaPlanner } from "../hooks/usePaPlanner";
import { FONT } from "../../../styles/fonts";
import { UI_TEXT } from "../../../constants/uiText";
import { STACK } from "../../../styles/layout";

interface Props {
  planner: Pick<
    PaPlanner,
    | "subMidCrossoverHz"
    | "midHornCrossoverHz"
    | "subNetLiters"
    | "subModeled"
    | "midModeled"
    | "midMaxBand"
    | "hornModel"
    | "subLiftLb"
    | "isTower"
  >;
  className?: string;
}

/**
 * The system's summary: the sub's headline tiles and the system response chart (sub, mid-bass and horn together). Nothing
 * while the sub can't be modeled (the Sub section says why).
 */
export function SystemSummary({ planner }: Props) {
  const pal = usePalette();
  const {
    subMidCrossoverHz,
    midHornCrossoverHz,
    subNetLiters,
    subModeled,
    midModeled,
    midMaxBand,
    hornModel,
    subLiftLb,
    isTower,
  } = planner;
  if (!subModeled) return null;
  return (
    <section className={`min-w-0 ${STACK}`} style={{ fontFamily: FONT }}>
      <StatTileGrid
        tiles={[
          [STATS.netVolume, subNetLiters.toFixed(0), "L"],
          [STATS.tuningFb, subModeled.mdl.Fb.toFixed(1), "Hz"],
          [STATS.systemF3, subModeled.mdl.f3.toFixed(0), "Hz"],
          [STATS.subBass, subBassLevel(subModeled.maxCurve).toFixed(1), "dB"],
          [isTower ? "Tower weight" : "Sub weight", subLiftLb.toFixed(0), "lb"],
        ]}
      />
      <SectionHeading>{UI_TEXT.systemResponse}</SectionHeading>
      <ResponseChart
        fmax={FREQ_AXIS_MAX_HZ}
        series={[
          {
            curve: subModeled.throughLowpass,
            band: subModeled.throughLowpassBand,
            label: UI_TEXT.sub,
            stroke: pal.ink,
            tint: alpha(pal.ink, 0.07),
          },
          ...(midModeled
            ? [
                {
                  curve: midModeled.max,
                  band: midMaxBand,
                  label: UI_TEXT.midBass,
                  stroke: pal.magenta,
                  tint: alpha(pal.magenta, 0.06),
                },
              ]
            : []),
          ...(hornModel
            ? [
                {
                  curve: hornModel.curve,
                  label: UI_TEXT.horn,
                  stroke: pal.cyan,
                  tint: alpha(pal.cyan, 0.06),
                },
              ]
            : []),
        ]}
        marks={[
          { f: subModeled.mdl.Fb, label: "Fb" },
          { f: subMidCrossoverHz, label: "XO" },
          { f: midHornCrossoverHz, label: "XO" },
        ]}
      />
    </section>
  );
}
