// A folded horn's trace (lib/speaker/foldTrace) and editing (lib/speaker/foldBoards): the ids they compare and the
// numbers they run on.

/** The checks on a traced fold, by id. A UI maps each id to its text; the lib carries no text. */
export const FOLD_CHECK = {
  /** the mouth opens onto a board or a driver: no air at the opening */
  mouth: "mouth",
  /** the drivers are missing, blocked, or open into no passage */
  drivers: "drivers",
  /** one side of the cones faces a board with no sealed air behind it */
  rearChamber: "rearChamber",
  /** the cones first open past `FOLD_DEAD_END_SHARE` of the path: a long dead end behind them */
  deadEnd: "deadEnd",
  /** the width falls under `FOLD_CHOKE_SHARE` of its median over the path just before it */
  choke: "choke",
  /** a motor comes within `FOLD_MAGNET_CLEAR_IN` of a board or a wall */
  magnet: "magnet",
  /** a cutout runs off its board, with `FOLD_CUTOUT_SPARE_IN` to spare */
  cutout: "cutout",
  /** sealed air that no driver uses */
  strayAir: "strayAir",
  /** the width falls under `FOLD_THIN_IN` */
  thin: "thin",
  /** the vent's opening is on a board or a driver: no air at the opening */
  ventBlocked: "ventBlocked",
  /** the vent's opening is in air the mouth reaches: it opens into the horn's passage */
  ventLeak: "ventLeak",
  /** the vented chamber is not where the cones' closed side opens */
  ventStray: "ventStray",
  /** the vent's duct fills all the air behind it: no chamber is left */
  ventNoAir: "ventNoAir",
} as const;

/** Why the drivers check fails (`FOLD_CHECK.drivers`). */
export const FOLD_DRIVERS_REASON = {
  /** no drivers are placed */
  none: "none",
  /** both sides of the cones face a board */
  blocked: "blocked",
  /** neither side of the cones opens into the passage */
  outside: "outside",
} as const;

/** The tracing grid's cell, in. */
export const FOLD_CELL_IN = 0.25;
/** The step between the sections the trace reports along the path, in. */
export const FOLD_SECTION_STEP_IN = 0.5;
/** The widths are averaged over this many sections each side of one (2: five sections, 2.5 in). */
export const FOLD_SMOOTH_SECTIONS = 2;
/** The room between two rows of drivers across the width, and between a row and the wall, in. */
export const FOLD_DRIVER_GAP_IN = 0.5;
/** The basket's depth, as a share of the driver's depth, where it narrows from the cutout toward the motor. */
export const FOLD_BASKET_SHARE = 0.45;
/** How much wider than the motor the basket is at that depth. */
export const FOLD_BASKET_FLARE = 1.25;
/** The cones are front-loaded (not offset) when the closed end behind them is no deeper than the cutout's radius plus this, in. */
export const FOLD_FRONT_LOADED_EXTRA_IN = 2;
/** The cones are a dead end when they first open past this share of the path. */
export const FOLD_DEAD_END_SHARE = 0.4;
/** A width under this share of its median over the path just before it chokes. */
export const FOLD_CHOKE_SHARE = 0.75;
/** The path the choke's median covers, in. */
export const FOLD_CHOKE_LOOKBACK_IN = 15;
/** The choke and thin checks leave out this much path at each end, in. */
export const FOLD_ENDS_IN = 4;
/** The choke check needs more than this many sections before a spot to judge it. */
export const FOLD_CHOKE_MIN_SECTIONS = 4;
/** A motor nearer than this to a board or a wall fails, in. */
export const FOLD_MAGNET_CLEAR_IN = 1;
/** A cutout needs this much board beyond its edge, in. */
export const FOLD_CUTOUT_SPARE_IN = 0.5;
/** A width under this is thin, in. */
export const FOLD_THIN_IN = 1.5;
/**
 * The vent's duct ends where the air around it first measures more than this times the opening's width (the width
 * is the widest circle at that distance from the opening, as the horn's sections are measured).
 */
export const FOLD_VENT_END_RATIO = 2;

