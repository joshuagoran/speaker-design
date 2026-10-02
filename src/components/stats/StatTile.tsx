import { StatLabel } from "../optimizer/StatRow.tsx";

/** One headline number: a small label (with tooltip when one exists), the value and its unit. */
export function StatTile({ label, value, unit }) {
  return (
    <div className="bg-stone-50 px-3 py-2.5">
      <div className="text-xs uppercase tracking-wider text-stone-500 font-semibold">
        <StatLabel k={label} />
      </div>
      <div className="text-xl font-medium tabular-nums mt-0.5 break-words">
        {value}
        <span className="text-xs text-stone-500 ml-0.5">{unit}</span>
      </div>
    </div>
  );
}
