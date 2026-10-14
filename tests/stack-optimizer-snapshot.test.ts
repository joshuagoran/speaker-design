import { test } from "vite-plus/test";
import assert from "node:assert";
import fs from "node:fs";
import { STACK_SNAPSHOT_FILE, stackSnapshotRuns } from "./stack-optimizer-snapshot";

// The cards the Stack optimizer picks for a few presets and goals, against tests/stack-optimizer-snapshot.json: a change
// to the optimizer that changes its cards fails here. If the new cards are right, rewrite the file with
// `vp run stack-optimizer-snapshot` (a few seconds).
test("Stack optimizer snapshot: the cards for the fixed presets are unchanged", () => {
  const want: unknown = JSON.parse(fs.readFileSync(STACK_SNAPSHOT_FILE, "utf8"));
  // through JSON, as the file was written, so undefined fields drop the same way
  assert.deepStrictEqual(JSON.parse(JSON.stringify(stackSnapshotRuns())), want);
}, 120_000);
