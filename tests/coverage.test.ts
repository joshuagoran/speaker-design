import { test } from "vite-plus/test";
import assert from "node:assert";
import {
  audienceAverage,
  BAND_POINTS,
  contourSegments,
  COVERAGE_BANDS,
  coverageFrequencies,
  coverageStats,
  ONE_METER_FT,
  oneMeterSpot,
} from "../src/lib/pa/coverage";
import { materialAlpha, surfaceReflection } from "../src/lib/pa/roomAcoustics";
import type { CoverageStack } from "../src/types";

const stack: CoverageStack = {
  sub: { zIn: 12, Sd: 1200 },
  mid: { zIn: 36, Sd: 530 },
  horn: { zIn: 50, covH: 90, covV: 40, wIn: 14, hIn: 8 },
  xoLo: 120,
  xoHi: 900,
  orderLo: 4,
  orderHi: 4,
  footprint: { w: 24, d: 24 },
  midW: 24,
  subDelayMs: 0,
};

test("coverage: a band's modal sub-points stay inside the band, and each point keeps its whole share", () => {
  // a crossover above every band's top splits every point
  for (const band of ["sub", "mid", "high"] as const) {
    const { lo, hi } = COVERAGE_BANDS[band];
    const { freqs, shares } = coverageFrequencies(band, 0, 1e5, 4);
    for (const f of freqs)
      assert.ok(f >= lo * (1 - 1e-12) && f <= hi * (1 + 1e-12), `${band} ${f}`);
    // every point weighs 1, so the shares sum to the point count
    assert.ok(Math.abs(shares.reduce((a, b) => a + b, 0) - BAND_POINTS) < 1e-9);
    assert.ok(shares.every((x) => x > 0 && x <= 1));
  }
});

test("coverage: contours cross between the cells either side of the level", () => {
  const grid = { cols: 3, rows: 2, db: new Float32Array([0, 10, 20, 0, 10, 20]) };
  const segs = contourSegments(grid, 5);
  assert.equal(segs.length, 1);
  const [x1, , x2] = segs[0];
  assert.ok(Math.abs(x1 - 1) < 1e-9 && Math.abs(x2 - 1) < 1e-9, JSON.stringify(segs));
});

test("coverage: materials interpolate on log frequency and hold flat past the table", () => {
  // drywall: 0.29 at 125 Hz, 0.10 at 250 Hz
  assert.ok(Math.abs(materialAlpha("drywall", Math.sqrt(125 * 250)) - (0.29 + 0.1) / 2) < 1e-9);
  assert.equal(materialAlpha("drywall", 40), 0.29);
  assert.equal(materialAlpha("drywall", 12000), 0.09);
  assert.equal(surfaceReflection("open", 1000), 0);
  assert.ok(Math.abs(surfaceReflection("curtain", 1000) - Math.sqrt(1 - 0.72)) < 1e-9);
});

test("coverage: the audience average is the mean level over the floor the stats count", () => {
  const room = { widthFt: 20, lengthFt: 20 };
  // 4 × 4 cells, 5 ft each: 100 dB everywhere but 130 dB in the cell by the box, which the stats leave out
  const db = new Float32Array(16).fill(100);
  db[0] = 130;
  db[15] = 88;
  const grid = { cols: 4, rows: 4, db };
  const box = { x: -7.5, y: 2.5 };
  const avg = audienceAverage(grid, room, [box]);
  assert.ok(avg != null && Math.abs(avg - (100 * 14 + 88) / 15) < 1e-6, String(avg));
  // consistent with the stats: everything counted is at or above the average − 12
  assert.equal(coverageStats(grid, room, [box], (100 * 14 + 88) / 15).within6, 14 / 15);
  assert.equal(
    audienceAverage({ cols: 1, rows: 1, db: new Float32Array([90]) }, room, [{ x: 0, y: 10 }]),
    null,
  );
});

test("coverage: a stack's 1 m spot is 1 m out from its front along its aim, inside the room", () => {
  const room = { widthFt: 30, lengthFt: 40 };
  const p = oneMeterSpot({ x: -8, y: 3, aim: 0 }, stack.footprint, room);
  assert.ok(Math.abs(p.x + 8) < 1e-9 && Math.abs(p.y - (3 + 1 + ONE_METER_FT)) < 1e-9);
  const t = oneMeterSpot({ x: -8, y: 3, aim: 30 }, stack.footprint, room);
  assert.ok(Math.abs(Math.hypot(t.x + 8, t.y - 3) - (1 + ONE_METER_FT)) < 1e-9 && t.x > -8);
  const edge = oneMeterSpot({ x: 14, y: 1, aim: 60 }, stack.footprint, room);
  assert.ok(edge.x <= 15 && edge.x > 14);
});
