// A folded horn laid out in boards (lib/speaker/hornBoards, lib/speaker/foldLayouts): the gates and sections from the
// boards, the taps where the drivers sit, and each check failing when it should.
import { test } from "vite-plus/test";
import assert from "node:assert";
import {
  foldPasses,
  hornBoardsLayout,
  type FoldDriverBody,
  type FoldRoom,
} from "../src/lib/speaker/hornBoards";
import { zigzagBoards } from "../src/lib/speaker/foldLayouts";
import { FOLD_FACE, FOLD_MIN_PASSAGE_IN } from "../src/constants/hornBoards";
import { CM2_PER_IN2, CM_PER_IN } from "../src/constants/units";
import type { HornBoards } from "../src/types";

/** A 30 × 38 in side section, 21 in wide, 3/4 in walls. */
const ROOM: FoldRoom = { depthIn: 30, heightIn: 38, wallIn: 0.75, widthIn: 21 };
/** An 18″ sub's body: cutout, motor, depth behind its mounting face, excursion. */
const SUB18: FoldDriverBody = { cutoutIn: 16.6, motorIn: 9, depthIn: 7.5, xmaxIn: 0.5 };
/** Each leg's height in the four-leg zigzag, in. */
const LEG_H = (ROOM.heightIn - 3 * ROOM.wallIn) / 4;

const ZIGZAG = zigzagBoards(ROOM, 4);
const layoutOf = (plan: HornBoards, body: FoldDriverBody | null = SUB18) =>
  hornBoardsLayout(plan, ROOM, body);

/** The plan with corner `i` moved. */
const withCorner = (plan: HornBoards, i: number, z: number, y: number): HornBoards => ({
  ...plan,
  corners: plan.corners.map((c, k) => (k === i ? { ...c, z, y } : c)),
});

test("horn boards: a four-leg zigzag passes every check, its passage as high as a leg all the way", () => {
  const layout = layoutOf(ZIGZAG);
  assert.ok(foldPasses(layout), JSON.stringify(layout.checks));
  // the closed end's gate, three per turn, the mouth's
  assert.equal(layout.gates.length, 1 + 3 * 3 + 1);
  for (const g of layout.gates)
    assert.ok(Math.abs(g.heightIn - LEG_H) < 1e-6, `gate ${g.heightIn} in`);
  // four legs a turn short of the depth, plus the turns
  const legIn = ROOM.depthIn - LEG_H;
  assert.ok(
    layout.pathIn > 4 * legIn && layout.pathIn < 4 * ROOM.depthIn,
    `path ${layout.pathIn} in`,
  );
  // the sections run the whole path at one area
  const area = LEG_H * ROOM.widthIn * CM2_PER_IN2;
  assert.ok(
    layout.segments.every((s) => Math.abs(s.s1 - area) < 1e-6 && Math.abs(s.s2 - area) < 1e-6),
  );
  const totalCm = layout.segments.reduce((sum, s) => sum + s.length, 0);
  assert.ok(Math.abs(totalCm - layout.pathIn * CM_PER_IN) < 1e-6);
  assert.ok(Math.abs(layout.airLiters - (area * totalCm) / 1000) < 1e-6);
});

test("horn boards: the drivers' taps are where they sit along the first two legs", () => {
  const { taps } = layoutOf(ZIGZAG);
  const along = ZIGZAG.drivers?.alongIn ?? 0;
  assert.ok(taps?.front != null && taps.rear != null);
  // the fronts open into the first leg, which starts at the baffle
  assert.ok(Math.abs(taps.front - along) < 1e-6, `front ${taps.front} in`);
  // the backs into the second, which runs forward from the turn at the back
  assert.ok(
    taps.rear > ROOM.depthIn - LEG_H && taps.rear < 2 * ROOM.depthIn,
    `back ${taps.rear} in`,
  );
  // the fronts facing the other way swap the taps' legs
  const flipped = layoutOf({
    ...ZIGZAG,
    drivers: { board: 0, alongIn: along, coneFace: FOLD_FACE.offset },
  });
  assert.ok(flipped.taps && Math.abs((flipped.taps.rear ?? 0) - taps.front) < 1e-6);
});

test("horn boards: each check fails when it should", () => {
  // a free corner past the back wall
  assert.equal(
    layoutOf(withCorner(ZIGZAG, 1, ROOM.depthIn + 2, ZIGZAG.corners[1].y)).checks.outside,
    0,
  );
  // the second board's free end dropped through the first board
  const crossed = layoutOf(
    withCorner(ZIGZAG, 3, ZIGZAG.corners[3].z + 8, ZIGZAG.corners[0].y - 1),
  ).checks;
  assert.deepEqual(crossed.crossing, [0, 1]);
  // the second board lowered to just over the first: the passage between them is too low
  const low = ZIGZAG.corners[0].y + ROOM.wallIn + FOLD_MIN_PASSAGE_IN / 2;
  const squeezed = withCorner(withCorner(ZIGZAG, 2, ROOM.depthIn, low), 3, LEG_H, low);
  assert.notEqual(layoutOf(squeezed, null).checks.thin, null);
  // the drivers near the board's end: the cutout runs off it
  const offEnd = layoutOf({
    ...ZIGZAG,
    drivers: { board: 0, alongIn: 3, coneFace: FOLD_FACE.line },
  });
  assert.equal(offEnd.checks.drivers?.cutoutFits, false);
  // a magnet deeper than the leg above
  assert.equal(
    layoutOf(ZIGZAG, { ...SUB18, depthIn: LEG_H + 1 }).checks.drivers?.magnetClear,
    false,
  );
  // an excursion the leg below cannot take
  assert.equal(layoutOf(ZIGZAG, { ...SUB18, xmaxIn: LEG_H }).checks.drivers?.coneRoom, false);
  // the drivers on a board no leg runs along
  const stray: HornBoards = {
    ...ZIGZAG,
    corners: [...ZIGZAG.corners, { z: 10, y: 37, wall: null }, { z: 28, y: 37, wall: null }],
    boards: [...ZIGZAG.boards, { a: 6, b: 7, side: -1 }],
    drivers: { board: 3, alongIn: 9, coneFace: FOLD_FACE.line },
  };
  assert.equal(layoutOf(stray).checks.drivers?.facesPassage, false);
});

test("horn boards: a passage with no legs cannot be measured", () => {
  const layout = layoutOf({ ...ZIGZAG, legs: [] });
  assert.equal(layout.checks.broken, true);
  assert.equal(layout.segments.length, 0);
  assert.equal(foldPasses(layout), false);
});
