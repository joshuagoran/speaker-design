import os from "node:os";
import { defineConfig } from "vite-plus";
import type { Reporter } from "vite-plus/test/node";
import { DUMP_ENV, DUMP_KINDS, clearPartials, mergeDump } from "./optimizer-dump-merge";

// The config behind `vp run optimizer-dump` (and `optimizer-dump:pa` / `optimizer-dump:hifi`, which pick one kind's
// projects with --project): it runs only the optimizer dump writer, which the main config's test include leaves out.
// Each kind is split into one shard per core; each shard is its own project, so Vitest runs them in parallel worker
// threads. When the whole run passes, the reporter below merges the shards into tests/optimizer-dump.json.
const cores = os.availableParallelism();

const merge: Reporter = {
  onTestRunStart: clearPartials,
  onTestRunEnd: (_modules, errors, reason) => {
    if (reason === "passed" && !errors.length) mergeDump();
    clearPartials();
  },
};

export default defineConfig({
  test: {
    pool: "threads",
    maxWorkers: cores,
    // the Hi-fi search takes seconds per run, so a shard takes a minute or more
    testTimeout: 1_800_000,
    reporters: ["default", merge],
    projects: DUMP_KINDS.flatMap((kind) =>
      Array.from({ length: cores }, (_, shard) => ({
        extends: true,
        test: {
          name: `${kind}-${shard + 1}`,
          include: ["tests/optimizer-dump.ts"],
          env: {
            [DUMP_ENV.kind]: kind,
            [DUMP_ENV.shard]: String(shard),
            [DUMP_ENV.shards]: String(cores),
          },
        },
      })),
    ),
  },
});
