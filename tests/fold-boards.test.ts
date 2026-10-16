// A folded horn's board editing (lib/speaker/foldBoards): joints held square, dragging ends and boards, unjoining,
// deleting and the cutlist. Every edit returns a new fold and leaves its input as it was.
import { describe, expect, test } from "vite-plus/test";
import { FOLD_END, FOLD_SNAP_IN } from "../src/constants/foldHorn";
import { FOLD_WALL } from "../src/constants/speakerSpec";
import {
  addBoard,
  deleteBoard,
  dragBoard,
  dragEnd,
  foldCutlist,
  isSquare,
  startBoardDrag,
  startEndDrag,
  toggleSquare,
  unjoinCorner,
} from "../src/lib/speaker/foldBoards";
import { dot, len, sub } from "../src/lib/speaker/foldGeometry";
import type { HornFold, SidePoint } from "../src/types";

const box = { depthIn: 30, heightIn: 40 };
const boardIn = 0.75;
const pt = (zIn: number, yIn: number): SidePoint => ({ zIn, yIn });
const mouth = { wall: FOLD_WALL.baffle, fromIn: 30, toIn: 40 };

/** the fold, and every object in it, frozen: an edit that changes its input throws */
function frozen<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(frozen);
    Object.freeze(value);
  }
  return value;
}
const foldOf = (boards: HornFold["boards"], drivers: HornFold["drivers"] = null): HornFold =>
  frozen({ boards, drivers, mouth });

/** the angle in degrees at `corner` between the lines to `p` and `q` */
const angleAt = (corner: SidePoint, p: SidePoint, q: SidePoint) => {
  const u = sub(p, corner);
  const v = sub(q, corner);
  return (Math.acos(dot(u, v) / (len(u) * len(v))) * 180) / Math.PI;
};
const near = (p: SidePoint, q: SidePoint) => len(sub(p, q)) < 1e-9;

/** a level board along the bottom of the box and a slanted one joined to it at (20, 10) */
const corner = () =>
  foldOf([
    { a: pt(0, 10), b: pt(20, 10) },
    { a: pt(20, 10), b: pt(26, 26) },
  ]);

describe("holding a corner square", () => {
  test("two boards joined at a corner meet at 90.00° once held square", () => {
    const fold = corner();
    const held = toggleSquare(fold, box, boardIn, 1, "a");
    const [first, second] = held.boards;
    expect(angleAt(first.b, first.a, second.b)).toBeCloseTo(90, 2);
    expect(isSquare(held, box, boardIn, 1, "a")).toBe(true);
    // the hold shows from either board's end
    expect(isSquare(held, box, boardIn, 0, "b")).toBe(true);
    // the board that swung keeps its length
    expect(len(sub(second.b, second.a))).toBeCloseTo(
      len(sub(fold.boards[1].b, fold.boards[1].a)),
      9,
    );
  });

  test("toggling a held corner again releases it", () => {
    const held = toggleSquare(corner(), box, boardIn, 1, "a");
    const released = toggleSquare(held, box, boardIn, 0, "b");
    expect(isSquare(released, box, boardIn, 1, "a")).toBe(false);
    expect(isSquare(released, box, boardIn, 0, "b")).toBe(false);
    expect(released.boards.map((bd) => bd.square)).toEqual([{ b: false }, { a: false }]);
  });

  test("dragging the free far end keeps the corner at 90°", () => {
    const held = toggleSquare(corner(), box, boardIn, 1, "a");
    const drag = startEndDrag(held, box, boardIn, 1, "b");
    const next = dragEnd(drag, pt(27.3, 33.9));
    const [first, second] = next.boards;
    expect(angleAt(first.b, first.a, second.b)).toBeCloseTo(90, 2);
    // the joint stays put; the end only moves straight out from it, in steps
    expect(near(second.a, pt(20, 10))).toBe(true);
    expect(second.b.zIn).toBeCloseTo(20, 9);
    expect(second.b.yIn).toBeGreaterThan(10);
    expect((second.b.yIn - 10) / FOLD_SNAP_IN).toBeCloseTo(
      Math.round((second.b.yIn - 10) / FOLD_SNAP_IN),
      6,
    );
  });

  test("dragging a held corner moves it round the circle that keeps 90°", () => {
    const held = toggleSquare(corner(), box, boardIn, 1, "a");
    const [first, second] = held.boards;
    const drag = startEndDrag(held, box, boardIn, 1, "a");
    const next = dragEnd(drag, pt(15, 5));
    const [nextFirst, nextSecond] = next.boards;
    // both boards' ends moved together, off where they were
    expect(near(nextFirst.b, nextSecond.a)).toBe(true);
    expect(near(nextSecond.a, second.a)).toBe(false);
    // the far ends stayed, and the corner still sees them at 90°
    expect(near(nextFirst.a, first.a)).toBe(true);
    expect(near(nextSecond.b, second.b)).toBe(true);
    expect(angleAt(nextSecond.a, nextFirst.a, nextSecond.b)).toBeCloseTo(90, 2);
  });
});

