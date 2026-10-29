// The Speaker page's optimizer UI state (src/pages/speaker/useSpeakerOptimizer, speakerKeeps): loading a card replaces
// the spec as one edit and Undo brings it back; the locks beside the settings reach the search, the fold's Locked line
// names them, and Clear locks removes them; the goal level follows your design until you change it.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { createElement, useState } from "react";
import { renderToString } from "react-dom/server";
import { optimizeSpeaker } from "../src/lib/speaker/optimize/optimizeSpeaker";
import { evaluateSpeaker } from "../src/lib/speaker/optimize/evaluate";
import {
  SPEAKER_OPTIMIZER_CATALOG,
  driverRef,
  searchUnits,
} from "../src/lib/speaker/optimize/space";
import { templateSpeaker } from "../src/pages/speaker/speakerTemplates";
import {
  useSpeakerOptimizer,
  type SpeakerOptimizer,
} from "../src/pages/speaker/useSpeakerOptimizer";
import {
  countKept,
  driverLayout,
  heldLocks,
  isKept,
  keepItems,
  lockedNames,
  pruneKept,
  reconcileHeld,
  sizeHeldByDriver,
  toggleKeep,
  withSizeLock,
} from "../src/pages/speaker/speakerKeeps";
import { SPEAKER_TEMPLATE } from "../src/constants/speakerStarts";
import { LOCK_TEXT } from "../src/constants/uiText";
import { BandSettings } from "../src/pages/speaker/BandSettings";
import type { LockControl } from "../src/components/ui/LockButton";
import { SPEAKER_GOAL } from "../src/constants/speakerOptimizer";
import type { SpeakerOptimizerLocks, SpeakerSpec } from "../src/types";

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

