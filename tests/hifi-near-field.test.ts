// The Hi-fi model close in (lib/hifi/nearField): the pair's level from each speaker and driver at its own distance,
// the baffle step and boundary gain as a near listener hears them, the path floors and the near-field signal. From
// HIFI_NEAR_FIELD_M out the model is exactly the far-field one it was.
import { test } from "vite-plus/test";
import assert from "node:assert";
import {
  baffleEdgeShare,
  boundaryShare,
  driverPathFloorM,
  hifiPairLevelDb,
  nearBaffleStepGain,
  nearBoundaryGain,
  nearFieldPathM,
} from "../src/lib/hifi/nearField";
import {
  hifiNearFieldShelves,
  hifiResponseAt,
  hifiSeatPaths,
  hifiSystem,
  tweeterAxisSeat,
} from "../src/lib/hifi/hifi";
import { optimizeHifiSpeaker } from "../src/lib/hifi/optimize";
import { deriveHifiDesign } from "../src/pages/hifi/hifiDesign";
import { DEFAULT_HIFI } from "../src/lib/defaults";
import { HIFI_TWEETERS, HIFI_WOOFERS } from "../src/lib/data";
import { HIFI_NEAR_FIELD_M, HIFI_PAIR_SUM_DB } from "../src/constants/hifiEngine";
import type { HifiDesignState, HifiOptimizerCurrent } from "../src/types";
import { close } from "./helpers";

const FT = 0.3048,
  IN = 0.0254;
/** The default design with the seat `dM` meters from both speakers (an equilateral triangle), or off to one side. */
const seatAt = (dM: number, across = 0, extra: Partial<HifiDesignState> = {}): HifiDesignState => {
  const dFt = dM / FT;
  return {
    ...DEFAULT_HIFI,
    speakerSpacingFt: dFt,
    listeningSeat: { x: across * dFt, y: (dFt * Math.sqrt(3)) / 2 },
    ...extra,
  };
};
const modelOf = (s: HifiDesignState) => {
  const d = deriveHifiDesign(s);
  assert.ok(d.speakerModel, "the default drivers can be modeled");
  return { d, m: d.speakerModel };
};

// ---- the pair's level ----

test("an equal pair is one speaker's level plus 3 dB, exactly as the mean-distance formula gave", () => {
  const levels = { wLevel: 100, tLevel: 104 };
  for (const dM of [1, 2.5, 3])
    assert.strictEqual(
      hifiPairLevelDb(levels, [
        { wM: dM, tM: dM },
        { wM: dM, tM: dM },
      ]),
      100 - 20 * Math.log10(dM) + 3,
    );
});

test("an asymmetric pair adds the two speakers in power at their own distances, not at the mean distance", (t) => {
  const levels = { wLevel: 100, tLevel: 104 },
    near = 1,
    far = 4;
  const got = hifiPairLevelDb(levels, [
    { wM: near, tM: near },
    { wM: far, tM: far },
  ]);
  const power = 100 + HIFI_PAIR_SUM_DB + 10 * Math.log10((1 / near ** 2 + 1 / far ** 2) / 2);
  close(t, got, power, 1e-12);
  // the mean-distance formula put both at 2.5 m: over 5 dB low, though the near speaker alone gives 100 dB
  const mean = 100 - 20 * Math.log10((near + far) / 2) + 3;
  assert.ok(got - mean > 5, `${got} against ${mean}`);
  assert.ok(
    got > 100 && got < 100.3,
    "about the near speaker alone, plus the far one's 1/16 of its power",
  );
  // a speaker far enough away adds nothing (the rounded 3 dB leaves 0.01 dB)
  const alone = hifiPairLevelDb(levels, [
    { wM: 1, tM: 1 },
    { wM: 1e6, tM: 1e6 },
  ]);
  close(t, alone, 100 + HIFI_PAIR_SUM_DB - 10 * Math.log10(2), 1e-9);
});

test("each speaker is limited by the lesser of its drivers at their own paths", (t) => {
  // the tweeter 4 dB louder at 1 m, but a woofer twice as far loses 6 dB and the tweeter half as far gains 6
  const levels = { wLevel: 100, tLevel: 96 },
    p = { wM: 0.5, tM: 1 };
  close(t, hifiPairLevelDb(levels, [p, p]), 96 + 3, 1e-12);
  const q = { wM: 2, tM: 1 };
  close(t, hifiPairLevelDb(levels, [q, q]), 100 - 20 * Math.log10(2) + 3, 1e-12);
});

