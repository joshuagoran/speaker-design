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

interface Props {
  planner: Pick<
    PaPlanner,
    | "subMidCrossoverHz"
    | "midHornCrossoverHz"
    | "subNetLiters"
    | "subModelled"
    | "midModelled"
    | "midMaxBand"
    | "hornModel"
    | "subWeightLoadedLb"
  >;
  className?: string;
}

/**
 * The system's summary: the sub's headline tiles and the system response chart (sub, mid-bass and horn together). Nothing
 * while the sub can't be modelled (the Sub section says why).
 */
export function SystemSummary({ planner, className = "" }: Props) {
  const pal = usePalette();
  const {
    subMidCrossoverHz,
    midHornCrossoverHz,
    subNetLiters,
    subModelled,
    midModelled,
    midMaxBand,
    hornModel,
    subWeightLoadedLb,
  } = planner;
  if (!subModelled) return null;
  return (
    <section className={`min-w-0 ${className}`} style={{ fontFamily: FONT }}>
      <StatTileGrid
        tiles={[
          [STATS.netVolume, subNetLiters.toFixed(0), "L"],
          [STATS.tuningFb, subModelled.mdl.Fb.toFixed(1), "Hz"],
          [STATS.systemF3, subModelled.mdl.f3.toFixed(0), "Hz"],
          [STATS.subBass, subBassLevel(subModelled.maxCurve).toFixed(1), "dB"],
          ["Sub weight", subWeightLoadedLb.toFixed(0), "lb"],
        ]}
      />
      <SectionHeading className="mb-3">{UI_TEXT.systemResponse}</SectionHeading>
      <ResponseChart
        fmax={20000}
        series={[
          {
            curve: subModelled.throughLowpass,
            band: subModelled.throughLowpassBand,
            label: UI_TEXT.sub,
            stroke: pal.ink,
            tint: alpha(pal.ink, 0.07),
          },
          ...(midModelled
            ? [
                {
                  curve: midModelled.max,
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
          { f: subModelled.mdl.Fb, label: "Fb" },
          { f: subMidCrossoverHz, label: "XO" },
          { f: midHornCrossoverHz, label: "XO" },
        ]}
      />
    </section>
  );
}
