import { nearestPoint } from "../../../lib/pa/calc";
import type { PaPlanner } from "../hooks/usePaPlanner";
import { LIMIT_NAMES } from "../../../constants/limits";
import { FONT } from "../../../styles/fonts";

interface Props {
  planner: Pick<PaPlanner, "subModelled" | "subWeightLoadedLb">;
}

/** Sticky strip of the four headline sub numbers, shown on phones. */
export function MobileSummaryStrip({ planner }: Props) {
  const { subModelled, subWeightLoadedLb } = planner;
  return (
    <>
      {subModelled && (
        <div
          className="md:hidden sticky top-0 z-30 -mx-4 bg-stone-50/95 backdrop-blur border-b border-stone-300 px-4 py-1.5 grid grid-cols-4 gap-2 text-center"
          style={{ fontFamily: FONT }}
        >
          {[
            ["Fb", `${subModelled.mdl.Fb.toFixed(1)}`, "Hz"],
            ["35 Hz", `${nearestPoint(subModelled.maxCurve, 35).spl.toFixed(0)}`, "dB"],
            ["Sub", `${subWeightLoadedLb.toFixed(0)}`, "lb"],
            ["Limit", LIMIT_NAMES[subModelled.lim.who], ""],
          ].map(([k, v, u]) => (
            <div key={k}>
              <div className="text-xs uppercase tracking-wider text-stone-500">{k}</div>
              <div className="text-sm font-medium tabular-nums">
                {v}
                <span className="text-xs text-stone-500 ml-0.5">{u}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
