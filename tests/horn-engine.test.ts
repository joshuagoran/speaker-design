// The horn engine (lib/acoustics) against references that need no Hornresp: power series for the special functions,
// the textbook solutions for ducts and flares, power conservation, and the planner's own box models, which the engine
// must reproduce when it has no horn.
//
// Words used below: "flow" is volume velocity (m³/s); "impedance" is acoustic impedance (Pa·s/m³); k is the wave
// number 2πf/c; ka compares a piston's radius a with the wavelength; ρc/S is a plane wave's impedance across area S.
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
import type { Complex, HornDesign, HornPoint, HornSegment } from "../src/types";

/** ρc: air's characteristic impedance, Pa·s/m (a plane wave's pressure over its particle speed). */
const AIR_IMPEDANCE = AIR_DENSITY * SOUND_SPEED;
const SQUARE_INCH_TO_CM2 = 6.4516,
  M_TO_CM = 100;
const waveNumberAt = (f: number) => (2 * Math.PI * f) / SOUND_SPEED;

/** Asserts that two numbers differ by at most `tolerance`. */
const near = (actual: number, expected: number, tolerance: number, what: string) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${what}: ${actual} vs ${expected} (tolerance ${tolerance})`,
  );
/** The difference between two angles, radians, after wrapping: 0 to π. */
const angleGap = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
const showComplex = (z: Complex) => `${z.re}${z.im >= 0 ? "+" : ""}${z.im}j`;
/** Asserts that two complex numbers differ by at most `relTolerance` of the expected one's size. */
const nearComplex = (actual: Complex, expected: Complex, relTolerance: number, what: string) =>
  assert.ok(
    abs(sub(actual, expected)) <= relTolerance * Math.max(abs(expected), 1e-12),
    `${what}: ${showComplex(actual)} vs ${showComplex(expected)}`,
  );

// power series for the references, exact enough for x up to about 15
const SERIES_TERMS = 60;
const factorial = (n: number): number => (n <= 1 ? 1 : n * factorial(n - 1));
/** J_n(x) = Σ (−1)^k (x/2)^(2k+n) / (k!·(k+n)!) */
const seriesJ = (n: number, x: number) => {
  let sum = 0;
  for (let k = 0; k < SERIES_TERMS; k++)
    sum += ((-1) ** k * (x / 2) ** (2 * k + n)) / (factorial(k) * factorial(k + n));
  return sum;
};
/** H₁(x) = Σ (−1)^k (x/2)^(2k+2) / (Γ(k+3/2)·Γ(k+5/2)), building the gammas up from Γ(3/2) = √π/2 */
const seriesH1 = (x: number) => {
  let gammaA = Math.sqrt(Math.PI) / 2,
    gammaB = gammaA * 1.5,
    sum = 0;
  for (let k = 0; k < SERIES_TERMS; k++) {
    sum += ((-1) ** k * (x / 2) ** (2 * k + 2)) / (gammaA * gammaB);
    gammaA *= k + 1.5;
    gammaB *= k + 2.5;
  }
  return sum;
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
    // the derivative of J₀ is −J₁
    const step = 1e-4;
    const slope = (besselJ(0, x + step) - besselJ(0, x - step)) / (2 * step);
    near(slope, -besselJ(1, x), 1e-6, `J0'(${x})`);
    // J₁'s large-x asymptote, good to about 1/x
    near(
      besselJ(1, x),
      Math.sqrt(2 / (Math.PI * x)) * Math.cos(x - (3 * Math.PI) / 4),
      0.4 / x,
      `J1(${x})`,
    );
    // Aarts and Janssen's (2003) approximation of H₁, good to about 0.005
    const aartsJanssen =
      2 / Math.PI -
      besselJ(0, x) +
      (16 / Math.PI - 5) * (Math.sin(x) / x) +
      (12 - 36 / Math.PI) * ((1 - Math.cos(x)) / (x * x));
    near(struveH1(x), aartsJanssen, 0.006, `H1(${x})`);
  }
});

test("a baffled piston's radiation impedance has its textbook limits", () => {
  const area = 0.05;
  const radius = Math.sqrt(area / Math.PI);
  const planeWave = AIR_IMPEDANCE / area;
  const atKa = (ka: number) => (ka * SOUND_SPEED) / (2 * Math.PI * radius);
  // small ka: resistance (ρc/S)·(ka)²/2, reactance (ρc/S)·8ka/(3π)
  const small = 0.05;
  const low = pistonImpedance(area, atKa(small));
  near(low.re / (planeWave * (small ** 2 / 2)), 1, 0.01, "low-ka resistance");
  near(low.im / (planeWave * ((8 * small) / (3 * Math.PI))), 1, 0.01, "low-ka reactance");
  // large ka: the resistance tends to ρc/S
  near(pistonImpedance(area, atKa(30)).re / planeWave, 1, 0.02, "high-ka resistance");
  // images: a quarter-space mouth carries 2·Z(2S); two stacked mouths in half space the same
  const f = 120;
  nearComplex(
    mouthImpedance(area, f, 1, 1),
    mul(cx(2), pistonImpedance(2 * area, f)),
    1e-12,
    "quarter space",
  );
  nearComplex(mouthImpedance(area, f, 2, 2), mouthImpedance(area, f, 1, 1), 1e-12, "two boxes");
});

