// The Stack page's optimizer UI state (src/pages/stack/useStackOptimizer, stackKeeps): loading a card replaces the stack as
// one edit under its id and name, Undo brings it back, the cards go stale when the stack changes after the search, and
// the Keep list's locks never move to another member or driver.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { optimizeStack } from "../src/lib/speaker/optimize/optimizeStack";
import { evaluateStack } from "../src/lib/speaker/optimize/stackEvaluate";
import { driverRef } from "../src/lib/speaker/optimize/space";
import { searchedIfCurrent } from "../src/hooks/useDesignOptimizer";
import { presetLayers } from "../src/pages/stack/stackPresets";
import { isKept, toggleKeep } from "../src/pages/speaker/speakerKeeps";
import { withoutMember } from "../src/pages/stack/useStack";
import {
  loadedStack,
  sameStackDesign,
  useStackOptimizer,
  withStackIdentity,
  type StackOptimizer,
} from "../src/pages/stack/useStackOptimizer";
import {
  MEMBER_LOCKS,
  allStackKept,
  countStackKept,
  heldKey,
  isMemberKept,
  isSpeakerKept,
  locksOfSpeaker,
  reconcileHeldStack,
  stackKeepItems,
  stackLockMax,
  toggleMemberKept,
  toggleSpeakerKept,
  withSpeakerLocks,
  type HeldStackLocks,
} from "../src/pages/stack/stackKeeps";
import { STACK_PRESET } from "../src/constants/stackPresets";
import { LOOSEN, SPEAKER_GOAL } from "../src/constants/speakerOptimizer";
import {
  STACK_NEAR_MISS_TEXT,
  STACK_OPTIMIZER_TEXT,
  STACK_PROBLEM_TEXT,
} from "../src/constants/stackOptimizer";
import { stackNearMissText } from "../src/pages/stack/StackOptimizerResults";
import type { StackDesign } from "../src/types";

const read = presetLayers(STACK_PRESET.paStack, { id: "saved-stack", name: "My stack" });
const design: StackDesign = {
  stack: { ...read.stack, notes: "my notes" },
  speakers: read.speakers,
};
/** A stack of three members, two of them on one speaker (the PA stack with a second top, mirrored). */
const satellites: StackDesign = {
  stack: {
    ...design.stack,
    members: [...design.stack.members, { ...design.stack.members[1], mirror: true }],
  },
  speakers: design.speakers,
};
const yours = evaluateStack(design).metrics;
const searched = optimizeStack(
  design,
  [SPEAKER_GOAL.cheaper],
  { targetDb: yours.musicDb ?? 0, budget: null, maxLb: null, maxHeightIn: null },
  {},
);
const { cards } = searched;

/**
 * Runs the optimizer hook on a design the steps change, a step a render: each step's state updates render the hook again
 * for the next one. Returns the design as the steps leave it, and how many times it was set.
 */
function runSteps(steps: ((hook: StackOptimizer) => void)[], from: StackDesign = design) {
  let current: StackDesign = from,
    sets = 0,
    done = 0;
  function Probe() {
    const hook = useStackOptimizer({
      design: current,
      loadDesign: (next) => {
        sets++;
        current = next;
      },
      round: 0,
      current: {
        musicDb: yours.musicDb,
        price: yours.price,
        maxBoxLb: Math.max(...yours.boxes.map((b) => b?.lb ?? 0)),
        heightIn: yours.heightIn,
      },
    });
    if (done < steps.length) steps[done++](hook);
    return null;
  }
  renderToString(createElement(Probe));
  assert.equal(done, steps.length, "every step ran");
  return { current, sets };
}

/** An edit to a member's level: a design change a search reads. */
const edited = (d: StackDesign): StackDesign => ({
  ...d,
  stack: {
    ...d.stack,
    members: d.stack.members.map((m, i) => (i ? m : { ...m, levelDb: m.levelDb - 1 })),
  },
});
const renamed = (d: StackDesign): StackDesign => ({
  ...d,
  stack: { ...d.stack, name: `${d.stack.name} 2`, notes: "other notes" },
});

test("the search gives cards to load", () => {
  assert.ok(cards.length >= 2, "two cards or more");
});

