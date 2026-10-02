import { test } from "vite-plus/test";
import assert from "node:assert";
import fs from "node:fs";
import { goldenCases, type GoldenValues } from "./golden-configs";

// Reads tests/golden.json and checks every case against it. After an intentional change, regenerate the snapshot with
//   vp run golden
// (tests/update-golden.ts; it is its own run, because rewriting golden.json inside the full suite races
// tests/optimize.test.ts, which reads it in a parallel worker).
const goldenUrl = new URL("./golden.json", import.meta.url);
// boundary: golden.json is what tests/update-golden.ts wrote
const golden = JSON.parse(fs.readFileSync(goldenUrl, "utf8")) as Record<string, GoldenValues>;
for (const c of goldenCases) {
  test(`golden: ${c.name}`, (t) => {
    const want = golden[c.name],
      got = c.run();
    assert.ok(want, "missing from golden.json: run `vp run golden`");
    for (const k of Object.keys(want)) {
      // the golden value is a number here, so the evaluation's value for the same key is too (a null reads as 0, as before)
      if (typeof want[k] === "number")
        assert.ok(
          Math.abs((got[k] as number) - want[k]) <= 0.02 + 1e-4 * Math.abs(want[k]),
          `${k}: ${got[k]} vs ${want[k]}`,
        );
      else assert.equal(got[k], want[k], k);
    }
  });
}
