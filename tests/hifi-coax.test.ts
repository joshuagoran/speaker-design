// Coaxial drivers in the Hi-fi engine (lib/data coaxParts): the parts, the coincident layout and what follows from it
// (path lengths, offset, box size, cutouts), the weight and price counted once, and the optimizer offering coaxials only
// to a coaxial design. The parity with the Fills model is in hifi-coax-parity.test.ts, the 3D view in
// hifi-scene.test.ts.
import { describe, expect, test } from "vite-plus/test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { HifiFront } from "../src/components/drawings/HifiFront";
import {
  FILL_OPTIONS,
  HIFI_COAXES,
  HIFI_COAX_TWEETERS,
  HIFI_COAX_WOOFERS,
  HIFI_TWEETERS,
  HIFI_WOOFERS,
  coaxParts,
  ownGuideCfg,
} from "../src/lib/data";
import {
  boxWeightLb,
  driverLayout,
  hifiChips,
  hifiResponseAt,
  hifiSystem,
  hifiWeightLb,
  isCoax,
  tweeterOffset,
} from "../src/lib/hifi/hifi";
import { hifiBoxMin } from "../src/lib/hifi/boxLayout";
import { hifiSearchSpace, optimizeHifiSpeaker } from "../src/lib/hifi/optimize";
import { CHANGE_NAMES } from "../src/constants/optimizerText";
import { deriveHifiDesign } from "../src/pages/hifi/hifiDesign";
import { DEFAULT_HIFI } from "../src/lib/defaults";
import { HIFI_BOX_LAYOUT } from "../src/constants/hifiLayout";
import { HIFI_COAX_DRIVE } from "../src/constants/hifiEngine";
import { COAX_GAP, COAXIAL_TWEETER_TYPE } from "../src/constants/coax";
import { byIdOrThrow } from "../src/lib/tables";
import { chipOf } from "./helpers";
import type {
  CoaxParts,
  HifiDesignState,
  HifiOptimizerCurrent,
  HifiTweeter,
  ListenerGeometry,
} from "../src/types";

/** A coaxial with its HF section, by id. */
function coax(id: string): CoaxParts & { tweeter: HifiTweeter } {
  const c = HIFI_COAXES.find((p) => p.woofer.id === id);
  if (!c?.tweeter) throw new Error(`${id}: no coaxial with an HF section`);
  return { ...c, tweeter: c.tweeter };
}
const B10 = coax("bc10cxn64");

/** The default Hi-fi design on a coaxial, passive, crossed at its HF's minimum. */
function coaxState(c = B10, over: Partial<HifiDesignState> = {}): HifiDesignState {
  return {
    ...DEFAULT_HIFI,
    woofer: c.woofer,
    tweeter: c.tweeter,
    drive: HIFI_COAX_DRIVE,
    crossoverHz: c.tweeter.hf.minXo ?? DEFAULT_HIFI.crossoverHz,
    boxDims: { w: 12, h: 16, d: 11 },
    ...over,
  };
}

