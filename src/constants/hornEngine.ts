import type { HornProfile, RadiationAngle } from "../types";

/**
 * A horn segment's flare law, by id (Hornresp's CON and EXP). A segment whose two areas are equal is a straight duct,
 * whatever its profile.
 */
export const HORN_PROFILE = {
  conical: "con",
  exponential: "exp",
} as const;

/** The name a setting shows for each flare law. */
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
