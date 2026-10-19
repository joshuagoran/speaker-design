import { test } from "vite-plus/test";
import assert from "node:assert";
import {
  boxModel,
  subwooferLimits,
  maxOutputCurve,
  thermalVoltageLimit,
  ampVoltage,
  hornPower,
  nearestPoint,
  sineLimitAt,
} from "../src/lib/pa/calc";
import { CD_OPTIONS, SUB_OPTIONS } from "../src/lib/data";
import { FALLBACK_OHMS, ohmsOf, voltsToWatts } from "../src/lib/power";
import { LIMIT_NAMES } from "../src/constants/limits";
import { close, near } from "./helpers";

/** An 8 Ω load: the amp power's watts into it (lib/power). */
const EIGHT_OHM = { imp: 8 };

const fh = SUB_OPTIONS.find((o) => o.id === "f18fh500")!.ts;
test("thermal limit: 2 x AES into 8 ohm; amp voltage: W into 8 ohm", (t) => {
  close(t, thermalVoltageLimit({ aes: 600 }), Math.sqrt(9600), 1e-9);
  close(t, ampVoltage(500, EIGHT_OHM), Math.sqrt(4000), 1e-9);
});
test("a 4 Ω and an 8 Ω version at the same rating reach the same thermal limit in watts: a sub and a compression driver", (t) => {
  const byId = (id: string) => {
    const d = SUB_OPTIONS.find((o) => o.id === id);
    assert.ok(d, id);
    return d.ts;
  };
  // the Ciare NDH18-4S in both versions: 1000 W AES each
  const four = byId("ciarendh18s4"),
    eight = byId("ciarendh18");
  assert.equal(four.imp, 4);
  assert.equal(eight.imp, 8);
  assert.equal(four.aes, eight.aes);
  for (const ts of [four, eight])
    close(t, voltsToWatts(thermalVoltageLimit(ts), ts), 2 * ts.aes, 1e-9);
  // the volts differ by √2, the watts don't
  close(t, thermalVoltageLimit(eight) / thermalVoltageLimit(four), Math.SQRT2, 1e-12);
  // on a big amp, the sine limit stops each at its program rating
  const big = ampVoltage(20000, EIGHT_OHM);
  for (const ts of [four, eight]) {
    const lim = sineLimitAt({ xmm: 1e-6 }, ts, big, Infinity);
    assert.equal(lim.who, LIMIT_NAMES.thermal);
    close(t, voltsToWatts(lim.V, ts), 2 * ts.aes, 1e-9);
  }
  // a compression driver in 8 Ω and 16 Ω at the same rating: the same watts at its rating on a big amp
  const cd = CD_OPTIONS.find((o) => o.hf?.imp === 8)?.hf;
  assert.ok(cd, "an 8 Ω compression driver");
  const p8 = hornPower(cd, cd.aesXo, 20000),
    p16 = hornPower({ ...cd, imp: 16 }, cd.aesXo, 20000);
  assert.equal(p8.who, LIMIT_NAMES.thermal);
  assert.equal(p16.who, LIMIT_NAMES.thermal);
  close(t, p16.P, p8.P, 1e-9);
  // and the amp power is the watts into the driver, at any impedance (no doubling into a lower one)
  for (const imp of [4, 8, 16]) close(t, hornPower({ ...cd, imp }, cd.aesXo, 10).pAmp, 10, 1e-12);
});

test("a 4 Ω and an 8 Ω version given the same amp power differ only by their sensitivity", (t) => {
  const tsOf = (id: string) => {
    const d = SUB_OPTIONS.find((o) => o.id === id);
    assert.ok(d, id);
    return d.ts;
  };
  /** the driver's level at 80 Hz in one vented box, at an amp power of `watts` into its own impedance */
  const levelAt = (ts: ReturnType<typeof tsOf>, watts: number) => {
    const m = boxModel(ts, 150, 60, 14, 25, ampVoltage(watts, ts), "BW24");
    assert.ok(m);
    return nearestPoint(m.curve, 80).spl;
  };
  // an 8 Ω driver and a 4 Ω copy with the same efficiency (half the Re and Le, Bl / √2): the same level at 1000 W each
  const eight = tsOf("ciarendh18");
  const four = {
    ...eight,
    imp: 4,
    Re: eight.Re / 2,
    Le: (eight.Le ?? 0) / 2,
    Bl: eight.Bl / Math.SQRT2,
  };
  close(t, levelAt(four, 1000), levelAt(eight, 1000), 1e-9);
  // the Ciare NDH18-4S in both versions at 1000 W: apart by their 1 W sensitivity, nothing more
  const c4 = tsOf("ciarendh18s4");
  close(t, levelAt(c4, 1000) - levelAt(eight, 1000), levelAt(c4, 1) - levelAt(eight, 1), 1e-9);
});

test("a part with no impedance entered is taken at 8 Ω", (t) => {
  assert.equal(ohmsOf({}), FALLBACK_OHMS);
  assert.equal(FALLBACK_OHMS, 8);
  close(t, thermalVoltageLimit({ aes: 500 }), Math.sqrt(2 * 500 * 8), 1e-12);
});

test("subLimits picks the smallest voltage and names it", (t) => {
  const V = ampVoltage(800, EIGHT_OHM),
    m = boxModel(fh, 148, 57, 14, 31, V, "BW24")!;
  const L = subwooferLimits(m, fh, V, 23.5);
  const cands = {
    port: (V * 23.5) / m.peakVel,
    xmax: (V * 100) / m.xmaxPct,
    thermal: thermalVoltageLimit(fh),
    amp: V,
  };
  close(t, L.V, Math.min(...Object.values(cands)), 1e-9);
  close(t, L.W, L.V ** 2 / 8, 1e-9);
});
test("subLimits: amp-limited when the amp is tiny", (t) => {
  const V = ampVoltage(20, EIGHT_OHM),
    m = boxModel(fh, 148, 57, 14, 31, V, "BW24")!;
  assert.equal(subwooferLimits(m, fh, V, 23.5).who, "amp");
});
test("limits search the whole curve, including below 20 Hz", (t) => {
  const m = boxModel(fh, 148, 57, 14, 15, ampVoltage(500, EIGHT_OHM), "BW24")!; // low highpass: excursion rises below 20 Hz
  const peak = Math.max(...m.curve.map((o) => o.xmm));
  close(t, m.peakX, peak, 1e-12);
});
test("maxCurve never exceeds the amp-limited curve and stays below Xmax", (t) => {
  const V = ampVoltage(800, EIGHT_OHM),
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
