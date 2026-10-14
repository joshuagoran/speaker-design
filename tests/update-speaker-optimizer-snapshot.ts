import { test } from "vite-plus/test";
import fs from "node:fs";
import {
  SPEAKER_SNAPSHOT_FILE,
  speakerSnapshotRuns,
  speakerSnapshotText,
} from "./speaker-optimizer-snapshot";

// Rewrites tests/speaker-optimizer-snapshot.json, which tests/speaker-optimizer-snapshot.test.ts checks:
// `vp run speaker-optimizer-snapshot`.
test("write tests/speaker-optimizer-snapshot.json", () => {
  fs.writeFileSync(SPEAKER_SNAPSHOT_FILE, speakerSnapshotText(speakerSnapshotRuns()));
});
