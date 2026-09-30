import test from "node:test";
import fs from "node:fs";
import { optimize, evaluate, problems, bandOut, roomNeed, BAND, AMP_MAX } from "../tools/optimize.js";
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

test("every card's label is true against the current design", (t) => {
  // (also run with a current design that fails: over budget, so the fix card appears)
  runs.failing = optimize({ ...base, budget: 700, goal: "cheaper" });
  const goalName = { cheaper: "Same output, cheaper", lighter: "Same output, lighter", lower: "Go lower", louder: "Louder" };
  for (const goal of ["cheaper", "lighter", "lower", "louder", "failing"]) {
    const out = runs[goal] || optimize({ ...base, goal }), c = out.curM;
    for (const k of out.cards) {
      const m = k.metrics;
      if (k.label === "Fixes your design") { t.assert.ok(out.curProblems.length > 0, "only when the current design fails a check"); continue; }
      const beat = { cheaper: m.price < c.price, lighter: m.heaviest <= c.heaviest - 3, louder: m.out >= c.out + 1, lower: m.f3 <= c.f3 - 2 };
      const axis = { Cheaper: "cheaper", Lighter: "lighter", Louder: "louder", "Goes lower": "lower", "Smallest change": goal === "failing" ? "cheaper" : goal }[k.label]
        || Object.keys(goalName).find((g) => k.label === goalName[g]);
      t.assert.ok(beat[axis], `${goal}: "${k.label}" doesn't beat the current design on ${axis}`);
    }
    if (!out.cards.length || out.goalMissing) continue;
    t.assert.ok(out.cards[0].metrics.out >= out.target - 0.5, `${goal}: first card meets the target`);
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

test("amps: unlocked amps stay within the sliders; locked amps stay; same-output cards keep the target", (t) => {
  const free = runs.cheaper || optimize({ ...base, goal: "cheaper" });
  for (const k of free.cards) {
    t.assert.ok(k.config.ampW <= AMP_MAX.ampW && k.config.mAmpW <= AMP_MAX.mAmpW && k.config.hfAmpW <= AMP_MAX.hfAmpW, k.label);
  }
  if (!free.goalMissing) t.assert.ok(free.cards[0].metrics.out >= free.target - 0.5);
  const locked = optimize({ ...base, goal: "cheaper", locks: { ampW: true, mAmpW: true, hfAmpW: true } });
  for (const k of locked.cards) t.assert.deepEqual([k.config.ampW, k.config.mAmpW, k.config.hfAmpW], [cur.ampW, cur.mAmpW, cur.hfAmpW]);
});

test("all three sub dimensions exact: tunes that one box (sub locked)", (t) => {
  const c = { ...pick("light block"), horn: "a460g2_14" };
  const out = optimize({ ...base, cur: c, goal: "louder", locks: { sub: true, subDim: { w: "exact", h: "exact", d: "exact" } } });
  t.assert.ok(out.cards.length >= 1, JSON.stringify(out.nearMiss && out.nearMiss.blocking));
  for (const k of out.cards) t.assert.deepEqual(k.config.cDim, c.cDim);
});

test("15 in sub: a box narrower than an 18 in needs is allowed", (t) => {
  const c = { ...cur, sub: "sbnero15", cDim: { w: 19, h: 24, d: 20 }, horn: "a460g2_14" };
  const out = optimize({ ...base, cur: c, goal: "louder", locks: { sub: true, subDim: { w: "exact", h: "exact", d: "exact" } } });
  t.assert.ok(out.cards.length >= 1, JSON.stringify(out.nearMiss && out.nearMiss.blocking));
});

test("a near-miss option, once applied, finds designs", (t) => {
  const out = optimize({ ...base, goal: "cheaper", maxLb: 100 });
  if (out.cards.length) return;   // nothing to check: the limit wasn't binding
  for (const o of out.nearMiss.options) {
    const again = optimize({ ...base, goal: "cheaper", maxLb: 100, ...o.set });
    t.assert.ok(again.cards.length >= 1, o.text);
  }
  t.assert.ok(out.nearMiss.blocking.length > 0 && out.nearMiss.blocking.every((b) => b.length > 0));
});

test("Lighter with everything locked but the plywood offers the same design on 1/2 in ply", (t) => {
  const defaults = { xoLo: 120, xoHi: 900, mAmpW: 400, hfAmpW: 100 };
  let tried = 0;
  for (const name of ["lil block stack LE", "blocky", "light block", "lil tower"]) {
    const c0 = { ...defaults, ...pick(name) };
    const c = { ...c0, horn: c0.cd === "n314t" && c0.horn === "a460g2" ? "a460g2_14" : c0.horn };
    if (problems(evaluate(c), { maxLb: 150, budget: 2000 }).length) continue;   // locked as it is, it can't pass anyway
    tried++;
    const all = { sub: true, mid: true, cd: true, horn: true, vent: true, hpf: true, xoLo: true, xoHi: true, ampW: true, mAmpW: true, hfAmpW: true,
      subDim: { w: "exact", h: "exact", d: "exact" }, midDim: { w: "exact", h: "exact", d: "exact" } };
    const out = optimize({ ...base, cur: c, maxLb: 150, budget: 2000, goal: "lighter", locks: all });
    t.assert.ok(out.cards.length >= 1, `${name}: ${JSON.stringify(out.nearMiss && out.nearMiss.blocking)}`);
    t.assert.equal(out.cards[0].config.wall, 0.5, name);
    t.assert.ok(out.cards[0].metrics.heaviest < evaluate(c).heaviest, name);
  }
  t.assert.ok(tried >= 2, "at least two saved designs checked");
});

test("Lighter with free choices still shows the plywood-only change when it beats the current design", (t) => {
  const c = { ...pick("light block"), xoLo: 120, xoHi: 900, mAmpW: 400, hfAmpW: 100 };
  const out = optimize({ ...base, cur: c, maxLb: 150, budget: 2000, goal: "lighter" });
  const small = out.cards.find((k) => k.config.wall !== c.wall && k.changed.join() === "plywood");
  t.assert.ok(small || out.cards.some((k) => k.config.wall === 0.5), out.cards.map((k) => `${k.label}: ${k.changed.join("/")}`).join(" | "));
});

test("no card carries 'Horn stops loading near the crossover' when the horn, driver or crossover is free", (t) => {
  for (const goal of ["cheaper", "lighter", "lower", "louder"]) {
    const out = runs[goal] || optimize({ ...base, goal });
    for (const k of out.cards) t.assert.ok(!k.warnings.some(([h]) => h === "Horn stops loading near the crossover"), `${goal}: ${k.label}`);
  }
});

test("stacked goals: the main card beats the current design on every goal; the first goal ranks", (t) => {
  const beat = { cheaper: (m, c) => m.price < c.price, lighter: (m, c) => m.heaviest <= c.heaviest - 3, louder: (m, c) => m.out >= c.out + 1, lower: (m, c) => m.f3 <= c.f3 - 2 };
  for (const goals of [["cheaper", "lighter"], ["lighter", "cheaper"], ["cheaper", "louder"], ["louder", "lower"]]) {
    const out = optimize({ ...base, goals });
    t.assert.deepEqual(out.goals, goals);
    const main = out.cards.find((k) => k.label.includes(" + "));
    if (!main) { t.assert.ok(out.goalMissing || out.curProblems.length, `${goals}: no main card and no message`); continue; }
    t.assert.equal(out.cards[0], main, `${goals}: main card first`);
    for (const g of goals) t.assert.ok(beat[g](main.metrics, out.curM), `${goals}: main card doesn't beat the current design on ${g}`);
  }
  const a = optimize({ ...base, goals: ["cheaper", "lighter"] }).cards[0], b = optimize({ ...base, goals: ["lighter", "cheaper"] }).cards[0];
  if (a && b && a.label.includes("+") && b.label.includes("+")) t.assert.ok(a.metrics.price <= b.metrics.price + 1e-9 && b.metrics.heaviest <= a.metrics.heaviest + 1e-9);
});

test("louder with the sub amp unlocked turns it up when the amp is what limits the sub", (t) => {
  const locks = { sub: true, mid: true, cd: true, horn: true, vent: true, wall: true, hpf: true, xoLo: true, xoHi: true,
    subDim: { w: "exact", h: "exact", d: "exact" }, midDim: { w: "exact", h: "exact", d: "exact" } };
  const c = { xoLo: 120, xoHi: 900, mAmpW: 400, hfAmpW: 100, ...pick("light block"), ampW: 300 };   // a small amp: the sub is amp-limited
  t.assert.equal(evaluate(c).who, "amplifier power");
  const out = optimize({ ...base, cur: c, maxLb: 200, budget: 2000, goals: ["louder"], locks });
  t.assert.ok(out.cards.length >= 1, JSON.stringify(out.nearMiss && out.nearMiss.blocking));
  const k = out.cards[0];
  t.assert.ok(k.config.ampW > c.ampW, `amp ${k.config.ampW} W`);
  t.assert.ok(k.metrics.out >= evaluate(c).out + 1, "louder than the design at 300 W");
  // and no more power than it uses: 50 W less loses output
  const less = evaluate({ ...k.config, ampW: k.config.ampW - 50 });
  t.assert.ok(less.out < k.metrics.out - 0.01 || k.config.ampW - 50 < 200);
});
