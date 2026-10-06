// The map follows a stack's toe-in where the model says it should, at the one grid size the page uses.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { COVERAGE_GRID_COLS, computeCoverageGrid } from "../src/lib/pa/coverage";
import { DEFAULT_COVERAGE_LAYOUT } from "../src/pages/coverage/useCoverageLayout";
import { logSpacedFrequencies } from "../src/lib/hifi/hifi";
import { paStackSources } from "../src/lib/pa/dispersion";
import type { CoverageBand, CoverageLayout, CoverageLevels, CoverageStack } from "../src/types";

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
  const curve = (band: keyof CoverageLevels) => {
    const o = paStackSources(stack).find((s) => s.band === band);
    if (!o) throw new Error(band); // the test stack has all three
    return freqs.map((f) => {
      const h = o.filt(f);
      return { f, spl: 120 + 20 * Math.log10(Math.max(1e-9, Math.hypot(h.re, h.im))), phase: 0 };
    });
  };
  return { sub: curve("sub"), mid: curve("mid"), horn: curve("horn") };
})();

const grid = (layout: CoverageLayout) =>
  computeCoverageGrid({ stack, levels, layout, cols: COVERAGE_GRID_COLS });

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
const largestChange = (band: CoverageBand) => {
  const a = grid(toed(band, 12)).db,
    b = grid(toed(band, 45)).db;
  return a.reduce((m, v, i) => Math.max(m, Math.abs(v - b[i])), 0);
};

test("turning the stacks changes the map in the mid and high bands", () => {
  assert.ok(largestChange("mid") > 0.5, "mid");
  assert.ok(largestChange("high") > 2, "high");
});
