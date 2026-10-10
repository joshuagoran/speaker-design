// The PA optimizer never comes out behind your design on the output its target compares (the music limit, 40–90 Hz):
// your sub box and vent seed the search, your design joins the pool, and when nothing beats a design that passes, the
// answer is the goal-missing notice, not "No design fits your limits". From an owner's report (issue #75's follow-up).
import { test } from "vite-plus/test";
import assert from "node:assert";
import {
  evaluateDesign,
  designProblems,
  optimizePaStack,
  roomRequiredSpl,
  PA_OUTPUT_NAME,
  sameOptimizedFields,
  ventSizesFor,
} from "../src/lib/pa/optimize";
import { optimizePaStackExact } from "../src/lib/pa/optimizeExact";
import { nearMissClosestText } from "../src/lib/pa/nearMiss";
import { CARD_LABELS, NEAR_MISS_YOURS } from "../src/constants/optimizerText";
import { DEFAULT_PA } from "../src/lib/defaults";
import { derivePaDesign } from "../src/pages/pa-stack/hooks/paDesign";
import { subBassLevel } from "../src/lib/pa/calc";
import { SUB_OPTIONS } from "../src/lib/data";
import { byIdOrThrow } from "../src/lib/tables";
import { CATALOG_TABLE_NAMES } from "../src/constants/catalogTables";
import type {
  PaDesignConfig,
  PaGoal,
  PaOptimizerInput,
  PaOptimizerLocks,
  PaOptimizerResult,
} from "../src/types";

// The owner's "fireplace" design: an Eminence Definimax 4018LF in a 25 × 22 × 16 in box with one ½″-divided side duct,
// a 1″ throat, 14″ long, on the satellite layout, its sub amp at 700 W. The rest is the planner's default design (a
// guess: the report gave the sub, the box, the vent and the amp only).
const fireplace: PaDesignConfig = {
  ...DEFAULT_PA,
  format: DEFAULT_PA.format.id,
  cabinet: DEFAULT_PA.cabinet.id,
  sub: "em4018",
  mid: DEFAULT_PA.mid.id,
  cd: DEFAULT_PA.cd.id,
  horn: DEFAULT_PA.horn.id,
  midBox: DEFAULT_PA.midBox.id,
  cDim: { w: 25, h: 22, d: 16 },
  portStyle: "vslot1",
  cVent: { ...DEFAULT_PA.cVent, throat: 1, len: 14 },
  divider: "1/2",
  ampW: 700,
  layout: "satellite",
};
// the owner's locks: sub, mid, horn and both crossovers; the sub's width and height exact and its depth a maximum; the
// mid box's sides maximums
const OWNER_LOCKS: PaOptimizerLocks = {
  sub: true,
  mid: true,
  horn: true,
  xoLo: true,
  xoHi: true,
  subDim: { w: "exact", h: "exact", d: "max" },
  midDim: { w: "max", h: "max", d: "max" },
};
const owner: PaOptimizerInput = {
  cur: fireplace,
  room: 750,
  maxLb: 100,
  budget: 5000,
  goals: ["lower", "louder"],
  locks: OWNER_LOCKS,
};
const curM = evaluateDesign(fireplace);
// the fireplace box with two flared 3″ round tubes in place of its side duct: port-limited, so the amp comes down
const fireplaceTubes: PaDesignConfig = {
  ...fireplace,
  portStyle: "round2",
  cVent: { ...fireplace.cVent, nt: 2, dia: 3, len: 10.5 },
};

test("the fireplace design passes, and its own output sets the target (not the room's)", () => {
  assert.ok(curM, "it evaluates");
  assert.deepEqual(designProblems(curM, owner), []);
  assert.ok(curM.out > roomRequiredSpl(750), "louder than the room needs");
  const out = optimizePaStack(owner);
  assert.equal(out.target, curM.out);
});

/** Nothing the result names is behind your design on the target's output; no "no fit" while your design keeps the goals. */
function neverBehind(out: PaOptimizerResult, what: string) {
  assert.ok(curM);
  for (const k of out.cards)
    assert.deepEqual(designProblems(evaluateDesign(k.config), owner), [], `${what}: ${k.label}`);
  if (out.cards.length === 0) {
    assert.equal(out.nearMiss, null, `${what}: "no design fits" while yours keeps the goals`);
    assert.ok(out.goalMissing, `${what}: says nothing beats your design`);
  }
  const closest = out.nearMiss?.closest;
  if (closest)
    assert.ok(
      closest.metrics.out >= curM.out - 1e-9,
      `${what}: closest ${closest.metrics.out.toFixed(2)} dB, yours ${curM.out.toFixed(2)} dB`,
    );
}

