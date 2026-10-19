// The Stack optimizer (src/lib/speaker/optimize/optimizeStack; docs/speaker-designer-plan.md, "Design: the Stack
// optimizer"). Each card is checked on its own design, run again through the page's code: its numbers, its label against
// your stack, the locks, the limits and the field steps. Then the near miss, determinism, a runtime bound, and parity
// with the PA optimizer on the four PA presets.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { optimizeStack } from "../src/lib/speaker/optimize/optimizeStack";
import { evaluateStack, speakerOf } from "../src/lib/speaker/optimize/stackEvaluate";
import { outerSize } from "../src/lib/speaker/optimize/evaluate";
import { driverRef } from "../src/lib/speaker/optimize/space";
import { presetLayers } from "../src/pages/stack/stackPresets";
import { STACK_PRESET, type StackPreset } from "../src/constants/stackPresets";
import { SPEAKER_STEPS, STACK_STEPS } from "../src/constants/speakerSteps";
import { AUTO_DELAY } from "../src/constants/speakerSpec";
import { CHANGE_NAMES } from "../src/constants/optimizerText";
import { PA_PRESETS, PARITY_TARGET_DB, paPresetParity } from "./stack-optimizer-parity";
import type {
  SpeakerGoal,
  StackDesign,
  StackOptimizerLimits,
  StackOptimizerLocks,
  StackOptimizerMetrics,
  StackOptimizerResult,
} from "../src/types";

/** A preset's stack and its speakers. */
function preset(p: StackPreset): StackDesign {
  const read = presetLayers(p, { id: "test", name: "Test" });
  return { stack: read.stack, speakers: read.speakers };
}

/** "Keep my level": the target is your stack's level, no budget, weight or height limit. */
const keepLevel = (m: StackOptimizerMetrics): StackOptimizerLimits => ({
  targetDb: m.musicDb ?? 0,
  budget: null,
  maxLb: null,
  maxHeightIn: null,
});

/** A card beats your stack on a goal by the margin its label promises. */
const BEATS: Record<SpeakerGoal, (a: StackOptimizerMetrics, b: StackOptimizerMetrics) => boolean> =
  {
    cheaper: (a, b) => a.price < b.price,
    lighter: (a, b) => a.lb <= b.lb - Math.min(3, Math.max(1, 0.05 * b.lb)) + 1e-9,
    smaller: (a, b) => a.volumeL <= b.volumeL * 0.95 + 1e-9,
    lower: (a, b) => (a.f3 ?? Infinity) <= (b.f3 ?? Infinity) - 2 + 1e-9,
    louder: (a, b) => (a.musicDb ?? -Infinity) >= (b.musicDb ?? -Infinity) + 1 - 1e-9,
  };

/** Whether `x` is on `step`. */
const onStep = (x: number, step: number) => Math.abs(x / step - Math.round(x / step)) < 1e-6;

/** The same numbers to 1e-6 (the card's against its design run again). */
function assertSameMetrics(a: StackOptimizerMetrics, b: StackOptimizerMetrics, what: string) {
  const round = (m: StackOptimizerMetrics) =>
    JSON.parse(
      JSON.stringify(m, (_k, v: unknown) =>
        typeof v === "number" ? Math.round(v * 1e6) / 1e6 : v,
      ),
    );
  assert.deepStrictEqual(round(a), round(b), `${what}: the card's numbers are its design's`);
}

/**
 * Runs the search and checks every card on its own design, run again from scratch: its numbers, its label against
 * your stack, the limits, the structure (boxes, poses, chamber kinds, band counts), the size locks and the steps; and
 * that the last check dropped nothing (#75).
 */
