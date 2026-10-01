import { test } from "vite-plus/test";
import assert from "node:assert";
import {
  boxL,
  ventGeom,
  internalWoodL,
  cutParts,
  subWeight,
  midWeight,
  plyLb,
} from "../tools/calc.js";
import { SUB_OPTIONS, MID_OPTIONS } from "../tools/data.js";
import { close } from "./helpers.js";

const IN3_L = 16.387 / 1000;
test("boxL: inner width/height lose two walls, depth loses inset + 3/4 baffle + back", (t) => {
  close(t, boxL(20, 24, 16, 0.75, 0.75), 18.5 * 22.5 * 13.75 * IN3_L, 1e-9);
  close(t, boxL(20, 24, 16, 0.5, 0), 19 * 23 * 14.75 * IN3_L, 1e-9);
  close(t, boxL(20, 24, 16, 0.5, 1.5), 19 * 23 * 13.25 * IN3_L, 1e-9);
});
test("ventGeom: letterbox area = slot height x inner width less two fins", (t) => {
  const g = ventGeom("slots", { w: 22, h: 30, d: 20 }, { slotH: 3, len: 14 }, 0.75);
  close(t, g.area, 3 * (22 - 1.5 - 1.5), 1e-9);
  assert.equal(g.n, 1);
});
test("ventGeom: side ducts = throat x inner height less dividers, one opening each", (t) => {
  const g2 = ventGeom("vslots", { w: 22, h: 30, d: 20 }, { throat: 2, len: 16 }, 0.75);
  close(t, g2.area, 2 * 2 * (28.5 - 1), 1e-9);
  assert.equal(g2.n, 2);
  assert.equal(ventGeom("vslot1", { w: 22, h: 30, d: 20 }, { throat: 2, len: 16 }, 0.75).n, 1);
});
test("ventGeom: round tubes = n circles, n openings", (t) => {
  const g = ventGeom("round2", { w: 20, h: 24, d: 16 }, { nt: 2, dia: 3.5, len: 14 }, 0.75);
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
    cVent: { slotH: 3, len: 14 },
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
  close(t, internalWoodL(parts, "Sub"), (cleats + braces + duct) * IN3_L, 1e-9);
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
      cVent: { nt: 2, dia: 4, len: 12 },
      layout: "stack",
    }).parts.filter((p) => p.box === "Sub");
    const lb = parts.reduce((a, p) => a + ((p.a * p.b * p.qty) / 144) * plyLb(p.t), 0) + 6;
    const w = subWeight(box, wall, 0);
    assert.ok(
      w >= lb * 0.98 && w <= lb * 1.12,
      `wall ${wall}: formula ${w.toFixed(1)} vs parts ${lb.toFixed(1)}`,
    );
  }
});
test("plyLb: known thicknesses and a safe fallback", (t) => {
  assert.equal(plyLb(0.75), 2.3);
  assert.equal(plyLb(0.5), 1.6);
  assert.equal(plyLb(0.625), 2.3);
});
test("midWeight: 15 in cube in 3/4 birch", (t) => {
  close(
    t,
    midWeight({ w: 15, h: 15, d: 15 }, 0.75),
    (225 * 2.3 + (225 + 450 + 450 + 225) * 2.3) / 144 + 2,
    1e-9,
  );
});
