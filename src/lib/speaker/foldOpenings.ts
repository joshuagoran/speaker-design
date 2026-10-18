// A folded horn's openings in its walls (the mouth and the vent), as the editor places and drags them, as pure
// functions. An opening stays next to one run of air along its wall: it stops where a board meets the wall, so it
// never opens into the air on both sides of that board.
import { FOLD_SNAP_IN } from "../../constants/foldHorn";
import { FOLD_WALL } from "../../constants/speakerSpec";
import type { FoldGrid, FoldMouth, FoldWall, SidePoint } from "../../types";
import type { FoldBox } from "./foldBoards";

/** The grid an opening reads: `nz` cells across, `ny` up, `cellIn` each, the boards' cells marked solid. */
type OpeningGrid = Pick<FoldGrid, "nz" | "ny" | "cellIn" | "solid">;

/** A stretch along a wall, in: from `fromIn` to `toIn`, measured up an upright wall or back along the bottom or top. */
interface Span {
  fromIn: number;
  toIn: number;
}

/** The walls an opening runs up (baffle, back) rather than across (bottom, top). */
export const uprightWall = (wall: FoldWall) => wall === FOLD_WALL.baffle || wall === FOLD_WALL.back;

/** A wall's length in the side section, in: the height for the baffle and the back, the depth for the bottom and top. */
const wallSpan = (wall: FoldWall, box: FoldBox) => (uprightWall(wall) ? box.heightIn : box.depthIn);

/** The wall nearest `p`, and how far along that wall `p` is (`alongIn`). */
export function nearestWall(box: FoldBox, p: SidePoint): { wall: FoldWall; alongIn: number } {
  const dists: Record<FoldWall, number> = {
    [FOLD_WALL.baffle]: Math.abs(p.zIn),
    [FOLD_WALL.back]: Math.abs(box.depthIn - p.zIn),
    [FOLD_WALL.bottom]: Math.abs(p.yIn),
    [FOLD_WALL.top]: Math.abs(box.heightIn - p.yIn),
  };
  const wall = Object.values(FOLD_WALL).reduce((a, b) => (dists[b] < dists[a] ? b : a));
  return { wall, alongIn: uprightWall(wall) ? p.yIn : p.zIn };
}

/**
 * The run of air along a wall's inside that the place `alongIn` is next to: from the first air cell's edge to the last
 * one's, in. A board that meets the wall ends the run. Null where a board meets the wall at that place.
 */
export function airRun(grid: OpeningGrid, wall: FoldWall, alongIn: number): Span | null {
  const { nz, ny, cellIn, solid } = grid;
  const upright = uprightWall(wall);
  /** the cells along the wall, and the row (or column) next to it */
  const count = upright ? ny : nz;
  const row = wall === FOLD_WALL.back ? nz - 1 : wall === FOLD_WALL.top ? ny - 1 : 0;
  const isAir = (n: number) => !solid[upright ? n * nz + row : row * nz + n];
  const at = Math.min(count - 1, Math.max(0, Math.floor(alongIn / cellIn)));
  if (!isAir(at)) return null;
  let first = at;
  let last = at;
  while (first > 0 && isAir(first - 1)) first--;
  while (last < count - 1 && isAir(last + 1)) last++;
  return { fromIn: first * cellIn, toIn: (last + 1) * cellIn };
}

/** `v` on the snap step, inside `[lo, hi]` (an end on the step past it moves back inside). */
function snapWithin(v: number, lo: number, hi: number): number {
  const snapped = Math.round(v / FOLD_SNAP_IN) * FOLD_SNAP_IN;
  if (snapped < lo) return Math.ceil(lo / FOLD_SNAP_IN - 1e-9) * FOLD_SNAP_IN;
  if (snapped > hi) return Math.floor(hi / FOLD_SNAP_IN + 1e-9) * FOLD_SNAP_IN;
  return snapped;
}

/** The stretch an opening on `wall` may take: the run of air `run` (null: the whole wall). */
function limits(wall: FoldWall, box: FoldBox, run: Span | null): Span {
  const span = wallSpan(wall, box);
  return run
    ? { fromIn: Math.max(0, run.fromIn), toIn: Math.min(span, run.toIn) }
    : { fromIn: 0, toIn: span };
}

/**
 * A new opening for a click at `p`: on the nearest wall, `halfIn` each side of the click, on the snap step, kept inside
 * the run of air the click is next to. Null where a board meets the wall at the click.
 */
export function placeOpening(
  grid: OpeningGrid,
  box: FoldBox,
  p: SidePoint,
  halfIn: number,
): FoldMouth | null {
  const { wall, alongIn } = nearestWall(box, p);
  const run = airRun(grid, wall, alongIn);
  if (!run) return null;
  const { fromIn: lo, toIn: hi } = limits(wall, box, run);
  return {
    wall,
    fromIn: snapWithin(alongIn - halfIn, lo, hi),
    toIn: snapWithin(alongIn + halfIn, lo, hi),
  };
}

/** The run of air an opening is next to, at its middle; null where its middle is on a board. */
export const openingRun = (grid: OpeningGrid, opening: FoldMouth): Span | null =>
  airRun(grid, opening.wall, (opening.fromIn + opening.toIn) / 2);

/**
 * An opening with one end dragged to `p`: the other end stays at `fixedIn`, and the dragged one moves along the wall,
 * on the snap step, inside `run` (the run of air the opening was next to when the drag began; null: the whole wall).
 */
export function dragOpening(
  opening: FoldMouth,
  fixedIn: number,
  p: SidePoint,
  box: FoldBox,
  run: Span | null,
): FoldMouth {
  const { fromIn: lo, toIn: hi } = limits(opening.wall, box, run);
  const along = snapWithin(uprightWall(opening.wall) ? p.yIn : p.zIn, lo, hi);
  return { ...opening, fromIn: Math.min(fixedIn, along), toIn: Math.max(fixedIn, along) };
}