test("loading a card replaces the stack in one edit, under your stack's id, name and notes", () => {
  const [card] = cards;
  const after = runSteps([(h) => h.load(card)]);
  assert.deepEqual(after.current, loadedStack(card, design));
  assert.equal(after.sets, 1, "one edit");
  assert.equal(after.current.stack.id, "saved-stack");
  assert.equal(after.current.stack.name, "My stack");
  assert.equal(after.current.stack.notes, "my notes");
  assert.deepEqual(after.current.speakers, card.design.speakers, "the card's speakers");
  assert.deepEqual(after.current.stack.members, card.design.stack.members, "the card's members");
});

test("Undo after two loads in a row brings back the stack from before the first", () => {
  const [a, b] = cards;
  const after = runSteps([
    (h) => h.load(a),
    (h) => h.load(b),
    (h) => {
      assert.ok(h.canUndo, "Undo is offered");
      h.undoLoad();
    },
    (h) => assert.equal(h.canUndo, false, "nothing left to undo"),
  ]);
  assert.deepEqual(after.current, design, "your stack is back, id and name included");
});

test("Undo keeps the stack's id, name and notes as they are when it runs", () => {
  const [card] = cards;
  const under = withStackIdentity(design, renamed(design));
  assert.equal(under.stack.name, "My stack 2");
  assert.equal(under.stack.notes, "other notes");
  assert.equal(under.stack.members, design.stack.members, "the design itself is kept");
  const after = runSteps([(h) => h.load(card), (h) => h.undoLoad()]);
  assert.equal(after.current.stack.id, "saved-stack");
});

test("clearing the results (the stack replaced) ends Undo", () => {
  const [card] = cards;
  runSteps([
    (h) => h.load(card),
    (h) => {
      assert.ok(h.canUndo, "Undo is offered");
      h.clearResults();
    },
    (h) => assert.equal(h.canUndo, false, "no Undo after the stack is replaced"),
  ]);
});

test("a search that comes back for an older design is dropped", () => {
  const now = edited(design);
  assert.equal(searchedIfCurrent(design, now, searched, sameStackDesign), null);
  assert.deepEqual(searchedIfCurrent(design, renamed(design), searched, sameStackDesign), {
    from: design,
    result: searched,
  });
});

