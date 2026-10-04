import * as HIFI from "../src/lib/hifi/hifi";
import { test } from "vite-plus/test";
import assert from "node:assert";
import {
  linkwitzRileyFilter,
  baffleStepGain,
  baffleStepShelf,
  baffleStepF3,
  baffleStepCompensation,
  boundaryGain,
  pistonDirectivity,
  waveguideDirectivity,
  hifiSystem,
  hifiChips,
  hifiResponseAt,
  hifiDispersionMap,
  grossVolumeLiters,
  portAfterToggle,
  listenerGeometry,
} from "../src/lib/hifi/hifi";
import type { HifiConfig, HifiTweeter, HifiWoofer, PassiveRadiator } from "../src/types";
import { chipList, chipOf, close, findChip } from "./helpers";

// a generic 6.5" woofer and 1" dome (typical published values), so the tests don't depend on the driver list
// price, src, fmax, note and ts.Le, ts.sens, ts.imp complete the type; the functions under test ignore them
const W: HifiWoofer = {
  id: "w",
  size: 6.5,
  lb: 4,
  name: "test 6.5",
  maker: "dayton",
  price: 0,
  src: "",
  fmax: null,
  note: "",
  ts: {
    Fs: 38,
    Qts: 0.36,
    Qes: 0.4,
    Qms: 3.5,
    Vas: 25,
    Sd: 132,
    Xmax: 5.5,
    xmax: { basis: "converted", lo: 5.5, hi: 5.5 },
    pub: { Xmax: 5.5, formula: "hg/4" },
    Re: 5.6,
    Bl: 7,
    Mms: 16,
    aes: 60,
    disp: 0.6,
    Le: 0.5,
    sens: 88,
    imp: 8,
  },
};
const T: HifiTweeter = {
  id: "t",
  lb: 1,
  name: "test dome",
  price: 0,
  src: "",
  exit: null,
  note: "",
  hf: { sens: 90, aes: 50, aesXo: 2000, minXo: 1800, imp: 8, fs: 700 },
  type: "dome",
  faceplate: { w: 4, h: 4 },
  domeIn: 1,
};
const cfg: HifiConfig = {
  box: "vented",
  dim: { w: 8.5, h: 14, d: 10 },
  wall: 0.75,
  port: { n: 1, dia: 2, len: 5 },
  xo: 2200,
  order: 4,
  wAmpW: 100,
  tAmpW: 50,
  bsc: 0,
  place: "free",
  wallFt: 2,
  portMax: 17,
};
const db = (x: number) => 20 * Math.log10(x);

test("LR24 and LR48 low and high passes sum flat, in phase", (t) => {
  for (const order of [4, 8])
    for (const f of [200, 1000, 2000, 3000, 12000]) {
      const a = linkwitzRileyFilter(f, 2000, order, "lp"),
        b = linkwitzRileyFilter(f, 2000, order, "hp");
      close(t, Math.hypot(a.re + b.re, a.im + b.im), 1, 1e-9, `order ${order} at ${f}`);
    }
  close(
    t,
    db(
      Math.hypot(
        linkwitzRileyFilter(2000, 2000, 4, "lp").re,
        linkwitzRileyFilter(2000, 2000, 4, "lp").im,
      ),
    ),
    -6.02,
    0.01,
    "−6 dB at the crossover",
  );
});

test("baffle step: −6 dB well below, 0 dB well above, −3 dB at 115 / width", (t) => {
  close(t, db(baffleStepGain(20, 9)), -6, 0.05);
  close(t, db(baffleStepGain(20000, 9)), 0, 0.05);
  close(t, db(baffleStepGain(baffleStepF3(9), 9)), -3, 0.05);
  close(t, db(baffleStepCompensation(20, 9, 4)), 4, 0.05, "compensation shelf");
  close(t, db(baffleStepCompensation(20000, 9, 4)), 0, 0.05);
});

test("baffle step with its phase: the shelf's magnitude is the step's; it leads most, 19.5°, where x = 1/√2", (t) => {
  for (const f of [20, 200, 600, 2000, 20000]) {
    const h = baffleStepShelf(f, 15);
    close(t, Math.hypot(h.re, h.im), baffleStepGain(f, 15), 1e-12, `${f} Hz`);
  }
  // x = 0.707 f / f3, so x = 1/√2 at f3
  const h = baffleStepShelf(baffleStepF3(15), 15);
  close(t, (Math.atan2(h.im, h.re) * 180) / Math.PI, 19.47, 0.01);
  const far = baffleStepShelf(20000, 15);
  assert.ok(Math.abs(Math.atan2(far.im, far.re)) < 0.02, "flat in phase well above");
});

