import { test } from "vite-plus/test";
import assert from "node:assert";
import { optimizePaStack } from "../src/lib/pa/optimize";
import { optimizePaStackExact } from "../src/lib/pa/optimizeExact";
import { paCurrent } from "./optimizer-dump-cases";
import type { PaGoal, PaMetricsSummary, PaOptimizerInput } from "../src/types";

// Fully optimize searches a grid that holds everything the quick search tries, so its first card is never worse on the
// goal than Improve's. Run on saved designs with the sub driver, plywood and vent style locked (so the full search
// stays a few seconds); a quick-search change can't make the exact search look worse unnoticed, and an exact-search
// change that loses a design the quick one finds fails here.

/** How much better `a` is than `b` on the goal (negative: worse); ties go on to the weight for cheaper, as the cards do. */
const ahead: Record<PaGoal, (a: PaMetricsSummary, b: PaMetricsSummary) => number> = {
  cheaper: (a, b) => b.price - a.price || b.heaviest - a.heaviest,
  lighter: (a, b) => b.heaviest - a.heaviest,
  lower: (a, b) => b.f3 - a.f3,
  louder: (a, b) => a.out - b.out,
};

for (const name of ["rectangle sub"])
  test(`exact PA search: Fully optimize's first card is at least as good as Improve's (${name})`, () => {
    for (const goal of ["cheaper", "lighter", "lower", "louder"] as const) {
      const input: PaOptimizerInput = {
        cur: paCurrent(name),
        room: 1000,
        maxLb: 125,
        budget: 1100,
        goals: [goal],
        locks: { sub: true, wall: true, vent: true },
      };
      const quick = optimizePaStack(input).cards[0];
      const exact = optimizePaStackExact(input).cards[0];
      if (!quick) continue;
      assert.ok(exact, `${goal}: Improve found a card, Fully optimize none`);
      assert.ok(
        ahead[goal](exact.metrics, quick.metrics) >= -1e-9,
        `${goal}: Fully optimize ${JSON.stringify(exact.metrics)} is behind Improve ${JSON.stringify(quick.metrics)}`,
      );
    }
  }, 120_000);