test("the page's level sums the speakers at their own distances", (t) => {
  const { d, m } = modelOf(seatAt(2, 0.3));
  const dl = d.leftGeometry.distM,
    dr = d.rightGeometry.distM;
  assert.ok(dl > 2.2 && dr < 1.8, `${dl} and ${dr}`);
  // far enough out that the driver paths are the speakers' distances
  const sys = m.speakerSystem;
  const want = sys.maxLevel + HIFI_PAIR_SUM_DB + 10 * Math.log10((1 / dl ** 2 + 1 / dr ** 2) / 2);
  close(t, m.maxLevelAtSeatDb, want, 1e-9);
  const mean = sys.maxLevel - 20 * Math.log10(d.seatDistanceM) + 3;
  assert.ok(
    m.maxLevelAtSeatDb - mean > 0.2,
    "louder than the mean distance gave: the near speaker counts more",
  );
});

test("each speaker's distance has the seat floor, so a near speaker can't pass it", () => {
  // one speaker at 0.89 m, the other at 1.18: the near one is read at the 1 m floor
  const { d, m } = modelOf(seatAt(1, 0.3));
  const [l, r] = [d.leftGeometry, d.rightGeometry].map((g) =>
    hifiSeatPaths(
      m.speakerSystem,
      DEFAULT_HIFI.woofer,
      d.tweeterWithWaveguide,
      d.speakerConfig,
      g,
      1,
    ),
  );
  assert.ok(Math.min(d.leftGeometry.distM, d.rightGeometry.distM) < 1);
  assert.strictEqual(Math.min(l.wM, r.wM, l.tM, r.tM), 1);
  assert.strictEqual(m.maxLevelAtSeatDb, hifiPairLevelDb(m.speakerSystem, [l, r]));
});

test("close in each driver's path counts its height off the ear; from 1 m out it is the speaker's distance", (t) => {
  const { d, m } = modelOf(DEFAULT_HIFI);
  const sys = m.speakerSystem,
    lay = sys.lay;
  const at = (dM: number) =>
    hifiSeatPaths(
      sys,
      DEFAULT_HIFI.woofer,
      d.tweeterWithWaveguide,
      d.speakerConfig,
      tweeterAxisSeat(lay, dM),
    );
  for (const dM of [1, 1.5, 3]) assert.deepStrictEqual(at(dM), { wM: dM, tM: dM });
  const near = at(0.3),
    off = lay.spacingIn * IN;
  // on the tweeter's axis: the tweeter at the seat distance, the woofer further by its spacing below
  close(t, near.tM, 0.3, 1e-15);
  close(
    t,
    near.wM,
    (Math.hypot(0.3, off) * HIFI_NEAR_FIELD_M) / Math.hypot(HIFI_NEAR_FIELD_M, off),
    1e-15,
  );
  assert.ok(20 * Math.log10(near.wM / near.tM) > 0.5, "over half a dB at 0.3 m for a 5″ spacing");
  // the near-field path joins the far one at 1 m and grows with the offset
  close(t, nearFieldPathM(HIFI_NEAR_FIELD_M - 1e-9, 0.2), HIFI_NEAR_FIELD_M, 1e-8);
  assert.ok(nearFieldPathM(0.3, 0.2) > nearFieldPathM(0.3, 0.1));
  close(t, nearFieldPathM(0, 0.2), 0.2 / Math.hypot(1, 0.2), 1e-15);
});

// ---- the baffle step and boundary gain ----

test("the baffle step's edge share is 1 from 1 m out and falls to 0 at the baffle", () => {
  const dim = { w: 9, h: 15 },
    src = { x: 0, y: 7.4 };
  for (const dM of [1, 2, 10]) assert.strictEqual(baffleEdgeShare(dim, src, dM), 1);
  assert.strictEqual(baffleEdgeShare(dim, src, 0), 0);
  let last = 0;
  for (const dM of [0.05, 0.1, 0.2, 0.3, 0.5, 0.8, 0.99]) {
    const s = baffleEdgeShare(dim, src, dM);
    assert.ok(s > last && s < 1, `${dM} m: ${s}`);
    last = s;
  }
  // a wider baffle keeps its step shallower at the same distance
  assert.ok(
    baffleEdgeShare({ w: 18, h: 30 }, { x: 0, y: 15 }, 0.3) < baffleEdgeShare(dim, src, 0.3),
  );
});

