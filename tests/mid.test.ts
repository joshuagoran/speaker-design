import { test } from "vite-plus/test";
import assert from "node:assert";
import {
  midSystem,
  ampVoltage,
  thermalVoltageLimit,
  subThroughLowpass,
  boxModel,
  closedBox,
  subSystem,
  linkwitzRiley24Lowpass,
  LOWPASS_SKIRT_SPAN,
  STUFFING_VOLUME_GAIN,
  nearestPoint,
} from "../src/lib/pa/calc";
import { MID_OPTIONS, SUB_OPTIONS } from "../src/lib/data";
import type { MidSystemConfig, SubSystemConfig } from "../src/types";
import { close, db } from "./helpers";

const mid = MID_OPTIONS.find((o) => o.id === "bc12ndl76") || MID_OPTIONS.find((o) => o.ts)!;
const cfg: MidSystemConfig = {
  midDims: { w: 15, h: 15, d: 15 },
  wall: 0.75,
  inset: 0.75,
  xoLo: 120,
  xoHi: 900,
  mAmpW: 400,
};

test("midSystem volume: gross from boxL, less displacement, stuffed x1.15", (t) => {
  const m = midSystem(mid, cfg);
  close(t, m.grossL, ((15 - 1.5) * (15 - 1.5) * (15 - 0.75 - 0.75 - 0.75) * 16.387) / 1000, 1e-9);
  const disp = mid.ts.disp != null ? mid.ts.disp : mid.size === 15 ? 4 : 2.5;
  close(t, m.netL, m.grossL - disp, 1e-9);
  close(t, m.effL, m.netL * STUFFING_VOLUME_GAIN, 1e-9);
  close(t, m.V, Math.sqrt(400 * 8), 1e-9);
});
test("midSystem: displacement assumed 2.5 L (12 in) / 4 L (15 in) when unpublished", (t) => {
  const ts = { ...mid.ts, disp: null };
  close(t, midSystem({ ...mid, size: 12, ts }, cfg).disp, 2.5, 0);
  close(t, midSystem({ ...mid, size: 15, ts }, cfg).disp, 4, 0);
});
test("mid max curve: each point is the smallest of Xmax, thermal and amp", (t) => {
  const m = midSystem(mid, cfg);
  m.max!.forEach((o, i) => {
    const c = m.mdl!.curve[i],
      s = 10 ** ((o.spl - c.spl) / 20),
      V = m.V * s;
    assert.ok(o.spl <= c.spl + 1e-9, "never above the amp-limited curve");
    assert.ok(c.xmm * s <= mid.ts.Xmax * (1 + 1e-9), "excursion within Xmax");
    assert.ok(V <= thermalVoltageLimit(mid.ts.aes) * (1 + 1e-9), "within program rating");
    // and at least one limit is exactly met
    const met =
      Math.abs(c.xmm * s - mid.ts.Xmax) < 1e-6 ||
      Math.abs(V - thermalVoltageLimit(mid.ts.aes)) < 1e-6 ||
      Math.abs(V - m.V) < 1e-6;
    assert.ok(met, `${o.f.toFixed(0)} Hz: no limit met`);
  });
});
test("mid max: tiny amp is amp-limited everywhere and equals the curve", (t) => {
  const m = midSystem(mid, { ...cfg, mAmpW: 1 });
  m.max!.forEach((o, i) => {
    assert.equal(o.who, "amp");
    close(t, o.spl, m.mdl!.curve[i].spl, 1e-9);
  });
});
test("mid max in the passband: thermal-limited SPL = mass line at the program-rating voltage", (t) => {
  const m = midSystem(mid, { ...cfg, mAmpW: 5000 });
  const o = nearestPoint(m.max!, 400);
  if (o.who === "thermal")
    close(
      t,
      o.spl,
      nearestPoint(m.mdl!.curve, 400).spl + db(thermalVoltageLimit(mid.ts.aes) / m.V),
      1e-9,
    );
  close(t, m.useV, Math.min(thermalVoltageLimit(mid.ts.aes), m.V), 1e-12);
});
test("subThroughLp: -6 dB LR24 at the crossover when amp-limited, never above the sub curve", (t) => {
  const ts = SUB_OPTIONS.find((o) => o.id === "f18fh500")!.ts,
    V = ampVoltage(10);
  const mdl = boxModel(ts, 150, 60, 14, 30, V, "BW24")!;
  const s = subThroughLowpass(mdl, ts, V, 20, 120);
  const i = mdl.curve.indexOf(nearestPoint(mdl.curve, 120));
  close(t, s[i].spl, mdl.curve[i].spl + db(linkwitzRiley24Lowpass(mdl.curve[i].f, 120)), 1e-9);
  close(t, db(linkwitzRiley24Lowpass(120, 120)), -6.02, 0.01);
  s.forEach((o, k) => assert.ok(o.spl <= mdl.curve[k].spl + 1e-9));
});
test("subThroughLp: the lowpass relaxes the limits (more drive above the crossover)", (t) => {
  const ts = SUB_OPTIONS.find((o) => o.id === "f18fh500")!.ts,
    V = ampVoltage(3000);
  const mdl = boxModel(ts, 150, 60, 14, 30, V, "BW24")!;
  const s = subThroughLowpass(mdl, ts, V, 20, 80),
    k = mdl.curve.indexOf(nearestPoint(mdl.curve, 200));
  const vt = thermalVoltageLimit(ts.aes),
    g = linkwitzRiley24Lowpass(mdl.curve[k].f, 80);
  // at 200 Hz the filtered cone moves little: thermal or amp limits, not Xmax/port
  const lim = Math.min(vt, V);
  close(
    t,
    s[k].spl,
    mdl.curve[k].spl +
      db(g) +
      db(
        Math.min(lim, (V * ts.Xmax) / (mdl.curve[k].xmm * g), (V * 20) / (mdl.curve[k].vel * g)) /
          V,
      ),
    1e-9,
  );
});
test("mid at a 2 kHz crossover: the curve runs past it, -6 dB (LR24) at xoHi, then falls smoothly", (t) => {
  const xoHi = 2000,
    m = midSystem(mid, { ...cfg, xoHi });
  const curve = m.mdl!.curve,
    max = m.max!;
  assert.ok(curve[curve.length - 1].f >= LOWPASS_SKIRT_SPAN * xoHi, "runs to 2.5 x the crossover");
  const i = curve.indexOf(nearestPoint(curve, xoHi)),
    k = curve.indexOf(nearestPoint(curve, xoHi / 2));
  close(t, curve[i].f, xoHi, xoHi * 0.006, "a point at the crossover");
  // the filters' share at xoHi against the passband trend (the raw curve): LR24 lowpass -6 dB, the 120 Hz highpass ~0
  close(t, curve[i].spl - curve[i].raw, -6.02, 0.05);
  // the max curve carries the same -6 dB: its drop from an octave below is the lowpass's
  const lp = (j: number) => db(linkwitzRiley24Lowpass(curve[j].f, xoHi));
  close(t, max[i].spl - curve[i].raw - (max[k].spl - curve[k].raw), lp(i) - lp(k), 0.05);
  // above: falls at every step, no step bigger than 1 dB, 30 dB under the passband trend by the end
  for (let j = i + 1; j < max.length; j++) {
    const d = max[j].spl - max[j - 1].spl;
    assert.ok(d < 0 && d > -1, `${max[j].f.toFixed(0)} Hz: step ${d.toFixed(2)} dB`);
  }
  assert.ok(max[max.length - 1].spl < max[i].spl + 6.02 - 30, "skirt 30 dB down at the end");
});
test("running a curve on past fmax leaves the usual points exactly where they were", () => {
  const a = closedBox(mid.ts, 40, 120, 2000, 20)!,
    b = closedBox(mid.ts, 40, 120, 2000, 20, { fTop: 5000 })!;
  assert.equal(a.curve.length, 420);
  assert.ok(b.curve.length > a.curve.length && b.curve[b.curve.length - 1].f >= 5000);
  a.curve.forEach((o, i) => assert.deepStrictEqual(b.curve[i], o));
  assert.equal(b.peakX, a.peakX);
  assert.equal(b.f3, a.f3);
  // xoHi at 800 Hz or below samples exactly as before; the default 900 Hz runs on to 2250 Hz
  assert.equal(midSystem(mid, { ...cfg, xoHi: 800 }).mdl!.curve.length, 420);
  assert.ok(midSystem(mid, cfg).mdl!.curve[midSystem(mid, cfg).mdl!.curve.length - 1].f >= 2250);
});
test("sub: a crossover above 120 Hz runs the curve past 300 Hz for the skirt; limits unchanged", (t) => {
  const sub = SUB_OPTIONS.find((o) => o.id === "f18fh500")!;
  const sc: SubSystemConfig = {
    subBox: { w: 24, h: 30, d: 26 },
    midDims: cfg.midDims,
    wall: 0.75,
    inset: 0.75,
    portStyle: "round2",
    cVent: { slotH: 3, nt: 2, dia: 4, throat: 2, len: 12 },
    hpf: 30,
    hpType: "BW24",
    ampW: 800,
    portMax: 20,
    layout: "stack",
  };
  const a = subSystem(sub, mid, sc),
    b = subSystem(sub, mid, { ...sc, xoLo: 250 }),
    c = subSystem(sub, mid, { ...sc, xoLo: 120 });
  assert.ok(a.mdl && b.mdl && c.mdl);
  assert.equal(a.mdl.curve.length, 420);
  assert.equal(c.mdl.curve.length, 420, "120 Hz and below: as before");
  assert.ok(b.mdl.curve[b.mdl.curve.length - 1].f >= 625);
  a.mdl.curve.forEach((o, i) => assert.deepStrictEqual(b.mdl?.curve[i], o));
  assert.deepStrictEqual(b.lim, a.lim);
  const s = subThroughLowpass(b.mdl, sub.ts, b.AMP_V, 20, 250);
  close(t, s.length, b.mdl.curve.length, 0);
  assert.ok(s[s.length - 1].spl < nearestPoint(s, 250).spl - 25, "the skirt reaches well down");
});
