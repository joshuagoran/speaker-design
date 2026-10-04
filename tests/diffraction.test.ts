import { test } from "vite-plus/test";
import assert from "node:assert";
import {
  edgeSegments,
  edgeRipple,
  rippleDb,
  roundoverEdgeFactor,
  roundoverOnsetHz,
} from "../src/lib/hifi/diffraction";
import type { BafflePoint } from "../src/lib/hifi/diffraction";
import {
  hifiSystem,
  hifiChips,
  hifiResponseAt,
  hifiDispersionMap,
  hifiEdgeRipple,
  listenerGeometry,
  logSpacedFrequencies,
  tweeterOffset,
  tweeterOffsetMax,
} from "../src/lib/hifi/hifi";
import { deriveHifiDesign } from "../src/pages/hifi/hifiDesign";
import { DEFAULT_HIFI } from "../src/lib/defaults";
import { formatInches } from "../src/lib/format";
import type { Dims2, HifiConfig } from "../src/types";
import { C, chipOf, close, db, findChip } from "./helpers";

const IN = 0.0254;
const FREQS = logSpacedFrequencies(200, 20000, 300);

/** The ripple (dB) on the axis of a driver at `src` on a `dim` baffle, 2 m away, with a roundover of `r` inches. */
function onAxis(dim: Dims2, src: BafflePoint, r = 0, freqs = FREQS) {
  const segs = edgeSegments(dim, src, { x: src.x, y: src.y, z: 2 / IN });
  return freqs.map((f) => {
    const [re, im] = edgeRipple(segs, f, r, () => 1);
    return { f, spl: db(Math.hypot(re, im)) };
  });
}
const peak = (c: { f: number; spl: number }[], lo: number, hi: number, dir: 1 | -1) =>
  c
    .filter((o) => o.f >= lo && o.f <= hi)
    .reduce((a, o) => (dir * o.spl > dir * a.spl ? o : a), { f: 0, spl: -dir * Infinity });

test("edge sum: no ripple far below the step (every path the same length) and none from a vanishing baffle edge", (t) => {
  const c = onAxis({ w: 9, h: 15 }, { x: 0, y: 12 }, 0, [20, 50]);
  for (const o of c) close(t, o.spl, 0, 0.1, `${o.f} Hz`);
  // the segments carry the whole edge strength: −1/2, spread over the rays
  const segs = edgeSegments({ w: 9, h: 15 }, { x: 0, y: 12 }, { x: 0, y: 12, z: 1e6 });
  close(
    t,
    segs.reduce((a, s) => a + s.amp, 0),
    -0.5,
    1e-6,
    "total edge strength",
  );
});

// The classic case (Olson; The Edge and VituixCAD's diffraction tool show the same): a source in the middle of a
// square baffle hears all four edges at the same delay, a/2 extra path. They add in phase (inverted, half a wavelength
// late) at f = c / a for a peak of about +3.5 dB, and cancel at twice that for a deep dip.
test("centred on a square baffle: peak at c / width, dip an octave up, about ±4 dB (the textbook worst case)", () => {
  const w = 9,
    c = onAxis({ w, h: w }, { x: 0, y: w / 2 });
  const fPeak = C / (w * IN); // ≈ 1.5 kHz: the edge is half a wavelength away
  const p = peak(c, 600, 2000, 1),
    d = peak(c, 2000, 4000, -1);
  assert.ok(p.f > 0.65 * fPeak && p.f < 1.15 * fPeak, `peak at ${p.f.toFixed(0)} Hz`);
  assert.ok(p.spl > 2.5 && p.spl < 4.5, `peak ${p.spl.toFixed(1)} dB`);
  assert.ok(d.f > 1.4 * fPeak && d.f < 2.3 * fPeak, `dip at ${d.f.toFixed(0)} Hz`);
  assert.ok(d.spl < -2.5, `dip ${d.spl.toFixed(1)} dB`);
  // a bigger baffle moves the same pattern down in frequency
  const big = onAxis({ w: 18, h: 18 }, { x: 0, y: 9 });
  assert.ok(peak(big, 300, 2000, 1).f < 0.7 * p.f, "18″ square peaks lower");
});