function checkedRun(
  p: StackPreset | { name: string; design: StackDesign },
  goals: SpeakerGoal[],
  limits?: Partial<StackOptimizerLimits>,
  locks?: StackOptimizerLocks,
): { r: StackOptimizerResult; design: StackDesign; m: StackOptimizerMetrics } {
  const design = typeof p === "string" ? preset(p) : p.design;
  const m = evaluateStack(design).metrics;
  const L = { ...keepLevel(m), ...limits };
  const r = optimizeStack(design, goals, L, locks);
  const what = `${typeof p === "string" ? p : p.name} ${goals.join("+")}`;
  assert.equal(r.stats.dropped, 0, `${what}: the last check dropped a card`);
  for (const card of r.cards) {
    const name = `${what} [${card.label}]`;
    const ev = evaluateStack(card.design);
    assertSameMetrics(card.metrics, ev.metrics, name);
    // the label is true against your stack
    const axes =
      card.slot.kind === "alt"
        ? [card.slot.axis]
        : card.slot.kind === "first" || card.slot.kind === "smallest"
          ? goals
          : [];
    for (const g of axes) assert.ok(BEATS[g](ev.metrics, m), `${name}: not ${g} than your stack`);
    // the limits hold on the final design
    if (L.budget !== null) assert.ok(ev.metrics.price <= L.budget + 1e-9, `${name}: over budget`);
    if (L.maxLb !== null)
      for (const box of ev.metrics.boxes)
        assert.ok(!box || box.lb <= L.maxLb + 1e-9, `${name}: a box over weight`);
    if (L.maxHeightIn !== null)
      assert.ok(ev.metrics.heightIn <= L.maxHeightIn + 0.01, `${name}: too tall`);
    // the structure stays: the members, their poses and speakers, each speaker's chamber kinds and band count
    const members = card.design.stack.members;
    assert.equal(members.length, design.stack.members.length, `${name}: the boxes`);
    members.forEach((mb, k) => {
      const was = design.stack.members[k];
      assert.deepStrictEqual(mb.pose, was.pose, `${name}: member ${k} pose`);
      assert.equal(mb.speakerId, was.speakerId, `${name}: member ${k} speaker`);
      assert.equal(mb.mirror, was.mirror);
      // the steps: a moved crossover on the corner step, a level on its step, a set delay on its step
      for (const side of ["highpass", "lowpass"] as const) {
        const a = mb.crossover[side],
          b = was.crossover[side];
        assert.equal(a === null, b === null, `${name}: member ${k} ${side}`);
        if (a && b && a.hz !== b.hz) {
          assert.ok(onStep(a.hz, SPEAKER_STEPS.filterHz), `${name}: ${side} ${a.hz} off its step`);
          assert.equal(a.type, b.type, `${name}: ${side} type`);
        }
      }
      if (mb.levelDb !== was.levelDb)
        assert.ok(onStep(mb.levelDb - was.levelDb, STACK_STEPS.levelDb), `${name}: level step`);
      assert.equal(mb.delayMs === AUTO_DELAY, was.delayMs === AUTO_DELAY, `${name}: auto delay`);
      if (mb.delayMs !== AUTO_DELAY && mb.delayMs !== was.delayMs)
        assert.ok(onStep(mb.delayMs, STACK_STEPS.delayMs), `${name}: delay step`);
    });
    for (const s of design.speakers) {
      const o = speakerOf(card.design, { speakerId: s.id });
      assert.ok(o, `${name}: speaker ${s.id}`);
      assert.equal(o.bands.length, s.bands.length, `${name}: ${s.id} band count`);
      assert.deepStrictEqual(o.input, s.input, `${name}: ${s.id} keeps its own input range`);
      o.cabinet.chambers.forEach((c, k) =>
        assert.equal(c.load.kind, s.cabinet.chambers[k].load.kind, `${name}: chamber kind`),
      );
      // the size locks hold on each speaker's outer size
      const size = locks?.speakers?.[s.id]?.size ?? {};
      const a = outerSize(o).sizeIn,
        b = outerSize(s).sizeIn;
      for (const axis of ["w", "h", "d"] as const) {
        if (size[axis] === "max")
          assert.ok(a[axis] - b[axis] <= 0.01, `${name}: larger on ${axis}`);
        if (size[axis] === "exact")
          assert.ok(Math.abs(a[axis] - b[axis]) <= 0.01, `${name}: ${axis} moved`);
      }
    }
    // a crossover between boxes moves on both sides together
    if (card.changed.includes(CHANGE_NAMES.boxCrossovers)) {
      const [sub, top] = members;
      if (sub?.crossover.lowpass && top?.crossover.highpass)
        assert.equal(sub.crossover.lowpass.hz, top.crossover.highpass.hz, `${name}: both sides`);
    }
  }
  return { r, design, m };
}