test("placement: +3 dB near a wall and +6 dB in a corner at low frequencies, nothing up high", (t) => {
  close(t, db(boundaryGain(10, "wall", 0.6)), 3, 0.05);
  close(t, db(boundaryGain(10, "corner", 0.6)), 6, 0.05);
  close(t, db(boundaryGain(5000, "corner", 0.6)), 0, 0.05);
  close(t, db(boundaryGain(20, "free", 0.6)), 0, 1e-9);
});

test("directivity: pistons and waveguides are 0 dB on axis and fall off-axis as frequency rises", (t) => {
  close(t, pistonDirectivity(3000, 0.065, 0), 1, 1e-9);
  assert.ok(
    pistonDirectivity(3000, 0.065, 0.5) < pistonDirectivity(1000, 0.065, 0.5),
    'a 6.5" narrows with frequency',
  );
  close(
    t,
    db(waveguideDirectivity(10000, 90, 60, 10, 7, Math.PI / 4, 0)),
    -6,
    0.1,
    "−6 dB at the edge of a 90° waveguide",
  );
});

test("the speaker: volume, tuning, levels and checks", (t) => {
  const s = hifiSystem(W, T, cfg)!;
  close(t, s.gross, grossVolumeLiters(cfg.dim, 0.75), 1e-9);
  assert.ok(s.net < s.gross && s.Fb! > 30 && s.Fb! < 80, `Fb ${s.Fb}`);
  assert.ok(s.f3 > 30 && s.f3 < 120, `F3 ${s.f3}`);
  assert.ok(s.trim < 0, "a 90 dB dome is trimmed down to an ~86 dB woofer");
  assert.ok(s.maxLevel === Math.min(s.wLevel, s.tLevel));
  // the woofer, not the tweeter, sets the level, and the check names what limits it
  const chips = hifiChips(s, W, T, cfg);
  chipOf(chips, "hifiTweeterLevel", "ok");
  chipOf(chips, "hifiWooferLimit");
  // a crossover under the dome's rating is flagged
  const low = { ...cfg, xo: 1200 };
  assert.ok(!findChip(hifiChips(s, W, T, cfg), "hifiTweeterMinXo"));
  chipOf(hifiChips(hifiSystem(W, T, low)!, W, T, low), "hifiTweeterMinXo", "warn");
  // baffle-step boost costs headroom
  const b = hifiSystem(W, T, { ...cfg, bsc: 6 })!;
  assert.ok(b.wLevel <= s.wLevel + 1e-9, "boost never adds clean output");
});

test("response at the seat: on axis matches the design axis; off axis and above the lobe lose level", (t) => {
  const s = hifiSystem(W, T, cfg)!,
    freqs = [500, 2200, 8000];
  const on = hifiResponseAt(s, W, T, cfg, { th: 0, eyeIn: s.lay.tweeterIn, distM: 2 }, freqs);
  const off = hifiResponseAt(
    s,
    W,
    T,
    cfg,
    { th: Math.PI / 3, eyeIn: s.lay.tweeterIn, distM: 2 },
    freqs,
  );
  assert.ok(off[2].spl < on[2].spl - 2, "60° off axis at 8 kHz is quieter");
  // the summed on-axis response at the crossover is close to the passband (time-aligned, LR4)
  assert.ok(Math.abs(on[1].spl - on[0].spl) < 3, `${on[1].spl} vs ${on[0].spl}`);
  const m = hifiDispersionMap(s, W, T, cfg, "h", 2);
  assert.equal(m.rows.length, m.angles.length);
  assert.deepStrictEqual([m.angles[0], m.angles[m.angles.length - 1]], [-90, 90], "both sides");
  assert.ok(
    m.rows[m.angles.indexOf(0)].every((v) => Math.abs(v) < 1e-9),
    "0° row is the reference",
  );
});

test("ports with elbows: longer ports fit, and the check says when one is needed", (t) => {
  const { portMaxLength } = HIFI;
  const dim = { w: 8.5, h: 14, d: 10 };
  const s0 = portMaxLength(dim, 0.75, { dia: 2, elbows: 0 }),
    s1 = portMaxLength(dim, 0.75, { dia: 2, elbows: 1 }),
    s2 = portMaxLength(dim, 0.75, { dia: 2, elbows: 2 });
  assert.ok(s0 < s1 && s1 < s2, `${s0} < ${s1} < ${s2}`);
  const chips = (len: number) => {
    const c = { ...cfg, port: { n: 1, dia: 2, len } };
    return hifiChips(hifiSystem(W, T, c)!, W, T, c);
  };
  const port = (len: number) => {
    const F = chips(len);
    return {
      elbows: findChip(F, "hifiPortElbows", "warn"),
      tooLong: findChip(F, "hifiPortFit", "bad"),
      F,
    };
  };
  const straight = port(s0 - 0.5);
  assert.ok(
    !straight.elbows && !straight.tooLong,
    `straight fits, no note: ${chipList(straight.F)}`,
  );
  const one = port(s0 + 0.5),
    two = port(s1 + 0.5),
    none = port(s2 + 0.5);
  assert.ok(one.elbows && !one.tooLong, chipList(one.F));
  assert.ok(two.elbows && !two.tooLong, chipList(two.F));
  assert.ok(none.tooLong && !none.elbows, chipList(none.F));
  // how many elbows the chip asks for is only in its words: a check of the copy, not the lookup
  assert.match(one.elbows[1], /an elbow/);
  assert.match(two.elbows[1], /two elbows/);
});

