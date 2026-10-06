import { useState } from "react";
import { Button } from "../ui/Button";
import { AnimatedDetails } from "../ui/AnimatedDetails";
import { ToggleButton } from "../ui/ToggleButton";
import { formatDollars } from "../../lib/format";
import { entriesOf } from "../../lib/records";
import { DRIVER_PART_NAMES } from "../../constants/optimizerText";
import type { PaDriverCompareRow, PaDriverPart } from "../../types";

type Metrics = NonNullable<PaDriverCompareRow["m"]>;
/** A part-specific column: its heading and its value in words. */
interface Column {
  head: string;
  value: (m: Metrics) => string;
}
const dB = (x: number | null) => (x == null ? "–" : `${x >= 0 ? "+" : ""}${x.toFixed(1)} dB`);
const OUTPUT: Column = { head: "Output", value: (m) => `${m.out.toFixed(1)} dB` };
const F3: Column = { head: "F3", value: (m) => `${m.f3.toFixed(1)} Hz` };
const MID_HEADROOM: Column = { head: "Mid headroom", value: (m) => dB(m.midGap) };
const QTC: Column = { head: "Mid Qtc", value: (m) => m.qtc.toFixed(2) };
const HF_HEADROOM: Column = { head: "HF headroom", value: (m) => dB(m.hornGap) };
/** The weight column's heading: what the part's weight is (the drivers' boxes; the compression driver and horn alone). */
const WEIGHT_HEAD: Record<PaDriverPart, string> = {
  sub: "Sub box",
  mid: "Mid box",
  cd: "Its weight",
  horn: "Its weight",
};
/** What each part changes, beyond price and weight: the sub sets the output and the bass; the others keep up or not. */
const PART_COLUMNS: Record<PaDriverPart, Column[]> = {
  sub: [OUTPUT, F3],
  mid: [MID_HEADROOM, QTC],
  cd: [HF_HEADROOM],
  horn: [HF_HEADROOM],
};

interface Props {
  /** every option for a part in your design as it is, best first */
  rows: (part: PaDriverPart) => PaDriverCompareRow[];
  /** puts an option into your design */
  onUse: (part: PaDriverPart, id: string) => void;
}

/**
 * Compare drivers: every option for one part (sub, mid, compression driver or horn) in your design with everything
 * else as it is, side by side. Modeled only while open (a few dozen model runs, well under a second).
 */
export function DriverCompare({ rows, onUse }: Props) {
  const [part, setPart] = useState<PaDriverPart>("sub");
  return (
    <AnimatedDetails
      summary="Compare drivers"
      className="mt-4 text-sm rounded border border-stone-300 bg-stone-50 px-3 py-2"
      summaryClassName="cursor-pointer py-1"
    >
      {(open) =>
        open && (
          <div className="pt-2">
            <div className="text-xs text-stone-500 mb-2">
              Each option in your design with everything else as it is, checked against your limits.
            </div>
            <div className="flex flex-wrap gap-1" role="group" aria-label="Part to compare">
              {entriesOf(DRIVER_PART_NAMES).map(([k, name]) => (
                <ToggleButton key={k} on={part === k} onClick={() => setPart(k)}>
                  {name}
                </ToggleButton>
              ))}
            </div>
            <div className="mt-2 overflow-x-auto">
              <table className="text-xs w-full min-w-[600px] border-collapse tabular-nums">
                <thead>
                  <tr className="text-stone-500 text-left border-b border-stone-300">
                    <th className="py-1 pr-3 font-normal sticky left-0 bg-stone-50">
                      {DRIVER_PART_NAMES[part]}
                    </th>
                    <th className="py-1 pr-3 font-normal text-right">Its price</th>
                    <th className="py-1 pr-3 font-normal text-right">Drivers / stack</th>
                    <th className="py-1 pr-3 font-normal text-right">{WEIGHT_HEAD[part]}</th>
                    {PART_COLUMNS[part].map((c) => (
                      <th key={c.head} className="py-1 pr-3 font-normal text-right">
                        {c.head}
                      </th>
                    ))}
                    <th className="py-1 pr-3 font-normal">Checks</th>
                    <th className="py-1 font-normal" />
                  </tr>
                </thead>
                <tbody>
                  {rows(part).map((r) => (
                    <tr key={r.id} className="border-b border-stone-300 last:border-0 align-top">
                      <td
                        className={`py-1.5 pr-3 sticky left-0 bg-stone-50 ${r.yours ? "font-bold" : ""}`}
                      >
                        {r.name}
                        {r.yours && <span className="font-normal text-stone-500"> · yours</span>}
                      </td>
                      <td className="py-1.5 pr-3 text-right whitespace-nowrap">
                        {r.price == null ? "?" : formatDollars(r.price)}
                      </td>
                      <td className="py-1.5 pr-3 text-right whitespace-nowrap">
                        {r.m ? `${formatDollars(r.m.price)}${r.m.priceKnown ? "" : "+"}` : "–"}
                      </td>
                      <td className="py-1.5 pr-3 text-right whitespace-nowrap">
                        {r.lb == null ? "–" : `${r.lb.toFixed(r.lb < 10 ? 1 : 0)} lb`}
                      </td>
                      {PART_COLUMNS[part].map((c) => (
                        <td key={c.head} className="py-1.5 pr-3 text-right whitespace-nowrap">
                          {r.m ? c.value(r.m) : "–"}
                        </td>
                      ))}
                      <td className="py-1.5 pr-3">
                        {r.problems.length ? (
                          // a problem your design has whatever you pick is gray; what this option adds is orange
                          r.problems.map((p, i) => (
                            <span
                              key={`${p.id}-${i}`}
                              className={p.yoursToo ? "text-stone-500" : "text-orange-700"}
                            >
                              {i > 0 && "; "}
                              {p.text}
                            </span>
                          ))
                        ) : (
                          <span className="text-green-700">passes</span>
                        )}
                      </td>
                      <td className="py-1 text-right">
                        {!r.yours && (
                          <Button size="xs" onClick={() => onUse(part, r.id)}>
                            Use
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      }
    </AnimatedDetails>
  );
}
