import { test } from "vite-plus/test";
import assert from "node:assert";
import { toggled } from "../src/lib/lists";

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
