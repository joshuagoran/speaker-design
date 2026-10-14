// Where the Space page reads its level (src/pages/space/useSpace referenceAtLimit) and the audience average it takes
// (lib/pa/coverage audienceAverage): each reference reads its own spots, and a missing one reads nothing.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { configs } from "./golden-configs";
import { PA_FLOOR, paDesign } from "./speaker-cases";
import { layersFromPa } from "../src/lib/speaker/paSpec";
import { audienceAverage, STATS_CLEARANCE_FT } from "../src/lib/pa/coverage";
import {
  spaceGridRequest,
  spaceLevelAt,
  spaceModel,
  computeSpaceGrid,
} from "../src/lib/speaker/spaceCoverage";
import { referenceAtLimit } from "../src/pages/space/useSpace";
import { COVERAGE_LEVEL_REF } from "../src/constants/coverageLevel";
import type { CoverageGrid, FloorPoint } from "../src/types";

const read = layersFromPa(paDesign(configs[0]), { id: "draft", name: "PA design" }, PA_FLOOR);
const design = { space: read.space, stacks: [read.stack], speakers: read.speakers };
const model = spaceModel(design);
const { venue } = design.space;
const COLS = 8;
const req = spaceGridRequest(model, venue, "mid", 1000, COLS);
const grid = computeSpaceGrid({ ...req, cols: COLS });
const boxes: FloorPoint[] = model.placements.map((p) => ({
  x: p.item.placement.x,
  y: p.item.placement.y,
}));
const meterSpots: FloorPoint[] = [
  { x: 0, y: 6 },
  { x: 3, y: 9 },
];
const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;

test("reference at the limit: the listener reads the listener's spot, and nothing without one", () => {
  const spots = { listener: venue.listener, meterSpots, boxes };
  assert.equal(
    referenceAtLimit(COVERAGE_LEVEL_REF.listener, req, spots, null),
    spaceLevelAt(req, venue.listener),
  );
  // the other references leave the listener out (null), so moving it moves nothing else
  assert.equal(
    referenceAtLimit(COVERAGE_LEVEL_REF.listener, req, { ...spots, listener: null }, null),
    null,
  );
});

test("reference at the limit: 1 m from the stacks is the mean of the spots' levels, null with no spots", () => {
  const spots = { listener: null, meterSpots, boxes };
  assert.equal(
    referenceAtLimit(COVERAGE_LEVEL_REF.stacks, req, spots, null),
    mean(meterSpots.map((p) => spaceLevelAt(req, p))),
  );
  assert.equal(
    referenceAtLimit(COVERAGE_LEVEL_REF.stacks, req, { ...spots, meterSpots: [] }, null),
    null,
  );
});

test("reference at the limit: the audience average needs the grid, and leaves the floor by the boxes out", () => {
  const spots = { listener: null, meterSpots, boxes };
  assert.equal(referenceAtLimit(COVERAGE_LEVEL_REF.audience, req, spots, null), null);
  assert.equal(
    referenceAtLimit(COVERAGE_LEVEL_REF.audience, req, spots, grid),
    audienceAverage(grid, req.room, boxes),
  );
  // the boxes the grid is read with change the average (so a grid is read with its own)
  assert.notEqual(
    audienceAverage(grid, req.room, boxes),
    audienceAverage(grid, req.room, [{ x: 0, y: req.room.lengthFt / 2 }]),
  );
});

test("audience average: the mean over every cell but those right in front of a box", () => {
  // a 4 × 2 grid of 10 ft cells on a 40 × 20 ft floor: cell centers at x -15, -5, 5, 15 and y 5, 15
  const room = { widthFt: 40, lengthFt: 20 };
  const db = new Float32Array([90, 80, 70, 60, 50, 40, 30, 20]);
  const cells: CoverageGrid = { cols: 4, rows: 2, db };
  assert.ok(STATS_CLEARANCE_FT < 10, "a box clears only the cell it stands on");
  assert.equal(audienceAverage(cells, room, []), mean([...db]));
  // a box on the first cell leaves it out
  assert.equal(
    audienceAverage(cells, room, [{ x: -15, y: 5 }]),
    mean([80, 70, 60, 50, 40, 30, 20]),
  );
  // a box on every cell leaves nothing
  const every = [-15, -5, 5, 15].flatMap((x) => [5, 15].map((y) => ({ x, y })));
  assert.equal(audienceAverage(cells, room, every), null);
});
