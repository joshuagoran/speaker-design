// The Hi-fi engine options the Monitor and Fill use cases will set (no UI yet): a high-pass to a sub, passive drive,
// box tilt, the seat floor and the port speed limit. Unset, each leaves the model exactly as it was.
import { test } from "vite-plus/test";
import assert from "node:assert";
import {
  boxFrameGeometry,
  cabs,
  hifiBox,
  hifiDispersionMap,
  hifiEdgeRipple,
  hifiGridTop,
  hifiResponseAt,
  hifiSystem,
  hifiWeightLb,
  hifiWooferPrep,
  linkwitzRileyFilter,
  logSpacedFrequencies,
  tweeterAmpWatts,
  tweeterMaxLevel,
} from "../src/lib/hifi/hifi";
import { hifiSearchSpace, optimizeHifiSpeaker, HIFI_AMP_WATTS_MAX } from "../src/lib/hifi/optimize";
import { fillSystem } from "../src/lib/pa/calc";
import { deriveHifiDesign } from "../src/pages/hifi/hifiDesign";
import { DEFAULT_FILL, DEFAULT_HIFI } from "../src/lib/defaults";
import { FILL_OPTIONS, HIFI_TWEETERS, HIFI_WOOFERS } from "../src/lib/data";
import { HIFI_PORT_MAX_MS, HIFI_SEAT_FLOOR_M } from "../src/constants/hifiEngine";
import { CHANGE_NAMES } from "../src/constants/optimizerText";
import type {
  CrossoverOrder,
  HifiConfig,
  HifiDesignState,
  HifiHighpass,
  HifiOptimizerCurrent,
  HifiSystem,
  HifiTweeter,
  ListenerGeometry,
} from "../src/types";
import { close } from "./helpers";

const IN = 0.0254;
/** The default design as the model reads it. */
const design = deriveHifiDesign(DEFAULT_HIFI);
const woofer = DEFAULT_HIFI.woofer,
  tweeter = design.tweeterWithWaveguide,
  cfg: HifiConfig = design.speakerConfig;
/** A modeled system (every config here can be modeled). */
const sysOf = (c: HifiConfig, t: HifiTweeter = tweeter): HifiSystem => {
  const s = hifiSystem(woofer, t, c);
  assert.ok(s, "the design can be modeled");
  return s;
};
/** The woofer's box at `c`, to the default crossover's grid top. */
const boxOf = (c: HifiConfig) => {
  const b = hifiBox(woofer, c, hifiGridTop(c.xo));
  assert.ok(b, "the box can be modeled");
  return b;
};
const sealed: HifiConfig = { ...cfg, box: "sealed" };
const sub = (hz: number, order: CrossoverOrder): HifiHighpass => ({ hz, order });

// ---- the high-pass to a sub ----

test("unset, a vented box keeps its subsonic and a sealed box has no high-pass", () => {
  const v = boxOf(cfg),
    s = boxOf(sealed);
  assert.ok(v.hpf && v.hpf > 20, `a subsonic below the tuning: ${v.hpf}`);
  assert.strictEqual(v.hp, null);
  assert.strictEqual(s.hpf, null);
  for (const o of s.m.curve) assert.strictEqual(o.spl, o.raw);
  assert.strictEqual(sysOf(cfg).hp, undefined);
});