describe("dragging", () => {
  test("a board held square to others moves the whole group", () => {
    const held = toggleSquare(corner(), box, boardIn, 1, "a");
    const drag = startBoardDrag(held, box, boardIn, 0, pt(5, 10));
    expect([...drag.group].sort((x, y) => x - y)).toEqual([0, 1]);
    const next = dragBoard(drag, pt(7, 12));
    held.boards.forEach((bd, i) => {
      expect(near(next.boards[i].a, pt(bd.a.zIn + 2, bd.a.yIn + 2))).toBe(true);
      expect(near(next.boards[i].b, pt(bd.b.zIn + 2, bd.b.yIn + 2))).toBe(true);
    });
    expect(angleAt(next.boards[0].b, next.boards[0].a, next.boards[1].b)).toBeCloseTo(90, 2);
  });

  test("a board held square to the baffle slides along it", () => {
    const fold = foldOf([{ a: pt(0, 10), b: pt(12, 10), square: { a: true } }]);
    const drag = startBoardDrag(fold, box, boardIn, 0, pt(5, 10));
    expect(drag.slides).toHaveLength(1);
    const next = dragBoard(drag, pt(8, 14));
    expect(next.boards[0].a).toEqual(pt(0, 14));
    expect(next.boards[0].b).toEqual(pt(12, 14));
  });

  test("a board's end held square to the baffle slides, and the board goes with it", () => {
    const fold = foldOf([{ a: pt(0, 10), b: pt(12, 10), square: { a: true } }]);
    const drag = startEndDrag(fold, box, boardIn, 0, "a");
    const next = dragEnd(drag, pt(3, 16.1));
    expect(next.boards[0].a).toEqual(pt(0, 16));
    expect(next.boards[0].b).toEqual(pt(12, 16));
  });

  test("joined and butting ends follow a dragged board", () => {
    const fold = foldOf([
      { a: pt(0, 10), b: pt(20, 10) },
      { a: pt(20, 10), b: pt(20, 30) },
      { a: pt(10, 10.375), b: pt(10, 25) },
    ]);
    const drag = startBoardDrag(fold, box, boardIn, 0, pt(5, 10));
    expect(drag.group).toEqual([0]);
    const next = dragBoard(drag, pt(5, 12));
    expect(next.boards[0].a).toEqual(pt(0, 12));
    expect(next.boards[1].a).toEqual(pt(20, 12));
    expect(next.boards[2].a).toEqual(pt(10, 12.375));
    // what does not touch the board stays
    expect(next.boards[1].b).toEqual(pt(20, 30));
    expect(next.boards[2].b).toEqual(pt(10, 25));
  });

  test("a joined end moves in 0.25 in steps and does not stick to the other board's old end", () => {
    const fold = corner();
    const drag = startEndDrag(fold, box, boardIn, 1, "a");
    expect(drag.joined).toEqual([{ board: 0, end: "b" }]);
    const next = dragEnd(drag, pt(20.2, 10.1));
    expect(next.boards[1].a).toEqual(pt(20.25, 10));
    expect(next.boards[0].b).toEqual(pt(20.25, 10));
    const further = dragEnd(drag, pt(22.13, 11.9));
    expect(further.boards[1].a).toEqual(pt(22.25, 12));
    expect(further.boards[0].b).toEqual(pt(22.25, 12));
  });

  test("a dragged free end snaps onto a wall and onto another board's end", () => {
    const fold = foldOf([
      { a: pt(5, 20), b: pt(15, 20) },
      { a: pt(5, 30), b: pt(15, 30) },
    ]);
    const onWall = dragEnd(startEndDrag(fold, box, boardIn, 0, "a"), pt(0.4, 22.1));
    expect(onWall.boards[0].a.zIn).toBe(0);
    const onEnd = dragEnd(startEndDrag(fold, box, boardIn, 0, "b"), pt(15.3, 29.8));
    expect(onEnd.boards[0].b).toEqual(pt(15, 30));
  });
});

describe("unjoining", () => {
  test("pulls the ends apart and drops the hold", () => {
    const held = toggleSquare(corner(), box, boardIn, 1, "a");
    const next = unjoinCorner(held, box, boardIn, 0, "b");
    expect(near(next.boards[0].b, pt(20, 10))).toBe(true);
    expect(len(sub(next.boards[1].a, next.boards[0].b))).toBeCloseTo(1, 9);
    // the pulled end moved back along its own board
    expect(angleAt(next.boards[1].b, next.boards[1].a, pt(20, 10))).toBeCloseTo(0, 6);
    expect(isSquare(next, box, boardIn, 0, "b")).toBe(false);
    expect(next.boards[0].square?.b).toBe(false);
    expect(next.boards[1].square?.a).toBe(false);
  });
});

