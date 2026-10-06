import { test } from "vite-plus/test";
import assert from "node:assert";
import fs from "node:fs";
import {
  optimizePaStack,
  evaluateDesign,
  designProblems,
  bandOutputDb,
  roomRequiredSpl,
  SUB_BAND_HZ,
  AMP_WATTS_MAX,
  ventSizesFor,
  PA_REACH_WORDS,
  paOptimizerWalls,
} from "../src/lib/pa/optimize";
import { boxModel, subwooferLimits, ampVoltage } from "../src/lib/pa/calc";
import { optimizePaStackExact } from "../src/lib/pa/optimizeExact";
import { panelIn } from "../src/lib/panel";
import { PA_OPTIMIZER_PANEL } from "../src/constants/optimizerPanels";
import { KEEP_UP_SLACK_DB } from "../src/lib/pa/chips";
import { SUB_OPTIONS, MID_BOXES } from "../src/lib/data";
import { OUT_OF_REACH_LEAD } from "../src/constants/optimizerText";
import type {
  ChipId,
  Dims3,
  PaDesignConfig,
  PaGoal,
  PaMetricsSummary,
  PaOptimizerCurrent,
  PaOptimizerInput,
  PaOptimizerLocks,
  PaOptimizerResult,
} from "../src/types";
import { close } from "./helpers";
import { SEED_NAMES } from "./seeds";

// boundary: the seed file is saved configurations (older ones lack mDim; all carry ampW), and golden.json holds the numbers checked below
const seeds = JSON.parse(
  fs.readFileSync(new URL("../data/configs-seed.json", import.meta.url), "utf8"),
) as (Omit<PaOptimizerCurrent, "mDim" | "ampW"> & { mDim?: Dims3; ampW: number; name: string })[];
const golden = JSON.parse(
  fs.readFileSync(new URL("./golden.json", import.meta.url), "utf8"),
) as Record<string, { Fb: number; f3: number; spl45: number }>;
// a saved design with the fields older saves lack filled in (every seed carries `ampW`; the crossovers and amps stay optional)
type Picked = PaOptimizerCurrent &
  Required<
    Pick<
      PaDesignConfig,
      "layout" | "inset" | "wall" | "hpType" | "portMax" | "tilt" | "hfTilt" | "ampW"
    >
  > & {
    name: string;
  };
const pick = (name: string): Picked => {
  const c = seeds.find((x) => x.name === name)!;
  return {
    layout: "stack",
    inset: 0.75,
    wall: 0.75,
    hpType: "BW24",
    portMax: 20,
    tilt: 6,
    hfTilt: 6,
    joint: "butt",
    mDim: { ...(MID_BOXES.find((b) => b.id === c.midBox) || MID_BOXES[0]).box },
    ...c,
  };
};
/** The design fails on this check: it warns or fails, and the optimizer counts it as a problem. */
const failsOn = (
  m: ReturnType<typeof evaluateDesign>,
  lim: { maxLb: number; budget: number },
  id: ChipId<"sub" | "mid" | "horn">,
) =>
  !!m &&
  [...m.chips.sub, ...m.chips.mid, ...m.chips.horn].some(([kind, h, , i]) => {
    return i === id && kind !== "ok" && designProblems(m, lim).includes(h);
  });
const cur = pick(SEED_NAMES.lilBlockOptimized);
const base: PaOptimizerInput = { cur, room: 1000, maxLb: 125, budget: 1100, locks: {} };

test("evaluate() gives the planner's numbers (golden snapshot)", (t) => {
  for (const name of [SEED_NAMES.lilBlockOptimized, SEED_NAMES.blocky, SEED_NAMES.lilTower]) {
    // the seeds carry the crossovers and amps now; the type keeps them optional, as older saves lack them
    const m = evaluateDesign(pick(name) as PaDesignConfig)!,
      g = golden[name];
    close(t, m.Fb, g.Fb, 0.02, `${name} Fb`);
    close(t, m.f3, g.f3, 0.02, `${name} f3`);
    close(t, m.spl45, g.spl45, 0.02, `${name} spl45`);
  }
});

