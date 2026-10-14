// The space model (lib/speaker/spaceCoverage) against the PA coverage page (lib/pa/coverage): the PA design read in as
// a space on the coverage page's floor maps the floor as the page does; height and tilt move the levels as they should.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { derivePaDesign } from "../src/lib/pa/paDesign";
import {
  balancedLevelsOf,
  coverageGeometry,
  musicBalanceOf,
  type PaBalanceInputs,
} from "../src/lib/pa/musicBalance";
import { DEFAULT_COVERAGE_LAYOUT } from "../src/lib/pa/coverageLayout";
import { defaultPaDesign } from "../src/pages/speaker/speakerTemplates";
import {
  autoSubDelayMs,
  computeCoverageGrid,
  audienceAverage,
  coverageScene,
  coverageSlots,
  COVERAGE_GRID_COLS,
} from "../src/lib/pa/coverage";
import { abs, add, complex } from "../src/lib/acoustics/complex";
import { SPEAKER_BAND } from "../src/constants/speakerSpec";
import { layersFromPa } from "../src/lib/speaker/paSpec";
import { paBalancedLayers } from "../src/lib/speaker/paBalance";
import {
  computeSpaceGrid,
  spaceGridRequest,
  spaceLevelAt,
  spaceModel,
  spaceOutputs,
  type SpaceModel,
} from "../src/lib/speaker/spaceCoverage";
import { DEFAULT_PA } from "../src/lib/defaults";
import { referenceAtLimit } from "../src/pages/space/useSpace";
import { COVERAGE_LEVEL_REF } from "../src/constants/coverageLevel";
import { oneMeterSpots } from "../src/lib/speaker/spaceBalance";
import { keysOf } from "../src/lib/records";
import { PLINTH_HEIGHT_IN } from "../src/constants/paLayouts";
import type {
  CoverageBand,
  CoverageGrid,
  CoverageLayout,
  CoverageLevels,
  FrequencyPoint,
  SpaceDesign,
} from "../src/types";

/** The PA coverage page's inputs for the starting design, as the planner derives them. */
function paInputs(): PaBalanceInputs {
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
    subHighpassHz: d.hpf,
    subHighpassType: d.hpType,
    midHornCrossoverHz: d.xoHi,
    midBelowSubDb: d.tilt,
    hornBelowMidDb: d.hfTilt,
  };
}

/** The coverage page's stack and band levels for the starting design (its music balance), each band moved by `shift` dB. */
function paRequest(shift: Partial<Record<keyof CoverageLevels, number>> = {}) {
  const p = paInputs();
  const geometry = coverageGeometry(p);
  const balanced = balancedLevelsOf(p, geometry, musicBalanceOf(p));
  assert.ok(geometry && balanced);
  const stack = { ...geometry, subDelayMs: autoSubDelayMs(geometry, balanced.levels) ?? 0 };
  const moved = <P extends FrequencyPoint>(c: P[], db = 0) =>
    c.map((o) => ({ ...o, spl: o.spl + db }));
  const { sub, mid, horn } = balanced.levels;
  const levels: CoverageLevels = {
    sub: sub && moved(sub, shift.sub),
    mid: moved(mid, shift.mid),
    horn: moved(horn, shift.horn),
  };
  return { stack, levels };
}

/** The coverage page's grid for the starting design on `layout`, in `band`. */
function paGrid(layout: CoverageLayout, band: CoverageBand, req = paRequest()): CoverageGrid {
  return computeCoverageGrid({ ...req, layout: { ...layout, band }, cols: COVERAGE_GRID_COLS });
}

/** Each page band, the speaker band that plays it in the PA design's space, and where the two are compared, Hz. */
const BAND_PAIRS = [
  ["sub", SPEAKER_BAND.low, 50],
  ["mid", SPEAKER_BAND.mid, 400],
  ["horn", SPEAKER_BAND.high, 4000],
] as const;

/**
 * How much louder each band plays in the space than on the page, dB, at 1 m on axis at its frequency (`BAND_PAIRS`):
 * the left stack's voices of that band against the page's band, each at its limit.
 */
function bandGapsDb(layout: CoverageLayout, model: SpaceModel) {
  const req = paRequest();
  const scene = coverageScene(req.stack, layout);
  const out: Partial<Record<keyof CoverageLevels, number>> = {};
  for (const [page, band, f] of BAND_PAIRS) {
    const v = coverageSlots(scene, req.levels, [f], true)[0].out[page];
    const own = spaceOutputs(model, f);
    const sum = model.feeds
      .filter((x) => x.placement === 0 && x.band === band)
      .reduce((acc, x) => add(acc, own[x.id] ?? complex(0)), complex(0));
    assert.ok(v, page);
    out[page] = 20 * Math.log10(abs(sum) / abs(v));
  }
  return out;
}

/** The starting PA design read in as a space on `layout`. */
function paSpace(layout: CoverageLayout): SpaceDesign {
  const read = layersFromPa(defaultPaDesign(), { id: "pa", name: "PA" }, layout);
  return { space: read.space, stacks: [read.stack], speakers: read.speakers };
}

