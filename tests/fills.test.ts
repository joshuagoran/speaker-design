import { test } from "vite-plus/test";
import assert from "node:assert";
import { ohmsOf } from "../src/lib/power";
import { fillDriverPadDb } from "../src/lib/acoustics/boxModels";
import { DEFAULT_FILL } from "../src/lib/defaults";
import { FILL_OPTIONS } from "../src/lib/data";
import { close } from "./helpers";

const drv = FILL_OPTIONS.find((o) => o.id === "bc10cxn64")!;

test("fills HF pad: the HF's sensitivity at 2.83 V over the woofer's", (t) => {
  close(
    t,
    fillDriverPadDb(drv),
    drv.hf!.sens + 10 * Math.log10(8 / ohmsOf(drv.hf!)) - drv.lfSens,
    1e-12,
  );
});
test("fills highpass slope: the default design stays LR24", () => {
  assert.equal(DEFAULT_FILL.highpassOrder, 4);
});