test("bandOut is the lowest music-limit level from 40 to 90 Hz (a peak can't raise it)", (t) => {
  const ts = SUB_OPTIONS.find((o) => o.id === "f18fh500")!.ts,
    V = ampVoltage(500);
  const mdl = boxModel(ts, 150, 60, 12, 30, V, "BW24")!,
    L = subwooferLimits(mdl, ts, V, 20);
  const sc = 20 * Math.log10(L.V / V),
    inBand = mdl.curve
      .filter((o) => o.f >= SUB_BAND_HZ[0] && o.f <= SUB_BAND_HZ[1])
      .map((o) => o.spl + sc);
  close(t, bandOutputDb(mdl, L, V), Math.min(...inBand), 1e-9);
});

test("room target: farther listener or no room gain needs more", (t) => {
  assert.ok(
    roomRequiredSpl(500) < roomRequiredSpl(1000) &&
      roomRequiredSpl(1000) < roomRequiredSpl("outdoor"),
  );
});

const runs: Record<string, PaOptimizerResult> = {};
for (const goal of ["cheaper", "lighter", "lower", "louder"] as const) {
  test(`optimize (${goal}): every card passes every check and reproduces its numbers`, (t) => {
    const t0 = Date.now(),
      out = (runs[goal] = optimizePaStack({ ...base, goal }));
    assert.ok(Date.now() - t0 < 8000, `took ${Date.now() - t0} ms`);
    assert.ok(out.cards.length >= 1, "at least one card");
    for (const k of out.cards) {
      const m = evaluateDesign(k.config)!;
      assert.deepEqual(designProblems(m, { maxLb: base.maxLb, budget: base.budget }), [], k.label);
      close(t, m.out, k.metrics.out, 1e-9, "output");
      close(t, m.price, k.metrics.price, 1e-9, "price");
      close(t, m.heaviest, k.metrics.heaviest, 1e-9, "weight");
      for (const key of [
        "sub",
        "mid",
        "cd",
        "horn",
        "cDim",
        "cVent",
        "portStyle",
        "mDim",
        "xoLo",
        "xoHi",
        "hpf",
        "wall",
        "ampW",
        "mAmpW",
        "hfAmpW",
      ] as const)
        assert.ok(k.config[key] !== undefined, `full snapshot: ${key}`);
    }
  });
}

test("every card's label is true against the current design", (t) => {
  // (also run with a current design that fails: over budget, so the fix card appears)
  runs.failing = optimizePaStack({ ...base, budget: 850, goal: "cheaper" });
  for (const goal of ["cheaper", "lighter", "lower", "louder", "failing"] as const) {
    // "failing" is always in `runs` (set above), so the fallback only ever gets a real goal
    const out = runs[goal] || optimizePaStack({ ...base, goal: goal as PaGoal }),
      c = out.curM!;
    for (const k of out.cards) {
      const m = k.metrics;
      if (k.slot.kind === "fix" || k.slot.kind === "closest") {
        assert.ok(out.curProblems.length > 0, "only when the current design fails a check");
        continue;
      }
      const beat: Record<PaGoal, boolean> = {
        cheaper: m.price < c.price,
        lighter: m.heaviest <= c.heaviest - 3,
        louder: m.out >= c.out + 1,
        lower: m.f3 <= c.f3 - 2,
      };
      // an alternative is held to its own goal; the first card and the smallest change to the primary goal
      const axis = k.slot.kind === "alt" ? k.slot.axis : out.goals[0];
      assert.ok(beat[axis], `${goal}: "${k.label}" doesn't beat the current design on ${axis}`);
    }
    if (!out.cards.length || out.goalMissing) continue;
    assert.ok(out.cards[0].metrics.out >= out.target - 0.5, `${goal}: first card meets the target`);
  }
});

