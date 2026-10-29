import {
  QUANTITIES,
  UNIT_SYSTEM,
  VOLUME_QUANTITIES,
  VOLUME_UNIT,
  VOLUME_UNIT_SIDE,
} from "../constants/units";
import type { Dims3, Quantity, UnitSettings } from "../types";
import { formatInches as formatFractionInches } from "./acoustics/boxModels";
import { formatInches, formatSigned } from "./format";

// The display units: what the page shows a stored amount as, and what a field's typed number is in the stored unit.
// The model and the saved data keep their own units (QUANTITIES' `stored`); only the page's edge converts.

/** Whether the Volume setting, not the Units system, picks a quantity's unit. */
const isVolume = (quantity: Quantity) => VOLUME_QUANTITIES.some((q) => q === quantity);

/** A quantity's unit, decimals and step in the settings: a volume's by the Volume setting, the rest by the system. */
const sideOf = (quantity: Quantity, { system, volume }: UnitSettings) =>
  QUANTITIES[quantity][isVolume(quantity) ? VOLUME_UNIT_SIDE[volume] : system];

/** Rounds `v` to `decimals` places (null: as it is). */
const roundTo = (v: number, decimals: number | null) =>
  decimals === null ? v : Math.round(v * 10 ** decimals) / 10 ** decimals;

/** The unit's name a readout or a field shows, e.g. "in", "mm", "ft³". */
export const unitName = (quantity: Quantity, settings: UnitSettings): string =>
  sideOf(quantity, settings).unit;

/** A stored amount as the system shows it, rounded to its decimals (a US amount the model holds in US units as it is). */
export const toShown = (quantity: Quantity, settings: UnitSettings, stored: number): number => {
  const side = sideOf(quantity, settings);
  return roundTo(stored * side.per, side.decimals);
};

/** A stored amount (or a change in one) in the system's unit, not rounded. */
export const scaleToShown = (quantity: Quantity, settings: UnitSettings, stored: number): number =>
  stored * sideOf(quantity, settings).per;

/** The decimals the system shows a quantity to: its own, or `usDigits` for a US amount the model holds in US units. */
export const shownDecimals = (
  quantity: Quantity,
  settings: UnitSettings,
  usDigits: number,
): number => sideOf(quantity, settings).decimals ?? usDigits;

/** A number typed in the system's unit, in the stored unit. */
export const fromShown = (quantity: Quantity, settings: UnitSettings, shown: number): number =>
  shown / sideOf(quantity, settings).per;

/** A field's step in the system's unit: the system's own step, or the field's stored-unit step where it has none. */
export const shownStep = (
  quantity: Quantity,
  settings: UnitSettings,
  storedStep: number | undefined,
): number | undefined => {
  const side = sideOf(quantity, settings);
  return side.step ?? (storedStep === undefined ? undefined : storedStep * side.per);
};

/**
 * A stored amount's number as the system shows it, without its unit. A US amount the model holds in US units shows to
 * `usDigits` places as `toFixed` writes it; without `usDigits`, and in a converted unit, trailing zeros drop (1.5, 457).
 */
export const formatAmount = (
  quantity: Quantity,
  settings: UnitSettings,
  stored: number,
  usDigits?: number,
): string => {
  const side = sideOf(quantity, settings);
  if (side.decimals === null)
    return usDigits === undefined ? String(+stored.toFixed(2)) : stored.toFixed(usDigits);
  return String(+(stored * side.per).toFixed(side.decimals));
};

/** A stored amount with its unit, e.g. "22 in", "559 mm", "1.2 ft³" (`usDigits` as `formatAmount`). */
export const formatQuantity = (
  quantity: Quantity,
  settings: UnitSettings,
  stored: number,
  usDigits?: number,
): string =>
  `${formatAmount(quantity, settings, stored, usDigits)} ${unitName(quantity, settings)}`;

/** A stored amount with its sign and unit, e.g. "+3.5 ft", "−1.07 m" (US to `usDigits` places, metric to its decimals). */
export const formatSignedQuantity = (
  quantity: Quantity,
  settings: UnitSettings,
  stored: number,
  usDigits = 1,
): string => {
  const side = sideOf(quantity, settings);
  return `${formatSigned(stored * side.per, side.decimals ?? usDigits)} ${side.unit}`;
};

/** A cut size, stored in inches: to the nearest 1/16 in US (12 5/8), in whole mm in metric (321); no unit. */
export const formatCutSize = (settings: UnitSettings, inches: number): string =>
  settings.system === UNIT_SYSTEM.metric
    ? formatAmount("boxLength", settings, inches)
    : formatFractionInches(inches);

/** A size, inches, as a woodworker writes it in US (¾″, 1½″, 1.3″), and in mm in metric (19 mm). */
export const formatSize = (settings: UnitSettings, inches: number): string =>
  settings.system === UNIT_SYSTEM.metric
    ? formatQuantity("boxLength", settings, inches)
    : formatInches(inches);

/** A cut size's unit mark after a size or a list of sizes: ″ in US, " mm" in metric. */
export const cutUnitMark = (settings: UnitSettings): string =>
  settings.system === UNIT_SYSTEM.metric ? ` ${unitName("boxLength", settings)}` : "″";

/** A box's size, inches, width × height × depth, e.g. 22 × 30 × 20″ in US, 559 × 762 × 508 mm in metric. */
export const formatDims = (settings: UnitSettings, { w, h, d }: Dims3): string =>
  [w, h, d].map((v) => formatAmount("boxLength", settings, v)).join(" × ") + cutUnitMark(settings);

