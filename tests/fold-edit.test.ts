// Hand edits to a folded horn's boards (lib/speaker/foldEdit): corners held to their walls, a whole board moved, the
// drivers slid along their board, and the boards kept on a box wall that moves.
import { test } from "vite-plus/test";
import assert from "node:assert";
import {
  withBoardMoved,
  withCornerAt,
  withDriversAt,
  withWallMoved,
} from "../src/lib/speaker/foldEdit";
import { zigzagBoards } from "../src/lib/speaker/foldLayouts";
import { FOLD_WALL } from "../src/constants/hornBoards";

const ROOM = { depthIn: 30, heightIn: 38, wallIn: 0.75 };
const PLAN = zigzagBoards(ROOM, 4);

test("fold edit: a corner on a wall slides along it, a free one goes anywhere inside, both snap", () => {
  // corner 0 is on the baffle: only its height moves
  const onWall = withCornerAt(PLAN, 0, { z: 7, y: 12.13 }, ROOM).corners[0];
  assert.deepEqual([onWall.z, onWall.y], [0, 12.25]);
  // corner 1 is free: both move, kept inside the room
  const free = withCornerAt(PLAN, 1, { z: 40, y: 5.1 }, ROOM).corners[1];
  assert.deepEqual([free.z, free.y], [ROOM.depthIn, 5]);
});

test("fold edit: a board moves whole, each end held to its wall", () => {
  const board = PLAN.boards[0];
  const moved = withBoardMoved(PLAN, 0, { z: 2, y: 3 }, ROOM);
  const a = moved.corners[board.a],
    b = moved.corners[board.b];
  // the baffle end only rises; the free end moves both ways
  assert.equal(a.z, 0);
  assert.equal(a.y, PLAN.corners[board.a].y + 3);
  assert.equal(b.z, PLAN.corners[board.b].z + 2);
  assert.equal(b.y, PLAN.corners[board.b].y + 3);
});

test("fold edit: the drivers slide along their board and stay on it", () => {
  assert.ok(PLAN.drivers);
  const board = PLAN.boards[PLAN.drivers.board];
  const a = PLAN.corners[board.a],
    b = PLAN.corners[board.b];
  const lengthIn = Math.hypot(b.z - a.z, b.y - a.y);
  assert.equal(withDriversAt(PLAN, { z: a.z + 5, y: a.y + 3 }).drivers?.alongIn, 5);
  assert.equal(withDriversAt(PLAN, { z: 999, y: a.y }).drivers?.alongIn, lengthIn);
});

test("fold edit: corners on a moved wall move with it, the rest stay", () => {
  const back = withWallMoved(PLAN, FOLD_WALL.back, 4);
  PLAN.corners.forEach((c, i) => {
    assert.equal(back.corners[i].z, c.wall === FOLD_WALL.back ? c.z + 4 : c.z);
    assert.equal(back.corners[i].y, c.y);
  });
});
