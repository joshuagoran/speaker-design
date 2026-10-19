// Keep-up at the crossovers (lib/speaker/keepUp): the chip warns past the slack (lib/speaker/chips KEEP_UP_SLACK_DB).
import { test } from "vite-plus/test";
import assert from "node:assert";
import { keepUpChip } from "../src/lib/speaker/keepUp";
test("keep-up: the check warns past the slack, and is ok within it", () => {
  assert.equal(keepUpChip({ hz: 120, gapDb: -0.6 }, "Sub", "Top")[0], "warn");
  assert.equal(keepUpChip({ hz: 120, gapDb: -0.4 }, "Sub", "Top")[0], "ok");
});
