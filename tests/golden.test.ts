import { test } from "vite-plus/test";
import assert from "node:assert";
import fs from "node:fs";
import {
  configs as subConfigs,
  evaluate as evalSub,
  fillConfigs,
  evaluateFill,
  type GoldenValues,
} from "./golden-configs.ts";
const configs = [
  ...subConfigs.map((c) => ({ name: c.name, run: () => evalSub(c) })),
  ...fillConfigs.map((c) => ({ name: c.name, run: () => evaluateFill(c) })),
];

// Regenerate after an intentional change:  UPDATE_GOLDEN=1 vp test --run tests/golden.test.ts
// Only that single-file invocation is supported: a full-suite run with UPDATE_GOLDEN=1 rewrites golden.json while
// tests/optimize.test.ts reads it in a parallel worker.
const goldenUrl = new URL("./golden.json", import.meta.url);
if (process.env.UPDATE_GOLDEN === "1") {
  const out: Record<string, GoldenValues> = {};
  for (const c of configs) out[c.name] = c.run();
  fs.writeFileSync(goldenUrl, JSON.stringify(out, null, 1) + "\n");
}
// boundary: golden.json is what `UPDATE_GOLDEN` wrote above
const golden = JSON.parse(fs.readFileSync(goldenUrl, "utf8")) as Record<string, GoldenValues>;
for (const c of configs) {
  test(`golden: ${c.name}`, (t) => {
    const want = golden[c.name],
      got = c.run();
    assert.ok(
      want,
      "missing from golden.json: run UPDATE_GOLDEN=1 vp test --run tests/golden.test.ts",
    );
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
