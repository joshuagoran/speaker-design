// Hi-fi optimizer: woofer × box × tuning, then × tweeter × crossover, scored like the page scores them.
import { hifiSystem, hifiChips, grossL, portArea } from "./hifi.js";
import { ventTuning } from "./calc.js";

export const HIFI_GOALS = {
  smaller: { short: "Smaller", name: "Smaller box", why: "Least box volume that keeps the bass and level." },
  deeper: { short: "Deeper", name: "Deeper bass", why: "Lowest in-room F3 that keeps the level." },
  cheaper: { short: "Cheaper", name: "Cheaper pair", why: "Least driver cost that keeps the bass and level." },
  louder: { short: "Louder", name: "Louder", why: "Most clean level at the seat." },
};
// a card's label must be true against your design by at least this much
const beats = {
  smaller: (x, y) => x.gross <= y.gross * 0.9, deeper: (x, y) => x.f3 <= y.f3 - 3,
  cheaper: (x, y) => x.price < y.price, louder: (x, y) => x.level >= y.level + 1,
};
const obj = { smaller: (x) => x.gross, deeper: (x) => x.f3, cheaper: (x) => x.price, louder: (x) => -x.level };
// what a goal keeps from your design
const keeps = (cur) => ({
  smaller: (x) => x.f3 <= cur.f3 + 5 && x.level >= cur.level - 1.5,
  cheaper: (x) => x.f3 <= cur.f3 + 5 && x.level >= cur.level - 1.5 && x.gross <= cur.gross * 1.3,
  deeper: (x) => x.level >= cur.level - 1.5,
  louder: (x) => x.f3 <= cur.f3 + 5 && x.gross <= cur.gross * 1.3,
});
// warnings that rule a design out (the soft ones stay on the card)
const HARD = new Set(["Below the tweeter's minimum crossover", "Close to the tweeter's resonance", "Woofer past its usable range", "Tweeter runs out first"]);
export const hifiProblems = (sys, chips) => (!sys ? ["can't be modelled"] : chips.filter(([k, h]) => k === "bad" || (k === "warn" && (HARD.has(h) || h.startsWith("Qtc")))).map(([, h]) => h));

const XOS = [1500, 1800, 2000, 2200, 2500, 3000];
const range = (lock, cur, vals) => (lock === "exact" ? [cur] : (lock === "max" ? vals.filter((v) => v <= cur + 1e-9) : vals));

// port length for a target tuning (bisection; the port's own volume is taken out of the box)
function portFor(w, dim, wall, n, dia, Fb) {
  const g = grossL(dim, wall), disp = w.ts.disp != null ? w.ts.disp : Math.max(0.2, Math.pow(w.size / 6.5, 3) * 0.6);
  const A = n * Math.PI * (dia / 2) ** 2, fb = (len) => ventTuning(Math.max(1, g * 0.97 - disp - (A * len * 16.387) / 1e3), A, len, n).Fb;
  let a = 0.5, b = dim.d - 2 * wall - dia / 2 - 1;
  if (b <= a || fb(a) < Fb || fb(b) > Fb) return null;
  for (let i = 0; i < 20; i++) { const m = (a + b) / 2; if (fb(m) > Fb) a = m; else b = m; }
  return { n, dia, len: Math.round(((a + b) / 2) * 4) / 4 };
}