test("locks: locked parts stay, dimension limits hold", (t) => {
  // (the saved config pairs a 1.4" driver with a 1" horn; lock a matching horn)
  const out = optimizePaStack({
    ...base,
    cur: { ...cur, horn: "a460g2_14" },
    goal: "louder",
    locks: {
      sub: true,
      mid: true,
      cd: true,
      horn: true,
      subDim: { d: "max" },
      midDim: { w: "exact", h: "exact" },
    },
  });
  assert.ok(out.cards.length >= 1);
  for (const k of out.cards) {
    for (const key of ["sub", "mid", "cd"] as const) assert.equal(k.config[key], cur[key], key);
    assert.equal(k.config.horn, "a460g2_14");
    assert.ok(k.config.cDim.d <= cur.cDim.d, "sub depth within the limit");
    assert.equal(k.config.mDim.w, cur.mDim.w);
    assert.equal(k.config.mDim.h, cur.mDim.h);
  }
});

test("impossible limits: no cards, a near-miss that names what blocks it", (t) => {
  const out = optimizePaStack({ ...base, goal: "cheaper", maxLb: 40 });
  assert.equal(out.cards.length, 0);
  assert.ok(out.nearMiss && out.nearMiss.blocking.length > 0);
});

test("amps: unlocked amps stay within the sliders; locked amps stay; same-output cards keep the target", (t) => {
  const free = runs.cheaper || optimizePaStack({ ...base, goal: "cheaper" });
  for (const k of free.cards) {
    assert.ok(
      k.config.ampW <= AMP_WATTS_MAX.ampW &&
        k.config.mAmpW <= AMP_WATTS_MAX.mAmpW &&
        k.config.hfAmpW <= AMP_WATTS_MAX.hfAmpW,
      k.label,
    );
  }
  if (!free.goalMissing) assert.ok(free.cards[0].metrics.out >= free.target - 0.5);
  const locked = optimizePaStack({
    ...base,
    goal: "cheaper",
    locks: { ampW: true, mAmpW: true, hfAmpW: true },
  });
  for (const k of locked.cards)
    assert.deepEqual(
      [k.config.ampW, k.config.mAmpW, k.config.hfAmpW],
      [cur.ampW, cur.mAmpW, cur.hfAmpW],
    );
});

test("all three sub dimensions exact: tunes that one box (sub locked)", (t) => {
  const c = { ...pick(SEED_NAMES.lightBlock), horn: "a460g2_14" };
  const out = optimizePaStack({
    ...base,
    cur: c,
    goal: "louder",
    locks: { sub: true, subDim: { w: "exact", h: "exact", d: "exact" } },
  });
  assert.ok(out.cards.length >= 1, JSON.stringify(out.nearMiss && out.nearMiss.blocking));
  for (const k of out.cards) assert.deepEqual(k.config.cDim, c.cDim);
});

test("15 in sub: a box narrower than an 18 in needs is allowed", (t) => {
  const c = { ...cur, sub: "sbnero15", cDim: { w: 19, h: 24, d: 20 }, horn: "a460g2_14" };
  const out = optimizePaStack({
    ...base,
    cur: c,
    goal: "louder",
    locks: { sub: true, subDim: { w: "exact", h: "exact", d: "exact" } },
  });
  assert.ok(out.cards.length >= 1, JSON.stringify(out.nearMiss && out.nearMiss.blocking));
});

test("a near-miss option, once applied, finds designs", (t) => {
  const out = optimizePaStack({ ...base, goal: "cheaper", maxLb: 100 });
  if (out.cards.length) return; // nothing to check: the limit wasn't binding
  for (const o of out.nearMiss!.options) {
    const again = optimizePaStack({ ...base, goal: "cheaper", maxLb: 100, ...o.set });
    assert.ok(again.cards.length >= 1, o.text);
  }
  assert.ok(out.nearMiss!.blocking.length > 0 && out.nearMiss!.blocking.every((b) => b.length > 0));
});

test("no card carries 'Horn stops loading near the crossover' when the horn, driver or crossover is free", (t) => {
  for (const goal of ["cheaper", "lighter", "lower", "louder"] as const) {
    const out = runs[goal] || optimizePaStack({ ...base, goal });
    for (const k of out.cards)
      assert.ok(!k.warnings.some(([, , , id]) => id === "hornLoading"), `${goal}: ${k.label}`);
  }
});

