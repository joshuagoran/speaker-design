import { test } from "vite-plus/test";
import assert from "node:assert";
import { ampForGain, onSlider, type AmpSteps } from "../src/lib/optimizer/ampSteps";
import { AMP_WATTS_MAX, AMP_WATTS_STEPS } from "../src/lib/pa/optimize";
import { HIFI_AMP_WATTS_MAX, HIFI_AMP_WATTS_STEPS } from "../src/lib/hifi/optimize";
import { keysOf } from "../src/lib/records";

const sub = AMP_WATTS_STEPS.ampW;

test("onSlider floors to the step and stops at the minimum", () => {
  assert.equal(onSlider(849.9, sub), 800);
  assert.equal(onSlider(850, sub), 850);
  assert.equal(onSlider(200, sub), 200);
  assert.equal(onSlider(199.9, sub), null);
});

test("ampForGain: a band moves 1 dB per dB of power, never past the dB asked", () => {
  // -3 dB is about half the power: 1000 W → 501 W, floored to 500
  assert.equal(ampForGain(1000, -3, sub), 500);
  assert.equal(ampForGain(1000, 0, sub), 1000);
  // 10 dB down from 1000 W is 100 W, under the sub slider's 200 W minimum
  assert.equal(ampForGain(1000, -10, sub), null);
  // whatever the gap, the power found moves the band at least that far down
  for (const db of [-0.3, -1, -2.7, -5.5])
    for (const w of [600, 1234, 3000]) {
      const got = ampForGain(w, db, sub);
      if (got !== null) assert.ok(10 * Math.log10(got / w) <= db + 1e-12, `${w} W ${db} dB`);
    }
});

const fitsTop = <K extends string>(steps: Record<K, AmpSteps>, max: Record<K, number>) => {
  for (const k of keysOf(steps)) {
    const { step, min } = steps[k];
    assert.ok(min > 0 && min < max[k], k);
    assert.equal((max[k] - min) % step, 0, `${k}: the top is on a step`);
    assert.equal(onSlider(max[k], steps[k]), max[k], k);
  }
};
test("each amp's step and minimum fit its slider's top", () => {
  fitsTop(AMP_WATTS_STEPS, AMP_WATTS_MAX);
  fitsTop(HIFI_AMP_WATTS_STEPS, HIFI_AMP_WATTS_MAX);
});