test("the owner's run: no 'No design fits your limits' while the design itself keeps the goals", () => {
  neverBehind(optimizePaStack(owner), "owner's locks");
});

for (const goal of ["cheaper", "lighter", "lower", "louder"] as const satisfies PaGoal[])
  test(`with only the box locked (${goal}), the search keeps up with your one-side duct`, () => {
    neverBehind(
      optimizePaStack({
        ...owner,
        goals: [goal],
        locks: { subDim: OWNER_LOCKS.subDim },
      }),
      goal,
    );
  });

test("vent locked: your 1″ side duct is searched", () => {
  const out = optimizePaStack({ ...owner, locks: { ...OWNER_LOCKS, vent: true } });
  neverBehind(out, "vent locked");
  assert.ok(out.stats.subs > 0, "your sub box is a candidate");
});

test("Fully optimize: never behind your design either", () => {
  neverBehind(optimizePaStackExact(owner), "exact");
});

/** The one-side duct cards of a result, loudest first. */
const sideDuctCards = (out: PaOptimizerResult) =>
  out.cards
    .filter((k) => k.config.portStyle === "vslot1")
    .sort((a, b) => b.metrics.out - a.metrics.out);

test("an unlocked vent tries one side duct, from a 1″ throat", () => {
  assert.equal(ventSizesFor("vslot1")[0].throat, 1);
  // from the same box with round tubes, so your own side duct can't seed it: the grid itself finds one
  const tubes = evaluateDesign(fireplaceTubes);
  assert.ok(curM && tubes);
  const input: PaOptimizerInput = { ...owner, cur: fireplaceTubes, goals: ["louder"] };
  // Fully optimize (the port's own limit): a one-side duct at least as loud as the fireplace design's on the music
  // limit, 40–90 Hz
  const [exact] = sideDuctCards(optimizePaStackExact(input));
  assert.ok(exact, "Fully optimize gives a one-side duct card");
  assert.ok(
    exact.metrics.out >= curM.out,
    `Fully optimize ${exact.metrics.out.toFixed(2)} dB, the fireplace ${curM.out.toFixed(2)} dB`,
  );
  // Improve keeps a 10% air-speed margin, which the fireplace's 1″ duct uses up (it runs at 99% of the limit): its
  // one-side duct beats the tubes and comes within 0.6 dB of the fireplace. The margin is what that costs: the card (a
  // 1.5″ throat at 600 W, a 31 Hz highpass) runs its duct at 89% of the limit, and 850 W with a 37 Hz highpass would
  // take it to 91% (this box takes no braces, so the searches' estimate and the rule give it the same tuning)
  const [quick] = sideDuctCards(optimizePaStack(input));
  assert.ok(quick, "Improve gives a one-side duct card");
  assert.ok(quick.metrics.out > tubes.out, "louder than the tubes");
  assert.ok(
    quick.metrics.out >= curM.out - 0.6,
    `Improve ${quick.metrics.out.toFixed(2)} dB, the fireplace ${curM.out.toFixed(2)} dB`,
  );
});

// the tubes at 450 W, under the port's limit: a design that passes, short of what outdoors needs
const quietTubes: PaDesignConfig = { ...fireplaceTubes, ampW: 450 };

