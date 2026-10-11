// The PA optimizers search with a cursory brace estimate (BRACE_ESTIMATE: the box's size only), but your design and
// every card are built by the bracing rule, which also sees the driver's and the vent's keep-outs. The cards are picked,
// checked and turned down on the rule's numbers, so a card the estimate puts just inside a check can't land outside it
// once shown (issue #75).
import { test } from "vite-plus/test";
import assert from "node:assert";
import { designProblems, evaluateDesign, optimizePaStack } from "../src/lib/pa/optimize";
import { optimizePaStackExact, PA_EXACT_SLOT_ROUNDS } from "../src/lib/pa/optimizeExact";
import { KEEP_UP_SLACK_DB } from "../src/lib/pa/chips";
import { paCurrent } from "./optimizer-dump-cases";
import { SEED_NAMES } from "./seeds";
import type { Dims3, PaGoal, PaOptimizerInput } from "../src/types";

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

/** Light block with the sub, its vent and the box height locked: its wide boxes are where the estimate and the rule part. */
const LOCKED: PaOptimizerInput["locks"] = { sub: true, vent: true, subDim: { h: "exact" } };

test("with the sub, vent and height locked, every card both optimizers show passes by the rule", () => {
  // light block's wide boxes: by the searches' brace estimate the loud and low ones sit just under the 125 lb limit, and
  // by the rule several are over it (before the re-check, Fully optimize's Louder card was a 39 × 24 × 32 box at 129.5 lb,
  // 117.7 lb by the estimate)
  for (const goal of ["lower", "louder"] as const satisfies PaGoal[]) {
    const run: PaOptimizerInput = {
      ...input,
      goals: [goal],
      locks: LOCKED,
    };
    for (const [name, out] of [
      ["Improve", optimizePaStack(run)],
      ["Fully optimize", optimizePaStackExact(run)],
    ] as const) {
      assert.ok(out.cards.length, `${goal}, ${name}: cards`);
      for (const k of out.cards)
        assert.deepEqual(
          designProblems(evaluateDesign(k.config), run),
          [],
          `${goal}, ${name}: ${k.label} (${k.metrics.heaviest.toFixed(1)} lb)`,
        );
    }
  }
});

test("Improve's further finalists: a Louder card the first batch by the estimate didn't hold", () => {
  // light block, locked: every Louder finalist by the estimate is over 125 lb by the rule; the next box pairs by the
  // estimate (PA_FINALIST_BATCHES) hold a 33 × 24 × 32 box that passes, 115.7 lb and 121.7 dB by the rule
  const out = optimizePaStack({ ...input, locks: LOCKED });
  const k = out.cards[0];
  assert.ok(k && k.slot.kind === "first", out.goalMissing ?? "no Louder card");
  assert.deepEqual(designProblems(evaluateDesign(k.config), input), [], "it passes by the rule");
  assert.ok(k.metrics.heaviest <= input.maxLb, `${k.metrics.heaviest.toFixed(1)} lb`);
  assert.ok(out.curM && k.metrics.out >= out.curM.out + 1, `${k.metrics.out.toFixed(2)} dB`);
});

test("Fully optimize at 110 lb, locked: the cards an unbounded re-check gives, in a few rounds", () => {
  // by the estimate, scores of light block's wide boxes are under 110 lb that the rule puts over; once the rule puts one
  // over, the slot weighs the boxes near the limit by the rule, so the grid doesn't hand them over one by one. The
  // cards are those of the same run with no fallback or round limit (checked when this was written)
  const box = (k: { config: { cDim: Dims3 } } | undefined) => k && JSON.stringify(k.config.cDim);
  const run = (goals: PaGoal[]) => {
    const r: PaOptimizerInput = { ...input, maxLb: 110, goals, locks: LOCKED };
    const out = optimizePaStackExact(r);
    for (const k of out.cards)
      assert.deepEqual(
        designProblems(evaluateDesign(k.config), r),
        [],
        `${goals.join(" + ")}: ${k.label}`,
      );
    const rounds = out.stats.rounds ?? Infinity;
    assert.ok(rounds < PA_EXACT_SLOT_ROUNDS / 10, `${goals.join(" + ")}: ${rounds} rounds`);
    return out;
  };
  const louder = run(["louder"]);
  const first = louder.cards.find((k) => k.slot.kind === "first");
  assert.equal(
    box(first),
    JSON.stringify({ w: 30, h: 24, d: 31.5 }),
    "Louder: a 30 × 24 × 31.5 box",
  );
  const cheaper = louder.cards.find((k) => k.slot.kind === "alt" && k.slot.axis === "cheaper");
  assert.equal(
    box(cheaper),
    JSON.stringify({ w: 25, h: 24, d: 17.5 }),
    "Cheaper: a 25 × 24 × 17.5 box",
  );
  const lowerLighter = run(["lower", "lighter"]);
  const lighter = lowerLighter.cards.find(
    (k) => k.slot.kind === "alt" && k.slot.axis === "lighter",
  );
  assert.equal(
    box(lighter),
    JSON.stringify({ w: 25, h: 24, d: 18 }),
    "Lighter: a 25 × 24 × 18 box",
  );
});
