// The Speaker optimizer (src/lib/speaker/optimize).
// Each card is checked on its own design, run again through the page's code: its numbers, its label against your
// design, the locks, the limits and the field steps. Then the near miss, determinism, a runtime bound, and parity with
// the PA and Hi-fi optimizers on their templates.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { optimizeSpeaker } from "../src/lib/speaker/optimize/optimizeSpeaker";
import { evaluateSpeaker } from "../src/lib/speaker/optimize/evaluate";
import { driverRef } from "../src/lib/speaker/optimize/space";
import { templateSpeaker } from "../src/pages/speaker/speakerTemplates";
import { SPEAKER_TEMPLATE, type SpeakerTemplate } from "../src/constants/speakerStarts";
import { SPEAKER_STEPS } from "../src/constants/speakerSteps";
import { VENT_KIND } from "../src/constants/speakerSpec";
import { SPEAKER_GOAL_TEXT } from "../src/constants/speakerOptimizer";
import type {
  SpeakerGoal,
  SpeakerOptimizerLimits,
  SpeakerOptimizerLocks,
  SpeakerOptimizerMetrics,
  SpeakerOptimizerResult,
  SpeakerSpec,
} from "../src/types";

/** A template's speaker and its numbers. */
function start(t: SpeakerTemplate) {
  const spec = templateSpeaker(t);
  return { spec, m: evaluateSpeaker(spec).metrics };
}

/** "Keep my level": the target is your design's level, no budget or weight limit. */
const keepLevel = (m: SpeakerOptimizerMetrics): SpeakerOptimizerLimits => ({
  targetDb: m.musicDb ?? 0,
  budget: null,
  maxLb: null,
});

/** A card beats your design on a goal by the margin its label promises. */
const BEATS: Record<
  SpeakerGoal,
  (a: SpeakerOptimizerMetrics, b: SpeakerOptimizerMetrics) => boolean
> = {
  cheaper: (a, b) => a.price < b.price,
  lighter: (a, b) => a.lb <= b.lb - Math.min(3, Math.max(1, 0.05 * b.lb)) + 1e-9,
  smaller: (a, b) => a.volumeL <= b.volumeL * 0.95 + 1e-9,
  lower: (a, b) => (a.f3 ?? Infinity) <= (b.f3 ?? Infinity) - 2 + 1e-9,
  louder: (a, b) => (a.musicDb ?? -Infinity) >= (b.musicDb ?? -Infinity) + 1 - 1e-9,
};

/** Whether `x` is on `step` (a value the search kept may be off it). */
const onStep = (x: number, step: number) => Math.abs(x / step - Math.round(x / step)) < 1e-6;

/** Every value the card changed from yours is on its field's step. */
function assertSteps(card: SpeakerSpec, own: SpeakerSpec, what: string) {
  const changed = (a: number, b: number | undefined, step: number, name: string) => {
    if (b === undefined || a === b) return;
    assert.ok(onStep(a, step), `${what}: ${name} ${a} is off its ${step} step`);
  };
  card.cabinet.chambers.forEach((c, k) => {
    const o = own.cabinet.chambers[k];
    for (const axis of ["w", "h", "d"] as const)
      changed(c.dims[axis], o.dims[axis], SPEAKER_STEPS.sizeIn, `chamber ${k} ${axis}`);
    changed(c.at.xIn, o.at.xIn, SPEAKER_STEPS.sizeIn, `chamber ${k} x`);
    changed(c.at.yIn, o.at.yIn, SPEAKER_STEPS.sizeIn, `chamber ${k} y`);
    if (c.vent.kind === VENT_KIND.vented && o.vent.kind === VENT_KIND.vented)
      changed(
        c.vent.port.len,
        o.vent.port.len,
        SPEAKER_STEPS.portLenIn,
        `chamber ${k} port length`,
      );
    if (c.vent.kind === VENT_KIND.radiator && o.vent.kind === VENT_KIND.radiator)
      changed(
        c.vent.radiators.addG,
        o.vent.radiators.addG,
        SPEAKER_STEPS.addG,
        `chamber ${k} mass`,
      );
  });
  card.bands.forEach((b, i) => {
    const o = own.bands[i];
    changed(b.ampW, o.ampW, SPEAKER_STEPS.ampW, `band ${b.id} amp`);
    changed(b.levelDb, o.levelDb, SPEAKER_STEPS.levelDb, `band ${b.id} level`);
    // a crossover is on the corner step; a protection highpass on whole Hz (the PA rule)
    if (b.lowpass && o.lowpass)
      changed(b.lowpass.hz, o.lowpass.hz, SPEAKER_STEPS.filterHz, `band ${b.id} lowpass`);
    if (b.highpass && o.highpass) changed(b.highpass.hz, o.highpass.hz, 1, `band ${b.id} highpass`);
  });
}

