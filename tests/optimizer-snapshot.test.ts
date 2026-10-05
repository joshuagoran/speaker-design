import { test } from "vite-plus/test";
import assert from "node:assert";
import fs from "node:fs";
import { SNAPSHOT_FILE, snapshotRuns } from "./optimizer-snapshot";

// The cards both optimizers pick for a few fixed designs and goals (a quick slice of the optimizer dump's cases), run in
// the normal suite against tests/optimizer-snapshot.json: a change to either optimizer that changes the cards it picks
// fails here. If the new cards are right, rewrite the file with `vp run optimizer-snapshot` (about 25 s).
test("optimizer snapshot: the cards for the fixed designs are unchanged", () => {
  const want: unknown = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, "utf8"));
  // through JSON, as the file was written, so undefined fields drop the same way
  assert.deepStrictEqual(JSON.parse(JSON.stringify(snapshotRuns())), want);
}, 120_000);
