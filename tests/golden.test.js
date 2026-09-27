import test from "node:test";
import fs from "node:fs";
import { configs as subConfigs, evaluate as evalSub, fillConfigs, evaluateFill } from "./golden-configs.js";
const configs = [...subConfigs.map((c) => ({ ...c, run: evalSub })), ...fillConfigs.map((c) => ({ ...c, run: evaluateFill }))];

// Regenerate after an intentional change:  node tests/make-golden.js
const golden = JSON.parse(fs.readFileSync(new URL("./golden.json", import.meta.url)));
for (const c of configs) {
  test(`golden: ${c.name}`, (t) => {
    const want = golden[c.name], got = c.run(c);
    t.assert.ok(want, "missing from golden.json: run node tests/make-golden.js");
    for (const k of Object.keys(want)) {
      if (typeof want[k] === "number") t.assert.ok(Math.abs(got[k] - want[k]) <= 0.02 + 1e-4 * Math.abs(want[k]), `${k}: ${got[k]} vs ${want[k]}`);
      else t.assert.equal(got[k], want[k], k);
    }
  });
}
