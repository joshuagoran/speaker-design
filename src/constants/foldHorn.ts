// A folded horn's trace (lib/speaker/foldTrace): the ids of its checks and the numbers the trace and its checks run on.

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
