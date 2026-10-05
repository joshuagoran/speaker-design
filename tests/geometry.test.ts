import { test } from "vite-plus/test";
import assert from "node:assert";
import {
  boxInternalLiters,
  ventGeometry,
  internalWoodLiters,
  cutParts,
  subWeightLb,
  midWeightLb,
  plywoodLbPerSqFt,
  maxFoldedRearWallIn,
  maxFoldedSlotIn,
  foldedRearWallIn,
  foldedLidGapIn,
} from "../src/lib/pa/calc";
import { ductFit } from "../src/lib/pa/chips";
import { SUB_OPTIONS, MID_OPTIONS } from "../src/lib/data";
import { close, vent } from "./helpers";
import { subWoodIn3 } from "../src/lib/pa/exactSub";
import type { CutPartId } from "../src/types";

const IN3_L = 16.387 / 1000;
test("boxL: inner width/height lose two walls, depth loses inset + 3/4 baffle + back", (t) => {
  close(t, boxInternalLiters(20, 24, 16, 0.75, 0.75), 18.5 * 22.5 * 13.75 * IN3_L, 1e-9);
  close(t, boxInternalLiters(20, 24, 16, 0.5, 0), 19 * 23 * 14.75 * IN3_L, 1e-9);
  close(t, boxInternalLiters(20, 24, 16, 0.5, 1.5), 19 * 23 * 13.25 * IN3_L, 1e-9);
});
test("ventGeom: letterbox area = slot height x inner width less two fins", (t) => {
  const g = ventGeometry("slots", { w: 22, h: 30, d: 20 }, vent({ slotH: 3, len: 14 }), 0.75);
  close(t, g.area, 3 * (22 - 1.5 - 1.5), 1e-9);
  assert.equal(g.n, 1);
});
test("ventGeom: side ducts = throat x inner height less dividers, one opening each", (t) => {
  const g2 = ventGeometry("vslots", { w: 22, h: 30, d: 20 }, vent({ throat: 2, len: 16 }), 0.75);
  close(t, g2.area, 2 * 2 * (28.5 - 1), 1e-9);
  assert.equal(g2.n, 2);
  assert.equal(
    ventGeometry("vslot1", { w: 22, h: 30, d: 20 }, vent({ throat: 2, len: 16 }), 0.75).n,
    1,
  );
});
test("ventGeom: round tubes = n circles, n openings", (t) => {
  const g = ventGeometry(
    "round2",
    { w: 20, h: 24, d: 16 },
    vent({ nt: 2, dia: 3.5, len: 14 }),
    0.75,
  );
  close(t, g.area, 2 * Math.PI * 1.75 ** 2, 1e-9);
  assert.equal(g.n, 2);
});
test("internalWoodL: duct shelf + fins + brace rails + cleats, by hand", (t) => {
  const sub = SUB_OPTIONS[0],
    mid = MID_OPTIONS[0];
  const box = { w: 22, h: 30, d: 20 },
    t0 = 0.75;
  const parts = cutParts({
    sub,
    mid,
    subBox: box,
    midDims: { w: 15, h: 15, d: 15 },
    wall: t0,
    inset: 0.75,
    joint: "butt",
    portStyle: "slots",
    cVent: vent({ slotH: 3, len: 14 }),
    layout: "stack",
  }).parts;
  const iw = 20.5,
    ih = 28.5,
    band = 3.75,
    inD = 20 - 0.75 - 0.75 - 0.75,
    len = Math.min(14, 20 - 0.75 - 3);
  const cleats = 0.75 * 0.75 * (2 * iw + 2 * (ih - band - 1.5));
  const braces = 2 * (2 * 2 * (iw + inD) - 16) * t0;
  const duct = iw * len * t0 + 2 * 3 * len * t0;
  close(t, internalWoodLiters(parts, "sub"), (cleats + braces + duct) * IN3_L, 1e-9);
});
test("folded slot: the rear wall makes the centreline the set length, and the fast wood volume matches the cutlist", (t) => {
  const box = { w: 22, h: 30, d: 20 },
    t0 = 0.75,
    cVent = vent({ slotH: 3, len: 26 });
  const parts = cutParts({
    sub: SUB_OPTIONS[0],
    mid: MID_OPTIONS[0],
    subBox: box,
    midDims: { w: 15, h: 15, d: 15 },
    wall: t0,
    inset: 0.75,
    joint: "butt",
    portStyle: "slots",
    cVent,
    layout: "stack",
  }).parts;
  const part = (id: CutPartId) => parts.find((p) => p.box === "sub" && p.part === id);
  // floor shelf from the baffle front to the rear channel's wall, as a straight slot's shelf runs: the longest straight
  // run less the wall, 20 - 0.75 - 3 - 0.75 = 15.5
  close(t, part("ductShelf")?.b ?? NaN, 15.5, 1e-12);
  // centreline: the floor run to the channel's middle (20 - 0.75 - 1.5 = 17.75), then 1.5 up to the roof and the wall
  // above it, so the wall is 26 - 17.75 - 1.5 = 6.75
  close(t, part("ductRearWall")?.b ?? NaN, 6.75, 1e-12);
  close(
    t,
    subWoodIn3("slots", box, t0, 0.75, cVent) * IN3_L,
    internalWoodLiters(parts, "sub"),
    1e-12,
  );
});
test("folded slot: the longest fold leaves a slot height under the lid, in the fit, the model and the cutlist", (t) => {
  const box = { w: 22, h: 30, d: 20 },
    t0 = 0.75,
    slotH = 3;
  // the wall rises at most h - 2t - 2 slotH = 22.5 over the floor leg's roof (at t + slotH), so the mouth sits at
  // 0.75 + 3 + 22.5 = 26.25, a slot height under the lid's inside face (30 - 0.75)
  close(t, maxFoldedRearWallIn(box, slotH, t0), 22.5, 1e-12);
  const longest = maxFoldedSlotIn(box, slotH, t0);
  close(t, longest, 20 - 0.75 + 22.5, 1e-12);
  close(t, ductFit(box, "slots", vent({ slotH, len: 0 }), t0).maxFold, longest, 1e-12);
  for (const len of [longest, longest + 5]) {
    const v = vent({ slotH, len });
    close(t, foldedRearWallIn(box, v, t0), 22.5, 1e-12);
    close(t, foldedLidGapIn(box, v, t0), slotH, 1e-12);
    const parts = cutParts({
      sub: SUB_OPTIONS[0],
      mid: MID_OPTIONS[0],
      subBox: box,
      midDims: { w: 15, h: 15, d: 15 },
      wall: t0,
      inset: 0.75,
      joint: "butt",
      portStyle: "slots",
      cVent: v,
      layout: "stack",
    }).parts;
    close(t, parts.find((p) => p.part === "ductRearWall")?.b ?? NaN, 22.5, 1e-12);
  }
});
test("weights: shell from panel areas at the ply density matches the cutlist parts", (t) => {
  // independent: sum the cutlist panels (butt joints), + driver + hardware; formula counts full outer
  // faces and full-size braces, so it should read a little high, never low, and within ~12 %
  for (const wall of [0.75, 0.5]) {
    const box = { w: 22, h: 30, d: 20 };
    const parts = cutParts({
      sub: SUB_OPTIONS[0],
      mid: MID_OPTIONS[0],
      subBox: box,
      midDims: { w: 15, h: 15, d: 15 },
      wall,
      inset: 0.75,
      joint: "butt",
      portStyle: "round2",
      cVent: vent({ nt: 2, dia: 4, len: 12 }),
      layout: "stack",
    }).parts.filter((p) => p.box === "sub");
    const lb =
      parts.reduce((a, p) => a + ((p.a * p.b * p.qty) / 144) * plywoodLbPerSqFt(p.t), 0) + 6;
    const w = subWeightLb(box, wall, 0);
    assert.ok(
      w >= lb * 0.98 && w <= lb * 1.12,
      `wall ${wall}: formula ${w.toFixed(1)} vs parts ${lb.toFixed(1)}`,
    );
  }
});
test("plyLb: known thicknesses and a safe fallback", (t) => {
  assert.equal(plywoodLbPerSqFt(0.75), 2.3);
  assert.equal(plywoodLbPerSqFt(0.5), 1.6);
  assert.equal(plywoodLbPerSqFt(0.625), 2.3);
});
test("midWeight: 15 in cube in 3/4 birch", (t) => {
  close(
    t,
    midWeightLb({ w: 15, h: 15, d: 15 }, 0.75),
    (225 * 2.3 + (225 + 450 + 450 + 225) * 2.3) / 144 + 2,
    1e-9,
  );
});