test("the near baffle step: the full 6 dB far away, none at the baffle, and the same above the step", (t) => {
  close(t, nearBaffleStepGain(1e-6, 1), 1, 1e-12);
  // no edge wave: the low end is 6 dB up on the far-field step (1 over 1/2)
  close(t, nearBaffleStepGain(1e-6, 0), 2, 1e-9);
  // half the edge wave: 3/4 against 1/2
  close(t, nearBaffleStepGain(1e-6, 0.5), 1.5, 1e-9);
  // well above the step both shelves are 1
  close(t, nearBaffleStepGain(1e4, 0), 1, 1e-6);
});

test("the boundary share is 1 from 1 m out and falls to 0 at the speaker; the near gain loses the wall's lift", (t) => {
  for (const dM of [1, 3]) assert.strictEqual(boundaryShare(dM, 0.6), 1);
  assert.strictEqual(boundaryShare(0, 0.6), 0);
  assert.ok(boundaryShare(0.3, 0.6) < boundaryShare(0.6, 0.6));
  // closer to the wall its image is nearer, so its share holds up better
  assert.ok(boundaryShare(0.3, 0.2) > boundaryShare(0.3, 1));
  const G = 2; // a corner's 6 dB
  close(t, nearBoundaryGain(1e-6, G, 1), 1, 1e-12);
  close(t, nearBoundaryGain(1e-6, G, 0), 1 / G, 1e-9);
  close(t, nearBoundaryGain(1e4, G, 0), 1, 1e-6);
  assert.strictEqual(
    nearBoundaryGain(1e-6, 1, 0),
    1,
    "a free-standing speaker has no wall to lose",
  );
});

test("the response close in: less baffle step lifts the bass, a corner's gain fades, and from 1 m out nothing moves", (t) => {
  const { d, m } = modelOf(DEFAULT_HIFI);
  const sys = m.speakerSystem,
    cfg = d.speakerConfig;
  for (const dM of [1, 2.66]) assert.strictEqual(hifiNearFieldShelves(sys, cfg, dM), null);
  const free = hifiNearFieldShelves(sys, cfg, 0.3),
    corner = hifiNearFieldShelves(sys, { ...cfg, place: "corner" }, 0.3);
  assert.ok(free && corner);
  // free-standing: only the step, which is shallower close in (the BSC's boost is now too much)
  assert.ok(free(20) > 1.05 && free(20) < 2, `${free(20)}`);
  close(t, free(20000), 1, 1e-3);
  // a corner loses more of its 6 dB than the step gives back
  assert.ok(corner(20) < 1, `${corner(20)}`);
  // and the response at 0.3 m on axis carries it: up at 40 Hz against the far-field shelves
  const geo = tweeterAxisSeat(sys.lay, 0.3),
    f = [40, 10000];
  const nearR = hifiResponseAt(sys, DEFAULT_HIFI.woofer, d.tweeterWithWaveguide, cfg, geo, f);
  const farR = hifiResponseAt(
    sys,
    DEFAULT_HIFI.woofer,
    d.tweeterWithWaveguide,
    cfg,
    { ...geo, alignM: HIFI_NEAR_FIELD_M },
    f,
  );
  // (the alignment moves with it, which the tweeter barely hears at 40 Hz and the woofer at 10 kHz)
  close(t, nearR[0].spl - farR[0].spl, 20 * Math.log10(free(40)), 1e-4);
  close(t, nearR[1].spl, farR[1].spl, 0.05);
});

// ---- floors ----

test("a seat at a speaker, with no seat floor, keeps every figure finite", () => {
  const s: HifiDesignState = {
    ...DEFAULT_HIFI,
    speakerSpacingFt: 0,
    listeningSeat: { x: 0, y: 0 },
    seatFloorM: 0,
  };
  const { m: base } = modelOf(s);
  // the ear at the tweeter, then at the woofer: each driver's path is 0 in turn
  for (const eyeIn of [base.speakerSystem.lay.tweeterIn, base.speakerSystem.lay.wooferIn]) {
    const { d, m } = modelOf({ ...s, earHeightIn: s.standHeightIn + eyeIn });
    assert.strictEqual(d.seatDistanceM, 0);
    assert.ok(Number.isFinite(m.maxLevelAtSeatDb), `${m.maxLevelAtSeatDb}`);
    for (const c of [m.pairResponse, m.onAxisResponse])
      for (const o of c) assert.ok(Number.isFinite(o.spl), `${o.f} Hz`);
    for (const row of m.dispersion.rows) for (const v of row) assert.ok(Number.isFinite(v));
  }
});

