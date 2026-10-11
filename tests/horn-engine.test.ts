// The horn engine (lib/acoustics) against references that need no Hornresp: power series for the special functions,
// the textbook solutions for ducts and flares, power conservation, and the planner's own box models, which the engine
// must reproduce when it has no horn.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { besselJ, struveH1 } from "../src/lib/acoustics/bessel";
import { pistonImpedance, mouthImpedance } from "../src/lib/acoustics/radiation";
import {
  segmentMatrix,
  chainMatrix,
  inputImpedance,
  outputFlowRatio,
} from "../src/lib/acoustics/hornSegments";
import { hornModel, hornGrid } from "../src/lib/acoustics/hornModel";
import { abs, add, arg, cx, div, mul, sub } from "../src/lib/acoustics/complex";
import { AIR_DENSITY, SOUND_SPEED } from "../src/constants/hornEngine";
import { boxModel, closedBox, highpassGain, ventTuning } from "../src/lib/pa/calc";
import { DEFAULT_PA } from "../src/lib/defaults";
import type { Complex, HornDesign, HornSegment } from "../src/types";

const RHO_C = AIR_DENSITY * SOUND_SPEED;
const near = (a: number, b: number, tol: number, what: string) =>
  assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b} (tolerance ${tol})`);
const wrapDiff = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
const nearC = (a: Complex, b: Complex, relTol: number, what: string) =>
  assert.ok(
    abs(sub(a, b)) <= relTol * Math.max(abs(b), 1e-12),
    `${what}: ${a.re}${a.im >= 0 ? "+" : ""}${a.im}j vs ${b.re}${b.im >= 0 ? "+" : ""}${b.im}j`,
  );

// power series, exact enough for x up to about 15
const factorial = (n: number): number => (n <= 1 ? 1 : n * factorial(n - 1));
const seriesJ = (n: number, x: number) => {
  let s = 0;
  for (let k = 0; k < 60; k++)
    s += ((-1) ** k * (x / 2) ** (2 * k + n)) / (factorial(k) * factorial(k + n));
  return s;
};
const seriesH1 = (x: number) => {
  // Σ (−1)^k (x/2)^(2k+2) / (Γ(k+3/2) Γ(k+5/2)), with Γ(3/2) = √π/2
  let g1 = Math.sqrt(Math.PI) / 2,
    g2 = g1 * 1.5,
    s = 0;
  for (let k = 0; k < 60; k++) {
    s += ((-1) ** k * (x / 2) ** (2 * k + 2)) / (g1 * g2);
    g1 *= k + 1.5;
    g2 *= k + 2.5;
  }
  return s;
};

test("Bessel J₀, J₁ and Struve H₁ match their power series", () => {
  for (const x of [0.01, 0.3, 1, 2.4048, 5, 9.7, 14]) {
    near(besselJ(0, x), seriesJ(0, x), 1e-10, `J0(${x})`);
    near(besselJ(1, x), seriesJ(1, x), 1e-10, `J1(${x})`);
    near(struveH1(x), seriesH1(x), 1e-8, `H1(${x})`);
  }
  near(besselJ(0, 1), 0.7651976866, 1e-9, "J0(1) table value");
  near(besselJ(1, 1), 0.4400505857, 1e-9, "J1(1) table value");
});

test("Bessel and Struve hold up where the series fail (2ka to 60)", () => {
  for (const x of [20, 37.3, 60]) {
    // J₀' = −J₁
    const h = 1e-4;
    near((besselJ(0, x + h) - besselJ(0, x - h)) / (2 * h), -besselJ(1, x), 1e-6, `J0'(${x})`);
    // large-x asymptote of J₁, good to O(1/x)
    near(
      besselJ(1, x),
      Math.sqrt(2 / (Math.PI * x)) * Math.cos(x - (3 * Math.PI) / 4),
      0.4 / x,
      `J1(${x})`,
    );
    // Aarts & Janssen's H₁ approximation, good to about 0.005
    const aj =
      2 / Math.PI -
      besselJ(0, x) +
      (16 / Math.PI - 5) * (Math.sin(x) / x) +
      (12 - 36 / Math.PI) * ((1 - Math.cos(x)) / (x * x));
    near(struveH1(x), aj, 0.006, `H1(${x})`);
  }
});

