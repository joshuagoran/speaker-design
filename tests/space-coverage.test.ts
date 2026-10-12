// The space model (lib/speaker/spaceCoverage) against the PA coverage page (lib/pa/coverage): the PA design read in as
// a space on the coverage page's floor maps the floor as the page does; height and tilt move the levels as they should.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { derivePaDesign } from "../src/pages/pa-stack/hooks/paDesign";
import {
  balancedLevelsOf,
  coverageGeometry,
  musicBalanceOf,
  type CoverageInputs,
} from "../src/pages/coverage/useCoverageMap";
import { DEFAULT_COVERAGE_LAYOUT } from "../src/pages/coverage/useCoverageLayout";
import { defaultPaDesign } from "../src/pages/designer/designerTemplates";
import { autoSubDelayMs, computeCoverageGrid, COVERAGE_GRID_COLS } from "../src/lib/pa/coverage";
import { layersFromPa } from "../src/lib/speaker/paSpec";
import {
  computeSpaceGrid,
  spaceGridRequest,
  spaceLevelAt,
  spaceModel,
} from "../src/lib/speaker/spaceCoverage";
import { DEFAULT_PA } from "../src/lib/defaults";
import { keysOf } from "../src/lib/records";
import { PLINTH_HEIGHT_IN } from "../src/constants/paLayouts";
import type { CoverageBand, CoverageGrid, CoverageLayout, SpaceDesign } from "../src/types";

/** The PA coverage page's inputs for the starting design, as the planner derives them. */
function paInputs(): CoverageInputs {
  const d = DEFAULT_PA;
  const derived = derivePaDesign({
    subDriver: d.sub,
    portStyle: d.portStyle,
    subBoxDims: d.cDim,
    subVentSpec: d.cVent,
    subHighpassHz: d.hpf,
    subHighpassType: d.hpType,
    subAmpWatts: d.ampW,
    maxPortAirSpeedMs: d.portMax,
    midDriver: d.mid,
    midBoxDims: d.mDim,
    midAmpWatts: d.mAmpW,
    hornOption: d.horn,
    compressionDriver: d.cd,
    hornAmpWatts: d.hfAmpW,
    subMidCrossoverHz: d.xoLo,
    midHornCrossoverHz: d.xoHi,
    subMidCrossoverOrder: d.xoLoOrder,
    midHornCrossoverOrder: d.xoHiOrder,
    plinthHeightIn: PLINTH_HEIGHT_IN,
    layout: d.layout,
    wallThicknessIn: d.wall,
    braceStyle: undefined,
    backJoint: d.backJoint,
    baffleInsetIn: d.inset,
    spacerHeightIn: d.spacerH,
    hardware: d.hardware,
    dispersionPlane: "h",
  });
  return {
    ...derived,
    subBox: d.cDim,
    subMidCrossoverHz: d.xoLo,
    subMidCrossoverOrder: d.xoLoOrder,
    subHighpassHz: d.hpf,
    subHighpassType: d.hpType,
    midHornCrossoverOrder: d.xoHiOrder,
    midHornCrossoverHz: d.xoHi,
    midBelowSubDb: d.tilt,
    hornBelowMidDb: d.hfTilt,
  };
}

/** The coverage page's grid for the starting design on `layout`, in `band`. */
function paGrid(layout: CoverageLayout, band: CoverageBand): CoverageGrid {
  const p = paInputs();
  const geometry = coverageGeometry(p);
  const balanced = balancedLevelsOf(p, geometry, musicBalanceOf(p));
  assert.ok(geometry && balanced);
  const stack = { ...geometry, subDelayMs: autoSubDelayMs(geometry, balanced.levels) ?? 0 };
  return computeCoverageGrid({
    stack,
    levels: balanced.levels,
    layout: { ...layout, band },
    cols: COVERAGE_GRID_COLS,
  });
}

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

/**
 * Tolerances against the coverage page, on its default floor: the map's shape (each cell less the map's mean, so each
 * band's level drops out) in each band, the mean and the 90th percentile of the cells' differences, dB. The space plays
 * the PA design's stack (lib/speaker/stackResponse): its own sub delay (the stack's alignment), its band levels and its
 * drivers where the speakers put them; the page balances each band at its limit and stacks the drivers on one line.
 *
 * On the starting design (Oct 2026): sub mean 0.05, p90 0.08; kick 0.10, 0.19; mid 0.28, 0.58; high 0.00, 0.00.
 */
const SHAPE_DB: Record<Exclude<CoverageBand, "one">, { mean: number; p90: number }> = {
  sub: { mean: 0.1, p90: 0.15 },
  kick: { mean: 0.2, p90: 0.3 },
  mid: { mean: 0.4, p90: 0.8 },
  high: { mean: 0.05, p90: 0.05 },
};

test("space model: the PA design's space maps the floor as the coverage page does", () => {
  const layout = DEFAULT_COVERAGE_LAYOUT;
  const design = paSpace(layout);
  const model = spaceModel(design);
  assert.ok(!model.missing && !model.unassigned);
  for (const band of keysOf(SHAPE_DB)) {
    const tol = SHAPE_DB[band];
    const page = shape(paGrid(layout, band));
    const space = shape(
      computeSpaceGrid(spaceGridRequest(model, design.space.venue, band, 0, COVERAGE_GRID_COLS)),
    );
    const diffs = page.map((v, i) => Math.abs(v - space[i])).sort((x, y) => x - y);
    const mean = diffs.reduce((sum, v) => sum + v, 0) / diffs.length;
    const p90 = diffs[Math.floor(diffs.length * 0.9)];
    assert.ok(mean <= tol.mean, `${band}: mean ${mean.toFixed(2)} dB`);
    assert.ok(p90 <= tol.p90, `${band}: 90th percentile ${p90.toFixed(2)} dB`);
  }
});

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