test("the high-pass to a sub is an LR filter of its order, in place of the subsonic, vented and sealed", (t) => {
  for (const base of [cfg, sealed])
    for (const order of [4, 8] as const) {
      const hp = sub(80, order),
        b = boxOf({ ...base, hp });
      assert.strictEqual(b.hpf, null, "no subsonic as well");
      assert.deepStrictEqual(b.hp, hp);
      const at = (f: number) =>
        b.m.curve.reduce((best, o) =>
          Math.abs(Math.log(o.f / f)) < Math.abs(Math.log(best.f / f)) ? o : best,
        );
      // the box's own response is the same; the filter is all that's added, at each frequency
      for (const f of [20, 40, 60, 80, 120, 160, 400]) {
        const o = at(f),
          want = 20 * Math.log10(cabs(linkwitzRileyFilter(o.f, 80, order, "hp")));
        close(t, o.spl - o.raw, want, 1e-9, `${base.box} LR${order * 6} at ${o.f.toFixed(1)} Hz`);
      }
      // −6 dB at the corner, and the order's slope an octave or more below it
      const i80 = b.m.curve.findIndex((o) => o.f >= 80),
        cut = (o: (typeof b.m.curve)[number]) => o.spl - o.raw;
      assert.ok(
        cut(b.m.curve[i80 - 1]) < -6.02 && cut(b.m.curve[i80]) > -6.03,
        `${base.box} −6 dB at the corner`,
      );
      const slope = at(40).spl - at(40).raw - (at(20).spl - at(20).raw);
      close(t, slope, 6 * order, 1, `${base.box} LR${order * 6} slope 20-40 Hz`);
    }
});

test("the high-pass reaches the response, the cone and port, the max output and the F3", () => {
  for (const base of [cfg, sealed]) {
    const off = sysOf(base),
      on = sysOf({ ...base, hp: sub(80, 4) });
    assert.strictEqual(on.hpf, null);
    assert.deepStrictEqual(on.hp, sub(80, 4));
    const low = (s: HifiSystem) => s.woofer.filter((o) => o.f < 60);
    low(on).forEach((o, i) => {
      const o0 = low(off)[i];
      assert.ok(o.xmm < o0.xmm, `${base.box}: less excursion at ${o.f.toFixed(1)} Hz`);
      if (o.vel != null && o0.vel != null)
        assert.ok(o.vel < o0.vel, `less port air speed at ${o.f.toFixed(1)} Hz`);
    });
    // the speaker alone rolls off at the sub crossover, and plays louder there for the same excursion
    assert.ok(on.f3 > off.f3 && on.f3 >= 75, `${base.box} F3 ${off.f3} -> ${on.f3}`);
    const resp = (s: HifiSystem, c: HifiConfig) =>
      hifiResponseAt(s, woofer, tweeter, c, { th: 0, eyeIn: s.lay.tweeterIn, distM: 1 }, [40]);
    const c80 = { ...base, hp: sub(80, 4) };
    assert.ok(resp(on, c80)[0].spl < resp(off, base)[0].spl - 10, `${base.box}: 40 Hz cut`);
  }
});

test("the high-pass reaches the optimizer: every box it searches carries it, unchanged", () => {
  const d = deriveHifiDesign({ ...DEFAULT_HIFI, subHighpass: sub(70, 4) });
  assert.deepStrictEqual(d.speakerConfig.hp, sub(70, 4));
  const cur: HifiOptimizerCurrent = {
    ...d.speakerConfig,
    woofer: woofer.id,
    tweeter: DEFAULT_HIFI.tweeter.id,
    tAmpW: DEFAULT_HIFI.tweeterAmpWatts,
  };
  const { space } = hifiSearchSpace({ cur, woofers: HIFI_WOOFERS, tweeters: HIFI_TWEETERS });
  assert.ok(space && space.grid.length > 0);
  for (const e of space.grid) assert.deepStrictEqual(e.cfg.hp, sub(70, 4));
});

// ---- passive drive ----

test("active drive gives the tweeter its own amp; passive the woofer amp through the pad", (t) => {
  assert.strictEqual(tweeterAmpWatts({ wAmpW: 100, tAmpW: 50 }, -10), 50);
  assert.strictEqual(tweeterAmpWatts({ drive: "active", wAmpW: 100, tAmpW: 50 }, -10), 50);
  close(t, tweeterAmpWatts({ drive: "passive", wAmpW: 100, tAmpW: 50 }, -10) ?? 0, 10, 1e-12);
  close(t, tweeterAmpWatts({ drive: "passive", wAmpW: 100 }, -20) ?? 0, 1, 1e-12);
  // a network can't add gain: a tweeter quieter than the woofer gets the whole amp
  assert.strictEqual(tweeterAmpWatts({ drive: "passive", wAmpW: 100 }, 3), 100);
});

