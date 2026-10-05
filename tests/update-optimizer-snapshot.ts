import { test } from "vite-plus/test";
import fs from "node:fs";
import { snapshotRuns } from "./optimizer-runs";

// Rewrites tests/optimizer-snapshot.json, which tests/optimizer-snapshot.test.ts checks: `vp run optimizer-snapshot`.
test("write tests/optimizer-snapshot.json", () => {
  fs.writeFileSync(
    new URL("./optimizer-snapshot.json", import.meta.url),
    JSON.stringify(snapshotRuns(), null, 1) + "\n",
  );
});