test("PA stack: every goal's cards beat your stack on their labels, on their own designs", () => {
  for (const g of ["cheaper", "lighter", "smaller", "lower", "louder"] as const) {
    const { r } = checkedRun(STACK_PRESET.paStack, [g]);
    assert.ok(r.cards.length > 0, `paStack ${g}: a card`);
  }
}, 60_000);

test("PA tower and the Hi-fi pair: one member keeps its level; stacked goals; a lower target", () => {
  for (const g of ["cheaper", "louder"] as const) {
    const { r } = checkedRun(STACK_PRESET.paTower, [g]);
    for (const card of r.cards) assert.equal(card.design.stack.members[0].levelDb, 0);
  }
  checkedRun(STACK_PRESET.hifiPair, ["cheaper"]);
  const { r } = checkedRun(STACK_PRESET.paStack, ["lighter", "cheaper"], {
    targetDb: PARITY_TARGET_DB,
  });
  assert.equal(r.cards[0]?.slot.kind, "first");
}, 60_000);

test("limits hold on the final design: budget, weight per box and height", () => {
  const { r } = checkedRun(STACK_PRESET.paStack, ["louder"], {
    targetDb: PARITY_TARGET_DB,
    budget: 1000,
    maxLb: 80,
    maxHeightIn: 60,
  });
  assert.ok(r.cards.length > 0, "a card inside the limits");
}, 60_000);

test("locks hold: a kept speaker, crossovers, levels, delays, a driver and a size", () => {
  const design = preset(STACK_PRESET.paStack);
  const [sub, top] = design.speakers;
  const between: StackOptimizerLocks = {
    keep: [sub.id],
    crossovers: [0, 1],
    levels: [0, 1],
    delays: [0, 1],
  };
  for (const g of ["cheaper", "lighter"] as const) {
    const { r } = checkedRun(STACK_PRESET.paStack, [g], { targetDb: PARITY_TARGET_DB }, between);
    for (const card of r.cards) {
      assert.deepStrictEqual(speakerOf(card.design, { speakerId: sub.id }), sub, "the kept sub");
      card.design.stack.members.forEach((m, k) => {
        const was = design.stack.members[k];
        assert.deepStrictEqual(m.crossover, was.crossover);
        assert.equal(m.levelDb, was.levelDb);
        assert.equal(m.delayMs, was.delayMs);
      });
    }
  }
  const inBox: StackOptimizerLocks = {
    speakers: {
      [top.id]: { drivers: [driverRef(0, 0)], horns: [driverRef(0, 1)], size: { w: "exact" } },
      [sub.id]: { size: { h: "max" } },
    },
  };
  const { r } = checkedRun(
    STACK_PRESET.paStack,
    ["cheaper"],
    { targetDb: PARITY_TARGET_DB },
    inBox,
  );
  for (const card of r.cards) {
    const t = speakerOf(card.design, { speakerId: top.id });
    assert.equal(
      t?.cabinet.chambers[0].drivers[0].driverId,
      top.cabinet.chambers[0].drivers[0].driverId,
    );
    assert.deepStrictEqual(
      t?.cabinet.chambers[0].drivers[1].horn,
      top.cabinet.chambers[0].drivers[1].horn,
    );
  }
}, 60_000);

test("near miss: a weight no box can make, and a target out of reach", () => {
  const { r } = checkedRun(STACK_PRESET.paStack, ["cheaper"], { maxLb: 20 });
  assert.ok(!r.cards.some((c) => c.slot.kind === "first"), "no first card");
  assert.ok(r.nearMiss, "a near miss");
  assert.ok(r.nearMiss.closest, "a closest design");
  assert.ok(r.nearMiss.blocking.length > 0, "what blocks it");
  const far = checkedRun(STACK_PRESET.paStack, ["cheaper"], { targetDb: 140 });
  assert.ok(far.r.nearMiss, "a near miss for a target out of reach");
}, 60_000);