test("passive drive matches the Fills page: the HF reaches its program rating at hfLimW", (t) => {
  let n = 0;
  for (const drv of FILL_OPTIONS) {
    const hf = drv.hf;
    if (!hf) continue;
    const fill = fillSystem(drv, {
      boxType: DEFAULT_FILL.boxType,
      dim: DEFAULT_FILL.boxDims,
      port: DEFAULT_FILL.portSpec,
      hp: DEFAULT_FILL.highpassHz,
      hpOrder: DEFAULT_FILL.highpassOrder,
      ampW: DEFAULT_FILL.ampWatts,
      portMax: DEFAULT_FILL.maxPortAirSpeedMs,
    });
    assert.ok(fill && fill.hfLimW != null, drv.id);
    // the same compression section as a Hi-fi tweeter, behind the same pad (the Hi-fi trim is the pad, negated)
    const tw: HifiTweeter = {
      ...tweeter,
      hf: { sens: hf.sens, aes: hf.aes, imp: hf.imp, aesXo: null, minXo: null, fs: null },
    };
    const at = (wAmpW: number) =>
      tweeterMaxLevel(tw, {
        xo: cfg.xo,
        tAmpW: tweeterAmpWatts({ drive: "passive", wAmpW }, -fill.pad),
      });
    // at hfLimW the amp just brings the HF to its program rating (2 × AES); below it the amp limits, above it the rating
    close(t, at(fill.hfLimW).pMax, 2 * hf.aes, 1e-9 * hf.aes, `${drv.id} at hfLimW`);
    close(t, at(fill.hfLimW / 2).pMax, hf.aes, 1e-9 * hf.aes, `${drv.id} at half`);
    close(t, at(fill.hfLimW * 2).pMax, 2 * hf.aes, 1e-9 * hf.aes, `${drv.id} at double`);
    n++;
  }
  assert.ok(n >= 2, "fills with an HF section were compared");
});

test("a passive design's tweeter runs off the woofer amp through the trim, whatever tAmpW says", (t) => {
  const passive: HifiConfig = { ...cfg, drive: "passive" };
  const a = sysOf(passive),
    b = sysOf({ ...passive, tAmpW: 5 });
  assert.ok(a.trim < 0, `the tweeter is padded down: ${a.trim}`);
  assert.strictEqual(a.tLevel, b.tLevel);
  // the same as an active design whose tweeter amp gives what the pad passes
  const same = sysOf({ ...cfg, tAmpW: cfg.wAmpW * Math.pow(10, a.trim / 10) });
  close(t, a.tLevel, same.tLevel, 1e-9);
  close(t, a.pMax, same.pMax, 1e-9);
  // the woofer side doesn't change: one channel at the woofer's amp power
  const act = sysOf(cfg);
  assert.strictEqual(a.wLevel, act.wLevel);
  assert.strictEqual(a.trim, act.trim);
  assert.deepStrictEqual(a.woofer, act.woofer);
});

test("weight and price count no amps, so passive drive changes neither", () => {
  const passive = deriveHifiDesign({ ...DEFAULT_HIFI, drive: "passive" });
  assert.strictEqual(passive.speakerConfig.drive, "passive");
  assert.strictEqual(passive.pairCostUsd, design.pairCostUsd);
  assert.ok(passive.speakerModel && design.speakerModel);
  assert.strictEqual(passive.speakerModel.speakerSystem.lb, design.speakerModel.speakerSystem.lb);
  assert.strictEqual(
    hifiWeightLb(woofer, tweeter, passive.speakerConfig, null),
    hifiWeightLb(woofer, tweeter, cfg, null),
  );
});

