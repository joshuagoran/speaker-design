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
  hifiBox,
  hifiSystemFromBox,
  hifiGridTop,
  hifiChips,
  hifiResponseAt,
  hifiDispersionMap,
  grossVolumeLiters,
  portAfterToggle,
  listenerGeometry,
  passiveRadiatorFits,
  RADIATOR_PANEL,
} from "../src/lib/hifi/hifi";
import { hifiBoxMin } from "../src/lib/hifi/boxLayout";
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

test("an overdamped sealed box names the net volume that gives Qtc 0.5", (t) => {
  const big: HifiConfig = { ...cfg, box: "sealed", dim: { w: 16, h: 30, d: 20 } };
  const s = hifiSystem(W, T, big);
  assert.ok(s && s.kind === "sealed" && s.Qtc < 0.5, `Qtc ${s?.Qtc}`);
  const text = chipOf(hifiChips(s, W, T, big), "hifiQtc", "warn")[2];
  const m = /Qtc 0\.5 at ([\d.]+) L net/.exec(text);
  assert.ok(m, text);
  // a box of that net volume (the same face, less depth) reads Qtc 0.5
  const netL = Number(m[1]),
    faceIn2 = (big.dim.w - 1.5) * (big.dim.h - 1.5);
  const d = (netL + s.disp) / 0.97 / 0.016387 / faceIn2 + 1.5;
  const fit = hifiSystem(W, T, { ...big, dim: { ...big.dim, d } });
  assert.ok(fit && fit.kind === "sealed");
  close(t, fit.Qtc, 0.5, 0.01);
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
  // radiators too big for the box can't happen on the page: its box starts at what they need on their panel
  const wall = cfg.wall ?? 0.75;
  for (const c of [one, big]) {
    const need = hifiBoxMin({
      woofer: W,
      tweeter: T,
      onTop: false,
      cfg: c,
      wall,
      radiatorPanel: RADIATOR_PANEL,
    });
    assert.ok(passiveRadiatorFits({ ...need, d: cfg.dim.d }, wall, c.pr));
  }
  assert.equal(RADIATOR_PANEL, "back", "the box's minimum sizes radiators on the back");
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

test("compression driver on a waveguide: the higher of the two minimum crossovers holds, and the chip names its part", async () => {
  const { HIFI_TWEETERS, ST260, waveguideSpecOf } = await import("../src/lib/data");
  const { DIY_OS90X70 } = await import("../src/data/catalog/horns");
  const de250 = HIFI_TWEETERS.find((o) => o.id === "de250");
  if (!de250?.hf.minXo || DIY_OS90X70.hf.minXo === null) throw new Error("no minimums to test");
  const tweeterMin = de250.hf.minXo;
  const guideMin = DIY_OS90X70.hf.minXo;
  assert.ok(guideMin > tweeterMin, "the waveguide's loading limits before the driver does");
  const guide = waveguideSpecOf(DIY_OS90X70);
  const at = (xo: number, g = guide) => {
    const c = { ...cfg, guide: g, xo };
    const s = hifiSystem(W, de250, c);
    if (!s) throw new Error(`no system at ${xo} Hz`);
    return findChip(hifiChips(s, W, de250, c), "hifiTweeterMinXo", "warn");
  };
  // 2000 Hz: above the DE250's 1600 Hz, below the waveguide's 2100 Hz, so it warns and names the waveguide
  const warn = at(2000);
  assert.ok(warn, "a warning at 2000 Hz");
  assert.equal(warn[1], HIFI.MIN_XO_TITLE.waveguide);
  assert.ok(warn[2].includes(DIY_OS90X70.name) && warn[2].includes(String(guideMin)), warn[2]);
  assert.equal(HIFI.tweeterMinXo(de250, guide)?.hz, guideMin);
  assert.ok(!at(guideMin), "none at the waveguide's minimum");
  // on a waveguide without a minimum (the ST260), the driver's own minimum holds and the chip names the driver
  const st260 = waveguideSpecOf(ST260);
  assert.ok(!at(2000, st260));
  const own = at(tweeterMin - 100, st260);
  assert.ok(own, "a warning below the DE250's minimum");
  assert.equal(own[1], HIFI.MIN_XO_TITLE.tweeter);
  assert.ok(own[2].includes(de250.name), own[2]);
});

test("a crossover below where the waveguide holds its pattern warns once, naming it and the frequency; at or above it, none", async () => {
  const { HIFI_TWEETERS, HIFI_WAVEGUIDES, ST260, ownGuideCfg, waveguideSpecOf } =
    await import("../src/lib/data");
  const { keeleFrequency } = await import("../src/lib/pa/calc");
  const { DEFAULT_HIFI } = await import("../src/lib/defaults");
  const de250 = HIFI_TWEETERS.find((o) => o.id === "de250");
  const me10 = HIFI_WAVEGUIDES.find((h) => h.id === "me10");
  const h07e = HIFI_WAVEGUIDES.find((h) => h.id === "h07e");
  if (!de250?.hf.minXo || !me10 || !h07e) throw new Error("no DE250, ME10 or H07E to test");
  const chipsAt = (xo: number, g: HifiConfig["guide"], t: HifiTweeter = de250) => {
    const c = { ...cfg, guide: g, xo };
    const s = hifiSystem(W, t, c);
    if (!s) throw new Error(`no system at ${xo} Hz`);
    return hifiChips(s, W, t, c);
  };
  const patternAt = (xo: number, g: HifiConfig["guide"], t?: HifiTweeter) =>
    findChip(chipsAt(xo, g, t), "hifiGuidePattern", "warn");
  // the ME10: a 1.5 kHz loading cutoff, but its 5.1 in mouth holds 90° only from about 2.16 kHz (Keele), and the map
  // widens it below that too
  const guide = waveguideSpecOf(me10);
  assert.equal(guide.lowHz, me10.hf.lowHz, "the guide carries the catalogue's limit");
  const pattern = HIFI.guidePatternHz(guide);
  if (!pattern) throw new Error("no pattern limit");
  assert.equal(pattern.by, "mouth");
  assert.equal(pattern.hz, Math.round(keeleFrequency(me10.hf.covH, me10.size.w) / 10) * 10);
  assert.ok(pattern.hz > me10.hf.lowHz);
  const half = (f: number) =>
    HIFI.waveguideHalfAngles(f, guide.covH, guide.covV, guide.w, guide.h)[0];
  close(null, half(pattern.hz + 10), ((guide.covH / 2) * Math.PI) / 180, 1e-9);
  assert.ok(half(pattern.hz - 100) > ((guide.covH / 2) * Math.PI) / 180, "wider below it");
  // 2 kHz: above the DE250's 1.6 kHz minimum, below the ME10's pattern: one warning, naming both
  const warn = patternAt(2000, guide);
  assert.ok(warn, "a warning at 2000 Hz");
  assert.ok(warn[2].includes(me10.name) && warn[2].includes(String(pattern.hz)), warn[2]);
  assert.ok(!patternAt(pattern.hz, guide), "none at the limit");
  assert.ok(!patternAt(3000, guide), "none above it");
  // under the driver's minimum crossover the minimum-crossover warning stands alone
  const low = chipsAt(de250.hf.minXo - 200, guide);
  assert.ok(findChip(low, "hifiTweeterMinXo", "warn"));
  assert.ok(!findChip(low, "hifiGuidePattern"), "no second warning");
  // the H07E's maker minimum (2.2 kHz) is its limit too: below it only the minimum-crossover warning
  const h = waveguideSpecOf(h07e);
  assert.equal(HIFI.guidePatternHz(h)?.by, "loading");
  const below = chipsAt(2000, h);
  assert.ok(findChip(below, "hifiTweeterMinXo", "warn"));
  assert.ok(!findChip(below, "hifiGuidePattern"));
  // no waveguide the PA side also offers starts warning at the default crossover; a dome (no waveguide) and a ribbon's
  // own waveguide (no limit) never warn
  for (const g of HIFI_WAVEGUIDES.filter((w) => !w.scope)) {
    const p = HIFI.guidePatternHz(waveguideSpecOf(g));
    assert.ok(p && p.hz <= DEFAULT_HIFI.crossoverHz, `${g.id}: ${p?.hz} Hz`);
  }
  assert.ok(!patternAt(DEFAULT_HIFI.crossoverHz, waveguideSpecOf(ST260)));
  assert.ok(!patternAt(800, null, T));
  const ribbon = HIFI_TWEETERS.find((o) => o.ownGuide);
  const own = ownGuideCfg(ribbon);
  if (!ribbon || !own) throw new Error("no ribbon to test");
  assert.ok(!patternAt(800, own, ribbon));
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

test("listenerGeometry: a centered seat is symmetric, toe-in cuts the off-axis angle, and distance and ear height follow the room", (t) => {
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

test("a box modeled once to the top crossover reads exactly as hifiSystem at every crossover", () => {
  for (const c of [
    cfg,
    { ...cfg, box: "sealed" as const },
    { ...cfg, port: { shape: "slot" as const, n: 1, h: 1, len: 6 } },
  ]) {
    const b = hifiBox(W, c, hifiGridTop(3000));
    assert.ok(b, c.box);
    for (const xo of [1500, 1800, 2000, 2200, 2500, 3000]) {
      const cc = { ...c, xo },
        a = hifiSystemFromBox(b, W, T, cc),
        s = hifiSystem(W, T, cc);
      assert.ok(a && s, `${c.box} ${xo} Hz`);
      for (const k of [
        "f3",
        "f3Box",
        "wLevel",
        "tLevel",
        "maxLevel",
        "sMusic",
        "lb",
        "net",
      ] as const)
        assert.strictEqual(a[k], s[k], `${c.box} ${xo} Hz: ${k}`);
      assert.strictEqual(a.whoW, s.whoW);
      assert.deepStrictEqual(a.woofer, s.woofer);
    }
  }
});

test("the woofer's chart limits and its music level come from one source", () => {
  for (const c of [cfg, { ...cfg, box: "sealed" as const }]) {
    const s = hifiSystem(W, T, c);
    assert.ok(s, c.box);
    const band = s.wMax.filter((o) => o.f >= 30 && o.f <= c.xo * 1.5),
      worst = band.reduce((a, o) => (o.s < a.s ? o : a));
    assert.strictEqual(s.sMusic, worst.s, `${c.box}: the music scale is the chart's worst point`);
    assert.strictEqual(s.whoW, worst.who, `${c.box}: and names the same limit`);
  }
});
