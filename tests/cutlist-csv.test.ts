// The Speaker cutlist's purchased parts (lib/speaker/speakerBuild speakerPurchasedParts) and the cutlist CSV
// (lib/cutlistCsv): length and width in their own columns, the bought parts with a total.
import { assert, test } from "vite-plus/test";
import {
  CSV_SECTIONS,
  CSV_TOTAL,
  PANEL_CSV_COLUMNS,
  cutlistCsv,
  partLengthWidth,
  purchasedTotal,
} from "../src/lib/cutlistCsv";
import { ESTIMATE_VENDOR, vendorOf } from "../src/lib/speaker/driverParts";
import { speakerPurchasedParts } from "../src/lib/speaker/speakerBuild";
import { templateSpeaker } from "../src/pages/speaker/speakerTemplates";
import { SPEAKER_TEMPLATE } from "../src/constants/speakerStarts";
import { PURCHASED_PART } from "../src/constants/purchasedParts";
import type { PurchasedPart } from "../src/types";

test("cutlist CSV: L runs along a locked grain, else it is the long side", () => {
  assert.deepEqual(partLengthWidth({ a: 10, b: 20, grain: "a" }), [10, 20]);
  assert.deepEqual(partLengthWidth({ a: 10, b: 20, grain: "b" }), [20, 10]);
  assert.deepEqual(partLengthWidth({ a: 10, b: 20 }), [20, 10]);
});

test("cutlist CSV: the panels with L and W in their own columns, then the purchased parts and their total", () => {
  const bought: PurchasedPart[] = [
    { kind: PURCHASED_PART.driver, model: 'Maker "X", 12', count: 1, unit: 100, vendor: "A" },
    { kind: PURCHASED_PART.portTube, model: "tube", count: 2, unit: null, vendor: null },
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
  const lines = csv.trimEnd().split("\r\n");
  assert.equal(lines[0], CSV_SECTIONS.panels);
  assert.equal(lines[1], PANEL_CSV_COLUMNS.join(","));
  assert.equal(lines[2], "Shell,K1,Side,4,47.5,18,L along grain,0.709,a; b");
  assert.equal(lines[3], "");
  assert.equal(lines[4], CSV_SECTIONS.purchased);
  // a comma or a quote is quoted; counts and totals for both speakers
  assert.equal(lines[6], 'Driver,"Maker ""X"", 12",2,100.00,200.00,A');
  assert.equal(lines[7], "Port tube,tube,4,,,");
  assert.equal(lines[8], `${CSV_TOTAL},,,,200.00,`);
  assert.deepEqual(purchasedTotal(bought, 2), { dollars: 200, partial: true });
});

test("purchased parts: a vendor's name from the catalog's price source", () => {
  assert.equal(vendorOf("Parts Express 260-705, Oct 2026"), "Parts Express");
  assert.equal(vendorOf("usspeaker.com, Sep 2026"), "usspeaker.com");
  assert.equal(vendorOf("https://www.pvcfittingsonline.com/products/x"), "pvcfittingsonline.com");
  assert.equal(vendorOf("Estimate: same as the 460 mm horn ($80)"), ESTIMATE_VENDOR);
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