test("a straight duct's matrix is the plane-wave one", () => {
  // 100 cm² and 1 m long
  const duct: HornSegment = { profile: "con", s1: 100, s2: 100, length: 100 };
  const lengthM = 1,
    ductImpedance = AIR_IMPEDANCE / 0.01;
  for (const f of [20, 85.75, 300, 1234]) {
    const phase = waveNumberAt(f) * lengthM;
    const m = segmentMatrix(duct, f);
    nearComplex(m[0], cx(Math.cos(phase)), 1e-9, `A at ${f}`);
    nearComplex(m[1], cx(0, ductImpedance * Math.sin(phase)), 1e-9, `B at ${f}`);
    nearComplex(m[2], cx(0, Math.sin(phase) / ductImpedance), 1e-9, `C at ${f}`);
    nearComplex(m[3], cx(Math.cos(phase)), 1e-9, `D at ${f}`);
  }
  // closed at the far end it resonates at c/4L: the input impedance A/C passes through zero there
  const quarterWave = segmentMatrix(duct, SOUND_SPEED / (4 * lengthM));
  assert.ok(
    abs(div(quarterWave[0], quarterWave[2])) < 1e-6 * ductImpedance,
    "quarter-wave resonance",
  );
  // ended in its own impedance (no reflection), the flow comes out unchanged but delayed by L/c
  const ratio = outputFlowRatio(segmentMatrix(duct, 200), cx(ductImpedance));
  near(abs(ratio), 1, 1e-9, "matched duct: no loss");
  assert.ok(angleGap(arg(ratio), -waveNumberAt(200) * lengthM) < 1e-9, "matched duct: delay L/c");
});

/**
 * An exponential flare's forward-wave impedance at a section of area S (m²), flare rate m (1/m): what an endless horn
 * shows there, (ρc/S)·jk/(m/2 + jγ) with γ = √(k² − m²/4).
 */
const expForwardImpedance = (area: number, flareRate: number, f: number): Complex => {
  const k = waveNumberAt(f),
    squared = k * k - (flareRate * flareRate) / 4;
  const gamma = squared >= 0 ? cx(Math.sqrt(squared)) : cx(0, -Math.sqrt(-squared));
  return mul(cx(AIR_IMPEDANCE / area), div(cx(0, k), cx(flareRate / 2 - gamma.im, gamma.re)));
};
/** A conical flare's forward-wave (spherical-wave) impedance at area S (m²), x meters from the apex: (ρc/S)·jkx/(1 + jkx). */
const conForwardImpedance = (area: number, apexDistance: number, f: number): Complex => {
  const kx = waveNumberAt(f) * apexDistance;
  return mul(cx(AIR_IMPEDANCE / area), div(cx(0, kx), cx(1, kx)));
};

test("an exponential horn ended in its own forward wave shows the endless horn's throat impedance", () => {
  // 300 cm² to 4000 cm² over 47 cm
  const horn: HornSegment = { profile: "exp", s1: 300, s2: 4000, length: 47 };
  const throatArea = 0.03,
    mouthArea = 0.4;
  const flareRate = Math.log(mouthArea / throatArea) / 0.47;
  const cutoff = (flareRate * SOUND_SPEED) / (4 * Math.PI);
  for (const f of [0.5, 0.9, 1.1, 2, 8].map((r) => r * cutoff)) {
    const throat = inputImpedance(
      segmentMatrix(horn, f),
      expForwardImpedance(mouthArea, flareRate, f),
    );
    nearComplex(
      throat,
      expForwardImpedance(throatArea, flareRate, f),
      1e-8,
      `throat at ${f.toFixed(1)} Hz`,
    );
  }
  // above the cutoff the throat resistance is (ρc/S)·√(1 − (cutoff/f)²); below it there is none
  const above = expForwardImpedance(throatArea, flareRate, 2 * cutoff);
  near(above.re / (AIR_IMPEDANCE / throatArea), Math.sqrt(1 - 0.25), 1e-12, "above the cutoff");
  near(expForwardImpedance(throatArea, flareRate, 0.5 * cutoff).re, 0, 1e-9, "below the cutoff");
});

