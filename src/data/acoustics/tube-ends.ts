// End corrections of a round port tube that the plain 1.46 r (a flanged outer end, 0.85 r, and a free inner end,
// 0.61 r) leaves out: a wall facing the inner mouth, and the flares at both ends.

/**
 * The extra inner end correction of a tube whose mouth faces a wall, in tube radii, at the gap from the mouth to the
 * wall in tube radii. An axisymmetric potential-flow solve (a flanged tube end facing a rigid plane: the same method as
 * SLOT_INNER_END, turned about the tube's axis). Between and past the two points it falls as a power of the gap
 * (`tubeWallEndCorrection` in src/lib/pa/tubes.ts); the planner never builds a mouth closer than a diameter (2 r).
 */
export const TUBE_WALL_END = {
  gapOverR: [1, 1.5],
  ecOverR: [0.16, 0.09],
} as const;

/**
 * The radius of a tube's flares, inches: a quarter-round at each end (a flared port tube's bell, or the roundover cut
 * in the baffle around a plain pipe), as the 3D view draws them.
 */
export const TUBE_FLARE_RADIUS_IN = 0.75;
