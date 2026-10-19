import { useState } from "react";
import { CompareTable, type CompareColumn } from "../../components/ui/CompareTable";
import { SORT_BEST, sortRows, type DriverCompareRow } from "../../lib/speaker/driverCompare";
import { isWooferKind } from "./speakerParts";
import { formatDollars } from "../../lib/format";
import { UI_TEXT } from "../../constants/uiText";
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
  /** the entry's band's name: the level column's heading */
  bandName: string;
  previewId: string | null;
  onPreview: (id: string | null) => void;
  /** puts an option into the entry */
  onUse: (o: DriverCompareOption) => void;
}

/** A number with its unit, to `digits` decimals; "–" for none. */
const amount = (x: number | null, unit: string, digits = 1) =>
  x === null ? "–" : `${x.toFixed(digits)} ${unit}`;

/** The Speaker page's columns between the name and the checks, in order. */
const COLUMNS = (bandName: string): CompareColumn<DriverCompareRow>[] => [
  {
    key: DRIVER_COMPARE_SORT.price,
    head: DRIVER_COMPARE_TEXT.price,
    cell: (r) => (r.price === null ? "?" : formatDollars(r.price)),
  },
  {
    key: DRIVER_COMPARE_SORT.total,
    head: DRIVER_COMPARE_TEXT.total,
    // no part with a price: unknown, not $0
    cell: ({ run: { metrics } }) =>
      metrics.pricePartial && metrics.price === 0
        ? "?"
        : `${formatDollars(metrics.price)}${metrics.pricePartial ? UI_TEXT.partialPriceMark : ""}`,
  },
  {
    key: DRIVER_COMPARE_SORT.lb,
    head: DRIVER_COMPARE_TEXT.lb,
    cell: (r) => amount(r.run.metrics.lb, "lb"),
  },
  {
    key: DRIVER_COMPARE_SORT.level,
    head: DRIVER_COMPARE_TEXT.level(bandName),
    cell: (r) => amount(r.run.bandDb, "dB"),
  },
  {
    key: DRIVER_COMPARE_SORT.f3,
    head: DRIVER_COMPARE_TEXT.f3,
    cell: (r) => amount(r.run.metrics.f3, "Hz"),
  },
  {
    key: DRIVER_COMPARE_SORT.max,
    head: DRIVER_COMPARE_TEXT.max,
    cell: (r) => amount(r.run.metrics.musicDb, "dB"),
  },
];

/**
 * The Speaker page's driver comparison table: each option's numbers in your design, sorted by maximum output (highest
 * first) until a heading is clicked; a second click on the same heading reverses it. Yours stays first, and the options
 * that fail something yours doesn't stay last.
 */
export function DriverCompareTable({ rows, kind, bandName, previewId, onPreview, onUse }: Props) {
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
  return (
    <CompareTable
      nameHead={DRIVER_TYPE_NAMES[isWooferKind(kind) ? DRIVER_KIND.woofer : kind]}
      columns={COLUMNS(bandName)}
      rows={sortRows(rows, sort.key, sort.dir)}
      onUse={(r) => {
        // the row moves to the top as yours: the pointer is no longer over it
        onPreview(null);
        onUse(r.option);
      }}
      bg="bg-panel"
      minWidth="min-w-[760px]"
      sort={{ ...sort, onSort }}
      previewId={previewId}
      onPreview={(r) => onPreview(r && r.id)}
    />
  );
}
