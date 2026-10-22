// A folded horn's board editing in the side section (`HornFold`), as pure functions: every edit takes a fold and
// returns a new one, and never changes its input. Boards join end to end (a corner), stop on a wall, or butt another
// board's face; an end marked `square` is held at 90° to what it meets. Dragging needs the fold as it was when the drag
// began, so `startEndDrag` and `startBoardDrag` return a record that `dragEnd` and `dragBoard` read each time the
// pointer moves.
import { clamp } from "../clamp";
import {
  FOLD_EDGE_TOL_IN,
  FOLD_END,
  FOLD_MIN_BOARD_IN,
  FOLD_SNAP_IN,
  FOLD_SNAP_TO_IN,
} from "../../constants/foldHorn";
import { FOLD_WALL } from "../../constants/speakerSpec";
import type { FoldBoard, FoldWall, HornFold, SidePoint } from "../../types";
import {
  JOIN_IN,
  add,
  cross,
  dot,
  jointAt,
  left,
  len,
  segDist,
  sub,
  unit,
  type BoardEnd,
} from "./foldGeometry";

/** The chamber's side section: how far back (`depthIn`) and up (`heightIn`) the boards may reach, in. */
export interface FoldBox {
  depthIn: number;
  heightIn: number;
}

/** What the editing needs besides the boards: the chamber's side section and the boards' thickness `boardIn`, in. */
interface Frame extends FoldBox {
  boardIn: number;
}

/**
 * What a board end meets: a corner (another board's end, with that board's far end and the direction to it), a wall,
 * or another board's face (a butt). `dir` is the direction of what it meets, a unit vector.
 */
export type FoldPartner =
  | (BoardEnd & { kind: typeof FOLD_END.corner; far: SidePoint; dir: SidePoint })
  | { kind: typeof FOLD_END.wall; wall: FoldWall; dir: SidePoint }
  | { kind: typeof FOLD_END.butt; board: number; dir: SidePoint };

const snapStep = (v: number) => Math.round(v / FOLD_SNAP_IN) * FOLD_SNAP_IN;
const otherEnd = (end: BoardEnd["end"]): BoardEnd["end"] => (end === "a" ? "b" : "a");
const inBox = (box: FoldBox, q: SidePoint): SidePoint => ({
  zIn: clamp(q.zIn, 0, box.depthIn),
  yIn: clamp(q.yIn, 0, box.heightIn),
});
const copyPoint = (p: SidePoint): SidePoint => ({ zIn: p.zIn, yIn: p.yIn });
const copyBoard = (bd: FoldBoard): FoldBoard => ({
  a: copyPoint(bd.a),
  b: copyPoint(bd.b),
  ...(bd.square ? { square: { ...bd.square } } : {}),
});
/** A copy of the fold's boards, for an edit to change in place and return; the fold itself is never touched. */
const workingBoards = (fold: HornFold): FoldBoard[] => fold.boards.map(copyBoard);

// ---- what ends meet

/** What board `i`'s end `end` meets, or null for a free end. A corner wins over a wall, a wall over a face. */
function partnerIn(
  boards: readonly FoldBoard[],
  frame: Frame,
  i: number,
  end: BoardEnd["end"],
): FoldPartner | null {
  const endPoint = boards[i][end];
  const joint = jointAt(boards, endPoint, i)[0];
  if (joint) {
    const o = boards[joint.board];
    const far = joint.end === "a" ? o.b : o.a;
    return { kind: FOLD_END.corner, ...joint, far: copyPoint(far), dir: unit(sub(far, endPoint)) };
  }
  const upright = { zIn: 0, yIn: 1 };
  const level = { zIn: 1, yIn: 0 };
  if (Math.abs(endPoint.zIn) < JOIN_IN)
    return { kind: FOLD_END.wall, wall: FOLD_WALL.baffle, dir: upright };
  if (Math.abs(endPoint.zIn - frame.depthIn) < JOIN_IN)
    return { kind: FOLD_END.wall, wall: FOLD_WALL.back, dir: upright };
  if (Math.abs(endPoint.yIn) < JOIN_IN)
    return { kind: FOLD_END.wall, wall: FOLD_WALL.bottom, dir: level };
  if (Math.abs(endPoint.yIn - frame.heightIn) < JOIN_IN)
    return { kind: FOLD_END.wall, wall: FOLD_WALL.top, dir: level };
  for (const [j, o] of boards.entries()) {
    if (j === i) continue;
    const { d, t } = segDist(endPoint, o.a, o.b);
    if (d <= frame.boardIn / 2 + FOLD_EDGE_TOL_IN && t > 0 && t < 1)
      return { kind: FOLD_END.butt, board: j, dir: unit(sub(o.b, o.a)) };
  }
  return null;
}

