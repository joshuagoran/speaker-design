import { test } from "vite-plus/test";
import assert from "node:assert";
import { beamHz, beamModeParams } from "../src/lib/plateModes";

/** relative difference */
const relDiff = (a: number, b: number) => Math.abs(a - b) / Math.abs(b);
const FIXED = 1e15;
test("beam: hinged π², fixed 22.373 (Blevins Table 8-1), and springs in between", () => {
  assert.ok(relDiff(beamModeParams(0, 0).Lam, Math.PI ** 4) < 1e-6);
  assert.ok(relDiff(Math.sqrt(beamModeParams(Infinity, Infinity).Lam), 22.373) < 1e-3);
  assert.ok(relDiff(Math.sqrt(beamModeParams(Infinity, 0).Lam), 15.418) < 1e-3);
  const mid = beamModeParams(3, 3).Lam;
  assert.ok(mid > Math.PI ** 4 && mid < 22.373 ** 2);
  assert.ok(relDiff(beamHz(1, 1, 30, FIXED, FIXED) / beamHz(1, 1, 30, 0, 0), 2.2667) < 1e-3);
});
