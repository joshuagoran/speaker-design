import { test } from "vite-plus/test";
import assert from "node:assert";
import { optimizePaStack, paSearchDesign } from "../src/lib/pa/optimize";
import { optimizePaStackExact } from "../src/lib/pa/optimizeExact";
import { PA_SLIDERS, PA_THROAT_MAX_VSLOT1 } from "../src/constants/paSliders";
import { ductFit, ductFits, ductLenSliderMax } from "../src/lib/pa/chips";
import { paCurrent } from "./optimizer-dump-cases";
import { SUB_OPTIONS } from "../src/lib/data";
import { byIdOrThrow } from "../src/lib/tables";
import { CATALOG_TABLE_NAMES } from "../src/constants/catalogTables";
import type { PaDesignConfig, PaOptimizerInput, PaOptimizerResult, SliderSpec } from "../src/types";

// Every card either search returns, and the near miss's closest design, loads as a design the planner can show: each
// field the optimizer sets sits on its slider's step and inside its range (a value that is your design's own, such as a
// side you locked, is left as you set it).

const subOf = (c: PaDesignConfig) => byIdOrThrow(SUB_OPTIONS, c.sub, CATALOG_TABLE_NAMES.subs);
const fields = (c: PaDesignConfig): [string, number, SliderSpec][] => [
  ["sub width", c.cDim.w, PA_SLIDERS.subW],
  ["sub height", c.cDim.h, PA_SLIDERS.subH],
  ["sub depth", c.cDim.d, PA_SLIDERS.subD],
  ["mid width", c.mDim.w, PA_SLIDERS.midW],
  ["mid height", c.mDim.h, PA_SLIDERS.midH],
  ["mid depth", c.mDim.d, PA_SLIDERS.midD],
  // the duct slider runs on to a bottom slot's longest fold
  [
    "duct length",
    c.cVent.len,
    {
      ...PA_SLIDERS.ductLen,
      max: ductLenSliderMax(c.cDim, c.portStyle, c.cVent, c.wall, subOf(c)),
    },
  ],
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

function checkResult(what: string, r: PaOptimizerResult, cur?: PaDesignConfig) {
  const own = new Map(cur ? fields(cur).map(([name, x]) => [name, x] as const) : []);
  const configs = [
    ...r.cards.map((k) => [k.label, k.config] as const),
    ...(r.nearMiss?.closest ? [["near miss", r.nearMiss.closest.config] as const] : []),
  ];
  assert.ok(configs.length > 0, `${what}: something to check`);
  for (const [label, c] of configs) {
    // and a duct the layout can build (a bottom slot never in the lengths that fit neither straight nor folded)
    if (own.get("duct length") !== c.cVent.len)
      assert.ok(
        ductFits(ductFit(c.cDim, c.portStyle, c.cVent, c.wall, subOf(c)).spans, c.cVent.len),
        `${what}, ${label}: duct length ${c.cVent.len} doesn't fit the box`,
      );
    for (const [name, x, s] of fields(c)) {
      if (own.get(name) === x) continue;
      const where = `${what}, ${label}: ${name} ${x}`;
      assert.ok(x >= s.min - 1e-9 && x <= s.max + 1e-9, `${where} is outside ${s.min}–${s.max}`);
      assert.ok(
        Math.abs(x / s.step - Math.round(x / s.step)) < 1e-9,
        `${where} is off its ${s.step} step`,
      );
    }
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
      // the full search with the sub, vent style and box height held (the plywood is its one size), so it stays quick
      const held = {
        ...input,
        locks: { sub: true, vent: true, subDim: { h: "exact" as const } },
      };
      checkResult(`Fully optimize, ${goal}`, optimizePaStackExact(held));
    }
    // a near miss: limits nothing reaches, so the closest design is shown
    checkResult(
      "Improve, near miss",
      optimizePaStack({
        cur: paCurrent(name),
        room: 1000,
        maxLb: 80, // under any ¾″ design here (the optimizer's one plywood), so only the closest shows
        budget: 300,
        goals: ["cheaper"],
        locks: {},
      }),
    );
    const at = (
      cur: PaOptimizerInput["cur"],
      more: Partial<PaOptimizerInput>,
    ): PaOptimizerInput => ({
      cur,
      room: 1000,
      maxLb: 125,
      budget: 1100,
      goals: ["cheaper"],
      locks: {},
      ...more,
    });
    checkResult(
      "Improve, near miss at 80 lb and $400",
      optimizePaStack(at(paCurrent(name), { maxLb: 80, budget: 400 })),
    );
    // slots held in a smaller room: short ducts, and the duct slider starts at 3 in
    const slots = { ...paCurrent(name), portStyle: "slots" as const };
    for (const goal of ["louder", "cheaper"] as const)
      checkResult(
        `Improve, slots held, ${goal}`,
        optimizePaStack(at(slots, { room: 500, goals: [goal], locks: { vent: true } })),
      );
    // a height you locked off its step stays as you set it; everything else still rounds
    const base = paCurrent(name);
    const offStep = { ...base, cDim: { ...base.cDim, h: base.cDim.h + 0.25 } };
    checkResult(
      "Improve, height locked off its step",
      optimizePaStack(at(offStep, { goals: ["lighter"], locks: { subDim: { h: "exact" } } })),
      paSearchDesign({ cur: offStep }),
    );
  }, 120_000);
