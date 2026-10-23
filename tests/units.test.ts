// The display units (lib/units, hooks/useUnits): what the page shows a stored amount as in each system, what a typed
// number is in the stored unit, the model's text with its sizes converted, and readouts that follow the Units setting.
import { describe, expect, test } from "vite-plus/test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { UNIT_SYSTEM, VOLUME_UNIT } from "../src/constants/units";
import {
  convertUnitsText,
  formatAmount,
  formatCutSize,
  formatDims,
  formatQuantity,
  formatSignedQuantity,
  formatSize,
  formatTemperature,
  fromShown,
  shownStep,
  toShown,
  unitName,
} from "../src/lib/units";
import { UnitsProvider } from "../src/hooks/useUnits";
import { NumberField } from "../src/components/ui/NumberField";
import { Delta } from "../src/components/optimizer/Delta";
import type { UnitSettings } from "../src/types";

// US with ft³ volumes, metric with liters: each system's own volume unit
const us: UnitSettings = { system: UNIT_SYSTEM.us, volume: VOLUME_UNIT.cubicFeet };
const metric: UnitSettings = { system: UNIT_SYSTEM.metric, volume: VOLUME_UNIT.liters };

describe("conversion", () => {
  test("a stored amount in each system, and back", () => {
    expect(toShown("boxLength", us, 22.5)).toBe(22.5);
    expect(toShown("boxLength", metric, 22.5)).toBe(572);
    expect(toShown("roomLength", metric, 40)).toBe(12.19);
    expect(toShown("volume", us, 28.3168)).toBe(1);
    expect(toShown("smallVolume", us, 1)).toBe(61);
    expect(toShown("mass", metric, 100)).toBe(45.4);
    expect(toShown("speed", us, 17)).toBe(56);
    expect(fromShown("boxLength", metric, 25.4)).toBeCloseTo(1, 9);
    expect(fromShown("roomLength", metric, 3.048)).toBeCloseTo(10, 9);
    expect(fromShown("volume", us, 1)).toBeCloseTo(28.3168, 3);
    expect(fromShown("mass", metric, 1)).toBeCloseTo(2.2046, 4);
  });

  test("a field's step: the system's own, else the field's in the stored unit", () => {
    expect(shownStep("boxLength", us, 0.25)).toBe(0.25);
    expect(shownStep("boxLength", metric, 0.25)).toBe(1);
    expect(shownStep("roomLength", metric, 1)).toBe(0.1);
    expect(shownStep("boxLength", us, undefined)).toBeUndefined();
  });
});

describe("the Volume setting", () => {
  test("volumes follow it whatever the system; other amounts follow the system", () => {
    const usLiters: UnitSettings = { ...us, volume: VOLUME_UNIT.liters };
    const metricCubicFeet: UnitSettings = { ...metric, volume: VOLUME_UNIT.cubicFeet };
    expect(formatQuantity("volume", usLiters, 56.25)).toBe("56.3 L");
    expect(formatQuantity("smallVolume", usLiters, 0.12)).toBe("0.12 L");
    expect(formatQuantity("boxLength", usLiters, 15.5)).toBe("15.5 in");
    expect(formatQuantity("volume", metricCubicFeet, 28.3168)).toBe("1 ft³");
    expect(formatQuantity("boxLength", metricCubicFeet, 15.5)).toBe("394 mm");
    expect(fromShown("volume", metricCubicFeet, 1)).toBeCloseTo(28.3168, 3);
  });

  test("the model's liters: as in³ with ft³, as they are with liters", () => {
    expect(
      convertUnitsText({ ...metric, volume: VOLUME_UNIT.cubicFeet }, "Recesses take 0.12 L."),
    ).toBe("Recesses take 7 in³.");
    expect(convertUnitsText({ ...us, volume: VOLUME_UNIT.liters }, "Recesses take 0.12 L.")).toBe(
      "Recesses take 0.12 L.",
    );
  });
});