test("a baffled piston's radiation impedance has its textbook limits", () => {
  const S = 0.05;
  const a = Math.sqrt(S / Math.PI);
  // small ka: R = (ρc/S)(ka)²/2, X = (ρc/S)·8ka/(3π)
  const fLow = (0.05 * SOUND_SPEED) / (2 * Math.PI * a);
  const zl = pistonImpedance(S, fLow);
  near(zl.re / ((RHO_C / S) * (0.05 ** 2 / 2)), 1, 0.01, "low-ka resistance");
  near(zl.im / ((RHO_C / S) * ((8 * 0.05) / (3 * Math.PI))), 1, 0.01, "low-ka reactance");
  // large ka: R → ρc/S
  const zh = pistonImpedance(S, (30 * SOUND_SPEED) / (2 * Math.PI * a));
  near(zh.re / (RHO_C / S), 1, 0.02, "high-ka resistance");
  // images: a quarter-space mouth carries 2·Z(2S); two stacked mouths in half space the same
  const f = 120;
  nearC(mouthImpedance(S, f, 1, 1), mul(cx(2), pistonImpedance(2 * S, f)), 1e-12, "quarter space");
  nearC(mouthImpedance(S, f, 2, 2), mouthImpedance(S, f, 1, 1), 1e-12, "two stacked boxes");
});

test("a straight duct's matrix is the plane-wave one", () => {
  const seg: HornSegment = { profile: "con", s1: 100, s2: 100, length: 100 };
  const S = 0.01,
    L = 1,
    z0 = RHO_C / S;
  for (const f of [20, 85.75, 300, 1234]) {
    const kL = ((2 * Math.PI * f) / SOUND_SPEED) * L;
    const m = segmentMatrix(seg, f);
    nearC(m[0], cx(Math.cos(kL)), 1e-9, `A at ${f}`);
    nearC(m[1], cx(0, z0 * Math.sin(kL)), 1e-9, `B at ${f}`);
    nearC(m[2], cx(0, Math.sin(kL) / z0), 1e-9, `C at ${f}`);
    nearC(m[3], cx(Math.cos(kL)), 1e-9, `D at ${f}`);
  }
  // closed at the far end it resonates at c/4L: the input impedance A/C passes through zero there
  const fq = SOUND_SPEED / 4;
  const m = segmentMatrix(seg, fq);
  assert.ok(abs(div(m[0], m[2])) < 1e-6 * z0, "quarter-wave resonance");
  // matched at the far end, the flow comes out delayed by L/c
  const ratio = outputFlowRatio(segmentMatrix(seg, 200), cx(z0));
  near(abs(ratio), 1, 1e-9, "matched duct: no loss");
  assert.ok(
    wrapDiff(arg(ratio), ((-2 * Math.PI * 200) / SOUND_SPEED) * L) < 1e-9,
    "matched duct: delay L/c",
  );
});

// a flare's forward-wave impedance: what an endless horn shows at a section of area S
const expForward = (S: number, m: number, f: number): Complex => {
  const k = (2 * Math.PI * f) / SOUND_SPEED,
    d = k * k - (m * m) / 4;
  const g = d >= 0 ? cx(Math.sqrt(d)) : cx(0, -Math.sqrt(-d));
  // (ρc/S)·jk/(m/2 + jγ)
  return mul(cx(RHO_C / S), div(cx(0, k), cx(m / 2 - g.im, g.re)));
};
const conForward = (S: number, x: number, f: number): Complex => {
  const kx = ((2 * Math.PI * f) / SOUND_SPEED) * x;
  return mul(cx(RHO_C / S), div(cx(0, kx), cx(1, kx)));
};

test("an exponential horn ended in its own forward wave shows the endless horn's throat impedance", () => {
  const seg: HornSegment = { profile: "exp", s1: 300, s2: 4000, length: 47 };
  const S1 = 0.03,
    S2 = 0.4,
    m = Math.log(S2 / S1) / 0.47;
  const fc = (m * SOUND_SPEED) / (4 * Math.PI);
  for (const f of [0.5 * fc, 0.9 * fc, 1.1 * fc, 2 * fc, 8 * fc]) {
    const zin = inputImpedance(segmentMatrix(seg, f), expForward(S2, m, f));
    nearC(zin, expForward(S1, m, f), 1e-8, `throat at ${f.toFixed(1)} Hz`);
  }
  // above the cutoff the throat resistance is (ρc/S)√(1 − (fc/f)²); below it there is none
  const above = expForward(S1, m, 2 * fc);
  near(above.re / (RHO_C / S1), Math.sqrt(1 - 0.25), 1e-12, "resistance above cutoff");
  near(expForward(S1, m, 0.5 * fc).re, 0, 1e-9, "no resistance below cutoff");
});