test("moving the source off centre spreads the edge delays: the square's ripple roughly halves", () => {
  const centred = rippleDb(onAxis({ w: 9, h: 9 }, { x: 0, y: 4.5 }), 1000, 5000),
    offset = rippleDb(onAxis({ w: 9, h: 9 }, { x: 2, y: 5.5 }), 1000, 5000);
  assert.ok(offset < 0.65 * centred, `${offset.toFixed(2)} vs ${centred.toFixed(2)} dB`);
});

test("a small tall box with the tweeter near the top: ±1.5–3 dB of ripple, mostly 1–5 kHz", () => {
  const c = onAxis({ w: 8.5, h: 14 }, { x: 0, y: 11.5 });
  const mid = rippleDb(c, 1000, 5000),
    high = rippleDb(c, 8000, 20000);
  assert.ok(mid >= 1.5 && mid <= 3, `±${mid.toFixed(2)} dB from 1 to 5 kHz`);
  assert.ok(high < mid, `less above 8 kHz (±${high.toFixed(2)} dB)`);
});

test("roundover: works where the wavelength is under 4 × the radius, so 1½″ helps from about 2 kHz and barely touches the step", (t) => {
  close(t, roundoverOnsetHz(1.5), 2250, 10, "1½″ onset");
  close(t, roundoverOnsetHz(0.75), 4500, 20, "¾″ onset");
  assert.strictEqual(roundoverOnsetHz(0), Infinity);
  assert.strictEqual(roundoverEdgeFactor(5000, 0), 1);
  assert.ok(roundoverEdgeFactor(300, 1.5) > 0.99, "next to nothing at the baffle step");
  assert.ok(roundoverEdgeFactor(8000, 1.5) < 0.3, "mostly gone at 8 kHz");
  const dim = { w: 9, h: 15 },
    src = { x: 0, y: 12 };
  const sharp = onAxis(dim, src),
    r34 = onAxis(dim, src, 0.75),
    r15 = onAxis(dim, src, 1.5),
    r2 = onAxis(dim, src, 2);
  const hi = (c: typeof sharp) => rippleDb(c, 2000, 8000);
  assert.ok(hi(r34) < hi(sharp) && hi(r15) < hi(r34) && hi(r2) < hi(r15), "bigger is smoother");
  assert.ok(hi(r15) < 0.65 * hi(sharp), `1½″: ±${hi(r15).toFixed(2)} vs ±${hi(sharp).toFixed(2)}`);
  // below 500 Hz (the baffle step's region) the roundover changes almost nothing
  for (let i = 0; i < sharp.length && sharp[i].f < 500; i++)
    close(t, r15[i].spl, sharp[i].spl, 0.15, `${sharp[i].f.toFixed(0)} Hz`);
});

test("ripple helper: half the peak-to-peak spread in the band", (t) => {
  const c = [
    { f: 500, spl: 9 },
    { f: 1000, spl: 2 },
    { f: 2000, spl: -1 },
    { f: 6000, spl: 9 },
  ];
  close(t, rippleDb(c, 1000, 5000), 1.5, 1e-12);
  assert.strictEqual(rippleDb(c, 10, 20), 0);
});

// ---- in the Hi-fi model ----
const W = DEFAULT_HIFI.woofer,
  T = DEFAULT_HIFI.tweeter;
const cfg: HifiConfig = {
  box: "sealed",
  dim: { w: 9, h: 15, d: 11 },
  wall: 0.75,
  port: { n: 1, dia: 2, len: 5 },
  xo: 2000,
  order: 4,
  wAmpW: 100,
  tAmpW: 50,
  bsc: 0,
  place: "free",
  wallFt: 2,
};
const sysOf = (c: HifiConfig) => {
  const s = hifiSystem(W, T, c);
  assert.ok(s, "the default drivers model");
  return s;
};

