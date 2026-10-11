import { test } from "vite-plus/test";
import assert from "node:assert";
import {
  beamHz,
  beamModeParams,
  holedPlateHz,
  restrainedPlateHz,
  HINGED_EDGES,
} from "../src/lib/plateModes";
import { BIRCH_PLY_STIFFNESS, MDF_STIFFNESS, plateFirstModeHz } from "../src/lib/bracing";

const IN = 0.0254;
/** relative difference */
const relDiff = (a: number, b: number) => Math.abs(a - b) / Math.abs(b);
const FIXED = 1e15;
const allEdges = (k: number) => ({ x0: k, x1: k, y0: k, y1: k });
// an isotropic square, ν = 0, for the textbook's frequency parameter λ = ω a² √(ρh / D)
const iso = { t: 0.75, lbPerSqFt: 3.4, ...MDF_STIFFNESS, nu: 0 };
const A = 20;
const lambda = (f: number) => {
  const D = (iso.eStrong * (iso.t * IN) ** 3) / 12,
    rhoH = (iso.lbPerSqFt * 0.45359237) / 0.09290304;
  return 2 * Math.PI * f * (A * IN) ** 2 * Math.sqrt(rhoH / D);
};

test("beam: hinged π², fixed 22.373 (Blevins Table 8-1), and springs in between", () => {
  assert.ok(relDiff(beamModeParams(0, 0).Lam, Math.PI ** 4) < 1e-6);
  assert.ok(relDiff(Math.sqrt(beamModeParams(Infinity, Infinity).Lam), 22.373) < 1e-3);
  assert.ok(relDiff(Math.sqrt(beamModeParams(Infinity, 0).Lam), 15.418) < 1e-3);
  const mid = beamModeParams(3, 3).Lam;
  assert.ok(mid > Math.PI ** 4 && mid < 22.373 ** 2);
  assert.ok(relDiff(beamHz(1, 1, 30, FIXED, FIXED) / beamHz(1, 1, 30, 0, 0), 2.2667) < 1e-3);
});

test("plate: Warburton's shape gives Leissa's hinged square exactly and his clamped one within 0.5 %", () => {
  assert.ok(relDiff(lambda(restrainedPlateHz(A, A, iso, HINGED_EDGES)), 2 * Math.PI ** 2) < 1e-6);
  assert.ok(relDiff(lambda(restrainedPlateHz(A, A, iso, allEdges(FIXED))), 35.985) < 5e-3);
  // two opposite edges clamped, two hinged: 28.951 (Leissa Table 4.30)
  assert.ok(
    relDiff(lambda(restrainedPlateHz(A, A, iso, { x0: FIXED, x1: FIXED, y0: 0, y1: 0 })), 28.951) <
      5e-3,
  );
});

test("plate: hinged plywood reads plateFirstModeHz; any spring only lifts it", () => {
  const ply = { t: 0.5, lbPerSqFt: 1.5, ...BIRCH_PLY_STIFFNESS };
  for (const [a, b] of [
    [16, 31],
    [21, 16],
    [8, 30],
  ]) {
    const hinged = restrainedPlateHz(a, b, ply, HINGED_EDGES);
    assert.ok(relDiff(hinged, plateFirstModeHz(a, b, ply)) < 1e-6);
    assert.ok(restrainedPlateHz(a, b, ply, allEdges(500)) > hinged);
  }
});

test("holed plate: no hole reads the textbook square, hinged and clamped, within 1 %", () => {
  const none = { cx: A / 2, cy: A / 2, r: 0 };
  assert.ok(relDiff(lambda(holedPlateHz(A, A, iso, HINGED_EDGES, none)), 2 * Math.PI ** 2) < 1e-2);
  assert.ok(relDiff(lambda(holedPlateHz(A, A, iso, allEdges(FIXED), none)), 35.985) < 1e-2);
});

test("holed plate: a hole lifts a hinged plate (it takes the mass where the mode moves most); a driver's mass lowers it", () => {
  const ply = { t: 0.75, lbPerSqFt: 2.2, ...BIRCH_PLY_STIFFNESS };
  const hole = { cx: 10.5, cy: 13.75, r: 8.3 };
  const bare = plateFirstModeHz(21, 27.5, ply),
    holed = holedPlateHz(21, 27.5, ply, HINGED_EDGES, hole);
  assert.ok(holed > bare * 1.3, `${holed} vs ${bare}`);
  assert.ok(holedPlateHz(21, 27.5, ply, HINGED_EDGES, hole, 9) < bare);
});
