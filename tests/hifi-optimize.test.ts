import { test } from "vite-plus/test";
import assert from "node:assert";
import {
  optimizeHifiSpeaker,
  hifiDesignProblems,
  hifiSearchSpace,
  hifiScoreBoxes,
  runHifiJob,
  portsDiffer,
  slotFor,
} from "../src/lib/hifi/optimize";
import { hifiBox, hifiGridTop, hifiSystem, hifiChips } from "../src/lib/hifi/hifi";
import { HIFI_WOOFERS, HIFI_TWEETERS, HIFI_PASSIVES, waveguideSpecOf } from "../src/lib/data";
import { DIY_OS90X70 } from "../src/data/catalog/horns";
import { chipOf } from "./helpers";
import { HIFI_OPTIMIZER_PANEL } from "../src/constants/optimizerPanels";
import { defaultPanelIn } from "../src/lib/panel";
import { DESIGN_PROBLEM_TEXT } from "../src/constants/optimizerText";
import type {
  HifiGoal,
  HifiMetrics,
  HifiOptimizerCurrent,
  HifiOptimizerLocks,
  HifiOptimizerResult,
  HifiScoredBox,
} from "../src/types";

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

test("every driver in the hi-fi list can be modeled", (t) => {
  const tw = HIFI_TWEETERS.find((o) => o.id === "sb26stcn")!;
  for (const w of HIFI_WOOFERS) assert.ok(hifiSystem(w, tw, cur), w.id);
});

// What a step costs, in ms of this process's CPU time. The search is synchronous, so on an idle machine this is its wall
// time; unlike wall time it leaves out the time the other test files' workers hold the cores (in a full parallel run the
// full search's wall time nearly doubles while its CPU time stays put).
function cpuMs<T>(step: () => T): { value: T; ms: number } {
  const c0 = process.cpuUsage(),
    value = step(),
    { user, system } = process.cpuUsage(c0);
  return { value, ms: (user + system) / 1000 };
}
// The full search (every woofer and tweeter, nothing locked, so every plywood size), run once per goal for every test that asks for it. Its box
// step reads no goal, so the goals share one box step; a goal's search time is that step's time plus its own selection,
// as a run of `optimizeHifiSpeaker` alone would take (the split-run tests below check that handing the step over gives
// exactly what one run gives).
let fullBoxes: { value: HifiScoredBox[]; ms: number } | undefined;
const fullRuns = new Map<HifiGoal, { out: HifiOptimizerResult; ms: number }>();
function fullSearch(goal: HifiGoal) {
  const done = fullRuns.get(goal);
  if (done) return done;
  const input = { ...base, goals: [goal] },
    boxes = (fullBoxes ??= cpuMs(() => hifiScoreBoxes(input))),
    select = cpuMs(() => optimizeHifiSpeaker(input, [boxes.value])),
    run = { out: select.value, ms: boxes.ms + select.ms };
  fullRuns.set(goal, run);
  return run;
}

// The CPU budget, ms: the search designs in one plywood size (HIFI_OPTIMIZER_PANEL), as it did with the plywood locked.
const BUDGET_MS = 10000;
/** The optimizer's plywood at its default thickness: the only wall a card proposes here. */
const OPTIMIZER_WALL = defaultPanelIn(HIFI_OPTIMIZER_PANEL, "ply");

test("hi-fi optimizer: the full search stays in its budget, and every card is in the optimizer's plywood", () => {
  const input = { ...base, goals: ["cheaper" as const] },
    boxes = cpuMs(() => hifiScoreBoxes(input)),
    select = cpuMs(() => optimizeHifiSpeaker(input, [boxes.value])),
    ms = boxes.ms + select.ms;
  assert.ok(ms < BUDGET_MS, `${Math.round(ms)} ms of CPU time`);
  assert.ok(select.value.cards.length >= 1 || select.value.goalMissing, "cards or a message");
  for (const k of select.value.cards) assert.equal(k.config.wall, OPTIMIZER_WALL, k.label);
});

