// Coaxial drivers in the Hi-fi engine (lib/data coaxParts): the parts, the coincident layout and what follows from it
// (path lengths, offset, box size, cutouts), the weight and price counted once, and the optimizer offering coaxials only
// to a coaxial design. The parity with the Fills model is in hifi-coax-parity.test.ts, the 3D view in
// hifi-scene.test.ts.
import { describe, expect, test } from "vite-plus/test";
import {
  FILL_OPTIONS,
  HIFI_COAXES,
  HIFI_COAX_TWEETERS,
  HIFI_COAX_WOOFERS,
  HIFI_TWEETERS,
  HIFI_WOOFERS,
  coaxParts,
} from "../src/lib/data";
import { driverLayout, isCoax } from "../src/lib/speaker/twoWay";
import { hifiBoxMin } from "../src/lib/build/boxLayout";
import { DEFAULT_HIFI } from "../src/lib/defaults";
import { HIFI_BOX_LAYOUT } from "../src/constants/hifiLayout";
import { COAX_GAP, COAXIAL_TWEETER_TYPE } from "../src/constants/coax";
import type { CoaxParts, HifiTweeter } from "../src/types";

/** A coaxial with its HF section, by id. */
function coax(id: string): CoaxParts & { tweeter: HifiTweeter } {
  const c = HIFI_COAXES.find((p) => p.woofer.id === id);
  if (!c?.tweeter) throw new Error(`${id}: no coaxial with an HF section`);
  return { ...c, tweeter: c.tweeter };
}
const B10 = coax("bc10cxn64");

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
});
