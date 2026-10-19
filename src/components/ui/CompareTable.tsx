import type { ReactNode } from "react";
import { Button } from "./Button";
import { HOVER_TRANSITION } from "./buttonStyles";
import {
  DRIVER_COMPARE_SORT,
  DRIVER_COMPARE_TEXT,
  SORT_MARKS,
  type SortDirection,
} from "../../constants/driverCompare";
import type { CompareProblem } from "../../types";

/** A row of a driver comparison: its id, its name, whether it is your design's part, and what it fails. */
export interface CompareRowBase {
  id: string;
  name: string;
  yours: boolean;
  problems: readonly CompareProblem[];
}

/** A column between the name and the checks: its key (its sort key where the table sorts), heading and cell. */
export interface CompareColumn<R> {
  key: string;
  head: string;
  cell: (row: R) => ReactNode;
}

/** How the table sorts: the key and direction it sorts by, and what a heading's click (or Enter or Space) does. */
export interface CompareSort {
  key: string;
  dir: SortDirection;
  onSort: (key: string) => void;
}

interface Props<R extends CompareRowBase> {
  /** the name column's heading */
  nameHead: string;
  columns: readonly CompareColumn<R>[];
  rows: readonly R[];
  /** puts an option into your design (every row but yours has the button) */
  onUse: (row: R) => void;
  /** the block's background class: the name column sticks over the others in it */
  bg: string;
  /** the table's narrowest width class: under it, the table scrolls sideways */
  minWidth: string;
  /** sorts by a heading; absent: the headings are plain words */
  sort?: CompareSort;
  /** the row under the pointer, tapped (a scroll that starts on it doesn't count) or with focus (null: none); absent: rows don't preview */
  onPreview?: (row: R | null) => void;
  /** the row previewed: it is tinted */
  previewId?: string | null;
}

/** A previewed row's tint: cyan over the cell's own background, so the sticky name cell stays opaque. */
const PREVIEW_TINT = "bg-[linear-gradient(rgb(var(--cyan)/0.12),rgb(var(--cyan)/0.12))]";

/**
 * A driver comparison's table: each option's name (" · yours" on yours), the columns, its checks ("passes", or the
 * problems: gray where your design has it too, orange where the option adds it) and a Use button. The PA optimizer's
 * and the Speaker page's comparisons share it; the Speaker page's sorts by its headings and previews a row.
 */
export function CompareTable<R extends CompareRowBase>({
  nameHead,
  columns,
  rows,
  onUse,
  bg,
  minWidth,
  sort,
  onPreview,
  previewId,
}: Props<R>) {
  /** a heading: a button that sorts by it, where the table sorts */
  const head = (key: string, label: string) => {
    if (!sort) return label;
    const on = sort.key === key;
    return (
      <button
        type="button"
        onClick={() => sort.onSort(key)}
        className={`rounded whitespace-nowrap hover:text-stone-900 focus-visible:text-stone-900 ${on ? "text-stone-900" : ""} ${HOVER_TRANSITION}`}
      >
        {label}
        {on && SORT_MARKS[sort.dir]}
      </button>
    );
  };
  const ariaSort = (key: string) => (sort?.key === key ? sort.dir : undefined);
  return (
    <div className="overflow-x-auto">
      <table className={`text-xs w-full ${minWidth} border-collapse tabular-nums`}>
        <thead>
          <tr className="text-stone-500 text-left border-b border-stone-300">
            <th
              className={`py-1 pr-3 font-normal sticky left-0 ${bg}`}
              aria-sort={ariaSort(DRIVER_COMPARE_SORT.name)}
            >
              {head(DRIVER_COMPARE_SORT.name, nameHead)}
            </th>
            {columns.map((c) => (
              <th
                key={c.key}
                className="py-1 pr-3 font-normal text-right"
                aria-sort={ariaSort(c.key)}
              >
                {head(c.key, c.head)}
              </th>
            ))}
            <th className="py-1 pr-3 font-normal" aria-sort={ariaSort(DRIVER_COMPARE_SORT.checks)}>
              {head(DRIVER_COMPARE_SORT.checks, DRIVER_COMPARE_TEXT.checks)}
            </th>
            <th className="py-1 font-normal" />
          </tr>
        </thead>
        <tbody
          onPointerLeave={
            onPreview &&
            ((e) => {
              if (e.pointerType === "mouse") onPreview(null);
            })
          }
        >
          {rows.map((r) => {
            const tint = previewId === r.id ? PREVIEW_TINT : "";
            return (
              <tr
                key={r.id}
                className="border-b border-stone-300 last:border-0 align-top"
                // a mouse previews the row it is over; a finger previews the row it taps (a tap leaves no pointer behind)
                onPointerEnter={
                  onPreview &&
                  ((e) => {
                    if (e.pointerType === "mouse") onPreview(r);
                  })
                }
                onClick={onPreview && (() => onPreview(r))}
                onFocus={onPreview && (() => onPreview(r))}
              >
                <td
                  className={`py-1.5 pr-3 sticky left-0 ${bg} ${tint} ${r.yours ? "font-bold" : ""}`}
                >
                  {r.name}
                  {r.yours && (
                    <span className="font-normal text-stone-500">
                      {" "}
                      · {DRIVER_COMPARE_TEXT.yours}
                    </span>
                  )}
                </td>
                {columns.map((c) => (
                  <td key={c.key} className={`py-1.5 pr-3 text-right whitespace-nowrap ${tint}`}>
                    {c.cell(r)}
                  </td>
                ))}
                <td className={`py-1.5 pr-3 ${tint}`}>
                  {r.problems.length ? (
                    // a problem your design has whatever you pick is gray; what this option adds is orange
                    r.problems.map((p, i) => (
                      <span
                        key={`${p.text}-${i}`}
                        className={p.yoursToo ? "text-stone-500" : "text-orange-700"}
                      >
                        {i > 0 && "; "}
                        {p.text}
                      </span>
                    ))
                  ) : (
                    <span className="text-green-700">{DRIVER_COMPARE_TEXT.passes}</span>
                  )}
                </td>
                <td className={`py-1 text-right ${tint}`}>
                  {!r.yours && (
                    <Button size="xs" onClick={() => onUse(r)}>
                      {DRIVER_COMPARE_TEXT.use}
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
