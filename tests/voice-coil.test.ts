// The voice coil's inductance in the box models (lib/acoustics/driverCircuit coilFactor): a driver that lists Le rolls
// off at the top in a sealed and a vented box (the horn engine with no horn) and the passive-radiator model; one
// without Le reads exactly as with the coil as Re alone.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { passiveRadiatorBox } from "../src/lib/acoustics/wooferBox";
import { coilFactor } from "../src/lib/acoustics/driverCircuit";
import {
  abs,
  add,
  complex,
  divide,
  imaginary,
  multiply,
  reciprocal,
} from "../src/lib/acoustics/complex";
import { AIR_DENSITY, BOX_LEAK_Q, BOX_PORT_Q, SPEED_OF_SOUND } from "../src/constants/acoustics";
import { HIFI_PASSIVES, MID_OPTIONS, SUB_OPTIONS } from "../src/lib/data";
import type { BoxModelTS, Complex } from "../src/types";
import { directBox, engineModel, hornGrid, massLineSPL, near, roundVent } from "./helpers";

const mid = MID_OPTIONS.find((o) => o.id === "f12pr300");
assert.ok(mid, "the catalog has the mid");
/** The mid with no inductance listed, with Le 0, and with Le 1.5 mH (a 12″ mid's). */
const { Le: _listed, ...bare } = mid.ts;
const zero: BoxModelTS = { ...bare, Le: 0 };
const coil: BoxModelTS = { ...bare, Le: 1.5 };
const grid = { fmin: 20, fmax: 5000, N: 160, phase: true };

/** A sealed or vented box's curve through the horn engine, as `raw` levels with the excursion. */
const engineCurve = (...args: Parameters<typeof engineModel>) =>
  engineModel(...args).curve.map((o) => ({ f: o.f, raw: o.spl, xmm: o.xmm, phase: o.phase }));

