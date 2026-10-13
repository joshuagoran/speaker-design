import { test } from "vite-plus/test";
import fs from "node:fs";
import { STACK_SNAPSHOT_FILE, stackSnapshotRuns } from "./stack-optimizer-snapshot";
import { speakerSnapshotText } from "./speaker-optimizer-snapshot";

// Rewrites tests/stack-optimizer-snapshot.json, which tests/stack-optimizer-snapshot.test.ts checks:
// `vp run stack-optimizer-snapshot`. The file's layout is the Speaker snapshot's: a run's head on a line, each card on one.
test("write tests/stack-optimizer-snapshot.json", () => {
  fs.writeFileSync(STACK_SNAPSHOT_FILE, speakerSnapshotText(stackSnapshotRuns()));
});
