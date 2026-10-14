// The Space floor map by band (lib/speaker/spaceCoverage): moving a box changes a band's map as much as that box plays
// in the band. In the PA satellites space, the sub (low-passed at 120 Hz) moves the Sub band's map and barely the Mid or
// High band's; the mid/high boxes move the Mid and High maps far more than the sub does, and the Sub map far less.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { presetLayers } from "../src/pages/stack/stackPresets";
import { computeSpaceGrid, spaceGridRequest, spaceModel } from "../src/lib/speaker/spaceCoverage";
import { STACK_PRESET } from "../src/constants/stackPresets";
import type { CoverageBand, CoverageGrid, FloorPoint, SpaceDesign } from "../src/types";

/** A coarse grid: enough to compare the maps, quick to compute. */
const COLS = 20;

/** The PA satellites space: the sub (placement 0) midway, the tops (1, and its mirrored copy 2) on their stands. */
const layers = presetLayers(STACK_PRESET.paSatellite, { id: "sat", name: "sat" });
const DESIGN: SpaceDesign = {
  space: layers.space,
  stacks: [layers.stack],
  speakers: layers.speakers,
};
const SUB = 0,
  TOP = 1;

/** The space with placement `k` moved by `by`, ft (a lead moves its mirrored copy with it). */
const moved = (k: number, by: FloorPoint): SpaceDesign => ({
  ...DESIGN,
  space: {
    ...DESIGN.space,
    placements: DESIGN.space.placements.map((p, i) =>
      i === k ? { ...p, x: p.x + by.x, y: p.y + by.y } : p,
    ),
  },
});

/** A band's floor map at the space's music limit, dB SPL. */
const mapOf = (d: SpaceDesign, band: CoverageBand): CoverageGrid =>
  computeSpaceGrid(spaceGridRequest(spaceModel(d), d.space.venue, band, 1000, COLS));

/** How far two maps differ, dB: the mean of their cells' differences. */
function meanChange(a: CoverageGrid, b: CoverageGrid) {
  let sum = 0;
  a.db.forEach((v, i) => (sum += Math.abs(v - b.db[i])));
  return sum / a.db.length;
}

/** How much moving the sub and moving the tops (the same distance) change a band's map, dB. */
function changes(band: CoverageBand) {
  const by = { x: 4, y: 8 };
  const base = mapOf(DESIGN, band);
  return {
    sub: meanChange(base, mapOf(moved(SUB, by), band)),
    tops: meanChange(base, mapOf(moved(TOP, by), band)),
  };
}

test("space bands: moving the mid/high boxes changes the Mid map far more than moving the sub", () => {
  const { sub, tops } = changes("mid");
  assert.ok(tops > 4 * sub, `tops ${tops.toFixed(2)} dB, sub ${sub.toFixed(2)} dB`);
});

test("space bands: moving the sub changes the Sub map far more than moving the mid/high boxes", () => {
  const { sub, tops } = changes("sub");
  assert.ok(sub > 4 * tops, `sub ${sub.toFixed(2)} dB, tops ${tops.toFixed(2)} dB`);
});

test("space bands: the sub plays nothing in the High band; moving the mid/high boxes changes its map", () => {
  const { sub, tops } = changes("high");
  assert.ok(sub < 0.05, `sub ${sub.toFixed(3)} dB`);
  assert.ok(tops > 0.3, `tops ${tops.toFixed(2)} dB`);
});
