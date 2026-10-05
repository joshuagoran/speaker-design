import { test } from "vite-plus/test";
import fs from "node:fs";
import { goalSets, hifiConfigs, hifiRun, paRun, seeds } from "./optimizer-runs";

// Rewrites tests/optimizer-dump.json: the cards both optimizers pick for a fixed set of designs and goal sets. A
// refactor of the card selection must leave it unchanged (`git diff --exit-code tests/optimizer-dump.json`). Run it
// on its own (it is not part of `vp test`, and the Hi-fi runs take minutes):
//   vp run optimizer-dump

test("write tests/optimizer-dump.json", () => {
  // the page's default budget, and the tests' (which leaves room for a "Smallest change" card)
  const pa = seeds.flatMap(({ name }) =>
    [900, 1100].flatMap((budget) => goalSets.map((goals) => paRun(name, budget, goals))),
  );
  const hifi = hifiConfigs.flatMap(({ name }) => goalSets.map((goals) => hifiRun(name, goals)));
  fs.writeFileSync(
    new URL("./optimizer-dump.json", import.meta.url),
    JSON.stringify({ pa, hifi }, null, 1) + "\n",
  );
});