test("two boxes share a speaker on different crossovers: each box's level follows its own passband", () => {
  // the PA stack plus a second top, mirrored, on its own highpass at 500 Hz and no lowpass
  const base = preset(STACK_PRESET.paStack);
  const [sub, top] = base.stack.members;
  assert.ok(top.crossover.highpass, "the top's highpass");
  const third = {
    ...top,
    mirror: !top.mirror,
    crossover: { highpass: { ...top.crossover.highpass, hz: 500 }, lowpass: null },
  };
  const design: StackDesign = { ...base, stack: { ...base.stack, members: [sub, top, third] } };
  const { r, m } = checkedRun({ name: "paStack + a 500 Hz top", design }, ["cheaper"]);
  const smallest = r.cards.find((c) => c.slot.kind === "smallest");
  assert.ok(smallest, "a smallest change");
  // it changes the top only (its mid driver and amps), so no box's balance moved: every box keeps its level
  assert.deepStrictEqual(
    smallest.speakers.map((s) => s.id),
    [top.speakerId],
  );
  assert.deepStrictEqual(
    smallest.design.stack.members.map((mb) => mb.levelDb),
    design.stack.members.map((mb) => mb.levelDb),
  );
  assert.ok(!smallest.changed.includes(CHANGE_NAMES.boxLevels), "no box levels");
  assert.ok((smallest.metrics.musicDb ?? 0) >= (m.musicDb ?? 0), "the stack's level holds");
}, 60_000);

test("the same input gives the same cards", () => {
  const design = preset(STACK_PRESET.paStack);
  const L = { ...keepLevel(evaluateStack(design).metrics), targetDb: PARITY_TARGET_DB };
  const run = () => {
    const { stats: _stats, ...rest } = optimizeStack(design, ["lighter", "cheaper"], L);
    return JSON.stringify(rest);
  };
  assert.equal(run(), run());
}, 60_000);

test("runtime: the PA stack's search takes a few seconds at most", () => {
  const design = preset(STACK_PRESET.paStack);
  const r = optimizeStack(design, ["cheaper"], keepLevel(evaluateStack(design).metrics));
  // about 1.5 s on a laptop in Node; CI machines are slower
  assert.ok(r.stats.ms < 10_000, `took ${r.stats.ms} ms`);
});

// Parity: each side's best card on the goal at the PA room rule's target (1000 sq ft), among the cards inside the Stack
// optimizer's space (the same driver sizes, plywood and vent style, each box ×0.7–1.5 per axis) that keep what the goal
// keeps, scored by the stack model.
// - The PA optimizer also changes the vent style (its cheaper and lower cards) and sizes the boxes past ×1.5 (its lower
//   and louder cards): those cards are outside the space.
// - Stack, pole and satellites have the same speakers; only the poses differ.
// - The tower: the PA optimizer finds no card (its mid chamber is fixed and fails its Qtc check, 0.48 < 0.5).
for (const [p, layout] of PA_PRESETS)
  test(`parity: the ${p} preset's cards are at least as good as the PA optimizer's`, () => {
    for (const g of ["cheaper", "lighter", "lower", "louder"] as const) {
      const run = paPresetParity(p, layout, g);
      assert.ok(run.stack.value !== null, `${p} ${g}: a card that keeps the goal`);
      assert.ok(run.stack.value < run.start, `${p} ${g}: better than the preset`);
      if (run.pa.value !== null)
        assert.ok(run.stack.value <= run.pa.value + 1e-6, `${p} ${g}: ${JSON.stringify(run)}`);
      if (p === STACK_PRESET.paTower) assert.equal(run.pa.cards, 0, "the PA tower finds no card");
    }
  }, 120_000);