/** What board `board`'s end `end` meets, or null for a free end. */
export function partnerAt(
  fold: HornFold,
  box: FoldBox,
  boardIn: number,
  board: number,
  end: BoardEnd["end"],
): FoldPartner | null {
  return partnerIn(fold.boards, { ...box, boardIn }, board, end);
}

/** What the end meets when it is held at 90° to it (at a corner, either board's end may carry the hold), else null. */
function heldIn(
  boards: readonly FoldBoard[],
  frame: Frame,
  i: number,
  end: BoardEnd["end"],
): FoldPartner | null {
  const partner = partnerIn(boards, frame, i, end);
  if (!partner) return null;
  const held =
    boards[i].square?.[end] ||
    (partner.kind === FOLD_END.corner && boards[partner.board].square?.[partner.end]);
  return held ? partner : null;
}

/** Whether board `board`'s end `end` is held at 90° to what it meets. */
export function isSquare(
  fold: HornFold,
  box: FoldBox,
  boardIn: number,
  board: number,
  end: BoardEnd["end"],
): boolean {
  return heldIn(fold.boards, { ...box, boardIn }, board, end) !== null;
}

// ---- editing a working copy of the boards (private: these change the array they get)

/** Mark board `i`'s end `end` held or not; at a corner the other board's end carries the same mark. */
function setSquareIn(
  boards: FoldBoard[],
  frame: Frame,
  i: number,
  end: BoardEnd["end"],
  on: boolean,
) {
  const partner = partnerIn(boards, frame, i, end);
  boards[i].square = { ...boards[i].square, [end]: on };
  if (partner?.kind === FOLD_END.corner)
    boards[partner.board].square = { ...boards[partner.board].square, [partner.end]: on };
}

/** The point nearest `p` where `pointA` and `pointB` see each other at 90° (the circle with the line from A to B as its diameter). */
function thales(box: FoldBox, pointA: SidePoint, pointB: SidePoint, p: SidePoint): SidePoint {
  const mid = { zIn: (pointA.zIn + pointB.zIn) / 2, yIn: (pointA.yIn + pointB.yIn) / 2 };
  const u = unit(sub(p, mid));
  return inBox(box, len(u) ? add(mid, u, len(sub(pointB, pointA)) / 2) : p);
}

/** Move board `i`'s end `end`, and the ends joined to it, to `to`. */
function moveEndIn(boards: FoldBoard[], i: number, end: BoardEnd["end"], to: SidePoint) {
  const joined = jointAt(boards, boards[i][end], i);
  boards[i][end] = copyPoint(to);
  for (const o of joined) boards[o.board][o.end] = copyPoint(to);
}

/**
 * Make board `i`'s end `end` meet its partner at 90°: the joint stays put and a board swings round it, keeping its
 * length (at a corner, the board further from level or upright).
 */
