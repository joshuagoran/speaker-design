import { describe, expect, it } from "vite-plus/test";
import {
  CABINETS,
  CD_OPTIONS,
  FILL_OPTIONS,
  FORMATS,
  HIFI_TWEETERS,
  HIFI_WOOFERS,
  HORN_OPTIONS,
  MID_BOXES,
  MID_OPTIONS,
  SUB_OPTIONS,
  midDriversOfSize,
  subDriversOfSize,
} from "../src/lib/data";
import {
  DEFAULT_FILL,
  DEFAULT_HIFI,
  DEFAULT_MID_BY_SIZE,
  DEFAULT_PA,
  DEFAULT_PORT_SIZE,
} from "../src/lib/defaults";
import { designProblems, evaluateDesign } from "../src/lib/pa/optimize";
import { DESIGN_PROBLEM_TEXT } from "../src/constants/optimizerText";
import { hornResponse } from "../src/lib/pa/calc";
import { fillSystem } from "../src/lib/pa/calc";
import { hifiSystem } from "../src/lib/hifi/hifi";
import { panelIn } from "../src/lib/panel";
import type { PaDesignConfig } from "../src/types";

/** What `usePaDesign().snapshot()` makes of a design: the drivers, box and horn as ids. */
const snapshotOf = (d: typeof DEFAULT_PA): PaDesignConfig => {
  const { midSize: _midSize, plywoodSheetKind: _kind, boxSetCount: _sets, ...rest } = d;
  return {
    ...rest,
    format: d.format.id,
    cabinet: d.cabinet.id,
    sub: d.sub.id,
    mid: d.mid.id,
    midBox: d.midBox.id,
    cd: d.cd.id,
    horn: d.horn.id,
  };
};

/** True when every number anywhere in the value is finite. */
const allFinite = (v: unknown): boolean =>
  typeof v === "number"
    ? Number.isFinite(v)
    : Array.isArray(v)
      ? v.every(allFinite)
      : v !== null && typeof v === "object"
        ? Object.values(v).every(allFinite)
        : true;

describe("default designs", () => {
  it("DEFAULT_PA is a modelled system with no NaN", () => {
    const m = evaluateDesign(snapshotOf(DEFAULT_PA));
    expect(m).not.toBeNull();
    expect(allFinite(m)).toBe(true);
  });

  it("DEFAULT_PA's horn fits its compression driver's exit", () => {
    expect(DEFAULT_PA.horn.exit).toBe(DEFAULT_PA.cd.exit);
    const m = evaluateDesign(snapshotOf(DEFAULT_PA));
    expect(m?.mismatch).toBe(false);
    expect(designProblems(m, { maxLb: 1000, budget: 100000 })).not.toContain(
      DESIGN_PROBLEM_TEXT.exitMismatch,
    );
    const d = DEFAULT_PA;
    expect(hornResponse(d.cd.hf, d.horn.hf ?? {}, d.xoHi, d.hfAmpW, d.xoHiOrder)).not.toBeNull();
  });

  it("DEFAULT_HIFI is a modelled system with no NaN", () => {
    const d = DEFAULT_HIFI;
    const sys = hifiSystem(d.woofer, d.tweeter, {
      box: d.boxType,
      dim: d.boxDims,
      wall: panelIn(d.wallPanel, d.panelMaterial),
      mat: d.panelMaterial,
      port: d.portSpec,
      xo: d.crossoverHz,
      order: d.crossoverOrder,
      wAmpW: d.wooferAmpWatts,
      tAmpW: d.tweeterAmpWatts,
      bsc: d.baffleStepCompensationDb,
      place: d.placement,
      wallFt: d.distanceToWallFt,
    });
    expect(sys).not.toBeNull();
    expect(allFinite(sys)).toBe(true);
  });

  it("DEFAULT_FILL is a modelled system with no NaN", () => {
    const d = DEFAULT_FILL;
    const sys = fillSystem(d.driver, {
      boxType: d.boxType,
      dim: d.boxDims,
      port: d.portSpec,
      hp: d.highpassHz,
      hpOrder: d.highpassOrder,
      ampW: d.ampWatts,
      portMax: d.maxPortAirSpeedMs,
    });
    expect(sys).not.toBeNull();
    expect(allFinite(sys)).toBe(true);
  });

  it("every default part is the very object its table holds", () => {
    expect(SUB_OPTIONS.includes(DEFAULT_PA.sub)).toBe(true);
    expect(MID_OPTIONS.includes(DEFAULT_PA.mid)).toBe(true);
    expect(CD_OPTIONS.includes(DEFAULT_PA.cd)).toBe(true);
    expect(HORN_OPTIONS.includes(DEFAULT_PA.horn)).toBe(true);
    expect(MID_BOXES.includes(DEFAULT_PA.midBox)).toBe(true);
    expect(FORMATS.includes(DEFAULT_PA.format)).toBe(true);
    expect(CABINETS.includes(DEFAULT_PA.cabinet)).toBe(true);
    expect(HIFI_WOOFERS.includes(DEFAULT_HIFI.woofer)).toBe(true);
    expect(HIFI_TWEETERS.includes(DEFAULT_HIFI.tweeter)).toBe(true);
    expect(HORN_OPTIONS.includes(DEFAULT_HIFI.selectedWaveguide)).toBe(true);
    expect(FILL_OPTIONS.includes(DEFAULT_FILL.driver)).toBe(true);
    for (const d of Object.values(DEFAULT_MID_BY_SIZE)) {
      expect(MID_OPTIONS.includes(d.mid)).toBe(true);
      expect(MID_BOXES.includes(d.midBox)).toBe(true);
    }
  });

  it("the Hi-fi round port starts at the diameter the port toggle falls back to", () => {
    expect(DEFAULT_HIFI.portSpec.dia).toBe(DEFAULT_PORT_SIZE.dia);
  });

  it("a size's drivers are the table's drivers of that size", () => {
    expect(subDriversOfSize(18).every((o) => o.size === 18 && SUB_OPTIONS.includes(o))).toBe(true);
    expect(midDriversOfSize(15)).toContain(DEFAULT_MID_BY_SIZE[15]?.mid);
    expect(midDriversOfSize(12)).toContain(DEFAULT_PA.mid);
    expect(subDriversOfSize(18)).toContain(DEFAULT_PA.sub);
  });
});