test("a conical horn ended in its own forward wave shows the spherical wave's impedance", () => {
  // throat r₁, mouth r₂ over L: the apex sits x₁ = L·r₁/(r₂ − r₁) before the throat
  const seg: HornSegment = { profile: "con", s1: 200, s2: 1800, length: 60 };
  const r1 = Math.sqrt(0.02),
    r2 = Math.sqrt(0.18);
  const x1 = (0.6 * r1) / (r2 - r1);
  for (const f of [15, 60, 250, 1500]) {
    const zin = inputImpedance(segmentMatrix(seg, f), conForward(0.18, x1 + 0.6, f));
    nearC(zin, conForward(0.02, x1, f), 1e-8, `throat at ${f} Hz`);
  }
});

test("a lossless chain carries the same real power in and out", () => {
  const chain: HornSegment[] = [
    { profile: "con", s1: 250, s2: 500, length: 20 },
    { profile: "exp", s1: 500, s2: 3000, length: 45 },
    { profile: "con", s1: 3000, s2: 2500, length: 10 }, // a narrowing segment
  ];
  for (const f of [25, 90, 400, 1800]) {
    const m = chainMatrix(chain, f);
    const load = mouthImpedance(0.25, f, 2, 1);
    // [p₁, U₁] = M·[p₂, U₂], with U₂ = 1 and p₂ = Z·U₂
    const u2 = cx(1),
      p2 = mul(load, u2);
    const pin = add(mul(m[0], p2), mul(m[1], u2)),
      uin = add(mul(m[2], p2), mul(m[3], u2));
    const powerIn = pin.re * uin.re + pin.im * uin.im; // Re(p·U*)
    const powerOut = p2.re * u2.re + p2.im * u2.im;
    near(powerIn / powerOut, 1, 1e-8, `power at ${f} Hz`);
  }
  // splitting a segment changes nothing
  const whole: HornSegment = { profile: "exp", s1: 400, s2: 3600, length: 60 };
  const mid = 400 * Math.sqrt(9);
  const halves: HornSegment[] = [
    { profile: "exp", s1: 400, s2: mid, length: 30 },
    { profile: "exp", s1: mid, s2: 3600, length: 30 },
  ];
  for (const f of [30, 300]) {
    const a = segmentMatrix(whole, f),
      b = chainMatrix(halves, f);
    for (let i = 0; i < 4; i++) nearC(b[i], a[i], 1e-9, `split exp, element ${i}, ${f} Hz`);
  }
});

const direct = (ts: HornDesign["driver"], rear: HornDesign["rear"]): HornDesign => ({
  driver: ts,
  count: 1,
  throatChamber: 0,
  segments: [],
  rear,
  angle: 2,
  portOffset: 0,
});

test("with no horn and no radiation load it is the sealed box model", () => {
  const ts = DEFAULT_PA.mid.ts;
  const sealed = closedBox(ts, 30, null, null, 20, {
    hpOrder: 4,
    lpOrder: 4,
    fmin: 20,
    fmax: 2000,
    N: 120,
    phase: true,
  });
  assert.ok(sealed);
  const freqs = sealed.curve.map((p) => p.f);
  const horn = hornModel(direct(ts, { liters: 30, port: null }), freqs, 20, {
    radiationLoad: false,
  });
  sealed.curve.forEach((p, i) => {
    const h = horn.curve[i];
    near(h.spl, p.raw, 1e-9, `SPL at ${p.f.toFixed(1)} Hz`);
    near(h.xmm, p.xmm, 1e-9, `excursion at ${p.f.toFixed(1)} Hz`);
    assert.ok(
      wrapDiff(h.phase, p.rawPhase ?? NaN) < 1e-9,
      `phase at ${p.f.toFixed(1)} Hz: ${h.phase} vs ${p.rawPhase}`,
    );
  });
  assert.strictEqual(horn.fb, null);
});

test("with the radiation load on, a direct radiator still matches the box model low down", () => {
  // the air mass taken off Mms (8/3·ρa³) is the radiation reactance's mass at low ka, so the two cancel there
  const ts = DEFAULT_PA.mid.ts;
  const d = direct(ts, { liters: 30, port: null });
  const freqs = [40, 70, 100, 150];
  const on = hornModel(d, freqs, 10),
    off = hornModel(d, freqs, 10, { radiationLoad: false });
  on.curve.forEach((p, i) => near(p.spl, off.curve[i].spl, 0.2, `SPL at ${p.f} Hz`));
});

