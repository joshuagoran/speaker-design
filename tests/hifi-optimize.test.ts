import { test } from "vite-plus/test";
import assert from "node:assert";
import { optimizeHifiSpeaker, hifiDesignProblems } from "../src/lib/hifi/optimize.ts";
import { hifiSystem, hifiChips } from "../src/lib/hifi/hifi.ts";
import { HIFI_WOOFERS, HIFI_TWEETERS } from "../src/lib/data.ts";
import type {
  HifiGoal,
  HifiMetrics,
  HifiOptimizerCurrent,
  HifiOptimizerLocks,
} from "../src/types.ts";

const cur: HifiOptimizerCurrent = {
  woofer: "sb17nrx",
  tweeter: "sb26stcn",
  box: "vented",
  dim: { w: 9, h: 15, d: 11 },
  wall: 0.75,
  port: { n: 1, dia: 2, len: 6 },
  xo: 2000,
  order: 4,
  wAmpW: 100,
  tAmpW: 50,
  bsc: 3,
  place: "free",
  wallFt: 2,
  portMax: 17,
  guide: null,
};
const base = { cur, woofers: HIFI_WOOFERS, tweeters: HIFI_TWEETERS, budget: 800, seatM: 2.6 };
const beat: Record<HifiGoal, (m: HifiMetrics, c: HifiMetrics) => boolean> = {
  cheaper: (m, c) => m.price < c.price,
  lighter: (m, c) => m.lb <= c.lb - 1,
  lower: (m, c) => m.f3 <= c.f3 - 2,
  louder: (m, c) => m.level >= c.level + 1,
};
const axisOf: Record<string, HifiGoal> = {
  "Same level, cheaper": "cheaper",
  "Same level, lighter": "lighter",
  "Go lower": "lower",
  Cheaper: "cheaper",
  Lighter: "lighter",
  Lower: "lower",
  Louder: "louder",
};

test("every driver in the hi-fi list can be modelled", (t) => {
  const tw = HIFI_TWEETERS.find((o) => o.id === "sb26stcn")!;
  for (const w of HIFI_WOOFERS) assert.ok(hifiSystem(w, tw, cur), w.id);
});

for (const goal of ["cheaper", "lighter", "lower", "louder"] as const) {
  test(`hi-fi optimizer (${goal}): cards pass the checks, stay in budget, and their labels are true`, (t) => {
    const t0 = Date.now(),
      out = optimizeHifiSpeaker({ ...base, goals: [goal] });
    assert.ok(Date.now() - t0 < 10000, `${Date.now() - t0} ms`);
    assert.ok(out.cards.length >= 1 || out.goalMissing, "cards or a message");
    for (const k of out.cards) {
      const w = HIFI_WOOFERS.find((o) => o.id === k.woofer)!,
        tw = HIFI_TWEETERS.find((o) => o.id === k.tweeter)!;
      // no passives are offered in this run, so a card's id-based `pr` is always undefined (it is not a HifiConfig `pr`)
      const c = { ...cur, ...k.config, pr: undefined },
        sys = hifiSystem(w, tw, c)!;
      assert.deepEqual(hifiDesignProblems(sys, hifiChips(sys, w, tw, c)), [], k.label);
      assert.ok(k.metrics.price <= base.budget, "within budget");
      if (k.label === "Fixes your design") continue;
      const axis = axisOf[k.label] || goal; // "Smallest change" is held to the goal
      assert.ok(beat[axis](k.metrics, out.cur!), `${k.label} beats the current design on ${axis}`);
    }
  });
}

test("hi-fi optimizer: locked woofer and exact box stay put", (t) => {
  const out = optimizeHifiSpeaker({
    ...base,
    goals: ["louder"],
    locks: { woofer: true, dim: { w: "exact", h: "exact", d: "exact" } },
  });
  for (const k of out.cards) {
    assert.equal(k.woofer, cur.woofer);
    assert.deepEqual(k.config.dim, cur.dim);
  }
});

test("hi-fi optimizer: unlocked amps stay within the sliders; locked amps stay; Lighter can offer 1/2 in ply", (t) => {
  const out = optimizeHifiSpeaker({ ...base, goals: ["louder"] });
  for (const k of out.cards) assert.ok(k.config.wAmpW <= 500 && k.config.tAmpW <= 200, k.label);
  const locked = optimizeHifiSpeaker({
    ...base,
    goals: ["cheaper"],
    locks: { wAmpW: true, tAmpW: true },
  });
  for (const k of locked.cards)
    assert.deepEqual([k.config.wAmpW, k.config.tAmpW], [cur.wAmpW, cur.tAmpW]);
  const all: HifiOptimizerLocks = {
    woofer: true,
    tweeter: true,
    box: true,
    xo: true,
    wAmpW: true,
    tAmpW: true,
    dim: { w: "exact", h: "exact", d: "exact" },
  };
  const ply = optimizeHifiSpeaker({ ...base, goals: ["lighter"], locks: all });
  assert.ok(
    ply.cards.some((k) => k.config.wall === 0.5),
    JSON.stringify(ply.cards.map((k) => k.label)),
  );
});

test("hi-fi optimizer: radiator designs price their radiators and load back with them", async (t) => {
  const { optimizeHifiSpeaker } = await import("../src/lib/hifi/optimize.ts");
  const { HIFI_WOOFERS, HIFI_TWEETERS, HIFI_PASSIVES } = await import("../src/lib/data.ts");
  const w = HIFI_WOOFERS.find((o) => o.pick) || HIFI_WOOFERS[0],
    tw =
      HIFI_TWEETERS.find((o) => o.pick && !o.needsWaveguide && o.type !== "compression") ||
      HIFI_TWEETERS[0];
  const drv = HIFI_PASSIVES.find((o) => o.id === "sb16pfcr")!;
  const cur: HifiOptimizerCurrent = {
    woofer: w.id,
    tweeter: tw.id,
    box: "radiator",
    pr: { drv, n: 2, addG: 0 },
    dim: { w: 9, h: 16, d: 11 },
    wall: 0.75,
    port: { n: 1, dia: 2, len: 6 },
    xo: 2200,
    order: 4,
    wAmpW: 100,
    tAmpW: 50,
    bsc: 3,
    place: "free",
    wallFt: 2,
    portMax: 17,
  };
  const res = optimizeHifiSpeaker({
    cur,
    woofers: [w],
    tweeters: [tw],
    passives: HIFI_PASSIVES,
    goals: ["lower"],
    locks: { woofer: true, tweeter: true, box: true },
  });
  for (const k of res.cards) {
    assert.equal(k.config.box, "radiator");
    assert.ok(
      k.config.pr && HIFI_PASSIVES.some((p) => p.id === k.config.pr!.id),
      "a card names its radiator",
    );
    const p = HIFI_PASSIVES.find((o) => o.id === k.config.pr!.id);
    assert.ok(
      k.metrics.price >= 2 * (w.price + tw.price + k.config.pr.n * p!.price) - 0.01,
      "radiators are in the pair price",
    );
  }
});