test("the target starts at your stack's level, rounded; a goal tap adds and removes in tap order", () => {
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

test("the limits start at your stack's price, heaviest box and height", () => {
  runSteps([
    (h) => {
      assert.ok(h.budgetStart >= yours.price && h.budgetStart - yours.price < 25 + 1e-9);
      const heaviest = Math.max(...yours.boxes.map((b) => b?.lb ?? 0));
      assert.ok(h.weightStart >= heaviest && h.weightStart - heaviest < 5 + 1e-9);
      assert.ok(h.heightStart >= yours.heightIn && h.heightStart - yours.heightIn < 1 + 1e-9);
      assert.equal(h.maxHeightIn, null, "no limit at first");
    },
  ]);
});

test("Keep list: each speaker the members name once, with its parts; the lock count and the lock all state", () => {
  const shared = stackKeepItems(satellites);
  const ids = new Set(satellites.stack.members.map((m) => m.speakerId));
  assert.ok(ids.size < satellites.stack.members.length, "two members name one speaker");
  assert.equal(shared.length, ids.size, "a speaker two members name shows once");
  const keeps = stackKeepItems(design);
  assert.ok(keeps.every((k) => k.items.length > 0));
  const all = allStackKept(design);
  assert.equal(countStackKept(all), stackLockMax(design), "every lock set");
  assert.equal(stackLockMax(design) >= design.stack.members.length * MEMBER_LOCKS.length, true);
  assert.equal(countStackKept({}), 0);
  const [{ speaker, items }] = keeps;
  const one = toggleSpeakerKept({}, speaker.id);
  assert.ok(isSpeakerKept(one, speaker.id));
  assert.equal(countStackKept(toggleSpeakerKept(one, speaker.id)), 0, "a second toggle unlocks it");
  const part = withSpeakerLocks({}, speaker.id, toggleKeep({}, items[0]));
  assert.ok(isKept(locksOfSpeaker(part, speaker.id), items[0]));
  assert.equal(countStackKept(part), 1);
  assert.deepEqual(withSpeakerLocks(part, speaker.id, {}), {}, "no locks left: no entry");
  const crossover = toggleMemberKept({}, "crossovers", 1);
  assert.ok(isMemberKept(crossover, "crossovers", 1));
  assert.ok(!isMemberKept(crossover, "levels", 1));
  assert.equal(countStackKept(toggleMemberKept(crossover, "crossovers", 1)), 0);
});

/** The held locks of a stack, as set on it. */
const heldOn = (d: StackDesign, locks: HeldStackLocks["locks"], round = 0): HeldStackLocks => ({
  ...heldKey(d, round),
  locks,
});

test("member locks hold their member: a member removed drops them, never moves them", () => {
  const n = satellites.stack.members.length;
  assert.ok(n >= 3, "three members");
  const locks = toggleMemberKept(toggleMemberKept({}, "crossovers", 0), "levels", 2);
  const held = heldOn(satellites, locks);
  // the same stack: the locks hold, and the object is the same
  assert.equal(reconcileHeldStack(held, satellites, 0), held);
  // the first member removed: the others move up a place, so no lock stays
  const first: StackDesign = {
    ...satellites,
    stack: { ...satellites.stack, members: withoutMember(satellites.stack.members, 0) },
  };
  assert.equal(countStackKept(reconcileHeldStack(held, first, 0).locks), 0);
  // a middle member removed: the same
  const middle: StackDesign = {
    ...satellites,
    stack: { ...satellites.stack, members: withoutMember(satellites.stack.members, 1) },
  };
  assert.equal(countStackKept(reconcileHeldStack(held, middle, 0).locks), 0);
  // the last member removed: two members name one speaker, so which one went can't be told: no lock stays
  const last: StackDesign = {
    ...satellites,
    stack: { ...satellites.stack, members: withoutMember(satellites.stack.members, n - 1) },
  };
  const afterLast = reconcileHeldStack(held, last, 0);
  assert.equal(countStackKept(afterLast.locks), 0);
  // and nothing comes back when a member is added again
  assert.equal(countStackKept(reconcileHeldStack(afterLast, satellites, 0).locks), 0);
  // a member added after the others: the locks stay where they were
  const grown = reconcileHeldStack(heldOn(last, locks), satellites, 0);
  assert.ok(isMemberKept(grown.locks, "crossovers", 0));
  // the stack replaced: every lock goes
  assert.equal(countStackKept(reconcileHeldStack(held, satellites, 1).locks), 0);
});

test("the last member removed: the locks stay on the members left, unless which one went can't be told", () => {
  // three members on three speakers (the PA stack with a second top under its own id)
  const top2 = { ...design.speakers[1], id: `${design.speakers[1].id}-2` };
  const three: StackDesign = {
    stack: {
      ...design.stack,
      members: [...design.stack.members, { ...design.stack.members[1], speakerId: top2.id }],
    },
    speakers: [...design.speakers, top2],
  };
  const locks = toggleMemberKept(
    toggleMemberKept(toggleMemberKept({}, "crossovers", 1), "levels", 0),
    "delays",
    2,
  );
  const last: StackDesign = {
    ...three,
    stack: { ...three.stack, members: withoutMember(three.stack.members, 2) },
  };
  const kept = reconcileHeldStack(heldOn(three, locks), last, 0).locks;
  assert.ok(isMemberKept(kept, "crossovers", 1), "the lock on the second member stays");
  assert.ok(isMemberKept(kept, "levels", 0), "the lock on the first member stays");
  assert.ok(!isMemberKept(kept, "delays", 2), "the removed member's lock goes");
  // two members on one speaker (the satellites): the test above, where no lock stays
});

test("a dropped member lock stays dropped when the same members come back", () => {
  const locks = toggleMemberKept({}, "delays", 0);
  const held = heldOn(satellites, locks);
  const first: StackDesign = {
    ...satellites,
    stack: { ...satellites.stack, members: withoutMember(satellites.stack.members, 0) },
  };
  const dropped = reconcileHeldStack(held, first, 0);
  assert.equal(countStackKept(dropped.locks), 0);
  // the members as they were: nothing revives
  assert.equal(countStackKept(reconcileHeldStack(dropped, satellites, 0).locks), 0);
});

test("speaker locks hold their speaker and its drivers: a speaker or a driver added or removed drops them, never moves them", () => {
  const keeps = stackKeepItems(design);
  const [{ speaker, items }, { speaker: other }] = keeps;
  const driver = items.find((i) => i.kind === "drivers");
  const amp = items.find((i) => i.kind === "amps");
  assert.ok(driver && amp, "a driver and an amp item");
  const locks = toggleSpeakerKept(
    withSpeakerLocks({}, speaker.id, toggleKeep(toggleKeep({}, driver), amp)),
    other.id,
  );
  const held = heldOn(design, locks);
  assert.equal(reconcileHeldStack(held, design, 0), held, "unchanged");
  // the speaker's driver entries change layout (a driver added in its first chamber): no driver lock, the others stay
  const grown: StackDesign = {
    ...design,
    speakers: design.speakers.map((s) =>
      s.id !== speaker.id
        ? s
        : {
            ...s,
            cabinet: {
              ...s.cabinet,
              chambers: s.cabinet.chambers.map((c, k) =>
                k ? c : { ...c, drivers: [c.drivers[0], ...c.drivers] },
              ),
            },
          },
    ),
  };
  const now = reconcileHeldStack(held, grown, 0);
  const mine = locksOfSpeaker(now.locks, speaker.id);
  assert.equal(mine.drivers, undefined, "no driver lock");
  assert.ok(isKept(mine, amp), "the other locks stay");
  assert.ok(isSpeakerKept(now.locks, other.id), "the other speaker is still kept");
  // the first entry removed again: the lock does not come back onto the driver that is first now
  const back = reconcileHeldStack(now, design, 0);
  assert.equal(locksOfSpeaker(back.locks, speaker.id).drivers, undefined, "it stays dropped");
  const second = { kind: "drivers", ref: driverRef(0, 1), label: "", group: "drivers" } as const;
  assert.ok(!isKept(locksOfSpeaker(back.locks, speaker.id), second), "not on the next driver");
  // a speaker no member names any more loses its locks, and they stay lost when a member names it again
  const without: StackDesign = {
    stack: {
      ...design.stack,
      members: design.stack.members.filter((m) => m.speakerId !== other.id),
    },
    speakers: design.speakers.filter((s) => s.id !== other.id),
  };
  const gone = reconcileHeldStack(held, without, 0);
  assert.ok(!isSpeakerKept(gone.locks, other.id));
  assert.ok(isKept(locksOfSpeaker(gone.locks, speaker.id), driver), "the other speaker keeps its");
  assert.ok(!isSpeakerKept(reconcileHeldStack(gone, design, 0).locks, other.id));
});

test("the fold's words: the limits, the keep hint and the summary name a stack", () => {
  const T = STACK_OPTIMIZER_TEXT;
  assert.equal(T.summaryHeight(null), "no height limit");
  assert.equal(T.summaryHeight(72), "up to 72 in tall");
  assert.equal(T.summaryWeight(null), "no weight limit");
  assert.equal(T.summaryWeight(60), "up to 60 lb a box");
  assert.match(T.targetYours("113"), /stack/);
});

test("the near miss's weight is per box: the option, and the heaviest box where the weight limit blocks", () => {
  assert.equal(STACK_NEAR_MISS_TEXT.weight, `Raise box limit by ${Math.round(LOOSEN * 100)}%`);
  assert.equal(STACK_NEAR_MISS_TEXT.weightTip(90), "New limit: 90 lb a box");
  const closest = cards[0];
  assert.ok(closest, "a card");
  const heaviest = Math.max(...closest.metrics.boxes.map((b) => b?.lb ?? 0));
  assert.ok(heaviest < closest.metrics.lb, "the boxes weigh less than the stack");
  const blocked = stackNearMissText({
    closest,
    closestIsYours: false,
    blocking: [STACK_PROBLEM_TEXT.weight],
  });
  assert.ok(blocked.includes(STACK_NEAR_MISS_TEXT.heaviest(heaviest.toFixed(0))), blocked);
  assert.ok(!blocked.includes(`${closest.metrics.lb.toFixed(0)} lb`), blocked);
  const short = stackNearMissText({ closest, closestIsYours: false, blocking: [] });
  assert.ok(short.includes(`${closest.metrics.lb.toFixed(0)} lb`), short);
});