for (const goal of ["cheaper", "lighter", "lower", "louder"] as const) {
  test(`hi-fi optimizer (${goal}): cards pass the checks, stay in budget, and their labels are true`, (t) => {
    const { out, ms } = fullSearch(goal);
    assert.ok(ms < BUDGET_MS, `${Math.round(ms)} ms of CPU time`);
    for (const k of out.cards) assert.equal(k.config.wall, OPTIMIZER_WALL, k.label);
    assert.ok(out.cards.length >= 1 || out.goalMissing, "cards or a message");
    for (const k of out.cards) {
      const w = HIFI_WOOFERS.find((o) => o.id === k.woofer)!,
        tw = HIFI_TWEETERS.find((o) => o.id === k.tweeter)!;
      // no passives are offered in this run, so a card's id-based `pr` is always undefined (it is not a HifiConfig `pr`)
      const c = { ...cur, ...k.config, pr: undefined },
        sys = hifiSystem(w, tw, c)!;
      assert.deepEqual(hifiDesignProblems(sys, hifiChips(sys, w, tw, c)), [], k.label);
      assert.ok(k.metrics.price <= base.budget, "within budget");
      if (k.slot.kind === "fix" || k.slot.kind === "closest") continue;
      const axis = k.slot.kind === "alt" ? k.slot.axis : goal; // the first card and the smallest change are held to the goal
      assert.ok(beat[axis](k.metrics, out.cur!), `${k.label} beats the current design on ${axis}`);
    }
  });
}

test("hi-fi optimizer: a compression driver on the DIY OS 90×70 never crosses below the waveguide's minimum", () => {
  const minXo = DIY_OS90X70.hf.minXo;
  if (minXo === null) throw new Error("the waveguide has no minimum crossover");
  const de250 = HIFI_TWEETERS.find((o) => o.id === "de250");
  if (!de250) throw new Error("no DE250");
  const onGuide: HifiOptimizerCurrent = {
    ...cur,
    tweeter: de250.id,
    xo: 2200,
    guide: waveguideSpecOf(DIY_OS90X70),
  };
  for (const goal of ["cheaper", "louder", "lower"] satisfies HifiGoal[]) {
    // the tweeter held, so every card is the DE250 on this waveguide
    const out = optimizeHifiSpeaker({
      ...base,
      cur: onGuide,
      goals: [goal],
      locks: { tweeter: true },
    });
    assert.ok(out.cards.length >= 1, `${goal}: cards to check`);
    for (const k of out.cards)
      assert.ok(k.config.xo >= minXo, `${goal} ${k.label}: ${k.config.xo} Hz`);
  }
});

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
  const { out } = fullSearch("louder");
  for (const k of out.cards) assert.ok(k.config.wAmpW <= 500 && k.config.tAmpW <= 200, k.label);
  // the woofer held too (the search over tweeters, boxes and crossovers still finds cards, which unlocked amps would trim)
  const locked = optimizeHifiSpeaker({
    ...base,
    goals: ["cheaper"],
    locks: { woofer: true, wAmpW: true, tAmpW: true },
  });
  assert.ok(locked.cards.length >= 1, "cards to check");
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
  const { optimizeHifiSpeaker } = await import("../src/lib/hifi/optimize");
  const { HIFI_PASSIVES } = await import("../src/lib/data");
  const { DEFAULT_HIFI } = await import("../src/lib/defaults");
  const w = DEFAULT_HIFI.woofer,
    tw = DEFAULT_HIFI.tweeter;
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

test("hi-fi optimizer: a radiator design handed over as the page does ({ id, n, addG }) still gets cards", () => {
  const out = optimizeHifiSpeaker({
    ...base,
    cur: { ...cur, box: "radiator", pr: { id: HIFI_PASSIVES[0].id, n: 2, addG: 0 } },
    passives: HIFI_PASSIVES,
    goals: ["cheaper"],
    // (the handover is about your design, not the woofers: the boxes, radiators, tweeters and crossovers are still searched)
    locks: { woofer: true },
  });
  assert.ok(out.cards.length >= 1 || out.goalMissing);
});

