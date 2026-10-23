import { test } from "vite-plus/test";
import assert from "node:assert";
import { UNIT_SYSTEM } from "../src/constants/units";
import {
  PANEL_NOMINALS,
  formatThickness,
  panelIn,
  panelNominalNear,
  panelThicknessName,
  panelExactRange,
  savedPanelExactIn,
} from "../src/lib/build/panel";
import { PANEL_STOCK } from "../src/data/catalog/plywood";
import { DEFAULT_PA } from "../src/lib/defaults";
test("panel sizes: thickest first, each starting at its nominal size in both materials", () => {
  assert.deepEqual(PANEL_NOMINALS, ["3/4", "5/8", "1/2"]);
  for (const n of PANEL_NOMINALS) {
    assert.equal(panelIn(n, "ply"), PANEL_STOCK[n].in, n);
    assert.equal(panelIn(n, "mdf"), PANEL_STOCK[n].in, n);
  }
  assert.equal(DEFAULT_PA.wall, panelIn(DEFAULT_PA.panel, "ply"));
});

test("panel thickness: the measured one wins, for that size only", () => {
  const exact = { "3/4": 0.689 };
  assert.equal(panelIn("3/4", "ply", exact), 0.689);
  assert.equal(panelIn("1/2", "ply", exact), 0.5);
});

test("stored measurements: only known sizes in range are kept", () => {
  assert.deepEqual(savedPanelExactIn(undefined), {});
  assert.deepEqual(savedPanelExactIn("x"), {});
  assert.deepEqual(savedPanelExactIn({ "3/4": 0.689, "1/2": 2, "1/4": 0.25, "5/8": "0.6" }), {
    "3/4": 0.689,
  });
});

test("names: the nominal size, with the measured thickness beside it when it differs", () => {
  assert.equal(formatThickness(0.75, UNIT_SYSTEM.us), "¾″");
  assert.equal(formatThickness(0.689, UNIT_SYSTEM.us), "0.689″");
  assert.equal(formatThickness(0.75, UNIT_SYSTEM.metric), "19.05 mm");
  assert.equal(panelThicknessName("3/4", 0.75, UNIT_SYSTEM.us), "¾″ / 18 mm");
  assert.equal(panelThicknessName("3/4", 0.689, UNIT_SYSTEM.us), "¾″ / 18 mm at 0.689″");
  assert.equal(panelThicknessName("3/4", 0.689, UNIT_SYSTEM.metric), "¾″ / 18 mm at 17.5 mm");
});

test("a thickness reads as the nominal size nearest it (the bracing's default style)", () => {
  for (const n of PANEL_NOMINALS) assert.equal(panelNominalNear(PANEL_STOCK[n].in), n);
  assert.equal(panelNominalNear(0.689), "3/4");
  assert.equal(panelNominalNear(19 / 32), "5/8");
  assert.equal(panelNominalNear(15 / 32), "1/2");
});

test("measured ranges: each size stays off the others' nominal sizes", () => {
  for (const n of PANEL_NOMINALS) {
    const { min, max } = panelExactRange(n);
    for (const o of PANEL_NOMINALS)
      if (o !== n) assert.ok(PANEL_STOCK[o].in < min || PANEL_STOCK[o].in > max, `${n} vs ${o}`);
  }
  // the usual undersized sheets fit their size
  assert.deepEqual(savedPanelExactIn({ "3/4": 0.689, "5/8": 19 / 32, "1/2": 15 / 32 }), {
    "3/4": 0.689,
    "5/8": 19 / 32,
    "1/2": 15 / 32,
  });
});
