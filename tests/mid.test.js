import test from "node:test";
import { midSystem, ampV, thermalV, subThroughLp, boxModel, lr24lp, STUFF, nearest } from "../src/lib/pa/calc.js";
import { MID_OPTIONS, SUB_OPTIONS } from "../src/lib/data.js";
import { close, db } from "./helpers.js";

const mid = MID_OPTIONS.find((o) => o.id === "bc12ndl76") || MID_OPTIONS.find((o) => o.ts);
const cfg = { midDims: { w: 15, h: 15, d: 15 }, wall: 0.75, inset: 0.75, xoLo: 120, xoHi: 900, mAmpW: 400 };

test("midSystem volume: gross from boxL, less displacement, stuffed x1.15", (t) => {
  const m = midSystem(mid, cfg);
  close(t, m.grossL, ((15 - 1.5) * (15 - 1.5) * (15 - 0.75 - 0.75 - 0.75) * 16.387) / 1000, 1e-9);
  const disp = mid.ts.disp != null ? mid.ts.disp : mid.size === 15 ? 4 : 2.5;
  close(t, m.netL, m.grossL - disp, 1e-9);
  close(t, m.effL, m.netL * STUFF, 1e-9);
  close(t, m.V, Math.sqrt(400 * 8), 1e-9);
});
test("midSystem: displacement assumed 2.5 L (12 in) / 4 L (15 in) when unpublished", (t) => {
  const ts = { ...mid.ts, disp: null };
  close(t, midSystem({ ...mid, size: 12, ts }, cfg).disp, 2.5, 0);
  close(t, midSystem({ ...mid, size: 15, ts }, cfg).disp, 4, 0);
});
test("mid max curve: each point is the smallest of Xmax, thermal and amp", (t) => {
  const m = midSystem(mid, cfg);
  m.max.forEach((o, i) => {
    const c = m.mdl.curve[i], s = 10 ** ((o.spl - c.spl) / 20), V = m.V * s;
    t.assert.ok(o.spl <= c.spl + 1e-9, "never above the amp-limited curve");
    t.assert.ok(c.xmm * s <= mid.ts.Xmax * (1 + 1e-9), "excursion within Xmax");
    t.assert.ok(V <= thermalV(mid.ts.aes) * (1 + 1e-9), "within program rating");
    // and at least one limit is exactly met
    const met = Math.abs(c.xmm * s - mid.ts.Xmax) < 1e-6 || Math.abs(V - thermalV(mid.ts.aes)) < 1e-6 || Math.abs(V - m.V) < 1e-6;
    t.assert.ok(met, `${o.f.toFixed(0)} Hz: no limit met`);
  });
});
test("mid max: tiny amp is amp-limited everywhere and equals the curve", (t) => {
  const m = midSystem(mid, { ...cfg, mAmpW: 1 });
  m.max.forEach((o, i) => { t.assert.equal(o.who, "amp"); close(t, o.spl, m.mdl.curve[i].spl, 1e-9); });
});
test("mid max in the passband: thermal-limited SPL = mass line at the program-rating voltage", (t) => {
  const m = midSystem(mid, { ...cfg, mAmpW: 5000 });
  const o = nearest(m.max, 400);
  if (o.who === "thermal") close(t, o.spl, nearest(m.mdl.curve, 400).spl + db(thermalV(mid.ts.aes) / m.V), 1e-9);
  close(t, m.useV, Math.min(thermalV(mid.ts.aes), m.V), 1e-12);
});
test("subThroughLp: -6 dB LR24 at the crossover when amp-limited, never above the sub curve", (t) => {
  const ts = SUB_OPTIONS.find((o) => o.id === "f18fh500").ts, V = ampV(10);
  const mdl = boxModel(ts, 150, 60, 14, 30, V, "BW24");
  const s = subThroughLp(mdl, ts, V, 20, 120);
  const i = mdl.curve.indexOf(nearest(mdl.curve, 120));
  close(t, s[i].spl, mdl.curve[i].spl + db(lr24lp(mdl.curve[i].f, 120)), 1e-9);
  close(t, db(lr24lp(120, 120)), -6.02, 0.01);
  s.forEach((o, k) => t.assert.ok(o.spl <= mdl.curve[k].spl + 1e-9));
});
test("subThroughLp: the lowpass relaxes the limits (more drive above the crossover)", (t) => {
  const ts = SUB_OPTIONS.find((o) => o.id === "f18fh500").ts, V = ampV(3000);
  const mdl = boxModel(ts, 150, 60, 14, 30, V, "BW24");
  const s = subThroughLp(mdl, ts, V, 20, 80), k = mdl.curve.indexOf(nearest(mdl.curve, 200));
  const vt = thermalV(ts.aes), g = lr24lp(mdl.curve[k].f, 80);
  // at 200 Hz the filtered cone moves little: thermal or amp limits, not Xmax/port
  const lim = Math.min(vt, V);
  close(t, s[k].spl, mdl.curve[k].spl + db(g) + db(Math.min(lim, (V * ts.Xmax) / (mdl.curve[k].xmm * g), (V * 20) / (mdl.curve[k].vel * g)) / V), 1e-9);
});
