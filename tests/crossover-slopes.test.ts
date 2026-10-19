// PA crossover slopes: LR24 or LR48 at each crossover (issue #27). LR24 reads as before.
import { test } from "vite-plus/test";
import assert from "node:assert";
import {
  highpassGain,
  linkwitzRileyLowpass,
  linkwitzRileyHighpass,
  midSystem,
  hornResponse,
  nearestPoint,
} from "../src/lib/pa/calc";
import { DEFAULT_PA } from "../src/lib/defaults";
import type { CrossoverOrder, MidSystemConfig } from "../src/types";
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
    assert.equal(linkwitzRileyLowpass(f, 900, 4), 1 / (1 + Math.pow(f / 900, 4)));
    assert.equal(linkwitzRileyHighpass(f, 900, 4), highpassGain(f, 900, "LR24"));
  }
});

const mid = DEFAULT_PA.mid;
const cfg: MidSystemConfig = {
  midDims: { w: 15, h: 15, d: 15 },
  wall: 0.75,
  inset: 0.75,
  xoLo: 120,
  xoHi: 500,
  xoLoOrder: 4,
  xoHiOrder: 4,
  mAmpW: 400,
};
/** The mid's sealed-box model. */
const midModel = (c: MidSystemConfig) => {
  const m = midSystem(mid, c).mdl;
  assert.ok(m, "DEFAULT_PA's mid has T/S");
  return m;
};
/** The mid's fall over the octave from 2x to 4x the high crossover, dB. */
const octaveFall = (c: MidSystemConfig) => {
  const curve = midModel(c).curve;
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

test("mid: the slope moves nothing at the corners", (t) => {
  const a = midModel(cfg),
    c = midModel({ ...cfg, xoLoOrder: 8, xoHiOrder: 8 });
  // LR48 differs from LR24 by the filters alone, which agree (-6 dB each) at both corners
  a.curve.forEach((o, i) => {
    const g4 = linkwitzRileyHighpass(o.f, cfg.xoLo, 4) * linkwitzRileyLowpass(o.f, cfg.xoHi, 4),
      g8 = linkwitzRileyHighpass(o.f, cfg.xoLo, 8) * linkwitzRileyLowpass(o.f, cfg.xoHi, 8);
    close(t, c.curve[i].spl - o.spl, db(g8 / g4), 1e-9, `${o.f} Hz`);
  });
  close(t, db(linkwitzRileyHighpass(120, 120, 8)), db(linkwitzRileyHighpass(120, 120, 4)), 1e-12);
  // an octave below the low crossover LR48 is the steeper skirt
  assert.ok(nearestPoint(c.curve, 60).spl < nearestPoint(a.curve, 60).spl - 10);
});

test("horn: LR48 is -6 dB at the crossover and ~48 dB down an octave below", (t) => {
  const hf = DEFAULT_PA.cd.hf,
    hz = { ...DEFAULT_PA.horn.hf, lowHz: 0 }; // the crossover's skirt alone
  const horn = (order: CrossoverOrder) => {
    const h = hornResponse(hf, hz, 1000, 100, order);
    assert.ok(h, "DEFAULT_PA's driver has a spec");
    return h;
  };
  const a = horn(4),
    b = horn(8);
  const at = (h: typeof a, f: number) => nearestPoint(h.curve, f).spl - h.flat;
  close(t, at(b, 1000), at(a, 1000), 0.3);
  close(t, at(a, 500), db(linkwitzRileyHighpass(nearestPoint(a.curve, 500).f, 1000, 4)), 1e-9);
  assert.ok(at(b, 500) < -40 && at(a, 500) > -30, `${at(b, 500)} vs ${at(a, 500)}`);
});
