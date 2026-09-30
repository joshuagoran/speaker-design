import test from "node:test";
import { hifiOptimize, hifiProblems } from "../tools/hifi-optimize.js";
import { hifiSystem, hifiChips } from "../tools/hifi.js";
import { HIFI_WOOFERS, HIFI_TWEETERS } from "../tools/data.js";

const cur = { woofer: "sb17nrx", tweeter: "sb26stcn", box: "vented", dim: { w: 9, h: 15, d: 11 }, wall: 0.75, port: { n: 1, dia: 2, len: 6 },
  xo: 2000, order: 4, wAmpW: 100, tAmpW: 50, bsc: 3, place: "free", wallFt: 2, portMax: 17, guide: null };
const base = { cur, woofers: HIFI_WOOFERS, tweeters: HIFI_TWEETERS, budget: 800, seatM: 2.6 };
const beat = { smaller: (m, c) => m.gross <= c.gross * 0.9, deeper: (m, c) => m.f3 <= c.f3 - 3, cheaper: (m, c) => m.price < c.price, louder: (m, c) => m.level >= c.level + 1 };
const axisOf = { "Smaller box": "smaller", "Deeper bass": "deeper", "Cheaper pair": "cheaper", Louder: "louder" };

test("every driver in the hi-fi list can be modelled", (t) => {
  const tw = HIFI_TWEETERS.find((o) => o.id === "sb26stcn");
  for (const w of HIFI_WOOFERS) t.assert.ok(hifiSystem(w, tw, cur), w.id);
});

for (const goal of ["smaller", "deeper", "cheaper", "louder"]) {
  test(`hi-fi optimizer (${goal}): cards pass the checks, stay in budget, and their labels are true`, (t) => {
    const t0 = Date.now(), out = hifiOptimize({ ...base, goals: [goal] });
    t.assert.ok(Date.now() - t0 < 10000, `${Date.now() - t0} ms`);
    t.assert.ok(out.cards.length >= 1 || out.goalMissing, "cards or a message");
    for (const k of out.cards) {
      const w = HIFI_WOOFERS.find((o) => o.id === k.woofer), tw = HIFI_TWEETERS.find((o) => o.id === k.tweeter);
      const c = { ...cur, ...k.cfg }, sys = hifiSystem(w, tw, c);
      t.assert.deepEqual(hifiProblems(sys, hifiChips(sys, w, tw, c)), [], k.label);
      t.assert.ok(k.metrics.price <= base.budget, "within budget");
      const axis = axisOf[k.label] || goal;
      t.assert.ok(beat[axis](k.metrics, out.cur), `${k.label} beats the current design on ${axis}`);
    }
  });
}

test("hi-fi optimizer: locked woofer and exact box stay put", (t) => {
  const out = hifiOptimize({ ...base, goals: ["louder"], locks: { woofer: true, dim: { w: "exact", h: "exact", d: "exact" } } });
  for (const k of out.cards) { t.assert.equal(k.woofer, cur.woofer); t.assert.deepEqual(k.cfg.dim, cur.dim); }
});
