import * as HIFI from "../tools/hifi.js";
import test from "node:test";
import { lr, baffleStep, baffleStepF3, bscEq, boundary, piston, waveguide, hifiSystem, hifiChips, responseAt, dispersionMap, grossL } from "../tools/hifi.js";
import { close } from "./helpers.js";

// a generic 6.5" woofer and 1" dome (typical published values), so the tests don't depend on the driver list
const W = { id: "w", size: 6.5, lb: 4, name: "test 6.5", ts: { Fs: 38, Qts: 0.36, Qes: 0.4, Qms: 3.5, Vas: 25, Sd: 132, Xmax: 5.5, Re: 5.6, Bl: 7, Mms: 16, aes: 60, disp: 0.6 } };
const T = { id: "t", lb: 1, name: "test dome", hf: { sens: 90, aes: 50, aesXo: 2000, minXo: 1800, imp: 8, fs: 700 }, type: "dome", faceplate: { w: 4, h: 4 }, domeIn: 1 };
const cfg = { box: "vented", dim: { w: 8.5, h: 14, d: 10 }, wall: 0.75, port: { n: 1, dia: 2, len: 5 }, xo: 2200, order: 4, wAmpW: 100, tAmpW: 50, bsc: 0, place: "free", wallFt: 2, portMax: 17 };
const db = (x) => 20 * Math.log10(x);

test("LR24 and LR48 low and high passes sum flat, in phase", (t) => {
  for (const order of [4, 8]) for (const f of [200, 1000, 2000, 3000, 12000]) {
    const a = lr(f, 2000, order, "lp"), b = lr(f, 2000, order, "hp");
    close(t, Math.hypot(a.re + b.re, a.im + b.im), 1, 1e-9, `order ${order} at ${f}`);
  }
  close(t, db(Math.hypot(lr(2000, 2000, 4, "lp").re, lr(2000, 2000, 4, "lp").im)), -6.02, 0.01, "−6 dB at the crossover");
});

test("baffle step: −6 dB well below, 0 dB well above, −3 dB at 115 / width", (t) => {
  close(t, db(baffleStep(20, 9)), -6, 0.05); close(t, db(baffleStep(20000, 9)), 0, 0.05);
  close(t, db(baffleStep(baffleStepF3(9), 9)), -3, 0.05);
  close(t, db(bscEq(20, 9, 4)), 4, 0.05, "compensation shelf"); close(t, db(bscEq(20000, 9, 4)), 0, 0.05);
});

test("placement: +3 dB near a wall and +6 dB in a corner at low frequencies, nothing up high", (t) => {
  close(t, db(boundary(10, "wall", 0.6)), 3, 0.05); close(t, db(boundary(10, "corner", 0.6)), 6, 0.05);
  close(t, db(boundary(5000, "corner", 0.6)), 0, 0.05); close(t, db(boundary(20, "free", 0.6)), 0, 1e-9);
});

test("directivity: pistons and waveguides are 0 dB on axis and fall off-axis as frequency rises", (t) => {
  close(t, piston(3000, 0.065, 0), 1, 1e-9);
  t.assert.ok(piston(3000, 0.065, 0.5) < piston(1000, 0.065, 0.5), "a 6.5\" narrows with frequency");
  close(t, db(waveguide(10000, 90, 60, 10, 7, Math.PI / 4, 0)), -6, 0.1, "−6 dB at the edge of a 90° waveguide");
});

test("the speaker: volume, tuning, levels and checks", (t) => {
  const s = hifiSystem(W, T, cfg);
  close(t, s.gross, grossL(cfg.dim, 0.75), 1e-9);
  t.assert.ok(s.net < s.gross && s.Fb > 30 && s.Fb < 80, `Fb ${s.Fb}`);
  t.assert.ok(s.f3 > 30 && s.f3 < 120, `F3 ${s.f3}`);
  t.assert.ok(s.trim < 0, "a 90 dB dome is trimmed down to an ~86 dB woofer");
  t.assert.ok(s.maxLevel === Math.min(s.wLevel, s.tLevel));
  const heads = hifiChips(s, W, T, cfg).map(([, h]) => h);
  t.assert.ok(heads.some((h) => /Woofer limited by|Woofer sets/.test(h)));
  // a crossover under the dome's rating is flagged
  const low = { ...cfg, xo: 1200 };
  t.assert.ok(hifiChips(hifiSystem(W, T, low), W, T, low).some(([, h]) => h === "Below the tweeter's minimum crossover"));
  // baffle-step boost costs headroom
  const b = hifiSystem(W, T, { ...cfg, bsc: 6 });
  t.assert.ok(b.wLevel <= s.wLevel + 1e-9, "boost never adds clean output");
});

test("response at the seat: on axis matches the design axis; off axis and above the lobe lose level", (t) => {
  const s = hifiSystem(W, T, cfg), freqs = [500, 2200, 8000];
  const on = responseAt(s, W, T, cfg, { th: 0, eyeIn: s.lay.tweeterIn, distM: 2 }, freqs);
  const off = responseAt(s, W, T, cfg, { th: Math.PI / 3, eyeIn: s.lay.tweeterIn, distM: 2 }, freqs);
  t.assert.ok(off[2].spl < on[2].spl - 2, "60° off axis at 8 kHz is quieter");
  // the summed on-axis response at the crossover is close to the passband (time-aligned, LR4)
  t.assert.ok(Math.abs(on[1].spl - on[0].spl) < 3, `${on[1].spl} vs ${on[0].spl}`);
  const m = dispersionMap(s, W, T, cfg, "h", 2);
  t.assert.equal(m.rows.length, m.angles.length);
  t.assert.ok(m.rows[0].every((v) => Math.abs(v) < 1e-9), "0° row is the reference");
});

test("ports with elbows: longer ports fit, and the check says so", (t) => {
  const { portMaxLen } = HIFI;
  const dim = { w: 8.5, h: 14, d: 10 };
  const s0 = portMaxLen(dim, 0.75, { dia: 2, elbows: 0 }), s1 = portMaxLen(dim, 0.75, { dia: 2, elbows: 1 }), s2 = portMaxLen(dim, 0.75, { dia: 2, elbows: 2 });
  t.assert.ok(s0 < s1 && s1 < s2, `${s0} < ${s1} < ${s2}`);
  const long = { ...cfg, port: { n: 1, dia: 2, len: s0 + 2 } };
  t.assert.ok(hifiChips(hifiSystem(W, T, long), W, T, long).some(([, h]) => h === "Port too long"), "straight: too long");
  const bent = { ...cfg, port: { n: 1, dia: 2, len: s0 + 2, elbows: 1 } };
  t.assert.ok(!hifiChips(hifiSystem(W, T, bent), W, T, bent).some(([, h]) => h === "Port too long"), "one elbow: fits");
});
