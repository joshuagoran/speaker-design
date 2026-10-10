import { test } from "vite-plus/test";
import assert from "node:assert";
import {
  FATIGUE_FACTOR,
  LID_STRESS_LIMIT_PA,
  PRESSURE_STRESS_LIMIT_PA,
  driverPressurePa,
  plateStressFactor,
} from "../src/lib/strength";
import { braceBox, strengthShortfalls } from "../src/lib/bracing";
import { braceNoteLines } from "../src/lib/bracingNotes";
import { NO_SUPPORTS, paBoxPanels } from "../src/lib/pa/bracing";
import { paPanelStock, subBoxBracing } from "../src/lib/pa/calc";
import { DEFAULT_PA } from "../src/lib/defaults";

const near = (a: number, b: number, tol: number, msg = "") =>
  assert.ok(Math.abs(a - b) <= tol, `${msg} ${a} vs ${b}`);

test("strength: Eurocode 5's limits from birch ply's 34.1 N/mm², and the fatigue factor for 10⁸ reversed cycles", () => {
  // EN 1995-2 Annex A: 1 − 2 / (9.5 × 2.1) × 8
  near(FATIGUE_FACTOR, 0.198, 0.001);
  near(PRESSURE_STRESS_LIMIT_PA / 1e6, (0.198 * 0.9 * 34.1) / 1.2, 0.02);
  near(LID_STRESS_LIMIT_PA / 1e6, (0.8 * 34.1) / 1.2, 1e-9);
});

test("strength: Roark's β, the larger of the hinged and fixed plates, and the driver's pressure", () => {
  near(plateStressFactor(1, 1), 0.3078, 1e-9); // a square: the fixed edge's
  near(plateStressFactor(20, 10), 0.6102, 1e-9); // 2 : 1, hinged
  near(plateStressFactor(10, 20), 0.6102, 1e-9); // either order
  near(plateStressFactor(100, 10), 0.75, 1e-9); // long strip
  // 1210 cm² moving 9 mm in 176 L: 1.4 × 101 325 Pa × 1.089 L / 176 L
  near(driverPressurePa(1210, 9, 176), (1.4 * 101325 * 1.089) / 176, 1e-6);
  assert.equal(driverPressurePa(1210, 9, 0), 0);
});

test("strength: the starting boxes sit well inside both limits", () => {
  const d = DEFAULT_PA;
  const b = subBoxBracing(d.cDim, 0.5, d.inset, d.portStyle, d.cVent, d.sub, "ribs");
  for (const p of b.panels) {
    assert.ok(p.strength, `${p.id} checked`);
    assert.ok(p.strength.stressPa < 0.5 * p.strength.limitPa, `${p.id} ${p.strength.stressPa}`);
  }
  assert.deepEqual(strengthShortfalls(b), []);
});

test("strength: a panel over its limit takes ribs though it clears the target, and the notes name it", () => {
  // a ½″ box whose panels all clear a low target, under a pressure far over any speaker's
  const stock = paPanelStock(0.5);
  const input = {
    inner: { x: 20, y: 20, z: 20 },
    panels: paBoxPanels({ iw: 20, ih: 20, inD: 20, band: 0 }, stock, stock, NO_SUPPORTS),
    targetHz: 50,
    style: "ribs" as const,
    braceStock: stock,
    keepOut: { driver: [], vent: [] },
  };
  const loads = { pressurePa: 20000, pressureLimitPa: 5e6, lidPa: 0, lidLimitPa: 1 };
  const bare = braceBox(input);
  assert.equal(bare.ribs.length, 0, "no load, no ribs");
  const loaded = braceBox({ ...input, loads });
  assert.ok(loaded.ribs.length > 0, "the stress calls for ribs");
  // a lid's load falls on the top alone
  const lid = braceBox({
    ...input,
    loads: { ...loads, pressurePa: 0, lidPa: 20000, lidLimitPa: 5e6 },
  });
  assert.deepEqual(
    lid.ribs.map((r) => r.panel),
    ["top"],
  );
  assert.equal(lid.panels.find((p) => p.id === "top")?.strength?.load, "lid");
  // still over: the notes name each panel with its stress and limit
  const over = braceBox({ ...input, loads: { ...loads, pressurePa: 1e6 } });
  assert.ok(strengthShortfalls(over).length > 0);
  assert.ok(braceNoteLines("Sub", over).some((n) => n.includes("N/mm²") && n.includes("pressure")));
});
