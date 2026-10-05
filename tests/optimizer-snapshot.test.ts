import { test } from "vite-plus/test";
import assert from "node:assert";
import fs from "node:fs";
import { DUMP_CASES } from "./optimizer-dump-cases";
import type { DumpKind, Json } from "./optimizer-dump-merge";

// A quick slice of tests/optimizer-dump.json, run in the normal suite: a change to either optimizer that changes the
// cards it picks fails here. Check the new cards are right, then regenerate the dump (`vp run optimizer-dump`), which
// this test then reads.

// boundary: the dump is written by tests/optimizer-dump-merge.ts, one array of cases per kind
const dump = JSON.parse(
  fs.readFileSync(new URL("./optimizer-dump.json", import.meta.url), "utf8"),
) as Record<DumpKind, Json[]>;

// PA: three saved designs (lil block stack, rectangle sub, lil tower) on each goal alone at the $1100 budget. Each
// seed's cases are 2 budgets × 12 goal sets, the single goals first.
const PA = [4, 5, 9].flatMap((seed) => [0, 1, 2, 3].map((g) => seed * 24 + 12 + g));
// Hi-fi: the default design on cheaper, the radiator design on lower, the failing sealed design on louder (12 goal
// sets a design)
const HIFI = [0, 12 + 2, 24 + 3];

for (const [kind, cases] of [
  ["pa", PA],
  ["hifi", HIFI],
] as const)
  test(`optimizer snapshot: ${kind} cards match the dump`, () => {
    for (const i of cases)
      // through JSON, as the dump was written, so undefined fields drop the same way
      assert.deepStrictEqual(JSON.parse(JSON.stringify(DUMP_CASES[kind][i]())), dump[kind][i]);
  }, 60_000);
