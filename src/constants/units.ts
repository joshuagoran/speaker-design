/** Radians in a degree. */
export const RAD = Math.PI / 180;

/** Milliseconds in a second. */
export const MS_PER_S = 1000;

/** Meters in one foot. */
export const METERS_PER_FOOT = 0.3048;

/** Meters in one inch. */
export const METERS_PER_INCH = 0.0254;

/** Millimeters in one inch. */
export const MM_PER_IN = METERS_PER_INCH * 1000;

/** Inches in one millimeter: the catalog's drawings and 3D models are in mm. */
export const IN_PER_MM = 1 / MM_PER_IN;

/** Square meters in one square foot. */
export const SQ_METERS_PER_SQ_FOOT = 0.09290304;

/** Kilograms in one pound. */
export const KG_PER_LB = 0.45359237;

/** lb/ft² to kg/m². */
export const LB_FT2_KG_M2 = KG_PER_LB / SQ_METERS_PER_SQ_FOOT;

/** Square centimeters in one square meter: datasheet cone areas (Sd) and Hornresp's areas are in cm². */
export const SQ_CM_PER_SQ_M = 10_000;

/** Centimeters in one meter: Hornresp's lengths are in cm. */
export const CM_PER_M = 100;

/** Liters in one cubic meter. */
export const LITERS_PER_CUBIC_M = 1000;

/** Grams in one kilogram: datasheet moving masses (Mms) are in grams. */
export const GRAMS_PER_KG = 1000;

/** Grams in one pound: a radiator's added mass is in grams, the weights in lb. */
export const GRAMS_PER_LB = KG_PER_LB * GRAMS_PER_KG;

/** Cubic centimeters in one liter: the horn engine's volumes (areas in cm², lengths in cm) are in cm³. */
export const CM3_PER_LITER = 1000;

/** Liters in one cubic inch (the box models' 16.387 cm³). */
export const LITERS_PER_CUBIC_IN = 16.387 / 1000;

/** Centimeters in one inch: the spec's sizes are in inches, the horn engine's (Hornresp's) in cm. */
export const CM_PER_IN = METERS_PER_INCH * CM_PER_M;

/** Inches in one foot. */
export const INCHES_PER_FOOT = 12;

/** Square inches in one square foot: the panels' weights are in lb/ft². */
export const SQ_IN_PER_SQ_FT = INCHES_PER_FOOT * INCHES_PER_FOOT;

/** Square centimeters in one square inch: the spec's areas in in², the horn engine's (Hornresp's) in cm². */
export const CM2_PER_IN2 = CM_PER_IN * CM_PER_IN;

/** Liters in one cubic foot. */
export const LITERS_PER_CUBIC_FT = LITERS_PER_CUBIC_IN * INCHES_PER_FOOT ** 3;

/** Feet in one meter: a speed in m/s shown in ft/s. */
export const FEET_PER_METER = 1 / METERS_PER_FOOT;

// The display units: the header's Units setting. The model and the saved data keep the units above; only what the page
// shows (and reads from a field) follows the setting.

/** The two unit systems a page can show. */
export const UNIT_SYSTEM = { us: "us", metric: "metric" } as const;

/** What the cutlist's sizes are in, as its note names it ("Finished sizes in inches."). */
export const CUT_SIZE_UNIT_WORDS = {
  [UNIT_SYSTEM.us]: "inches",
  [UNIT_SYSTEM.metric]: "mm",
} as const;

/** The settings menu's Units choice, in display order: [system, label]. */
export const UNIT_SYSTEM_CHOICES = [
  [UNIT_SYSTEM.us, "US"],
  [UNIT_SYSTEM.metric, "Metric"],
] as const;

/** Where the Units choice is kept, per browser (JSON, like the theme). */
export const UNITS_STORAGE_KEY = "units";

/** The settings menu's Volume choice: liters, or ft³ (in³ for a small air space), whatever the Units system. */
export const VOLUME_UNIT = { liters: "liters", cubicFeet: "cubicFeet" } as const;

