import { test } from "vite-plus/test";
import assert from "node:assert";
import fs from "node:fs";
import { SPEAKER_SNAPSHOT_FILE, speakerSnapshotRuns } from "./speaker-optimizer-snapshot";

// The cards the Speaker optimizer picks for a few templates and goals, against tests/speaker-optimizer-snapshot.json: a
// change to the optimizer that changes its cards fails here. If the new cards are right, rewrite the file with
// `vp run speaker-optimizer-snapshot` (a few seconds).
test("Speaker optimizer snapshot: the cards for the fixed templates are unchanged", () => {
  const want: unknown = JSON.parse(fs.readFileSync(SPEAKER_SNAPSHOT_FILE, "utf8"));
  // through JSON, as the file was written, so undefined fields drop the same way
  assert.deepStrictEqual(JSON.parse(JSON.stringify(speakerSnapshotRuns())), want);
}, 120_000);
