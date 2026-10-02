import { test } from "vite-plus/test";
import assert from "node:assert";
import {
  boxModel,
  subwooferLimits,
  maxOutputCurve,
  thermalVoltageLimit,
  ampVoltage,
} from "../src/lib/pa/calc.ts";
import { SUB_OPTIONS } from "../src/lib/data.ts";
import { close, near } from "./helpers.ts";

const fh = SUB_OPTIONS.find((o) => o.id === "f18fh500")!.ts;
test("thermal limit: 2 x AES into 8 ohm; amp voltage: W into 8 ohm", (t) => {
  close(t, thermalVoltageLimit(600), Math.sqrt(9600), 1e-9);
  close(t, ampVoltage(500), Math.sqrt(4000), 1e-9);
});
test("subLimits picks the smallest voltage and names it", (t) => {
  const V = ampVoltage(800),
    m = boxModel(fh, 148, 57, 14, 31, V, "BW24")!;
  const L = subwooferLimits(m, fh, V, 23.5);
  const cands = {
    port: (V * 23.5) / m.peakVel,
    xmax: (V * 100) / m.xmaxPct,
    thermal: thermalVoltageLimit(fh.aes),
    amp: V,
  };
  close(t, L.V, Math.min(...Object.values(cands)), 1e-9);
  close(t, L.W, L.V ** 2 / 8, 1e-9);
});
test("subLimits: amp-limited when the amp is tiny", (t) => {
  const V = ampVoltage(20),
    m = boxModel(fh, 148, 57, 14, 31, V, "BW24")!;
  assert.equal(subwooferLimits(m, fh, V, 23.5).who, "amplifier power");
});
test("limits search the whole curve, including below 20 Hz", (t) => {
  const m = boxModel(fh, 148, 57, 14, 15, ampVoltage(500), "BW24")!; // low highpass: excursion rises below 20 Hz
  const peak = Math.max(...m.curve.map((o) => o.xmm));
  close(t, m.peakX, peak, 1e-12);
});
test("maxCurve never exceeds the amp-limited curve and stays below Xmax", (t) => {
  const V = ampVoltage(800),
    m = boxModel(fh, 148, 57, 14, 31, V, "BW24")!,
    mc = maxOutputCurve(m.curve, fh, V, 23.5);
  mc.forEach((o, i) => assert.ok(o.spl <= m.curve[i].spl + 1e-9));
  for (const f of [30, 45, 60]) {
    const o = near(m.curve, f),
      c = near(mc, f),
      s = 10 ** ((c.spl - o.spl) / 20);
    assert.ok(o.xmm * s <= fh.Xmax * (1 + 1e-9) && o.vel * s <= 23.5 * (1 + 1e-9), `${f} Hz`);
  }
});
