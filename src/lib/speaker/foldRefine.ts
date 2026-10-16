// Design from goals' last step for a folded horn (docs/folded-horn-plan.md): from the best starting layout, each corner
// and the drivers' spot moved a little at a time while the score improves, so boards may angle, legs differ and the
// drivers sit anywhere on their board. Pure.
import type { FoldWall, HornBoards } from "../../types";
import { boardOutline, type FoldLayout, type FoldPoint } from "./hornBoards";
import {
  FOLD_NARROWING_DB,
  FOLD_REFINE_ROUNDS,
  FOLD_REFINE_STEPS_IN,
  FOLD_TOUCH_IN,
  FOLD_WALL,
} from "../../constants/hornBoards";

/**
 * How much the passage narrows along its legs, in dB of score: each leg's gates (its start and its end, not the gates
 * across its turns) in order from the closed end, and for each one lower than the one before, its share lower, times
 * `FOLD_NARROWING_DB`. A horn that only widens costs nothing.
 */
export function foldNarrowingDb(layout: Pick<FoldLayout, "gates">): number {
  // the gates are the closed end's, then per turn its leg's end, the turn's and the next leg's start, then the mouth's
  const heights = layout.gates.filter((_, i) => i % 3 !== 2).map((g) => g.heightIn);
  return heights.reduce(
    (sum, h, i) =>
      i === 0 || heights[i - 1] <= 0
        ? sum
        : sum + (FOLD_NARROWING_DB * Math.max(0, heights[i - 1] - h)) / heights[i - 1],
    0,
  );
}

/** One way a plan can move: `by` in along it (either sign); null when the move is not possible. */
type Move = (plan: HornBoards, by: number) => HornBoards | null;

/** A corner moved `dz` back and `dy` up. */
const cornerMoved =
  (i: number, dz: number, dy: number): Move =>
  (plan, by) => ({
    ...plan,
    corners: plan.corners.map((c, k) =>
      k === i ? { ...c, z: c.z + dz * by, y: c.y + dy * by } : c,
    ),
  });

/** The ways a corner on `wall` slides: along the wall only (the baffle and the back up, the top and the bottom back). */
const wallMoves = (i: number, wall: FoldWall): Move[] =>
  wall === FOLD_WALL.baffle || wall === FOLD_WALL.back
    ? [cornerMoved(i, 0, 1)]
    : [cornerMoved(i, 1, 0)];

/** A free corner resting on a board it does not end (a riser board's end on the drivers' board): it stays on it. */
interface Rest {
  corner: number;
  board: number;
}

/** How far a point is from a segment, in. */
function distToSegment(p: FoldPoint, a: FoldPoint, b: FoldPoint): number {
  const dz = b.z - a.z,
    dy = b.y - a.y;
  const len2 = dz * dz + dy * dy;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((p.z - a.z) * dz + (p.y - a.y) * dy) / len2)) : 0;
  return Math.hypot(p.z - a.z - t * dz, p.y - a.y - t * dy);
}

/** Whether corner `corner` touches board `board`'s outline. */
function touches(plan: HornBoards, wallIn: number, { corner, board }: Rest): boolean {
  const o = boardOutline(plan, board, wallIn);
  const c = plan.corners[corner];
  return o.some((p, j) => distToSegment(c, p, o[(j + 1) % o.length]) <= 2 * FOLD_TOUCH_IN);
}

/** Each free corner that rests on a board it does not end. */
function restsOf(plan: HornBoards, wallIn: number): Rest[] {
  return plan.corners.flatMap((c, corner) =>
    c.wall !== null
      ? []
      : plan.boards.flatMap((b, board) =>
          b.a !== corner && b.b !== corner && touches(plan, wallIn, { corner, board })
            ? [{ corner, board }]
            : [],
        ),
  );
}

/**
 * Every way the plan can move: each free corner back and up (one resting on a board along that board), each corner on
 * a wall along it, the drivers along their board.
 */
function movesOf(plan: HornBoards, rests: readonly Rest[]): Move[] {
  const corners = plan.corners.flatMap((c, i) => {
    if (c.wall !== null) return wallMoves(i, c.wall);
    const rest = rests.find((r) => r.corner === i);
    if (!rest) return [cornerMoved(i, 1, 0), cornerMoved(i, 0, 1)];
    const host = plan.boards[rest.board];
    const a = plan.corners[host.a],
      b = plan.corners[host.b];
    const len = Math.hypot(b.z - a.z, b.y - a.y) || 1;
    return [cornerMoved(i, (b.z - a.z) / len, (b.y - a.y) / len)];
  });
  const drivers: Move[] = plan.drivers
    ? [
        (p, by) =>
          p.drivers ? { ...p, drivers: { ...p.drivers, alongIn: p.drivers.alongIn + by } } : null,
      ]
    : [];
  return [...corners, ...drivers];
}

/**
 * The plan with its corners and drivers' spot moved while `score` improves (lower is better; null: the plan fails a
 * check or cannot be played): each step size of `FOLD_REFINE_STEPS_IN` in turn, each move both ways, a move kept as
 * soon as it scores better, until a round keeps none or `FOLD_REFINE_ROUNDS` rounds have run. A corner resting on a
 * board stays on it (`wallIn` thick boards), so no gap opens in the passage.
 */
export function refinedBoards(
  start: HornBoards,
  startScore: number,
  score: (plan: HornBoards) => number | null,
  wallIn: number,
): { plan: HornBoards; score: number } {
  let plan = start,
    best = startScore;
  const rests = restsOf(start, wallIn);
  const moves = movesOf(start, rests);
  for (const step of FOLD_REFINE_STEPS_IN)
    for (let round = 0; round < FOLD_REFINE_ROUNDS; round++) {
      let improved = false;
      for (const move of moves)
        for (const by of [step, -step]) {
          const moved = move(plan, by);
          // a move that lifts a resting corner off its board (the board moved away) is no move
          const next = moved && rests.every((r) => touches(moved, wallIn, r)) ? moved : null;
          const s = next && score(next);
          if (next && s !== null && s < best) {
            plan = next;
            best = s;
            improved = true;
            break;
          }
        }
      if (!improved) break;
    }
  return { plan, score: best };
}