test("with no horn and no radiation load it is the vented box model", () => {
  const ts = DEFAULT_PA.sub.ts;
  const VbL = 180,
    SpIn2 = 40,
    LpIn = 14,
    hpf = 31;
  const vented = boxModel(ts, VbL, SpIn2, LpIn, hpf, 50, "BW24", { phase: true, N: 160 });
  assert.ok(vented);
  const { Leff } = ventTuning(VbL, SpIn2, LpIn);
  const freqs = vented.curve.map((p) => p.f);
  const horn = hornModel(
    direct(ts, { liters: VbL, port: { area: SpIn2 * 6.4516, effLength: Leff * 100 } }),
    freqs,
    50,
    { radiationLoad: false },
  );
  near(horn.fb ?? 0, vented.Fb, 1e-9, "tuning");
  vented.curve.forEach((p, i) => {
    const h = horn.curve[i],
      hp = highpassGain(p.f, hpf, "BW24");
    near(h.spl, p.raw, 1e-9, `SPL at ${p.f.toFixed(1)} Hz`);
    near(h.xmm * hp, p.xmm, 1e-9, `excursion at ${p.f.toFixed(1)} Hz`);
    near(h.portVel * hp, p.vel, 1e-9, `port speed at ${p.f.toFixed(1)} Hz`);
    assert.ok(wrapDiff(h.phase, p.rawPhase ?? NaN) < 1e-9, `phase at ${p.f.toFixed(1)} Hz`);
  });
});

test("boxes side by side add 6 dB each doubling, and load each other as one bigger mouth", () => {
  const ts = DEFAULT_PA.mid.ts;
  const freqs = [60, 120, 250];
  const one = direct(ts, { liters: 30, port: null });
  const a = hornModel(one, freqs, 10, { radiationLoad: false }),
    b = hornModel({ ...one, count: 2 }, freqs, 10, { radiationLoad: false });
  a.curve.forEach((p, i) => near(b.curve[i].spl - p.spl, 20 * Math.log10(2), 1e-9, "no load"));
  // two horns side by side in half space are one horn and its image in a quarter space: the same loads and level
  const horn: HornDesign = {
    ...one,
    segments: [{ profile: "exp", s1: 300, s2: 2000, length: 40 }],
  };
  const pair = hornModel({ ...horn, count: 2 }, freqs, 10),
    image = hornModel({ ...horn, angle: 1 }, freqs, 10);
  pair.curve.forEach((p, i) => {
    near(p.spl, image.curve[i].spl, 1e-9, `level at ${p.f} Hz`);
    near(p.xmm, image.curve[i].xmm, 1e-12, `excursion at ${p.f} Hz`);
  });
});

test("a front-loaded horn out-plays the same driver direct in its band, with less excursion", () => {
  const ts = DEFAULT_PA.mid.ts;
  const rear = { liters: 25, port: null };
  const freqs = hornGrid(100, 1000, 60);
  // exponential, cutoff about 150 Hz: m = 4π·150/c, throat 300 cm², mouth 4000 cm²
  const horn: HornDesign = {
    ...direct(ts, rear),
    throatChamber: 0.5,
    segments: [{ profile: "exp", s1: 300, s2: 4000, length: 47 }],
  };
  const h = hornModel(horn, freqs, 10),
    d = hornModel(direct(ts, rear), freqs, 10);
  const band = (c: typeof h.curve) =>
    c.filter((p) => p.f >= 300 && p.f <= 800).reduce((s, p) => s + p.spl, 0) /
    c.filter((p) => p.f >= 300 && p.f <= 800).length;
  assert.ok(band(h.curve) - band(d.curve) > 3, `horn gain ${band(h.curve) - band(d.curve)} dB`);
  const at300 = (c: typeof h.curve) =>
    c.reduce((b, p) => (Math.abs(p.f - 300) < Math.abs(b.f - 300) ? p : b));
  assert.ok(at300(h.curve).xmm < at300(d.curve).xmm, "less excursion at 300 Hz");
  // the electrical impedance never drops below Re
  assert.ok(h.curve.every((p) => p.ze >= ts.Re - 1e-9));
});
