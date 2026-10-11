import type { HornProfile, RadiationAngle } from "../types";

/** Air density, kg/m³, and the speed of sound, m/s: the values every PA box model uses (lib/pa/calc). */
export const AIR_DENSITY = 1.18;
export const SOUND_SPEED = 343;

/**
 * A horn segment's flare law, by id, and the name a setting shows for each. Hornresp's names: CON (conical), EXP
 * (exponential); a straight duct is a segment whose two areas are equal.
 */
export const HORN_PROFILE_NAMES = {
  con: "Conical",
  exp: "Exponential",
} as const satisfies Record<HornProfile, string>;

/**
 * The solid angle a horn mouth radiates into, in units of π, and its name. Half space (2π) is a mouth in a large
 * baffle or on the floor, as every PA box model assumes; π and π/2 add one and two boundaries (floor and wall).
 */
export const RADIATION_ANGLE_NAMES = {
  2: "Half space (2π)",
  1: "Quarter space (π)",
  0.5: "Eighth space (π/2)",
} as const satisfies Record<RadiationAngle, string>;

/**
 * The rear chamber's leakage and the vent's losses, each as a quality factor Q at the vent's tuning: the box model's
 * defaults (lib/pa/calc boxModel's QL and Qp). A lower Q means more loss.
 */
export const HORN_LEAK_Q = 7;
export const HORN_PORT_Q = 50;