// everything but the drivers held still, so the runs below only search what each test is about
const tight: HifiOptimizerLocks = {
  box: true,
  xo: true,
  wAmpW: true,
  tAmpW: true,
  dim: { w: "exact", h: "exact", d: "exact" },
};
test("hi-fi optimizer: your woofer or tweeter missing from the offered lists still anchors the comparison", () => {
  const full = optimizeHifiSpeaker({ ...base, goals: ["cheaper"], locks: { ...tight } });
  assert.ok(full.cur, "the design models with the full lists");
  // the offered lists have been filtered (a size or budget filter) and no longer hold your drivers
  const noWoofer = optimizeHifiSpeaker({
    ...base,
    woofers: HIFI_WOOFERS.filter((o) => o.id !== cur.woofer),
    goals: ["cheaper"],
    locks: { ...tight },
  });
  assert.deepEqual(noWoofer.cur, full.cur, "your design is scored against the full tables");
  for (const k of noWoofer.cards)
    assert.notEqual(k.woofer, cur.woofer, "searched the filtered list");
  const noTweeter = optimizeHifiSpeaker({
    ...base,
    tweeters: HIFI_TWEETERS.filter((o) => o.id !== cur.tweeter),
    goals: ["louder"],
    locks: { ...tight, woofer: true },
  });
  assert.deepEqual(
    noTweeter.cur,
    optimizeHifiSpeaker({ ...base, goals: ["louder"], locks: { ...tight, woofer: true } }).cur,
  );
  for (const k of noTweeter.cards) assert.notEqual(k.tweeter, cur.tweeter);
  // locked drivers are still your drivers, found in the full tables
  const lockedOut = optimizeHifiSpeaker({
    ...base,
    woofers: [],
    tweeters: [],
    goals: ["lighter"],
    locks: { ...tight, woofer: true, tweeter: true },
  });
  assert.ok(lockedOut.cur && Array.isArray(lockedOut.cards));
  for (const k of lockedOut.cards)
    assert.deepEqual([k.woofer, k.tweeter], [cur.woofer, cur.tweeter]);
});

test("hi-fi optimizer: a driver that is in no table gives an explicit empty result", () => {
  const out = optimizeHifiSpeaker({
    ...base,
    cur: { ...cur, woofer: "no-such-woofer" },
    goals: ["cheaper"],
    locks: { ...tight },
  });
  assert.equal(out.cards.length, 0);
  assert.equal(out.cur, null);
  assert.deepEqual(out.curProblems, [DESIGN_PROBLEM_TEXT.missingWoofer]);
  const t = optimizeHifiSpeaker({ ...base, cur: { ...cur, tweeter: "nope" }, goals: ["cheaper"] });
  assert.deepEqual(t.curProblems, [DESIGN_PROBLEM_TEXT.missingTweeter]);
});

test("hi-fi optimizer: a handed-over radiator not in `passives` is looked up in the full table; an unknown one is reported", () => {
  const radiatorCur = {
    ...cur,
    box: "radiator" as const,
    pr: { id: HIFI_PASSIVES[0].id, n: 2, addG: 0 },
  };
  const opts = {
    ...base,
    cur: radiatorCur,
    goals: ["cheaper" as const],
    locks: { ...tight, woofer: true, tweeter: true },
  };
  const withList = optimizeHifiSpeaker({ ...opts, passives: HIFI_PASSIVES });
  const noList = optimizeHifiSpeaker({ ...opts, passives: [] });
  assert.ok(withList.cur, "scored with the list");
  assert.deepEqual(noList.cur, withList.cur, "scored with the full table when the list lacks it");
  // the radiator is in the price: a design without it would be cheaper
  const bare = optimizeHifiSpeaker({ ...opts, cur: { ...cur, box: "sealed" }, passives: [] });
  assert.ok(withList.cur && bare.cur && withList.cur.price > bare.cur.price);

  const unknown = optimizeHifiSpeaker({
    ...opts,
    cur: { ...radiatorCur, pr: { id: "no-such-radiator", n: 2, addG: 0 } },
    passives: HIFI_PASSIVES,
  });
  assert.equal(unknown.cur, null, "no comparison against a design with its radiator dropped");
  assert.deepEqual(unknown.curProblems, [DESIGN_PROBLEM_TEXT.missingRadiator]);
});

test("hi-fi optimizer: a stale radiator id on a vented design still gets a comparison", () => {
  const out = optimizeHifiSpeaker({
    ...base,
    cur: { ...cur, pr: { id: "no-such-radiator", n: 2, addG: 0 } }, // leftover from a radiator design
    goals: ["cheaper"],
    passives: HIFI_PASSIVES,
    locks: { ...tight, woofer: true, tweeter: true },
  });
  assert.ok(out.cur, "compared against the vented design as it is");
});

test("hi-fi optimizer: a port counts as changed only on its own shape's fields", () => {
  const round = { n: 1, dia: 2, len: 6 } as const;
  // boundary cast: a design saved before the port toggle built fresh ports can carry a slot's `h` on a round port
  const stale = { ...round, h: 1 } as unknown as typeof round;
  assert.equal(portsDiffer(stale, round), false, "a stale slot field is not a change");
  assert.equal(portsDiffer(round, { ...round, dia: 2.5 }), true);
  assert.equal(portsDiffer(round, { ...round, len: 7 }), true);
  const slot = { shape: "slot", n: 1, h: 1, len: 6 } as const;
  assert.equal(portsDiffer(slot, { ...slot, h: 1.5 }), true);
  assert.equal(portsDiffer(slot, round), true);
  assert.equal(portsDiffer(round, slot), true);
});

