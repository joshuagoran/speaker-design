// The coverage map's color scale (dB against the target) and its contour lines.
import { assert, test } from "vite-plus/test";
import {
  COVERAGE_CONTOURS,
  COVERAGE_GRADIENT,
  COVERAGE_LINES,
  coverageColor,
  coverageScalePos,
} from "../src/styles/coverageScale";
import { ON_DATA } from "../src/styles/palette";
import type { Rgb } from "../src/styles/palette";
import { CONTOUR_STEP_DB, COVERAGE_MAP_DB } from "../src/constants/chartScales";
import { COVERAGE_EDGE_DB } from "../src/constants/coverageLevel";

const [LO_DB, HI_DB] = COVERAGE_MAP_DB;
const hexRgb = (hex: string): Rgb => {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
};

test("coverage scale: white at the quiet end, magenta at the target, clamped at both ends", () => {
  assert.deepEqual(coverageColor(LO_DB), hexRgb(ON_DATA.white));
  assert.deepEqual(coverageColor(0), hexRgb(ON_DATA.magenta));
  assert.deepEqual(coverageColor(LO_DB - 20), coverageColor(LO_DB), "clamped below");
  assert.deepEqual(coverageColor(HI_DB + 20), coverageColor(HI_DB), "clamped above");
  // louder is darker all the way along the scale
  const sum = (db: number) => coverageColor(db).reduce((a, b) => a + b, 0);
  for (let db = LO_DB; db < HI_DB; db += 1) assert.isAbove(sum(db), sum(db + 1), `${db} dB`);
});

test("coverage scale: positions and key", () => {
  assert.strictEqual(coverageScalePos(LO_DB), 0);
  assert.strictEqual(coverageScalePos(HI_DB), 1);
  assert.strictEqual(coverageScalePos(LO_DB - 5), 0);
  assert.strictEqual(coverageScalePos(HI_DB + 5), 1);
  assert.match(
    COVERAGE_GRADIENT,
    /^linear-gradient\(to right, rgb\(255,255,255\) 0\.0%, .* 100\.0%\)$/,
  );
});

test("coverage contours: steps out from the target, then the edge, then the target on top", () => {
  assert.deepEqual(
    COVERAGE_CONTOURS.map(([db]) => db),
    [-12, -9, -3, 3, 6, COVERAGE_EDGE_DB, 0],
  );
  for (const [db, line] of COVERAGE_CONTOURS) {
    if (db === 0) assert.strictEqual(line, COVERAGE_LINES.target);
    else if (db === COVERAGE_EDGE_DB) assert.strictEqual(line, COVERAGE_LINES.edge);
    else {
      assert.strictEqual(db % CONTOUR_STEP_DB, 0, `${db} dB is a whole step from the target`);
      assert.strictEqual(line, db > 0 ? COVERAGE_LINES.loudStep : COVERAGE_LINES.quietStep);
    }
  }
  // the three weights differ
  const { target, edge, quietStep } = COVERAGE_LINES;
  assert.isAbove(target.width, edge.width);
  assert.isAbove(edge.width, quietStep.width);
});
