import { formatDollars } from "../../lib/format.ts";

/** Difference from the current design, coloured by whether it is an improvement. */
export function Delta({ v, unit, lowerIsBetter, digits = 0 }) {
  if (v == null) return null;
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
