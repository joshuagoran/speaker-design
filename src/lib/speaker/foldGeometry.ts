// Plane geometry for a folded horn's side section (`HornFold`): vectors in `SidePoint` form, board ends that join,
// and each board as drawn. Pure; shared by the trace (foldTrace) and the editor's board helpers (foldBoards).
import type { FoldBoard, SidePoint } from "../../types";

/** Board ends closer than this, in, are one joint. */
export const JOIN_IN = 0.01;

export const sub = (p: SidePoint, q: SidePoint): SidePoint => ({
  zIn: p.zIn - q.zIn,
  yIn: p.yIn - q.yIn,
});
/** `p` plus `k` times `v` */
export const add = (p: SidePoint, v: SidePoint, k = 1): SidePoint => ({
  zIn: p.zIn + v.zIn * k,
  yIn: p.yIn + v.yIn * k,
});
export const len = (v: SidePoint) => Math.hypot(v.zIn, v.yIn);
export const dot = (v: SidePoint, w: SidePoint) => v.zIn * w.zIn + v.yIn * w.yIn;
/** the z-component of the 3D cross product: positive when `w` turns left from `v` */
export const cross = (v: SidePoint, w: SidePoint) => v.zIn * w.yIn - v.yIn * w.zIn;
/** `v` scaled to length 1; the zero vector stays zero */
export function unit(v: SidePoint): SidePoint {
  const l = len(v);
  return l > 0 ? { zIn: v.zIn / l, yIn: v.yIn / l } : { zIn: 0, yIn: 0 };
}
/** `v` turned 90° to the left */
export const left = (v: SidePoint): SidePoint => ({ zIn: -v.yIn, yIn: v.zIn });

/** The distance from `p` to the segment from `a` to `b`, and where along it the nearest point is (0 at `a`, 1 at `b`). */
export function segDist(p: SidePoint, a: SidePoint, b: SidePoint): { d: number; t: number } {
  const ab = sub(b, a);
  const l2 = dot(ab, ab);
  const t = l2 > 0 ? Math.min(1, Math.max(0, dot(sub(p, a), ab) / l2)) : 0;
  return { d: len(sub(p, add(a, ab, t))), t };
}

/** A board's end: its index in the boards and which end. */
export interface BoardEnd {
  board: number;
  end: "a" | "b";
}

/** The other boards' ends joined at `pt` (within `JOIN_IN`), leaving out board `skip`. */
export function jointAt(boards: readonly FoldBoard[], pt: SidePoint, skip: number): BoardEnd[] {
  return boards.flatMap((o, board) =>
    board === skip
      ? []
      : (["a", "b"] as const)
          .filter((end) => len(sub(o[end], pt)) < JOIN_IN)
          .map((end) => ({ board, end })),
  );
}

/**
 * Board `i` as drawn and traced: each end joined to another board's end runs on by half the board's thickness
 * (`boardIn`), so the corner closes.
 */
export function drawnSeg(
  boards: readonly FoldBoard[],
  i: number,
  boardIn: number,
): { a: SidePoint; b: SidePoint } {
  const bd = boards[i];
  const dir = unit(sub(bd.b, bd.a));
  return {
    a: jointAt(boards, bd.a, i).length ? add(bd.a, dir, -boardIn / 2) : bd.a,
    b: jointAt(boards, bd.b, i).length ? add(bd.b, dir, boardIn / 2) : bd.b,
  };
}
