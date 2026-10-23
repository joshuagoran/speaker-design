import { POINTER_MOUSE } from "../../constants/pointer";
import type { ReactNode } from "react";
import { Button } from "./Button";
import { Tooltip } from "./Tooltip";
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
  /** what the heading means, in a tooltip on it; absent: none */
  tip?: string;
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
  /** show the checks column (default); without it, the page shows a row's checks elsewhere (`CompareChecks`) */
  checks?: boolean;
  /** narrow: closer columns and headings that wrap (a settings column) */
  compact?: boolean;
  /** a click on a row (or Enter on it) uses it, in place of a Use column */
  rowUse?: boolean;
  /** a Use button on each row (default); without it, rows are used by a click (`rowUse`) or a button the page shows */
  useColumn?: boolean;
}

/** A row's checks: "passes", or the problems, gray where your design has it too, orange where the option adds it. */
export function CompareChecks({ problems }: Pick<CompareRowBase, "problems">) {
  if (!problems.length) return <span className="text-green-700">{DRIVER_COMPARE_TEXT.passes}</span>;
  return problems.map((p, i) => (
    <span key={`${p.text}-${i}`} className={p.yoursToo ? "text-stone-500" : "text-orange-700"}>
      {i > 0 && "; "}
      {p.text}
    </span>
  ));
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
  checks = true,
  compact = false,
  rowUse = false,
  useColumn = true,
}: Props<R>) {
  /** the space after each column */
  const gap = compact ? "pr-2" : "pr-3";
  /** a heading: a button that sorts by it, where the table sorts */
  const head = (key: string, label: ReactNode) => {
    if (!sort) return label;
    const on = sort.key === key;
    return (
      <button
        type="button"
        onClick={() => sort.onSort(key)}
        className={`rounded [text-align:inherit] ${compact ? "" : "whitespace-nowrap"} hover:text-stone-900 focus-visible:text-stone-900 ${on ? "text-stone-900" : ""} ${HOVER_TRANSITION}`}
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
          <tr className="text-stone-500 text-left align-bottom border-b border-stone-300">
            <th
              className={`py-1 ${gap} font-normal sticky left-0 ${bg}`}
              aria-sort={ariaSort(DRIVER_COMPARE_SORT.name)}
            >
              {head(DRIVER_COMPARE_SORT.name, nameHead)}
            </th>
            {columns.map((c) => (
              <th
                key={c.key}
                className={`py-1 ${gap} font-normal text-right`}
                aria-sort={ariaSort(c.key)}
              >
                {head(c.key, c.tip ? <Tooltip tip={c.tip}>{c.head}</Tooltip> : c.head)}
              </th>
            ))}
            {checks && (
              <th
                className="py-1 pr-3 font-normal"
                aria-sort={ariaSort(DRIVER_COMPARE_SORT.checks)}
              >
                {head(DRIVER_COMPARE_SORT.checks, DRIVER_COMPARE_TEXT.checks)}
              </th>
            )}
            {useColumn && <th className="py-1 font-normal" />}
          </tr>
        </thead>
        <tbody
          onPointerLeave={
            onPreview &&
            ((e) => {
              if (e.pointerType === POINTER_MOUSE) onPreview(null);
            })
          }
        >
          {rows.map((r) => {
            const tint = previewId === r.id ? PREVIEW_TINT : "";
            /** the row is used by a click on it */
            const clickUses = rowUse && !r.yours;
            return (
              <tr
                key={r.id}
                className={`border-b border-stone-300 last:border-0 align-top ${clickUses ? "cursor-pointer" : ""}`}
                tabIndex={clickUses ? 0 : undefined}
                // a mouse previews the row it is over; a finger previews the row it taps (a tap leaves no pointer
                // behind), unless a click uses it
                onPointerEnter={
                  onPreview &&
                  ((e) => {
                    if (e.pointerType === POINTER_MOUSE) onPreview(r);
                  })
                }
                onClick={
                  clickUses
                    ? () => onUse(r)
                    : rowUse
                      ? undefined
                      : onPreview && (() => onPreview(r))
                }
                onKeyDown={
                  clickUses
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onUse(r);
                        }
                      }
                    : undefined
                }
                onFocus={onPreview && (() => onPreview(r))}
              >
                <td
                  className={`py-1.5 ${gap} sticky left-0 ${bg} ${tint} ${r.yours ? "font-bold" : ""}`}
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
                  <td key={c.key} className={`py-1.5 ${gap} text-right whitespace-nowrap ${tint}`}>
                    {c.cell(r)}
                  </td>
                ))}
                {checks && (
                  <td className={`py-1.5 pr-3 ${tint}`}>
                    <CompareChecks problems={r.problems} />
                  </td>
                )}
                {useColumn && (
                  <td className={`py-1 text-right ${tint}`}>
                    {!r.yours && (
                      <Button
                        size="xs"
                        onClick={(e) => {
                          // Use clears the preview: the row's own click must not set it again
                          e.stopPropagation();
                          onUse(r);
                        }}
                      >
                        {DRIVER_COMPARE_TEXT.use}
                      </Button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
