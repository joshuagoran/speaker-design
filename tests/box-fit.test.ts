// A box's width and height always hold its parts (lib/boxFit): on Hi-fi (lib/hifi/boxLayout hifiBoxMin) the minimum
// follows what the parts need, and a box a driver, vent, or wall change leaves too small is modeled and drawn at the
// fitted size.
import { describe, expect, test } from "vite-plus/test";
import { deriveHifiDesign } from "../src/lib/hifi/hifiDesign";
import { DEFAULT_HIFI } from "../src/lib/defaults";
import { HIFI_TWEETERS, HIFI_WOOFERS } from "../src/lib/data";
import { hifiBoxMin, roundPortSpots } from "../src/lib/hifi/boxLayout";
import { RADIATOR_PANEL, wooferFitsBaffle } from "../src/lib/hifi/hifi";
import { boxSliderMins, fitBox, upToStep } from "../src/lib/boxFit";
import { HIFI_BOX_LAYOUT, HIFI_BOX_SLIDERS } from "../src/constants/hifiLayout";
import { byIdOrThrow } from "../src/lib/tables";
import type { HifiDesignState } from "../src/types";

const design = (over: Partial<HifiDesignState>) => deriveHifiDesign({ ...DEFAULT_HIFI, ...over });
const byWoofer = (size: number) => {
  const w = HIFI_WOOFERS.find((x) => x.size === size && x.ts);
  if (!w) throw new Error(`no ${size}″ woofer`);
  return w;
};

describe("fitBox", () => {
  test("keeps a box that fits as it is, and raises only what is short", () => {
    const d = { w: 10, h: 20, d: 9 };
    expect(fitBox(d, { w: 9, h: 20 })).toBe(d);
    expect(fitBox(d, { w: 11, h: 12 })).toEqual({ w: 11, h: 20, d: 9 });
    expect(upToStep(7.31, { min: 6, step: 0.25 })).toBe(7.5);
    expect(upToStep(7.5, { min: 6, step: 0.25 })).toBe(7.5);
    expect(upToStep(3, { min: 6, step: 0.25 })).toBe(6);
  });

  test("a minimum or size that isn't a number leaves the box alone", () => {
    const d = { w: 10, h: 20, d: 9 };
    expect(fitBox(d, { w: NaN, h: NaN })).toBe(d);
    expect(fitBox(d, { w: NaN, h: 25 })).toEqual({ w: 10, h: 25, d: 9 });
    expect(upToStep(NaN, { min: 6, step: 0.25 })).toBe(6);
  });
});

describe("Hi-fi", () => {
  test("the minimum follows the woofer, the tweeter's faceplate and the vent", () => {
    const small = design({ woofer: byWoofer(5.25) }).boxMin,
      big = design({ woofer: byWoofer(8) }).boxMin;
    expect(big.w).toBeGreaterThan(small.w);
    expect(big.h).toBeGreaterThan(small.h);
    // a wide ribbon plate needs more baffle than the dome
    const ribbon = byIdOrThrow(HIFI_TWEETERS, "lt32", "tweeters");
    expect(design({ tweeter: ribbon }).boxMin.w).toBeGreaterThan(design({}).boxMin.w);
    // a slot along the bottom lifts the woofer
    const slot = design({ portSpec: { shape: "slot", n: 1, h: 3, len: 6 } }).boxMin.h;
    expect(slot).toBeGreaterThan(design({ boxType: "sealed" }).boxMin.h);
    // the woofer always fits the baffle at the minimum, so its warning can't fire
    for (const w of HIFI_WOOFERS)
      expect(wooferFitsBaffle(w, design({ woofer: w }).boxMin)).toBe(true);
  });

  test("the model and the 3D view see the fitted box", () => {
    const d = design({ boxDims: { w: 6, h: 9, d: 10 } });
    expect(d.speakerConfig.dim).toEqual({ ...d.boxMin, d: 10 });
    const need = hifiBoxMin({
      woofer: DEFAULT_HIFI.woofer,
      tweeter: d.tweeterWithWaveguide,
      onTop: false,
      cfg: d.speakerConfig,
      wall: d.wallThicknessIn,
      radiatorPanel: RADIATOR_PANEL,
    });
    expect(d.boxMin).toEqual(boxSliderMins(need, HIFI_BOX_SLIDERS));
    // a design that fits is left alone
    expect(design({}).speakerConfig.dim).toBe(DEFAULT_HIFI.boxDims);
  });

  test("a row of round ports needs its width across the baffle, as the layout places it", () => {
    const woofer = byIdOrThrow(HIFI_WOOFERS, "rs180", "woofers");
    const tweeter = byIdOrThrow(HIFI_TWEETERS, "rst28f", "tweeters");
    const port = { n: 2, dia: 3, len: 8 };
    const d = design({ woofer, tweeter, boxType: "vented", portSpec: port });
    const spots = roundPortSpots(port);
    const row =
      spots[1].x -
      spots[0].x +
      2 * (spots[0].r + HIFI_BOX_LAYOUT.portTubeWallIn) +
      2 * d.wallThicknessIn;
    expect(row).toBeGreaterThan(woofer.size + HIFI_BOX_LAYOUT.wooferWidthIn);
    expect(d.boxMin.w).toBeGreaterThanOrEqual(row);
    expect(d.speakerConfig.dim.w).toBeGreaterThanOrEqual(row);
  });
});
