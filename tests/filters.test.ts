import { test } from "vite-plus/test";
import assert from "node:assert";
import {
  butterworth,
  highpassGain,
  highpassPhase,
  linkwitzRileyLowpass,
  linkwitzRileyHighpass,
} from "../src/lib/pa/calc";
import { db, close } from "./helpers";

test("Butterworth highpasses are -3.01 dB at the corner", (t) => {
  close(t, db(highpassGain(40, 40, "BW24")), -3.01, 0.01);
  close(t, db(highpassGain(40, 40, "BW48")), -3.01, 0.01);
});
test("Linkwitz-Riley highpasses are -6.02 dB at the corner", (t) => {
  close(t, db(highpassGain(40, 40, "LR24")), -6.02, 0.01);
  close(t, db(highpassGain(40, 40, "LR48")), -6.02, 0.01);
  close(t, db(linkwitzRileyLowpass(900, 900, 4)), -6.02, 0.01);
});
test("slopes: 24 and 48 dB/oct a decade below the corner", (t) => {
  close(t, db(highpassGain(4, 40, "BW24")), -80, 0.1);
  close(t, db(highpassGain(4, 40, "BW48")), -160, 0.1);
  close(t, db(highpassGain(4, 40, "LR24")), -80, 0.1);
  close(t, db(linkwitzRileyLowpass(9000, 900, 4)), -80, 0.1);
});
test("LR24 lowpass + highpass magnitudes sum to 1 at every frequency", (t) => {
  for (const f of [50, 200, 900, 2000, 9000])
    close(
      t,
      linkwitzRileyLowpass(f, 900, 4) + linkwitzRileyHighpass(f, 900, 4),
      1,
      1e-12,
      `at ${f} Hz`,
    );
});
test("far above the corner a highpass is flat", (t) => {
  for (const ty of ["BW24", "LR24", "BW48", "LR48"] as const)
    close(t, db(highpassGain(4000, 40, ty)), 0, 0.01, ty);
});
test("highpassPhase: s^n / Butterworth(n)'s angle, continuous: at the corner a Butterworth n leads n × 45°, an LR24 180°", (t) => {
  const deg = (r: number) => (r * 180) / Math.PI;
  close(t, deg(highpassPhase(40, 40, "BW24")), 180, 1e-9, "BW24");
  close(t, deg(highpassPhase(40, 40, "LR24")), 180, 1e-9, "LR24");
  close(t, deg(highpassPhase(40, 40, "BW48")), 360, 1e-9, "BW48");
  close(t, deg(highpassPhase(40, 40, "LR48")), 360, 1e-9, "LR48");
  for (const [ty, n, lr] of [
    ["BW24", 4, false],
    ["BW48", 8, false],
    ["LR24", 2, true],
    ["LR48", 4, true],
  ] as const) {
    let last = Infinity;
    for (const f of [2, 5, 10, 20, 40, 80, 160, 400, 4000]) {
      // the transfer function's own angle: (jx)^n / B_n(jx), squared for a Linkwitz-Riley
      const x = f / 40,
        b = butterworth({ re: 0, im: x }, n),
        ref = (lr ? 2 : 1) * ((n * Math.PI) / 2 - Math.atan2(b.im, b.re));
      const p = highpassPhase(f, 40, ty),
        d = p - ref;
      assert.ok(
        Math.abs(d - 2 * Math.PI * Math.round(d / (2 * Math.PI))) < 1e-9,
        `${ty} at ${f} Hz`,
      );
      assert.ok(p < last && p > 0, `${ty}: falls from ${lr ? 2 * n : n} × 90° toward 0`);
      last = p;
    }
  }
});