test("a conical horn ended in its own forward wave shows the spherical wave's impedance", () => {
  // 200 cm² to 1800 cm² over 60 cm; the radius grows linearly, so the apex sits L·r₁/(r₂ − r₁) before the throat
  const horn: HornSegment = { profile: "con", s1: 200, s2: 1800, length: 60 };
  const throatRadius = Math.sqrt(0.02),
    mouthRadius = Math.sqrt(0.18);
  const apexToThroat = (0.6 * throatRadius) / (mouthRadius - throatRadius);
  for (const f of [15, 60, 250, 1500]) {
    const throat = inputImpedance(
      segmentMatrix(horn, f),
      conForwardImpedance(0.18, apexToThroat + 0.6, f),
    );
    nearComplex(throat, conForwardImpedance(0.02, apexToThroat, f), 1e-8, `throat at ${f} Hz`);
  }
});

test("a lossless chain carries the same real power in and out", () => {
  const horn: HornSegment[] = [
    { profile: "con", s1: 250, s2: 500, length: 20 },
    { profile: "exp", s1: 500, s2: 3000, length: 45 },
    { profile: "con", s1: 3000, s2: 2500, length: 10 }, // a narrowing segment
  ];
  for (const f of [25, 90, 400, 1800]) {
    const m = chainMatrix(horn, f);
    // one unit of flow out of the mouth, into its radiation load: [p₁, U₁] = M·[p₂, U₂]
    const flowOut = cx(1),
      pressureOut = mul(mouthImpedance(0.25, f, 2, 1), flowOut);
    const pressureIn = add(mul(m[0], pressureOut), mul(m[1], flowOut)),
      flowIn = add(mul(m[2], pressureOut), mul(m[3], flowOut));
    // real power: Re(p·U*)
    const powerIn = pressureIn.re * flowIn.re + pressureIn.im * flowIn.im;
    const powerOut = pressureOut.re * flowOut.re + pressureOut.im * flowOut.im;
    near(powerIn / powerOut, 1, 1e-8, `power at ${f} Hz`);
  }
  // splitting a segment in two changes nothing
  const whole: HornSegment = { profile: "exp", s1: 400, s2: 3600, length: 60 };
  const middleArea = Math.sqrt(400 * 3600); // an exponential flare's area halfway along
  const halves: HornSegment[] = [
    { profile: "exp", s1: 400, s2: middleArea, length: 30 },
    { profile: "exp", s1: middleArea, s2: 3600, length: 30 },
  ];
  for (const f of [30, 300]) {
    const one = segmentMatrix(whole, f),
      two = chainMatrix(halves, f);
    for (let i = 0; i < 4; i++)
      nearComplex(two[i], one[i], 1e-9, `split flare, element ${i}, ${f} Hz`);
  }
});

/** The driver straight in its box: no horn, no throat chamber, half space. */
const directRadiator = (driver: HornDesign["driver"], rear: HornDesign["rear"]): HornDesign => ({
  driver,
  count: 1,
  throatChamber: 0,
  segments: [],
  rear,
  angle: 2,
  portOffset: 0,
});

test("with no horn and no radiation load it is the sealed box model", () => {
  const driver = DEFAULT_PA.mid.ts;
  const liters = 30,
    volts = 20;
  const sealed = closedBox(driver, liters, null, null, volts, {
    hpOrder: 4,
    lpOrder: 4,
    fmin: 20,
    fmax: 2000,
    N: 120,
    phase: true,
  });
  assert.ok(sealed);
  const freqs = sealed.curve.map((p) => p.f);
  const horn = hornModel(directRadiator(driver, { liters, port: null }), freqs, volts, {
    radiationLoad: false,
  });
  sealed.curve.forEach((box, i) => {
    const engine = horn.curve[i];
    const at = `at ${box.f.toFixed(1)} Hz`;
    near(engine.spl, box.raw, 1e-9, `SPL ${at}`);
    near(engine.xmm, box.xmm, 1e-9, `excursion ${at}`);
    assert.ok(angleGap(engine.phase, box.rawPhase ?? NaN) < 1e-9, `phase ${at}`);
  });
  assert.strictEqual(horn.fb, null);
});

test("with the radiation load on, a direct radiator still matches the box model low down", () => {
  // the air mass taken off the moving mass (8/3·ρa³) is the radiation reactance's mass at low ka: the two cancel there
  const design = directRadiator(DEFAULT_PA.mid.ts, { liters: 30, port: null });
  const freqs = [40, 70, 100, 150];
  const loaded = hornModel(design, freqs, 10),
    unloaded = hornModel(design, freqs, 10, { radiationLoad: false });
  loaded.curve.forEach((p, i) => near(p.spl, unloaded.curve[i].spl, 0.2, `SPL at ${p.f} Hz`));
});

