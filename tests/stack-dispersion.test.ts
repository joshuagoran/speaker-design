// The Speaker and Stack pages' dispersion map (lib/speaker/stackDispersion) against the PA page's (lib/pa/dispersion):
// the PA presets read in as stacks with their music balance in the band Levels map the stack as the PA page does.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { derivePaDesign, paDesignInputsOf } from "../src/lib/pa/paDesign";
import { layersFromPa } from "../src/lib/speaker/paSpec";
import { paBalancedLayers } from "../src/lib/speaker/paBalance";
import { stackResponse } from "../src/lib/speaker/stackResponse";
import { stackDispersionMap } from "../src/lib/speaker/stackDispersion";
import { defaultPaDesign } from "../src/pages/speaker/speakerTemplates";
import { DEFAULT_COVERAGE_LAYOUT } from "../src/lib/pa/coverageLayout";
import { DISPERSION_SCALE } from "../src/styles/palette";
import type { DispersionPlane, HifiDispersionMap, PaLayout } from "../src/types";

const LAYOUTS = ["stack", "pole", "satellite", "tower"] as const satisfies readonly PaLayout[];
const PLANES = ["h", "v"] as const satisfies readonly DispersionPlane[];
/** The color scale's floor: below it both maps read as the same color. */
const FLOOR_DB = DISPERSION_SCALE.botDb;

/** How far apart two maps are over their cells, dB: the mean and the 90th percentile. */
function mapGap(a: HifiDispersionMap, b: HifiDispersionMap) {
  const diffs: number[] = [];
  a.rows.forEach((row, j) =>
    row.forEach((v, i) => {
      diffs.push(Math.abs(Math.max(v, FLOOR_DB) - Math.max(b.rows[j][i], FLOOR_DB)));
    }),
  );
  diffs.sort((x, y) => x - y);
  return {
    mean: diffs.reduce((s, v) => s + v, 0) / diffs.length,
    p90: diffs[Math.floor(diffs.length * 0.9)],
  };
}

/**
 * How far the maps may be apart, dB, by plane (the mean and 90th percentile of the cells). The PA page stacks its
 * drivers on one line at the boxes' centers and filters them with ideal Linkwitz-Riley crossovers; the stack model
 * plays each band's own response through its filters, from each driver where the speaker puts it. On the presets
 * (Oct 2026): horizontal mean 0.04 to 0.49, p90 0.11 to 0.87 (the satellite's mid box beside the sub); vertical mean
 * 0.36 to 0.96, p90 0.74 to 1.87.
 */
const MAP_DB: Record<DispersionPlane, ReturnType<typeof mapGap>> = {
  h: { mean: 0.6, p90: 1.1 },
  v: { mean: 1.1, p90: 2.2 },
};

test("stack dispersion: the PA presets map as the PA page does, with the same crossovers", () => {
  for (const layout of LAYOUTS) {
    const cfg = defaultPaDesign(layout);
    const read = paBalancedLayers(
      cfg,
      layersFromPa(cfg, { id: "pa", name: layout }, DEFAULT_COVERAGE_LAYOUT),
    );
    const response = stackResponse(read.stack, read.speakers);
    for (const plane of PLANES) {
      const page = derivePaDesign({
        ...paDesignInputsOf(cfg),
        dispersionPlane: plane,
      }).paDispersion;
      assert.ok(page);
      const map = stackDispersionMap(read.stack, read.speakers, response, plane);
      const gap = mapGap(map, page);
      const what = `${layout} ${plane}`;
      assert.ok(gap.mean <= MAP_DB[plane].mean, `${what}: mean ${gap.mean.toFixed(2)} dB`);
      assert.ok(gap.p90 <= MAP_DB[plane].p90, `${what}: 90th percentile ${gap.p90.toFixed(2)} dB`);
      assert.deepEqual(map.crossovers, page.crossovers, `${what}: crossovers`);
      // 0 dB on axis
      assert.ok(
        map.rows[map.angles.indexOf(0)].every((v) => Math.abs(v) < 1e-9),
        what,
      );
    }
  }
});
