// The Speaker page's optimizer UI state (src/pages/speaker/useSpeakerOptimizer, speakerKeeps): loading a card replaces
// the spec as one edit and Undo brings it back; the Keep list names the parts and its locks reach the search.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { optimizeSpeaker } from "../src/lib/speaker/optimize/optimizeSpeaker";
import { evaluateSpeaker } from "../src/lib/speaker/optimize/evaluate";
import { driverRef } from "../src/lib/speaker/optimize/space";
import { templateSpeaker } from "../src/pages/speaker/speakerTemplates";
import {
  useSpeakerOptimizer,
  type SpeakerOptimizer,
} from "../src/pages/speaker/useSpeakerOptimizer";
import {
  allKept,
  countKept,
  isKept,
  keepItems,
  pruneKept,
  toggleKeep,
} from "../src/pages/speaker/speakerKeeps";
import { SPEAKER_TEMPLATE } from "../src/constants/speakerStarts";
import { SPEAKER_GOAL } from "../src/constants/speakerOptimizer";
import type { SpeakerSpec } from "../src/types";

const spec = templateSpeaker(SPEAKER_TEMPLATE.hifiTwoWay);
const yours = evaluateSpeaker(spec).metrics;
const { cards } = optimizeSpeaker(
  spec,
  [SPEAKER_GOAL.cheaper],
  { targetDb: yours.musicDb ?? 0, budget: null, maxLb: null },
  {},
);

/**
 * Runs the optimizer hook on a spec the steps change, a step a render: each step's state updates render the hook again
 * for the next one. Returns the spec as the steps leave it, and how many times it was set.
 */
function runSteps(steps: ((hook: SpeakerOptimizer) => void)[]) {
  let current: SpeakerSpec = spec,
    sets = 0,
    done = 0;
  function Probe() {
    const hook = useSpeakerOptimizer({
      spec: current,
      loadSpec: (next) => {
        sets++;
        current = next;
      },
      round: 0,
      current: { musicDb: yours.musicDb, price: yours.price, lb: yours.lb },
    });
    if (done < steps.length) steps[done++](hook);
    return null;
  }
  renderToString(createElement(Probe));
  assert.equal(done, steps.length, "every step ran");
  return { current, sets };
}

test("loading a card replaces the spec in one edit", () => {
  const [card] = cards;
  assert.ok(card, "a card to load");
  const after = runSteps([(h) => h.load(card)]);
  assert.deepEqual(after.current, card.spec, "the card's design is the spec");
  assert.equal(after.sets, 1, "one edit");
});

test("Undo after two loads in a row brings back the design from before the first", () => {
  const [a, b] = cards;
  assert.ok(a && b, "two cards to load");
  const after = runSteps([
    (h) => h.load(a),
    (h) => h.load(b),
    (h) => {
      assert.ok(h.canUndo, "Undo is offered");
      h.undoLoad();
    },
    (h) => assert.equal(h.canUndo, false, "nothing left to undo"),
  ]);
  assert.deepEqual(after.current, spec, "your design is back");
});

test("the target starts at your design's level, rounded; a goal tap adds and removes in tap order", () => {
  runSteps([
    (h) => {
      assert.equal(h.targetDb, Math.round(yours.musicDb ?? 0));
      assert.ok(h.targetIsYours);
      assert.deepEqual(h.goals, []);
      h.tapGoal(SPEAKER_GOAL.louder);
    },
    (h) => h.tapGoal(SPEAKER_GOAL.cheaper),
    (h) => {
      assert.deepEqual(h.goals, [SPEAKER_GOAL.louder, SPEAKER_GOAL.cheaper]);
      h.tapGoal(SPEAKER_GOAL.louder);
    },
    (h) => assert.deepEqual(h.goals, [SPEAKER_GOAL.cheaper]),
  ]);
});

test("Keep list: one item per driver, horn, vent, filter and amp the spec has", () => {
  const items = keepItems(spec);
  const drivers = spec.cabinet.chambers.flatMap((c) => c.drivers);
  assert.equal(items.filter((i) => i.kind === "drivers").length, drivers.length);
  assert.equal(
    items.filter((i) => i.kind === "horns").length,
    drivers.filter((d) => d.horn).length,
  );
  assert.equal(items.filter((i) => i.kind === "amps").length, spec.bands.length);
  assert.equal(
    items.filter((i) => i.kind === "highpass").length,
    spec.bands.filter((b) => b.highpass).length,
  );
  assert.equal(
    items.filter((i) => i.kind === "lowpass").length,
    spec.bands.filter((b) => b.lowpass).length,
  );
  assert.ok(new Set(items.map((i) => i.label + i.kind)).size === items.length, "labels differ");
});

test("Keep list: toggling, locking all, counting and pruning", () => {
  const items = keepItems(spec);
  const first = items[0];
  const one = toggleKeep({}, first);
  assert.ok(isKept(one, first));
  assert.equal(countKept(one), 1);
  assert.equal(countKept(toggleKeep(one, first)), 0, "a second toggle unlocks it");
  const all = allKept(items);
  assert.equal(countKept(all), items.length + 3, "every item and the three box axes");
  assert.deepEqual(all.size, { w: "exact", h: "exact", d: "exact" });
  // a lock on a part the spec no longer has is dropped
  const stale = { drivers: [driverRef(9, 9)], vents: [7], amps: ["gone"] };
  assert.equal(countKept(pruneKept(stale, items)), 0);
  assert.equal(countKept(pruneKept(all, items)), items.length + 3);
});