function squareUpIn(boards: FoldBoard[], frame: Frame, i: number, end: BoardEnd["end"]) {
  const partner = partnerIn(boards, frame, i, end);
  if (!partner) return;
  let k = i;
  let kEnd = end;
  let ref = partner.dir;
  if (partner.kind === FOLD_END.corner) {
    /** how far a board is from level or upright: 0 when it is either */
    const off = (bd: FoldBoard) => {
      const d = unit(sub(bd.b, bd.a));
      return Math.min(Math.abs(d.zIn), Math.abs(d.yIn));
    };
    if (off(boards[partner.board]) > off(boards[i])) {
      k = partner.board;
      kEnd = partner.end;
      ref = unit(sub(boards[i][otherEnd(end)], boards[i][end]));
    }
  }
  const bd = boards[k];
  const endPoint = bd[kEnd];
  const farEnd = otherEnd(kEnd);
  const farPoint = bd[farEnd];
  const normal = left(ref);
  const side = dot(sub(farPoint, endPoint), normal) >= 0 ? 1 : -1;
  moveEndIn(
    boards,
    k,
    farEnd,
    inBox(frame, add(endPoint, normal, side * len(sub(farPoint, endPoint)))),
  );
}

/** The boards that move as one with board `i`: those held square to it at a corner, or butting it held square. */
function rigidGroupIn(boards: readonly FoldBoard[], frame: Frame, i: number): Set<number> {
  const group = new Set([i]);
  const todo = [i];
  const join = (j: number) => {
    if (group.has(j)) return;
    group.add(j);
    todo.push(j);
  };
  for (let g = todo.pop(); g !== undefined; g = todo.pop()) {
    for (const end of ["a", "b"] as const) {
      const partner = heldIn(boards, frame, g, end);
      if (partner?.kind === FOLD_END.corner) join(partner.board);
    }
    boards.forEach((_, k) => {
      for (const end of ["a", "b"] as const) {
        const partner = heldIn(boards, frame, k, end);
        if (partner?.kind === FOLD_END.butt && partner.board === g) join(k);
      }
    });
  }
  return group;
}

/**
 * A point snapped to the grid, then onto another board's end (a corner), a wall, or another board's face. The boards
 * in `skip` (the one dragged and those joined to it) are not snapped to.
 */
function snapIn(
  boards: readonly FoldBoard[],
  frame: Frame,
  p: SidePoint,
  skip: readonly number[],
): SidePoint {
  let q = {
    zIn: clamp(snapStep(p.zIn), 0, frame.depthIn),
    yIn: clamp(snapStep(p.yIn), 0, frame.heightIn),
  };
  for (const [i, bd] of boards.entries()) {
    if (skip.includes(i)) continue;
    for (const end of ["a", "b"] as const)
      if (len(sub(q, bd[end])) < FOLD_SNAP_TO_IN * 1.5) return copyPoint(bd[end]);
  }
  if (q.zIn < FOLD_SNAP_TO_IN) q.zIn = 0;
  if (q.zIn > frame.depthIn - FOLD_SNAP_TO_IN) q.zIn = frame.depthIn;
  if (q.yIn < FOLD_SNAP_TO_IN) q.yIn = 0;
  if (q.yIn > frame.heightIn - FOLD_SNAP_TO_IN) q.yIn = frame.heightIn;
  boards.forEach((bd, i) => {
    if (skip.includes(i)) return;
    const { d, t } = segDist(q, bd.a, bd.b);
    if (d < frame.boardIn / 2 + FOLD_SNAP_TO_IN && d > JOIN_IN) {
      const on = add(bd.a, sub(bd.b, bd.a), t);
      q = add(on, unit(sub(q, on)), frame.boardIn / 2);
    }
  });
  return q;
}

/** A point as an end of a new or dragged board lands: on the grid, then on a nearby board's end, a wall or a face. */
export function snapEnd(
  fold: HornFold,
  box: FoldBox,
  boardIn: number,
  p: SidePoint,
  skip: readonly number[] = [],
): SidePoint {
  return snapIn(fold.boards, { ...box, boardIn }, p, skip);
}

// ---- edits

/**
 * The fold with a new board from `a` to `b` (pointer points: both are snapped as `snapEnd` does). A board shorter than
 * `FOLD_MIN_BOARD_IN` is not added: the same fold comes back.
 */
export function addBoard(
  fold: HornFold,
  box: FoldBox,
  boardIn: number,
  a: SidePoint,
  b: SidePoint,
): HornFold {
  const frame = { ...box, boardIn };
  const snappedA = snapIn(fold.boards, frame, a, []);
  const snappedB = snapIn(fold.boards, frame, b, []);
  if (len(sub(snappedB, snappedA)) < FOLD_MIN_BOARD_IN) return fold;
  return { ...fold, boards: [...workingBoards(fold), { a: snappedA, b: snappedB }] };
}

