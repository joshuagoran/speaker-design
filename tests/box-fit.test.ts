// A box's width and height always hold its parts (lib/boxFit): on Hi-fi (lib/hifi/boxLayout hifiBoxMin) and PA (the
// sub's driver beside its vents, lib/pa/chips subBoxMin; the mid's driver, lib/pa/calc midBoxMin) the sliders start at
// what the parts need, and a box a driver, vent or wall change or a loaded save leaves too small is shown, modeled,
// drawn and saved at the fitted size. The size the user set is kept, so switching back to a smaller part brings it back.
import { describe, expect, test } from "vite-plus/test";
import assert from "node:assert";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { useHifiPlanner, type HifiPlanner } from "../src/pages/hifi/useHifiPlanner";
import { usePaDesign, type PaDesign } from "../src/pages/pa-stack/hooks/usePaDesign";
import { deriveHifiDesign } from "../src/pages/hifi/hifiDesign";
import { DEFAULT_HIFI, DEFAULT_PA } from "../src/lib/defaults";
import { savedVentSpec } from "../src/pages/pa-stack/hooks/usePaDesign";
import { HIFI_TWEETERS, HIFI_WOOFERS, midDriversOfSize } from "../src/lib/data";
import { hifiBoxMin, roundPortSpots } from "../src/lib/hifi/boxLayout";
import { RADIATOR_PANEL, wooferFitsBaffle } from "../src/lib/hifi/hifi";
import { boxSliderMins, fitBox, upToStep } from "../src/lib/boxFit";
import { midBaffleNeedIn } from "../src/lib/pa/calc";
import { driverClearance, subDriverClearanceNeededIn } from "../src/lib/pa/chips";
import { HIFI_BOX_LAYOUT, HIFI_BOX_SLIDERS } from "../src/constants/hifiLayout";
import { byIdOrThrow } from "../src/lib/tables";
import type { HifiDesignState } from "../src/types";

