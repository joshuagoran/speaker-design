import { test } from "vite-plus/test";
import assert from "node:assert";
import { dispersionGrid, logSpacedFrequencies } from "../src/lib/acoustics/directivity";
import {
  CONTOUR_STEP_DB,
  DISPERSION_ANGLE_MAX_DEG,
  DISPERSION_ANGLE_STEP_DEG,
  DISPERSION_FREQ_POINTS,
  DISPERSION_FREQ_MAX_HZ,
  DISPERSION_FREQ_MIN_HZ,
} from "../src/constants/chartScales";
import { DISPERSION_SCALE, dispersionColor, dispersionRgb } from "../src/styles/palette";
import type { HifiDispersionMap } from "../src/types";

const ANGLES = Array.from(
  { length: (2 * DISPERSION_ANGLE_MAX_DEG) / DISPERSION_ANGLE_STEP_DEG + 1 },
  (_, i) => -90 + i * DISPERSION_ANGLE_STEP_DEG,
);
const FREQS = logSpacedFrequencies(
  DISPERSION_FREQ_MIN_HZ,
  DISPERSION_FREQ_MAX_HZ,
  DISPERSION_FREQ_POINTS,
);

const onGrid = (name: string, m: HifiDispersionMap) => {
  assert.strictEqual(DISPERSION_ANGLE_MAX_DEG, 90);
  assert.strictEqual(DISPERSION_ANGLE_STEP_DEG, 5);
  assert.deepStrictEqual(m.angles, ANGLES, `${name}: angles −90..90 every 5°`);
  assert.deepStrictEqual(m.freqs, FREQS, `${name}: the shared frequency grid`);
  assert.strictEqual(m.freqs[0], 50, `${name}: from 50 Hz`);
  assert.ok(Math.abs(m.freqs[m.freqs.length - 1] - 20000) < 1e-6, `${name}: to 20 kHz`);
  assert.strictEqual(m.rows.length, m.angles.length, `${name}: a row per angle`);
  for (const r of m.rows) {
    assert.strictEqual(r.length, m.freqs.length, `${name}: a value per frequency`);
    assert.ok(r.every(Number.isFinite), `${name}: finite levels`);
  }
};

test("dispersion grid: −90..90° at the shared step on the 50 Hz-20 kHz axis", () => {
  onGrid("grid", {
    ...dispersionGrid(),
    rows: ANGLES.map(() => FREQS.map(() => 0)),
    crossovers: [],
  });
});

test("dispersion color: hits its stops and clamps outside +6..−36 dB", () => {
  assert.deepStrictEqual(dispersionRgb(0), [255, 26, 0], "0 dB is red");
  assert.deepStrictEqual(dispersionRgb(-36), [0, 0, 0], "−36 dB is black");
  assert.deepStrictEqual(dispersionRgb(6), [255, 255, 255], "+6 dB is white");
  for (const [db, hex] of DISPERSION_SCALE.stops) {
    const n = parseInt(hex.slice(1), 16);
    assert.deepStrictEqual(dispersionRgb(db), [n >> 16, (n >> 8) & 255, n & 255], `${db} dB stop`);
  }
  assert.deepStrictEqual(dispersionRgb(-80), dispersionRgb(-36), "clamped below");
  assert.deepStrictEqual(dispersionRgb(20), dispersionRgb(6), "clamped above");
  // halfway between two stops is halfway between their colors
  assert.deepStrictEqual(dispersionRgb(-35), [27, 0, 27]);
  assert.strictEqual(dispersionColor(0), "rgb(255,26,0)");
  assert.strictEqual(dispersionColor(6, 0.5), "rgb(128,128,128)");
  assert.deepStrictEqual(
    [DISPERSION_SCALE.topDb, DISPERSION_SCALE.botDb, CONTOUR_STEP_DB],
    [6, -36, 3],
  );
});