/** The three box models of one driver, each run the same way. */
const models = (ts: BoxModelTS) => ({
  sealed: engineCurve(directBox(ts, 40), hornGrid(20, 5000, 160), 2.83),
  vented: engineCurve(directBox(ts, 60, roundVent(20, 8)), hornGrid(20, 5000, 160), 2.83),
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

// An independent reference for the coil: the plain series circuit in the mechanical domain, i = V/(Re + jωLe + Bl²/Zm),
// v = Bl·i/Zm, with Zm the cone's mechanical impedance and the box's air on its back, Sd²·Zbox (half space, 1 m).
const sub = SUB_OPTIONS.find((o) => o.id === "f18fh500");
assert.ok(sub?.ts.Le, "the catalog's f18fh500 lists Le");
const fh500 = sub.ts;
const { Le: _subLe, ...fh500Bare } = fh500;
const VbL = 150;
const Cab = VbL / 1000 / (AIR_DENSITY * SPEED_OF_SOUND ** 2);
/** The sealed box's acoustic impedance, 1/(jωCab). */
const sealedBox = (w: number) => reciprocal(imaginary(w * Cab));
/** The vented box's acoustic impedance at tuning Fb: the box air, the port (mass and loss) and the leak in parallel. */
const ventedBox = (Fb: number) => (w: number) => {
  const wb = 2 * Math.PI * Fb,
    Map = 1 / (wb * wb * Cab);
  const port = complex((wb * Map) / BOX_PORT_Q, w * Map);
  const leak = complex(BOX_LEAK_Q / (wb * Cab));
  return reciprocal(add(add(imaginary(w * Cab), reciprocal(port)), reciprocal(leak)));
};
/** The cone's mechanical impedance with the box behind it, N·s/m. */
const mechanical = (ts: BoxModelTS, f: number, box: (w: number) => Complex) => {
  const w = 2 * Math.PI * f,
    Mms = ts.Mms / 1000,
    Sd = ts.Sd / 1e4,
    Cms = 1 / ((2 * Math.PI * ts.Fs) ** 2 * Mms);
  const Rms = (2 * Math.PI * ts.Fs * Mms) / ts.Qms;
  return add(complex(Rms, w * Mms - 1 / (w * Cms)), multiply(complex(Sd * Sd), box(w)));
};
/** The SPL of the series circuit at `volts`: the cone's flow, or (`radiated`) the flow into the box air for a vented box. */
function seriesSPL(
  ts: BoxModelTS,
  f: number,
  volts: number,
  box: (w: number) => Complex,
  radiated = false,
) {
  const w = 2 * Math.PI * f,
    Sd = ts.Sd / 1e4,
    Zm = mechanical(ts, f, box);
  const coil = complex(ts.Re, (w * (ts.Le ?? 0)) / 1000);
  const i = divide(complex(volts), add(coil, divide(complex(ts.Bl * ts.Bl), Zm)));
  const Ud = multiply(complex(Sd), divide(multiply(complex(ts.Bl), i), Zm));
  // a vented box radiates what flows into its air (cone less port and leak): Ud·Zbox·jωCab
  const U = radiated ? multiply(multiply(Ud, box(w)), imaginary(w * Cab)) : Ud;
  return 20 * Math.log10((AIR_DENSITY * w * abs(U)) / (2 * Math.PI) / 2e-5);
}
/** The grid of these checks, 20 Hz–5 kHz. */
const WIDE = hornGrid(20, 5000, 400);
/** The lumped circuit (no radiation load), as the series reference takes it. */
const LUMPED = { radiationLoad: false } as const;
/** A 60 in², 12″ round vent as the lumped mode takes it: its whole effective length, 1.46 r added. */
const lumpedVent = { area: 60 * 6.4516, length: (12 + 1.46 * Math.sqrt(60 / Math.PI)) * 2.54 };

test("voice coil: at 250 Hz the box models match the series circuit with Re + jωLe (f18fh500)", () => {
  const sealed = engineCurve(directBox(fh500, VbL), WIDE, 2.83, LUMPED);
  const ventedModel = engineModel(directBox(fh500, VbL, lumpedVent), WIDE, 2.83, LUMPED);
  const vented = engineCurve(directBox(fh500, VbL, lumpedVent), WIDE, 2.83, LUMPED);
  const s = near(sealed, 250),
    v = near(vented, 250);
  const sRef = seriesSPL(fh500, s.f, 2.83, sealedBox),
    vRef = seriesSPL(fh500, v.f, 2.83, ventedBox(ventedModel.fb ?? NaN), true);
  assert.ok(Math.abs(s.raw - sRef) < 0.05, `sealed: ${s.raw.toFixed(3)} vs ${sRef.toFixed(3)} dB`);
  assert.ok(Math.abs(v.raw - vRef) < 0.05, `vented: ${v.raw.toFixed(3)} vs ${vRef.toFixed(3)} dB`);
});

test("voice coil: the level never passes the mass line scaled by ωMms/|Zm| (the current cannot pass V/Re)", () => {
  for (const ts of [fh500, coil]) {
    for (const o of engineCurve(directBox(ts, VbL), WIDE, 2.83, LUMPED)) {
      const bound =
        massLineSPL(ts, 2.83) +
        20 *
          Math.log10((2 * Math.PI * o.f * (ts.Mms / 1000)) / abs(mechanical(ts, o.f, sealedBox)));
      assert.ok(
        o.raw <= bound + 1e-9,
        `${o.f.toFixed(0)} Hz: ${o.raw.toFixed(3)} > ${bound.toFixed(3)} dB`,
      );
    }
  }
});

test("voice coil: well above the coil's resonance with the motional capacitance (2 kHz) Le lowers the level", () => {
  const sealed = (ts: BoxModelTS) => engineCurve(directBox(ts, VbL), WIDE, 2.83);
  const vented = (ts: BoxModelTS) => engineCurve(directBox(ts, VbL, roundVent(60, 12)), WIDE, 2.83);
  for (const [kind, run] of [
    ["sealed", sealed],
    ["vented", vented],
  ] as const) {
    const withLe = run(fh500),
      without = run(fh500Bare);
    assert.ok(withLe && without, kind);
    const a = near(withLe, 2000).raw,
      b = near(without, 2000).raw;
    assert.ok(a < b, `${kind}: ${a.toFixed(2)} vs ${b.toFixed(2)} dB without Le`);
  }
});
