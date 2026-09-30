import test from "node:test";
import { hifiOptimize, hifiProblems } from "../tools/hifi-optimize.js";
import { hifiSystem, hifiChips } from "../tools/hifi.js";
import { HIFI_WOOFERS, HIFI_TWEETERS } from "../tools/data.js";

const cur = { woofer: "sb17nrx", tweeter: "sb26stcn", box: "vented", dim: { w: 9, h: 15, d: 11 }, wall: 0.75, port: { n: 1, dia: 2, len: 6 },
  xo: 2000, order: 4, wAmpW: 100, tAmpW: 50, bsc: 3, place: "free", wallFt: 2, portMax: 17, guide: null };
const base = { cur, woofers: HIFI_WOOFERS, tweeters: HIFI_TWEETERS, budget: 800, seatM: 2.6 };
const beat = { cheaper: (m, c) => m.price < c.price, lighter: (m, c) => m.lb <= c.lb - 1, lower: (m, c) => m.f3 <= c.f3 - 2, louder: (m, c) => m.level >= c.level + 1 };
const axisOf = { "Same level, cheaper": "cheaper", "Same level, lighter": "lighter", "Go lower": "lower", Cheaper: "cheaper", Lighter: "lighter", Lower: "lower", Louder: "louder" };

test("every driver in the hi-fi list can be modelled", (t) => {
  const tw = HIFI_TWEETERS.find((o) => o.id === "sb26stcn");
  for (const w of HIFI_WOOFERS) t.assert.ok(hifiSystem(w, tw, cur), w.id);
});

for (const goal of ["cheaper", "lighter", "lower", "louder"]) {
  test(`hi-fi optimizer (${goal}): cards pass the checks, stay in budget, and their labels are true`, (t) => {
    const t0 = Date.now(), out = hifiOptimize({ ...base, goals: [goal] });
    t.assert.ok(Date.now() - t0 < 10000, `${Date.now() - t0} ms`);
    t.assert.ok(out.cards.length >= 1 || out.goalMissing, "cards or a message");
    for (const k of out.cards) {
      const w = HIFI_WOOFERS.find((o) => o.id === k.woofer), tw = HIFI_TWEETERS.find((o) => o.id === k.tweeter);
      const c = { ...cur, ...k.config }, sys = hifiSystem(w, tw, c);
      t.assert.deepEqual(hifiProblems(sys, hifiChips(sys, w, tw, c)), [], k.label);
      t.assert.ok(k.metrics.price <= base.budget, "within budget");
      if (k.label === "Fixes your design") continue;
      const axis = axisOf[k.label] || goal;   // "Smallest change" is held to the goal
      t.assert.ok(beat[axis](k.metrics, out.cur), `${k.label} beats the current design on ${axis}`);
    }
  });
}

test("hi-fi optimizer: locked woofer and exact box stay put", (t) => {
  const out = hifiOptimize({ ...base, goals: ["louder"], locks: { woofer: true, dim: { w: "exact", h: "exact", d: "exact" } } });
  for (const k of out.cards) { t.assert.equal(k.woofer, cur.woofer); t.assert.deepEqual(k.config.dim, cur.dim); }
});

test("hi-fi optimizer: unlocked amps stay within the sliders; locked amps stay; Lighter can offer 1/2 in ply", (t) => {
  const out = hifiOptimize({ ...base, goals: ["louder"] });
  for (const k of out.cards) t.assert.ok(k.config.wAmpW <= 500 && k.config.tAmpW <= 200, k.label);
  const locked = hifiOptimize({ ...base, goals: ["cheaper"], locks: { wAmpW: true, tAmpW: true } });
  for (const k of locked.cards) t.assert.deepEqual([k.config.wAmpW, k.config.tAmpW], [cur.wAmpW, cur.tAmpW]);
  const all = { woofer: true, tweeter: true, box: true, xo: true, wAmpW: true, tAmpW: true, dim: { w: "exact", h: "exact", d: "exact" } };
  const ply = hifiOptimize({ ...base, goals: ["lighter"], locks: all });
  t.assert.ok(ply.cards.some((k) => k.config.wall === 0.5), JSON.stringify(ply.cards.map((k) => k.label)));
});
