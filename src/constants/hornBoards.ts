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

/** How much taller each leg is than the one before, in the zigzags tried: alike, or growing toward the mouth. */
export const FOLD_AUTO_GROWTHS = [1, 1.25, 1.5] as const;

/** The sealed rear chamber heights an offset horn's layouts try, as shares of the chamber's height. */
export const FOLD_OFFSET_REAR_SHARES = [0.2, 0.3, 0.4] as const;

/** The mouth's leg heights a tapped horn's spirals try, as shares of the height its legs share. */
export const FOLD_SPIRAL_MOUTH_SHARES = [0.3, 0.4, 0.5] as const;

/**
 * When no folded layout fits, the side section is tried this much larger at a time (a share of its depth and height),
 * up to `FOLD_GROW_MAX` times its size, to find the chamber size one fits.
 */
export const FOLD_GROW_STEP = 0.1;
export const FOLD_GROW_MAX = 2;

/** The layout a folded horn's automatic boards take: either kind, or one alone. */
export const FOLD_SHAPE = { auto: "auto", zigzag: "zigzag", spiral: "spiral" } as const;

/** What each layout choice shows. */
export const FOLD_SHAPE_NAMES = {
  auto: "Auto",
  zigzag: "Zigzag",
  spiral: "Spiral",
} as const satisfies Record<keyof typeof FOLD_SHAPE, string>;

/**
 * How far along the path the drivers' first tap may be, as a share of it: further, and most of the passage is a dead
 * end behind the cones.
 */
export const FOLD_TAP_MAX_SHARE = 0.4;

/**
 * How narrow a gate may be, as a share of the last leg gate before it: narrower, and the passage chokes there (a turn
 * narrower than its leg, or a leg pinched by a board at an angle).
 */
export const FOLD_CHOKE_SHARE = 0.75;

/** What a passage narrowing along its legs costs Design from goals, in dB of score for a leg all the way closed. */
export const FOLD_NARROWING_DB = 4;

/** The step sizes Design from goals moves a folded horn's corners and drivers by, largest first, in. */
export const FOLD_REFINE_STEPS_IN = [2, 1, 0.5] as const;

/** At most how many rounds of moves Design from goals runs at each step size. */
export const FOLD_REFINE_ROUNDS = 4;

/** Where a folded horn's mouth opens on the baffle. */
export const FOLD_MOUTH = { top: "top", bottom: "bottom" } as const;

/** What each mouth end shows. */
export const FOLD_MOUTH_NAMES = { top: "Top", bottom: "Bottom" } as const satisfies Record<
  keyof typeof FOLD_MOUTH,
  string
>;
