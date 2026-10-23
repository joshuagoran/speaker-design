import { formatDollars } from "../../lib/format";
import { useUnitSettings } from "../../hooks/useUnits";
import { scaleToShown, shownDecimals, unitName } from "../../lib/units";
import type { Quantity } from "../../types";

interface Props {
  /** the change; nothing is shown for null/undefined */
  v: number | null | undefined;
  /** the unit after the number (with its space); absent with a `quantity` */
  unit?: string;
  /** what the change measures, when the Units setting changes it: `v` in the stored unit, shown in the page's */
  quantity?: Quantity;
  lowerIsBetter?: boolean;
  /** the places shown (a converted quantity shows its own) */
  digits?: number;
}

/** Difference from the current design, colored by whether it is an improvement. */
export function Delta({
  v: stored,
  unit: ownUnit = "",
  quantity,
  lowerIsBetter,
  digits: ownDigits = 0,
}: Props) {
  const settings = useUnitSettings();
  if (stored == null) return null;
  const v = quantity ? scaleToShown(quantity, settings, stored) : stored;
  const unit = quantity ? ` ${unitName(quantity, settings)}` : ownUnit;
  const digits = quantity ? shownDecimals(quantity, settings, ownDigits) : ownDigits;
  const r = Number(v.toFixed(digits));
  const good = lowerIsBetter ? r < 0 : r > 0,
    bad = lowerIsBetter ? r > 0 : r < 0;
  const txt =
    r === 0
      ? "±0"
      : `${r > 0 ? "+" : "\u2212"}${unit === "$" ? formatDollars(Math.abs(r)) : Math.abs(r).toFixed(digits) + unit}`;
  return (
    <div
      className={`text-xs font-semibold ${good ? "text-green-800" : bad ? "text-red-700" : "text-stone-500"}`}
    >
      {txt}
      {good ? " better" : bad ? " worse" : ""}
    </div>
  );
}
