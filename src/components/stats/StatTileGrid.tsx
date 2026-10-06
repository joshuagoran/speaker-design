import { StatTile } from "./StatTile";
import { statLabel, type StatName } from "../optimizer/StatRow";
import { RESULT_MAX_WIDTH } from "../../styles/layout";

/** One headline number: label, value and unit. */
export type StatTileItem = [label: StatName, value: React.ReactNode, unit?: React.ReactNode];

interface Props {
  tiles: StatTileItem[];
  /** spacing classes; a grid inside a flex column with its own gap passes "" */
  className?: string;
}

/** Responsive grid of headline numbers, each `[label, value, unit]`. */
export function StatTileGrid({ tiles, className = "mb-4" }: Props) {
  return (
    <div
      className={`${RESULT_MAX_WIDTH} ${className} grid gap-px rounded-lg overflow-hidden border border-stone-300 bg-stone-300 grid-cols-2 sm:grid-cols-[repeat(auto-fit,minmax(112px,1fr))] [&>*:last-child:nth-child(odd)]:col-span-2 sm:[&>*:last-child:nth-child(odd)]:col-span-1`}
    >
      {tiles.map(([label, value, unit]) => (
        <StatTile key={statLabel(label)} label={label} value={value} unit={unit} />
      ))}
    </div>
  );
}
