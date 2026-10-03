import { test } from "vite-plus/test";
import assert from "node:assert";
import { paResponseAt, paDispersionMap, firstNullAngleDeg } from "../src/lib/pa/dispersion";
import { logSpacedFrequencies } from "../src/lib/hifi/hifi";
import type { PaStackGeometry } from "../src/types";

const stack = (gapIn: number): PaStackGeometry => ({
  sub: { zIn: 12, Sd: 1200 },
  mid: { zIn: 40, Sd: 530 },
  horn: { zIn: 40 + gapIn, covH: 90, covV: 40, wIn: 12, hIn: 7 },
  xoLo: 120,
  xoHi: 1000,
  orderLo: 4,
  orderHi: 4,
});

test("PA dispersion: flat on the horn axis through both crossovers (time-aligned LR24)", (t) => {
  const r = paResponseAt(stack(15), { th: 0, eyeIn: 55, distM: 5 }, [60, 120, 400, 1000, 4000]);
  for (const o of r) assert.ok(Math.abs(o.spl) < 1.5, `${o.f} Hz: ${o.spl.toFixed(2)} dB`);
});

test("PA dispersion: a vertical null opens near the predicted angle at the mid/horn crossover, and closer drivers push it out", (t) => {
  const gap = 18,
    f = 1000,
    pred = firstNullAngleDeg(gap, f);
  const m = paDispersionMap(stack(gap), "v", 20);
  const fi = m.freqs.reduce(
    (b, x, i) => (Math.abs(Math.log(x / f)) < Math.abs(Math.log(m.freqs[b] / f)) ? i : b),
    0,
  );
  const col = m.angles.map((a, j) => ({ a, db: m.rows[j][fi] })).filter((o) => o.a > 0);
  const worst = col.reduce((b, o) => (o.db < b.db ? o : b));
  assert.ok(worst.db < -10, `deep null ${worst.db.toFixed(1)} dB`);
  assert.ok(Math.abs(worst.a - pred!) <= 8, `null at ${worst.a}°, predicted ${pred!.toFixed(0)}°`);
  assert.ok(firstNullAngleDeg(10, f)! > pred!, "closer spacing, wider null angle");
  assert.equal(firstNullAngleDeg(6, f), null, "under half a wavelength: no null");
});

test("PA dispersion: horizontal map is 0 dB on axis", (t) => {
  const m = paDispersionMap(stack(15), "h", 5);
  assert.ok(m.rows[0].every((v) => Math.abs(v) < 1e-9));
});

// level at the angle and frequency nearest the ones asked for
const at = (m: ReturnType<typeof paDispersionMap>, deg: number, f: number) => {
  const nearest = (xs: number[], x: number, d: (a: number, b: number) => number) =>
    xs.reduce((b, v, i) => (d(v, x) < d(xs[b], x) ? i : b), 0);
  const j = nearest(m.angles, deg, (a, b) => Math.abs(a - b));
  const i = nearest(m.freqs, f, (a, b) => Math.abs(Math.log(a / b)));
  return m.rows[j][i];
};

test("PA dispersion: off axis the horn loses level at high frequency, while the mid is still wide low down", () => {
  const m = paDispersionMap(stack(15), "h", 5);
  // 60° is outside the horn's 90° coverage: well down once the horn controls, near 0 dB where the mid is still a small source
  const high = at(m, 60, 10000),
    low = at(m, 60, 200);
  assert.ok(high < -6, `60° at 10 kHz: ${high.toFixed(1)} dB`);
  assert.ok(low > -3, `60° at 200 Hz: ${low.toFixed(1)} dB`);
  // and inside the coverage (30°) the horn holds up at the same frequency
  assert.ok(at(m, 30, 10000) > high + 3, "inside the coverage it is louder than outside");
});

test("PA dispersion: the vertical dip at the mid/horn crossover moves with the crossover frequency", () => {
  const gap = 18;
  // the deepest point above the horn axis, in the column nearest the crossover
  const nullAngle = (xoHi: number) => {
    const m = paDispersionMap({ ...stack(gap), xoHi }, "v", 20);
    const col = m.angles.filter((a) => a > 0).map((a) => ({ a, db: at(m, a, xoHi) }));
    // first local minimum going off axis: past it sit the horn's coverage edge and further lobes
    const first = col.find((o, k) => k + 1 < col.length && o.db < col[k + 1].db);
    return first?.a ?? Infinity;
  };
  const low = nullAngle(1000),
    high = nullAngle(1500);
  // a higher crossover means a shorter wavelength, so the first null sits closer to the axis
  assert.ok(high < low, `null at ${high}° for 1.5 kHz, ${low}° for 1 kHz`);
  for (const [xo, angle] of [
    [1000, low],
    [1500, high],
  ] as const) {
    const predicted = firstNullAngleDeg(gap, xo);
    assert.ok(predicted != null, `a null is expected at ${xo} Hz with ${gap}″ spacing`);
    assert.ok(
      Math.abs(angle - predicted) <= 8,
      `${xo} Hz: null at ${angle}°, predicted ${predicted.toFixed(0)}°`,
    );
  }
});