test("with no horn and no radiation load it is the vented box model", () => {
  const driver = DEFAULT_PA.sub.ts;
  const liters = 180,
    ventSquareInches = 40,
    ventInches = 14,
    highpassHz = 31,
    volts = 50;
  const vented = boxModel(driver, liters, ventSquareInches, ventInches, highpassHz, volts, "BW24", {
    phase: true,
    N: 160,
  });
  assert.ok(vented);
  // the box model's effective vent length (m), end corrections included
  const { Leff: effectiveLength } = ventTuning(liters, ventSquareInches, ventInches);
  const port = {
    area: ventSquareInches * SQUARE_INCH_TO_CM2,
    effLength: effectiveLength * M_TO_CM,
  };
  const freqs = vented.curve.map((p) => p.f);
  const horn = hornModel(directRadiator(driver, { liters, port }), freqs, volts, {
    radiationLoad: false,
  });
  near(horn.fb ?? 0, vented.Fb, 1e-9, "tuning");
  vented.curve.forEach((box, i) => {
    const engine = horn.curve[i];
    // the box model's excursion and vent speed include its highpass; the engine's are before any filter
    const highpass = highpassGain(box.f, highpassHz, "BW24");
    const at = `at ${box.f.toFixed(1)} Hz`;
    near(engine.spl, box.raw, 1e-9, `SPL ${at}`);
    near(engine.xmm * highpass, box.xmm, 1e-9, `excursion ${at}`);
    near(engine.portVel * highpass, box.vel, 1e-9, `vent speed ${at}`);
    assert.ok(angleGap(engine.phase, box.rawPhase ?? NaN) < 1e-9, `phase ${at}`);
  });
});

test("boxes side by side add 6 dB each doubling, and load each other as one bigger mouth", () => {
  const freqs = [60, 120, 250];
  const one = directRadiator(DEFAULT_PA.mid.ts, { liters: 30, port: null });
  const single = hornModel(one, freqs, 10, { radiationLoad: false }),
    pair = hornModel({ ...one, count: 2 }, freqs, 10, { radiationLoad: false });
  single.curve.forEach((p, i) =>
    near(pair.curve[i].spl - p.spl, 20 * Math.log10(2), 1e-9, "no load"),
  );
  // two horns side by side in half space are one horn and its mirror image in a quarter space: same loads and level
  const horn: HornDesign = {
    ...one,
    segments: [{ profile: "exp", s1: 300, s2: 2000, length: 40 }],
  };
  const twoHorns = hornModel({ ...horn, count: 2 }, freqs, 10),
    hornAndImage = hornModel({ ...horn, angle: 1 }, freqs, 10);
  twoHorns.curve.forEach((p, i) => {
    near(p.spl, hornAndImage.curve[i].spl, 1e-9, `level at ${p.f} Hz`);
    near(p.xmm, hornAndImage.curve[i].xmm, 1e-12, `excursion at ${p.f} Hz`);
  });
});

test("a front-loaded horn out-plays the same driver direct in its band, with less excursion", () => {
  const driver = DEFAULT_PA.mid.ts;
  const rear = { liters: 25, port: null };
  const freqs = hornGrid(100, 1000, 60);
  // exponential, 300 cm² to 4000 cm² over 47 cm: a cutoff near 150 Hz
  const horn: HornDesign = {
    ...directRadiator(driver, rear),
    throatChamber: 0.5,
    segments: [{ profile: "exp", s1: 300, s2: 4000, length: 47 }],
  };
  const withHorn = hornModel(horn, freqs, 10).curve,
    without = hornModel(directRadiator(driver, rear), freqs, 10).curve;
  const bandAverage = (curve: HornPoint[]) => {
    const band = curve.filter((p) => p.f >= 300 && p.f <= 800);
    return band.reduce((sum, p) => sum + p.spl, 0) / band.length;
  };
  const gain = bandAverage(withHorn) - bandAverage(without);
  assert.ok(gain > 3, `horn gain ${gain} dB`);
  const nearest = (curve: HornPoint[], f: number) =>
    curve.reduce((best, p) => (Math.abs(p.f - f) < Math.abs(best.f - f) ? p : best));
  assert.ok(nearest(withHorn, 300).xmm < nearest(without, 300).xmm, "less excursion at 300 Hz");
  // the electrical impedance never drops below the voice coil's resistance
  assert.ok(withHorn.every((p) => p.ze >= driver.Re - 1e-9));
});
