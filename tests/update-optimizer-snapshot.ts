import { test } from "vite-plus/test";
import fs from "node:fs";
import { SNAPSHOT_FILE, snapshotRuns, snapshotText } from "./optimizer-snapshot";

// Rewrites tests/optimizer-snapshot.json, which tests/optimizer-snapshot.test.ts checks: `vp run optimizer-snapshot`.
test("write tests/optimizer-snapshot.json", () => {
  fs.writeFileSync(SNAPSHOT_FILE, snapshotText(snapshotRuns()));
});
