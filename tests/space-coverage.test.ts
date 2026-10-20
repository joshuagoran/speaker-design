// The space model (lib/speaker/spaceCoverage) against the coverage engine (lib/acoustics/coverage): the PA design read in
// as a space on the default coverage layout maps the floor as the engine does; height and tilt move the levels as they
// should.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { DEFAULT_COVERAGE_LAYOUT } from "../src/lib/acoustics/coverageLayout";
import { defaultPaDesign } from "../src/pages/speaker/speakerTemplates";
import { audienceAverage, COVERAGE_BANDS, COVERAGE_GRID_COLS } from "../src/lib/acoustics/coverage";
import { layersFromPa } from "../src/lib/speaker/paSpec";
import { computeSpaceGrid, spaceGridRequest, spaceLevelAt } from "../src/lib/speaker/spaceCoverage";
import { spaceModel } from "./helpers";
import { referenceAtLimit } from "../src/pages/space/useSpace";
import { COVERAGE_LEVEL_REF } from "../src/constants/coverageLevel";
import { oneMeterSpots } from "../src/lib/speaker/spaceBalance";
import type { CoverageBand, CoverageGrid, CoverageLayout, SpaceDesign } from "../src/types";

/** The starting PA design read in as a space on `layout`. */
function paSpace(layout: CoverageLayout): SpaceDesign {
  const read = layersFromPa(defaultPaDesign(), { id: "pa", name: "PA" }, layout);
  return { space: read.space, stacks: [read.stack], speakers: read.speakers };
}

/** Each cell less the grid's mean over cells, dB: the map's shape. */
const shape = (g: CoverageGrid) => {
  const mean = g.db.reduce((a, b) => a + b, 0) / g.db.length;
  return [...g.db].map((v) => v - mean);
};

/** How far apart two maps' shapes are (each cell less its map's mean): the mean and 90th percentile of the cells, dB. */
function shapeGap(a: CoverageGrid, b: CoverageGrid) {
  const sa = shape(a),
    sb = shape(b);
  const diffs = sa.map((v, i) => Math.abs(v - sb[i])).sort((x, y) => x - y);
  return {
    mean: diffs.reduce((sum, v) => sum + v, 0) / diffs.length,
    p90: diffs[Math.floor(diffs.length * 0.9)],
  };
}

/** A map tolerance: the mean and 90th percentile of the cells' differences, dB. */
type ShapeTolerance = Record<Exclude<CoverageBand, "one">, ReturnType<typeof shapeGap>>;

/**
 * With the page's bands moved to the space's levels (`bandGapsDb`), the same engine: the map's shape indoors and
 * outdoors (the direct sound and the floor bounce alone). The rest is the stack's own sub delay and the drivers' places.
 * On the starting design (Oct 2026), indoors: sub mean 0.05, p90 0.08; kick 0.07, 0.15; mid 0.01, 0.03; high 0.00,
 * 0.00. Outdoors: sub 0.02, 0.05; kick 0.04, 0.09; mid 0.08, 0.16; high 0.00, 0.00.
 */
const SAME_LEVELS_SHAPE_DB: Record<"indoors" | "outdoors", ShapeTolerance> = {
  indoors: {
    sub: { mean: 0.1, p90: 0.15 },
    kick: { mean: 0.15, p90: 0.3 },
    mid: { mean: 0.05, p90: 0.1 },
    high: { mean: 0.05, p90: 0.05 },
  },
  outdoors: {
    sub: { mean: 0.05, p90: 0.1 },
    kick: { mean: 0.1, p90: 0.2 },
    mid: { mean: 0.15, p90: 0.3 },
    high: { mean: 0.05, p90: 0.05 },
  },
};

/** The default coverage layout, and the same floor outdoors. */
const FLOORS = {
  indoors: DEFAULT_COVERAGE_LAYOUT,
  outdoors: {
    ...DEFAULT_COVERAGE_LAYOUT,
    room: { ...DEFAULT_COVERAGE_LAYOUT.room, outdoors: true },
  },
} as const satisfies Record<keyof typeof SAME_LEVELS_SHAPE_DB, CoverageLayout>;