test("a design short of the room's need: the near miss names the metric and is never behind your design", () => {
  // outdoors needs more than the design gives, so the target is the room's and your design misses it. The tubes are
  // locked: a one-side duct comes within the alternatives' reach of the target (a card, not the near miss). The
  // compression driver is locked too: a cheaper one at the same output would be closer on the Cheaper goal
  const input: PaOptimizerInput = {
    ...owner,
    cur: quietTubes,
    room: "outdoor",
    goals: ["cheaper"],
    locks: { ...OWNER_LOCKS, vent: true, cd: true },
  };
  const m = evaluateDesign(quietTubes);
  assert.ok(m && m.out < roomRequiredSpl("outdoor"), "the design misses the room's need");
  assert.deepEqual(designProblems(m, input), [], "the design passes");
  const out = optimizePaStack(input);
  assert.equal(out.cards.length, 0);
  const near = out.nearMiss;
  assert.ok(near && near.closest, "a closest design");
  assert.ok(near.closest.metrics.out >= m.out - 1e-9, "not behind your design");
  assert.ok(
    near.blocking.some((b) => b.includes(PA_OUTPUT_NAME)),
    `names the metric: ${near.blocking.join("; ")}`,
  );
  // nothing that passes gets closer than your design itself: the banner names it as yours
  assert.ok(near.closestIsYours, "the closest design is yours");
  const line = nearMissClosestText(near);
  assert.ok(
    line.startsWith(`${CARD_LABELS.nearMiss}: ${NEAR_MISS_YOURS} (`),
    `the banner says it is your design: ${line}`,
  );
  // another design is named by its parts only
  const other = nearMissClosestText({ ...near, closestIsYours: false });
  assert.ok(!other.includes(NEAR_MISS_YOURS), other);
  assert.ok(other.startsWith(`${CARD_LABELS.nearMiss}: ${near.closest.names.sub}, `), other);
  // with the compression driver free, the closest is still never behind your design nor dearer; whether it is yours
  // or your design with a cheaper driver at the same output turns on the searches' brace estimate (the near miss ranks
  // the searched designs by it, yours by the rule), so either is named, and named truly
  const free = optimizePaStack({ ...input, locks: { ...OWNER_LOCKS, vent: true } }).nearMiss;
  assert.ok(free && free.closest, "a closest design with the compression driver free");
  assert.ok(free.closest.metrics.out >= m.out - 1e-9, "not behind your design");
  assert.ok(
    free.closest.metrics.price <= near.closest.metrics.price + 1e-9,
    "no dearer than yours",
  );
  assert.equal(free.closestIsYours, sameOptimizedFields(free.closest.config, quietTubes));
});

test("a near miss whose closest design differs from yours doesn't call it yours", () => {
  // a weight limit your design fails: the closest is a lighter design
  const out = optimizePaStack({ ...owner, maxLb: 60 });
  const near = out.nearMiss;
  assert.ok(near && near.closest, "a closest design");
  assert.ok(!sameOptimizedFields(near.closest.config, fireplace), "another design");
  assert.equal(near.closestIsYours, false);
  assert.ok(!nearMissClosestText(near).includes(NEAR_MISS_YOURS));
});

test("a card's sub-bass 30–50 Hz is the planner's tile: at the vent's own air-speed limit (flared tubes)", () => {
  // the fireplace box with two flared round tubes, port-limited at the bottom of the band
  const c = fireplaceTubes;
  const m = evaluateDesign(c);
  assert.ok(m);
  const planner = derivePaDesign({
    subDriver: byIdOrThrow(SUB_OPTIONS, c.sub, CATALOG_TABLE_NAMES.subs),
    portStyle: c.portStyle,
    subBoxDims: c.cDim,
    subVentSpec: c.cVent,
    subHighpassHz: c.hpf,
    subHighpassType: c.hpType,
    subAmpWatts: c.ampW,
    maxPortAirSpeedMs: c.portMax,
    midDriver: DEFAULT_PA.mid,
    midBoxDims: c.mDim,
    midAmpWatts: c.mAmpW,
    hornOption: DEFAULT_PA.horn,
    compressionDriver: DEFAULT_PA.cd,
    hornAmpWatts: c.hfAmpW,
    subMidCrossoverHz: c.xoLo,
    midHornCrossoverHz: c.xoHi,
    subMidCrossoverOrder: c.xoLoOrder,
    midHornCrossoverOrder: c.xoHiOrder,
    plinthHeightIn: 0,
    layout: c.layout,
    wallThicknessIn: c.wall,
    braceStyle: undefined,
    backJoint: DEFAULT_PA.backJoint,
    baffleInsetIn: c.inset,
    spacerHeightIn: DEFAULT_PA.spacerH,
    hardware: DEFAULT_PA.hardware,
    dispersionPlane: "h",
  });
  assert.ok(planner.subModeled);
  const tile = subBassLevel(planner.subModeled.maxCurve);
  // the optimizers leave out the handles' recesses, a fraction of a liter: a few hundredths of a dB
  assert.ok(
    Math.abs(m.subBass - tile) < 0.1,
    `card ${m.subBass.toFixed(2)} dB, tile ${tile.toFixed(2)} dB`,
  );
});