/** Renders `use` once per step, each step's state updates rendering it again for the next. */
function runSteps<T>(use: () => T, steps: ((hook: T) => void)[]) {
  let done = 0;
  function Probe() {
    const hook = use();
    if (done < steps.length) steps[done++](hook);
    return null;
  }
  renderToString(createElement(Probe));
  assert.equal(done, steps.length, "every step ran");
}

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

  test("a part that needs a bigger box raises it only while chosen: switching back brings the box back", () => {
    const ribbon = byIdOrThrow(HIFI_TWEETERS, "lt32", "tweeters");
    runSteps<HifiPlanner>(useHifiPlanner, [
      (h) => {
        expect(h.boxDims).toEqual(DEFAULT_HIFI.boxDims);
        h.setTweeter(ribbon);
      },
      (h) => {
        expect(h.boxDims.h).toBeGreaterThan(DEFAULT_HIFI.boxDims.h);
        expect(h.boxDims).toEqual(h.speakerConfig.dim);
        h.setTweeter(DEFAULT_HIFI.tweeter);
      },
      (h) => {
        expect(h.boxDims).toEqual(DEFAULT_HIFI.boxDims);
        h.setWoofer(byWoofer(8));
      },
      (h) => {
        expect(h.boxDims.h).toBeGreaterThan(DEFAULT_HIFI.boxDims.h);
        // a slider sets a new size from the one it shows: the width moves, the height keeps the woofer's need
        h.setBoxDims((p) => ({ ...p, w: 11 }));
      },
      (h) => {
        expect(h.boxDims.w).toBe(11);
        expect(h.boxDims.h).toBe(h.boxMin.h);
        h.setWoofer(DEFAULT_HIFI.woofer);
      },
      (h) => expect(h.boxDims).toEqual({ ...DEFAULT_HIFI.boxDims, w: 11 }),
    ]);
  });

  test("a too-small save loads, shows and saves at the fitted size", () => {
    runSteps<HifiPlanner>(useHifiPlanner, [
      (h) => h.restoreSavedConfig({ ...h.savedConfigSnapshot(), dim: { w: 6, h: 9, d: 7 } }),
      (h) => {
        expect(h.boxDims).toEqual({ ...h.boxMin, d: 7 });
        expect(h.speakerConfig.dim).toEqual({ ...h.boxMin, d: 7 });
        expect(h.savedConfigSnapshot().dim).toEqual({ ...h.boxMin, d: 7 });
      },
    ]);
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

describe("PA", () => {
  test("the minimum follows the drivers and the vents", () => {
    runSteps<PaDesign>(
      () => usePaDesign({ dispersionPlane: "h" }),
      [
        (h) => {
          expect(h.midBoxMin.w).toBeGreaterThanOrEqual(midBaffleNeedIn(h.midDriver.size));
          const need = subDriverClearanceNeededIn(h.subDriver.size);
          const { clearW, clearH } = driverClearance(
            { ...h.subBoxMin, d: 1 },
            h.portStyle,
            h.subVentSpec,
            h.wallThicknessIn,
          );
          expect(Math.min(clearW, clearH)).toBeGreaterThanOrEqual(need - 1e-9);
          h.setPortStyle("vslots");
        },
        (h) => {
          const { clearW } = driverClearance(
            { ...h.subBoxMin, d: 1 },
            h.portStyle,
            h.subVentSpec,
            h.wallThicknessIn,
          );
          expect(clearW).toBeGreaterThanOrEqual(
            subDriverClearanceNeededIn(h.subDriver.size) - 1e-9,
          );
        },
      ],
    );
  });

  test("a vent that needs a wider box raises it only while chosen", () => {
    runSteps<PaDesign>(
      () => usePaDesign({ dispersionPlane: "h" }),
      [
        (h) => {
          expect(h.subBoxDims).toEqual(DEFAULT_PA.cDim);
          h.setPortStyle("vslots");
        },
        (h) => {
          expect(h.subBoxDims.w).toBeGreaterThan(DEFAULT_PA.cDim.w);
          h.setPortStyle(DEFAULT_PA.portStyle);
        },
        (h) => expect(h.subBoxDims).toEqual(DEFAULT_PA.cDim),
      ],
    );
  });

  test("a save from before a vent field loads with the default's, and its box minimum is a number", () => {
    const { throat: _throat, ...old } = DEFAULT_PA.cVent;
    expect(savedVentSpec(old)).toEqual(DEFAULT_PA.cVent);
    runSteps<PaDesign>(
      () => usePaDesign({ dispersionPlane: "h" }),
      [
        (h) => {
          // an older save, as the store hands it back: its vent without the field
          const legacy: Record<string, unknown> = {
            ...h.snapshot(),
            portStyle: "vslots",
            cVent: old,
          };
          h.restore(legacy);
        },
        (h) => {
          expect(Number.isFinite(h.subBoxMin.w)).toBe(true);
          expect(h.subVentSpec.throat).toBe(DEFAULT_PA.cVent.throat);
        },
      ],
    );
  });

  test("the stored sizes fit on a mid driver change and on loading a too-small save", () => {
    const [mid15] = midDriversOfSize(15);
    runSteps<PaDesign>(
      () => usePaDesign({ dispersionPlane: "h" }),
      [
        (h) => {
          h.setMidBoxDims({ w: 14, h: 14, d: 10 });
        },
        (h) => {
          expect(h.midBoxDims).toEqual({ w: 14, h: 14, d: 10 });
          h.setMidDriver(mid15);
        },
        (h) => {
          expect(h.midBoxDims.w).toBeGreaterThanOrEqual(midBaffleNeedIn(15));
          expect(h.midBoxDims).toEqual({ ...h.midBoxMin, d: 10 });
          const snap = h.snapshot();
          h.restore({ ...snap, cDim: { w: 18, h: 18, d: 20 }, mDim: { w: 10, h: 10, d: 10 } });
        },
        (h) => {
          expect(h.subBoxDims).toEqual({ ...h.subBoxMin, d: 20 });
          expect(h.midBoxDims).toEqual({ ...h.midBoxMin, d: 10 });
          const snap = h.snapshot();
          expect(snap.cDim).toEqual(h.subBoxDims);
          expect(snap.mDim).toEqual(h.midBoxDims);
          // the model sees the fitted boxes
          expect(h.subWithBox.box).toEqual(h.subBoxDims);
        },
      ],
    );
  });
});
