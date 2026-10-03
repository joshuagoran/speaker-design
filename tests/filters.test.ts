import { test } from "vite-plus/test";
import assert from "node:assert";
import {
  highpassFilter,
  highpassGain,
  linkwitzRileyLowpass,
  linkwitzRileyHighpass,
  unwrapPhase,
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
test("highpassFilter: its magnitude is highpassGain; at the corner a Butterworth n leads n × 45°, an LR24 180°", (t) => {
  const deg = (ty: Parameters<typeof highpassFilter>[2], f: number) => {
    const h = highpassFilter(f, 40, ty);
    return (Math.atan2(h.im, h.re) * 180) / Math.PI;
  };
  for (const ty of ["BW24", "LR24", "BW48", "LR48"] as const)
    for (const f of [5, 20, 40, 80, 400]) {
      const h = highpassFilter(f, 40, ty);
      close(t, Math.hypot(h.re, h.im), highpassGain(f, 40, ty), 1e-12, `${ty} at ${f} Hz`);
    }
  // atan2 reads 180° as ±180° and 360° as 0°
  close(t, Math.abs(deg("BW24", 40)), 180, 1e-9, "BW24");
  close(t, Math.abs(deg("LR24", 40)), 180, 1e-9, "LR24");
  close(t, deg("BW48", 40), 0, 1e-9, "BW48: 360°");
  close(t, deg("LR48", 40), 0, 1e-9, "LR48: 360°");
  // and an octave up a BW24 leads by less, but still leads
  assert.ok(deg("BW24", 80) > 0 && deg("BW24", 80) < 180);
});
test("unwrapPhase: whole turns taken out between neighbours, the top point kept", (t) => {
  const turn = 2 * Math.PI;
  const u = unwrapPhase([3, -3, 0.5 - turn, 0.2]);
  close(t, u[3], 0.2, 0);
  close(t, u[2], 0.5, 1e-12);
  assert.ok(u.every((v, i) => i === 0 || Math.abs(v - u[i - 1]) <= Math.PI));
});
