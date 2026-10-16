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
