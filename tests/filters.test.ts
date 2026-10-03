import { test } from "vite-plus/test";
import assert from "node:assert";
import { highpassGain, linkwitzRileyLowpass, linkwitzRileyHighpass } from "../src/lib/pa/calc";
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
