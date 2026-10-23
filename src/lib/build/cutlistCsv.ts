// The cutlist as one CSV file for spreadsheets and cutting tools: the panels (length and width in their own columns, in
// decimal inches or mm as the Units setting shows), then the purchased parts with a total. Not part of the .speaknow.json design file
// (docs/import-export-spec.md). Pure.
import type { CutPart, PurchasedPart, UnitSystem } from "../../types";
import { QUANTITIES, UNIT_SYSTEM } from "../../constants/units";
import {
  PURCHASED_COLUMNS,
  PURCHASED_PARTIAL_NOTE,
  PURCHASED_PART_NAMES,
} from "../../constants/purchasedParts";
import { UI_TEXT } from "../../constants/uiText";

/** The CSV's media type: UTF-8, so a spreadsheet reads ″, ° and × right (with the byte order mark the text starts with). */
export const CSV_TYPE = "text/csv;charset=utf-8";

/** The UTF-8 byte order mark: Excel reads a CSV as UTF-8 only when the file starts with it. */
export const CSV_BOM = "\uFEFF";

/** The CSV's panel columns, the sizes' in the system's unit (in or mm). */
export const panelCsvColumns = (system: UnitSystem) => {
  const unit = QUANTITIES.boxLength[system].unit;
  return [
    "Box",
    "Tag",
    "Part",
    "Qty",
    `L (${unit})`,
    `W (${unit})`,
    "Grain",
    `Thickness (${unit})`,
    "Notes",
  ];
};

/** The CSV's section headings, each on its own line above its columns. */
export const CSV_SECTIONS = { panels: "Panels", purchased: "Purchased parts" } as const;

/** The grain column's words: L runs along the grain, or the part turns either way. */
export const CSV_GRAIN = { along: "L along grain", any: "any" } as const;

/** The purchased total row's first cell. */
export const CSV_TOTAL = "Total";

/** One panel row as the CSV takes it: its names, count and size, already worked out by the page. */
export interface PanelCsvRow {
  box: string;
  tag: string;
  part: string;
  qty: number;
  /** length and width, in (the CSV writes them in the system's unit): L along the grain when locked, else the long side */
  l: number;
  w: number;
  grainLocked: boolean;
  t: number;
  notes: readonly string[];
}

/** A cell, quoted where it holds a comma, a quote or a line break (RFC 4180). */
const cell = (v: string | number | null) => {
  const s = v === null ? "" : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const line = (cells: readonly (string | number | null)[]) => cells.map(cell).join(",");
/**
 * A size, inches, as a spreadsheet or a cutting tool reads it: inches to the thousandth in US; in metric, mm to the tenth,
 * or to the page's decimals for a thickness.
 */
const csvSize = (system: UnitSystem, inches: number, thickness = false) => {
  if (system !== UNIT_SYSTEM.metric) return Math.round(inches * 1000) / 1000;
  const { per, decimals } = QUANTITIES.panelThickness.metric;
  return +(inches * per).toFixed(thickness ? decimals : 1);
};
/** Dollars to the cent; empty when unknown. */
const dollars = (v: number | null) => (v === null ? null : v.toFixed(2));

/** A part's length and width, in: along the grain first when it is locked, else the long side first. */
export const partLengthWidth = (p: Pick<CutPart, "a" | "b" | "grain">): [l: number, w: number] =>
  p.grain === "b"
    ? [p.b, p.a]
    : p.grain === "a"
      ? [p.a, p.b]
      : [Math.max(p.a, p.b), Math.min(p.a, p.b)];

/** The purchased parts' total, US dollars, of the parts with a price, and whether some part has none. */
export const purchasedTotal = (rows: readonly PurchasedPart[], sets = 1) => ({
  dollars: rows.reduce((sum, r) => sum + (r.unit ?? 0) * r.count * sets, 0),
  partial: rows.some((r) => r.unit === null),
});

/**
 * The cutlist as CSV text, after the UTF-8 byte order mark: the panels, a blank line, then the purchased parts and their
 * total (marked, with a note row, when some part has no price). `sets` multiplies the purchased counts as the panel
 * quantities already are (one set per speaker). Sizes are in the system's unit; notes come as the page shows them.
 */
export function cutlistCsv(
  panels: readonly PanelCsvRow[],
  purchased: readonly PurchasedPart[],
  sets: number,
  system: UnitSystem,
): string {
  const out = [
    line([CSV_SECTIONS.panels]),
    line(panelCsvColumns(system)),
    ...panels.map((p) =>
      line([
        p.box,
        p.tag,
        p.part,
        p.qty,
        csvSize(system, p.l),
        csvSize(system, p.w),
        p.grainLocked ? CSV_GRAIN.along : CSV_GRAIN.any,
        csvSize(system, p.t, true),
        p.notes.join("; "),
      ]),
    ),
  ];
  if (purchased.length) {
    const total = purchasedTotal(purchased, sets);
    out.push(
      "",
      line([CSV_SECTIONS.purchased]),
      line(Object.values(PURCHASED_COLUMNS)),
      ...purchased.map((r) =>
        line([
          PURCHASED_PART_NAMES[r.kind],
          r.model,
          r.count * sets,
          dollars(r.unit),
          dollars(r.unit === null ? null : r.unit * r.count * sets),
          r.source,
        ]),
      ),
      line([
        CSV_TOTAL,
        null,
        null,
        null,
        `${dollars(total.dollars)}${total.partial ? UI_TEXT.partialPriceMark : ""}`,
        null,
      ]),
      ...(total.partial ? [line([PURCHASED_PARTIAL_NOTE])] : []),
    );
  }
  return CSV_BOM + out.join("\r\n") + "\r\n";
}
