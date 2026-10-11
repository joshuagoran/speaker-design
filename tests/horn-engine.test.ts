// The horn engine (lib/acoustics) against references that need no Hornresp: power series for the special functions,
// the textbook solutions for ducts and flares, power conservation, and the planner's own box models, which the engine
// must reproduce when it has no horn.
//
// Words used below: "flow" is volume velocity (m³/s); "impedance" is acoustic impedance (Pa·s/m³); k is the wave
// number 2πf/c; ka compares a piston's radius a with the wavelength; ρc/S is a plane wave's impedance across area S.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { besselJ, struveH1 } from "../src/lib/acoustics/bessel";
import {
  FLANGED_CIRCLE_END_RATIO,
  mouthImpedance,
  pistonImpedance,
  rectangleEndCorrection,
} from "../src/lib/acoustics/radiation";
import {
  segmentMatrix,
  chainMatrix,
  inputImpedance,
  outputFlowRatio,
} from "../src/lib/acoustics/hornSegments";
import { hornModel, hornGrid, hornFrontImpedance } from "../src/lib/acoustics/hornModel";
import { abs, add, arg, complex, divide, multiply, subtract } from "../src/lib/acoustics/complex";
import { AIR_DENSITY, SPEED_OF_SOUND } from "../src/constants/acoustics";
import { HORN_PROFILE } from "../src/constants/hornEngine";
import { boxModel, closedBox, highpassGain, ventTuning } from "../src/lib/pa/calc";
import { DEFAULT_PA } from "../src/lib/defaults";
import { GRAMS_PER_KG, SQ_CM_PER_SQ_M } from "../src/constants/units";
import type { Complex, HornDesign, HornModel, HornPoint, HornSegment } from "../src/types";

/** ρc: air's characteristic impedance, Pa·s/m (a plane wave's pressure over its particle speed). */
const AIR_IMPEDANCE = AIR_DENSITY * SPEED_OF_SOUND;
const SQUARE_INCH_TO_CM2 = 6.4516,
  M_TO_CM = 100;
const waveNumberAt = (f: number) => (2 * Math.PI * f) / SPEED_OF_SOUND;
/**
 * A driver with its voice coil's inductance off, for checks whose reference leaves the coil out (the piston formulas,
 * a bank built by hand).
 */
const noInductance = (ts: HornDesign["driver"]): HornDesign["driver"] => ({ ...ts, Le: 0 });
/** The inductances the checks against the box models run with, mH: none, and a coil like a 12″ mid's. */
const BOX_MODEL_INDUCTANCES = [0, 1.5];

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
    abs(subtract(actual, expected)) <= relTolerance * Math.max(abs(expected), 1e-12),
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
  const atKa = (ka: number) => (ka * SPEED_OF_SOUND) / (2 * Math.PI * radius);
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
    multiply(complex(2), pistonImpedance(2 * area, f)),
    1e-12,
    "quarter space",
  );
  nearComplex(mouthImpedance(area, f, 2, 2), mouthImpedance(area, f, 1, 1), 1e-12, "two boxes");
});