test("hi-fi optimizer: a sealed box locked in place gets sealed cards (an ok Qtc chip doesn't rule a design out)", () => {
  const sealed = { ...cur, box: "sealed" as const, dim: { w: 10, h: 16, d: 12 } };
  const w = HIFI_WOOFERS.find((o) => o.id === sealed.woofer)!,
    tw = HIFI_TWEETERS.find((o) => o.id === sealed.tweeter)!,
    sys = hifiSystem(w, tw, sealed)!;
  assert.deepEqual(
    hifiDesignProblems(sys, hifiChips(sys, w, tw, sealed)),
    [],
    "the sealed design passes",
  );
  for (const goal of ["lower", "louder"] as const) {
    const out = optimizeHifiSpeaker({ ...base, cur: sealed, goals: [goal], locks: { box: true } });
    assert.ok(!out.goalMissing, `${goal}: a sealed design that beats yours exists`);
    for (const k of out.cards) assert.equal(k.config.box, "sealed", k.label);
  }
});

test("hi-fi optimizer: the first card is the best design on its grid, checked one by one with the page's model", () => {
  // a small grid: one woofer and baffle width, sealed or vented, every height, depth, port and crossover, three tweeters
  const tweeters = HIFI_TWEETERS.filter((t) => ["sb26stcn", "rst28f", "ne25vts"].includes(t.id));
  const opts = {
    ...base,
    tweeters,
    locks: { woofer: true, wAmpW: true, tAmpW: true, dim: { w: "exact" as const } },
  };
  const { space } = hifiSearchSpace(opts);
  assert.ok(space && space.grid.length > 100, "a grid to search");
  const seat = base.seatM;
  const designs: HifiMetrics[] = [];
  // the grid, and the next radiators of any box whose radiators set its level (as the search adds them)
  const queue = [...space.grid];
  for (let qi = 0; qi < queue.length; qi++) {
    const e = queue[qi],
      { w, cfg } = e;
    let radiatorLimited = false;
    for (const xo of space.xos)
      for (const t of space.tList) {
        const tt = space.tweeterCfg(t);
        if (!tt) continue;
        const c = { ...cfg, xo, guide: space.guideOf(t) },
          sys = hifiSystem(w, tt, c);
        if (sys && sys.whoW === "radiator") radiatorLimited = true;
        if (!sys || hifiDesignProblems(sys, hifiChips(sys, w, tt, c)).length) continue;
        const price = space.priceOf(w, t, c);
        if (price > base.budget) continue;
        designs.push({
          gross: sys.gross,
          f3: sys.f3,
          price,
          lb: sys.lb,
          level: sys.maxLevel - 20 * Math.log10(seat) + 3,
        });
      }
    const next = radiatorLimited ? space.bigger(e) : null;
    if (next) queue.push(next);
  }
  // what each goal keeps from your design, and its objective (lower is better)
  const keeps: Record<HifiGoal, (m: HifiMetrics, c: HifiMetrics) => boolean> = {
    cheaper: (m, c) => m.level >= c.level - 0.5 && m.f3 <= c.f3 + 2,
    lighter: (m, c) => m.level >= c.level - 0.5 && m.f3 <= c.f3 + 2,
    lower: (m, c) => m.level >= c.level - 1.5,
    louder: (m, c) => m.f3 <= c.f3 + 3,
  };
  const objective: Record<HifiGoal, (m: HifiMetrics) => number> = {
    cheaper: (m) => m.price,
    lighter: (m) => m.lb,
    lower: (m) => m.f3,
    louder: (m) => -m.level,
  };
  for (const goal of ["cheaper", "lighter", "lower", "louder"] as const) {
    const out = optimizeHifiSpeaker({ ...opts, goals: [goal] }),
      c = out.cur;
    assert.ok(c, `${goal}: your design is modeled`);
    const ok = designs.filter((m) => keeps[goal](m, c) && beat[goal](m, c));
    const best = Math.min(...ok.map(objective[goal]));
    if (!ok.length) {
      assert.ok(out.goalMissing, `${goal}: nothing beats your design, and the page says so`);
      continue;
    }
    const k = out.cards[0];
    assert.ok(k && !out.goalMissing, `${goal}: a card`);
    assert.strictEqual(
      objective[goal](k.metrics),
      best,
      `${goal}: the first card is the best on the grid`,
    );
  }
});

