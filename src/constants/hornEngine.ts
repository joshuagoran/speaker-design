import type { HornDesign, HornProfile } from "../types";

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
 * Where the Speaker page models a chamber, and where `ventTuningHz` tunes a vent: one box in half space (Hornresp's
 * Ang 2.0 x Pi, one box). One place, so a chamber's tuning and its response never drift apart.
 */
export const ONE_BOX_HALF_SPACE = { angle: 2, count: 1 } as const satisfies Pick<
  HornDesign,
  "angle" | "count"
>;
