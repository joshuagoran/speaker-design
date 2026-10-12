// The voice coil's inductance in the box models (lib/acoustics/driverCircuit coilFactor): a driver that lists Le rolls
// off at the top in the sealed, vented and passive-radiator models; one without Le reads exactly as with the coil as
// Re alone.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { boxModel, closedBox } from "../src/lib/pa/calc";
import { passiveRadiatorBox } from "../src/lib/hifi/hifi";
import { coilFactor } from "../src/lib/acoustics/driverCircuit";
import { abs } from "../src/lib/acoustics/complex";
import { HIFI_PASSIVES, MID_OPTIONS } from "../src/lib/data";
import type { BoxModelTS } from "../src/types";

const mid = MID_OPTIONS.find((o) => o.id === "f12pr300");
assert.ok(mid, "the catalog has the mid");
/** The mid with no inductance listed, with Le 0, and with Le 1.5 mH (a 12″ mid's). */
const { Le: _listed, ...bare } = mid.ts;
const zero: BoxModelTS = { ...bare, Le: 0 };
const coil: BoxModelTS = { ...bare, Le: 1.5 };
const grid = { fmin: 20, fmax: 5000, N: 160, phase: true };

/** The three box models of one driver, each run the same way. */
const models = (ts: BoxModelTS) => ({
  sealed: closedBox(ts, 40, null, null, 2.83, { ...grid, hpOrder: 4, lpOrder: 4 })?.curve,
  vented: boxModel(ts, 60, 20, 8, 1, 2.83, "BW24", grid)?.curve,
  radiator: passiveRadiatorBox(
    ts,
    40,
    { drv: HIFI_PASSIVES[0], n: 1, addG: 0 },
    1,
    2.83,
    "BW24",
    grid,
  )?.curve,
});

test("voice coil: a driver without Le reads exactly as Le 0 (the coil as Re alone) in every box model", () => {
  assert.deepStrictEqual(models(bare), models(zero));
  assert.deepStrictEqual(coilFactor(bare, 1000), { re: 1, im: 0 });
});

test("voice coil: with Le the box models roll off at the top and keep the bass", () => {
  const without = models(zero),
    withLe = models(coil);
  for (const kind of ["sealed", "vented", "radiator"] as const) {
    const a = without[kind],
      b = withLe[kind];
    assert.ok(a && b, kind);
    const at = (curve: typeof a, f: number) =>
      curve.reduce((best, o) => (Math.abs(o.f - f) < Math.abs(best.f - f) ? o : best));
    // the bass is the box's: the coil's reactance is small against Re there (it moves the damping a little)
    assert.ok(Math.abs(at(b, 40).raw - at(a, 40).raw) < 0.5, `${kind}: about the same at 40 Hz`);
    // up top the mass-controlled cone follows the motor's drive, |Re/(Re + jωLe)|, about 6 dB/oct past Re/(2πLe)
    const f = 4000;
    const fall = at(a, f).raw - at(b, f).raw;
    const expected = -20 * Math.log10(abs(coilFactor(coil, 2 * Math.PI * at(a, f).f)));
    assert.ok(fall > 6, `${kind}: ${fall.toFixed(1)} dB lower at 4 kHz`);
    assert.ok(
      Math.abs(fall - expected) < 1,
      `${kind}: ${fall.toFixed(2)} vs ${expected.toFixed(2)} dB`,
    );
    // and the cone travels less there
    assert.ok(at(b, f).xmm < at(a, f).xmm, `${kind}: less excursion at 4 kHz`);
  }
});
