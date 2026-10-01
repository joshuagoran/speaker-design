import test from "node:test";
import { paResponseAt, paDispersionMap, firstNullDeg } from "../src/lib/pa/dispersion.js";
import { logFreqs } from "../src/lib/hifi/hifi.js";

const stack = (gapIn) => ({ sub: { zIn: 12, Sd: 1200 }, mid: { zIn: 40, Sd: 530 }, horn: { zIn: 40 + gapIn, covH: 90, covV: 40, wIn: 12, hIn: 7 }, xoLo: 120, xoHi: 1000, order: 4 });

test("PA dispersion: flat on the horn axis through both crossovers (time-aligned LR24)", (t) => {
  const r = paResponseAt(stack(15), { th: 0, eyeIn: 55, distM: 5 }, [60, 120, 400, 1000, 4000]);
  for (const o of r) t.assert.ok(Math.abs(o.spl) < 1.5, `${o.f} Hz: ${o.spl.toFixed(2)} dB`);
});

test("PA dispersion: a vertical null opens near the predicted angle at the mid/horn crossover, and closer drivers push it out", (t) => {
  const gap = 18, f = 1000, pred = firstNullDeg(gap, f);
  const m = paDispersionMap(stack(gap), "v", 20);
  const fi = m.freqs.reduce((b, x, i) => (Math.abs(Math.log(x / f)) < Math.abs(Math.log(m.freqs[b] / f)) ? i : b), 0);
  const col = m.angles.map((a, j) => ({ a, db: m.rows[j][fi] })).filter((o) => o.a > 0);
  const worst = col.reduce((b, o) => (o.db < b.db ? o : b));
  t.assert.ok(worst.db < -10, `deep null ${worst.db.toFixed(1)} dB`);
  t.assert.ok(Math.abs(worst.a - pred) <= 8, `null at ${worst.a}°, predicted ${pred.toFixed(0)}°`);
  t.assert.ok(firstNullDeg(10, f) > pred, "closer spacing, wider null angle");
  t.assert.equal(firstNullDeg(6, f), null, "under half a wavelength: no null");
});

test("PA dispersion: horizontal map is 0 dB on axis", (t) => {
  const m = paDispersionMap(stack(15), "h", 5);
  t.assert.ok(m.rows[0].every((v) => Math.abs(v) < 1e-9));
});
