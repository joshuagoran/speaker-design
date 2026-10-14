// How the views draw a horn built into a speaker chamber (lib/speaker/hornGeometry): the numbers that are the drawing's
// own, not the horn's or the box's.

/** How many steps each stretch of a horn's path is cut in, between two sections the views draw (a segment's or a leg's). */
export const HORN_PATH_STEPS = 8;

/**
 * The most folds a folded path takes: a fold sends the path back along the box once, so the path runs in one more leg
 * than it has folds.
 */
export const HORN_MAX_FOLDS = 8;

/**
 * The room a driver's body at the throat takes along the path, in, behind its front chamber (the walls' clearance in
 * front of the cone, lib/speaker/hornThroat): where a folded path with an odd number of folds starts at the front, the
 * driver stands between the baffle and the throat. A path with an even number starts at the back, the driver behind it.
 */
export const HORN_DRIVER_ROOM_IN = 3;

/**
 * How far past the box's inside a section may reach and still count as inside it, in: float noise from the areas and the
 * stack, far under a drawing's pixel.
 */
export const HORN_FIT_TOLERANCE_IN = 1e-6;
