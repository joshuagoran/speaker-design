// The Fill speaker template's passive network: its HF band is padded down to the woofer (lib/pa/calc fillHfPadDb), the
// one pad the Fills page's HF limit reads.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { fillHfPadDb, fillSystem } from "../src/lib/pa/calc";
import { layersFromFill } from "../src/lib/speaker/fillSpec";
import { speakerResponse } from "../src/lib/speaker/speakerResponse";
import { SPEAKER_BAND } from "../src/constants/speakerSpec";
import { DEFAULT_FILL } from "../src/lib/defaults";
import { FILL_OPTIONS } from "../src/lib/data";
import { ohmsOf } from "../src/lib/power";

const identity = { id: "fill", name: "Fill" };

/** the mean level of a curve between two frequencies, dB */
const meanDb = (curve: readonly { f: number; spl: number }[], lo: number, hi: number): number => {
  const inside = curve.filter((o) => o.f >= lo && o.f <= hi);
  return inside.reduce((sum, o) => sum + o.spl, 0) / inside.length;
};

test("fill template: the HF band carries the pad the Fills page uses", () => {
  for (const driver of FILL_OPTIONS) {
    if (!driver.hf) continue;
    const state = { ...DEFAULT_FILL, driver };
    const [spec] = layersFromFill(state, identity).speakers;
    const high = spec.bands.find((b) => b.id === SPEAKER_BAND.high);
    const pad = fillHfPadDb(driver.hf, driver.lfSens);
    assert.equal(high?.levelDb, -pad, driver.name);
    // the Fills page's own number, as it was before the function was shared: the HF's sensitivity at 2.83 V less the woofer's
    const before = Math.max(
      0,
      driver.hf.sens + 10 * Math.log10(8 / ohmsOf(driver.hf)) - driver.lfSens,
    );
    assert.ok(Math.abs(pad - before) < 1e-12, driver.name);
    const page = fillSystem(driver, {
      boxType: state.boxType,
      dim: state.boxDims,
      port: state.portSpec,
      hp: state.highpassHz,
      hpOrder: state.highpassOrder,
      ampW: state.ampWatts,
      portMax: state.maxPortAirSpeedMs,
    });
    if (page) assert.equal(page.pad, pad, driver.name);
  }
});

test("fill template: above the crossover the default coaxial plays within 1 dB of its woofer below it", () => {
  const { driver } = DEFAULT_FILL;
  const xo = driver.hf?.xo;
  assert.ok(xo);
  const [spec] = layersFromFill(DEFAULT_FILL, identity).speakers;
  const response = speakerResponse(spec);
  const low = response.bands.find((b) => b.id === SPEAKER_BAND.low);
  assert.ok(low);
  const woofer = meanDb(low.curve, 200, xo / 2);
  const high = meanDb(response.sum, xo * 2, xo * 4);
  assert.ok(
    Math.abs(high - woofer) < 1,
    `HF ${high.toFixed(2)} dB, woofer ${woofer.toFixed(2)} dB`,
  );
});
