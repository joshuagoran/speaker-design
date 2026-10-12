// The cutlist as one CSV file for spreadsheets and cutting tools: the panels (length and width in their own columns, in
// decimal inches), then the purchased parts with a total. Not part of the .speaknow.json design file
// (docs/import-export-spec.md). Pure.
import type { CutPart, PurchasedPart } from "../types";
import { PURCHASED_COLUMNS, PURCHASED_PART_NAMES } from "../constants/purchasedParts";

/** The CSV's panel columns. */
export const PANEL_CSV_COLUMNS = [
  "Box",
  "Tag",
  "Part",
  "Qty",
  "L (in)",
  "W (in)",
  "Grain",
  "Thickness (in)",
  "Notes",
] as const;

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
  /** length and width, in: L along the grain when the grain is locked, else the long side */
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
/** Inches as a decimal, to the thousandth: what a spreadsheet or a cutting tool reads. */
const inches = (v: number) => Math.round(v * 1000) / 1000;
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
 * The cutlist as CSV text: the panels, a blank line, then the purchased parts and their total. `sets` multiplies the
 * purchased counts as the panel quantities already are (one set per speaker).
 */
export function cutlistCsv(
  panels: readonly PanelCsvRow[],
  purchased: readonly PurchasedPart[],
  sets: number,
): string {
  const out = [
    line([CSV_SECTIONS.panels]),
    line(PANEL_CSV_COLUMNS),
    ...panels.map((p) =>
      line([
        p.box,
        p.tag,
        p.part,
        p.qty,
        inches(p.l),
        inches(p.w),
        p.grainLocked ? CSV_GRAIN.along : CSV_GRAIN.any,
        inches(p.t),
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
          r.vendor,
        ]),
      ),
      line([CSV_TOTAL, null, null, null, dollars(total.dollars), null]),
    );
  }
  return out.join("\r\n") + "\r\n";
}
