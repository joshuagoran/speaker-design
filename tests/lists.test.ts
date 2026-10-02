import { test } from "vite-plus/test";
import assert from "node:assert";
import { toggled, countLocks } from "../src/lib/lists";

test("toggled adds a missing item at the end and removes a present one, keeping the order", () => {
  assert.deepStrictEqual(toggled(["cheaper"], "louder"), ["cheaper", "louder"]);
  assert.deepStrictEqual(toggled(["cheaper", "louder", "lower"], "louder"), ["cheaper", "lower"]);
  assert.deepStrictEqual(toggled([], "lighter"), ["lighter"]);
  assert.deepStrictEqual(toggled(["lighter"], "lighter"), []);
});

test("toggled leaves the list it was given alone", () => {
  const goals = ["cheaper", "lower"] as const;
  toggled(goals, "louder");
  toggled(goals, "cheaper");
  assert.deepStrictEqual(goals, ["cheaper", "lower"]);
});

test("countLocks counts each on/off lock that is on and each box dimension that is not free", () => {
  assert.strictEqual(countLocks({ dim: {} }), 0);
  assert.strictEqual(countLocks({ woofer: true, xo: false, wall: true, dim: {} }), 2);
  assert.strictEqual(countLocks({ woofer: true, dim: { w: "exact", h: "free", d: "max" } }), 3);
  assert.strictEqual(
    countLocks({ sub: true, subDim: { w: "exact" }, midDim: { w: "max", h: "max", d: "free" } }),
    4,
  );
});

test("countLocks of the lock-everything setting is the most the optimizer bar can show", () => {
  const all = {
    sub: true,
    mid: true,
    subDim: { w: "exact", h: "exact", d: "exact" },
    midDim: { w: "exact", h: "exact", d: "exact" },
  };
  assert.strictEqual(countLocks(all), 8);
});