describe("coaxParts", () => {
  test("every fill coaxial becomes a woofer and, where published, a coincident HF part, under its own id", () => {
    expect(HIFI_COAXES).toHaveLength(FILL_OPTIONS.length);
    for (const d of FILL_OPTIONS) {
      const { woofer, tweeter, gaps } = coaxParts(d);
      expect(woofer.id).toBe(d.id);
      expect(woofer.ts.Fs).toBe(d.ts.Fs);
      expect(woofer.ts.Xmax).toBe(d.ts.Xmax);
      expect(woofer.ts.sens).toBe(d.lfSens);
      expect(woofer.price).toBe(d.price);
      expect(woofer.lb).toBe(d.lb);
      if (!d.hf) {
        // not dropped: the woofer alone, the gap marked
        expect(tweeter).toBeNull();
        expect(gaps).toEqual([COAX_GAP.hf]);
        continue;
      }
      expect(tweeter).not.toBeNull();
      if (!tweeter) continue;
      expect(tweeter.id).toBe(d.id);
      expect(isCoax(woofer, tweeter)).toBe(true);
      expect(tweeter.type).toBe(COAXIAL_TWEETER_TYPE);
      expect(tweeter.hf).toMatchObject({
        sens: d.hf.sens,
        aes: d.hf.aes,
        imp: d.hf.imp,
        minXo: d.hf.xo,
      });
      // counted once, on the woofer
      expect(tweeter.price).toBe(0);
      expect(tweeter.lb).toBe(0);
      // the cone is the HF's conical waveguide, at the published coverage
      const cone = (2 * Math.sqrt(d.ts.Sd / Math.PI)) / 2.54;
      if (d.hf.cov != null)
        expect(tweeter.ownGuide).toEqual({
          name: d.name,
          covH: d.hf.cov,
          covV: d.hf.cov,
          w: cone,
          h: cone,
        });
      else expect(tweeter.ownGuide).toBeUndefined();
      expect(gaps).toEqual([
        ...(d.hf.xo == null ? [COAX_GAP.hfXo] : []),
        ...(d.hf.cov == null ? [COAX_GAP.hfCov] : []),
      ]);
    }
  });

  test("no Hi-fi woofer or tweeter shares an id with another part, so only a coaxial is a coaxial", () => {
    const ids = [...HIFI_WOOFERS, ...HIFI_TWEETERS].map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of HIFI_COAX_WOOFERS) expect(ids).not.toContain(c.id);
    for (const w of HIFI_WOOFERS)
      for (const t of HIFI_TWEETERS) {
        expect(isCoax(w, t)).toBe(false);
        expect(driverLayout(w, t, DEFAULT_HIFI.boxDims, false).coax).toBeUndefined();
      }
    // and a coaxial's woofer with another coaxial's HF is two drivers
    expect(isCoax(HIFI_COAX_WOOFERS[0], HIFI_COAX_TWEETERS[1])).toBe(false);
  });
});

describe("the coincident layout", () => {
  test("the HF sits at the woofer's center, the woofer at the top of the baffle; the box needs no room for a tweeter", () => {
    const dim = { w: 12, h: 16, d: 11 };
    const lay = driverLayout(B10.woofer, B10.tweeter, dim, false);
    expect(lay).toEqual({
      tweeterIn: dim.h - HIFI_BOX_LAYOUT.topMarginIn - B10.woofer.size / 2,
      wooferIn: dim.h - HIFI_BOX_LAYOUT.topMarginIn - B10.woofer.size / 2,
      spacingIn: 0,
      coax: true,
    });
    const need = hifiBoxMin({
      woofer: B10.woofer,
      tweeter: B10.tweeter,
      onTop: false,
      cfg: { box: "sealed", port: DEFAULT_HIFI.portSpec },
      wall: 0.75,
      radiatorPanel: "back",
    });
    const L = HIFI_BOX_LAYOUT;
    expect(need).toEqual({
      w: B10.woofer.size + L.wooferWidthIn,
      h: L.topMarginIn + B10.woofer.size + L.wooferFloorIn,
    });
  });

  test("the woofer and HF paths are the same length to any listener: the alignment distance changes nothing", () => {
    const state = coaxState();
    const d = deriveHifiDesign(state);
    const sys = d.speakerModel?.speakerSystem;
    if (!sys) throw new Error("the coaxial can't be modeled");
    const at = (geo: ListenerGeometry) =>
      hifiResponseAt(sys, B10.woofer, d.tweeterWithWaveguide, d.speakerConfig, geo).map(
        (o) => o.spl,
      );
    // near, above the axis and off to the side (the near-field case where a stacked pair lobes)
    const geo: ListenerGeometry = { th: 0.5, eyeIn: sys.lay.tweeterIn + 8, distM: 0.5, side: 1 };
    const a = at({ ...geo, alignM: 0.5 }),
      b = at({ ...geo, alignM: 4 });
    a.forEach((x, i) => expect(x).toBeCloseTo(b[i], 9));
    // a stacked pair's sum does change with it
    const stacked = deriveHifiDesign(DEFAULT_HIFI);
    const s = stacked.speakerModel?.speakerSystem;
    if (!s) throw new Error("the default design can't be modeled");
    const st = (alignM: number) =>
      hifiResponseAt(s, DEFAULT_HIFI.woofer, stacked.tweeterWithWaveguide, stacked.speakerConfig, {
        ...geo,
        eyeIn: s.lay.tweeterIn + 8,
        alignM,
      });
    const sa = st(0.5),
      sb = st(4);
    expect(Math.max(...sa.map((o, i) => Math.abs(o.spl - sb[i].spl)))).toBeGreaterThan(0.5);
  });

  test("a tweeter offset is ignored, with its chip", () => {
    const d = deriveHifiDesign(coaxState(B10, { tweeterOffsetIn: 1.5 }));
    const sys = d.speakerModel?.speakerSystem;
    if (!sys) throw new Error("the coaxial can't be modeled");
    expect(tweeterOffset(d.speakerConfig, d.tweeterWithWaveguide, sys.lay)).toBe(0);
    chipOf(
      hifiChips(sys, B10.woofer, d.tweeterWithWaveguide, d.speakerConfig),
      "hifiTweeterOffsetIgnored",
      "warn",
    );
    // the same design with the offset gives the same response: the HF stays at the woofer's center
    const centered = deriveHifiDesign(coaxState());
    expect(centered.speakerModel?.onAxisResponse).toEqual(d.speakerModel?.onAxisResponse);
  });

  test("the cone's coverage is the HF's: the design's waveguide is the coaxial's own", () => {
    const d = deriveHifiDesign(coaxState());
    expect(d.waveguideSpec).toEqual({ ...B10.tweeter.ownGuide, freestanding: false });
    expect(d.speakerConfig.drive).toBe(HIFI_COAX_DRIVE);
  });
});