test("passive radiators: tuning, notch, travel limit and checks", (t) => {
  const { passiveRadiatorTuning, passiveRadiatorMassFor } = HIFI;
  const drv: PassiveRadiator = {
    id: "p",
    name: "test radiator",
    maker: "dayton",
    src: "",
    note: "",
    size: 6.5,
    Sd: 128.7,
    Mms: 30.7,
    Cms: 1.15,
    Qms: 4.3,
    Fs: 26.8,
    Xmax: 8,
    xmax: { basis: "published", lo: 8, hi: 8 },
    pub: { Xmax: 8, formula: "unstated" },
    lb: 0.75,
    price: 25,
  };
  const s0 = hifiSystem(W, T, { ...cfg, box: "sealed" })!;
  // Fs of the radiator alone follows from its mass and compliance
  close(t, passiveRadiatorTuning(drv, 1, 0, 1e9).Fp, drv.Fs, 0.5);
  const add = passiveRadiatorMassFor(drv, 2, s0.net, 40)!;
  const pc: HifiConfig = { ...cfg, box: "radiator", pr: { drv, n: 2, addG: add } };
  const s = hifiSystem(W, T, pc)!;
  close(t, s.Fb!, 40, 1, "added mass tunes the box");
  assert.ok(s.Fp! < s.Fb!, "the radiator's own resonance sits below the tuning");
  const at = (f: number) =>
    s.woofer.reduce((b, o) => (Math.abs(o.f - f) < Math.abs(b.f - f) ? o : b));
  // the notch: steep above Fp, shallower below it
  assert.ok(
    at(s.Fp! * 1.25).raw - at(s.Fp!).raw > at(s.Fp!).raw - at(s.Fp! / 1.25).raw,
    "a notch at Fp",
  );
  assert.ok(at(s.Fb!).xmm < at(s.Fb! * 1.6).xmm, "the cone barely moves at Fb");
  assert.ok(at(s.Fb!).prx! > at(s.Fb!).xmm, "the radiators move at Fb");
  // more mass, lower tuning
  assert.ok(hifiSystem(W, T, { ...pc, pr: { drv, n: 2, addG: add + 40 } })!.Fb! < s.Fb!);
  // one small radiator is flagged; one that doesn't fit is bad
  const one = { ...pc, pr: { drv: { ...drv, Xmax: 3 }, n: 1, addG: 0 } };
  chipOf(hifiChips(s, W, T, pc), "hifiRadiatorSize", "ok");
  chipOf(hifiChips(hifiSystem(W, T, one)!, W, T, one), "hifiRadiatorSize", "warn");
  const big = { ...pc, pr: { drv: { ...drv, size: 10 }, n: 2, addG: 0 } };
  assert.ok(!findChip(hifiChips(hifiSystem(W, T, one)!, W, T, one), "hifiRadiatorFit"));
  chipOf(hifiChips(hifiSystem(W, T, big)!, W, T, big), "hifiRadiatorFit", "bad");
});

test("slot vent: tunes like a port of the same area and length, its shelf takes volume, and long slots are flagged", (t) => {
  const slot: HifiConfig = { ...cfg, port: { shape: "slot", n: 1, h: 1, len: 5 } };
  const s = hifiSystem(W, T, slot)!,
    r = hifiSystem(W, T, cfg)!;
  assert.ok(s.kind === "vented" && s.slotW != null && s.Fb > 20 && s.Fb < 90, `Fb ${s.Fb}`);
  close(t, s.pArea, 1 * (cfg.dim.w - 1.5), 1e-9, "full inner width");
  assert.ok(s.pVol > (s.pArea * 5 * 16.387) / 1e3, "the shelf is counted");
  // longer slot, lower tuning
  assert.ok(hifiSystem(W, T, { ...slot, port: { shape: "slot", n: 1, h: 1, len: 7 } })!.Fb! < s.Fb);
  const long: HifiConfig = { ...slot, port: { shape: "slot", n: 1, h: 1, len: 20 } };
  assert.ok(!findChip(hifiChips(s, W, T, slot), "hifiSlotFit"));
  chipOf(hifiChips(hifiSystem(W, T, long)!, W, T, long), "hifiSlotFit", "bad");
  assert.ok(r.Fb! > 0);
});

