import { test } from "vite-plus/test";
import assert from "node:assert";
import {
  PANEL_NOMINALS,
  formatThickness,
  isThinPanel,
  panelChoicesIn,
  panelFor,
  panelIn,
  panelLbPerSqFt,
  panelThicknessName,
  savedPanelExactIn,
} from "../src/lib/panel";
import { PANEL_STOCK } from "../src/data/catalog/plywood";
import { DEFAULT_HIFI, DEFAULT_PA } from "../src/lib/defaults";
import { boxInternalLiters, subWeightLb } from "../src/lib/pa/calc";
import { deriveHifiDesign } from "../src/pages/hifi/hifiDesign";

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
  assert.deepEqual(panelChoicesIn("ply", exact), [0.689, 0.625, 0.5]);
  // two sizes measured alike are tried once
  assert.deepEqual(panelChoicesIn("ply", { "5/8": 0.75 }), [0.75, 0.5]);
});

test("old saves: 0.75 and 0.5 load as the matching size at its nominal thickness", () => {
  assert.equal(panelFor({ wall: 0.75 }, "ply"), "3/4");
  assert.equal(panelFor({ wall: 0.5 }, "ply"), "1/2");
  assert.equal(panelFor({ wall: 0.3 }, "ply"), undefined);
  assert.equal(panelFor({}, "ply"), undefined);
  // a card's wall at a measured thickness finds its size; a named size stays while its thickness matches
  assert.equal(panelFor({ wall: 0.689 }, "ply", { "3/4": 0.689 }), "3/4");
  assert.equal(panelFor({ wall: 0.75, panel: "5/8" }, "ply", { "5/8": 0.75 }), "5/8");
  assert.equal(panelFor({ wall: 0.5, panel: "3/4" }, "ply"), "1/2");
});

test("stored measurements: only known sizes in range are kept", () => {
  assert.deepEqual(savedPanelExactIn(undefined), {});
  assert.deepEqual(savedPanelExactIn("x"), {});
  assert.deepEqual(savedPanelExactIn({ "3/4": 0.689, "1/2": 2, "1/4": 0.25, "5/8": "0.6" }), {
    "3/4": 0.689,
  });
});

test("names: the nominal size, with the measured thickness beside it when it differs", () => {
  assert.equal(formatThickness(0.75), "¾″");
  assert.equal(formatThickness(0.689), "0.689″");
  assert.equal(panelThicknessName("3/4", 0.75), "¾″ / 18 mm");
  assert.equal(panelThicknessName("3/4", 0.689), "¾″ / 18 mm at 0.689″");
});

test("thin walls: ½″-class stock, measured or not, takes the extra brace; ⅝″ doesn't", () => {
  assert.ok(isThinPanel(0.5));
  assert.ok(isThinPanel(15 / 32));
  assert.ok(!isThinPanel(0.625));
  assert.ok(!isThinPanel(19 / 32));
  assert.ok(!isThinPanel(0.689));
});

test("the measured thickness reaches the volume and the weight", () => {
  const box = { w: 24, h: 32, d: 18 };
  assert.ok(
    boxInternalLiters(box.w, box.h, box.d, 0.689) > boxInternalLiters(box.w, box.h, box.d, 0.75),
  );
  assert.ok(subWeightLb(box, 0.689, 0) < subWeightLb(box, 0.75, 0));
  assert.ok(panelLbPerSqFt(0.689, "mdf") > panelLbPerSqFt(0.689, "ply"));
  const nominal = deriveHifiDesign(DEFAULT_HIFI),
    measured = deriveHifiDesign({ ...DEFAULT_HIFI, panelExactIn: { "3/4": 0.689 } });
  assert.equal(measured.wallThicknessIn, 0.689);
  assert.equal(measured.speakerConfig.wall, 0.689);
  assert.ok(nominal.speakerModel && measured.speakerModel);
  assert.ok(measured.speakerModel.speakerSystem.gross > nominal.speakerModel.speakerSystem.gross);
});
