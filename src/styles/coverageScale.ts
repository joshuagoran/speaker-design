// The coverage map's color scale and contour lines: level against the target, on the fixed data colors (ON_DATA), the
// same in both themes. The map and its key both read these, so they stay in step.
import { ON_DATA } from "./palette";
import type { Rgb } from "./palette";
import { CONTOUR_STEP_DB, COVERAGE_MAP_DB } from "../constants/chartScales";
import { COVERAGE_EDGE_DB } from "../constants/coverageLevel";

const [LO_DB, HI_DB] = COVERAGE_MAP_DB;

const hexRgb = (hex: string): Rgb => {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
};
const lerp = (x: Rgb, y: Rgb, t: number): Rgb => [
  Math.round(x[0] + (y[0] - x[0]) * t),
  Math.round(x[1] + (y[1] - x[1]) * t),
  Math.round(x[2] + (y[2] - x[2]) * t),
];
const mix = (a: string, b: string, t: number) => lerp(hexRgb(a), hexRgb(b), t);

/** [dB against the target, color]: white at the quiet end (no coverage), light pink at the coverage edge, magenta at
 * the target, medium-dark magenta at the loud end (dark enough to read, light enough for the black marks on it). */
const STOPS: readonly (readonly [db: number, rgb: Rgb])[] = [
  [LO_DB, hexRgb(ON_DATA.white)],
  [COVERAGE_EDGE_DB, mix(ON_DATA.white, ON_DATA.magenta, 0.3)],
  [0, hexRgb(ON_DATA.magenta)],
  [HI_DB, mix(ON_DATA.magenta, ON_DATA.ink, 0.45)],
];

/** Where a level (dB against the target) sits along the scale, 0–1. */
export const coverageScalePos = (db: number) =>
  Math.max(0, Math.min(1, (db - LO_DB) / (HI_DB - LO_DB)));

/** The color for a level, dB against the target; clamped to the scale's ends. */
export function coverageColor(db: number): Rgb {
  if (db <= STOPS[0][0]) return STOPS[0][1];
  for (let i = 1; i < STOPS.length; i++)
    if (db <= STOPS[i][0]) {
      const [a, ca] = STOPS[i - 1],
        [b, cb] = STOPS[i];
      return lerp(ca, cb, (db - a) / (b - a));
    }
  return STOPS[STOPS.length - 1][1];
}

/** The scale as a CSS gradient, for the key. */
export const COVERAGE_GRADIENT = `linear-gradient(to right, ${STOPS.map(
  ([db, c]) => `rgb(${c.join(",")}) ${(coverageScalePos(db) * 100).toFixed(1)}%`,
).join(", ")})`;

/** How a contour line is drawn. */
export interface CoverageLine {
  color: string;
  opacity: number;
  /** px */
  width: number;
}

/** The contour lines' styles: the target thickest, the coverage edge medium, the steps thin. A step above the target is
 * white, since ink would vanish on the dark loud end. */
export const COVERAGE_LINES = {
  target: { color: ON_DATA.ink, opacity: 1, width: 2.2 },
  edge: { color: ON_DATA.ink, opacity: 1, width: 1.4 },
  quietStep: { color: ON_DATA.ink, opacity: 0.7, width: 0.9 },
  loudStep: { color: ON_DATA.white, opacity: 0.8, width: 0.9 },
} as const satisfies Record<string, CoverageLine>;

/** Tolerance for comparing step levels, dB. */
const EPS_DB = 1e-9;

/**
 * Every contour line, [dB against the target, style], in drawing order (the target last, on top): a thin line every
 * CONTOUR_STEP_DB, counted out from the target, inside the scale; the coverage edge and the target have lines of their
 * own instead.
 */
export const COVERAGE_CONTOURS: readonly (readonly [db: number, line: CoverageLine])[] = (() => {
  const lines: (readonly [number, CoverageLine])[] = [];
  for (
    let n = Math.ceil(LO_DB / CONTOUR_STEP_DB - EPS_DB);
    n * CONTOUR_STEP_DB <= HI_DB + EPS_DB;
    n++
  ) {
    const db = n * CONTOUR_STEP_DB;
    if (n !== 0 && Math.abs(db - COVERAGE_EDGE_DB) > EPS_DB)
      lines.push([db, db > 0 ? COVERAGE_LINES.loudStep : COVERAGE_LINES.quietStep]);
  }
  lines.push([COVERAGE_EDGE_DB, COVERAGE_LINES.edge], [0, COVERAGE_LINES.target]);
  return lines;
})();
