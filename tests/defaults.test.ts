import { describe, expect, it } from "vite-plus/test";
import { DEFAULT_FILL, DEFAULT_HIFI, DEFAULT_PORT_SIZE } from "../src/lib/defaults";
import { fillSystem } from "../src/lib/pa/calc";

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
  it("DEFAULT_FILL is a modeled system with no NaN", () => {
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

  it("the Hi-fi round port starts at the diameter the port toggle falls back to", () => {
    expect(DEFAULT_HIFI.portSpec.dia).toBe(DEFAULT_PORT_SIZE.dia);
  });
});
