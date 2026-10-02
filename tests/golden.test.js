import { test } from "vite-plus/test";
import assert from "node:assert";
import fs from "node:fs";
import {
  configs as subConfigs,
  evaluate as evalSub,
  fillConfigs,
  evaluateFill,
} from "./golden-configs.js";
const configs = [
  ...subConfigs.map((c) => ({ ...c, run: evalSub })),
  ...fillConfigs.map((c) => ({ ...c, run: evaluateFill })),
];

// Regenerate after an intentional change:  UPDATE_GOLDEN=1 vp test --run tests/golden.test.js
const goldenUrl = new URL("./golden.json", import.meta.url);
if (process.env.UPDATE_GOLDEN === "1") {
  const out = {};
  for (const c of configs) out[c.name] = c.run(c);
  fs.writeFileSync(goldenUrl, JSON.stringify(out, null, 1) + "\n");
}
const golden = JSON.parse(fs.readFileSync(goldenUrl));
for (const c of configs) {
  test(`golden: ${c.name}`, (t) => {
    const want = golden[c.name],
      got = c.run(c);
    assert.ok(
      want,
      "missing from golden.json: run UPDATE_GOLDEN=1 vp test --run tests/golden.test.js",
    );
    for (const k of Object.keys(want)) {
      if (typeof want[k] === "number")
        assert.ok(
          Math.abs(got[k] - want[k]) <= 0.02 + 1e-4 * Math.abs(want[k]),
          `${k}: ${got[k]} vs ${want[k]}`,
        );
      else assert.equal(got[k], want[k], k);
    }
  });
}
