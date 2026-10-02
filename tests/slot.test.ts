import { test } from "vite-plus/test";
import assert from "node:assert";
import {
  rectangleEndCorrectionIntegral,
  rectangleEndCorrection,
  slotEndCorrection,
  sideDuctEndCorrection,
  ductEndCorrection,
  ductEndCorrection2D,
  BOTH_ENDS_CORRECTION_RATIO,
  ventGeometry,
  boxModel,
  subSystem,
} from "../src/lib/pa/calc.ts";
import { SUB_OPTIONS, MID_OPTIONS } from "../src/lib/data.ts";
import { C, rel, close } from "./helpers.ts";

// Independent check of the closed form: integrate the potential of the rectangle numerically.
// phi(x, y) = integral of 1/distance over the rectangle, from its four corner sub-rectangles.
const F = (p, q) =>
  p <= 0 || q <= 0
    ? 0
    : p * Math.log((q + Math.hypot(p, q)) / p) + q * Math.log((p + Math.hypot(p, q)) / q);
const phi = (x, y, a, b) => F(x, y) + F(a - x, y) + F(x, b - y) + F(a - x, b - y);
function Inum(a, b, n = 300) {
  let s = 0;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) s += phi(((i + 0.5) * a) / n, ((j + 0.5) * b) / n, a, b);
  return (s * a * b) / (n * n);
}
test("rectI closed form matches numerical integration (square to 1:8)", (t) => {
  for (const [a, b] of [
    [1, 1],
    [1, 4],
    [6, 25],
    [3, 25],
  ])
    rel(t, rectangleEndCorrectionIntegral(a, b), Inum(a, b), 1e-4, `${a}x${b}`);
});
test("unit square: mean inverse distance 2.9732 (known constant)", (t) =>
  close(t, rectangleEndCorrectionIntegral(1, 1), 2.9732, 1e-4));
test("square aperture end correction ~ circle of equal area (0.8488 r)", (t) => {
  const r = Math.sqrt(1 / Math.PI);
  rel(t, rectangleEndCorrection(1, 1), 0.8488 * r, 0.02);
});
test("BOTH_ENDS reproduces 1.46 r for a round tube", (t) =>
  close(t, BOTH_ENDS_CORRECTION_RATIO * 0.8488, 1.46, 0.005));
test("long thin slot: end correction grows only as log of the width", (t) => {
  // doubling the width of a 1-wide strip adds ~ (1/pi) ln 2 per unit height, not sqrt(2) x
  const d = rectangleEndCorrection(1, 400) - rectangleEndCorrection(1, 200);
  close(t, d, Math.log(2) / Math.PI, 0.01);
});
test("slotEndCorr uses the floor image: a slot twice as tall", (t) => {
  close(
    t,
    slotEndCorrection(3, 25),
    BOTH_ENDS_CORRECTION_RATIO * rectangleEndCorrection(6, 25),
    1e-12,
  );
  assert.ok(slotEndCorrection(3, 25) > BOTH_ENDS_CORRECTION_RATIO * rectangleEndCorrection(3, 25));
});
test("letterbox Fb = Helmholtz with the slot end correction", (t) => {
  const box = { w: 22, h: 30, d: 20 },
    g = ventGeometry("slots", box, { slotH: 3, len: 14 }, 0.75);
  const W = box.w - 1.5 - 1.5;
  close(t, g.ec, slotEndCorrection(3, W, 30 - 1.5, 20 - 0.75 - 0.75 - 14), 1e-12);
  const ts = SUB_OPTIONS.find((o) => o.id === "f18fh500").ts;
  const m = boxModel(ts, 120, g.area, g.len, 25, 20, "BW24", { ecIn: g.ec });
  const Sp = g.area * 0.00064516,
    Leff = (14 + g.ec) * 0.0254;
  rel(t, m.Fb, (C / (2 * Math.PI)) * Math.sqrt(Sp / (0.12 * Leff)), 1e-9);
});
test("round tubes keep 1.46 r per opening", (t) => {
  assert.equal(
    ventGeometry("round2", { w: 22, h: 30, d: 20 }, { nt: 2, dia: 4, len: 12 }, 0.75).ec,
    undefined,
  );
});
test("side duct: side wall mirrors the inner end only", (t) => {
  const f = 0.61 / 0.85;
  close(
    t,
    sideDuctEndCorrection(2, 27.5),
    rectangleEndCorrection(2, 27.5) + f * rectangleEndCorrection(4, 27.5),
    1e-12,
  );
  // between no mirrors and both mirrored
  assert.ok(
    sideDuctEndCorrection(2, 27.5) > BOTH_ENDS_CORRECTION_RATIO * rectangleEndCorrection(2, 27.5) &&
      sideDuctEndCorrection(2, 27.5) < ductEndCorrection(2, 27.5),
  );
  close(t, slotEndCorrection(3, 25), ductEndCorrection(3, 25), 1e-12);
});
test("side ducts: each opening gets the correction for its own throat x open height", (t) => {
  const box = { w: 22, h: 30, d: 20 };
  for (const st of ["vslots", "vslot1"]) {
    const g = ventGeometry(st, box, { throat: 2, len: 12 }, 0.75);
    close(
      t,
      g.ec,
      sideDuctEndCorrection(
        2,
        30 - 1.5 - 1,
        st === "vslots" ? (22 - 1.5) / 2 : 22 - 1.5,
        20 - 0.75 - 0.75 - 12,
      ),
      1e-12,
      st,
    );
  }
  // per-opening: two ducts tune like one duct in the mirrored half of the box
  const ts = SUB_OPTIONS.find((o) => o.id === "f18fh500").ts;
  // the mirror image of one half: half the inner width, half the volume
  const half = { ...box, w: (box.w - 1.5) / 2 + 1.5 };
  const two = ventGeometry("vslots", box, { throat: 2, len: 12 }, 0.75),
    one = ventGeometry("vslot1", half, { throat: 2, len: 12 }, 0.75);
  const a = boxModel(ts, 120, two.area, 12, 25, 20, "BW24", { nPorts: 2, ecIn: two.ec });
  const b = boxModel(ts, 60, one.area, 12, 25, 20, "BW24", { nPorts: 1, ecIn: one.ec });
  rel(t, a.Fb, b.Fb, 1e-9);
});
test("subSystem passes the slot end correction to the model", (t) => {
  const sub = SUB_OPTIONS.find((o) => o.id === "f18fh500"),
    mid = MID_OPTIONS[0];
  const cfg = {
    subBox: { w: 22, h: 30, d: 22 },
    midDims: { w: 15, h: 15, d: 15 },
    wall: 0.75,
    inset: 0.75,
    portStyle: "slots",
    cVent: { slotH: 3, len: 14 },
    hpf: 30,
    hpType: "BW24",
    ampW: 800,
    portMax: 20,
    layout: "stack",
  };
  const s = subSystem(sub, mid, cfg);
  const Sp = s.port.area * 0.00064516,
    Leff = (s.port.len + s.port.ec) * 0.0254;
  rel(t, s.mdl.Fb, (C / (2 * Math.PI)) * Math.sqrt(Sp / ((s.netL / 1000) * Leff)), 1e-9);
});

