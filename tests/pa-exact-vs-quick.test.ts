import { test } from "vite-plus/test";
import assert from "node:assert";
import { optimizePaStack } from "../src/lib/pa/optimize";
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
/** How far behind on its goal's own axis the slider steps may leave Fully optimize's first card: lb, Hz, dB. */
const ROUNDING: Record<PaGoal, number> = { cheaper: 0, lighter: 0, lower: 0.5, louder: 0.1 };
/** On how many of the four goals each design must have a first card from Improve to compare (never vacuous). */
const MIN_COMPARED = 3;
/**
 * Where Improve has no card for the goal and Fully optimize has one, on Lighter: none of Improve's sub boxes is 3 lb
 * lighter than yours by the bracing rule, and the exact grid's are. Light block: Improve's lightest is your own
 * 30 × 24 × 18, 78.6 lb (its brace estimate reads 70.2 lb, and Improve used to offer it as lighter); the grid's
 * 25 × 24 × 20.5 is 71.9 lb. Lil block stack (your design fails a check, so Improve offers the fix): Improve's lightest
 * is 78.1 lb against your 79.8 lb, the estimate agreeing within 0.3 lb; the grid's is 75.6 lb.
 */
const IMPROVE_SHORT: [string, PaGoal][] = [
  ["light block", "lighter"],
  ["lil block stack", "lighter"],
];
const summaryOf = ({ price, heaviest, out, f3 }: Scored): Scored => ({ price, heaviest, out, f3 });
const ahead: Record<PaGoal, (a: Scored, b: Scored) => number> = {
  cheaper: (a, b) => b.price - a.price,
  lighter: (a, b) => b.heaviest - a.heaviest,
  lower: (a, b) => b.f3 - a.f3,
  louder: (a, b) => a.out - b.out,
};

for (const name of ["rectangle sub", "lil block stack", "light block"])
  test(`exact PA search: Fully optimize's first card is at least as good as Improve's (${name})`, () => {
    const compared: PaGoal[] = [];
    for (const goal of ["cheaper", "lighter", "lower", "louder"] as const) {
      const input: PaOptimizerInput = {
        cur: paCurrent(name),
        room: 1000,
        maxLb: 125,
        budget: 1100,
        goals: [goal],
        locks: { sub: true, vent: true, subDim: { h: "exact" } },
      };
      // the goal's own card (both pick on the bracing rule's numbers, as the cards show them)
      const quick = optimizePaStack(input).cards.find((k) => k.slot.kind === "first");
      const exact = optimizePaStackExact(input).cards.find((k) => k.slot.kind === "first");
      if (!quick) {
        // Improve finds nothing that keeps the goal: Fully optimize finds nothing either, but where Improve's own boxes
        // can't reach (IMPROVE_SHORT)
        const short = IMPROVE_SHORT.some(([n, g]) => n === name && g === goal);
        assert.equal(
          !!exact,
          short,
          `${goal}: Improve found no card; Fully optimize ${exact ? "did" : "neither"}`,
        );
        continue;
      }
      compared.push(goal);
      assert.ok(exact, `${goal}: Improve found a card, Fully optimize none`);
      assert.ok(
        ahead[goal](exact.metrics, quick.metrics) >= -ROUNDING[goal] - 1e-9,
        `${goal}: Fully optimize ${JSON.stringify(summaryOf(exact.metrics))} is behind Improve ${JSON.stringify(summaryOf(quick.metrics))}`,
      );
    }
    assert.ok(compared.length >= MIN_COMPARED, `compared on ${compared.join(", ")}`);
  }, 60_000);
