// The Speaker cutlist's purchased parts (lib/speaker/speakerBuild speakerPurchasedParts) and the cutlist CSV
// (lib/build/cutlistCsv): length and width in their own columns, the bought parts with a total.
import { assert, test } from "vite-plus/test";
import {
  CSV_BOM,
  CSV_SECTIONS,
  CSV_TOTAL,
  PANEL_CSV_COLUMNS,
  cutlistCsv,
  partLengthWidth,
  purchasedTotal,
} from "../src/lib/build/cutlistCsv";
import { sourceOf } from "../src/lib/speaker/driverParts";
import { speakerPurchasedParts } from "../src/lib/speaker/speakerBuild";
import { templateSpeaker } from "../src/pages/speaker/speakerTemplates";
import { SPEAKER_TEMPLATE } from "../src/constants/speakerStarts";
import { PURCHASED_PARTIAL_NOTE, PURCHASED_PART } from "../src/constants/purchasedParts";
import { UI_TEXT } from "../src/constants/uiText";
import type { PurchasedPart } from "../src/types";

test("cutlist CSV: L runs along a locked grain, else it is the long side", () => {
  assert.deepEqual(partLengthWidth({ a: 10, b: 20, grain: "a" }), [10, 20]);
  assert.deepEqual(partLengthWidth({ a: 10, b: 20, grain: "b" }), [20, 10]);
  assert.deepEqual(partLengthWidth({ a: 10, b: 20 }), [20, 10]);
});

test("cutlist CSV: the panels with L and W in their own columns, then the purchased parts and their total", () => {
  const bought: PurchasedPart[] = [
    { kind: PURCHASED_PART.driver, model: 'Maker "X", 12', count: 1, unit: 100, source: "A" },
    { kind: PURCHASED_PART.portTube, model: "tube", count: 2, unit: null, source: null },
  ];
  const csv = cutlistCsv(
    [
      {
        box: "Shell",
        tag: "K1",
        part: "Side",
        qty: 4,
        l: 47.5,
        w: 18,
        grainLocked: true,
        t: 0.7087,
        notes: ["a", "b"],
      },
    ],
    bought,
    2,
  );
  // the UTF-8 byte order mark first, so a spreadsheet reads ″, ° and × right
  assert.ok(csv.startsWith(CSV_BOM));
  const lines = csv.slice(CSV_BOM.length).trimEnd().split("\r\n");
  assert.equal(lines[0], CSV_SECTIONS.panels);
  assert.equal(lines[1], PANEL_CSV_COLUMNS.join(","));
  assert.equal(lines[2], "Shell,K1,Side,4,47.5,18,L along grain,0.709,a; b");
  assert.equal(lines[3], "");
  assert.equal(lines[4], CSV_SECTIONS.purchased);
  // a comma or a quote is quoted; counts and totals for both speakers
  assert.equal(lines[6], 'Driver,"Maker ""X"", 12",2,100.00,200.00,A');
  assert.equal(lines[7], "Port tube,tube,4,,,");
  // a part with no price: the total is marked, and a note row follows it
  assert.equal(lines[8], `${CSV_TOTAL},,,,200.00${UI_TEXT.partialPriceMark},`);
  assert.equal(lines[9], PURCHASED_PARTIAL_NOTE);
  assert.deepEqual(purchasedTotal(bought, 2), { dollars: 200, partial: true });
});

test("cutlist CSV: every price known, the total has no mark and no note row", () => {
  const csv = cutlistCsv(
    [],
    [{ kind: PURCHASED_PART.driver, model: "M", count: 1, unit: 10, source: "A" }],
    1,
  );
  const lines = csv.slice(CSV_BOM.length).trimEnd().split("\r\n");
  assert.equal(lines[lines.length - 1], `${CSV_TOTAL},,,,10.00,`);
});

test("purchased parts: the price source as the catalog writes it, a link as its site", () => {
  assert.equal(sourceOf("Parts Express 260-705, Oct 2026"), "Parts Express 260-705, Oct 2026");
  assert.equal(sourceOf("https://www.pvcfittingsonline.com/products/x"), "pvcfittingsonline.com");
});

test("purchased parts: the PA tower's drivers, horn and hardware, each with its count", () => {
  const tower = templateSpeaker(SPEAKER_TEMPLATE.paTowerTopHorn);
  const rows = speakerPurchasedParts(tower.cabinet);
  const drivers = tower.cabinet.chambers.flatMap((c) => c.drivers);
  const driverCount = rows
    .filter((r) => r.kind === PURCHASED_PART.driver)
    .reduce((n, r) => n + r.count, 0);
  assert.equal(
    driverCount,
    drivers.reduce((n, d) => n + d.count, 0),
  );
  assert.ok(rows.some((r) => r.kind === PURCHASED_PART.horn));
  assert.ok(rows.some((r) => r.kind === PURCHASED_PART.hardware));
  for (const r of rows) assert.ok(r.count > 0, r.model);
});