/** The fold without board `board`; the drivers' board index follows, and drivers on the deleted board are removed. */
export function deleteBoard(fold: HornFold, board: number): HornFold {
  const drivers = fold.drivers;
  return {
    ...fold,
    boards: workingBoards(fold).filter((_, i) => i !== board),
    drivers:
      !drivers || drivers.board === board
        ? null
        : { ...drivers, board: drivers.board > board ? drivers.board - 1 : drivers.board },
  };
}

/**
 * The fold with the corner at board `board`'s end `end` pulled apart: the other boards' ends there move 1 in back along
 * themselves (half their length when shorter), and the corner's hold is dropped.
 */
export function unjoinCorner(
  fold: HornFold,
  box: FoldBox,
  boardIn: number,
  board: number,
  end: BoardEnd["end"],
): HornFold {
  const boards = workingBoards(fold);
  const endPoint = boards[board][end];
  setSquareIn(boards, { ...box, boardIn }, board, end, false);
  for (const { board: j, end: e } of jointAt(boards, endPoint, board)) {
    const o = boards[j];
    const far = e === "a" ? o.b : o.a;
    o[e] = add(endPoint, unit(sub(far, endPoint)), Math.min(1, len(sub(far, endPoint)) / 2));
  }
  return { ...fold, boards };
}

/** The fold with board `board`'s end `end` held at 90° to what it meets (squared up now), or released when held. */
export function toggleSquare(
  fold: HornFold,
  box: FoldBox,
  boardIn: number,
  board: number,
  end: BoardEnd["end"],
): HornFold {
  const frame = { ...box, boardIn };
  const boards = workingBoards(fold);
  const on = heldIn(boards, frame, board, end) === null;
  setSquareIn(boards, frame, board, end, on);
  if (on) squareUpIn(boards, frame, board, end);
  return { ...fold, boards };
}

// ---- dragging

/** A board end being dragged: the fold as the drag began, and the holds at both ends as they were then. */
export interface EndDrag extends BoardEnd {
  start: HornFold;
  frame: Frame;
  /** the ends joined to the dragged end */
  joined: BoardEnd[];
  /** what the dragged end is held square to, if held */
  mine: FoldPartner | null;
  /** what the far end is held square to, if held */
  theirs: FoldPartner | null;
  /** the dragged end at the start */
  endAtStart: SidePoint;
  /** the far end at the start */
  farAtStart: SidePoint;
  /** the ends joined to the far end */
  joinedOther: BoardEnd[];
}

/** Begin dragging board `board`'s end `end` of `fold`. */
export function startEndDrag(
  fold: HornFold,
  box: FoldBox,
  boardIn: number,
  board: number,
  end: BoardEnd["end"],
): EndDrag {
  const frame = { ...box, boardIn };
  const bd = fold.boards[board];
  const far = otherEnd(end);
  return {
    board,
    end,
    start: fold,
    frame,
    joined: jointAt(fold.boards, bd[end], board),
    mine: heldIn(fold.boards, frame, board, end),
    theirs: heldIn(fold.boards, frame, board, far),
    endAtStart: copyPoint(bd[end]),
    farAtStart: copyPoint(bd[far]),
    joinedOther: jointAt(fold.boards, bd[far], board),
  };
}

/**
 * The fold with the dragged end at the pointer `p`. A free end snaps (`snapEnd`, not onto its own board or the ones
 * joined to it). Held at a corner: the end moves round the circle on which it keeps 90°. Held to a wall or another
 * board's face: it slides along it with its board. With the far end held: it moves straight out from the far end.
 */
