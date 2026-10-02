import { test } from "vite-plus/test";
import assert from "node:assert";
import {
  highpassGain,
  linkwitzRiley24Lowpass,
  linkwitzRiley24Highpass,
} from "../src/lib/pa/calc.ts";
import { db, close } from "./helpers.ts";

test("Butterworth highpasses are -3.01 dB at the corner", (t) => {
  close(t, db(highpassGain(40, 40, "BW24")), -3.01, 0.01);
  close(t, db(highpassGain(40, 40, "BW48")), -3.01, 0.01);
});
test("Linkwitz-Riley highpasses are -6.02 dB at the corner", (t) => {
  close(t, db(highpassGain(40, 40, "LR24")), -6.02, 0.01);
  close(t, db(highpassGain(40, 40, "LR48")), -6.02, 0.01);
  close(t, db(linkwitzRiley24Lowpass(900, 900)), -6.02, 0.01);
});
test("slopes: 24 and 48 dB/oct a decade below the corner", (t) => {
  close(t, db(highpassGain(4, 40, "BW24")), -80, 0.1);
  close(t, db(highpassGain(4, 40, "BW48")), -160, 0.1);
  close(t, db(highpassGain(4, 40, "LR24")), -80, 0.1);
  close(t, db(linkwitzRiley24Lowpass(9000, 900)), -80, 0.1);
});
test("LR24 lowpass + highpass magnitudes sum to 1 at every frequency", (t) => {
  for (const f of [50, 200, 900, 2000, 9000])
    close(
      t,
      linkwitzRiley24Lowpass(f, 900) + linkwitzRiley24Highpass(f, 900),
      1,
      1e-12,
      `at ${f} Hz`,
    );
});
test("far above the corner a highpass is flat", (t) => {
  for (const ty of ["BW24", "LR24", "BW48", "LR48"] as const)
    close(t, db(highpassGain(4000, 40, ty)), 0, 0.01, ty);
});
