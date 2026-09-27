import test from "node:test";
import { rectI, rectEndCorr, slotEndCorr, BOTH_ENDS, ventGeom, boxModel, subSystem } from "../tools/calc.js";
import { SUB_OPTIONS, MID_OPTIONS } from "../tools/data.js";
import { C, rel, close } from "./helpers.js";

// Independent check of the closed form: integrate the potential of the rectangle numerically.
// phi(x, y) = integral of 1/distance over the rectangle, from its four corner sub-rectangles.
const F = (p, q) => (p <= 0 || q <= 0 ? 0 : p * Math.log((q + Math.hypot(p, q)) / p) + q * Math.log((p + Math.hypot(p, q)) / q));
const phi = (x, y, a, b) => F(x, y) + F(a - x, y) + F(x, b - y) + F(a - x, b - y);
function Inum(a, b, n = 300) {
  let s = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) s += phi(((i + 0.5) * a) / n, ((j + 0.5) * b) / n, a, b);
  return (s * a * b) / (n * n);
}
test("rectI closed form matches numerical integration (square to 1:8)", (t) => {
  for (const [a, b] of [[1, 1], [1, 4], [6, 25], [3, 25]]) rel(t, rectI(a, b), Inum(a, b), 1e-4, `${a}x${b}`);
});
test("unit square: mean inverse distance 2.9732 (known constant)", (t) => close(t, rectI(1, 1), 2.9732, 1e-4));
test("square aperture end correction ~ circle of equal area (0.8488 r)", (t) => {
  const r = Math.sqrt(1 / Math.PI);
  rel(t, rectEndCorr(1, 1), 0.8488 * r, 0.02);
});
test("BOTH_ENDS reproduces 1.46 r for a round tube", (t) => close(t, BOTH_ENDS * 0.8488, 1.46, 0.005));
test("long thin slot: end correction grows only as log of the width", (t) => {
  // doubling the width of a 1-wide strip adds ~ (1/pi) ln 2 per unit height, not sqrt(2) x
  const d = rectEndCorr(1, 400) - rectEndCorr(1, 200);
  close(t, d, Math.log(2) / Math.PI, 0.01);
});
test("slotEndCorr uses the floor image: a slot twice as tall", (t) => {
  close(t, slotEndCorr(3, 25), BOTH_ENDS * rectEndCorr(6, 25), 1e-12);
  t.assert.ok(slotEndCorr(3, 25) > BOTH_ENDS * rectEndCorr(3, 25));
});
test("letterbox Fb = Helmholtz with the slot end correction", (t) => {
  const box = { w: 22, h: 30, d: 20 }, g = ventGeom("slots", box, { slotH: 3, len: 14 }, 0.75);
  const W = box.w - 1.5 - 1.5;
  close(t, g.ec, slotEndCorr(3, W), 1e-12);
  const ts = SUB_OPTIONS.find((o) => o.id === "f18fh500").ts;
  const m = boxModel(ts, 120, g.area, g.len, 25, 20, "BW24", { ecIn: g.ec });
  const Sp = g.area * 0.00064516, Leff = (14 + g.ec) * 0.0254;
  rel(t, m.Fb, (C / (2 * Math.PI)) * Math.sqrt(Sp / (0.12 * Leff)), 1e-9);
});
test("round tubes and side ducts keep 1.46 r per opening", (t) => {
  t.assert.equal(ventGeom("round2", { w: 22, h: 30, d: 20 }, { nt: 2, dia: 4, len: 12 }, 0.75).ec, undefined);
  t.assert.equal(ventGeom("vslots", { w: 22, h: 30, d: 20 }, { throat: 2, len: 12 }, 0.75).ec, undefined);
});
test("subSystem passes the slot end correction to the model", (t) => {
  const sub = SUB_OPTIONS.find((o) => o.id === "f18fh500"), mid = MID_OPTIONS[0];
  const cfg = { subBox: { w: 22, h: 30, d: 22 }, midDims: { w: 15, h: 15, d: 15 }, wall: 0.75, inset: 0.75, portStyle: "slots",
    cVent: { slotH: 3, len: 14 }, hpf: 30, hpType: "BW24", ampW: 800, portMax: 20, layout: "stack" };
  const s = subSystem(sub, mid, cfg);
  const Sp = s.port.area * 0.00064516, Leff = (s.port.len + s.port.ec) * 0.0254;
  rel(t, s.mdl.Fb, (C / (2 * Math.PI)) * Math.sqrt(Sp / ((s.netL / 1000) * Leff)), 1e-9);
});
