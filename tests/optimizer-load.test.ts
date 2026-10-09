// Loading (applying) a PA optimizer card doesn't save the design it replaces: that design may not be worth keeping.
// Undo brings back, from memory (useDesignPreview), the design from before the first of the cards loaded in a row;
// Save on the card is the only write.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { usePaOptimizer, type PaOptimizer } from "../src/pages/pa-stack/hooks/usePaOptimizer";
import { optimizePaStack } from "../src/lib/pa/optimize";
import { DEFAULT_PA } from "../src/lib/defaults";
import type { ConfigCollection, ConfigDb, PaDesignConfig } from "../src/types";

const design: PaDesignConfig = {
  ...DEFAULT_PA,
  format: DEFAULT_PA.format.id,
  cabinet: DEFAULT_PA.cabinet.id,
  sub: DEFAULT_PA.sub.id,
  mid: DEFAULT_PA.mid.id,
  cd: DEFAULT_PA.cd.id,
  horn: DEFAULT_PA.horn.id,
  midBox: DEFAULT_PA.midBox.id,
};
const cards = optimizePaStack({
  cur: design,
  room: 1000,
  maxLb: 125,
  budget: 1100,
  goals: ["cheaper"],
  locks: {},
}).cards;

/** A database that records every write. */
function recordingDb() {
  const writes: Record<string, unknown>[] = [];
  const collection: ConfigCollection = {
    orderBy: () => collection,
    limit: () => collection,
    onSnapshot: () => () => {},
    doc: () => ({
      set: (data) => {
        writes.push(data);
        return Promise.resolve();
      },
      delete: () => Promise.resolve(),
    }),
  };
  const db: ConfigDb = { collection: () => collection };
  return { db, writes };
}

/**
 * Runs the PA optimizer hook on a design the steps change, a step a render: each step's state updates render the hook
 * again for the next one. Returns the design as the steps leave it.
 */
function runSteps(db: ConfigDb, steps: ((hook: PaOptimizer) => void)[]): PaDesignConfig {
  let current = design,
    done = 0;
  function Probe() {
    const hook = usePaOptimizer({
      snapshot: () => current,
      restore: (c) => {
        current = { ...current, ...c };
      },
      db,
      cutlist: { sheet: DEFAULT_PA.plywoodSheetKind, stacks: 1 },
    });
    if (done < steps.length) steps[done++](hook);
    return null;
  }
  renderToString(createElement(Probe));
  assert.equal(done, steps.length, "every step ran");
  return current;
}

test("loading a card sets the design and writes no saved configuration", () => {
  const [card] = cards;
  assert.ok(card, "a card to load");
  const { db, writes } = recordingDb();
  const after = runSteps(db, [(h) => h.loadOptimizerResult(card)]);
  assert.equal(after.sub, card.config.sub, "the card is applied");
  assert.deepEqual(after.cDim, card.config.cDim);
  assert.deepEqual(writes, [], "nothing is saved");
});

test("Undo after two loads in a row brings back the design from before the first", () => {
  const [a, b] = cards;
  assert.ok(a && b, "two cards to load");
  assert.notDeepEqual(a.config.cDim, b.config.cDim, "the cards differ");
  const { db, writes } = recordingDb();
  const after = runSteps(db, [
    (h) => h.loadOptimizerResult(a),
    (h) => h.loadOptimizerResult(b),
    (h) => {
      assert.deepEqual(h.undoSnapshot, design, "Undo holds the design from before the first load");
      h.undoOptimizerLoad();
    },
    (h) => assert.equal(h.undoSnapshot, null, "nothing left to undo"),
  ]);
  assert.deepEqual(after, design, "your design is back");
  assert.deepEqual(writes, [], "nothing is saved");
});

test("closing the toast ends the loads in a row: Undo then goes back one load", () => {
  const [a, b] = cards;
  assert.ok(a && b, "two cards to load");
  const after = runSteps(recordingDb().db, [
    (h) => h.loadOptimizerResult(a),
    (h) => h.dismissToast(),
    (h) => {
      assert.equal(h.undoSnapshot, null, "the toast's Undo goes with it");
      h.loadOptimizerResult(b);
    },
    (h) => h.undoOptimizerLoad(),
  ]);
  assert.deepEqual(after.cDim, a.config.cDim, "back to the first card, not to your design");
  assert.equal(after.sub, a.config.sub);
});
