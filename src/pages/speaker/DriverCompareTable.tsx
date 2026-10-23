import { useUnits } from "../../hooks/useUnits";
import type { Units } from "../../lib/units";
import { useState } from "react";
import { CompareChecks, CompareTable, type CompareColumn } from "../../components/ui/CompareTable";
import { SORT_BEST, sortRows, type DriverCompareRow } from "../../lib/speaker/driverCompare";
import { isWooferKind } from "./speakerParts";
import { formatDollars } from "../../lib/format";
import { Button } from "../../components/ui/Button";
import { DRIVER_TYPE_NAMES } from "../../constants/speakerPage";
import { DRIVER_KIND } from "../../constants/speakerSpec";
import {
  DRIVER_COMPARE_SORT,
  DRIVER_COMPARE_TEXT,
  SORT_DIRECTION,
  type DriverCompareSort,
  type SortDirection,
} from "../../constants/driverCompare";
import { keysOf } from "../../lib/records";
import type { DriverCompareOption, SpeakerDriver } from "../../types";

interface Props {
  rows: readonly DriverCompareRow[];
  /** the entry's kind: the name column's heading */
  kind: SpeakerDriver["kind"];
  previewId: string | null;
  onPreview: (id: string | null) => void;
  /** puts an option into the entry */
  onUse: (o: DriverCompareOption) => void;
  /** a click on a row uses it (from md up); else a tap previews it and Use sits beside its checks (a phone) */
  rowUse: boolean;
}

/** A number with its unit (none: the heading carries it), to `digits` decimals; "–" for none. */
const amount = (x: number | null, unit: string, digits = 1) =>
  x === null ? "–" : `${x.toFixed(digits)}${unit ? ` ${unit}` : ""}`;

/** The Speaker page's columns between the name and the checks, in order (the weight in the page's units). */
const columnsFor = (units: Units): CompareColumn<DriverCompareRow>[] => [
  {
    key: DRIVER_COMPARE_SORT.price,
    head: DRIVER_COMPARE_TEXT.heads.price,
    cell: (r) => (r.price === null ? "?" : formatDollars(r.price)),
  },
  {
    key: DRIVER_COMPARE_SORT.lb,
    head: DRIVER_COMPARE_TEXT.heads.lb,
    cell: (r) => (r.lb === null ? amount(null, "") : units.format("mass", r.lb, 1)),
  },
  {
    key: DRIVER_COMPARE_SORT.level,
    head: DRIVER_COMPARE_TEXT.heads.level,
    tip: DRIVER_COMPARE_TEXT.heads.levelTip,
    // the heading carries the unit
    cell: (r) => amount(r.levelDb, ""),
  },
  {
    key: DRIVER_COMPARE_SORT.f3,
    head: DRIVER_COMPARE_TEXT.heads.f3,
    cell: (r) => amount(r.run.metrics.f3, "Hz"),
  },
  {
    key: DRIVER_COMPARE_SORT.max,
    head: DRIVER_COMPARE_TEXT.heads.max,
    cell: (r) => amount(r.run.metrics.musicDb, ""),
  },
];

/**
 * The Speaker page's driver comparison table: each option's numbers in your design, sorted by maximum output (highest
 * first) until a heading is clicked; a second click on the same heading reverses it. Yours stays first, and the options
 * that fail something yours doesn't stay last. The previewed row's checks (else yours) show above the table.
 */
export function DriverCompareTable({ rows, kind, previewId, onPreview, onUse, rowUse }: Props) {
  const units = useUnits();
  const [sort, setSort] = useState<{ key: DriverCompareSort; dir: SortDirection }>({
    key: DRIVER_COMPARE_SORT.max,
    dir: SORT_BEST.max,
  });
  const onSort = (key: string) => {
    const next = keysOf(DRIVER_COMPARE_SORT).find((k) => k === key);
    if (!next) return;
    setSort((s) =>
      s.key === next
        ? {
            key: next,
            dir:
              s.dir === SORT_DIRECTION.ascending
                ? SORT_DIRECTION.descending
                : SORT_DIRECTION.ascending,
          }
        : { key: next, dir: SORT_BEST[next] },
    );
  };
  const sorted = sortRows(rows, sort.key, sort.dir);
  /** the row whose checks show: the one previewed, else yours */
  const shown = sorted.find((r) => r.id === previewId) ?? sorted.find((r) => r.yours);
  const use = (r: DriverCompareRow) => {
    // the row moves to the top as yours: the pointer is no longer over it
    onPreview(null);
    onUse(r.option);
  };
  return (
    <>
      {/* two lines held, so the table doesn't move as the checks change */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs min-h-[2lh]">
          {shown && (
            <>
              <span className="text-stone-500">{shown.name}: </span>
              <CompareChecks problems={shown.problems} />
            </>
          )}
        </p>
        {!rowUse && shown && !shown.yours && (
          <Button size="xs" onClick={() => use(shown)}>
            {DRIVER_COMPARE_TEXT.swap}
          </Button>
        )}
      </div>
      <CompareTable
        nameHead={DRIVER_TYPE_NAMES[isWooferKind(kind) ? DRIVER_KIND.woofer : kind]}
        columns={columnsFor(units)}
        rows={sorted}
        onUse={use}
        bg="bg-panel"
        compact
        rowUse={rowUse}
        useColumn={false}
        minWidth="min-w-[22rem]"
        checks={false}
        sort={{ ...sort, onSort }}
        previewId={previewId}
        onPreview={(r) => onPreview(r && r.id)}
      />
    </>
  );
}
