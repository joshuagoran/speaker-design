// Where the Space page reads its level (src/pages/space/useSpace referenceAtLimit) and the audience average it takes
// (lib/acoustics/coverage audienceAverage): each reference reads its own spots, and a missing one reads nothing.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { configs } from "./pa-configs";
import { PA_FLOOR, paDesign } from "./speaker-cases";
import { layersFromPa } from "../src/lib/speaker/paSpec";
import { audienceAverage, STATS_CLEARANCE_FT } from "../src/lib/acoustics/coverage";
import { spaceGridRequest, spaceLevelAt, computeSpaceGrid } from "../src/lib/speaker/spaceCoverage";
import { spaceModel } from "./helpers";
import { referenceAtLimit } from "../src/pages/space/useSpace";
import {
  meterSpotsOf,
  playsInBand,
  type MeterSpot,
  type PassbandCorners,
} from "../src/lib/speaker/spaceBalance";
import { COVERAGE_BANDS } from "../src/lib/acoustics/coverage";
import { lrFilter, spacePlacement } from "../src/lib/speaker/specParts";
import { COVERAGE_LEVEL_REF } from "../src/constants/coverageLevel";
import { SPACE_ITEM } from "../src/constants/speakerSpec";
import type { CoverageGrid, FloorPoint, SpaceDesign } from "../src/types";

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
const meterSpots: MeterSpot[] = [
  { at: { x: 0, y: 6 }, passbands: [] },
  { at: { x: 3, y: 9 }, passbands: [] },
];
/** the band the tests above read: every spot counts in it (they carry no passbands) */
const BAND = COVERAGE_BANDS.mid;
const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;

test("reference at the limit: the listener reads the listener's spot, and nothing without one", () => {
  const spots = { listener: venue.listener, meterSpots, boxes };
  assert.equal(
    referenceAtLimit(COVERAGE_LEVEL_REF.listener, req, spots, null, BAND),
    spaceLevelAt(req, venue.listener),
  );
  // the other references leave the listener out (null), so moving it moves nothing else
  assert.equal(
    referenceAtLimit(COVERAGE_LEVEL_REF.listener, req, { ...spots, listener: null }, null, BAND),
    null,
  );
});

test("reference at the limit: 1 m from the stacks is the mean of the spots' levels, null with no spots", () => {
  const spots = { listener: null, meterSpots, boxes };
  assert.equal(
    referenceAtLimit(COVERAGE_LEVEL_REF.stacks, req, spots, null, BAND),
    mean(meterSpots.map((p) => spaceLevelAt(req, p.at))),
  );
  assert.equal(
    referenceAtLimit(COVERAGE_LEVEL_REF.stacks, req, { ...spots, meterSpots: [] }, null, BAND),
    null,
  );
});

test("reference at the limit: the audience average needs the grid, and leaves the floor by the boxes out", () => {
  const spots = { listener: null, meterSpots, boxes };
  assert.equal(referenceAtLimit(COVERAGE_LEVEL_REF.audience, req, spots, null, BAND), null);
  assert.equal(
    referenceAtLimit(COVERAGE_LEVEL_REF.audience, req, spots, grid, BAND),
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

test("plays in band: a box counts only where its passband overlaps the band", () => {
  const sub: PassbandCorners = { highpassHz: null, lowpassHz: 120 };
  const top: PassbandCorners = { highpassHz: 120, lowpassHz: null };
  assert.equal(playsInBand([sub], COVERAGE_BANDS.sub), true);
  assert.equal(playsInBand([sub], COVERAGE_BANDS.kick), true);
  assert.equal(playsInBand([sub], COVERAGE_BANDS.mid), false);
  assert.equal(playsInBand([sub], COVERAGE_BANDS.high), false);
  assert.equal(playsInBand([top], COVERAGE_BANDS.sub), false);
  assert.equal(playsInBand([top], COVERAGE_BANDS.kick), true);
  assert.equal(playsInBand([top], COVERAGE_BANDS.high), true);
  // a band that only touches a corner doesn't count
  assert.equal(playsInBand([{ highpassHz: 2000, lowpassHz: null }], { lo: 160, hi: 2000 }), false);
  // one of several bands is enough, and none is open
  assert.equal(playsInBand([sub, top], COVERAGE_BANDS.high), true);
  assert.equal(playsInBand([], COVERAGE_BANDS.high), false);
  assert.equal(playsInBand([{ highpassHz: null, lowpassHz: null }], COVERAGE_BANDS.high), true);
});

/** A sub low-passed at 120 Hz at the left and a top high-passed at 120 Hz at the right, as two speakers alone. */
function subAndTop(): SpaceDesign {
  const [base] = design.speakers;
  const sub = { ...base, id: "sub", input: { highpass: null, lowpass: lrFilter(120, 4) } };
  const top = { ...base, id: "top", input: { highpass: lrFilter(120, 4), lowpass: null } };
  const place = (id: string, x: number) =>
    spacePlacement({ x, y: 0 }, { kind: SPACE_ITEM.speaker, id }, 0);
  return {
    space: { ...design.space, placements: [place("sub", -8), place("top", 8)] },
    stacks: [],
    speakers: [sub, top],
  };
}

test("reference at the limit: 1 m from the speakers counts only the boxes that play in the band", () => {
  const split = subAndTop();
  const splitModel = spaceModel(split);
  const spots = meterSpotsOf(split, splitModel, split.space.venue.room);
  assert.equal(spots.length, 2);
  const [subSpot, topSpot] = spots;
  const at = (band: keyof typeof COVERAGE_BANDS) => {
    const request = spaceGridRequest(splitModel, split.space.venue, band, 0, COLS);
    const read = (meters: MeterSpot[]) =>
      referenceAtLimit(
        COVERAGE_LEVEL_REF.stacks,
        request,
        { listener: null, meterSpots: meters, boxes: [] },
        null,
        COVERAGE_BANDS[band],
      );
    return { both: read(spots), sub: read([subSpot]), top: read([topSpot]) };
  };
  const high = at("high");
  assert.ok(high.top !== null && high.sub !== null && high.top !== high.sub);
  assert.equal(high.both, high.top, "High band: the sub is left out");
  const low = at("sub");
  assert.ok(low.top !== null && low.sub !== null && low.top !== low.sub);
  assert.equal(low.both, low.sub, "Sub band: the top is left out");
  // where no placement plays in the band, all of them count (the sub alone, in the High band)
  assert.equal(
    high.sub,
    spaceLevelAt(spaceGridRequest(splitModel, split.space.venue, "high", 0, COLS), subSpot.at),
  );
});