// input: { cur: page cfg + { woofer, tweeter } ids, woofers, tweeters, goals, locks: { woofer, tweeter, box, xo, dim: {w,h,d} },
//          budget (pair, drivers), seatM (listening distance), guidePrice }
export function hifiOptimize(input) {
  const t0 = Date.now();
  const { cur, woofers, tweeters, locks = {} } = input;
  const goals = (input.goals || []).filter((g) => HIFI_GOALS[g]);
  if (!goals.length) return { cards: [], goals };
  const goal = goals[0], also = goals.slice(1);
  const dl = locks.dim || {};
  const seat = input.seatM || 2.5, level = (sys) => sys.maxLevel - 20 * Math.log10(seat) + 3;
  const byId = (a, id) => a.find((o) => o.id === id);
  const W0 = byId(woofers, cur.woofer), T0 = byId(tweeters, cur.tweeter);
  const guide = cur.guide || null, gp = input.guidePrice || 0;
  const needsGuide = (t) => t.type === "compression" || t.needsWaveguide;
  const tweeterCfg = (t) => (needsGuide(t) ? (guide ? { ...t, faceplate: { w: guide.w, h: guide.h } } : null) : t);
  const priceOf = (w, t) => 2 * ((w.price || 0) + (t.price || 0) + (needsGuide(t) ? gp : 0));
  let evals = 0;
  const run = (w, t, c, N) => { evals++; const tt = tweeterCfg(t); if (!tt) return null; const cc = { ...c, guide: needsGuide(t) ? guide : null, N }; const sys = hifiSystem(w, tt, cc); return sys && { sys, chips: hifiChips(sys, w, tt, cc), cfg: cc, tt }; };
  const metricOf = (r, w, t) => ({ gross: r.sys.gross, f3: r.sys.f3, price: priceOf(w, t), level: level(r.sys), lb: r.sys.lb });

  const curR = W0 && T0 && run(W0, T0, cur, 240);
  const curM = curR && metricOf(curR, W0, T0);
  const curFails = !curR || hifiProblems(curR.sys, curR.chips).length > 0;

  // 1. woofer, box and tuning (at the current tweeter and crossover, coarse model)
  const wList = locks.woofer ? [W0] : woofers.filter((o) => o.ts && o.ts.Fs && o.ts.Sd);
  const boxes = locks.box ? [cur.box] : ["sealed", "vented"];
  const face = (T0 && T0.faceplate) || { w: 4, h: 4 };
  const stage1 = [];
  for (const w of wList) {
    const minW = Math.max(w.size + 1.5, face.w + 1), minH = face.h + w.size + 3;
    const ws = range(dl.w, cur.dim.w, [minW, minW + 1.5, minW + 3].map((v) => Math.ceil(v * 4) / 4));
    const hs = range(dl.h, cur.dim.h, [0, 2, 4, 7, 11, 16, 22].map((v) => Math.ceil((minH + v) * 4) / 4)).filter((h) => h <= 44);
    const ds = range(dl.d, cur.dim.d, [7, 8.5, 10, 11.5, 13, 14.5]);
    for (const bw of ws) for (const bh of hs) for (const bd of ds) for (const box of boxes) {
      const dim = { w: bw, h: bh, d: bd };
      const ports = box === "sealed" ? [null] : [0.8, 1, 1.2].flatMap((k) => [1.5, 2, 2.5, 3].map((dia) => portFor(w, dim, cur.wall, 1, dia, w.ts.Fs * k)).filter(Boolean).slice(0, 2));
      for (const port of ports) {
        const r = run(w, T0, { ...cur, box, dim, port: port || cur.port }, 80);
        if (!r) continue;
        if (box === "vented" && r.sys.whoW === "port") continue;         // a bigger port, not a port-limited box
        const bad = r.chips.some(([k, h]) => k === "bad" || h.startsWith("Qtc"));
        if (bad) continue;
        stage1.push({ w, dim, box, port, m: metricOf(r, w, T0) });
      }
    }
  }
  // keep the best few for each objective
  const keep = new Map();
  for (const g of Object.keys(obj)) stage1.slice().sort((a, b) => obj[g](a.m) - obj[g](b.m)).slice(0, 12).forEach((x) => keep.set(`${x.w.id}|${x.box}|${x.dim.w}|${x.dim.h}|${x.dim.d}|${x.port && x.port.dia}|${x.port && x.port.len}`, x));
  // and the woofers' own best boxes (so each woofer is represented)
  for (const w of wList) stage1.filter((x) => x.w === w).sort((a, b) => a.m.f3 - b.m.f3).slice(0, 2).forEach((x) => keep.set(`${x.w.id}|${x.box}|${x.dim.w}|${x.dim.h}|${x.dim.d}|${x.port && x.port.dia}|${x.port && x.port.len}`, x));

  // 2. tweeter and crossover, exact model
  const tList = locks.tweeter ? [T0] : tweeters.filter((t) => t.hf && t.hf.sens != null && (!needsGuide(t) || guide));
  const xos = locks.xo ? [cur.xo] : XOS;
  const pool = [];
  for (const x of keep.values()) for (const t of tList) for (const xo of xos) {
    const c = { ...cur, box: x.box, dim: x.dim, port: x.port || cur.port, xo };
    const r = run(x.w, t, c, 240);
    if (!r || hifiProblems(r.sys, r.chips).length) continue;
    const m = metricOf(r, x.w, t);
    if (input.budget && m.price > input.budget + 1e-9) continue;
    pool.push({ w: x.w, t, c: r.cfg, sys: r.sys, chips: r.chips, m });
  }
  const K = curM ? keeps(curM) : null;
  const meets = (p) => !K || goals.every((g) => K[g](p.m));
  const beatsAll = (p) => !curM || goals.every((g) => beats[g](p.m, curM));
  const sorted = (list, g) => list.slice().sort((a, b) => obj[g](a.m) - obj[g](b.m) || a.m.price - b.m.price);
  const cards = [];
  const first = sorted(pool.filter((p) => meets(p) && beatsAll(p)), goal)[0];
  const label = also.length ? goals.map((g, i) => (i ? g : HIFI_GOALS[g].short)).join(" + ") : HIFI_GOALS[goal].name;
  if (first) cards.push({ ...first, label, why: HIFI_GOALS[goal].why });
  else if (curFails) { const fix = sorted(pool.filter(meets), goal)[0] || sorted(pool, goal)[0]; if (fix) cards.push({ ...fix, label: "Fixes your design", why: "Your design fails a check; this is the best that passes." }); }
  const differs = (p) => cards.every((k) => k.w !== p.w || k.t !== p.t || k.c.box !== p.c.box || Math.abs(p.m.gross / k.m.gross - 1) >= 0.15);
  for (const g of [...goals, ...Object.keys(obj)].filter((g, i, a) => a.indexOf(g) === i)) {
    if (cards.length >= 3) break;
    if (!also.length && g === goal) continue;
    // an alternative keeps what its own goal keeps (a "Smaller" card doesn't give up the bass)
    const q = sorted(pool.filter((p) => differs(p) && (!K || K[g](p.m)) && (!curM || beats[g](p.m, curM)) && (!first || beats[g](p.m, first.m))), g)[0];
    if (q) cards.push({ ...q, label: HIFI_GOALS[g].name, why: { smaller: "Smaller than your design.", deeper: "Goes deeper than your design.", cheaper: "Costs less than your design.", louder: "Louder than your design." }[g] });
  }
  return {
    goals, cur: curM, curProblems: curR ? hifiProblems(curR.sys, curR.chips) : ["can't be modelled"],
    goalMissing: !first && !curFails ? `Nothing ${goals.map((g) => ({ smaller: "smaller", deeper: "deeper", cheaper: "cheaper", louder: "louder" })[g]).join(" and ")} than your design passes the checks.` : null,
    cards: cards.map((k) => ({ label: k.label, why: k.why, woofer: k.w.id, tweeter: k.t.id, cfg: { box: k.c.box, dim: k.c.dim, port: k.c.port, xo: k.c.xo }, metrics: k.m,
      warnings: k.chips.filter(([kind]) => kind === "warn").map(([, h]) => h), names: { woofer: k.w.name, tweeter: k.t.name },
      lay: k.sys.lay, guided: needsGuide(k.t) })),
    stats: { evaluated: evals, ms: Date.now() - t0, pool: pool.length },
  };
}