describe("the front drawing (the optimizer cards')", () => {
  /** The drawing's circles' centers and radii, and how many rectangles it has. */
  function front(state: HifiDesignState) {
    const d = deriveHifiDesign(state);
    const sys = d.speakerModel?.speakerSystem;
    if (!sys) throw new Error("the design can't be modeled");
    const svg = renderToString(
      createElement(HifiFront, {
        dim: d.speakerConfig.dim,
        wall: d.wallThicknessIn,
        w: state.woofer,
        t: state.tweeter,
        lay: sys.lay,
        vented: false,
        port: state.portSpec,
        pr: null,
        guide: d.waveguideSpec,
        small: true,
      }),
    );
    const circles = [...svg.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/g)].map(
      ([, cx, cy, r]) => ({ cx: +cx, cy: +cy, r: +r }),
    );
    return { circles, rects: (svg.match(/<rect /g) ?? []).length };
  }

  test("a coaxial: the woofer with its HF's horn and plug at its center, no tweeter plate", () => {
    const { circles, rects } = front(coaxState(B10, { boxType: "sealed" }));
    expect(circles).toHaveLength(3);
    for (const c of circles.slice(1)) {
      expect(c.cx).toBe(circles[0].cx);
      expect(c.cy).toBe(circles[0].cy);
      expect(c.r).toBeLessThan(circles[0].r);
    }
    expect(rects).toBe(1); // the box
    // a stacked design draws the tweeter's plate and its center apart from the woofer
    const stacked = front({ ...DEFAULT_HIFI, boxType: "sealed" });
    expect(stacked.rects).toBe(2);
    expect(stacked.circles[0].cy).not.toBe(stacked.circles[1].cy);
  });
});

describe("weight and price count the coaxial once", () => {
  test("the pair's cost is two coaxials; the weight is the box, one coaxial and a pound of hardware", () => {
    const d = deriveHifiDesign(coaxState());
    expect(d.pairCostUsd).toBe(2 * (B10.woofer.price ?? 0));
    const sys = d.speakerModel?.speakerSystem;
    if (!sys) throw new Error("the coaxial can't be modeled");
    const cfg = d.speakerConfig;
    expect(sys.lb).toBeCloseTo(
      boxWeightLb(cfg.dim, d.wallThicknessIn, cfg.mat) + B10.woofer.lb + 1,
      9,
    );
    expect(hifiWeightLb(B10.woofer, B10.tweeter, cfg, null)).toBe(sys.lb);
    // the same coaxial's woofer with a dome tweeter carries that tweeter's weight too
    const dome = DEFAULT_HIFI.tweeter;
    expect(hifiWeightLb(B10.woofer, dome, cfg, null)).toBeCloseTo(sys.lb + dome.lb, 9);
  });
});