test("stacked goals: the main card beats the current design on every goal; the first goal ranks", (t) => {
  const beat: Record<PaGoal, (m: PaMetricsSummary, c: PaMetricsSummary) => boolean> = {
    cheaper: (m, c) => m.price < c.price,
    lighter: (m, c) => m.heaviest <= c.heaviest - 3,
    louder: (m, c) => m.out >= c.out + 1,
    lower: (m, c) => m.f3 <= c.f3 - 2,
  };
  for (const goals of [
    ["cheaper", "lighter"],
    ["lighter", "cheaper"],
    ["cheaper", "louder"],
    ["louder", "lower"],
  ] as const) {
    const out = optimizePaStack({ ...base, goals });
    assert.deepEqual(out.goals, goals);
    const main = out.cards.find((k) => k.slot.kind === "first");
    if (!main) {
      assert.ok(
        out.goalMissing || out.curProblems.length,
        `${goals.join()}: no main card and no message`,
      );
      continue;
    }
    assert.equal(out.cards[0], main, `${goals.join()}: main card first`);
    for (const g of goals)
      assert.ok(
        beat[g](main.metrics, out.curM!),
        `${goals.join()}: main card doesn't beat the current design on ${g}`,
      );
  }
  const a = optimizePaStack({ ...base, goals: ["cheaper", "lighter"] }).cards[0],
    b = optimizePaStack({ ...base, goals: ["lighter", "cheaper"] }).cards[0];
  if (a && b && a.slot.kind === "first" && b.slot.kind === "first")
    assert.ok(
      a.metrics.price <= b.metrics.price + 1e-9 && b.metrics.heaviest <= a.metrics.heaviest + 1e-9,
    );
});

test("louder with the sub amp unlocked turns it up when the amp is what limits the sub", (t) => {
  const locks: PaOptimizerLocks = {
    sub: true,
    mid: true,
    cd: true,
    horn: true,
    vent: true,
    hpf: true,
    xoLo: true,
    xoHi: true,
    subDim: { w: "exact", h: "exact", d: "exact" },
    midDim: { w: "exact", h: "exact", d: "exact" },
  };
  const c = {
    xoLo: 120,
    xoHi: 900,
    xoLoOrder: 4 as const,
    xoHiOrder: 4 as const,
    mAmpW: 400,
    hfAmpW: 100,
    ...pick(SEED_NAMES.lightBlock),
    ampW: 200,
  }; // a small amp: the sub is amp-limited
  assert.equal(evaluateDesign(c)!.who, "amp");
  const out = optimizePaStack({
    ...base,
    cur: c,
    maxLb: 200,
    budget: 2000,
    goals: ["louder"],
    locks,
  });
  assert.ok(out.cards.length >= 1, JSON.stringify(out.nearMiss && out.nearMiss.blocking));
  const k = out.cards[0];
  assert.ok(k.config.ampW > c.ampW, `amp ${k.config.ampW} W`);
  assert.ok(k.metrics.out >= evaluateDesign(c)!.out + 1, "louder than the design at 200 W");
  // and no more power than it uses: 50 W less loses output
  const less = evaluateDesign({ ...k.config, ampW: k.config.ampW - 50 })!;
  assert.ok(less.out < k.metrics.out - 0.01 || k.config.ampW - 50 < 200);
});

test("vent locked on a round1 or round4 style searches that style's tubes instead of throwing", (t) => {
  for (const [style, nt] of [
    ["round1", 1],
    ["round4", 4],
  ] as const) {
    assert.ok(ventSizesFor(style).length > 0, `${style} has vent sizes`);
    for (const size of ventSizesFor(style)) assert.equal(size.nt, nt, `${style} tubes`);
  }
  for (const style of ["slots", "round1", "round2", "vslots", "round4", "vslot1"] as const)
    assert.ok(ventSizesFor(style).length > 0, `${style} has sizes`);

  const c = {
    xoLo: 120,
    xoHi: 900,
    mAmpW: 400,
    hfAmpW: 100,
    ...pick(SEED_NAMES.lightBlock),
    portStyle: "round1" as const,
    cVent: { slotH: 3, nt: 1, dia: 5, throat: 3, len: 12 },
  };
  const out = optimizePaStack({
    ...base,
    cur: c,
    maxLb: 200,
    budget: 2000,
    goal: "lighter",
    locks: { vent: true },
  });
  assert.ok(out.cards.length >= 1, "cards come back for a locked round1 vent");
  for (const k of out.cards) {
    assert.equal(k.config.portStyle, "round1");
    assert.equal(k.config.cVent.nt, 1);
  }
});