// ---- inner end: the box interior as a duct ----
const FE = 0.61 / 0.85;
test("duct2D: a mouth filling the whole duct has no end correction", (t) =>
  close(t, ductEndCorrection2D(5, 5), 0, 1e-12));
test("duct2D: grows with the box like a free strip with the floor mirrored (slope 2h/pi per e-fold)", (t) => {
  // independent: the closed-form rectangle integral for a long strip of height 2h
  const dDuct = ductEndCorrection2D(1, 400) - ductEndCorrection2D(1, 200),
    dStrip = rectangleEndCorrection(2, 400) - rectangleEndCorrection(2, 200);
  close(t, dDuct, dStrip, 0.002);
  close(t, dDuct, (2 / Math.PI) * Math.log(2), 0.002);
});
test("duct2D: a back wall adds mass; far away it has no effect; closer than h is clamped to h", (t) => {
  const free = ductEndCorrection2D(3, 30);
  assert.ok(ductEndCorrection2D(3, 30, 6) > free);
  close(t, ductEndCorrection2D(3, 30, 500), free, 1e-9);
  close(t, ductEndCorrection2D(3, 30, 1), ductEndCorrection2D(3, 30, 3), 1e-12);
});
test("duct2D: two ducts on opposite walls = one duct in half the width (symmetry, computed directly)", (t) => {
  // direct modal sum for the pair: odd modes cancel, even modes double
  const h = 2,
    X = 26,
    pair = (() => {
      let s = 0;
      for (let m = 1; m <= 4000; m++) {
        const c = Math.sin((m * Math.PI * h) / X) * (1 + (-1) ** m);
        s += (c * c) / m ** 3;
      }
      return ((X * X) / (Math.PI ** 3 * h)) * s;
    })();
  close(t, ductEndCorrection2D(h, X / 2), pair, 1e-3);
});
test("slot: ground-mirrored outer end + free inner end in the box", (t) => {
  close(
    t,
    slotEndCorrection(3, 25, 30.5, 8),
    rectangleEndCorrection(6, 25) + FE * ductEndCorrection2D(3, 30.5, 8),
    1e-12,
  );
});
test("side duct: outer end mirrored by the ground along its height", (t) => {
  close(
    t,
    sideDuctEndCorrection(2, 29, 13, 8),
    rectangleEndCorrection(2, 58) + FE * ductEndCorrection2D(2, 13, 8),
    1e-12,
  );
});
test("folded letterbox: no back-wall term (mouth faces the lid)", (t) => {
  const g = ventGeometry("folded", { w: 22, h: 30, d: 20 }, { slotH: 3, len: 20 }, 0.75);
  close(t, g.ec, slotEndCorrection(3, 22 - 3, 30 - 1.5, Infinity), 1e-12);
});
