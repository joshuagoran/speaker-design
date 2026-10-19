import { FONT } from "../../styles/fonts";

/** One figure in the strip: its label, value and unit. */
export type SummaryItem = readonly [label: string, value: string, unit: string];

interface Props {
  items: readonly SummaryItem[];
}

/** A sticky strip of headline figures, shown on phones only: the Stack page's stack figures. */
export function SummaryStrip({ items }: Props) {
  return (
    <div
      className="md:hidden sticky top-0 z-30 -mx-4 bg-stone-50/95 backdrop-blur border-b border-stone-300 px-4 py-1.5 grid grid-cols-4 gap-2 text-center"
      style={{ fontFamily: FONT }}
    >
      {items.map(([k, v, u]) => (
        <div key={k}>
          <div className="text-xs uppercase tracking-wider text-stone-500">{k}</div>
          <div className="text-sm font-medium tabular-nums">
            {v}
            <span className="text-xs text-stone-500 ml-0.5">{u}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