test("a driver's path floor is half its radius", (t) => {
  close(t, driverPathFloorM(0.1), 0.05, 1e-15);
  const { d, m } = modelOf(DEFAULT_HIFI);
  const a = Math.sqrt(DEFAULT_HIFI.woofer.ts.Sd / 1e4 / Math.PI);
  const p = hifiSeatPaths(
    m.speakerSystem,
    DEFAULT_HIFI.woofer,
    d.tweeterWithWaveguide,
    d.speakerConfig,
    {
      th: 0,
      eyeIn: m.speakerSystem.lay.wooferIn,
      distM: 0,
      boxFrame: true,
    },
  );
  close(t, p.wM, a / 2, 1e-15);
  close(
    t,
    p.tM,
    Math.max(
      (d.tweeterWithWaveguide.domeIn * IN) / 4,
      nearFieldPathM(0, m.speakerSystem.lay.spacingIn * IN),
    ),
    1e-15,
  );
});

// ---- the near-field signal ----

test("the near-field signal: the nearer speaker's distance against the box and woofer, near under 1 m", (t) => {
  const far = deriveHifiDesign(DEFAULT_HIFI).nearField;
  assert.strictEqual(far.near, false);
  close(t, far.distM, deriveHifiDesign(DEFAULT_HIFI).seatDistanceM, 1e-12);
  close(t, far.boxRatio, far.distM / (15 * IN), 1e-12);
  close(t, far.wooferRatio, far.distM / (DEFAULT_HIFI.woofer.size * IN), 1e-12);
  // under the 1 m floor the figures are worked out at 1 m, which isn't near
  assert.strictEqual(deriveHifiDesign(seatAt(0.5)).nearField.near, false);
  const close5 = deriveHifiDesign(seatAt(0.5, 0.3, { seatFloorM: 0.3 })).nearField;
  assert.strictEqual(close5.near, true);
  assert.ok(close5.distM < 0.5 && close5.distM >= 0.3, `${close5.distM}`);
  assert.ok(close5.boxRatio < 1.5 && close5.wooferRatio < 3.5);
});

// ---- the far field as it was ----

test("from 1 m out the level is the mean-distance formula's, to the bit, for an equal pair", () => {
  for (const dM of [1, 2, 3]) {
    const { d, m } = modelOf(seatAt(dM));
    assert.strictEqual(d.leftGeometry.distM, d.rightGeometry.distM);
    assert.strictEqual(
      m.maxLevelAtSeatDb,
      m.speakerSystem.maxLevel - 20 * Math.log10(d.seatDistanceM) + 3,
    );
  }
  const { d, m } = modelOf(DEFAULT_HIFI);
  assert.strictEqual(
    m.maxLevelAtSeatDb,
    m.speakerSystem.maxLevel - 20 * Math.log10(d.seatDistanceM) + 3,
  );
});

// ---- the optimizer ----

test("the optimizer reads the level at the seat with the page's rule: close in, the woofer's longer path counts", (t) => {
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
  const tweeters = HIFI_TWEETERS.filter((o) => ["sb26stcn", "rst28f"].includes(o.id));
  const w = HIFI_WOOFERS.find((o) => o.id === cur.woofer),
    tw = tweeters.find((o) => o.id === cur.tweeter);
  assert.ok(w && tw);
  const sys = hifiSystem(w, tw, cur);
  assert.ok(sys);
  const input = {
    cur,
    woofers: HIFI_WOOFERS,
    tweeters,
    budget: 800,
    goals: ["louder" as const],
    locks: { woofer: true, dim: { w: "exact" as const, h: "exact" as const } },
  };
  for (const seatM of [0.5, 2.6]) {
    const out = optimizeHifiSpeaker({ ...input, seatM });
    assert.ok(out.cur, "your design is modeled");
    const p = hifiSeatPaths(sys, w, tw, cur, tweeterAxisSeat(sys.lay, seatM));
    close(t, out.cur.level, hifiPairLevelDb(sys, [p, p]), 1e-9, `${seatM} m`);
    const pointSource: number = sys.maxLevel - 20 * Math.log10(seatM) + 3;
    if (seatM < HIFI_NEAR_FIELD_M)
      assert.ok(out.cur.level < pointSource - 0.1, "the woofer is further");
    else assert.strictEqual(out.cur.level, pointSource);
    assert.ok(out.cards.length > 0, `${seatM} m: cards`);
  }
});
