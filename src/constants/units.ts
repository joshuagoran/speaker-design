/** Meters in one foot. */
export const METERS_PER_FOOT = 0.3048;

/** Meters in one inch. */
export const METERS_PER_INCH = 0.0254;

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

/** Liters in one cubic inch (the box models' 16.387 cm³). */
export const LITERS_PER_CUBIC_IN = 16.387 / 1000;
