// The PA optimizers search with a cursory brace estimate (BRACE_ESTIMATE: the box's size only), but your design and
// every card are built by the bracing rule, which also sees the driver's and the vent's keep-outs. The cards are picked,
// checked and turned down on the rule's numbers, so a card the estimate puts just inside a check can't land outside it
// once shown (issue #75).
import { test } from "vite-plus/test";
import assert from "node:assert";
import { designProblems, evaluateDesign, optimizePaStack } from "../src/lib/pa/optimize";
import { KEEP_UP_SLACK_DB } from "../src/lib/pa/chips";
import { paCurrent } from "./optimizer-dump-cases";
import { SEED_NAMES } from "./seeds";
import type { PaOptimizerInput } from "../src/types";

const input: PaOptimizerInput = {
  cur: paCurrent(SEED_NAMES.lightBlock),
  room: 1000,
  maxLb: 125,
  budget: 1100,
  goals: ["louder"],
  locks: {},
};

test("a shown card keeps the mid up with the sub by the bracing rule, not only by the estimate", () => {
  const out = optimizePaStack(input);
  const k = out.cards[0];
  assert.ok(k, out.goalMissing ?? "no card");
  // a wide box with a screwed back and a side duct each side: the rule's window frames (jointed rails on a 28″+ back)
  // are liters past the estimate's, and they take that much air from the box
  assert.equal(k.config.portStyle, "vslots");
  assert.ok(k.config.cDim.w >= 28, `a wide box: ${JSON.stringify(k.config.cDim)}`);
  const rule = evaluateDesign(k.config),
    estimate = evaluateDesign(k.config, true);
  assert.ok(rule && estimate);
  // the card shows the rule's numbers and passes every check by them
  assert.equal(k.metrics.out, rule.out);
  assert.equal(k.metrics.heaviest, rule.heaviest);
  assert.deepEqual(designProblems(rule, input), [], "the card passes by the rule");
  assert.ok(
    rule.midGap >= -KEEP_UP_SLACK_DB,
    `the mid keeps up by the rule: ${rule.midGap.toFixed(2)} dB`,
  );
  // the estimate reads the mid's gap over a tenth of a dB kinder: picked and turned down by it, a card can sit past the
  // check's slack by the rule (with the estimate before its wide-back fit, PR #102, a card here read -0.40 dB by the
  // estimate and -0.56 dB by the rule)
  assert.ok(
    estimate.midGap > rule.midGap + 0.1,
    `estimate ${estimate.midGap.toFixed(2)} dB, rule ${rule.midGap.toFixed(2)} dB`,
  );
});

test("every card and the near miss's closest design show the rule's numbers", () => {
  // a weight limit the design misses (a near miss) and the goal set above
  for (const run of [input, { ...input, maxLb: 60, goals: ["lighter" as const] }]) {
    const out = optimizePaStack(run);
    const shown = [...out.cards, ...(out.nearMiss?.closest ? [out.nearMiss.closest] : [])];
    assert.ok(shown.length, "something to check");
    for (const k of shown) {
      const m = evaluateDesign(k.config);
      assert.ok(m, k.label);
      assert.equal(k.metrics.out, m.out, `${k.label}: output`);
      assert.equal(k.metrics.heaviest, m.heaviest, `${k.label}: weight`);
      assert.equal(k.metrics.f3, m.f3, `${k.label}: F3`);
    }
    for (const k of out.cards)
      assert.deepEqual(designProblems(evaluateDesign(k.config), run), [], `${k.label} passes`);
  }
});