// the split-run tests below: the box step in three workers' shares, computed once (it reads no goal, so each test's
// goals select from the same shares; six woofers: still three parts with two woofers each, interleaved in the merge)
const splitBoxInput = { ...base, woofers: HIFI_WOOFERS.slice(0, 6) };
let splitShares: HifiScoredBox[][] | undefined;
const splitShare = (part: number) =>
  (splitShares ??= [0, 1, 2].map((p) => hifiScoreBoxes(splitBoxInput, p, 3)))[part];

test("hi-fi optimizer: the box step split across workers gives exactly what one run gives", () => {
  const input = { ...splitBoxInput, goals: ["lighter" as const, "cheaper" as const] };
  const one = optimizeHifiSpeaker(input);
  // as the workers hand their shares back: copied, not shared
  const split = optimizeHifiSpeaker(input, structuredClone([0, 1, 2].map(splitShare)));
  assert.deepStrictEqual({ ...split, stats: null }, { ...one, stats: null });
});

test("hi-fi optimizer: a tweeter that keeps up only below full woofer power turns the woofer down instead of ruling the design out", () => {
  // a 5 W tweeter amp, locked with both drivers: the 8 in woofer at 500 W outruns it, at the 20 W the design uses it doesn't
  const quiet: HifiOptimizerCurrent = {
    ...cur,
    woofer: "sb23nrxs",
    dim: { w: 12, h: 20, d: 13 },
    port: { n: 1, dia: 3, len: 6 },
    wAmpW: 20,
    tAmpW: 5,
  };
  const out = optimizeHifiSpeaker({
    ...base,
    cur: quiet,
    goals: ["lighter"],
    locks: { woofer: true, tweeter: true, tAmpW: true },
  });
  const k = out.cards[0],
    w = HIFI_WOOFERS.find((o) => o.id === quiet.woofer),
    tw = HIFI_TWEETERS.find((o) => o.id === quiet.tweeter);
  assert.ok(k && k.slot.kind === "first", out.goalMissing ?? "no card");
  assert.ok(w && tw && out.cur);
  const at = (wAmpW: number) => {
    const c = { ...quiet, ...k.config, pr: undefined, wAmpW },
      sys = hifiSystem(w, tw, c),
      chips = sys ? hifiChips(sys, w, tw, c) : [];
    return { chips, problems: hifiDesignProblems(sys, chips) };
  };
  assert.deepEqual(at(k.config.wAmpW).problems, [], "the card passes as it is");
  assert.ok(k.metrics.level >= out.cur.level - 0.5, "and keeps the level");
  // at full woofer power the tweeter would run out first, and that fails the design
  const full = at(500);
  const tweeter = chipOf(full.chips, "hifiTweeterLevel", "warn");
  assert.ok(full.problems.includes(tweeter[1]), full.problems.join("; "));
});

test("hi-fi optimizer: your box is searched in the optimizer's plywood even when your woofer isn't in the offered list", () => {
  const { space } = hifiSearchSpace({
    ...base,
    woofers: HIFI_WOOFERS.filter((o) => o.id !== cur.woofer),
    goals: ["lighter"],
  });
  assert.ok(space, "a search");
  const yours = space.grid.filter((e) => e.w.id === cur.woofer);
  assert.deepEqual(
    yours.map((e) => [e.wall, e.dim]),
    [[OPTIMIZER_WALL, cur.dim]],
    "your box in the optimizer's plywood (yours is ¾″; your woofer itself is filtered out)",
  );
});

test("hi-fi optimizer: the search designs in its own plywood alone, at its measured thickness, whatever yours is", () => {
  const wallsOf = (c: HifiOptimizerCurrent, wall?: number) => {
    const { space } = hifiSearchSpace({ ...base, cur: c, wall, goals: ["lighter"] });
    assert.ok(space, "a search");
    return [...new Set(space.grid.map((e) => e.wall))];
  };
  assert.deepEqual(wallsOf(cur), [OPTIMIZER_WALL]);
  assert.deepEqual(wallsOf({ ...cur, wall: 0.5 }, 0.47), [0.47]);
});