test("the optimizer passes the engine options through and leaves a passive design's tAmpW alone", () => {
  const cur: HifiOptimizerCurrent = {
    ...cfg,
    woofer: woofer.id,
    tweeter: DEFAULT_HIFI.tweeter.id,
    tAmpW: DEFAULT_HIFI.tweeterAmpWatts,
    hp: sub(70, 8),
    drive: "passive",
    tiltDeg: 8,
    portMax: 12,
  };
  const input = { cur, woofers: HIFI_WOOFERS, tweeters: HIFI_TWEETERS, budget: 800, seatM: 2.6 };
  const { space } = hifiSearchSpace(input);
  assert.ok(space && space.grid.length > 0);
  // no new search dimension: the same boxes as the active design's, each with the options as given
  const active = hifiSearchSpace({ ...input, cur: { ...cur, drive: undefined } }).space;
  assert.ok(active);
  assert.deepStrictEqual(
    space.grid.map((e) => e.key),
    active.grid.map((e) => e.key),
  );
  for (const e of space.grid) {
    assert.deepStrictEqual(e.cfg.hp, cur.hp);
    assert.strictEqual(e.cfg.drive, "passive");
    assert.strictEqual(e.cfg.tiltDeg, 8);
    assert.strictEqual(e.cfg.portMax, 12);
    assert.strictEqual(e.cfg.tAmpW, cur.tAmpW);
  }
  assert.strictEqual(active.amps.tAmpW, HIFI_AMP_WATTS_MAX.tAmpW);
  // the cards keep your tweeter amp (a passive design has none to trim) and pass the full model as passive designs
  const r = optimizeHifiSpeaker({
    ...input,
    goals: ["louder"],
    locks: { woofer: true, tweeter: true, box: true },
  });
  assert.ok(r.cards.length > 0, "a louder passive design");
  for (const k of r.cards) {
    assert.strictEqual(k.config.tAmpW, cur.tAmpW, k.label);
    assert.ok(!k.changed.includes(CHANGE_NAMES.ampPower) || k.config.wAmpW !== cur.wAmpW);
  }
});

// ---- tilt ----

/** An upright box's on-axis point at `z` m. */
const upright = (sys: HifiSystem, z: number): ListenerGeometry => ({
  th: 0,
  eyeIn: sys.lay.tweeterIn,
  distM: z,
  alignM: z,
});

test("no tilt leaves the listener as it is; a tilt lowers it on the baffle by that angle", (t) => {
  const geo: ListenerGeometry = { th: 0.3, eyeIn: 20, distM: 2, side: -1 };
  assert.strictEqual(boxFrameGeometry(geo, undefined), geo);
  assert.strictEqual(boxFrameGeometry(geo, 0), geo);
  const inBox: ListenerGeometry = { ...geo, boxFrame: true };
  assert.strictEqual(boxFrameGeometry(inBox, 10), inBox);
  // far away at the tweeter's height: 10° below the axis of a box kicked back 10°
  const tw = 13,
    far = boxFrameGeometry({ th: 0, eyeIn: tw, distM: 200 }, 10);
  const below = (Math.atan2((far.eyeIn - tw) * IN, far.distM) * 180) / Math.PI;
  close(t, below, -10, 0.01, "vertical angle");
  assert.strictEqual(far.boxFrame, true);
  assert.strictEqual(far.alignM, 200);
  // the offset across and the side stay; the distance from the bottom front edge stays
  const g = boxFrameGeometry(geo, 15);
  close(t, g.distM * Math.sin(g.th), geo.distM * Math.sin(geo.th), 1e-12, "across");
  assert.strictEqual(g.side, -1);
  close(
    t,
    Math.hypot(g.distM, g.eyeIn * IN),
    Math.hypot(geo.distM, geo.eyeIn * IN),
    1e-12,
    "distance from the edge",
  );
});

