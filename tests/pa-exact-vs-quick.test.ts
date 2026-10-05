import { test } from "vite-plus/test";
import assert from "node:assert";
import { optimizePaStack } from "../src/lib/pa/optimize";
import { optimizePaStackExact } from "../src/lib/pa/optimizeExact";
import { paCurrent } from "./optimizer-dump-cases";
import type { PaGoal, PaMetricsSummary, PaOptimizerInput } from "../src/types";

// Fully optimize's grid is far finer than Improve's, though not a superset of it (Improve tunes on its own steps and
// volumes), so its first card isn't behind Improve's by construction; this checks that it isn't in practice, on saved
// designs with the sub driver, plywood, vent style and box height locked (so the full search stays about a second a
// run). A quick-search change that makes Fully optimize look worse, or an exact-search change that loses a design the
// quick one finds, fails here.

/**
 * How much better `a` is than `b` on the goal's own axis (negative: worse). Not the weight that breaks a price tie: on
 * a tie the two grids' boxes differ by fractions of a pound either way.
 */
const ahead: Record<PaGoal, (a: PaMetricsSummary, b: PaMetricsSummary) => number> = {
  cheaper: (a, b) => b.price - a.price,
  lighter: (a, b) => b.heaviest - a.heaviest,
  lower: (a, b) => b.f3 - a.f3,
  louder: (a, b) => a.out - b.out,
};

for (const name of ["rectangle sub", "lil block stack"])
  test(`exact PA search: Fully optimize's first card is at least as good as Improve's (${name})`, () => {
    for (const goal of ["cheaper", "lighter", "lower", "louder"] as const) {
      const input: PaOptimizerInput = {
        cur: paCurrent(name),
        room: 1000,
        maxLb: 125,
        budget: 1100,
        goals: [goal],
        locks: { sub: true, wall: true, vent: true, subDim: { h: "exact" } },
      };
      const quick = optimizePaStack(input).cards[0];
      const exact = optimizePaStackExact(input).cards[0];
      // both find a card here, so the comparison is never vacuous
      assert.ok(quick, `${goal}: Improve found no card`);
      assert.ok(exact, `${goal}: Improve found a card, Fully optimize none`);
      assert.ok(
        ahead[goal](exact.metrics, quick.metrics) >= -1e-9,
        `${goal}: Fully optimize ${JSON.stringify(exact.metrics)} is behind Improve ${JSON.stringify(quick.metrics)}`,
      );
    }
  }, 60_000);
