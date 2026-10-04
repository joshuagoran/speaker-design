import { test } from "vite-plus/test";
import assert from "node:assert";
import fs from "node:fs";
import {
  GOAL_KEEPS,
  HIFI_KEEP_WORDS,
  PA_KEEP_WORDS,
  goalKeeps,
  keepLines,
  keepText,
  type KeepGoal,
} from "../src/lib/optimizer/goalKeeps";
import { OPTIMIZER_GOALS } from "../src/lib/pa/optimize";
import { HIFI_OPTIMIZER_GOALS } from "../src/lib/hifi/optimize";

const GOALS: KeepGoal[] = ["cheaper", "lighter", "lower", "louder"];

test("the keep limits are the ones the optimizers have always used", () => {
  assert.deepStrictEqual(GOAL_KEEPS, {
    cheaper: { db: 0.5, hz: 2 },
    lighter: { db: 0.5, hz: 2 },
    lower: { db: 1.5, hz: Infinity },
    louder: { db: Infinity, hz: 3 },
  });
  assert.deepStrictEqual(goalKeeps(100, 40), {
    cheaper: { db: 99.5, f3: 42 },
    lighter: { db: 99.5, f3: 42 },
    lower: { db: 98.5, f3: Infinity },
    louder: { db: -Infinity, f3: 43 },
  });
});

test("each goal's Details line states the constant's numbers", () => {
  for (const g of GOALS) {
    const k = GOAL_KEEPS[g];
    for (const words of [HIFI_KEEP_WORDS, PA_KEEP_WORDS]) {
      const t = keepText(g, "X", words);
      assert.strictEqual(t.includes(`at most ${k.db} dB`), Number.isFinite(k.db), t);
      assert.strictEqual(t.includes(`F3 rises at most ${k.hz} Hz`), Number.isFinite(k.hz), t);
    }
  }
  const hifi = GOALS.map((g) => keepText(g, HIFI_OPTIMIZER_GOALS[g].short, HIFI_KEEP_WORDS));
  assert.deepStrictEqual(hifi, [
    "Cheaper: your level drops at most 0.5 dB, your F3 rises at most 2 Hz.",
    "Lighter: your level drops at most 0.5 dB, your F3 rises at most 2 Hz.",
    "Lower: your level drops at most 1.5 dB.",
    "Louder: your F3 rises at most 3 Hz.",
  ]);
  const pa = GOALS.map((g) => keepText(g, OPTIMIZER_GOALS[g].short, PA_KEEP_WORDS));
  assert.deepStrictEqual(pa, [
    "Cheaper: output stays at most 0.5 dB under the target, your F3 rises at most 2 Hz.",
    "Lighter: output stays at most 0.5 dB under the target, your F3 rises at most 2 Hz.",
    "Lower: output stays at most 1.5 dB under the target.",
    "Louder: your F3 rises at most 3 Hz.",
  ]);
});

test("both optimizers build their keep tables from the constant", () => {
  const src = (p: string) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
  const hifi = src("../src/lib/hifi/optimize.ts"),
    pa = src("../src/lib/pa/optimize.ts");
  assert.match(hifi, /const keeps = \(cur: HifiMetrics\): Record<HifiGoal, Keep> => goalKeeps\(/);
  assert.match(pa, /const keep: Record<PaGoal, Keep> = goalKeeps\(target, curF3\)/);
  // no keep table spelled out by hand: no level or F3 offset next to a goal name
  for (const s of [hifi, pa])
    assert.doesNotMatch(s, /(cheaper|lighter|lower|louder): \{ db: [^}]*[-+] \d/);
});

test("the Details lines: one per picked goal and the footnote, or one honest line when your design can't be modelled", () => {
  assert.deepStrictEqual(keepLines([], OPTIMIZER_GOALS, PA_KEEP_WORDS, true), []);
  assert.deepStrictEqual(
    keepLines(["lower", "cheaper"], HIFI_OPTIMIZER_GOALS, HIFI_KEEP_WORDS, true),
    [
      keepText("lower", "Lower", HIFI_KEEP_WORDS),
      keepText("cheaper", "Cheaper", HIFI_KEEP_WORDS),
      HIFI_KEEP_WORDS.note,
    ],
  );
  // nothing of your design to keep: no limit is claimed
  for (const words of [HIFI_KEEP_WORDS, PA_KEEP_WORDS])
    assert.deepStrictEqual(keepLines(["cheaper"], OPTIMIZER_GOALS, words, false), [
      words.unmodelled,
    ]);
  assert.doesNotMatch(HIFI_KEEP_WORDS.unmodelled + PA_KEEP_WORDS.unmodelled, /at most/);
});