test("lock items: one per driver, horn, vent, filter and amp the spec has", () => {
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

test("a woofer's size lock: its own lock, held by its model's lock, and what the search tries", () => {
  const items = keepItems(spec);
  const size = items.find((i) => i.kind === "sizes");
  assert.ok(size, "the woofer has a size lock");
  const model = items.find((i) => i.kind === "drivers" && i.ref === size.ref);
  assert.ok(model);
  const sizeOnly = toggleKeep({}, size);
  assert.deepEqual(lockedNames(sizeOnly, items, 1), [size.label]);
  // the model's lock holds the size: the Locked line names the model only
  const both = toggleKeep(sizeOnly, model);
  assert.ok(sizeHeldByDriver(both, size));
  assert.deepEqual(lockedNames(both, items, 1), [model.label]);
  const { ref } = size;
  assert.ok(typeof ref === "string", "a size lock names a driver entry");
  const [k, j] = ref.split(".").map(Number);
  const own = spec.cabinet.chambers[k].drivers[j];
  const sizeOf = (id: string) =>
    [
      ...SPEAKER_OPTIMIZER_CATALOG.sub,
      ...SPEAKER_OPTIMIZER_CATALOG.mid,
      ...SPEAKER_OPTIMIZER_CATALOG.woofer,
    ].find((d) => d.id === id)?.size;
  const tried = (locks: SpeakerOptimizerLocks) => {
    const unit = searchUnits(spec, locks, SPEAKER_OPTIMIZER_CATALOG).find(
      (u) => u.kind === "cone" && u.chamber === k,
    );
    assert.ok(unit && unit.kind === "cone");
    return new Set(unit.drivers.map(sizeOf));
  };
  assert.ok(tried({}).size > 1, "free: other sizes too");
  assert.deepEqual([...tried(sizeOnly)], [sizeOf(own.driverId)], "size locked: its size only");
});

test("locks: toggling, counting and pruning", () => {
  const items = keepItems(spec);
  const first = items[0];
  const one = toggleKeep({}, first);
  assert.ok(isKept(one, first));
  assert.equal(countKept(one), 1);
  assert.equal(countKept(toggleKeep(one, first)), 0, "a second toggle unlocks it");
  const all = items.reduce(toggleKeep, {
    size: { 0: { w: "exact", h: "exact", d: "exact" } },
  } as const);
  // a woofer's size under its locked model counts once, with the model
  assert.equal(
    countKept(all),
    items.filter((i) => i.kind !== "sizes").length + 3,
    "every item and the chamber's three axes",
  );
  // a lock on a part the spec no longer has is dropped
  const stale = { drivers: [driverRef(9, 9)], vents: [7], amps: ["gone"] };
  assert.equal(countKept(pruneKept(stale, items)), 0);
  assert.equal(
    countKept(pruneKept(all, items)),
    items.filter((i) => i.kind !== "sizes").length + 3,
  );
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

test("a chamber added or removed drops the vent and size locks, which name a chamber by its place", () => {
  const two: SpeakerSpec = {
    ...spec,
    cabinet: { ...spec.cabinet, chambers: [...spec.cabinet.chambers, ...spec.cabinet.chambers] },
  };
  const held = { round: 0, layout: driverLayout(two), locks: withSizeLock({}, 1, "w", "exact") };
  assert.equal(
    countKept(heldLocks(held, { round: 0, layout: driverLayout(two) }, keepItems(two))),
    1,
  );
  const one = { ...two, cabinet: { ...two.cabinet, chambers: two.cabinet.chambers.slice(1) } };
  assert.equal(
    countKept(heldLocks(held, { round: 0, layout: driverLayout(one) }, keepItems(one))),
    0,
  );
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

test("a lock beside a setting reaches the search, the Locked line names it, and Clear locks removes every lock", () => {
  const amp = keepItems(spec).find((i) => i.kind === "amps");
  assert.ok(amp && amp.kind === "amps", "a band's amp lock");
  let pressed: LockControl | null = null;
  runSteps([
    (h) => {
      assert.deepEqual(h.lockedNames, []);
      assert.equal(LOCK_TEXT.locked(h.lockedNames), "Locked: nothing");
      const lock = h.partLock("amps", amp.ref);
      assert.ok(lock && !lock.locked);
      lock.onClick();
    },
    (h) => {
      // the search takes the hook's locks
      assert.deepEqual(h.locks.amps, [amp.ref]);
      assert.equal(h.partLock("amps", amp.ref)?.locked, true);
      pressed = h.partLock("amps", amp.ref);
      h.sizeLock(0, "w").onClick();
    },
    (h) => {
      assert.equal(h.sizeLock(0, "w").mark, "≤");
      assert.deepEqual(h.lockedNames, lockedNames(h.locks, keepItems(spec), 1));
      assert.equal(h.lockedNames[0], "width ≤", "the size first; one chamber: no chamber name");
      assert.equal(h.lockedNames[1], amp.label);
      assert.equal(h.nLocks, 2);
      h.clearLocks();
    },
    (h) => {
      assert.equal(h.nLocks, 0);
      assert.deepEqual(h.locks, {});
    },
  ]);
  // the band's settings draw the pressed lock beside its amp power
  const band = spec.bands.find((b) => b.id === amp.ref);
  assert.ok(band && pressed);
  const lock: LockControl = pressed;
  const markup = renderToString(
    createElement(BandSettings, {
      band,
      index: 0,
      count: 1,
      newCornerHz: 100,
      onEdit: () => {},
      locks: { partLock: (kind) => (kind === "amps" ? lock : null), sizeLock: () => lock },
    }),
  );
  assert.ok(
    markup.includes(`aria-label="${LOCK_TEXT.unlock(amp.label)}"`),
    "the amp lock, pressed",
  );
  assert.ok(markup.includes('aria-pressed="true"'));
});

test("a size lock cycles free, up to this size, exactly this size", () => {
  runSteps([
    (h) => {
      const free = h.sizeLock(0, "d");
      assert.equal(free.locked, false);
      assert.equal(free.unlocks, false);
      free.onClick();
    },
    (h) => {
      assert.equal(h.locks.size?.[0]?.d, "max");
      h.sizeLock(0, "d").onClick();
    },
    (h) => {
      const exact = h.sizeLock(0, "d");
      assert.equal(h.locks.size?.[0]?.d, "exact");
      assert.equal(exact.mark, "=");
      assert.equal(exact.unlocks, true, "the next tap frees it");
      exact.onClick();
    },
    (h) => assert.equal(h.locks.size?.[0]?.d, "free"),
  ]);
});

test("each chamber has its own size locks, named by the chamber", () => {
  const tower = templateSpeaker(SPEAKER_TEMPLATE.paTowerBaffleHorn);
  assert.ok(tower.cabinet.chambers.length > 1, "a box with more chambers");
  runSteps(
    [
      (h) => h.sizeLock(1, "w").onClick(),
      (h) => {
        assert.equal(h.locks.size?.[1]?.w, "max");
        assert.equal(h.sizeLock(0, "w").locked, false, "the other chambers stay free");
        assert.equal(h.sizeLock(1, "w").name, "Chamber 2 width");
        assert.deepEqual(h.lockedNames, ["Chamber 2 width ≤"]);
        assert.equal(h.nLocks, 1);
      },
    ],
    tower,
  );
});

test("the goal level follows your design until you change it", () => {
  let musicDb = 100.4;
  let done = 0;
  const steps: ((h: SpeakerOptimizer) => void)[] = [
    (h) => {
      assert.equal(h.targetDb, 100);
      musicDb = 103.2;
    },
    (h) => {
      assert.equal(h.targetDb, 103, "it follows the design");
      h.setTarget(110);
    },
    (h) => {
      assert.equal(h.targetDb, 110);
      musicDb = 90;
    },
    (h) => assert.equal(h.targetDb, 110, "it keeps your value"),
  ];
  function Probe() {
    // a render-time update renders the probe again, for the next step to read the new level
    const [tick, setTick] = useState(0);
    const hook = useSpeakerOptimizer({
      spec,
      loadSpec: () => {},
      round: 0,
      current: { musicDb, price: yours.price, lb: yours.lb },
    });
    if (done < steps.length) {
      steps[done++](hook);
      setTick(tick + 1);
    }
    return null;
  }
  renderToString(createElement(Probe));
  assert.equal(done, steps.length, "every step ran");
});