/** The same numbers to 1e-6 (the card's against its design run again). */
function assertSameMetrics(a: SpeakerOptimizerMetrics, b: SpeakerOptimizerMetrics, what: string) {
  const round = (m: SpeakerOptimizerMetrics) =>
    JSON.parse(
      JSON.stringify(m, (_k, v: unknown) =>
        typeof v === "number" ? Math.round(v * 1e6) / 1e6 : v,
      ),
    );
  assert.deepStrictEqual(round(a), round(b), `${what}: the card's numbers are its design's`);
}

/**
 * Runs the search and checks every card on its own design: its numbers, its label, the limits and the steps; and that
 * the last check dropped nothing (the pool holds only final designs, #75).
 */
function checkedRun(
  t: SpeakerTemplate,
  goals: SpeakerGoal[],
  limits?: Partial<SpeakerOptimizerLimits>,
  locks?: SpeakerOptimizerLocks,
): { r: SpeakerOptimizerResult; spec: SpeakerSpec; m: SpeakerOptimizerMetrics } {
  const { spec, m } = start(t);
  const L = { ...keepLevel(m), ...limits };
  const r = optimizeSpeaker(spec, goals, L, locks);
  const what = `${t} ${goals.join("+")}`;
  assert.equal(r.stats.dropped, 0, `${what}: the last check dropped a card`);
  const caps = locks?.size ?? {};
  for (const card of r.cards) {
    const name = `${what} [${card.label}]`;
    const ev = evaluateSpeaker(card.spec);
    assertSameMetrics(card.metrics, ev.metrics, name);
    // the label is true against your design
    const axes =
      card.slot.kind === "alt"
        ? [card.slot.axis]
        : card.slot.kind === "first" || card.slot.kind === "smallest"
          ? goals
          : [];
    for (const g of axes) assert.ok(BEATS[g](ev.metrics, m), `${name}: not ${g} than your design`);
    // the limits hold on the final design
    if (L.budget !== null) assert.ok(ev.metrics.price <= L.budget + 1e-9, `${name}: over budget`);
    if (L.maxLb !== null) assert.ok(ev.metrics.lb <= L.maxLb + 1e-9, `${name}: over weight`);
    // the size locks hold on the outer size: no larger on a "max" axis, the same on an "exact" one
    for (const axis of ["w", "h", "d"] as const) {
      const off = ev.metrics.sizeIn[axis] - m.sizeIn[axis];
      if (caps[axis] === "max") assert.ok(off <= 0.01, `${name}: larger on ${axis}`);
      if (caps[axis] === "exact")
        assert.ok(Math.abs(off) <= 0.01, `${name}: ${axis} moved ${off.toFixed(2)} in`);
    }
    assertSteps(card.spec, spec, name);
    // the structure stays: the chamber kinds and the band count
    assert.equal(card.spec.bands.length, spec.bands.length);
    card.spec.cabinet.chambers.forEach((c, k) =>
      assert.equal(c.load.kind, spec.cabinet.chambers[k].load.kind, `${name}: chamber kind`),
    );
    assert.deepStrictEqual(card.spec.input, spec.input, `${name}: the input range stays`);
  }
  return { r, spec, m };
}

test("Hi-fi 2-way: every goal's cards beat your design on their labels, on their own designs", () => {
  for (const g of ["cheaper", "lighter", "smaller", "lower", "louder"] as const) {
    const { r } = checkedRun(SPEAKER_TEMPLATE.hifiTwoWay, [g]);
    assert.ok(r.cards.length > 0, `hifi ${g}: a card`);
  }
});

test("PA tower: cards for cheaper, louder and stacked goals; budget and weight limits hold", () => {
  const cheaper = checkedRun(SPEAKER_TEMPLATE.paTowerBaffleHorn, ["cheaper"]);
  assert.equal(cheaper.r.cards[0]?.slot.kind, "first");
  checkedRun(SPEAKER_TEMPLATE.paTowerBaffleHorn, ["louder"]);
  checkedRun(SPEAKER_TEMPLATE.paTowerBaffleHorn, ["lighter", "cheaper"], {
    budget: 1100,
    maxLb: 160,
  });
});

test("other templates: a sub, a mid/high box, a monitor and a fill keep their promises", () => {
  checkedRun(SPEAKER_TEMPLATE.paSubBox, ["lower"]);
  checkedRun(SPEAKER_TEMPLATE.paMidHighBox, ["smaller"], undefined, { size: { h: "max" } });
  checkedRun(SPEAKER_TEMPLATE.monitorHorn, ["cheaper", "louder"]);
  checkedRun(SPEAKER_TEMPLATE.fill, ["lighter"]);
});