describe("the optimizer offers coaxials only to a coaxial design", () => {
  const nonCoax: HifiOptimizerCurrent = {
    woofer: DEFAULT_HIFI.woofer.id,
    tweeter: DEFAULT_HIFI.tweeter.id,
    box: "vented",
    dim: DEFAULT_HIFI.boxDims,
    wall: 0.75,
    port: DEFAULT_HIFI.portSpec,
    xo: DEFAULT_HIFI.crossoverHz,
    order: 4,
    wAmpW: 100,
    tAmpW: 50,
    guide: null,
  };
  const coaxCur: HifiOptimizerCurrent = {
    ...nonCoax,
    woofer: B10.woofer.id,
    tweeter: B10.tweeter.id,
    dim: { w: 12, h: 16, d: 11 },
    port: { n: 1, dia: 3, len: 4 },
    xo: B10.tweeter.hf.minXo ?? DEFAULT_HIFI.crossoverHz,
    drive: HIFI_COAX_DRIVE,
    guide: ownGuideCfg(B10.tweeter),
  };
  const coaxIds = new Set(HIFI_COAX_WOOFERS.map((w) => w.id));
  const input = { woofers: HIFI_WOOFERS, tweeters: HIFI_TWEETERS };

  test("a design of two drivers searches the woofers and tweeters offered, no coaxial", () => {
    const { space } = hifiSearchSpace({ ...input, cur: nonCoax }, { withGrid: false });
    if (!space) throw new Error("no search space");
    expect(space.coax).toBe(false);
    expect(space.wList.every((w) => !coaxIds.has(w.id))).toBe(true);
    expect(space.tList.every((t) => t.type !== COAXIAL_TWEETER_TYPE)).toBe(true);
  });

  test("a coaxial design searches the priced coaxials with an HF section, each with its own HF", () => {
    const { space } = hifiSearchSpace({ ...input, cur: coaxCur }, { withGrid: false });
    if (!space) throw new Error("no search space");
    expect(space.coax).toBe(true);
    const expected = HIFI_COAXES.filter((c) => c.tweeter && c.woofer.price != null).map(
      (c) => c.woofer.id,
    );
    expect(space.wList.map((w) => w.id)).toEqual(expected);
    expect(space.tList.map((t) => t.id)).toEqual(expected);
    // a lock on either keeps yours
    const locked = hifiSearchSpace(
      { ...input, cur: coaxCur, locks: { tweeter: true } },
      { withGrid: false },
    ).space;
    expect(locked?.wList.map((w) => w.id)).toEqual([B10.woofer.id]);
    expect(locked?.tList.map((t) => t.id)).toEqual([B10.tweeter.id]);
  });

  test("its cards are coaxials, each on its own HF, priced once", () => {
    const res = optimizeHifiSpeaker({ ...input, cur: coaxCur, goals: ["cheaper"], seatM: 2.6 });
    expect(res.cur).not.toBeNull();
    expect(res.cards.length).toBeGreaterThan(0);
    for (const k of res.cards) {
      expect(k.woofer).toBe(k.tweeter);
      expect(coaxIds.has(k.woofer)).toBe(true);
      expect(k.lay.coax).toBe(true);
      const w = byIdOrThrow(HIFI_COAX_WOOFERS, k.woofer, "coaxials");
      expect(k.metrics.price).toBe(2 * (w.price ?? 0));
      // another coaxial is one change, not a woofer and a tweeter
      expect(k.changed).not.toContain(CHANGE_NAMES.tweeter);
    }
    // and the design itself models with the coincident layout
    expect(hifiSystem(B10.woofer, B10.tweeter, coaxCur)?.lay.coax).toBe(true);
  });
});
