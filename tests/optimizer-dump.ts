import { test } from "vite-plus/test";
import fs from "node:fs";
import { DUMP_CASES, shardCases } from "./optimizer-dump-cases";
import { DUMP_ENV, DUMP_KINDS, PARTIAL_DIR } from "./optimizer-dump-merge";
import type { DumpPartial } from "./optimizer-dump-merge";

// One shard of tests/optimizer-dump.json (the cards both optimizers pick for a fixed set of designs and goal sets). A
// refactor of the card selection must leave the dump unchanged (`git diff --exit-code tests/optimizer-dump.json`).
// tests/optimizer-dump.config.ts runs this file once per shard, as its own project in its own worker, and merges the
// shards into the dump when the run ends. It is not part of `vp test` (the Hi-fi runs take seconds each):
//   vp run optimizer-dump        # both kinds
//   vp run optimizer-dump:pa     # PA only; the Hi-fi part of the dump is kept
//   vp run optimizer-dump:hifi   # Hi-fi only; the PA part is kept

const env = process.env;
const kind = DUMP_KINDS.find((k) => k === env[DUMP_ENV.kind]);
const shard = Number(env[DUMP_ENV.shard]);
const shards = Number(env[DUMP_ENV.shards]);

test(`optimizer dump: ${kind} shard ${shard + 1} of ${shards}`, () => {
  if (!kind || !(shard >= 0 && shard < shards)) {
    throw new Error("run the optimizer dump through tests/optimizer-dump.config.ts");
  }
  const partial: DumpPartial = {
    kind,
    total: DUMP_CASES[kind].length,
    cases: shardCases(kind, shard, shards).map((i) => [i, DUMP_CASES[kind][i]()]),
  };
  fs.mkdirSync(PARTIAL_DIR, { recursive: true });
  fs.writeFileSync(new URL(`${kind}-${shard + 1}.json`, PARTIAL_DIR), JSON.stringify(partial));
});
