import { test } from "vite-plus/test";
import assert from "node:assert";
import {
  boxModel,
  subwooferLimits,
  maxOutputCurve,
  subBassLevel,
  SUB_BASS_BAND_HZ,
  thermalVoltageLimit,
  ampVoltage,
} from "../src/lib/pa/calc";
import { SUB_OPTIONS } from "../src/lib/data";
import { LIMIT_NAMES, SUB_LIMITED_BY, SUB_LIMIT_NAMES } from "../src/constants/limits";
import { close, near } from "./helpers";

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
  assert.equal(subwooferLimits(m, fh, V, 23.5).who, "amp");
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
test("sub-bass level: the mean of the curve inside its band only", (t) => {
  const [lo, hi] = SUB_BASS_BAND_HZ;
  const curve = [
    { f: lo - 1, spl: 0 },
    { f: lo, spl: 100 },
    { f: (lo + hi) / 2, spl: 110 },
    { f: hi, spl: 120 },
    { f: hi + 1, spl: 0 },
  ];
  close(t, subBassLevel(curve), 110, 1e-12);
});
test("sub-bass level of a max curve lies between its lowest and highest point in the band", () => {
  const V = ampVoltage(800),
    m = boxModel(fh, 148, 57, 14, 31, V, "BW24")!,
    mc = maxOutputCurve(m.curve, fh, V, 23.5);
  const band = mc.filter((o) => o.f >= SUB_BASS_BAND_HZ[0] && o.f <= SUB_BASS_BAND_HZ[1]);
  const level = subBassLevel(mc);
  assert.ok(band.length > 10);
  assert.ok(level >= Math.min(...band.map((o) => o.spl)));
  assert.ok(level <= Math.max(...band.map((o) => o.spl)));
});
test("limit ids show the words the pages have always shown", () => {
  assert.deepEqual(LIMIT_NAMES, {
    port: "port",
    Xmax: "Xmax",
    radiator: "radiator",
    thermal: "thermal",
    amp: "amp",
  });
  assert.deepEqual(SUB_LIMIT_NAMES, {
    port: "port air speed",
    Xmax: "cone travel (Xmax)",
    thermal: "driver program rating",
    amp: "amplifier power",
  });
  assert.deepEqual(SUB_LIMITED_BY, {
    port: "port air speed",
    Xmax: "cone travel",
    thermal: "the driver's program rating",
    amp: "amplifier power",
  });
});