/** Air temperature, °C, in the system's unit: °F in US. */
export const formatTemperature = (settings: UnitSettings, celsius: number): string =>
  settings.system === UNIT_SYSTEM.metric
    ? `${celsius} °C`
    : `${Math.round((celsius * 9) / 5 + 32)} °F`;

// Text the model writes (the cutlist's notes, the checks) states its sizes in the stored units. `convertUnitsText`
// rewrites those sizes for the system at the page's edge.

const FRACTION_GLYPHS: Record<string, number> = {
  "⅛": 1 / 8,
  "¼": 1 / 4,
  "⅜": 3 / 8,
  "½": 1 / 2,
  "⅝": 5 / 8,
  "¾": 3 / 4,
  "⅞": 7 / 8,
};
/** One inch amount as the model writes it: 12 5/8, 5/8, 1½, ¾, 1.25, 12. */
const INCH_NUMBER = String.raw`(?:\d+ \d+/\d+|\d+/\d+|\d*[⅛¼⅜½⅝¾⅞]|\d+(?:\.\d+)?)`;
/** Inch amounts ending in the inch mark, alone or as a size (12 × 8″, 12×8″, 22 × 30 × 20″). */
const INCH_SIZE = new RegExp(
  String.raw`(?<![\w./-])${INCH_NUMBER}(?:\s?×\s?${INCH_NUMBER})*″`,
  "g",
);
const INCH_PART = new RegExp(INCH_NUMBER, "g");
/** A length in feet, a weight in pounds, a speed in m/s, a volume in liters, written after its number. */
const AMOUNT_WITH = (unit: string) =>
  new RegExp(String.raw`(\d+(?:\.\d+)?) ${unit}(?![\w/²³])`, "g");
const FEET = AMOUNT_WITH("ft");
const POUNDS = AMOUNT_WITH("lb");
const METERS_PER_SECOND = AMOUNT_WITH("m/s");
const LITERS = AMOUNT_WITH("L");

/** An inch amount as the model writes it, in inches. */
const parseInchNumber = (text: string): number => {
  const glyph = FRACTION_GLYPHS[text.slice(-1)];
  if (glyph !== undefined) return (text.length > 1 ? Number(text.slice(0, -1)) : 0) + glyph;
  return text.split(" ").reduce((sum, part) => {
    const [top, bottom] = part.split("/");
    return sum + (bottom === undefined ? Number(top) : Number(top) / Number(bottom));
  }, 0);
};

/**
 * Text the model wrote in its stored units, with each size stated for the settings: in metric, inch sizes (″) as mm,
 * feet as m and pounds as kg; in US, m/s as ft/s; with ft³ volumes, liters as in³ (the model's small air spaces). Text
 * already in the settings' units comes back as it is.
 */
export const convertUnitsText = (settings: UnitSettings, text: string): string => {
  const swap = (pattern: RegExp, quantity: Quantity) => (t: string) =>
    t.replace(pattern, (_, n: string) => formatQuantity(quantity, settings, Number(n)));
  const inchSizes = (t: string) =>
    t.replace(
      INCH_SIZE,
      (size) =>
        size
          .slice(0, -1)
          .replace(INCH_PART, (n) => formatAmount("boxLength", settings, parseInchNumber(n))) +
        cutUnitMark(settings),
    );
  const steps =
    settings.system === UNIT_SYSTEM.metric
      ? [inchSizes, swap(FEET, "roomLength"), swap(POUNDS, "mass")]
      : [swap(METERS_PER_SECOND, "speed")];
  if (settings.volume === VOLUME_UNIT.cubicFeet) steps.push(swap(LITERS, "smallVolume"));
  return steps.reduce((t, step) => step(t), text);
};

/** The display helpers above bound to one set of unit settings (`useUnits` gives the page's). */
export const unitsFor = (settings: UnitSettings) => ({
  settings,
  system: settings.system,
  /** the unit's name, e.g. "in" or "mm" */
  unit: (quantity: Quantity) => unitName(quantity, settings),
  /** a stored amount's number, no unit (`usDigits`: a US amount's places) */
  amount: (quantity: Quantity, stored: number, usDigits?: number) =>
    formatAmount(quantity, settings, stored, usDigits),
  /** a stored amount with its unit */
  format: (quantity: Quantity, stored: number, usDigits?: number) =>
    formatQuantity(quantity, settings, stored, usDigits),
  /** a stored amount with its sign and unit (`usDigits`: a US amount's places, 1 by default) */
  signed: (quantity: Quantity, stored: number, usDigits?: number) =>
    formatSignedQuantity(quantity, settings, stored, usDigits),
  /** a size, inches: ¾″ in US, 19 mm in metric */
  size: (inches: number) => formatSize(settings, inches),
  /** a cut size, inches: a fraction in US, whole mm in metric, no unit */
  cut: (inches: number) => formatCutSize(settings, inches),
  /** the mark after a cut size: ″ or " mm" */
  cutMark: cutUnitMark(settings),
  /** a box's size, inches, width × height × depth, with its unit */
  dims: (dims: Dims3) => formatDims(settings, dims),
  /** an air temperature, °C, in the system's unit */
  temperature: (celsius: number) => formatTemperature(settings, celsius),
  /** text the model wrote in its stored units, with its sizes in the system's */
  text: (text: string) => convertUnitsText(settings, text),
});

/** The display helpers bound to unit settings (`unitsFor`). */
export type Units = ReturnType<typeof unitsFor>;
