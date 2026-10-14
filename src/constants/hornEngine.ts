import type { HornProfile, RadiationAngle } from "../types";

/**
 * A horn segment's flare law, by id (Hornresp's CON, EXP and PAR). A segment whose two areas are equal is a straight
 * duct, whatever its profile. Parabolic: the area grows linearly along the segment, as in a horn with flat, straight
 * side walls between a parallel top and bottom (the PA v2 sub bin).
 */
export const HORN_PROFILE = {
  conical: "con",
  exponential: "exp",
  parabolic: "par",
} as const;

/** The name a setting shows for each flare law. */
export const HORN_PROFILE_NAMES = {
  con: "Conical",
  exp: "Exponential",
  par: "Parabolic",
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