export function dragEnd(drag: EndDrag, p: SidePoint): HornFold {
  const { board, end, mine, theirs, endAtStart, farAtStart, frame, joined, joinedOther } = drag;
  const boards = workingBoards(drag.start);
  const far = otherEnd(end);
  let q: SidePoint;
  if (mine?.kind === FOLD_END.corner) q = thales(frame, farAtStart, mine.far, p);
  else if (mine) {
    q = inBox(frame, add(endAtStart, mine.dir, snapStep(dot(sub(p, endAtStart), mine.dir))));
    const to = inBox(frame, add(farAtStart, sub(q, endAtStart)));
    boards[board][far] = to;
    for (const o of joinedOther) boards[o.board][o.end] = copyPoint(to);
  } else if (theirs) {
    const normal = left(theirs.dir);
    q = inBox(frame, add(farAtStart, normal, snapStep(dot(sub(p, farAtStart), normal))));
  } else q = snapIn(boards, frame, p, [board, ...joined.map((o) => o.board)]);
  boards[board][end] = q;
  for (const o of joined) boards[o.board][o.end] = copyPoint(q);
  return { ...drag.start, boards };
}

/** A board being dragged: the fold as the drag began, and what moves with the board. */
export interface BoardDrag {
  start: HornFold;
  frame: Frame;
  /** the boards that move whole: the dragged one and those held square to it */
  group: number[];
  /** where the pointer was at the start */
  from: SidePoint;
  /** the ends of other boards that follow: joined to the group's ends, or butting its faces */
  joined: BoardEnd[];
  /** the directions the move must keep to: held walls and faces it slides along */
  slides: SidePoint[];
}

/** Begin dragging board `board` of `fold`, grabbed at the pointer point `from`. */
export function startBoardDrag(
  fold: HornFold,
  box: FoldBox,
  boardIn: number,
  board: number,
  from: SidePoint,
): BoardDrag {
  const frame = { ...box, boardIn };
  const boards = fold.boards;
  const group = rigidGroupIn(boards, frame, board);
  const joined = [...group].flatMap((g) => {
    const host = boards[g];
    const butting = boards.flatMap((o, j) =>
      group.has(j)
        ? []
        : (["a", "b"] as const)
            .filter((end) => {
              const { d, t } = segDist(o[end], host.a, host.b);
              return d <= boardIn / 2 + FOLD_EDGE_TOL_IN && t > 0 && t < 1;
            })
            .map((end) => ({ board: j, end })),
    );
    return [
      ...(["a", "b"] as const).flatMap((end) =>
        jointAt(boards, host[end], g).filter((o) => !group.has(o.board)),
      ),
      ...butting,
    ];
  });
  const slides = [...group].flatMap((g) =>
    (["a", "b"] as const).flatMap((end) => {
      const partner = heldIn(boards, frame, g, end);
      return partner &&
        partner.kind !== FOLD_END.corner &&
        !(partner.kind === FOLD_END.butt && group.has(partner.board))
        ? [partner.dir]
        : [];
    }),
  );
  return { start: fold, frame, group: [...group], from: copyPoint(from), joined, slides };
}

/**
 * The fold with the dragged board, and what is held square to it, moved by the pointer's travel to `p` in grid steps.
 * Held walls and faces limit the move to a slide along them; joined ends and ends butting the group follow.
 */
export function dragBoard(drag: BoardDrag, p: SidePoint): HornFold {
  const { frame, from, group, joined, slides, start } = drag;
  const boards = workingBoards(start);
  let travel: SidePoint = { zIn: snapStep(p.zIn - from.zIn), yIn: snapStep(p.yIn - from.yIn) };
  for (const d of slides) {
    const along = dot(travel, d);
    travel = { zIn: d.zIn * along, yIn: d.yIn * along };
  }
  const moved = (pt: SidePoint) => inBox(frame, add(pt, travel));
  for (const g of group) {
    boards[g].a = moved(start.boards[g].a);
    boards[g].b = moved(start.boards[g].b);
  }
  for (const { board, end } of joined) boards[board][end] = moved(start.boards[board][end]);
  return { ...start, boards };
}

// ---- cutlist

/** What a cut end meets: a corner or a butt with another board (its index), a wall, or nothing. */
export type FoldCutMeets =
  | { kind: typeof FOLD_END.corner | typeof FOLD_END.butt; board: number }
  | { kind: typeof FOLD_END.wall; wall: FoldWall }
  | { kind: typeof FOLD_END.free };