test("a tilted box sounds on its axis as an upright one does on its own", (t) => {
  const tilt = 12,
    r = (tilt * Math.PI) / 180;
  const sys = sysOf(cfg),
    tilted = { ...cfg, tiltDeg: tilt };
  const freqs = logSpacedFrequencies(100, 20000, 40);
  // the point 2 m out on the tilted box's axis, in the room: the box frame's point turned up by the tilt
  const z = 2,
    y = sys.lay.tweeterIn * IN;
  const room: ListenerGeometry = {
    th: 0,
    eyeIn: (y * Math.cos(r) + z * Math.sin(r)) / IN,
    distM: z * Math.cos(r) - y * Math.sin(r),
    alignM: z,
  };
  const onAxis = hifiResponseAt(sys, woofer, tweeter, cfg, upright(sys, z), freqs);
  hifiResponseAt(sys, woofer, tweeter, tilted, room, freqs).forEach((o, i) =>
    close(t, o.spl, onAxis[i].spl, 1e-6, `${o.f.toFixed(0)} Hz`),
  );
  const edge = hifiEdgeRipple(sys, woofer, tweeter, cfg, freqs, upright(sys, z));
  hifiEdgeRipple(sys, woofer, tweeter, tilted, freqs, room).forEach((o, i) =>
    close(t, o.spl, edge[i].spl, 1e-6, `edge ${o.f.toFixed(0)} Hz`),
  );
  // and the same seat in the room hears the tilted box from below its axis
  const seat: ListenerGeometry = { th: 0, eyeIn: sys.lay.tweeterIn, distM: z };
  const hi = (c: HifiConfig) => hifiResponseAt(sys, woofer, tweeter, c, seat, [12000])[0].spl;
  assert.notStrictEqual(hi(tilted), hi(cfg));
});
test("the tilt moves the vertical map's axis up, and leaves the horizontal map and the on-axis curves", () => {
  const sys = sysOf(cfg),
    tilted = { ...cfg, tiltDeg: 20 };
  const h0 = hifiDispersionMap(sys, woofer, tweeter, cfg, "h", 2),
    h1 = hifiDispersionMap(sys, woofer, tweeter, tilted, "h", 2);
  assert.deepStrictEqual(h1, h0);
  assert.deepStrictEqual(
    hifiEdgeRipple(sys, woofer, tweeter, tilted, [1000, 3000]),
    hifiEdgeRipple(sys, woofer, tweeter, cfg, [1000, 3000]),
  );
  const v0 = hifiDispersionMap(sys, woofer, tweeter, cfg, "v", 2),
    v1 = hifiDispersionMap(sys, woofer, tweeter, tilted, "v", 2);
  // the row that matches the upright map's on-axis row best, over the top octaves, sits near +20°
  const top = v0.freqs.flatMap((f, i) => (f > 4000 ? [i] : []));
  const axis = v0.angles.indexOf(0);
  const err = (row: number[]) =>
    top.reduce((s, i) => s + Math.abs(row[i] - v0.rows[axis][i]), 0) / top.length;
  const best = v1.rows.reduce((b, row, i) => (err(row) < err(v1.rows[b]) ? i : b), 0);
  assert.ok(Math.abs(v1.angles[best] - 20) <= 5, `the axis at ${v1.angles[best]}°`);
});

// ---- seat floor ----

const nearSeat: HifiDesignState = {
  ...DEFAULT_HIFI,
  speakerSpacingFt: 0,
  listeningSeat: { x: 0, y: 1 }, // 0.3 m
  earHeightIn: DEFAULT_HIFI.standHeightIn + 12,
};

