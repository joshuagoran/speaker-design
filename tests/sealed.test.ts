// A plain sealed box through the horn engine (no horn) against Small's closed-box equations. `radiationLoad: false`
// makes it the lumped circuit those equations describe, for the exact checks; the default (the cone's radiation load)
// stays close below ka ≈ 0.5.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { closedBoxQtc } from "../src/lib/acoustics/hornModel";
import { midbandLevelDb } from "../src/lib/acoustics/driverCircuit";
import { MID_OPTIONS } from "../src/lib/data";
import type { BoxModelTS, HornModel } from "../src/types";
import {
  close,
  directBox,
  engineModel,
  f3SecondOrder,
  hornGrid,
  massLineSPL,
  near,
  rel,
  tsModel,
} from "./helpers";

// the driver without its coil inductance: these tests check Small's Le-free closed forms (voice-coil.test.ts covers Le)
const drv = (id: string) => {
  const { Le: _listed, ...bare } = MID_OPTIONS.find((o) => o.id === id)!.ts;
  return bare;
};
const cases: [string, number][] = [
  ["bc12ndl76", 45],
  ["bc12ndl76", 15],
  ["f12pr300", 20],
  ["bc12fw76", 45],
  ["bc15ndl76", 60],
];
/** The grid the checks read, 10 Hz–2 kHz. */
const GRID = hornGrid(10, 2000, 600);
/** The lumped circuit, as Small's equations take it. */
const LUMPED = { radiationLoad: false } as const;
/** Fc, Hz: where the response's phase crosses 90° (a 2nd-order highpass's), between grid points. */
function phase90Hz(model: HornModel) {
  const { curve } = model;
  const i = curve.findIndex((o) => o.phase < Math.PI / 2);
  assert.ok(i > 0, "the phase crosses 90°");
  const a = curve[i - 1],
    b = curve[i];
  const w = (a.phase - Math.PI / 2) / (a.phase - b.phase);
  return a.f * Math.pow(b.f / a.f, w);
}
/** Small's Fc and Qtc for a driver in `Vb` liters. */
function small(ts: BoxModelTS, Vb: number) {
  const m = tsModel(ts),
    alpha = m.VasL / Vb;
  return { Fc: ts.Fs * Math.sqrt(1 + alpha), Qtc: m.Qts * Math.sqrt(1 + alpha) };
}

for (const [id, Vb] of cases) {
  test(`sealed ${id} in ${Vb} L: Fc and Qtc follow Small's closed-box equations`, (t) => {
    const ts = drv(id),
      { Fc, Qtc } = small(ts, Vb);
    rel(t, closedBoxQtc(ts, Vb), Qtc, 1e-6, "Qtc");
    rel(t, phase90Hz(engineModel(directBox(ts, Vb), GRID, 2.83, LUMPED)), Fc, 1e-3, "Fc, lumped");
    rel(t, phase90Hz(engineModel(directBox(ts, Vb), GRID, 2.83)), Fc, 0.02, "Fc, loaded");
  });
  test(`sealed ${id} in ${Vb} L: midband level is the mass-controlled line`, (t) => {
    const ts = drv(id);
    close(t, midbandLevelDb(ts, 2.83), massLineSPL(ts, 2.83), 1e-9, "reference");
    // the lumped curve itself: well above Fc it sits on that line
    const r = engineModel(directBox(ts, Vb), [2000], 2.83, LUMPED);
    close(t, r.curve[0].spl, massLineSPL(ts, 2.83), 0.1, "2 kHz");
  });
  test(`sealed ${id} in ${Vb} L: F3 matches the 2nd-order highpass`, (t) => {
    const ts = drv(id),
      { Fc, Qtc } = small(ts, Vb),
      line = massLineSPL(ts, 2.83);
    // loaded: the air's radiation resistance damps the cone a little more (these mids' F3 sits near ka = 0.5)
    for (const [opts, tolerance] of [
      [LUMPED, 0.02],
      [{}, 0.05],
    ] as const) {
      const f3 = engineModel(directBox(ts, Vb), GRID, 2.83, opts).curve.find(
        (o) => o.spl >= line - 3,
      )?.f;
      rel(t, f3 ?? NaN, f3SecondOrder(Fc, Qtc), tolerance, `f3 ${JSON.stringify(opts)}`);
    }
  });
}

test("sealed: excursion follows the 2nd-order system from the stiffness limit (sine peak)", (t) => {
  const ts = drv("bc12ndl76"),
    m = tsModel(ts),
    Vb = 30,
    { Fc, Qtc } = small(ts, Vb);
  const kTot = 1 / m.Cms + (1.18 * 343 * 343 * m.Sd * m.Sd) / (Vb / 1000); // N/m
  const x0 = ((Math.SQRT2 * ((2.83 * ts.Bl) / ts.Re)) / kTot) * 1000; // mm, static limit
  const u = 20 / Fc,
    x = x0 / Math.hypot(1 - u * u, u / Qtc); // 2nd-order system incl. damping
  for (const opts of [LUMPED, {}])
    rel(t, engineModel(directBox(ts, Vb), [20], 2.83, opts).curve[0].xmm, x, 0.01, "20 Hz");
});

test("sealed phase: 90° at Fc, near 180° far below (unwrapped from the top), near 0 well above", (t) => {
  const ts = drv("bc12ndl76");
  const { Fc } = small(ts, 40);
  // a lumped grid that starts on Fc
  const m = engineModel(directBox(ts, 40), hornGrid(Fc, 100 * Fc, 200), 2.83, LUMPED);
  const deg = (o: { phase: number }) => (o.phase * 180) / Math.PI;
  close(t, deg(m.curve[0]), 90, 1e-6, "at Fc");
  assert.ok(Math.abs(deg(m.curve[m.curve.length - 1])) < 2, "well above");
  const low = engineModel(directBox(ts, 40), hornGrid(Fc / 50, 20 * Fc, 200), 2.83, LUMPED);
  close(t, deg(low.curve[0]), 180, 5, "far below");
  // the loaded model's phase at Fc, a little off the lumped one
  close(t, deg(near(engineModel(directBox(ts, 40), [Fc], 2.83).curve, Fc)), 90, 5, "loaded");
});