/** Where a folded horn's board end stops, as code compares it (the cutlist and the editor's holds). */
export const FOLD_END = {
  /** joined to another board's end */
  corner: "corner",
  /** on a wall of the chamber */
  wall: "wall",
  /** against another board's face, along its length */
  butt: "butt",
  /** meets nothing */
  free: "free",
} as const;

/** A board end's `FOLD_END` kind. */
export type FoldEndKind = (typeof FOLD_END)[keyof typeof FOLD_END];

/** The step a board end moves in while drawing or dragging, in. */
export const FOLD_SNAP_IN = 0.25;

/** An end this close to a wall, another board's end or another board's face snaps onto it, in. */
export const FOLD_SNAP_TO_IN = 0.6;

/** The shortest board that can be drawn, in. */
export const FOLD_MIN_BOARD_IN = 2;

/** How far past half a board's thickness an end may sit from another board's center line and still butt it, in. */
export const FOLD_EDGE_TOL_IN = 0.05;

/** A cut this close to square is called square, in degrees. */
export const FOLD_SQUARE_TOL_DEG = 0.05;

/** The fold layout search's families (lib/speaker/foldLayout), by id: the shapes it places boards in. */
export const FOLD_LAYOUT_FAMILY = {
  /** stacked legs that run front to back and turn round each board's free end */
  serpentine: "serpentine",
  /** a spiral round a center board: the closed end inside, the mouth outside (a tapped horn) */
  spiral: "spiral",
} as const;

/** A fold layout family's id (`FOLD_LAYOUT_FAMILY`). */
export type FoldLayoutFamily = (typeof FOLD_LAYOUT_FAMILY)[keyof typeof FOLD_LAYOUT_FAMILY];

/** The checks a laid-out fold must pass: the search drops a fold that fails any of them. */
export const FOLD_LAYOUT_HARD_CHECKS: readonly (typeof FOLD_CHECK)[keyof typeof FOLD_CHECK][] = [
  FOLD_CHECK.mouth,
  FOLD_CHECK.drivers,
  FOLD_CHECK.rearChamber,
  FOLD_CHECK.cutout,
  FOLD_CHECK.magnet,
];

/** The score a laid-out fold adds for each inch its taps sit from the target's, dB per in. */
export const FOLD_LAYOUT_TAP_DB_PER_IN = 0.05;
/** The score a laid-out fold adds for each inch its path is longer or shorter than the target's, dB per in. */
export const FOLD_LAYOUT_PATH_DB_PER_IN = 0.05;
/** The score a laid-out fold adds for each other check it fails (dead end, choke, stray air, thin), dB. */
export const FOLD_LAYOUT_SOFT_CHECK_DB = 1;
/** The most folds one layout search traces: it stops its descent there. */
export const FOLD_LAYOUT_MAX_TRACES = 48;
/** The descent's first step for every setting, in; it halves down to `FOLD_SNAP_IN`. */
export const FOLD_LAYOUT_FIRST_STEP_IN = 1;
/** How many of the best seeds the search sizes again from their traces before the descent. */
export const FOLD_LAYOUT_CALIBRATE_SEEDS = 3;
/** How many times it sizes each of them again: one trace each time. */
export const FOLD_LAYOUT_CALIBRATE_ROUNDS = 2;
/** The most one sizing changes a leg by, as a ratio either way. */
export const FOLD_LAYOUT_RATIO_MAX = 2;
/** The least leg height (or channel width) a layout's seed gives, in: above the thin check's `FOLD_THIN_IN`. */
export const FOLD_LAYOUT_MIN_LEG_IN = 2;
/** The room a seed leaves past a motor's clearance and a cutout's spare, in. */
export const FOLD_LAYOUT_MARGIN_IN = 0.5;
/** How many tapped serpentines (leg count and drivers' board) the search seeds: those whose taps can fall nearest. */
export const FOLD_LAYOUT_TAPPED_PLANS = 3;
/** The serpentine's most legs. */
export const FOLD_LAYOUT_MAX_LEGS = 6;
/**
 * How much of a serpentine leg's path its turn cuts off, as a share of the leg's height: the traced path hugs the board
 * ends, so a leg gives about the depth less this share of its height.
 */
export const FOLD_LAYOUT_TURN_SHARE = 0.9;
