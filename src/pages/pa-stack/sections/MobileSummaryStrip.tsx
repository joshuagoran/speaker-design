import { nearestPoint } from "../../../lib/pa/calc";
import type { PaPlanner } from "../hooks/usePaPlanner";

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
          className="md:hidden sticky top-0 z-30 bg-stone-50/95 backdrop-blur border-b border-stone-300 px-4 py-1.5 grid grid-cols-4 gap-2 text-center"
          style={{ fontFamily: "var(--font)" }}
        >
          {[
            ["Fb", `${subModelled.mdl.Fb.toFixed(1)}`, "Hz"],
            ["35 Hz", `${nearestPoint(subModelled.maxCurve, 35).spl.toFixed(0)}`, "dB"],
            ["Sub", `${subWeightLoadedLb.toFixed(0)}`, "lb"],
            [
              "Limit",
              {
                "port air speed": "port",
                "cone travel (Xmax)": "Xmax",
                "driver program rating": "thermal",
                "amplifier power": "amp",
              }[subModelled.lim.who] || subModelled.lim.who,
              "",
            ],
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
