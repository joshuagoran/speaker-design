import { nearestPoint } from "../../../lib/pa/calc";
import type { PaPlanner } from "../hooks/usePaPlanner";
import { LIMIT_NAMES } from "../../../constants/limits";
import { SUMMARY_LOW_HZ, SUMMARY_STRIP_TEXT } from "../../../constants/summaryStrip";
import { SummaryStrip } from "../../../components/ui/SummaryStrip";

interface Props {
  planner: Pick<PaPlanner, "subModeled" | "subLiftLb" | "isTower">;
}

/** Sticky strip of the four headline sub numbers, shown on phones. */
export function MobileSummaryStrip({ planner }: Props) {
  const { subModeled, subLiftLb, isTower } = planner;
  if (!subModeled) return null;
  return (
    <SummaryStrip
      items={[
        [SUMMARY_STRIP_TEXT.fb, `${subModeled.mdl.Fb.toFixed(1)}`, "Hz"],
        [
          SUMMARY_STRIP_TEXT.low,
          `${nearestPoint(subModeled.maxCurve, SUMMARY_LOW_HZ).spl.toFixed(0)}`,
          "dB",
        ],
        [
          isTower ? SUMMARY_STRIP_TEXT.tower : SUMMARY_STRIP_TEXT.sub,
          `${subLiftLb.toFixed(0)}`,
          "lb",
        ],
        [SUMMARY_STRIP_TEXT.limit, LIMIT_NAMES[subModeled.lim.who], ""],
      ]}
    />
  );
}
