// The drag preview (the coarse grid) and the settled map (the fine grid) are one model at two resolutions; and the
// map follows a stack's toe-in where the model says it should.
import { test } from "vite-plus/test";
import assert from "node:assert";
import {
  COVERAGE_BANDS,
  COVERAGE_GRID_COLS,
  computeCoverageGrid,
  gridLevelAt,
} from "../src/lib/pa/coverage";
import { modalBottomHz, modalCrossoverHz } from "../src/lib/pa/roomAcoustics";
import { DEFAULT_COVERAGE_LAYOUT } from "../src/pages/coverage/useCoverageLayout";
import { logSpacedFrequencies } from "../src/lib/hifi/hifi";
import { paStackSources } from "../src/lib/pa/dispersion";
import type {
  CoverageBand,
  CoverageGrid,
  CoverageLayout,
  CoverageLevels,
  CoverageStack,
} from "../src/types";

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

/** Every band at 120 dB at 1 m through its crossover's magnitude. */
const levels: CoverageLevels = (() => {
  const freqs = logSpacedFrequencies(12, 20000, 400);
  const curve = (band: "sub" | "mid" | "horn") => {
    const o = paStackSources(stack).find((s) => s.band === band);
    if (!o) throw new Error(band); // the test stack has all three
    return freqs.map((f) => {
      const h = o.filt(f);
      return { f, spl: 120 + 20 * Math.log10(Math.max(1e-9, Math.hypot(h.re, h.im))), phase: 0 };
    });
  };
  return { sub: curve("sub"), mid: curve("mid"), horn: curve("horn") };
})();

const grid = (layout: CoverageLayout, cols: number) =>
  computeCoverageGrid({ stack, levels, layout, cols });

/** Each cell of `a` against `b` read at the same point, dB: sorted, smallest first. */
function gaps(a: CoverageGrid, b: CoverageGrid, room: CoverageLayout["room"]): number[] {
  const out: number[] = [];
  for (let j = 0; j < a.rows; j++)
    for (let i = 0; i < a.cols; i++) {
      const x = -room.widthFt / 2 + ((i + 0.5) * room.widthFt) / a.cols,
        y = ((j + 0.5) * room.lengthFt) / a.rows;
      out.push(Math.abs(a.db[j * a.cols + i] - gridLevelAt(b, room, { x, y })));
    }
  return out.sort((p, q) => p - q);
}

const BANDS: CoverageBand[] = [...(Object.keys(COVERAGE_BANDS) as CoverageBand[]), "one"]; // boundary cast: Object.keys widens the Record's keys to string

test("the drag preview's coarse grid matches the settled fine grid at the same points, every band", () => {
  for (const band of BANDS) {
    const layout = { ...DEFAULT_COVERAGE_LAYOUT, band };
    const d = gaps(
      grid(layout, COVERAGE_GRID_COLS.coarse),
      grid(layout, COVERAGE_GRID_COLS.fine),
      layout.room,
    );
    const at = (share: number) => d[Math.min(d.length - 1, Math.floor(d.length * share))];
    // only the sampling differs: a sharp null (one frequency, with phase) falls between the coarse cells
    assert.ok(at(0.5) < 0.25, `${band}: median gap ${at(0.5).toFixed(2)} dB`);
    assert.ok(at(0.95) < 1, `${band}: 95th percentile gap ${at(0.95).toFixed(2)} dB`);
    assert.ok(at(1) < 3, `${band}: largest gap ${at(1).toFixed(2)} dB`);
  }
});

/** The default layout with both stacks turned to `aim` degrees (mirrored). */
const toed = (band: CoverageBand, aim: number): CoverageLayout => {
  const [l, r] = DEFAULT_COVERAGE_LAYOUT.stacks;
  return {
    ...DEFAULT_COVERAGE_LAYOUT,
    band,
    stacks: [
      { ...l, aim },
      { ...r, aim: -aim },
    ],
  };
};
const largestChange = (band: CoverageBand, cols: number) => {
  const a = grid(toed(band, 12), cols).db,
    b = grid(toed(band, 45), cols).db;
  return a.reduce((m, v, i) => Math.max(m, Math.abs(v - b[i])), 0);
};

test("turning the stacks changes the map in the mid and high bands, coarse and fine", () => {
  for (const cols of Object.values(COVERAGE_GRID_COLS)) {
    assert.ok(largestChange("mid", cols) > 0.5, `mid, ${cols} columns`);
    assert.ok(largestChange("high", cols) > 2, `high, ${cols} columns`);
  }
});

test("below the modal fade the map ignores toe-in, as the page's note says", () => {
  const room = DEFAULT_COVERAGE_LAYOUT.room;
  const n = modalBottomHz(modalCrossoverHz(room));
  // the default room: the sub and kick bands sit wholly below it, so the note shows there
  assert.ok(COVERAGE_BANDS.kick.hi <= n, `modal-only up to ${n.toFixed(0)} Hz`);
  for (const band of ["sub", "kick"] as const)
    assert.strictEqual(largestChange(band, COVERAGE_GRID_COLS.coarse), 0, band);
});