test("evaluate() rejects a config missing a number it needs, and every seed completes to finite metrics", () => {
  // boundary: `Picked` types the defaulted fields as optional; a seed carries them all
  const full = { ...pick(SEED_NAMES.blocky) } as PaDesignConfig;
  const m = evaluateDesign(full);
  assert.ok(m, "a complete design evaluates");
  for (const [k, v] of Object.entries(m))
    if (typeof v === "number") assert.ok(Number.isFinite(v), `blocky ${k} is ${v}`);
  for (const key of ["xoLo", "xoHi", "mAmpW", "hfAmpW", "tilt", "hfTilt", "wall", "ampW"] as const)
    assert.equal(evaluateDesign({ ...full, [key]: undefined }), null, `no ${key}`);
  assert.equal(evaluateDesign({ ...full, [`xoLo`]: NaN }), null, "NaN is not a number");
  // boundary: an older save with no mid box size at all
  assert.equal(evaluateDesign({ ...full, mDim: undefined } as unknown as PaDesignConfig), null);
  // boundary: older saves with no vent, or with a vent layout the planner doesn't know
  assert.equal(
    evaluateDesign({ ...full, cVent: undefined } as unknown as PaDesignConfig),
    null,
    "no vent",
  );
  assert.equal(
    evaluateDesign({ ...full, portStyle: undefined } as unknown as PaDesignConfig),
    null,
    "no port style",
  );
  assert.equal(
    evaluateDesign({ ...full, portStyle: "nope" } as unknown as PaDesignConfig),
    null,
    "unknown port style",
  );
  assert.equal(
    evaluateDesign({ ...full, cVent: { ...full.cVent, len: NaN } }),
    null,
    "NaN vent length",
  );
  for (const style of ["slots", "vslots", "vslot1", "round1", "round2", "round4"] as const) {
    const cVent = { slotH: 3, nt: 2, dia: 4, throat: 2, len: 14 };
    assert.ok(evaluateDesign({ ...full, portStyle: style, cVent }), `${style} with a full vent`);
  }
  for (const s of seeds) {
    const c = pick(s.name);
    for (const key of ["xoLo", "xoHi", "mAmpW", "hfAmpW"] as const)
      assert.ok(Number.isFinite(c[key]), `${s.name} has ${key}`);
    const e = evaluateDesign(c as PaDesignConfig); // boundary: `PaOptimizerCurrent` types the defaulted fields as optional
    if (e)
      for (const [k, v] of Object.entries(e))
        if (typeof v === "number") assert.ok(Number.isFinite(v), `${s.name} ${k} is ${v}`);
  }
});

test("a locked sub, mid, driver or horn that isn't in the tables leaves nothing to search, and doesn't throw", () => {
  for (const key of ["sub", "mid", "cd", "horn"] as const) {
    const out = optimizePaStack({
      ...base,
      cur: { ...cur, [key]: "no-such-part" },
      locks: { [key]: true },
    });
    assert.deepEqual(out.cards, [], key);
  }
});