test("locks hold: a locked driver, horn, vent, filter, amp and size stay as they are", () => {
  const { spec } = start(SPEAKER_TEMPLATE.paTowerBaffleHorn);
  const locks: SpeakerOptimizerLocks = {
    drivers: [driverRef(0, 0)],
    horns: [driverRef(2, 0)],
    vents: [0],
    highpass: [spec.bands[2].id],
    lowpass: [spec.bands[1].id],
    amps: [spec.bands[0].id],
    size: { w: "exact", h: "max" },
  };
  for (const g of ["cheaper", "lighter", "louder"] as const) {
    const { r } = checkedRun(SPEAKER_TEMPLATE.paTowerBaffleHorn, [g], undefined, locks);
    for (const card of r.cards) {
      const c = card.spec;
      assert.equal(
        c.cabinet.chambers[0].drivers[0].driverId,
        spec.cabinet.chambers[0].drivers[0].driverId,
      );
      assert.deepStrictEqual(
        c.cabinet.chambers[2].drivers[0].horn,
        spec.cabinet.chambers[2].drivers[0].horn,
      );
      assert.deepStrictEqual(c.cabinet.chambers[0].vent, spec.cabinet.chambers[0].vent);
      assert.deepStrictEqual(c.bands[2].highpass, spec.bands[2].highpass);
      assert.deepStrictEqual(c.bands[1].lowpass, spec.bands[1].lowpass);
      assert.equal(c.bands[0].ampW, spec.bands[0].ampW);
      c.cabinet.chambers.forEach((ch, k) =>
        assert.equal(ch.dims.w, spec.cabinet.chambers[k].dims.w),
      );
    }
  }
  // everything locked: nothing can change, so no card
  const hifi = start(SPEAKER_TEMPLATE.hifiTwoWay).spec;
  const all: SpeakerOptimizerLocks = {
    drivers: hifi.cabinet.chambers.flatMap((c, k) => c.drivers.map((_, j) => driverRef(k, j))),
    horns: hifi.cabinet.chambers.flatMap((c, k) => c.drivers.map((_, j) => driverRef(k, j))),
    vents: hifi.cabinet.chambers.map((_, k) => k),
    highpass: hifi.bands.map((b) => b.id),
    lowpass: hifi.bands.map((b) => b.id),
    amps: hifi.bands.map((b) => b.id),
    size: { w: "exact", h: "exact", d: "exact" },
  };
  const { r } = checkedRun(SPEAKER_TEMPLATE.hifiTwoWay, ["cheaper"], undefined, all);
  assert.equal(r.cards.length, 0);
});

test("an exact size lock holds the outer size, not only the chambers' (a part swap moves it)", () => {
  // a smaller horn narrowed the mid/high box and shortened the tower before the exact lock held the outer size
  for (const g of ["cheaper", "smaller", "lighter"] as const) {
    checkedRun(SPEAKER_TEMPLATE.paMidHighBox, [g], undefined, { size: { w: "exact" } });
    checkedRun(SPEAKER_TEMPLATE.paTowerTopHorn, [g], undefined, { size: { h: "exact" } });
  }
});

test("the first card says Same level only when the target is your level", () => {
  const { spec, m } = start(SPEAKER_TEMPLATE.hifiTwoWay);
  const at = (targetDb: number) =>
    optimizeSpeaker(spec, ["cheaper"], { ...keepLevel(m), targetDb }).cards.find(
      (c) => c.slot.kind === "first",
    );
  assert.equal(at(m.musicDb ?? 0)?.label, SPEAKER_GOAL_TEXT.cheaper.name);
  assert.equal(at(Math.floor((m.musicDb ?? 0) - 1))?.label, SPEAKER_GOAL_TEXT.cheaper.atTarget);
});

test("near miss: with no design inside the limits, the closest design and what fails", () => {
  const { r } = checkedRun(SPEAKER_TEMPLATE.paTowerBaffleHorn, ["cheaper"], { maxLb: 40 });
  assert.equal(r.cards.length, 0);
  assert.ok(r.nearMiss, "a near miss");
  assert.ok(r.nearMiss.closest, "a closest design");
  assert.ok(r.nearMiss.blocking.length > 0, "what blocks it");
  // a target out of reach: the near miss offers a lower target that finds a card
  const { m } = start(SPEAKER_TEMPLATE.hifiTwoWay);
  const far = checkedRun(SPEAKER_TEMPLATE.hifiTwoWay, ["cheaper"], {
    targetDb: (m.musicDb ?? 0) + 8,
  });
  assert.ok(far.r.nearMiss, "a near miss for a target out of reach");
});

test("the same input gives the same cards", () => {
  const { spec, m } = start(SPEAKER_TEMPLATE.hifiTwoWay);
  const run = () => {
    const { stats: _stats, ...rest } = optimizeSpeaker(spec, ["cheaper", "louder"], keepLevel(m));
    return JSON.stringify(rest);
  };
  assert.equal(run(), run());
});

test("runtime: the PA tower's search takes a few seconds at most", () => {
  const { spec, m } = start(SPEAKER_TEMPLATE.paTowerBaffleHorn);
  const r = optimizeSpeaker(spec, ["cheaper"], keepLevel(m));
  // about 1.5 s on a laptop in Node; CI machines are slower
  assert.ok(r.stats.ms < 10_000, `took ${r.stats.ms} ms`);
});
