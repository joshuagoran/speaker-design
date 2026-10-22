// The same physics in one calculation: the engines that model the same thing call one function and agree.
import { expect, test } from "vite-plus/test";
import { fillHfPadDb, hornPower, thermalVoltageLimit } from "../src/lib/acoustics/boxModels";
import { tweeterMaxLevel } from "../src/lib/speaker/twoWay";
import { programWatts, sensitivityAt283, wattsToVolts } from "../src/lib/power";
import { abs, complex, levelDb } from "../src/lib/acoustics/complex";
import { arrival } from "../src/lib/acoustics/coverage";
import { sourcePressure, sourcePressureFactor } from "../src/lib/acoustics/hornModel";
import { SPEED_OF_SOUND } from "../src/constants/acoustics";
import { FILL_OPTIONS, HIFI_PASSIVES, MID_OPTIONS } from "../src/lib/data";
import { passiveRadiatorBox } from "../src/lib/acoustics/wooferBox";
import { filterTransfer } from "../src/lib/speaker/bandFilter";
import { speakerLimits } from "../src/lib/speaker/speakerLimits";
import { speakerResponse } from "../src/lib/speaker/speakerResponse";
import { SPEAKER_OPTIMIZER_CATALOG, searchUnits, topAmps } from "../src/lib/speaker/optimize/space";
import { templateSpeaker } from "../src/pages/speaker/speakerTemplates";
import { SPEAKER_TEMPLATE } from "../src/constants/speakerStarts";
import { SPEAKER_STEPS } from "../src/constants/speakerSteps";
import type { DriverRef, SpeakerSpec } from "../src/types";

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

test("the Hi-fi box's subsonic is the band filter's highpass", () => {
  const ts = MID_OPTIONS[0].ts;
  const box = passiveRadiatorBox(
    ts,
    40,
    { drv: HIFI_PASSIVES[0], n: 1, addG: 0 },
    30,
    2.83,
    "LR24",
  );
  expect(box).toBeTruthy();
  for (const o of box?.curve ?? [])
    expect(o.spl - o.raw).toBeCloseTo(
      20 * Math.log10(abs(filterTransfer(o.f, { hz: 30, type: "LR24" }, "highpass"))),
      9,
    );
});

test("the optimizer's top HF amp follows the derated program rating the limits read", () => {
  const spec = templateSpeaker(SPEAKER_TEMPLATE.paMidHighBox);
  const limits = speakerLimits(spec, speakerResponse(spec));
  const [hf] = limits.drivers;
  expect(hf).toBeTruthy();
  if (!hf) return;
  // crossed below its rating's frequency, the limits derate it
  const low: SpeakerSpec = {
    ...spec,
    bands: spec.bands.map((b) =>
      b.id === hf.band && b.highpass ? { ...b, highpass: { ...b.highpass, hz: 500 } } : b,
    ),
  };
  const lowHf = speakerLimits(low, speakerResponse(low)).drivers[0];
  expect(lowHf?.derate).toBeLessThan(1);
  const refs = low.cabinet.chambers.flatMap((c, k) =>
    c.drivers.map((_, j): DriverRef => `${k}.${j}`),
  );
  const units = searchUnits(low, { drivers: refs }, SPEAKER_OPTIMIZER_CATALOG);
  // with no amp of its own, the top amp is the rating's
  const noAmp = { ...low, bands: low.bands.map((b) => (b.id === hf.band ? { ...b, ampW: 0 } : b)) };
  const amps = topAmps(noAmp, units, [[hf.band]]);
  const step = SPEAKER_STEPS.ampW;
  expect(amps.get(hf.band)).toBe(Math.ceil((2 * (lowHf?.programW ?? 0)) / step) * step);
});
