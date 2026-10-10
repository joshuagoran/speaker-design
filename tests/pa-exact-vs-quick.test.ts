import { test } from "vite-plus/test";
import assert from "node:assert";
import { evaluateDesign, optimizePaStack } from "../src/lib/pa/optimize";
import { optimizePaStackExact } from "../src/lib/pa/optimizeExact";
import { paCurrent } from "./optimizer-dump-cases";
import type { PaGoal, PaMetricsSummary, PaOptimizerInput } from "../src/types";

// Fully optimize adds its grid's designs to the pool Improve picks from, so its first card is never behind Improve's,
// but for the rounding onto the planner's slider steps (ROUNDING): the exact grid cuts the depth and the duct to exact
// volumes and tunings, and the steps can cost those a fraction. Checked on saved designs with the sub driver,
// vent style and box height locked (and the plywood the optimizer's one size), so the full search stays about a second
// a run, including one (light block) where the exact grid alone finds a slightly heavier box than Improve's.

/**
 * How much better `a` is than `b` on the goal's own axis (negative: worse). Not the weight that breaks a price tie: on
 * a tie the two grids' boxes differ by fractions of a pound either way.
 */
type Scored = Pick<PaMetricsSummary, "price" | "heaviest" | "out" | "f3">;
/**
 * How far behind on its goal's own axis the slider steps may leave Fully optimize's first card: lb, Hz, dB. Light block's
 * lighter box from the exact grid (25 × 24 × 20.5″) comes out 0.04 lb over Improve's on its step.
 */
const ROUNDING: Record<PaGoal, number> = { cheaper: 0, lighter: 0.1, lower: 0.5, louder: 0.1 };
const summaryOf = ({ price, heaviest, out, f3 }: Scored): Scored => ({ price, heaviest, out, f3 });
const ahead: Record<PaGoal, (a: Scored, b: Scored) => number> = {
  cheaper: (a, b) => b.price - a.price,
  lighter: (a, b) => b.heaviest - a.heaviest,
  lower: (a, b) => b.f3 - a.f3,
  louder: (a, b) => a.out - b.out,
};

for (const name of ["rectangle sub", "lil block stack", "light block"])
  test(`exact PA search: Fully optimize's first card is at least as good as Improve's (${name})`, () => {
    for (const goal of ["cheaper", "lighter", "lower", "louder"] as const) {
      const input: PaOptimizerInput = {
        cur: paCurrent(name),
        room: 1000,
        maxLb: 125,
        budget: 1100,
        goals: [goal],
        locks: { sub: true, vent: true, subDim: { h: "exact" } },
      };
      const quick = optimizePaStack(input).cards[0];
      const exact = optimizePaStackExact(input).cards[0];
      // both find a card here, so the comparison is never vacuous
      assert.ok(quick, `${goal}: Improve found no card`);
      assert.ok(exact, `${goal}: Improve found a card, Fully optimize none`);
      // as both searches count the designs (the braces by estimate: the cards then show the rule's own numbers)
      const e = evaluateDesign(exact.config, true),
        q = evaluateDesign(quick.config, true);
      assert.ok(e && q, `${goal}: both cards are modeled`);
      assert.ok(
        ahead[goal](e, q) >= -ROUNDING[goal] - 1e-9,
        `${goal}: Fully optimize ${JSON.stringify(summaryOf(e))} is behind Improve ${JSON.stringify(summaryOf(q))}`,
      );
    }
  }, 60_000);
