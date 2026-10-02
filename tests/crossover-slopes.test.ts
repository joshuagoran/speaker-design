// PA crossover slopes: LR24 or LR48 at each crossover (issue #27). LR24 stays the default and reads as before.
import { test } from "vite-plus/test";
import assert from "node:assert";
import {
  linkwitzRileyLowpass,
  linkwitzRileyHighpass,
  linkwitzRiley24Lowpass,
  linkwitzRiley24Highpass,
  midSystem,
  hornResponse,
  subSystem,
  subThroughLowpass,
  subMusicOutputAt,
  nearestPoint,
} from "../src/lib/pa/calc";
import { paResponseAt } from "../src/lib/pa/dispersion";
import { evaluateDesign, optimizePaStack } from "../src/lib/pa/optimize";
import { DEFAULT_PA } from "../src/lib/defaults";
import type { MidSystemConfig, PaDesignConfig, PaStackGeometry } from "../src/types";
import { close, db } from "./helpers";

test("LR48 is -6 dB at the corner, 48 dB/oct beyond it, and its halves sum to 1", (t) => {
  close(t, db(linkwitzRileyLowpass(900, 900, 8)), -6.02, 0.01);
  close(t, db(linkwitzRileyHighpass(900, 900, 8)), -6.02, 0.01);
  close(t, db(linkwitzRileyLowpass(9000, 900, 8)), -160, 0.1);
  close(t, db(linkwitzRileyHighpass(90, 900, 8)), -160, 0.1);
  for (const f of [50, 200, 900, 2000, 9000])
    close(
      t,
      linkwitzRileyLowpass(f, 900, 8) + linkwitzRileyHighpass(f, 900, 8),
      1,
      1e-12,
      `${f} Hz`,
    );
});

test("order 4 is the LR24 the PA always used, to the bit", () => {
  for (const f of [30, 120, 900, 5000]) {
    assert.equal(linkwitzRileyLowpass(f, 900), linkwitzRiley24Lowpass(f, 900));
    assert.equal(linkwitzRileyHighpass(f, 900), linkwitzRiley24Highpass(f, 900));
  }
});

const mid = DEFAULT_PA.mid;
const cfg: MidSystemConfig = {
  midDims: { w: 15, h: 15, d: 15 },
  wall: 0.75,
  inset: 0.75,
  xoLo: 120,
  xoHi: 500,
  mAmpW: 400,
};
/** The mid's fall over the octave from 2x to 4x the high crossover, dB. */
const octaveFall = (c: MidSystemConfig) => {
  const curve = midSystem(mid, c).mdl!.curve; // DEFAULT_PA's mid has T/S
  return nearestPoint(curve, 2000).spl - nearestPoint(curve, 1000).spl;
};

test("mid: an LR48 high crossover falls ~48 dB/oct well above it, LR24 ~24", (t) => {
  const lr24 = octaveFall(cfg),
    lr48 = octaveFall({ ...cfg, xoHiOrder: 8 });
  assert.ok(lr24 < -21 && lr24 > -27, `LR24: ${lr24.toFixed(1)} dB/oct`);
  assert.ok(lr48 < -45 && lr48 > -51, `LR48: ${lr48.toFixed(1)} dB/oct`);
  // the driver's own response cancels: only the filters differ
  close(t, lr48 - lr24, db(257 / 65537) - db(17 / 257), 0.05);
});

test("mid: no order given is LR24, identical curve; the slope moves nothing at the corners", (t) => {
  const a = midSystem(mid, cfg).mdl!,
    b = midSystem(mid, { ...cfg, xoLoOrder: 4, xoHiOrder: 4 }).mdl!,
    c = midSystem(mid, { ...cfg, xoLoOrder: 8, xoHiOrder: 8 }).mdl!;
  assert.deepEqual(a.curve, b.curve);
  // LR48 differs from LR24 by the filters alone, which agree (-6 dB each) at both corners
  a.curve.forEach((o, i) => {
    const g4 = linkwitzRileyHighpass(o.f, cfg.xoLo) * linkwitzRileyLowpass(o.f, cfg.xoHi),
      g8 = linkwitzRileyHighpass(o.f, cfg.xoLo, 8) * linkwitzRileyLowpass(o.f, cfg.xoHi, 8);
    close(t, c.curve[i].spl - o.spl, db(g8 / g4), 1e-9, `${o.f} Hz`);
  });
  close(t, db(linkwitzRileyHighpass(120, 120, 8)), db(linkwitzRileyHighpass(120, 120)), 1e-12);
  // an octave below the low crossover LR48 is the steeper skirt
  assert.ok(nearestPoint(c.curve, 60).spl < nearestPoint(a.curve, 60).spl - 10);
});

