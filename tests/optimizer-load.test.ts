// Loading (applying) a PA optimizer card doesn't save the design it replaces: that design may not be worth keeping.
// Undo brings it back from memory (useDesignPreview); Save on the card is the only write.
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

test("loading a card sets the design and writes no saved configuration", () => {
  const card = optimizePaStack({
    cur: design,
    room: 1000,
    maxLb: 125,
    budget: 1100,
    goals: ["cheaper"],
    locks: {},
  }).cards[0];
  assert.ok(card, "a card to load");
  // a database that records every write
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
  const restored: Partial<PaDesignConfig>[] = [];
  const hooks: PaOptimizer[] = [];
  function Probe() {
    hooks.push(
      usePaOptimizer({
        snapshot: () => design,
        restore: (c) => restored.push(c),
        db,
        cutlist: { sheet: DEFAULT_PA.plywoodSheetKind, stacks: 1 },
      }),
    );
    return null;
  }
  renderToString(createElement(Probe));
  const [hook] = hooks;
  assert.ok(hook, "the hook ran");
  hook.loadOptimizerResult(card);
  assert.equal(restored.length, 1, "the card is applied");
  assert.equal(restored[0].sub, card.config.sub);
  assert.deepEqual(writes, [], "nothing is saved");
});
