import { StatRow, statLabel, type StatName } from "../optimizer/StatRow";

/** One detail row: name, value, optional note and optional tooltip text. */
export type StatRowItem = [
  name: StatName,
  value: React.ReactNode,
  note?: React.ReactNode,
  tooltip?: string,
];

interface Props {
  rows: StatRowItem[];
}

/**
 * List of detail rows, each `[name, value, note, tooltip]`: two columns from `sm` up while its own box is wide enough
 * for a value's note to fit beside the name (one column in a narrow results column, e.g. PA Design's two-column grid).
 */
export function StatRowGrid({ rows }: Props) {
  return (
    <div className="[container-type:inline-size]">
      <div className="grid grid-cols-1 sm:[@container(min-width:480px)]:grid-cols-2 gap-x-8 gap-y-0.5 text-sm">
        {rows.map(([k, v, note, tip]) => (
          <StatRow key={statLabel(k)} k={k} v={v} note={note} tip={tip} />
        ))}
      </div>
    </div>
  );
}