test("hifi: no roundover and no offset in a config is the same as sharp edges and a centred tweeter", () => {
  const s = sysOf(cfg),
    geo = { th: 0.3, eyeIn: s.lay.tweeterIn, distM: 2 };
  assert.deepStrictEqual(
    hifiResponseAt(s, W, T, cfg, geo, FREQS),
    hifiResponseAt(s, W, T, { ...cfg, roundoverIn: 0, tweeterOffsetIn: 0 }, geo, FREQS),
  );
  assert.strictEqual(DEFAULT_HIFI.roundoverIn, 0);
  assert.strictEqual(DEFAULT_HIFI.tweeterOffsetIn, 0);
});

test("hifi: a roundover smooths the on-axis response above 2 kHz and leaves the woofer's baffle step alone", (t) => {
  const s = sysOf(cfg),
    on = { th: 0, eyeIn: s.lay.tweeterIn, distM: 1 };
  const sharp = hifiResponseAt(s, W, T, cfg, on, FREQS),
    round = hifiResponseAt(s, W, T, { ...cfg, roundoverIn: 1.5 }, on, FREQS);
  assert.ok(rippleDb(round, 2500, 8000) < rippleDb(sharp, 2500, 8000));
  for (let i = 0; i < FREQS.length && FREQS[i] < 600; i++)
    close(t, round[i].spl, sharp[i].spl, 0.15, `${FREQS[i].toFixed(0)} Hz`);
  // the edge ripple alone, through the crossover, as the page reports it
  const rSharp = rippleDb(hifiEdgeRipple(s, W, T, cfg, FREQS), 1000, 5000),
    rRound = rippleDb(hifiEdgeRipple(s, W, T, { ...cfg, roundoverIn: 1.5 }, FREQS), 1000, 5000);
  assert.ok(rRound < rSharp && rSharp > 1, `±${rRound.toFixed(2)} vs ±${rSharp.toFixed(2)} dB`);
});

test("hifi: a centred tweeter's horizontal map is symmetric; an offset one is not, and the seat sees the inside", (t) => {
  const s = sysOf(cfg);
  const row = (m: ReturnType<typeof hifiDispersionMap>, deg: number) =>
    m.rows[m.angles.indexOf(deg)];
  const centred = hifiDispersionMap(s, W, T, cfg, "h", 2);
  row(centred, 30).forEach((v, i) => close(t, v, row(centred, -30)[i], 1e-9, "±30° match"));
  const off = { ...cfg, tweeterOffsetIn: 1.5 };
  const offMap = hifiDispersionMap(s, W, T, off, "h", 2);
  const diff = Math.max(...row(offMap, 30).map((v, i) => Math.abs(v - row(offMap, -30)[i])));
  assert.ok(diff > 0.5, `±30° differ by up to ${diff.toFixed(2)} dB`);
  // the seat: in front of the pair, both speakers have it on their inside unless toed in past it
  const room = {
    speakerSpacingFt: 8,
    listeningSeat: { x: 0, y: 8 },
    toeInDeg: 10,
    earHeightIn: 38,
    standHeightIn: 24,
  };
  assert.strictEqual(listenerGeometry(-1, room).side, 1);
  assert.strictEqual(listenerGeometry(1, room).side, 1);
  assert.strictEqual(listenerGeometry(-1, { ...room, toeInDeg: 35 }).side, -1);
  assert.strictEqual(listenerGeometry(1, { ...room, toeInDeg: 35 }).side, -1);
  // the seat response changes with the offset's direction
  const geo = listenerGeometry(-1, room);
  const inward = hifiResponseAt(s, W, T, off, geo, FREQS),
    outward = hifiResponseAt(s, W, T, { ...cfg, tweeterOffsetIn: -1.5 }, geo, FREQS);
  assert.ok(inward.some((o, i) => Math.abs(o.spl - outward[i].spl) > 0.3));
});