describe("adding and deleting boards", () => {
  test("a new board snaps its ends; one under 2 in is not added", () => {
    const fold = foldOf([{ a: pt(0, 10), b: pt(20, 10) }]);
    const next = addBoard(fold, box, boardIn, pt(20.1, 10.2), pt(20.2, 25.9));
    expect(next.boards).toHaveLength(2);
    // the first end snaps onto the other board's end
    expect(next.boards[1].a).toEqual(pt(20, 10));
    expect(next.boards[1].b).toEqual(pt(20.25, 26));
    expect(addBoard(fold, box, boardIn, pt(10, 20), pt(10.5, 21))).toBe(fold);
  });

  test("deleting a board re-indexes the drivers", () => {
    const boards = [
      { a: pt(0, 5), b: pt(20, 5) },
      { a: pt(0, 15), b: pt(20, 15) },
      { a: pt(0, 25), b: pt(20, 25) },
    ];
    const drivers = { board: 2, along: 0.5, face: 1 as const };
    expect(deleteBoard(foldOf(boards, drivers), 0).drivers).toEqual({ ...drivers, board: 1 });
    expect(deleteBoard(foldOf(boards, drivers), 2).drivers).toBeNull();
    expect(deleteBoard(foldOf(boards, drivers), 1).drivers).toEqual({ ...drivers, board: 1 });
    const after = deleteBoard(foldOf(boards, { ...drivers, board: 0 }), 2);
    expect(after.drivers?.board).toBe(0);
    expect(after.boards).toHaveLength(2);
  });
});

describe("cutlist", () => {
  const cutBox = { ...box, widthIn: 18 };

  test("an L joint gives two 45° miter cuts", () => {
    const held = toggleSquare(corner(), box, boardIn, 1, "a");
    const cuts = foldCutlist(held, cutBox, boardIn);
    expect(cuts).toHaveLength(2);
    expect(cuts[0].ends.b.meets).toEqual({ kind: FOLD_END.corner, board: 1 });
    expect(cuts[1].ends.a.meets).toEqual({ kind: FOLD_END.corner, board: 0 });
    expect(cuts[0].ends.b.cutDeg).toBeCloseTo(45, 6);
    expect(cuts[1].ends.a.cutDeg).toBeCloseTo(45, 6);
    expect(cuts[0].widthIn).toBe(18);
    // a mitered board is longest along its outside edge
    expect(cuts[0].longIn).toBeGreaterThanOrEqual(cuts[0].lengthIn);
    // the end on the baffle is square to it
    expect(cuts[0].ends.a.meets).toEqual({ kind: FOLD_END.wall, wall: FOLD_WALL.baffle });
    expect(cuts[0].ends.a.cutDeg).toBeCloseTo(0, 6);
  });

  test("a board butting another's face gets a square butt cut, a free end a square cut", () => {
    const fold = foldOf([
      { a: pt(0, 10), b: pt(20, 10) },
      { a: pt(10, 10.375), b: pt(10, 25) },
    ]);
    const cuts = foldCutlist(fold, cutBox, boardIn);
    expect(cuts[1].ends.a.meets).toEqual({ kind: FOLD_END.butt, board: 0 });
    expect(cuts[1].ends.a.cutDeg).toBeCloseTo(0, 6);
    expect(cuts[1].ends.b.meets).toEqual({ kind: FOLD_END.free });
    expect(cuts[1].ends.b.cutDeg).toBeCloseTo(0, 6);
    expect(cuts[1].longIn).toBeCloseTo(25 - 10.375, 6);
    expect(cuts[0].ends.b.meets).toEqual({ kind: FOLD_END.free });
  });
});

describe("pure edits", () => {
  test("no edit changes the fold it was given", () => {
    // the fold is deeply frozen: a change to it would throw
    const fold = foldOf(
      [
        { a: pt(0, 10), b: pt(20, 10) },
        { a: pt(20, 10), b: pt(26, 26) },
        { a: pt(10, 10.375), b: pt(10, 25) },
      ],
      { board: 1, along: 0.5, face: 1 },
    );
    const before = JSON.stringify(fold);
    const held = toggleSquare(fold, box, boardIn, 1, "a");
    expect(held).not.toBe(fold);
    const endDrag = startEndDrag(held, box, boardIn, 1, "a");
    const boardDrag = startBoardDrag(held, box, boardIn, 0, pt(5, 10));
    const results = [
      held,
      dragEnd(endDrag, pt(15, 5)),
      dragBoard(boardDrag, pt(9, 14)),
      unjoinCorner(held, box, boardIn, 0, "b"),
      addBoard(held, box, boardIn, pt(3, 30), pt(12, 31)),
      deleteBoard(held, 0),
    ];
    expect(JSON.stringify(fold)).toBe(before);
    expect(results.every((next) => next !== fold)).toBe(true);
    // the drag records stay valid for the next pointer move
    expect(dragEnd(endDrag, pt(15, 5))).toEqual(results[1]);
    expect(dragBoard(boardDrag, pt(9, 14))).toEqual(results[2]);
  });
});
