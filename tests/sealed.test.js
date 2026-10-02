import { test } from "vite-plus/test";
import assert from "node:assert";
import { closedBox } from "../src/lib/pa/calc.js";
import { MID_OPTIONS } from "../src/lib/data.ts";
import { tsModel, massLineSPL, f3SecondOrder, near, close, rel, db } from "./helpers.js";

const drv = (id) => MID_OPTIONS.find((o) => o.id === id).ts;
const cases = [
  ["bc12ndl76", 45],
  ["bc12ndl76", 15],
  ["f12pr300", 20],
  ["bc12fw76", 45],
  ["bc15ndl76", 60],
];

for (const [id, Vb] of cases) {
  test(`closedBox ${id} in ${Vb} L: Fc and Qtc follow Small's closed-box equations`, (t) => {
    const ts = drv(id),
      m = tsModel(ts),
      alpha = m.VasL / Vb;
    const r = closedBox(ts, Vb, null, null, 2.83);
    rel(t, r.Fc, ts.Fs * Math.sqrt(1 + alpha), 1e-6, "Fc");
    rel(t, r.Qtc, m.Qts * Math.sqrt(1 + alpha), 1e-6, "Qtc");
  });
  test(`closedBox ${id} in ${Vb} L: midband level is the mass-controlled line`, (t) => {
    const ts = drv(id),
      r = closedBox(ts, Vb, null, null, 2.83);
    close(t, r.ref, massLineSPL(ts, 2.83), 0.05, "ref");
    // the curve itself: well above Fc it sits on that line
    close(t, near(r.curve, 2000).raw, massLineSPL(ts, 2.83), 0.1, "2 kHz");
  });
  test(`closedBox ${id} in ${Vb} L: F3 matches the 2nd-order highpass`, (t) => {
    const r = closedBox(ts0(id), Vb, null, null, 2.83);
    rel(t, r.f3, f3SecondOrder(r.Fc, r.Qtc), 0.02, "f3");
  });
}
const ts0 = drv;

test("closedBox: excursion follows the 2nd-order system from the stiffness limit (sine peak)", (t) => {
  const ts = drv("bc12ndl76"),
    m = tsModel(ts),
    Vb = 30;
  const r = closedBox(ts, Vb, null, null, 2.83);
  const kTot = 1 / m.Cms + (1.18 * 343 * 343 * m.Sd * m.Sd) / (Vb / 1000); // N/m
  const x0 = ((Math.SQRT2 * ((2.83 * ts.Bl) / ts.Re)) / kTot) * 1000; // mm, static limit
  const u = 20 / r.Fc,
    x = x0 / Math.hypot(1 - u * u, u / r.Qtc); // 2nd-order system incl. damping
  rel(t, near(r.curve, 20).xmm, x, 0.01, "20 Hz excursion");
});
test("closedBox: LR24 filters shape the output, not the raw curve", (t) => {
  const r = closedBox(drv("bc12ndl76"), 30, 120, 900, 2.83);
  const o = near(r.curve, 120),
    h = near(r.curve, 900);
  close(t, o.spl - o.raw, db(0.5), 0.3, "at hp");
  close(t, h.spl - h.raw, db(0.5), 0.3, "at lp");
});
