import { test } from "vite-plus/test";
import assert from "node:assert";
import { boxModel, closedBox } from "../src/lib/pa/calc";
import { SUB_OPTIONS } from "../src/lib/data";
import type { ThieleSmall } from "../src/types";
import { tsModel, massLineSPL, helmholtz, near, close, rel } from "./helpers";

const fh500 = SUB_OPTIONS.find((o) => o.id === "f18fh500")!.ts;

test("boxModel: Fb is the Helmholtz frequency (single port)", (t) => {
  const r = boxModel(fh500, 150, 60, 12, 20, 2.83)!;
  rel(t, r.Fb, helmholtz(150, 60, 12, 1), 1e-6);
});
test("boxModel: n round tubes get the end correction of each tube, not of one big opening", (t) => {
  const area = 2 * Math.PI * 3 * 3; // 2 x 6 in tubes
  const r = boxModel(fh500, 250, area, 14, 20, 2.83, "BW24", { nPorts: 2 })!;
  rel(t, r.Fb, helmholtz(250, area, 14, 2), 1e-6);
});
test("boxModel: midband level is the mass-controlled line (reference efficiency)", (t) => {
  const r = boxModel(fh500, 150, 60, 12, 5, 2.83)!;
  close(t, near(r.curve, 250).spl, massLineSPL(fh500, 2.83), 0.3, "250 Hz");
  const m = tsModel(fh500); // same thing through eta0: 112.07 + 10 log(eta0 * V^2 / Re) with V^2/Re = 1 W
  close(
    t,
    massLineSPL(fh500, Math.sqrt(fh500.Re)),
    112.07 + 10 * Math.log10(m.eta0),
    0.02,
    "eta0 identity",
  );
});
test("boxModel: a tiny port converges to the sealed box", (t) => {
  const v = boxModel(fh500, 150, 0.05, 12, 1, 2.83)!,
    s = closedBox(fh500, 150, null, null, 2.83)!;
  for (const f of [40, 60, 100, 200]) {
    close(t, near(v.curve, f).spl, near(s.curve, f).raw, 0.1, `SPL ${f} Hz`);
    rel(t, near(v.curve, f).xmm, near(s.curve, f).xmm, 0.01, `x ${f} Hz`);
  }
});
test("boxModel: excursion minimum sits at Fb", (t) => {
  // (port air speed does not always peak at Fb: with Fb above Fs it peaks near the lower impedance peak)
  for (const [Vb, len] of [
    [150, 12],
    [250, 16],
    [90, 10],
  ] as const) {
    const r = boxModel(fh500, Vb, 60, len, 5, 2.83)!;
    const band = r.curve.filter((o) => o.f > 15 && o.f < 90);
    const xMin = band.reduce((b, o) => (o.xmm < b.xmm ? o : b));
    rel(t, xMin.f, r.Fb, 0.03, `${Vb} L`);
  }
});
test("boxModel: lossless B4 alignment has F3 = Fs", (t) => {
  // Qts 0.383, Vas/Vb 1.414, Fb = Fs (Thiele's B4)
  // a partial driver on purpose: no Xmax (the model's excursion limit isn't used here), and Bl is set on the next line
  const ts = { Fs: 30, Qms: 1e6, Sd: 1100, Mms: 150, Re: 5.5 } as ThieleSmall;
  ts.Bl = Math.sqrt((2 * Math.PI * ts.Fs * (ts.Mms / 1e3) * ts.Re) / 0.383);
  const m = tsModel(ts),
    Vb = m.VasL / 1.4142;
  const area = 40,
    Sp = area * 0.00064516,
    r0 = Math.sqrt(Sp / Math.PI);
  const Leff = ((343 / (2 * Math.PI * ts.Fs)) ** 2 * Sp) / (Vb / 1000),
    len = (Leff - 1.46 * r0) / 0.0254;
  const r = boxModel(ts, Vb, area, len, 1, 2.83, "BW24", { QL: 1e9, Qp: Infinity })!;
  rel(t, r.Fb, ts.Fs, 1e-3, "Fb");
  const line = massLineSPL(ts, 2.83),
    f3 = r.curve.find((o) => o.spl >= line - 3)!.f;
  rel(t, f3, ts.Fs, 0.02, "F3");
});
test("boxModel: highpass scales SPL, excursion and velocity by the same factor", (t) => {
  const a = boxModel(fh500, 150, 60, 12, 1, 2.83)!,
    b = boxModel(fh500, 150, 60, 12, 30, 2.83, "LR24")!;
  const oa = near(a.curve, 30),
    ob = near(b.curve, 30),
    g = ob.xmm / oa.xmm;
  close(t, ob.vel / oa.vel, g, 1e-9);
  close(t, 10 ** ((ob.spl - oa.spl) / 20), g, 1e-6);
});
test("boxModel: excursion and velocity are sine peaks (x sqrt 2 of the RMS drive)", (t) => {
  const a = boxModel(fh500, 150, 60, 12, 1, 2.83)!,
    b = boxModel(fh500, 150, 60, 12, 1, 2.83 * 2)!;
  rel(t, near(b.curve, 50).xmm, 2 * near(a.curve, 50).xmm, 1e-9);
});
