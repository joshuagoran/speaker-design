import test from "node:test";
import fs from "node:fs";
import { optimize, evaluate, problems, bandOut, roomNeed, BAND } from "../tools/optimize.js";
import { boxModel, subLimits, ampV } from "../tools/calc.js";
import { SUB_OPTIONS, MID_BOXES } from "../tools/data.js";
import { close } from "./helpers.js";

const seeds = JSON.parse(fs.readFileSync(new URL("../data/configs-seed.json", import.meta.url)));
const golden = JSON.parse(fs.readFileSync(new URL("./golden.json", import.meta.url)));
const pick = (name) => {
  const c = seeds.find((x) => x.name === name);
  return { layout: "stack", inset: 0.75, wall: 0.75, hpType: "BW24", portMax: 20, tilt: 6, hfTilt: 6, joint: "butt",
    mDim: { ...(MID_BOXES.find((b) => b.id === c.midBox) || MID_BOXES[0]).box }, ...c };
};
const cur = pick("lil block stack LE (optimized)");
const base = { cur, room: 1000, maxLb: 125, budget: 1100, locks: {} };

test("evaluate() gives the planner's numbers (golden snapshot)", (t) => {
  for (const name of ["lil block stack LE (optimized)", "blocky", "lil tower"]) {
    const m = evaluate(pick(name)), g = golden[name];
    close(t, m.Fb, g.Fb, 0.02, `${name} Fb`); close(t, m.f3, g.f3, 0.02, `${name} f3`); close(t, m.spl45, g.spl45, 0.02, `${name} spl45`);
  }
});

test("bandOut is the lowest music-limit level from 40 to 90 Hz (a peak can't raise it)", (t) => {
  const ts = SUB_OPTIONS.find((o) => o.id === "f18fh500").ts, V = ampV(500);
  const mdl = boxModel(ts, 150, 60, 12, 30, V, "BW24"), L = subLimits(mdl, ts, V, 20);
  const sc = 20 * Math.log10(L.V / V), inBand = mdl.curve.filter((o) => o.f >= BAND[0] && o.f <= BAND[1]).map((o) => o.spl + sc);
  close(t, bandOut(mdl, L, V), Math.min(...inBand), 1e-9);
});

test("room target: farther listener or no room gain needs more", (t) => {
  t.assert.ok(roomNeed(500) < roomNeed(1000) && roomNeed(1000) < roomNeed("outdoor"));
});

const runs = {};
for (const goal of ["cheaper", "lighter", "lower", "louder"]) {
  test(`optimize (${goal}): every card passes every check and reproduces its numbers`, (t) => {
    const t0 = Date.now(), out = (runs[goal] = optimize({ ...base, goal }));
    t.assert.ok(Date.now() - t0 < 8000, `took ${Date.now() - t0} ms`);
    t.assert.ok(out.cards.length >= 1, "at least one card");
    for (const k of out.cards) {
      const m = evaluate(k.config);
      t.assert.deepEqual(problems(m, { maxLb: base.maxLb, budget: base.budget }), [], k.label);
      close(t, m.out, k.metrics.out, 1e-9, "output"); close(t, m.price, k.metrics.price, 1e-9, "price"); close(t, m.heaviest, k.metrics.heaviest, 1e-9, "weight");
      for (const key of ["sub", "mid", "cd", "horn", "cDim", "cVent", "portStyle", "mDim", "xoLo", "xoHi", "hpf", "wall", "ampW", "mAmpW", "hfAmpW"])
        t.assert.ok(k.config[key] !== undefined, `full snapshot: ${key}`);
    }
  });
}

test("the first card meets the goal; alternatives beat it on their own axis", (t) => {
  const out = runs.cheaper || optimize({ ...base, goal: "cheaper" });
  const [a, ...alts] = out.cards;
  t.assert.ok(a.metrics.out >= out.target - 0.5);
  for (const k of alts) {
    const m = k.metrics, f = a.metrics;
    const ok = { Cheaper: m.price <= f.price - 25, Lighter: m.heaviest <= f.heaviest - 3, Louder: m.out >= f.out + 1, "Goes lower": m.f3 <= f.f3 - 2 }[k.label];
    t.assert.ok(ok, `${k.label} card doesn't beat the first`);
    const vol = (c) => c.cDim.w * c.cDim.h * c.cDim.d;
    t.assert.ok(k.config.sub !== a.config.sub || k.config.portStyle !== a.config.portStyle || k.config.mid !== a.config.mid
      || Math.abs(vol(k.config) / vol(a.config) - 1) >= 0.15, "alternatives differ in driver, vent, mid or box size");
  }
});

test("locks: locked parts stay, dimension limits hold", (t) => {
  // (the saved config pairs a 1.4" driver with a 1" horn; lock a matching horn)
  const out = optimize({ ...base, cur: { ...cur, horn: "a460g2_14" }, goal: "louder", locks: { sub: true, mid: true, cd: true, horn: true, subDim: { d: "max" }, midDim: { w: "exact", h: "exact" } } });
  t.assert.ok(out.cards.length >= 1);
  for (const k of out.cards) {
    for (const key of ["sub", "mid", "cd"]) t.assert.equal(k.config[key], cur[key], key);
    t.assert.equal(k.config.horn, "a460g2_14");
    t.assert.ok(k.config.cDim.d <= cur.cDim.d, "sub depth within the limit");
    t.assert.equal(k.config.mDim.w, cur.mDim.w); t.assert.equal(k.config.mDim.h, cur.mDim.h);
  }
});

test("impossible limits: no cards, a near-miss that names what blocks it", (t) => {
  const out = optimize({ ...base, goal: "cheaper", maxLb: 40 });
  t.assert.equal(out.cards.length, 0);
  t.assert.ok(out.nearMiss && out.nearMiss.blocking.length > 0);
});

test("amps: unlocked amps never go up; locked amps stay; same-output cards keep the target", (t) => {
  const free = runs.cheaper || optimize({ ...base, goal: "cheaper" });
  for (const k of free.cards) {
    t.assert.ok(k.config.ampW <= cur.ampW && k.config.mAmpW <= cur.mAmpW && k.config.hfAmpW <= cur.hfAmpW, k.label);
  }
  t.assert.ok(free.cards[0].metrics.out >= free.target - 0.5);
  const locked = optimize({ ...base, goal: "cheaper", locks: { ampW: true, mAmpW: true, hfAmpW: true } });
  for (const k of locked.cards) t.assert.deepEqual([k.config.ampW, k.config.mAmpW, k.config.hfAmpW], [cur.ampW, cur.mAmpW, cur.hfAmpW]);
});