test("planar ribbon on its own waveguide: flush-mounted, its coverage drives the directivity, 5 ohm and minimum crossover checked", async (t) => {
  const { HIFI_TWEETERS, ownGuideCfg } = await import("../src/lib/data");
  const r = HIFI_TWEETERS.find((o) => o.id === "lt22")!;
  const g = ownGuideCfg(r),
    c = { ...cfg, guide: g, xo: 2200 };
  const s = hifiSystem(W, r, c)!;
  assert.ok(!s.lay.onTop && s.lay.tweeterIn < cfg.dim.h, "on the baffle, not on top");
  // 120° wide: about −6 dB at 60° off axis at 10 kHz, once the waveguide controls
  const on = hifiResponseAt(s, W, r, c, { th: 0, eyeIn: s.lay.tweeterIn, distM: 2 }, [10000])[0]
    .spl;
  const off = hifiResponseAt(
    s,
    W,
    r,
    c,
    { th: Math.PI / 3, eyeIn: s.lay.tweeterIn, distM: 2 },
    [10000],
  )[0].spl;
  assert.ok(on - off > 3 && on - off < 10, `${(on - off).toFixed(1)} dB down at 60°`);
  const low = { ...c, xo: 1600 };
  assert.ok(!findChip(hifiChips(s, W, r, c), "hifiTweeterMinXo"));
  chipOf(hifiChips(hifiSystem(W, r, low)!, W, r, low), "hifiTweeterMinXo", "warn");
});

test("port toggle builds a fresh port with only its own shape's fields", () => {
  const round = { n: 1, dia: 3, len: 7, elbows: 1 } as const;
  const remembered = { dia: 2, h: 1 };
  const slot = portAfterToggle(round, "slot", remembered);
  assert.deepEqual(slot, { shape: "slot", n: 1, h: 1, len: 7 });
  assert.ok(!("dia" in slot) && !("elbows" in slot), "no round fields on a slot");
  const back = portAfterToggle({ ...slot, h: 2, w: 9 }, 2, remembered);
  assert.deepEqual(back, { shape: "round", n: 2, dia: 2, len: 7 });
  assert.ok(
    !("h" in back) && !("w" in back) && !("elbows" in back),
    "no slot fields on a round port",
  );
  assert.deepEqual(portAfterToggle(round, 2, remembered), {
    shape: "round",
    n: 2,
    dia: 3,
    len: 7,
    elbows: 1,
  });
  assert.deepEqual(portAfterToggle({ ...slot, h: 2 }, "slot", remembered), { ...slot, h: 2 });
});

test("port toggle: round 3 in, to a slot and back, is round 3 in again; a slot keeps its height too", () => {
  const round = { n: 1, dia: 3, len: 7 } as const;
  // the planner remembers the last round diameter while the slot is showing
  const slot = portAfterToggle(round, "slot", { dia: round.dia, h: 1.5 });
  assert.equal(slot.h, 1.5, "the slot comes back at its remembered height");
  const back = portAfterToggle(slot, 1, { dia: round.dia, h: 2 });
  assert.equal(back.dia, 3);
  assert.equal(back.h, undefined);
  const slotAgain = portAfterToggle(back, "slot", { dia: 3, h: 2 });
  assert.equal(slotAgain.h, 2, "and the slot height the user last had");
});

test("listenerGeometry: a centred seat is symmetric, toe-in cuts the off-axis angle, and distance and ear height follow the room", (t) => {
  const room = {
    speakerSpacingFt: 8,
    listeningSeat: { x: 0, y: 8 },
    toeInDeg: 0,
    earHeightIn: 38,
    standHeightIn: 24,
  };
  const l = listenerGeometry(-1, room),
    r = listenerGeometry(1, room);
  close(t, l.th, Math.atan2(4, 8), 1e-9, "left angle");
  close(t, r.th, l.th, 1e-9, "right matches left");
  close(t, l.distM, Math.hypot(4, 8) * 0.3048, 1e-9, "distance");
  assert.equal(l.eyeIn, 14);
  // toeing in by that angle points each speaker at the seat
  const aimed = listenerGeometry(-1, { ...room, toeInDeg: (l.th * 180) / Math.PI });
  close(t, aimed.th, 0, 1e-9, "aimed at the seat");
  // a seat moved toward the right speaker is closer to it and further off axis of the left
  const right = { ...room, listeningSeat: { x: 3, y: 8 } };
  assert.ok(listenerGeometry(1, right).distM < listenerGeometry(-1, right).distM);
});
