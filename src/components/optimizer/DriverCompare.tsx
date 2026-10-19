import { useState } from "react";
import { CompareTable, type CompareColumn } from "../ui/CompareTable";
import { AnimatedDetails } from "../ui/AnimatedDetails";
import { ToggleButton } from "../ui/ToggleButton";
import { formatDollars } from "../../lib/format";
import { entriesOf } from "../../lib/records";
import { DRIVER_PART_NAMES } from "../../constants/optimizerText";
import { UI_TEXT } from "../../constants/uiText";
import { DRIVER_COMPARE_SORT, DRIVER_COMPARE_TEXT } from "../../constants/driverCompare";
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
      summary={DRIVER_COMPARE_TEXT.heading}
      className="text-sm rounded border border-stone-300 bg-stone-50 px-3 py-2"
      summaryClassName="cursor-pointer py-1"
    >
      {(open) =>
        open && (
          <div className="pt-2">
            <div className="text-xs text-stone-500 mb-2">
              Each option in your design, all else the same, against your limits.
            </div>
            <div className="flex flex-wrap gap-1" role="group" aria-label="Part to compare">
              {entriesOf(DRIVER_PART_NAMES).map(([k, name]) => (
                <ToggleButton key={k} on={part === k} onClick={() => setPart(k)}>
                  {name}
                </ToggleButton>
              ))}
            </div>
            <div className="mt-2">
              <CompareTable
                nameHead={DRIVER_PART_NAMES[part]}
                columns={[
                  {
                    key: DRIVER_COMPARE_SORT.price,
                    head: DRIVER_COMPARE_TEXT.price,
                    cell: (r) => (r.price == null ? "?" : formatDollars(r.price)),
                  },
                  {
                    key: DRIVER_COMPARE_SORT.total,
                    head: "Drivers / stack",
                    cell: (r) =>
                      r.m
                        ? `${formatDollars(r.m.price)}${r.m.priceKnown ? "" : UI_TEXT.partialPriceMark}`
                        : "–",
                  },
                  {
                    key: DRIVER_COMPARE_SORT.lb,
                    head: WEIGHT_HEAD[part],
                    cell: (r) => (r.lb == null ? "–" : `${r.lb.toFixed(r.lb < 10 ? 1 : 0)} lb`),
                  },
                  ...PART_COLUMNS[part].map((c): CompareColumn<PaDriverCompareRow> => ({
                    key: c.head,
                    head: c.head,
                    cell: (r) => (r.m ? c.value(r.m) : "–"),
                  })),
                ]}
                rows={rows(part)}
                onUse={(r) => onUse(part, r.id)}
                bg="bg-stone-50"
                minWidth="min-w-[600px]"
              />
            </div>
          </div>
        )
      }
    </AnimatedDetails>
  );
}
