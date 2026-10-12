// The Space page's amp power table (lib/speaker/spaceAmpPower) against the PA Coverage page's (lib/pa/ampPower): the PA
// presets' spaces, each channel's power at its first limit and its limit, as the PA page's sub, mid and horn rows.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { derivePaDesign, paDesignInputsOf } from "../src/lib/pa/paDesign";
import { hornMax, midMax, subMax } from "../src/lib/pa/ampPower";
import { spaceModel } from "../src/lib/speaker/spaceCoverage";
import { spaceAmpPower } from "../src/lib/speaker/spaceAmpPower";
import { startLayers } from "../src/pages/stack/stackPresets";
import { defaultPaDesign } from "../src/pages/speaker/speakerTemplates";
import { DEFAULT_COVERAGE_LAYOUT } from "../src/lib/pa/coverageLayout";
import { STACK_PRESET } from "../src/constants/stackPresets";
import { SPEAKER_BAND } from "../src/constants/speakerSpec";
import type { PaLayout } from "../src/types";

const PRESETS = [
  [STACK_PRESET.paStack, "stack"],
  [STACK_PRESET.paPole, "pole"],
  [STACK_PRESET.paSatellite, "satellite"],
  [STACK_PRESET.paTower, "tower"],
] as const satisfies readonly (readonly [string, PaLayout])[];

/**
 * How far a channel's power at its first limit may be from the PA page's, dB. The mid and the horn are the PA page's
 * exactly; the sub's music limit is the speaker model's, 0.37 dB over the page's on the presets (Oct 2026: 732 W against
 * 672 W, as tests/space-coverage.test.ts finds the sub's level).
 */
const MAX_DB = 0.5;

test("space amp power: the PA presets' channels reach their limits as the PA page's rows do", () => {
  for (const [preset, layout] of PRESETS) {
    const cfg = defaultPaDesign(layout);
    const pa = derivePaDesign(paDesignInputsOf(cfg));
    const read = startLayers(
      preset,
      { id: "test", name: "test" },
      { pa: cfg, floor: DEFAULT_COVERAGE_LAYOUT },
    );
    const design = { space: read.space, stacks: [read.stack], speakers: read.speakers };
    const model = spaceModel(design);
    const rows = spaceAmpPower(model, design.space.amps, 0);
    assert.ok(rows.length > 0, preset);
    const page = new Map<string, ReturnType<typeof midMax>>([
      [SPEAKER_BAND.low, pa.subModeled && subMax(pa.subModeled.lim, pa.subAmpVoltage)],
      [
        SPEAKER_BAND.mid,
        pa.midModeled &&
          midMax(pa.midModeled.max, pa.midModeled.mdl.curve, pa.midModeled.V, [cfg.xoLo, cfg.xoHi]),
      ],
      [SPEAKER_BAND.high, pa.hornModel && hornMax(pa.hornModel)],
    ]);
    for (const r of rows.filter((x) => x.placement === 0)) {
      const p = page.get(r.band);
      assert.ok(p, `${preset} ${r.band}`);
      const db = 10 * Math.log10(r.power.wAtMax / p.wAtMax);
      assert.ok(Math.abs(db) < MAX_DB, `${preset} ${r.band}: ${db.toFixed(2)} dB`);
      assert.equal(r.power.who, p.who, `${preset} ${r.band}: limit`);
      assert.ok(Math.abs(r.power.ampW - p.ampW) < 1e-6, `${preset} ${r.band}: amp`);
    }
  }
});
