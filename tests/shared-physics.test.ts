// The same physics in one calculation: the engines that model the same thing call one function and agree.
import { expect, test } from "vite-plus/test";
import { fillHfPadDb, hornPower, thermalVoltageLimit } from "../src/lib/acoustics/boxModels";
import { tweeterMaxLevel } from "../src/lib/speaker/twoWay";
import { programWatts, sensitivityAt283, wattsToVolts } from "../src/lib/power";
import { abs, complex, levelDb } from "../src/lib/acoustics/complex";
import { arrival } from "../src/lib/acoustics/coverage";
import { sourcePressure, sourcePressureFactor } from "../src/lib/acoustics/hornModel";
import { SPEED_OF_SOUND } from "../src/constants/acoustics";
import { FILL_OPTIONS } from "../src/lib/data";

/** An HF section both the PA horn model and the Hi-fi tweeter model can read. */
const HF = { sens: 108, aes: 60, aesXo: 1600, minXo: 1000, fs: null, imp: 16 };

test("a compression driver and a tweeter get the same program rating and derate at the same crossover", () => {
  for (const xo of [800, 1600, 3000]) {
    const horn = hornPower(HF, xo, 1000);
    const tweeter = tweeterMaxLevel({ hf: HF }, { xo, tAmpW: 1000 });
    expect(tweeter.derate).toBe(horn.derate);
    expect(tweeter.pProg).toBe(horn.pProg);
    expect(tweeter.pMax).toBe(horn.P);
  }
  expect(hornPower(HF, 800, 1000).derate).toBeCloseTo(0.25, 12);
  expect(thermalVoltageLimit(HF)).toBe(wattsToVolts(programWatts(HF.aes), HF));
});

test("a 1 W sensitivity moves to 2.83 V the same way for a fill's pad", () => {
  expect(sensitivityAt283(90, { imp: 4 })).toBeCloseTo(90 + 10 * Math.log10(2), 12);
  const fill = FILL_OPTIONS.find((d) => d.hf)?.hf;
  expect(fill).toBeTruthy();
  if (fill) expect(fillHfPadDb(fill, 80)).toBe(sensitivityAt283(fill.sens, fill) - 80);
});

test("a small source's pressure: the complex form's size is the factor the woofer box reads", () => {
  const omega = 2 * Math.PI * 100;
  const flow = complex(0.003, -0.001);
  expect(abs(sourcePressure(flow, omega, 2 * Math.PI, 2))).toBeCloseTo(
    sourcePressureFactor(omega, 2 * Math.PI, 2) * abs(flow),
    12,
  );
});

test("a path's arrival: 1/r against the reference and late by the extra path and the delay", () => {
  const p = complex(1, 0);
  expect(levelDb(arrival(p, 1000, 1, 2, 1, 0))).toBeCloseTo(-6.02, 2);
  // half a period late, by path or by delay, flips the sign the same way
  const halfPeriod = 0.5 / 1000;
  const byPath = arrival(p, 1000, 1, 1 + halfPeriod * SPEED_OF_SOUND, 1, 0);
  const byDelay = arrival(p, 1000, 1, 1, 1, halfPeriod);
  expect(byDelay.re).toBeCloseTo(-1, 12);
  expect(byPath.re / abs(byPath)).toBeCloseTo(-1, 12);
});