/** The PA design's stack alone, outdoors (no walls to blur the aim), at the middle of the front, lifted and tilted. */
function liftedStack(liftIn: number, pitchDeg: number): SpaceDesign {
  const design = paSpace({
    ...DEFAULT_COVERAGE_LAYOUT,
    room: { ...DEFAULT_COVERAGE_LAYOUT.room, outdoors: true },
  });
  const [first] = design.space.placements;
  return {
    ...design,
    space: {
      ...design.space,
      placements: [{ ...first, x: 0, y: 2, liftIn, aim: { yawDeg: 0, pitchDeg } }],
    },
  };
}

/** The high band's level along the room's center line, every foot from 4 ft out to the back wall, at ear height. */
function centerLine(design: SpaceDesign) {
  const model = spaceModel(design);
  const req = spaceGridRequest(model, design.space.venue, "high", 0, COVERAGE_GRID_COLS);
  const out: { y: number; db: number }[] = [];
  for (let y = 4; y <= design.space.venue.room.lengthFt; y++)
    out.push({ y, db: spaceLevelAt(req, { x: 0, y }) });
  return out;
}

/** Where a line is loudest, ft from the front wall. */
const hotSpot = (line: { y: number; db: number }[]) =>
  line.reduce((a, b) => (b.db > a.db ? b : a)).y;

/** A line's level at `y` ft. */
const levelOn = (line: { y: number; db: number }[], y: number) =>
  line.find((o) => o.y === y)?.db ?? NaN;

test("space model: tilting a lifted stack down moves its hot spot closer, up moves it away", () => {
  const level = centerLine(liftedStack(96, 0));
  const down = centerLine(liftedStack(96, -20));
  const up = centerLine(liftedStack(96, 10));
  assert.ok(hotSpot(down) < hotSpot(level), `down ${hotSpot(down)} ft, level ${hotSpot(level)} ft`);
  assert.ok(hotSpot(up) > hotSpot(level), `up ${hotSpot(up)} ft, level ${hotSpot(level)} ft`);
  // the near floor against the far: tilted down, the axis points at the listeners close in
  const spread = (line: typeof level) => levelOn(line, 10) - levelOn(line, 40);
  assert.ok(spread(down) > spread(level) + 1, "the near floor gains on the far");
});

test("space model: a stack lifted above the ears is quieter right in front of it", () => {
  const floor = centerLine(liftedStack(0, 0));
  const lifted = centerLine(liftedStack(96, 0));
  // its horn 8 ft higher: far off its axis 6 ft out, almost on it 40 ft out
  assert.ok(levelOn(lifted, 6) < levelOn(floor, 6) - 2, "quieter close in");
  assert.ok(Math.abs(levelOn(lifted, 40) - levelOn(floor, 40)) < 1, "about the same far away");
});

test("space model: with Measured at the audience average, moving only the listener changes nothing on the map", () => {
  const design = paSpace(FLOORS.indoors);
  const { venue } = design.space;
  assert.equal(venue.levelRef, COVERAGE_LEVEL_REF.audience);
  const model = spaceModel(design);
  const req = spaceGridRequest(model, venue, "mid", 0, COVERAGE_GRID_COLS);
  const grid = computeSpaceGrid(req);
  const boxes = model.placements.map((p) => ({
    x: p.item.placement.x,
    y: p.item.placement.y,
  }));
  const meterSpots = oneMeterSpots(design, venue.room).map((spot) => ({ at: spot, passbands: [] }));
  const at = (alignAt: { x: number; y: number } | null) =>
    referenceAtLimit(
      COVERAGE_LEVEL_REF.audience,
      req,
      { alignAt, meterSpots, boxes },
      grid,
      COVERAGE_BANDS.mid,
    );
  // the map's request holds the room and the ear, not the listener, so its grid is the same wherever one stands
  // and so is the audience average (the whole floor but the boxes' clearance)
  const average = audienceAverage(grid, req.room, boxes);
  assert.ok(average !== null && Number.isFinite(average));
  assert.equal(at({ x: 0, y: 5 }), average);
  assert.equal(at({ x: -6, y: 18 }), average);
  assert.equal(at(null), average);
  // only the alignment point's own reference follows the alignment point
  const atAlignAt = (alignAt: { x: number; y: number }) =>
    referenceAtLimit(
      COVERAGE_LEVEL_REF.listener,
      req,
      { alignAt, meterSpots, boxes },
      grid,
      COVERAGE_BANDS.mid,
    );
  assert.notEqual(atAlignAt({ x: 0, y: 5 }), atAlignAt({ x: -6, y: 18 }));
});