test("a straight duct's matrix is the plane-wave one", () => {
  // 100 cm² and 1 m long
  const duct: HornSegment = { profile: HORN_PROFILE.conical, s1: 100, s2: 100, length: 100 };
  const lengthM = 1,
    ductImpedance = AIR_IMPEDANCE / 0.01;
  for (const f of [20, 85.75, 300, 1234]) {
    const phase = waveNumberAt(f) * lengthM;
    const m = segmentMatrix(duct, f);
    nearComplex(m[0], complex(Math.cos(phase)), 1e-9, `A at ${f}`);
    nearComplex(m[1], complex(0, ductImpedance * Math.sin(phase)), 1e-9, `B at ${f}`);
    nearComplex(m[2], complex(0, Math.sin(phase) / ductImpedance), 1e-9, `C at ${f}`);
    nearComplex(m[3], complex(Math.cos(phase)), 1e-9, `D at ${f}`);
  }
  // closed at the far end it resonates at c/4L: the input impedance A/C passes through zero there
  const quarterWave = segmentMatrix(duct, SPEED_OF_SOUND / (4 * lengthM));
  assert.ok(
    abs(divide(quarterWave[0], quarterWave[2])) < 1e-6 * ductImpedance,
    "quarter-wave resonance",
  );
  // ended in its own impedance (no reflection), the flow comes out unchanged but delayed by L/c
  const ratio = outputFlowRatio(segmentMatrix(duct, 200), complex(ductImpedance));
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
  const gamma = squared >= 0 ? complex(Math.sqrt(squared)) : complex(0, -Math.sqrt(-squared));
  return multiply(
    complex(AIR_IMPEDANCE / area),
    divide(complex(0, k), complex(flareRate / 2 - gamma.im, gamma.re)),
  );
};
/** A conical flare's forward-wave (spherical-wave) impedance at area S (m²), x meters from the apex: (ρc/S)·jkx/(1 + jkx). */
const conForwardImpedance = (area: number, apexDistance: number, f: number): Complex => {
  const kx = waveNumberAt(f) * apexDistance;
  return multiply(complex(AIR_IMPEDANCE / area), divide(complex(0, kx), complex(1, kx)));
};

test("an exponential horn ended in its own forward wave shows the endless horn's throat impedance", () => {
  // 300 cm² to 4000 cm² over 47 cm
  const horn: HornSegment = { profile: HORN_PROFILE.exponential, s1: 300, s2: 4000, length: 47 };
  const throatArea = 0.03,
    mouthArea = 0.4;
  const flareRate = Math.log(mouthArea / throatArea) / 0.47;
  const cutoff = (flareRate * SPEED_OF_SOUND) / (4 * Math.PI);
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

test("an exponential horn stays exact at its cutoff, where the two travelling waves merge", () => {
  const horn: HornSegment = { profile: HORN_PROFILE.exponential, s1: 300, s2: 4000, length: 47 };
  const throatArea = 0.03,
    mouthArea = 0.4;
  const flareRate = Math.log(mouthArea / throatArea) / 0.47;
  const cutoff = (flareRate * SPEED_OF_SOUND) / (4 * Math.PI);
  for (const f of [cutoff, cutoff * (1 + 1e-9), cutoff * (1 - 1e-9)]) {
    const m = segmentMatrix(horn, f);
    assert.ok(
      m.every((z) => Number.isFinite(z.re) && Number.isFinite(z.im)),
      `finite at ${f} Hz`,
    );
    const throat = inputImpedance(m, expForwardImpedance(mouthArea, flareRate, f));
    nearComplex(throat, expForwardImpedance(throatArea, flareRate, f), 1e-6, `throat at ${f} Hz`);
  }
  // at the cutoff the endless horn's throat is a pure mass: j·ρc/S
  nearComplex(
    expForwardImpedance(throatArea, flareRate, cutoff),
    complex(0, AIR_IMPEDANCE / throatArea),
    1e-12,
    "pure reactance at the cutoff",
  );
});

test("a conical horn ended in its own forward wave shows the spherical wave's impedance", () => {
  // 200 cm² to 1800 cm² over 60 cm; the radius grows linearly, so the apex sits L·r₁/(r₂ − r₁) before the throat
  const horn: HornSegment = { profile: HORN_PROFILE.conical, s1: 200, s2: 1800, length: 60 };
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
    { profile: HORN_PROFILE.conical, s1: 250, s2: 500, length: 20 },
    { profile: HORN_PROFILE.exponential, s1: 500, s2: 3000, length: 45 },
    { profile: HORN_PROFILE.conical, s1: 3000, s2: 2500, length: 10 }, // a narrowing segment
  ];
  for (const f of [25, 90, 400, 1800]) {
    const m = chainMatrix(horn, f);
    // one unit of flow out of the mouth, into its radiation load: [p₁, U₁] = M·[p₂, U₂]
    const flowOut = complex(1),
      pressureOut = multiply(mouthImpedance(0.25, f, 2, 1), flowOut);
    const pressureIn = add(multiply(m[0], pressureOut), multiply(m[1], flowOut)),
      flowIn = add(multiply(m[2], pressureOut), multiply(m[3], flowOut));
    // real power: Re(p·U*)
    const powerIn = pressureIn.re * flowIn.re + pressureIn.im * flowIn.im;
    const powerOut = pressureOut.re * flowOut.re + pressureOut.im * flowOut.im;
    near(powerIn / powerOut, 1, 1e-8, `power at ${f} Hz`);
  }
  // splitting a segment in two changes nothing
  const whole: HornSegment = { profile: HORN_PROFILE.exponential, s1: 400, s2: 3600, length: 60 };
  const middleArea = Math.sqrt(400 * 3600); // an exponential flare's area halfway along
  const halves: HornSegment[] = [
    { profile: HORN_PROFILE.exponential, s1: 400, s2: middleArea, length: 30 },
    { profile: HORN_PROFILE.exponential, s1: middleArea, s2: 3600, length: 30 },
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
  drivers: 1,
  count: 1,
  throatChamber: 0,
  segments: [],
  rear,
  angle: 2,
  portOffset: 0,
});

/** The model's result, which must exist for a valid design. */
const modelOf = (...args: Parameters<typeof hornModel>): HornModel => {
  const result = hornModel(...args);
  assert.ok(result, "the design should be modelable");
  return result;
};

test("with no horn and no radiation load it is the sealed box model, the coil's inductance included", () => {
  for (const Le of BOX_MODEL_INDUCTANCES) sealedMatches({ ...DEFAULT_PA.mid.ts, Le });
});

/** The engine with no horn and no radiation load against closedBox, for one driver. */
function sealedMatches(driver: HornDesign["driver"]) {
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
  const horn = modelOf(directRadiator(driver, { liters, port: null }), freqs, volts, {
    radiationLoad: false,
  });
  sealed.curve.forEach((box, i) => {
    const engine = horn.curve[i];
    const at = `at ${box.f.toFixed(1)} Hz`;
    near(engine.spl, box.raw, 1e-9, `SPL ${at}`);
    near(engine.xmm, box.xmm, 1e-9, `excursion ${at}`);
    near(engine.phase, box.rawPhase ?? NaN, 1e-9, `phase ${at}`);
  });
  assert.strictEqual(horn.fb, null);
}

test("with the radiation load on, a direct radiator still matches the box model low down", () => {
  // the air mass taken off the moving mass (8/3·ρa³) is the radiation reactance's mass at low ka: the two cancel there
  const design = directRadiator(noInductance(DEFAULT_PA.mid.ts), { liters: 30, port: null });
  const freqs = [40, 70, 100, 150];
  const loaded = modelOf(design, freqs, 10),
    unloaded = modelOf(design, freqs, 10, { radiationLoad: false });
  loaded.curve.forEach((p, i) => near(p.spl, unloaded.curve[i].spl, 0.2, `SPL at ${p.f} Hz`));
});

test("with no horn and no radiation load it is the vented box model, the coil's inductance included", () => {
  for (const Le of BOX_MODEL_INDUCTANCES) ventedMatches({ ...DEFAULT_PA.sub.ts, Le });
});

/** The engine with no horn and no radiation load against boxModel, for one driver. */
function ventedMatches(driver: HornDesign["driver"]) {
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
  // the box model's effective vent length (m), both end corrections included: with the radiation load off the vent is
  // lumped, and nothing adds the outer end's
  const { Leff: effectiveLength } = ventTuning(liters, ventSquareInches, ventInches);
  const port = {
    area: ventSquareInches * SQUARE_INCH_TO_CM2,
    length: effectiveLength * M_TO_CM,
  };
  const freqs = vented.curve.map((p) => p.f);
  const horn = modelOf(directRadiator(driver, { liters, port }), freqs, volts, {
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
    near(engine.portSpeed * highpass, box.vel, 1e-9, `vent speed ${at}`);
    near(engine.phase, box.rawPhase ?? NaN, 1e-9, `phase ${at}`);
  });
}

test("boxes side by side add 6 dB each doubling, and their mouths load each other", () => {
  const freqs = [60, 120, 250];
  const one = directRadiator(noInductance(DEFAULT_PA.mid.ts), { liters: 30, port: null });
  const single = modelOf(one, freqs, 10, { radiationLoad: false }),
    pair = modelOf({ ...one, count: 2 }, freqs, 10, { radiationLoad: false });
  single.curve.forEach((p, i) =>
    near(pair.curve[i].spl - p.spl, 20 * Math.log10(2), 1e-9, "no load"),
  );
  // mutual coupling, checked against the piston formula alone: at low ka a piston's radiation resistance is
  // ρck²/(2π), whatever its area, so each of two touching mouths carries twice the resistance it has alone
  const area = 0.2,
    f = 30;
  const alone = pistonImpedance(area, f).re,
    besideAnother = mouthImpedance(area, f, 2, 2).re;
  near(alone / ((AIR_IMPEDANCE * waveNumberAt(f) ** 2) / (2 * Math.PI)), 1, 0.01, "one mouth");
  near(besideAnother / alone, 2, 0.02, "two touching mouths");
});

test("a front-loaded horn out-plays the same driver direct in its band, with less excursion", () => {
  const driver = noInductance(DEFAULT_PA.mid.ts);
  const rear = { liters: 25, port: null };
  const freqs = hornGrid(100, 1000, 60);
  // exponential, 300 cm² to 4000 cm² over 47 cm: a cutoff near 150 Hz
  const horn: HornDesign = {
    ...directRadiator(driver, rear),
    throatChamber: 0.5,
    segments: [{ profile: HORN_PROFILE.exponential, s1: 300, s2: 4000, length: 47 }],
  };
  const withHorn = modelOf(horn, freqs, 10).curve,
    without = modelOf(directRadiator(driver, rear), freqs, 10).curve;
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

test("the front load is the throat chamber in parallel with the horn's input", () => {
  const driver = noInductance(DEFAULT_PA.mid.ts);
  const f = 400,
    omega = 2 * Math.PI * f;
  // no horn, no chamber: the cone sees the mouth's (here its own) radiation load
  const bare = directRadiator(driver, { liters: 30, port: null });
  nearComplex(
    hornFrontImpedance(bare, f),
    mouthImpedance(driver.Sd / 10_000, f, 2, 1),
    1e-12,
    "bare cone",
  );
  // a 1 L throat chamber: 1/(jωC + 1/Zhorn), with C = V/(ρc²)
  const horn: HornDesign = {
    ...bare,
    segments: [{ profile: HORN_PROFILE.exponential, s1: 300, s2: 3000, length: 40 }],
  };
  const hornInput = hornFrontImpedance(horn, f);
  const chamberCompliance = 0.001 / (AIR_IMPEDANCE * SPEED_OF_SOUND);
  const expected = divide(
    complex(1),
    add(complex(0, omega * chamberCompliance), divide(complex(1), hornInput)),
  );
  nearComplex(hornFrontImpedance({ ...horn, throatChamber: 1 }, f), expected, 1e-9, "chamber");
});

test("a design with a zero size is not modeled", () => {
  const good = directRadiator(noInductance(DEFAULT_PA.mid.ts), { liters: 30, port: null });
  const freqs = [100];
  assert.ok(hornModel(good, freqs, 10));
  assert.strictEqual(hornModel({ ...good, rear: { liters: 0, port: null } }, freqs, 10), null);
  assert.strictEqual(
    hornModel({ ...good, rear: { liters: 30, port: { area: 0, length: 20 } } }, freqs, 10),
    null,
  );
  assert.strictEqual(
    hornModel(
      { ...good, segments: [{ profile: HORN_PROFILE.conical, s1: 0, s2: 100, length: 10 }] },
      freqs,
      10,
    ),
    null,
  );
  assert.strictEqual(hornModel({ ...good, count: 0 }, freqs, 10), null);
  assert.strictEqual(hornModel(good, [0], 10), null);
});

test("two drivers on one throat are one driver of twice the cone, each cone with its own air load", () => {
  // the same bank as one driver: twice the area and half the coil, its moving mass set so that, with one air load
  // of the doubled area taken off, it keeps two single cones' masses less their two air loads; its suspension and
  // losses scaled to keep the cones' own (half the compliance's acoustic share, half the resistance)
  const ts = noInductance(DEFAULT_PA.sub.ts);
  /** one side's air load on a piston of `cm2` cm², kg */
  const airLoad = (cm2: number) =>
    (8 / 3) * AIR_DENSITY * Math.pow(cm2 / SQ_CM_PER_SQ_M / Math.PI, 1.5);
  const mms = ts.Mms / GRAMS_PER_KG;
  const bankMms = 2 * (mms - airLoad(ts.Sd)) + airLoad(2 * ts.Sd);
  /** one cone's suspension compliance, m/N; the bank's is half */
  const cms = 1 / (Math.pow(2 * Math.PI * ts.Fs, 2) * mms);
  const bankFs = 1 / (2 * Math.PI * Math.sqrt(bankMms * (cms / 2)));
  // Rms = 2πFs·Mms/Qms per cone, and twice that for the bank
  const bankQms = (bankFs * bankMms) / (2 * ((ts.Fs * mms) / ts.Qms));
  const rear = { liters: 200, port: { area: 600, length: 40 } };
  const horn: HornDesign = {
    ...directRadiator(ts, rear),
    segments: [{ profile: HORN_PROFILE.exponential, s1: 2400, s2: 8000, length: 80 }],
    portOffset: 20,
  };
  const freqs = hornGrid(20, 500, 40);
  const pair = modelOf({ ...horn, drivers: 2 }, freqs, 10).curve;
  const asOne = modelOf(
    {
      ...horn,
      driver: {
        ...ts,
        Sd: 2 * ts.Sd,
        Re: ts.Re / 2,
        Mms: bankMms * GRAMS_PER_KG,
        Fs: bankFs,
        Qms: bankQms,
      },
    },
    freqs,
    10,
  ).curve;
  for (let i = 0; i < freqs.length; i++) {
    assert.ok(Math.abs(pair[i].spl - asOne[i].spl) < 1e-9, `SPL at ${freqs[i]} Hz`);
    assert.ok(Math.abs(pair[i].xmm - asOne[i].xmm) < 1e-9, `excursion at ${freqs[i]} Hz`);
    // one voice coil of the pair: twice the pair's load in parallel
    assert.ok(Math.abs(pair[i].ze - 2 * asOne[i].ze) < 1e-9, `impedance at ${freqs[i]} Hz`);
  }
  assert.strictEqual(hornModel({ ...horn, drivers: 0 }, freqs, 10), null);
  assert.strictEqual(hornModel({ ...horn, drivers: 1.5 }, freqs, 10), null);
});

test("a vent tunes where its duct, end-corrected at the exit, cancels the chamber: round and slot exits", () => {
  // A duct of length L and area S, open into an exit of end correction Δ, on a chamber of volume V: the reactances
  // cancel where k·tan(k·(L + Δ)) = S/V (the duct's own air, a transmission line). The exit's radiation resistance
  // is tiny at a vent's tuning, so this holds to a fraction of a percent.
  const liters = 162,
    length = 60;
  /** the tuning that root gives, Hz, by bisection below the duct's quarter wave */
  const ductTuning = (areaCm2: number, endCorrectionCm: number) => {
    const ratio = areaCm2 / SQ_CM_PER_SQ_M / (liters / 1000),
      acoustic = (length + endCorrectionCm) / 100;
    let below = 1,
      above = SPEED_OF_SOUND / (4 * acoustic) - 1e-6;
    for (let i = 0; i < 80; i++) {
      const middle = (below + above) / 2,
        k = waveNumberAt(middle);
      if (k * Math.tan(k * acoustic) < ratio) below = middle;
      else above = middle;
    }
    return below;
  };
  const tuningOf = (port: NonNullable<HornDesign["rear"]["port"]>) =>
    modelOf(directRadiator(DEFAULT_PA.sub.ts, { liters, port }), [50], 1).fb ?? 0;
  // a round exit of 600 cm²: Δ = 8/(3π)·r
  const roundArea = 600;
  const roundCorrection = FLANGED_CIRCLE_END_RATIO * Math.sqrt(roundArea / Math.PI);
  const round = tuningOf({ area: roundArea, length });
  near(round / ductTuning(roundArea, roundCorrection), 1, 0.005, "round exit");
  // two 6.5 × 46 cm slots, the same 598 cm²: each opening's rectangle sets Δ, much less than the round exit's
  const slot = { width: 6.5, height: 46 };
  const slotArea = 2 * slot.width * slot.height;
  const slotCorrection = rectangleEndCorrection(slot.width, slot.height);
  assert.ok(slotCorrection < roundCorrection, "a thin slot's exit has a smaller end correction");
  const slotted = tuningOf({ area: slotArea, length, slot });
  near(slotted / ductTuning(slotArea, slotCorrection), 1, 0.005, "slot exit");
  assert.ok(slotted > round, "the slot tunes higher than a round vent of the same area and length");
});

test("a driver with a negative or non-finite inductance is not modeled", () => {
  const good = directRadiator(noInductance(DEFAULT_PA.mid.ts), { liters: 30, port: null });
  const freqs = hornGrid(20, 200, 10);
  assert.ok(hornModel({ ...good, driver: { ...good.driver, Le: 0.5 } }, freqs, 10));
  for (const Le of [-0.1, Number.NaN, Infinity])
    assert.strictEqual(
      hornModel({ ...good, driver: { ...good.driver, Le } }, freqs, 10),
      null,
      `Le ${Le}`,
    );
});
