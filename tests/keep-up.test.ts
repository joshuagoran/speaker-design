// Keep-up at the crossovers (lib/speaker/keepUp) against the PA page's mid and horn checks (lib/pa/chips): the golden PA
// designs read in as stacks with their music balance in the band Levels (the PA presets').
import { test } from "vite-plus/test";
import assert from "node:assert";
import { keepUpChip } from "../src/lib/speaker/keepUp";
test("keep-up: the check warns past the PA page's slack, and is ok within it", () => {
  assert.equal(keepUpChip({ hz: 120, gapDb: -0.6 }, "Sub", "Top")[0], "warn");
  assert.equal(keepUpChip({ hz: 120, gapDb: -0.4 }, "Sub", "Top")[0], "ok");
});
