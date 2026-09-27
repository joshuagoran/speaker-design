import test from "node:test";
import { hornResponse, pistonBeam, keeleF, hornBeam } from "../tools/calc.js";
import { CD_OPTIONS } from "../tools/data.js";
import { close, near, db } from "./helpers.js";

const n314t = CD_OPTIONS.find((o) => o.id === "n314t").hf;
test("horn power: amp into Z, capped at 2 x AES, derated below the rated crossover", (t) => {
  const a = hornResponse(n314t, { lowHz: 580 }, 900, 100);
  close(t, a.P, Math.min(100 * 8 / n314t.imp, 2 * n314t.aes * Math.min(1, (900 / n314t.aesXo) ** 2)), 1e-9);
  const b = hornResponse({ sens: 108, aes: 40, aesXo: 1800, imp: 8 }, {}, 900, 400);
  close(t, b.derate, 0.25, 1e-12); close(t, b.P, 20, 1e-9); t.assert.equal(b.who, "program rating");
});
test("horn curve: flat = sens + 10 log P; LR24 -6 dB at the crossover; 12 dB/oct below the loading limit", (t) => {
  const h = hornResponse(n314t, { lowHz: 1000 }, 1000, 100);
  close(t, h.flat, n314t.sens + 10 * Math.log10(h.P), 1e-9);
  close(t, near(h.curve, 8000).spl, h.flat, 0.05, "flat at 8 kHz");
  const g = hornResponse(n314t, {}, 1000, 100);
  close(t, near(g.curve, 1000).spl - g.flat, db(0.5), 0.1, "LR24 at xo");
  const lo = hornResponse(n314t, { lowHz: 2000 }, 100, 100);   // far above the xo: only the loading rolloff
  close(t, near(lo.curve, 1000).spl - near(lo.curve, 2000).spl, -12, 0.3, "12 dB/oct");
});
// independent reference: 2 J1(x)/x from the Bessel series
const J1 = (x) => { let s = 0, term = x / 2; for (let k = 0; k < 30; k++) { s += term; term *= -(x * x) / (4 * (k + 1) * (k + 2)); } return s; };
test("piston beamwidth: -6 dB angle matches the Bessel directivity", (t) => {
  const Sd = 522, a = Math.sqrt(Sd / 1e4 / Math.PI);
  for (const f of [1500, 2500, 4000]) {
    const th = (pistonBeam(Sd, f) / 2) * Math.PI / 180, x = 2 * Math.PI * f / 343 * a * Math.sin(th);
    close(t, 2 * J1(x) / x, 0.5, 0.01, `${f} Hz`);
  }
  t.assert.equal(pistonBeam(Sd, 300), 180);
});
test("Keele: 460 mm / 100 deg holds pattern to ~550 Hz; beam widens below", (t) => {
  const fK = keeleF(100, 460 / 25.4);
  close(t, fK, 1e6 / ((460 / 25.4) * 100) , 1, "1e6 in-deg-Hz");
  t.assert.equal(hornBeam(100, fK, 2 * fK), 100); close(t, hornBeam(100, fK, fK / 1.5), 150, 1e-9);
});
