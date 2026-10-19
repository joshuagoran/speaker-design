// The maximum-output layer (lib/pa/calc sineLimitAt) against a maximum built from Hornresp 60.60's own results, for
// three cases: th18-xoc1 (tools/hornresp/records, a published tapped horn), sub-bin-vented and sub-direct-vented
// (tests/hornresp). Each case's record runs on the network engine (lib/acoustics/network) at an amp's voltage, and the
// limit function sets its maximum; the reference reads only Hornresp's exported curves and the driver's datasheet.
//
// The reference maximum at each frequency is the lower of two levels:
// - Amp-limited: Hornresp's SPL at the record's Eg, moved to the amp's voltage (lib/power) by 20·log10(V / Eg).
// - Xmax-limited: Hornresp's SPL plus 20·log10(Xmax / Xd), Xd its excursion at Eg.
// The comparison follows tests/hornresp.test.ts: Hornresp's SPL is the power response (the engine's powerSpl). It
// leaves out the vent's air speed (Hornresp exports none) and stays below the program rating (no case's amp meets it).
import { test } from "vite-plus/test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { readHornrespRecord } from "../src/lib/acoustics/network/hornrespRecord";
import { presetModel } from "../src/lib/acoustics/network/presets";
import { sineLimitAt } from "../src/lib/pa/calc";
import { wattsToVolts } from "../src/lib/power";
import { SPEAKER_SUB_OPTIONS, SUB_OPTIONS } from "../src/lib/data";
import { LIMIT_NAMES } from "../src/constants/limits";
import type { LimitId } from "../src/types";
import { HORNRESP_DIR, resultsOf } from "./hornresp-records";

/** The folder of the published reference records (tools/hornresp/records). */
const REFERENCE_DIR = path.join(import.meta.dirname, "..", "tools", "hornresp", "records");
/**
 * Each case: its record's folder, and the catalog driver whose Xmax, program rating and impedance set the limits (the
 * record's own driver, or the one its box was drawn for).
 */
const CASES = [
  { name: "th18-xoc1", dir: REFERENCE_DIR, driverId: "pd18503" },
  { name: "sub-bin-vented", dir: HORNRESP_DIR, driverId: "bc18nbx" },
  { name: "sub-direct-vented", dir: HORNRESP_DIR, driverId: "bc18nbx" },
] as const;
/** The amp powers the check runs at, W: at each, the amp sets part of the band and Xmax the rest. */
const AMP_WATTS = [800, 1500];
/** The band the check covers, Hz: a sub's. */
const BAND_HZ = { low: 20, high: 150 } as const;
/** How close the maximum must come, dB: the engine meets Hornresp's curves, so only rounding is left (0.0004 dB now). */
const MAX_TOLERANCE = 0.002;

/** A level ratio in dB. */
const db = (ratio: number) => 20 * Math.log10(ratio);

for (const c of CASES) {
  test(`the maximum output matches Hornresp's curves: ${c.name}`, () => {
    const reading = readHornrespRecord(
      fs.readFileSync(path.join(c.dir, `${c.name}.txt`), "latin1"),
    );
    assert.ok(reading.ok, reading.ok ? "" : reading.reason);
    const hornresp = resultsOf(
      fs.readFileSync(path.join(HORNRESP_DIR, `${c.name}-results.txt`), "utf8"),
    );
    const driver = [...SUB_OPTIONS, ...SPEAKER_SUB_OPTIONS].find((d) => d.id === c.driverId);
    assert.ok(driver, `a catalog driver ${c.driverId}`);
    const { ts } = driver;
    for (const watts of AMP_WATTS) {
      /** the amp's voltage into the driver's nominal impedance, V RMS */
      const volts = wattsToVolts(watts, ts);
      const model = presetModel(
        reading.preset,
        hornresp.map((p) => p.f),
        volts,
      );
      assert.ok(model);
      /** the limits that set the reference somewhere in the band */
      const setBy = new Set<LimitId>();
      hornresp.forEach((expected, i) => {
        if (expected.f < BAND_HZ.low || expected.f > BAND_HZ.high) return;
        const ampLimited = expected.spl + db(volts / reading.volts),
          xmaxLimited = expected.spl + db(ts.Xmax / expected.xmm);
        const reference = Math.min(ampLimited, xmaxLimited);
        setBy.add(ampLimited <= xmaxLimited ? LIMIT_NAMES.amp : LIMIT_NAMES.Xmax);
        const point = model.curve[i];
        // no vent speed: the reference has none
        const limit = sineLimitAt({ xmm: point.xmm }, ts, volts, Infinity);
        assert.notStrictEqual(limit.who, LIMIT_NAMES.thermal, `${c.name} at ${watts} W`);
        const level = point.powerSpl + db(limit.V / volts);
        assert.ok(
          Math.abs(level - reference) <= MAX_TOLERANCE,
          `${c.name} at ${watts} W, ${expected.f.toFixed(1)} Hz: ${level} vs ${reference} dB`,
        );
      });
      assert.deepStrictEqual(
        [...setBy].sort(),
        [LIMIT_NAMES.amp, LIMIT_NAMES.Xmax].sort(),
        `${c.name} at ${watts} W: both limits in the band`,
      );
    }
  });
}
