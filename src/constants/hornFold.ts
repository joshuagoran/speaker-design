// The folded horn path's limits and tolerances (lib/speaker/hornFold).

/**
 * How close a wall stands to the box's inside face to be the cabinet's own panel (no board of its own), and how far a
 * corner's mitre may pass it, in.
 */
export const FOLD_BOUNDARY_TOLERANCE_IN = 0.25;

/** How close two runs' walls stand, a board apart, to share that one board, in. */
export const FOLD_SHARED_TOLERANCE_IN = 0.15;

/** The shortest run, in: the first run never goes below it when it takes up a difference in length. */
export const FOLD_MIN_RUN_IN = 0.5;

/** The most a corner turns, degrees: past it the walls' mitre runs far past the duct. */
export const FOLD_SHARP_TURN_DEG = 150;

/** The most legs the automatic folds lay out: a path still left past them starts at the last one. */
export const MAX_FOLD_LEGS = 12;

/**
 * A wall no longer than this many boards' thickness is the end of the board between two legs (a turn's inner side),
 * not a board of its own.
 */
export const FOLD_BOARD_END_BOARDS = 2;

/** How far an automatic fold's turn stands past half its duct's height from the wall, in: room for the legs' tilt. */
export const FOLD_TURN_MARGIN_IN = 0.25;

/** Two runs closer than this many boards' thickness cross: no board fits between them. */
export const FOLD_MIN_GAP_BOARDS = 0.5;

/**
 * How far past the drivers' board the run across may start, in: a board between two nested legs is a little thicker
 * along a partial leg. Farther than this, the drivers' other side is the rear chamber.
 */
export const FOLD_MOUNT_REACH_IN = 1.5;

/** How far the automatic folds' mouth leg's outer wall falls away from the box's wall at the back, in. */
export const FOLD_EDGE_FALL_IN = 0.75;
