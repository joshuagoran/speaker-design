// A dispersion map's beam width: the angle round on-axis that stays within a floor, at the frequency asked for.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { beamWidthDeg } from "../src/lib/speaker/stackDispersion";

const angles = [-90, -60, -30, 0, 30, 60, 90];
const freqs = [100, 1000, 2000];
/** a map whose level falls 4 dB each 30° at 2 kHz, and stays flat at the lower frequencies */
const map = {
  angles,
  freqs,
  rows: angles.map((a) => [0, 0, (-Math.abs(a) / 30) * 4]),
};

test("beam width: the angles within the floor at the nearest frequency", () => {
  // −4 dB at ±30°, −8 dB at ±60°: within −6 dB from −30° to +30°
  assert.strictEqual(beamWidthDeg(map, 2000, -6), 60);
  // 1.9 kHz reads the 2 kHz column
  assert.strictEqual(beamWidthDeg(map, 1900, -6), 60);
  // flat at 100 Hz: the whole ±90°
  assert.strictEqual(beamWidthDeg(map, 100, -6), 180);
});
