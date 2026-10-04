import { test } from "vite-plus/test";
import assert from "node:assert";
import {
  optimizeHifiSpeaker,
  hifiDesignProblems,
  hifiSearchSpace,
  hifiScoreBoxes,
  portsDiffer,
} from "../src/lib/hifi/optimize";
import { hifiSystem, hifiChips } from "../src/lib/hifi/hifi";
import { HIFI_WOOFERS, HIFI_TWEETERS, HIFI_PASSIVES } from "../src/lib/data";
import type { HifiGoal, HifiMetrics, HifiOptimizerCurrent, HifiOptimizerLocks } from "../src/types";

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
  });
  assert.ok(out.cards.length >= 1 || out.goalMissing);
});

// everything but the drivers held still, so the runs below only search what each test is about
const tight: HifiOptimizerLocks = {
  box: true,
  wall: true,
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
  assert.ok(out.curProblems && out.curProblems[0].includes("woofer"), String(out.curProblems));
  const t = optimizeHifiSpeaker({ ...base, cur: { ...cur, tweeter: "nope" }, goals: ["cheaper"] });
  assert.ok(t.curProblems && t.curProblems[0].includes("tweeter"));
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
  assert.ok(unknown.curProblems && unknown.curProblems[0].includes("radiator"));
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
    locks: { woofer: true, wall: true, wAmpW: true, tAmpW: true, dim: { w: "exact" as const } },
  };
  const { space } = hifiSearchSpace(opts);
  assert.ok(space && space.grid.length > 100, "a grid to search");
  const seat = base.seatM;
  const designs: HifiMetrics[] = [];
  for (const { w, cfg } of space.grid)
    for (const xo of space.xos)
      for (const t of space.tList) {
        const tt = space.tweeterCfg(t);
        if (!tt) continue;
        const c = { ...cfg, xo, guide: space.guideOf(t) },
          sys = hifiSystem(w, tt, c);
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
    assert.ok(c, `${goal}: your design is modelled`);
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

test("hi-fi optimizer: the box step split across workers gives exactly what one run gives", () => {
  // (a third of the woofers: still three parts with several woofers each)
  const input = {
    ...base,
    woofers: HIFI_WOOFERS.slice(0, 9),
    goals: ["lighter" as const, "cheaper" as const],
  };
  const one = optimizeHifiSpeaker(input);
  // as the workers hand their shares back: copied, not shared
  const shares = structuredClone([0, 1, 2].map((part) => hifiScoreBoxes(input, part, 3)));
  const split = optimizeHifiSpeaker(input, shares);
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
  assert.ok(k && k.label === "Same level, lighter", out.goalMissing ?? "no card");
  assert.ok(w && tw && out.cur);
  const at = (wAmpW: number) => {
    const c = { ...quiet, ...k.config, pr: undefined, wAmpW },
      sys = hifiSystem(w, tw, c);
    return sys ? hifiDesignProblems(sys, hifiChips(sys, w, tw, c)) : ["can't be modelled"];
  };
  assert.deepEqual(at(k.config.wAmpW), [], "the card passes as it is");
  assert.ok(k.metrics.level >= out.cur.level - 0.5, "and keeps the level");
  assert.ok(
    at(500).includes("Tweeter runs out first"),
    "at full woofer power the tweeter would run out first",
  );
});

test("hi-fi optimizer: your box is offered on the other plywood even when your woofer isn't in the offered list", () => {
  const out = optimizeHifiSpeaker({
    ...base,
    woofers: HIFI_WOOFERS.filter((o) => o.id !== cur.woofer),
    goals: ["lighter"],
    locks: { tweeter: true, box: true, xo: true, wAmpW: true, tAmpW: true, dim: tight.dim },
  });
  assert.ok(
    out.cards.some((k) => k.woofer === cur.woofer && k.config.wall === 0.5),
    JSON.stringify(out.cards.map((k) => [k.label, k.woofer, k.config.wall])),
  );
});