describe("formatting", () => {
  test("units and amounts", () => {
    expect(unitName("boxArea", metric)).toBe("cm²");
    expect(formatAmount("boxLength", us, 15.5)).toBe("15.5");
    expect(formatAmount("boxLength", us, 15.5, 1)).toBe("15.5");
    expect(formatAmount("roomLength", us, 12, 1)).toBe("12.0");
    expect(formatQuantity("boxLength", metric, 15.5)).toBe("394 mm");
    expect(formatQuantity("mass", us, 41.6, 0)).toBe("42 lb");
    expect(formatQuantity("mass", metric, 41.6, 0)).toBe("18.9 kg");
    expect(formatQuantity("volume", metric, 56.25)).toBe("56.3 L");
    expect(formatSignedQuantity("roomLength", us, 3.5)).toBe("+3.5 ft");
    expect(formatSignedQuantity("roomLength", metric, -3.5)).toBe("−1.07 m");
    expect(formatTemperature(us, 20)).toBe("68 °F");
    expect(formatTemperature(metric, 20)).toBe("20 °C");
  });

  test("sizes and cut sizes: fractions of an inch in US, mm in metric", () => {
    expect(formatSize(us, 1.5)).toBe("1½″");
    expect(formatSize(metric, 1.5)).toBe("38 mm");
    expect(formatCutSize(us, 12.625)).toBe("12 5/8");
    expect(formatCutSize(metric, 12.625)).toBe("321");
    expect(formatDims(us, { w: 22, h: 30, d: 20 })).toBe("22 × 30 × 20″");
    expect(formatDims(metric, { w: 22, h: 30, d: 20 })).toBe("559 × 762 × 508 mm");
  });
});

describe("the model's text", () => {
  test("metric: inch sizes as mm, feet as m, pounds as kg", () => {
    expect(convertUnitsText(metric, "slot: 12 5/8 × 2″ opening, 1½″ roundover")).toBe(
      "slot: 321 × 51 mm opening, 38 mm roundover",
    );
    expect(convertUnitsText(metric, "a 3/32″ kerf, the 12×8″ offcut")).toBe(
      "a 2 mm kerf, the 305×203 mm offcut",
    );
    expect(convertUnitsText(metric, "cut from 1 × 10 ft Sch 40 PVC")).toBe(
      "cut from 1 × 3.05 m Sch 40 PVC",
    );
    expect(convertUnitsText(metric, "New limit: 50 lb")).toBe("New limit: 22.7 kg");
  });

  test("a thread size and text already in the system's units stay as they are", () => {
    expect(convertUnitsText(metric, "1-3/8″-18 TPI")).toBe("1-3/8″-18 TPI");
    expect(convertUnitsText(metric, "At most 12.0 m/s, 25 L")).toBe("At most 12.0 m/s, 25 L");
    expect(convertUnitsText(us, "a 3/4″ roundover, 10 ft")).toBe("a 3/4″ roundover, 10 ft");
  });

  test("US: air speeds as ft/s, the small air spaces as in³", () => {
    expect(convertUnitsText(us, "At most 17.0 m/s at full power")).toBe(
      "At most 56 ft/s at full power",
    );
    expect(convertUnitsText(us, "Recesses take 0.12 L.")).toBe("Recesses take 7 in³.");
  });
});

/** `node` rendered under the unit settings `settings`. */
const rendered = (settings: UnitSettings, node: React.ReactElement) =>
  renderToString(createElement(UnitsProvider, { settings, children: node }));

describe("readouts follow the Units setting", () => {
  test("a number field and a change", () => {
    const field = createElement(NumberField, {
      label: "Width",
      value: 20,
      onChange: () => {},
      quantity: "boxLength",
      min: 1,
      step: 0.25,
    });
    expect(rendered(us, field)).toContain('value="20"');
    expect(rendered(us, field)).toContain('step="0.25"');
    expect(rendered(metric, field)).toContain('value="508"');
    expect(rendered(metric, field)).toContain('step="1"');
    expect(rendered(metric, field)).toContain('min="25"');

    const delta = createElement(Delta, { v: 10, quantity: "mass", digits: 1, lowerIsBetter: true });
    expect(rendered(us, delta)).toContain("+10.0 lb");
    expect(rendered(metric, delta)).toContain("+4.5 kg");
  });
});