/** One end of a board's cut: what it meets, and the saw angle off square, in degrees (0 is a square cut). */
export interface FoldCutEnd {
  meets: FoldCutMeets;
  cutDeg: number;
}

/** One board's cut: its long edge, the length of its center line, the chamber width and each end. All in. */
export interface FoldCut {
  board: number;
  longIn: number;
  lengthIn: number;
  widthIn: number;
  ends: Record<BoardEnd["end"], FoldCutEnd>;
}

/**
 * Each board's cut: its long edge, and at each end what it meets and the angle of its cut. A corner is cut on the
 * bisector of the two boards (a 90° corner: 45° each), a wall square to the wall, a butt flat against the other
 * board's near face. A free end is cut square. `widthIn` is the chamber's width, which every board spans.
 */
export function foldCutlist(
  fold: HornFold,
  box: FoldBox & { widthIn: number },
  boardIn: number,
): FoldCut[] {
  const boards = fold.boards;
  const frame = { ...box, boardIn };
  return boards.map((bd, i) => {
    const dir = unit(sub(bd.b, bd.a));
    const normal = left(dir);
    const lengthIn = len(sub(bd.b, bd.a));
    const cutEnd = (end: BoardEnd["end"]) => {
      const endPoint = bd[end];
      const away = end === "a" ? dir : { zIn: -dir.zIn, yIn: -dir.yIn };
      let line: { p: SidePoint; d: SidePoint } | null = null;
      let meets: FoldCutMeets = { kind: FOLD_END.free };
      const joint = jointAt(boards, endPoint, i)[0];
      if (joint) {
        const o = boards[joint.board];
        const oAway = unit(sub(joint.end === "a" ? o.b : o.a, o[joint.end]));
        const bisector = add(away, oAway);
        line = { p: endPoint, d: len(bisector) > 1e-6 ? unit(bisector) : left(away) };
        meets = { kind: FOLD_END.corner, board: joint.board };
      }
      if (!line) {
        const partner = partnerIn(boards, frame, i, end);
        if (partner?.kind === FOLD_END.wall) {
          line = { p: endPoint, d: partner.dir };
          meets = { kind: FOLD_END.wall, wall: partner.wall };
        }
      }
      // butting another board: cut to that board's near face
      if (!line)
        for (const [j, o] of boards.entries()) {
          if (j === i) continue;
          const { d, t } = segDist(endPoint, o.a, o.b);
          if (d > boardIn / 2 + FOLD_EDGE_TOL_IN || t <= 0 || t >= 1) continue;
          const od = unit(sub(o.b, o.a));
          const on = add(o.a, sub(o.b, o.a), t);
          const nn = left(od);
          const farEnd = end === "a" ? bd.b : bd.a;
          const side = dot(sub(farEnd, on), nn) >= 0 ? 1 : -1;
          line = { p: add(on, nn, (side * boardIn) / 2), d: od };
          meets = { kind: FOLD_END.butt, board: j };
          break;
        }
      const cutLine = line ?? { p: endPoint, d: normal };
      const ang = (Math.acos(Math.min(1, Math.abs(dot(dir, cutLine.d)))) * 180) / Math.PI;
      // where each face meets the cut line, along the board from its first end
      const turn = cross(dir, cutLine.d);
      const faces = [boardIn / 2, -boardIn / 2].map((h) =>
        Math.abs(turn) > 1e-9 ? cross(sub(cutLine.p, add(bd.a, normal, h)), cutLine.d) / turn : 0,
      );
      return { cutEnd: { meets, cutDeg: Math.abs(90 - ang) }, faces };
    };
    const a = cutEnd("a");
    const b = cutEnd("b");
    const spans = [0, 1].map((k) => b.faces[k] - a.faces[k]);
    return {
      board: i,
      longIn: Math.max(...spans, lengthIn),
      lengthIn,
      widthIn: box.widthIn,
      ends: { a: a.cutEnd, b: b.cutEnd },
    };
  });
}