test("a failing design with nothing in reach: the closest design that passes, and a notice naming what's out of reach", () => {
  // "blocky" under an $800 budget and 90 lb, with the vent kept to its bottom slot: nothing that passes keeps the
  // design's output (round tubes with elbows keep the round-tube seeds' output for less, so they no longer get here)
  const lim = { maxLb: 90, budget: 800 };
  const out = optimizePaStack({
    ...base,
    ...lim,
    cur: pick(SEED_NAMES.blocky),
    goal: "cheaper",
    locks: { vent: true },
  });
  assert.ok(out.curProblems.length > 0, "the current design fails a check");
  const k = out.cards[0];
  assert.ok(k, "a card is shown");
  assert.equal(k.slot.kind, "closest");
  assert.deepEqual(designProblems(evaluateDesign(k.config)!, lim), []);
  assert.ok(k.metrics.out < out.target - 0.5, "it misses the target");
  const note = out.goalMissing ?? "";
  assert.ok(note.startsWith(OUT_OF_REACH_LEAD), note);
  assert.ok(note.includes(`dB ${PA_REACH_WORDS.level}`), note);
  assert.ok(note.includes(`${k.metrics.out.toFixed(1)} dB`), note);
});

test("with only a closest card, the near miss still offers the looser limit that reaches the goal", () => {
  // "blocky" under an $800 budget and 90 lb, with the vent kept to its bottom slot, nothing that passes keeps the
  // output; $880 does
  const out = optimizePaStack({
    ...base,
    cur: pick(SEED_NAMES.blocky),
    maxLb: 90,
    budget: 800,
    goal: "cheaper",
    locks: { vent: true },
  });
  assert.ok((out.goalMissing ?? "").startsWith(OUT_OF_REACH_LEAD), out.goalMissing ?? "no notice");
  assert.ok(out.cards.length > 0);
  const opts = out.nearMiss ? out.nearMiss.options : [];
  assert.ok(
    opts.some((o) => o.set.budget === 880),
    JSON.stringify(opts.map((o) => o.text)),
  );
});

test("Cheaper swaps the compression driver when a cheaper one keeps up", () => {
  const out = optimizePaStack({ ...base, cur: pick(SEED_NAMES.lightBlock), goal: "cheaper" });
  const k = out.cards[0];
  assert.ok(k, "a card");
  assert.equal(k.config.cd, "hf143n", `kept ${k.config.cd} at $${Math.round(k.metrics.price)}`);
});

test("Cheaper: fewest warnings, then strictly the cheapest, with weight breaking a price tie", () => {
  const out = optimizePaStack({ ...base, goal: "cheaper" }),
    [first, ...rest] = out.cards;
  assert.ok(first, "a card");
  for (const k of rest) assert.ok(first.metrics.price <= k.metrics.price, k.label);
  // every card is in the optimizer's one plywood size, and a crossover that avoids the warning exists
  assert.equal(first.config.wall, paOptimizerWalls(base.cur)[0]);
  assert.ok(
    !first.warnings.some(([, , , id]) => id === "hornMidWider"),
    "no soft warning on the cheapest card",
  );
});

test("a horn that keeps up only below full mid power turns the mid down instead of ruling the design out", () => {
  // a 20 W HF amp, locked with its driver and horn, and every band asked to match the one below flat out: the cheapest
  // mids at the full 2000 W outrun it
  const c = { ...pick(SEED_NAMES.lightBlock), tilt: 0, hfTilt: 0, hfAmpW: 20 },
    lim = { maxLb: base.maxLb, budget: base.budget };
  const out = optimizePaStack({
    ...base,
    cur: c,
    goals: ["cheaper"],
    locks: { cd: true, horn: true, hfAmpW: true },
  });
  const k = out.cards[0];
  assert.ok(k && k.slot.kind === "first", out.goalMissing ?? "no card");
  assert.deepEqual(designProblems(evaluateDesign(k.config), lim), [], "the card passes as it is");
  assert.ok(k.metrics.out >= out.target - 0.5, "and keeps the target");
  assert.ok(
    failsOn(evaluateDesign({ ...k.config, mAmpW: AMP_WATTS_MAX.mAmpW }), lim, "hornKeepsUp"),
    "at full mid power the horn would run out first",
  );
});

