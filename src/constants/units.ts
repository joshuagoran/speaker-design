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
