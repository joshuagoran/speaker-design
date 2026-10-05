import { test } from "vite-plus/test";
import assert from "node:assert";
import fs from "node:fs";
import { snapshotRuns } from "./optimizer-runs";

// The cards both optimizers pick for a few fixed designs and goals, against tests/optimizer-snapshot.json. A change
// to the optimizers that changes their picks fails here: check the new cards are right, then rewrite the file with
//   vp run optimizer-snapshot
// (and the full dump with `vp run optimizer-dump`).
test("optimizer snapshot: the cards for the fixed designs are unchanged", () => {
  const want: unknown = JSON.parse(
    fs.readFileSync(new URL("./optimizer-snapshot.json", import.meta.url), "utf8"),
  );
  // through JSON, as the file was written, so undefined fields drop the same way
  const got: unknown = JSON.parse(JSON.stringify(snapshotRuns()));
  assert.deepStrictEqual(got, want);
}, 60_000);
