// The horn engine (lib/acoustics/hornModel) against Hornresp 60.60's own results, for the designs in tests/hornresp:
// each case's record (<case>.txt, as Hornresp imported it) and its exported results (<case>-results.txt, trimmed to
// 2 kHz). Hornresp ran with the planner's air (343 m/s, 1.18 kg/m³) and its chamber resonances masked (lumped
// chambers, as the engine's); docs/horn-engine-plan.md says how to run it again.
//
// Hornresp's conventions the comparison follows:
// - Its SPL is the power response ("constant directivity"): the engine's powerSpl, not its on-axis spl.
// - Its Mmd is the moving mass without any air load; the engine's Mms carries one side's, 8/3·ρa³ (a the cone's radius).
// - Its horn rear chamber is lossless; its direct radiator's vented box has QL = 7 and no vent loss.
// - Its vent is a duct ended in its exit's radiation load; End Correction Flag = 0 leaves the inner end to Lpt.
import { test } from "vite-plus/test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { hornModel } from "../src/lib/acoustics/hornModel";
import { CASES, HORNRESP_DIR as DIR, designOf, resultsOf } from "./hornresp-records";

/** Ze and excursion, relative */
const CIRCUIT_TOLERANCE = 1e-3;
/** Hornresp exports excursion to 6 decimals (mm): half a step is its rounding, which tiny excursions show */
const EXCURSION_ROUNDING_MM = 5e-7;

for (const c of CASES) {
  test(`horn engine matches Hornresp: ${c.name}, ${c.boxes} box(es) of ${c.drivers} driver(s)`, () => {
    const { design, volts, losses } = designOf(
      fs.readFileSync(path.join(DIR, `${c.name}.txt`), "latin1"),
      c.boxes,
      c.drivers,
    );
    const hornresp = resultsOf(fs.readFileSync(path.join(DIR, `${c.name}-results.txt`), "utf8"));
    const model = hornModel(
      design,
      hornresp.map((p) => p.f),
      volts,
      losses,
    );
    assert.ok(model);
    hornresp.forEach((expected, i) => {
      const engine = model.curve[i];
      const at = `${c.name} at ${expected.f.toFixed(1)} Hz`;
      assert.ok(
        Math.abs(engine.powerSpl - expected.spl) <= c.spl,
        `${at}: SPL ${engine.powerSpl} vs ${expected.spl}`,
      );
      assert.ok(
        // the engine's Ze is one driver's; Hornresp's is the composite's, the drivers in parallel
        Math.abs(engine.ze / (expected.ze * c.boxes * c.drivers) - 1) <= CIRCUIT_TOLERANCE,
        `${at}: Ze ${engine.ze} vs ${expected.ze * c.boxes * c.drivers}`,
      );
      assert.ok(
        Math.abs(engine.xmm - expected.xmm) <=
          CIRCUIT_TOLERANCE * expected.xmm + EXCURSION_ROUNDING_MM,
        `${at}: excursion ${engine.xmm} vs ${expected.xmm}`,
      );
    });
  });
}
