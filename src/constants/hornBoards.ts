// A folded horn laid out in boards (lib/speaker/hornBoards): the walls of a chamber's side section, a board's two
// faces, and the rules every design passes (docs/folded-horn-plan.md).

/** The walls of a chamber's clear inside, in its side section: the baffle at the front, the back, the top, the bottom. */
export const FOLD_WALL = {
  baffle: "baffle",
  back: "back",
  top: "top",
  bottom: "bottom",
} as const;

/** A board's two faces: on its corner line, or a panel's thickness off it (to the board's `side`). */
export const FOLD_FACE = {
  line: "line",
  offset: "offset",
} as const;

/** The lowest a passage may be, in: a gate shorter than this fails the check. */
export const FOLD_MIN_PASSAGE_IN = 1.5;

/** How far a board runs past the drivers' cutout on each side, at least, in. */
export const FOLD_CUTOUT_MARGIN_IN = 0.5;

/**
 * The room the drivers' motor needs past its back and sides, in: the air behind the cone flows round it into the
 * passage. Nothing may come closer.
 */
export const FOLD_MAGNET_CLEARANCE_IN = 1;

/** The room the cone side needs past the cone's excursion, in. */
export const FOLD_CONE_MARGIN_IN = 0.5;

/** How far apart two points may be and count as one, in (a corner on a wall, a board's end on another's face). */
export const FOLD_TOUCH_IN = 0.01;

/** The most legs the automatic zigzag tries when a folded horn has no boards of its own. */
export const FOLD_AUTO_MAX_LEGS = 10;

/** The turn widths the automatic zigzag tries, as shares of a leg's height: narrower turns leave longer boards. */
export const FOLD_AUTO_TURN_SHARES = [1, 0.75, 0.5] as const;