test("horn: LR48 is -6 dB at the crossover and ~48 dB down an octave below", (t) => {
  const hf = DEFAULT_PA.cd.hf,
    hz = { ...DEFAULT_PA.horn.hf, lowHz: 0 }; // the crossover's skirt alone
  const a = hornResponse(hf, hz, 1000, 100)!,
    b = hornResponse(hf, hz, 1000, 100, 8)!;
  assert.deepEqual(hornResponse(hf, hz, 1000, 100, 4)!.curve, a.curve);
  const at = (h: typeof a, f: number) => nearestPoint(h.curve, f).spl - h.flat;
  close(t, at(b, 1000), at(a, 1000), 0.3);
  close(t, at(a, 500), db(linkwitzRiley24Highpass(nearestPoint(a.curve, 500).f, 1000)), 1e-9);
  assert.ok(at(b, 500) < -40 && at(a, 500) > -30, `${at(b, 500)} vs ${at(a, 500)}`);
});

test("sub: an LR48 lowpass is steeper above the crossover, the same at it", (t) => {
  const d = DEFAULT_PA;
  const s = subSystem(d.sub, d.mid, {
    subBox: d.cDim,
    midDims: d.mDim,
    wall: d.wall,
    inset: d.inset,
    portStyle: d.portStyle,
    cVent: d.cVent,
    hpf: d.hpf,
    hpType: d.hpType,
    ampW: d.ampW,
    portMax: d.portMax,
    layout: d.layout,
  });
  assert.ok(s.mdl && s.lim, "the default sub is modelled");
  const lp4 = subThroughLowpass(s.mdl, d.sub.ts, s.AMP_V, d.portMax, 120),
    lp8 = subThroughLowpass(s.mdl, d.sub.ts, s.AMP_V, d.portMax, 120, 8);
  assert.ok(nearestPoint(lp8, 240).spl < nearestPoint(lp4, 240).spl - 15);
  close(
    t,
    subMusicOutputAt(s.mdl, s.lim, s.AMP_V, 120, 8),
    subMusicOutputAt(s.mdl, s.lim, s.AMP_V, 120),
    0.5,
  );
});

const stack = (o: Partial<PaStackGeometry>): PaStackGeometry => ({
  sub: { zIn: 12, Sd: 1200 },
  mid: { zIn: 40, Sd: 530 },
  horn: { zIn: 55, covH: 90, covV: 40, wIn: 12, hIn: 7 },
  xoLo: 120,
  xoHi: 1000,
  ...o,
});
const freqs = [60, 120, 300, 800, 1000, 1400, 4000];
const below = { th: 0, eyeIn: 20, distM: 5 }; // off the horn axis: the crossover lobes show
const spl = (s: PaStackGeometry) => paResponseAt(s, below, freqs).map((p) => p.spl);

test("dispersion: each crossover takes its own order; `order` still sets both", () => {
  assert.deepEqual(spl(stack({})), spl(stack({ order: 4 })));
  assert.deepEqual(spl(stack({ order: 8 })), spl(stack({ orderLo: 8, orderHi: 8 })));
  assert.deepEqual(spl(stack({ orderLo: 8 })), spl(stack({ order: 4, orderLo: 8 })));
  assert.notDeepEqual(spl(stack({ orderLo: 8 })), spl(stack({ orderHi: 8 })));
  // on the horn axis a mixed stack still sums flat (both are time-aligned Linkwitz-Riley pairs)
  for (const p of paResponseAt(
    stack({ orderLo: 8, orderHi: 4 }),
    { th: 0, eyeIn: 55, distM: 5 },
    [60, 120, 400, 1000, 4000],
  ))
    assert.ok(Math.abs(p.spl) < 1.5, `${p.f} Hz: ${p.spl.toFixed(2)} dB`);
});

/** The default design as the planner snapshots it. */
const { midSize: _m, plywoodSheetKind: _k, boxSetCount: _n, ...rest } = DEFAULT_PA;
const defaultConfig: PaDesignConfig = {
  ...rest,
  format: rest.format.id,
  cabinet: rest.cabinet.id,
  sub: rest.sub.id,
  mid: rest.mid.id,
  midBox: rest.midBox.id,
  cd: rest.cd.id,
  horn: rest.horn.id,
};

test("evaluate: a saved design without the orders reads as LR24", () => {
  const { xoLoOrder: _lo, xoHiOrder: _hi, ...older } = defaultConfig;
  // boundary: an older save, which lacks the two fields the type now has
  const a = evaluateDesign(older as PaDesignConfig),
    b = evaluateDesign(defaultConfig);
  assert.deepEqual(a, b);
});

test("optimizer: every card keeps the design's LR48 slopes", (t) => {
  const cur = { ...defaultConfig, xoLoOrder: 8, xoHiOrder: 8 } as const;
  const out = optimizePaStack({
    cur,
    room: 1000,
    maxLb: 150,
    budget: 2000,
    goals: ["cheaper"],
    locks: { sub: true, mid: true, cd: true, horn: true },
  });
  assert.ok(out.cards.length >= 1, JSON.stringify(out.nearMiss && out.nearMiss.blocking));
  for (const k of out.cards) {
    assert.equal(k.config.xoLoOrder, 8, k.label);
    assert.equal(k.config.xoHiOrder, 8, k.label);
    // the card's numbers are the LR48 design's own
    close(t, evaluateDesign(k.config)!.out, k.metrics.out, 1e-9, k.label);
  }
});
