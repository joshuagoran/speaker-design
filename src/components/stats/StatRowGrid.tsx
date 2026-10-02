import { StatRow } from "../optimizer/StatRow";

/** One detail row: name, value, optional note and optional tooltip text. */
export type StatRowItem = [
  name: string,
  value: React.ReactNode,
  note?: React.ReactNode,
  tooltip?: string,
];

interface Props {
  rows: StatRowItem[];
}

/** Two-column list of detail rows, each `[name, value, note, tooltip]`. */
export function StatRowGrid({ rows }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-0.5 text-sm">
      {rows.map(([k, v, note, tip]) => (
        <StatRow key={k} k={k} v={v} note={note} tip={tip} />
      ))}
    </div>
  );
}