test("hi-fi optimizer: the first worker's kept share (or, if lost, its share scored again) gives what one run gives", () => {
  const input = { ...splitBoxInput, goals: ["cheaper" as const] };
  const one = optimizeHifiSpeaker(input);
  const others = structuredClone([1, 2].map(splitShare));
  const sent = runHifiJob({ kind: "score", input, part: 0, parts: 3, keep: "run-a" });
  assert.deepStrictEqual(sent, { kind: "scored", scored: [] }, "the kept share isn't sent back");
  for (const run of ["run-a", "run-b"]) {
    const done = runHifiJob({
      kind: "select",
      input,
      scored: others,
      kept: { run, part: 0, parts: 3 },
    });
    assert.ok(done.kind === "result");
    assert.deepStrictEqual({ ...done.result, stats: null }, { ...one, stats: null }, run);
  }
});

test("hi-fi optimizer: no card costs more than the budget, even when the best design without one does", () => {
  // only the drivers searched: Go lower's best pair costs more than $300, so the budget is what keeps it off the cards
  const opts = { ...base, goals: ["lower" as const], locks: { ...tight } };
  const budget = 300;
  const free = optimizeHifiSpeaker({ ...opts, budget: undefined });
  assert.ok(
    free.cards.some((k) => k.metrics.price > budget),
    "without a budget a card costs more",
  );
  const capped = optimizeHifiSpeaker({ ...opts, budget });
  assert.ok(capped.cards.length >= 1, "cards within the budget");
  for (const k of capped.cards)
    assert.ok(k.metrics.price <= budget, `${k.label}: $${k.metrics.price}`);
});

test("hi-fi optimizer: shares handed back out of order merge in the grid's order, so ties go as in one run", () => {
  // your woofer and a twin under another id: every design ties with its twin's, and the first in the grid's order wins
  const w = HIFI_WOOFERS.find((o) => o.id === cur.woofer);
  assert.ok(w);
  const tweeters = HIFI_TWEETERS.filter((t) => ["sb26stcn", "rst28f", "ne25vts"].includes(t.id));
  const input = {
    ...base,
    woofers: [w, { ...w, id: `${w.id}-twin` }],
    tweeters,
    goals: ["cheaper" as const],
    locks: { ...tight },
  };
  const one = optimizeHifiSpeaker(input);
  assert.equal(one.cards[0]?.woofer, w.id, "the tie goes to the woofer first in the list");
  // the twin's worker (part 1) hands its share back first
  const late = optimizeHifiSpeaker(
    input,
    [1, 0].map((part) => hifiScoreBoxes(input, part, 2)),
  );
  assert.deepStrictEqual({ ...late, stats: null }, { ...one, stats: null });
});

test("hi-fi optimizer: a slot it sizes tunes, in the page's model, to the target (the length rounded down to 1/4 in)", () => {
  // the slot's inner end correction reads its length (the shelf's run and the gap behind the mouth), so the length is
  // solved with it at every step, as the page models it
  const w = HIFI_WOOFERS.find((x) => x.id === cur.woofer),
    wall = 0.75;
  assert.ok(w);
  const fbOf = (dim: HifiOptimizerCurrent["dim"], port: { h: number; len: number }) =>
    hifiBox(w, { ...cur, wall, dim, port: { shape: "slot", n: 1, ...port } }, hifiGridTop(cur.xo))
      ?.vM?.Fb ?? NaN;
  let n = 0;
  for (const dim of [
    { w: 9, h: 34, d: 7 },
    { w: 9, h: 15, d: 11 },
    { w: 11, h: 22, d: 14.5 },
    { w: 9, h: 20, d: 10 },
    { w: 13, h: 40, d: 13 },
    { w: 8, h: 28, d: 8.5 },
    { w: 10, h: 44, d: 11.5 },
  ])
    for (const h of [0.75, 1, 1.5])
      for (const k of [0.8, 1, 1.2]) {
        const Fb: number = w.ts.Fs * k;
        const slot = slotFor(w, dim, wall, h, Fb);
        if (!slot) continue;
        assert.ok(
          fbOf(dim, slot) >= Fb,
          `${JSON.stringify(dim)} ${h} ${k}: ${fbOf(dim, slot)} < ${Fb}`,
        );
        assert.ok(fbOf(dim, { h, len: slot.len + 0.25 }) < Fb, `${JSON.stringify(dim)} ${h} ${k}`);
        n++;
      }
  assert.ok(n >= 10, `${n} slots`);
});