test("the seat floor is 1 m by default and a parameter below it", (t) => {
  assert.strictEqual(HIFI_SEAT_FLOOR_M, 1);
  const floored = deriveHifiDesign(nearSeat);
  assert.strictEqual(floored.seatDistanceM, 1);
  const near = deriveHifiDesign({ ...nearSeat, seatFloorM: 0.3 });
  const d = (near.leftGeometry.distM + near.rightGeometry.distM) / 2;
  close(t, near.seatDistanceM, d, 1e-12);
  close(t, near.seatDistanceM, 0.3048, 1e-9);
  close(t, near.seatDistanceFt, 1, 1e-9);
  // a floor below the seat leaves a far seat as it was
  assert.strictEqual(
    JSON.stringify(deriveHifiDesign({ ...DEFAULT_HIFI, seatFloorM: 0.3 })),
    JSON.stringify(design),
  );
  assert.ok(near.speakerModel && floored.speakerModel);
  const m = near.speakerModel;
  close(t, m.maxLevelAtSeatDb, m.speakerSystem.maxLevel - 20 * Math.log10(0.3048) + 3, 1e-9);
  // every curve and the map stay finite this close
  for (const c of [m.onAxisResponse, m.pairResponse, m.tweeterMaxCurve])
    for (const o of c) assert.ok(Number.isFinite(o.spl), `${o.f} Hz`);
  for (const row of m.dispersion.rows) for (const v of row) assert.ok(Number.isFinite(v));
  assert.notDeepStrictEqual(m.dispersion, floored.speakerModel.dispersion);
});

// ---- port speed limit ----

test("the port speed limit is 17 m/s by default and a parameter", (t) => {
  assert.strictEqual(HIFI_PORT_MAX_MS, 17);
  assert.strictEqual(design.speakerConfig.portMax, 17);
  const slow = deriveHifiDesign({ ...DEFAULT_HIFI, portMaxMs: 8.5 });
  assert.strictEqual(slow.speakerConfig.portMax, 8.5);
  // the port's limit scales with it, point by point; nothing else moves
  const b = boxOf(cfg),
    p17 = hifiWooferPrep(b, woofer, cfg),
    p8 = hifiWooferPrep(b, woofer, slow.speakerConfig);
  let finite = 0;
  p17.sP.forEach((s, i) => {
    if (!Number.isFinite(s)) return;
    close(t, p8.sP[i], s / 2, 1e-9 * s);
    finite++;
  });
  assert.ok(finite > 0);
  assert.deepStrictEqual(p8.sX1, p17.sX1);
  // a slow enough port sets the woofer's level, lower than before
  const tight = deriveHifiDesign({ ...DEFAULT_HIFI, portMaxMs: 4 }).speakerModel;
  assert.ok(tight && design.speakerModel);
  assert.strictEqual(tight.speakerSystem.whoW, "port");
  assert.ok(tight.speakerSystem.wLevel < design.speakerModel.speakerSystem.wLevel);
});

// ---- defaults ----

test("the engine options at their defaults give byte-identical output to a design without them", () => {
  const states: HifiDesignState[] = [
    DEFAULT_HIFI,
    { ...DEFAULT_HIFI, boxType: "sealed" },
    { ...DEFAULT_HIFI, boxType: "radiator", boxDims: { w: 10, h: 18, d: 12 } },
    { ...DEFAULT_HIFI, portSpec: { shape: "slot", n: 1, h: 1, len: 6 } },
    { ...DEFAULT_HIFI, crossoverOrder: 8, dispersionPlane: "v", tweeterOffsetIn: 1 },
    nearSeat,
  ];
  for (const s of states) {
    const explicit = deriveHifiDesign({
      ...s,
      subHighpass: undefined,
      drive: "active",
      tiltDeg: 0,
      seatFloorM: HIFI_SEAT_FLOOR_M,
      portMaxMs: HIFI_PORT_MAX_MS,
    });
    assert.strictEqual(JSON.stringify(explicit), JSON.stringify(deriveHifiDesign(s)), s.boxType);
  }
  // and the system: an explicit active drive and no tilt are the same config
  const plain = sysOf(cfg),
    named = sysOf({ ...cfg, drive: "active", tiltDeg: 0 });
  assert.strictEqual(JSON.stringify(named), JSON.stringify(plain));
  assert.deepStrictEqual(
    Object.keys(design.speakerConfig).filter((k) => ["hp", "drive", "tiltDeg"].includes(k)),
    [],
  );
});