/** The Volume choice in display order: [unit, label]. */
export const VOLUME_UNIT_CHOICES = [
  [VOLUME_UNIT.liters, "Liters"],
  [VOLUME_UNIT.cubicFeet, "ft³"],
] as const;

/** Where the Volume choice is kept, per browser. */
export const VOLUME_STORAGE_KEY = "volumeUnit";

/** The settings a page shows before any choice: US sizes, volumes in liters. */
export const DEFAULT_UNIT_SETTINGS = {
  system: UNIT_SYSTEM.us,
  volume: VOLUME_UNIT.liters,
} as const;

/**
 * One kind of amount the page shows, in each system: the unit the model and saved data hold it in (`stored`), and per
 * system its unit's name, how many of that unit make one stored unit (`per`), the decimals a readout or field shows,
 * and a field's step (`null`: the field's own step, in the stored unit). The US side of a quantity the model already
 * holds in US units is the stored unit, and shows as the page always has.
 */
interface QuantityUnits {
  stored: string;
  us: { unit: string; per: number; decimals: number | null; step: number | null };
  metric: { unit: string; per: number; decimals: number; step: number };
}

/** Every quantity the Units setting changes (the volumes follow the Volume setting instead: `VOLUME_QUANTITIES`). */
export const QUANTITIES = {
  /** a box's, a panel's or a part's size, stored in inches: mm in metric */
  boxLength: {
    stored: "in",
    us: { unit: "in", per: 1, decimals: null, step: null },
    metric: { unit: "mm", per: MM_PER_IN, decimals: 0, step: 1 },
  },
  /** a panel's measured thickness, stored in inches: mm to the hundredth in metric */
  panelThickness: {
    stored: "in",
    us: { unit: "in", per: 1, decimals: null, step: null },
    metric: { unit: "mm", per: MM_PER_IN, decimals: 2, step: 0.1 },
  },
  /** a room's size or a place in it, stored in feet: meters in metric */
  roomLength: {
    stored: "ft",
    us: { unit: "ft", per: 1, decimals: null, step: null },
    metric: { unit: "m", per: METERS_PER_FOOT, decimals: 2, step: 0.1 },
  },
  /** an opening's or a horn's cross-section, stored in in²: cm² in metric */
  boxArea: {
    stored: "in²",
    us: { unit: "in²", per: 1, decimals: null, step: null },
    metric: { unit: "cm²", per: CM2_PER_IN2, decimals: 0, step: 1 },
  },
  /** a chamber's or a box's air, stored in liters: ft³ on the US side */
  volume: {
    stored: "L",
    us: { unit: "ft³", per: 1 / LITERS_PER_CUBIC_FT, decimals: 2, step: 0.05 },
    metric: { unit: "L", per: 1, decimals: 1, step: 0.1 },
  },
  /** a small air space (a horn's throat chamber, the hardware's recesses), stored in liters: in³ on the US side */
  smallVolume: {
    stored: "L",
    us: { unit: "in³", per: 1 / LITERS_PER_CUBIC_IN, decimals: 0, step: 1 },
    metric: { unit: "L", per: 1, decimals: 2, step: 0.01 },
  },
  /** a weight, stored in pounds: kg in metric */
  mass: {
    stored: "lb",
    us: { unit: "lb", per: 1, decimals: null, step: null },
    metric: { unit: "kg", per: KG_PER_LB, decimals: 1, step: 0.5 },
  },
  /** an air speed, stored in m/s: ft/s in US */
  speed: {
    stored: "m/s",
    us: { unit: "ft/s", per: FEET_PER_METER, decimals: 0, step: 1 },
    metric: { unit: "m/s", per: 1, decimals: 1, step: 0.5 },
  },
} as const satisfies Record<string, QuantityUnits>;

/** The quantities the Volume setting picks the unit of, and the side of QUANTITIES each choice shows. */
export const VOLUME_QUANTITIES = [
  "volume",
  "smallVolume",
] as const satisfies readonly (keyof typeof QUANTITIES)[];
export const VOLUME_UNIT_SIDE = {
  [VOLUME_UNIT.liters]: UNIT_SYSTEM.metric,
  [VOLUME_UNIT.cubicFeet]: UNIT_SYSTEM.us,
} as const;