test("a mid that keeps up only below full sub power turns the sub down instead of ruling the design out", () => {
  // a 150 W mid amp, locked, asked to match the sub flat out: the subs that go lowest outrun it at full power (the
  // search used to stop at 41.7 Hz; turned down to where the mid keeps up, a 4018 reaches 36 Hz)
  const c = { ...pick(SEED_NAMES.lightBlock), tilt: 0, mAmpW: 150 },
    lim = { maxLb: base.maxLb, budget: base.budget };
  const out = optimizePaStack({ ...base, cur: c, goals: ["lower"], locks: { mAmpW: true } });
  const k = out.cards[0];
  assert.ok(k && k.slot.kind === "first", out.goalMissing ?? "no card");
  assert.deepEqual(designProblems(evaluateDesign(k.config), lim), [], "the card passes as it is");
  assert.ok(k.metrics.out >= out.target - 1.5, "and keeps the output");
  assert.ok(k.metrics.f3 < 38, `F3 ${k.metrics.f3.toFixed(1)} Hz`);
  assert.ok(
    failsOn(evaluateDesign({ ...k.config, ampW: AMP_WATTS_MAX.ampW }), lim, "midKeepsUp"),
    "at full sub power the mid would run out first",
  );
});

test("a band is turned down only as far as the keep-up check needs, not level with the band above", () => {
  // the sub outruns this mid at full power; it comes down until the mid is within the check's slack, which leaves it
  // ~0.4 dB more output than turning it down until the mid is exactly level (about 129.0 dB)
  const lim = { maxLb: base.maxLb, budget: base.budget };
  const out = optimizePaStack({ ...base, cur: pick(SEED_NAMES.lightBlock), goals: ["louder"] });
  const k = out.cards[0];
  assert.ok(k, out.goalMissing ?? "no card");
  const m = evaluateDesign(k.config)!;
  assert.deepEqual(designProblems(m, lim), [], "the card passes as it is");
  assert.ok(m.midGap < 0 && m.midGap >= -KEEP_UP_SLACK_DB, `mid gap ${m.midGap.toFixed(2)} dB`);
  assert.ok(k.metrics.out > 129.2, `${k.metrics.out.toFixed(2)} dB`);
});

test("the mids are chosen with the horn in view: a dearer mid the horn keeps up with is tried", () => {
  // a 20 W HF amp, locked, and every band asked to match the one below flat out. With the lighter sub boxes, the
  // cheapest and lightest mid that keeps the target at full power outruns every horn and comes down below it; the
  // search used to try only that one (and the loudest), and offered only a heavier fix. A mid $11 dearer that the horn
  // keeps up with keeps the target in a box lighter than the design's.
  const c = { ...pick(SEED_NAMES.blocky), tilt: 0, hfTilt: 0, hfAmpW: 20 },
    lim = { maxLb: base.maxLb, budget: base.budget };
  const out = optimizePaStack({ ...base, cur: c, goals: ["lighter"], locks: { hfAmpW: true } });
  const k = out.cards[0];
  assert.ok(k, out.goalMissing ?? "no card");
  assert.deepEqual(designProblems(evaluateDesign(k.config), lim), [], "the card passes as it is");
  assert.ok(k.metrics.out >= out.target - 0.5, "and keeps the target");
  assert.ok(out.curM, "the design evaluates");
  assert.ok(
    k.metrics.heaviest <= out.curM.heaviest - 3,
    `${k.metrics.heaviest.toFixed(1)} lb, the design ${out.curM.heaviest.toFixed(1)} lb`,
  );
});

test("the PA optimizers design in their one plywood size, at its measured thickness, whatever your design's", () => {
  // your design in ½″, with ¾″ measured at 18 mm: every card, quick and exact, comes back in ¾″ at that thickness
  const c = { ...pick("idk tweaked"), wall: 0.5, exactIn: { "3/4": 0.689 } };
  const input: PaOptimizerInput = {
    ...base,
    cur: c,
    goals: ["cheaper"],
    locks: { sub: true, vent: true, subDim: { h: "exact" } },
  };
  const want = panelIn(PA_OPTIMIZER_PANEL, "ply", { "3/4": 0.689 });
  const quick = optimizePaStack(input).cards,
    exact = optimizePaStackExact(input).cards;
  assert.ok(quick.length && exact.length, "cards");
  for (const k of [...quick, ...exact]) assert.equal(k.config.wall, want, k.label);
});
