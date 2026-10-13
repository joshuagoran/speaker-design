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
  loadedSpec,
  speakerOptimizerView,
  useSpeakerOptimizer,
  type SpeakerOptimizer,
} from "../src/pages/speaker/useSpeakerOptimizer";
import {
  allKept,
  countKept,
  driverLayout,
  heldLocks,
  isKept,
  keepItems,
  pruneKept,
  reconcileHeld,
  toggleKeep,
} from "../src/pages/speaker/speakerKeeps";
import { SPEAKER_TEMPLATE } from "../src/constants/speakerStarts";
import { SPEAKER_GOAL } from "../src/constants/speakerOptimizer";
import type { SpeakerSpec } from "../src/types";

const spec = templateSpeaker(SPEAKER_TEMPLATE.hifiTwoWay);
const yours = evaluateSpeaker(spec).metrics;
const searched = optimizeSpeaker(
  spec,
  [SPEAKER_GOAL.cheaper],
  { targetDb: yours.musicDb ?? 0, budget: null, maxLb: null },
  {},
);
const { cards } = searched;

/**
 * Runs the optimizer hook on a spec the steps change, a step a render: each step's state updates render the hook again
 * for the next one. Returns the spec as the steps leave it, and how many times it was set.
 */
function runSteps(steps: ((hook: SpeakerOptimizer) => void)[], from: SpeakerSpec = spec) {
  let current: SpeakerSpec = from,
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

test("Load keeps your spec's id and name; clearing the results (the spec replaced) ends Undo", () => {
  const [card] = cards;
  assert.ok(card, "a card to load");
  const mine = { ...spec, id: "saved-1", name: "My speaker" };
  const after = runSteps(
    [
      (h) => h.load(card),
      (h) => {
        assert.ok(h.canUndo, "Undo is offered");
        h.clearResults();
      },
      (h) => assert.equal(h.canUndo, false, "no Undo after the spec is replaced"),
    ],
    mine,
  );
  assert.equal(after.current.id, "saved-1");
  assert.equal(after.current.name, "My speaker");
  assert.equal(after.current.cabinet, card.spec.cabinet, "the card's design");
});

test("stale cards: a design edit after the search; Undo ends with a design edit after a load", () => {
  const ran = { from: spec, result: searched };
  const edited = (s: SpeakerSpec): SpeakerSpec => ({
    ...s,
    bands: s.bands.map((b, i) => (i ? b : { ...b, levelDb: b.levelDb - 1 })),
  });
  const renamed = (s: SpeakerSpec): SpeakerSpec => ({ ...s, name: `${s.name} 2` });
  const view = speakerOptimizerView;
  assert.deepEqual(view(null, null, spec), { result: null, stale: false, canUndo: false });
  assert.equal(view(ran, null, spec).result, searched, "the result shows");
  assert.equal(view(ran, null, spec).stale, false, "on the design searched");
  assert.equal(view(ran, null, renamed(spec)).stale, false, "a new name changes no design");
  assert.equal(view(ran, null, edited(spec)).stale, true, "an edit after the search");
  // a card loaded: Undo and the cards hold until the design is edited
  const loaded = loadedSpec(cards[0], spec);
  const undo = { before: spec, loaded };
  assert.deepEqual(view(ran, undo, loaded), { result: searched, stale: false, canUndo: true });
  assert.equal(view(ran, undo, renamed(loaded)).canUndo, true, "a rename keeps Undo");
  assert.deepEqual(view(ran, undo, edited(loaded)), {
    result: searched,
    stale: true,
    canUndo: false,
  });
});

test("driver locks hold their driver: a driver added or removed drops them, never moves them", () => {
  // a chamber with two driver entries (the second a copy of the first)
  const two: SpeakerSpec = {
    ...spec,
    cabinet: {
      ...spec.cabinet,
      chambers: spec.cabinet.chambers.map((c, k) =>
        k ? c : { ...c, drivers: [c.drivers[0], ...c.drivers] },
      ),
    },
  };
  const items = keepItems(two);
  const second = items.find((i) => i.kind === "drivers" && i.ref === driverRef(0, 1));
  assert.ok(second, "the second driver's item");
  const vent = items.find((i) => i.kind === "vents" || i.kind === "amps");
  assert.ok(vent, "an item that isn't a driver");
  const held = {
    round: 0,
    layout: driverLayout(two),
    locks: toggleKeep(toggleKeep({}, second), vent),
  };
  // the same layout: the lock holds
  assert.ok(isKept(heldLocks(held, { round: 0, layout: driverLayout(two) }, items), second));
  // the first entry removed: the second moves to 0.0, its lock doesn't follow onto another driver
  const one: SpeakerSpec = {
    ...two,
    cabinet: {
      ...two.cabinet,
      chambers: two.cabinet.chambers.map((c, k) => (k ? c : { ...c, drivers: c.drivers.slice(1) })),
    },
  };
  const now = heldLocks(held, { round: 0, layout: driverLayout(one) }, keepItems(one));
  assert.equal(now.drivers, undefined, "no driver lock");
  assert.ok(isKept(now, vent), "the other locks stay");
  // the chamber list replaced: every lock goes
  assert.equal(countKept(heldLocks(held, { round: 1, layout: driverLayout(two) }, items)), 0);
});

test("a driver lock that stopped holding stays dropped when the driver comes back", () => {
  const items = keepItems(spec);
  const first = items.find((i) => i.kind === "drivers");
  assert.ok(first, "a driver item");
  const held = { round: 0, layout: driverLayout(spec), locks: toggleKeep({}, first) };
  assert.equal(reconcileHeld(held, { round: 0, layout: driverLayout(spec) }, items), held);
  // a driver entry added to the first chamber: the lock is dropped from the held locks, not only hidden
  const grown: SpeakerSpec = {
    ...spec,
    cabinet: {
      ...spec.cabinet,
      chambers: spec.cabinet.chambers.map((c, k) =>
        k ? c : { ...c, drivers: [c.drivers[0], ...c.drivers] },
      ),
    },
  };
  const now = reconcileHeld(held, { round: 0, layout: driverLayout(grown) }, keepItems(grown));
  assert.equal(now.locks.drivers, undefined, "dropped");
  // the entry removed again: the layout is yours again, and nothing comes back
  const back = reconcileHeld(now, { round: 0, layout: driverLayout(spec) }, items);
  assert.equal(countKept(back.locks), 0, "it stays dropped");
});
