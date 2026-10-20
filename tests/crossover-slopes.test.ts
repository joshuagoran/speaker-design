// PA crossover slopes: LR24 or LR48 at each crossover (issue #27). LR24 reads as before.
import { test } from "vite-plus/test";
import { highpassGain } from "../src/lib/acoustics/boxModels";
import { filterTransfer } from "../src/lib/speaker/bandFilter";
import { abs } from "../src/lib/acoustics/complex";
import { close, db } from "./helpers";

/** A Linkwitz-Riley filter's magnitude at `f` (Hz): order 4 (LR24) or 8 (LR48), corner `fc`, on one side. */
const lr = (side: "lowpass" | "highpass") => (f: number, fc: number, order: 4 | 8) =>
  abs(filterTransfer(f, { hz: fc, type: order === 8 ? "LR48" : "LR24" }, side));
const linkwitzRileyLowpass = lr("lowpass"),
  linkwitzRileyHighpass = lr("highpass");

test("LR48 is -6 dB at the corner, 48 dB/oct beyond it, and its halves sum to 1", (t) => {
  close(t, db(linkwitzRileyLowpass(900, 900, 8)), -6.02, 0.01);
  close(t, db(linkwitzRileyHighpass(900, 900, 8)), -6.02, 0.01);
  close(t, db(linkwitzRileyLowpass(9000, 900, 8)), -160, 0.1);
  close(t, db(linkwitzRileyHighpass(90, 900, 8)), -160, 0.1);
  for (const f of [50, 200, 900, 2000, 9000])
    close(
      t,
      linkwitzRileyLowpass(f, 900, 8) + linkwitzRileyHighpass(f, 900, 8),
      1,
      1e-12,
      `${f} Hz`,
    );
});

test("order 4 is the LR24 the PA always used", (t) => {
  for (const f of [30, 120, 900, 5000]) {
    close(t, linkwitzRileyLowpass(f, 900, 4), 1 / (1 + Math.pow(f / 900, 4)), 1e-12);
    close(t, linkwitzRileyHighpass(f, 900, 4), highpassGain(f, 900, "LR24"), 1e-12);
  }
});