test("hifi: the offset stays on the baffle, and the checks flag a too-deep roundover and an offset past the edge", (t) => {
  const s = sysOf(cfg);
  const max = tweeterOffsetMax(cfg, T);
  assert.strictEqual(max, Math.max(0, (cfg.dim.w - T.faceplate.w) / 2 - 0.25));
  // a roundover takes its radius off the flat baffle the faceplate needs
  const wide = { ...cfg, dim: { ...cfg.dim, w: 14 } };
  close(
    t,
    tweeterOffsetMax({ ...wide, roundoverIn: 1.5 }, T),
    tweeterOffsetMax(wide, T) - 1.5,
    1e-9,
  );
  assert.strictEqual(tweeterOffset({ ...cfg, tweeterOffsetIn: 99 }, T, s.lay), max);
  assert.strictEqual(tweeterOffset({ ...cfg, tweeterOffsetIn: -99 }, T, s.lay), -max);
  assert.strictEqual(tweeterOffset({ ...cfg, tweeterOffsetIn: 1 }, T, { onTop: true }), 0);
  const chips = (c: HifiConfig) => hifiChips(sysOf(c), W, T, c);
  assert.ok(!findChip(chips({ ...cfg, roundoverIn: 0.75 }), "hifiRoundover"));
  chipOf(chips({ ...cfg, roundoverIn: 1.5 }), "hifiRoundover", "warn");
  chipOf(chips({ ...cfg, wall: 0.5, roundoverIn: 0.75 }), "hifiRoundover", "warn");
  chipOf(chips({ ...cfg, tweeterOffsetIn: 99 }), "hifiTweeterOffsetEdge", "warn");
  assert.ok(!findChip(chips({ ...cfg, tweeterOffsetIn: max }), "hifiTweeterOffsetEdge"));
});

test("hifi design: the page's ripple figure follows the roundover, and a design still derives quickly", () => {
  const sharp = deriveHifiDesign(DEFAULT_HIFI);
  const t0 = performance.now();
  const round = deriveHifiDesign({ ...DEFAULT_HIFI, roundoverIn: 1.5 });
  const ms = performance.now() - t0;
  assert.ok(sharp.speakerModel && round.speakerModel);
  assert.ok(round.speakerModel.edgeRippleDb < sharp.speakerModel.edgeRippleDb);
  assert.strictEqual(round.speakerConfig.roundoverIn, 1.5);
  assert.ok(ms < 1500, `${ms.toFixed(0)} ms for a slider move`);
});

test("inches are written as a woodworker would", () => {
  assert.strictEqual(formatInches(0.75), "¾″");
  assert.strictEqual(formatInches(1.5), "1½″");
  assert.strictEqual(formatInches(2), "2″");
  assert.strictEqual(formatInches(1.3), "1.3″");
});

test("hifi: an offset tweeter's own path changes the crossover sum off axis, not just its edge ripple", () => {
  const wide = { ...cfg, dim: { ...cfg.dim, w: 14 }, tweeterOffsetIn: 3 },
    centred = { ...wide, tweeterOffsetIn: 0 };
  const s = sysOf(wide);
  // the crossover sum with each driver's edge ripple taken out
  const direct = (c: HifiConfig, th: number) => {
    const geo = { th, eyeIn: s.lay.tweeterIn, distM: 1, side: 1 as const };
    return (
      hifiResponseAt(s, W, T, c, geo, [c.xo])[0].spl -
      hifiEdgeRipple(s, W, T, c, [c.xo], geo)[0].spl
    );
  };
  // at 45° inside the tweeter is about 2″ nearer than the woofer: over 100° of phase at 2 kHz
  const at45 = direct(wide, Math.PI / 4) - direct(centred, Math.PI / 4);
  assert.ok(at45 < -1, `45° inside at the crossover, offset vs centred: ${at45.toFixed(2)} dB`);
  // on axis the DSP alignment still holds
  const on = direct(wide, 0) - direct(centred, 0);
  assert.ok(Math.abs(on) < 0.5, `on axis at the crossover: ${on.toFixed(2)} dB`);
});

test("hifi: the page's ripple figure counts the woofer below the crossover", () => {
  const s = sysOf(cfg),
    low = rippleDb(hifiEdgeRipple(s, W, T, { ...cfg, xo: 3000 }, FREQS), 1000, 2000),
    tweeterOnly = rippleDb(hifiEdgeRipple(s, W, T, { ...cfg, xo: 200 }, FREQS), 1000, 2000);
  assert.ok(
    Math.abs(low - tweeterOnly) > 0.05,
    `±${low.toFixed(2)} vs ±${tweeterOnly.toFixed(2)} dB`,
  );
});