/** The starting PA design read in as a space on `layout`, its music balance in the band Levels (the PA preset's). */
function balancedPaSpace(layout: CoverageLayout): SpaceDesign {
  const cfg = defaultPaDesign();
  const read = paBalancedLayers(cfg, layersFromPa(cfg, { id: "pa", name: "PA" }, layout));
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
 * The PA design's space against the coverage page, as each plays it. The space plays the PA design's stack
 * (lib/speaker/stackResponse): its band levels at one input, its own sub delay, and its drivers where the speakers put
 * them; the page balances each band at its limit to its music balance and stacks the drivers on one line.
 *
 * - The sub plays at its music limit in both: within SUB_GAP_DB. The stack's top plays louder than the page's balance
 *   (the PA stack's band levels are gains on each box's 2.83 V response, not the page's balance at the limits): on the
 *   starting design the mid −1.8 dB at 400 Hz and the horn +11.3 dB at 4 kHz. The PA presets put the page's balance
 *   in the band Levels (lib/speaker/paBalance; the last test).
 * - The map's shape (each cell less the map's mean, so each band's level drops out) on the page's default floor,
 *   indoors (PAGE_SHAPE_DB): on the starting design (Oct 2026) sub mean 0.05, p90 0.08; kick 0.10, 0.19; mid 0.28, 0.58;
 *   high 0.00, 0.00 (the concrete room's diffuse field evens the high band out).
 */
const SUB_GAP_DB = 0.5;
const PAGE_SHAPE_DB: ShapeTolerance = {
  sub: { mean: 0.1, p90: 0.15 },
  kick: { mean: 0.2, p90: 0.3 },
  mid: { mean: 0.4, p90: 0.8 },
  high: { mean: 0.05, p90: 0.05 },
};

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

/** The coverage page's default floor, and the same floor outdoors. */
const FLOORS = {
  indoors: DEFAULT_COVERAGE_LAYOUT,
  outdoors: {
    ...DEFAULT_COVERAGE_LAYOUT,
    room: { ...DEFAULT_COVERAGE_LAYOUT.room, outdoors: true },
  },
} as const satisfies Record<keyof typeof SAME_LEVELS_SHAPE_DB, CoverageLayout>;

/** Asserts each band's map is within its tolerance. */
function assertShapes(
  what: string,
  tol: ShapeTolerance,
  page: (band: keyof ShapeTolerance) => CoverageGrid,
  space: (band: keyof ShapeTolerance) => CoverageGrid,
) {
  for (const band of keysOf(tol)) {
    const gap = shapeGap(page(band), space(band));
    assert.ok(gap.mean <= tol[band].mean, `${what}, ${band}: mean ${gap.mean.toFixed(2)} dB`);
    assert.ok(
      gap.p90 <= tol[band].p90,
      `${what}, ${band}: 90th percentile ${gap.p90.toFixed(2)} dB`,
    );
  }
}

test("space model: the PA design's space maps the floor as the coverage page does", () => {
  const layout = FLOORS.indoors;
  const design = paSpace(layout);
  const model = spaceModel(design);
  assert.ok(!model.missing);
  const gaps = bandGapsDb(layout, model);
  assert.ok(Math.abs(gaps.sub ?? Infinity) < SUB_GAP_DB, `sub ${gaps.sub} dB`);
  const spaceGrid = (band: CoverageBand) =>
    computeSpaceGrid(spaceGridRequest(model, design.space.venue, band, 0, COVERAGE_GRID_COLS));
  assertShapes("as played", PAGE_SHAPE_DB, (band) => paGrid(layout, band), spaceGrid);
});

test("space model: with the page's levels, the space's engine maps the floor as the page does", () => {
  for (const floor of keysOf(FLOORS)) {
    const layout = FLOORS[floor];
    const design = paSpace(layout);
    const model = spaceModel(design);
    const req = paRequest(bandGapsDb(layout, model));
    assertShapes(
      floor,
      SAME_LEVELS_SHAPE_DB[floor],
      (band) => paGrid(layout, band, req),
      (band) =>
        computeSpaceGrid(spaceGridRequest(model, design.space.venue, band, 0, COVERAGE_GRID_COLS)),
    );
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

/**
 * How far apart the bands' gaps (space against page) may be, dB, with the music balance in the band Levels: on the
 * starting design (Oct 2026) every band plays 0.37 dB over the page, within 0.002 dB of the others (without it, the mid
 * −1.8 dB and the horn +11.3 dB).
 */
const BALANCE_GAP_DB = 0.05;

test("space model: with the music balance in its band Levels, the PA design's space plays each band as the page does", () => {
  const layout = FLOORS.indoors;
  const gaps = bandGapsDb(layout, spaceModel(balancedPaSpace(layout)));
  const sub = gaps.sub ?? Infinity;
  assert.ok(Math.abs(sub) < SUB_GAP_DB, `sub ${sub} dB`);
  for (const band of ["mid", "horn"] as const) {
    const gap = gaps[band] ?? Infinity;
    assert.ok(Math.abs(gap - sub) < BALANCE_GAP_DB, `${band} ${gap} dB, sub ${sub} dB`);
  }
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
  const meterSpots = oneMeterSpots(design, venue.room);
  const at = (listener: { x: number; y: number } | null) =>
    referenceAtLimit(COVERAGE_LEVEL_REF.audience, req, { listener, meterSpots, boxes }, grid);
  // the map's request holds the room and the ear, not the listener, so its grid is the same wherever one stands
  // and so is the audience average, as the coverage page counts it (the whole floor but the boxes' clearance)
  const average = audienceAverage(grid, req.room, boxes);
  assert.ok(average !== null && Number.isFinite(average));
  assert.equal(at({ x: 0, y: 5 }), average);
  assert.equal(at({ x: -6, y: 18 }), average);
  assert.equal(at(null), average);
  // only the listener's own reference follows the listener
  const atListener = (listener: { x: number; y: number }) =>
    referenceAtLimit(COVERAGE_LEVEL_REF.listener, req, { listener, meterSpots, boxes }, grid);
  assert.notEqual(atListener({ x: 0, y: 5 }), atListener({ x: -6, y: 18 }));
});
