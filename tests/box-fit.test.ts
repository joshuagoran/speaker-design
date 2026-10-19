// A box's width and height always hold its parts (lib/build/boxFit): on Hi-fi (lib/build/boxLayout hifiBoxMin) the minimum
// follows what the parts need, and a box a driver, vent, or wall change leaves too small is modeled and drawn at the
// fitted size.
import { describe, expect, test } from "vite-plus/test";
import { fitBox, upToStep } from "../src/lib/build/boxFit";
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
