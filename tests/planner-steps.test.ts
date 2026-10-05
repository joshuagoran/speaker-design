import { test } from "vite-plus/test";
import assert from "node:assert";
import { optimizePaStack } from "../src/lib/pa/optimize";
import { optimizePaStackExact } from "../src/lib/pa/optimizeExact";
import { PA_SLIDERS, PA_THROAT_MAX_VSLOT1 } from "../src/constants/paSliders";
import { paCurrent } from "./optimizer-dump-cases";
import type { PaDesignConfig, PaOptimizerInput, PaOptimizerResult, SliderSpec } from "../src/types";

// Every card either search returns, and the near miss's closest design, loads as a design the planner can show: each
// field the optimizer sets sits on its slider's step and inside its range.

const fields = (c: PaDesignConfig): [string, number, SliderSpec][] => [
  ["sub width", c.cDim.w, PA_SLIDERS.subW],
  ["sub height", c.cDim.h, PA_SLIDERS.subH],
  ["sub depth", c.cDim.d, PA_SLIDERS.subD],
  ["mid width", c.mDim.w, PA_SLIDERS.midW],
  ["mid height", c.mDim.h, PA_SLIDERS.midH],
  ["mid depth", c.mDim.d, PA_SLIDERS.midD],
  ["duct length", c.cVent.len, PA_SLIDERS.ductLen],
  ["slot height", c.cVent.slotH, PA_SLIDERS.slotH],
  [
    "duct throat",
    c.cVent.throat,
    {
      ...PA_SLIDERS.throat,
      max: c.portStyle === "vslot1" ? PA_THROAT_MAX_VSLOT1 : PA_SLIDERS.throat.max,
    },
  ],
  ["tubes", c.cVent.nt, PA_SLIDERS.tubes],
  ["tube diameter", c.cVent.dia, PA_SLIDERS.tubeDia],
  ["highpass", c.hpf, PA_SLIDERS.hpf],
  ["low crossover", c.xoLo, PA_SLIDERS.xoLo],
  ["high crossover", c.xoHi, PA_SLIDERS.xoHi],
];

function checkResult(what: string, r: PaOptimizerResult) {
  const configs = [
    ...r.cards.map((k) => [k.label, k.config] as const),
    ...(r.nearMiss?.closest ? [["near miss", r.nearMiss.closest.config] as const] : []),
  ];
  assert.ok(configs.length > 0, `${what}: something to check`);
  for (const [label, c] of configs)
    for (const [name, x, s] of fields(c)) {
      const where = `${what}, ${label}: ${name} ${x}`;
      assert.ok(x >= s.min - 1e-9 && x <= s.max + 1e-9, `${where} is outside ${s.min}–${s.max}`);
      assert.ok(
        Math.abs(x / s.step - Math.round(x / s.step)) < 1e-9,
        `${where} is off its ${s.step} step`,
      );
    }
}

for (const name of ["rectangle sub"])
  test(`planner steps: Improve's and Fully optimize's cards sit on the planner's sliders (${name})`, () => {
    for (const goal of ["cheaper", "lighter", "lower", "louder"] as const) {
      const input: PaOptimizerInput = {
        cur: paCurrent(name),
        room: 1000,
        maxLb: 125,
        budget: 1100,
        goals: [goal],
        locks: {},
      };
      checkResult(`Improve, ${goal}`, optimizePaStack(input));
      // the full search with the sub, plywood, vent style and box height held, so it stays about a second
      const held = {
        ...input,
        locks: { sub: true, wall: true, vent: true, subDim: { h: "exact" as const } },
      };
      checkResult(`Fully optimize, ${goal}`, optimizePaStackExact(held));
    }
    // a near miss: limits nothing reaches, so the closest design is shown
    checkResult(
      "Improve, near miss",
      optimizePaStack({
        cur: paCurrent(name),
        room: 1000,
        maxLb: 40,
        budget: 300,
        goals: ["cheaper"],
        locks: {},
      }),
    );
  }, 120_000);
