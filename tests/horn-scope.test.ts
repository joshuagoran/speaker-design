// The small Hi-fi-only waveguides (horns.ts entries with `scope: "hifi"`): valid catalog data, listed by the Hi-fi
// waveguide picker (HIFI_WAVEGUIDES) and left out of every PA list (HORN_OPTIONS: the PA picker, both optimizers and
// the driver comparison).
import { describe, expect, test } from "vite-plus/test";
import { HORN_RAW } from "../src/data/catalog/horns";
import { HORN_MESHES } from "../src/data/meshes";
import { HIFI_WAVEGUIDES, HORN_OPTIONS, sortedByName, waveguideSpecOf } from "../src/lib/data";
import { compareDrivers } from "../src/lib/pa/compareDrivers";
import { paSearchDesign } from "../src/lib/pa/optimize";
import { paCurrent } from "./optimizer-dump-cases";

const hifiOnly = HORN_RAW.filter((h) => h.scope === "hifi");
const hifiIds = new Set(hifiOnly.map((h) => h.id));

describe("the small Hi-fi-only waveguides", () => {
  test("there are several, each a priced 1-inch waveguide with a 4–7.5 in mouth and its coverage specs", () => {
    expect(hifiOnly.length).toBeGreaterThanOrEqual(3);
    for (const h of hifiOnly) {
      expect(h.exit, h.id).toBe(1);
      const mouth = Math.max(h.size.w, h.size.h);
      expect(mouth, h.id).toBeGreaterThanOrEqual(4);
      expect(mouth, h.id).toBeLessThanOrEqual(7.5);
      expect(h.size.d, h.id).toBeGreaterThan(0);
      expect(h.size.d, h.id).toBeLessThan(mouth);
      expect(h.lb, h.id).toBeGreaterThan(0);
      if (!h.hf) throw new Error(`${h.id}: no coverage specs`);
      expect(h.hf.covH, h.id).toBeGreaterThanOrEqual(60);
      expect(h.hf.covH, h.id).toBeLessThanOrEqual(100);
      expect(h.hf.covV ?? 0, h.id).toBeGreaterThan(0);
      // a small mouth: its limit sits above the PA's 900 Hz–1 kHz crossovers, and the maker's minimum (when it gives
      // one) at or above it
      expect(h.hf.lowHz, h.id).toBeGreaterThanOrEqual(1000);
      if (h.hf.minXo !== null) expect(h.hf.minXo, h.id).toBeGreaterThanOrEqual(h.hf.lowHz);
      // a US vendor's price, and the month it was read
      expect(h.price ?? 0, h.id).toBeGreaterThan(0);
      expect(h.src, h.id).toMatch(/Parts Express|Solen|US Speaker|usspeaker/i);
      expect(h.src, h.id).toMatch(/20\d\d/);
      expect(h.note.length, h.id).toBeGreaterThan(0);
    }
  });

  test("each is drawn by the generic flare: no mesh, profile or throat adapter; factory black", () => {
    for (const h of hifiOnly) {
      expect(HORN_MESHES[h.id], h.id).toBeUndefined();
      expect(h.profile, h.id).toBeUndefined();
      expect(h.adapter, h.id).toBeUndefined();
      expect(h.rect, h.id).toBeUndefined();
      expect(h.finish, h.id).toBe("black");
    }
  });

  test("ids are unique across the table", () => {
    const ids = HORN_RAW.map((h) => h.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("the scope flag", () => {
  test("the PA horns are every horn but the Hi-fi-only ones", () => {
    expect(HORN_OPTIONS.some((h) => h.scope === "hifi")).toBe(false);
    expect(HORN_OPTIONS.map((h) => h.id).sort()).toEqual(
      HORN_RAW.filter((h) => !hifiIds.has(h.id))
        .map((h) => h.id)
        .sort(),
    );
  });

  test("the Hi-fi waveguide picker lists each, A–Z with the rest, carrying its limit to the model", () => {
    for (const h of hifiOnly) {
      const guide = HIFI_WAVEGUIDES.find((g) => g.id === h.id);
      if (!guide) throw new Error(`${h.id}: not in the Hi-fi waveguides`);
      expect(waveguideSpecOf(guide).lowHz, h.id).toBe(h.hf?.lowHz);
    }
    expect(HIFI_WAVEGUIDES.map((h) => h.id)).toEqual(
      sortedByName(HIFI_WAVEGUIDES).map((h) => h.id),
    );
    // the PA's 1-inch waveguides stay on the Hi-fi list too
    expect(HIFI_WAVEGUIDES.some((h) => !hifiIds.has(h.id))).toBe(true);
  });

  test("the PA driver comparison never offers one", () => {
    const cur = paSearchDesign({ cur: paCurrent("lil block stack") });
    const rows = compareDrivers(cur, "horn", { maxLb: 125, budget: 1100 });
    expect(rows.length).toBe(HORN_OPTIONS.length);
    expect(rows.some((r) => hifiIds.has(r.id))).toBe(false);
  });
});
