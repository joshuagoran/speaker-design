// What a placed box stands right against on the Space page (lib/speaker/spaceCoupling `spaceCoupling`), and the drag's
// snap flush against a wall or another box (`snapFlush`, through pages/space/useSpace `withBoxMoved`).
import { test } from "vite-plus/test";
import assert from "node:assert";
import { roomWalls, spaceCoupling } from "../src/lib/speaker/spaceCoupling";
import { expandPlacements, placementFrame } from "../src/lib/speaker/spaceLayout";
import { boxCorners, ORIGIN } from "../src/lib/speaker/stackLayout";
import { spacePlacement } from "../src/lib/speaker/specParts";
import { withBoxMoved } from "../src/pages/space/useSpace";
import {
  COUPLED_CEILING,
  COUPLED_FLOOR,
  OPEN_SIDE,
  SNAP_FLUSH_IN,
  SPACE_HOME_ROOM,
} from "../src/constants/space";
import { SPACE_ITEM } from "../src/constants/speakerSpec";
import { INCHES_PER_FOOT, METERS_PER_INCH } from "../src/constants/units";
import type { CoverageRoom, SpacePlacement } from "../src/types";

const ITEM = { kind: SPACE_ITEM.speaker, id: "sub" } as const;
/** A 2 ft cube, in. */
const CUBE = { w: 24, h: 24, d: 24 };
/** The cube's side, ft. */
const SIDE_FT = CUBE.w / INCHES_PER_FOOT;
/** A 20 × 30 ft room, drywall all round. */
const ROOM: CoverageRoom = SPACE_HOME_ROOM;
const HALF = ROOM.widthFt / 2;
/** The snap's reach, ft. */
const REACH_FT = SNAP_FLUSH_IN / INCHES_PER_FOOT;

/** A placement of the cube at a spot (its front center, ft), turned by `yawDeg`, lifted `liftIn`. */
const at = (x: number, y: number, yawDeg = 0, liftIn = 0, mirrored = false): SpacePlacement =>
  spacePlacement({ x, y }, ITEM, liftIn, { yawDeg, mirrored });

/** A box's size, in. */
type Size = typeof CUBE;

/** The placements as they stand, each one box (the cube, or its size in `sizes`) placed by the space's own frame. */
const standing = (placements: readonly SpacePlacement[], sizes: readonly Size[] = []) =>
  expandPlacements(placements).map((placement) => {
    const size = sizes[placement.source] ?? CUBE;
    // a box turns over about the middle of its height
    return {
      placement,
      standsOn: null,
      boxes: [
        { corners: boxCorners(ORIGIN, size).map(placementFrame(placement, size.h / 2).toRoom) },
      ],
    };
  });

/** What each box is coupled with, in the room (or another). */
const coupled = (placements: readonly SpacePlacement[], room: CoverageRoom = ROOM) =>
  spaceCoupling(standing(placements), room);

const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

test("coupling: the floor when the lift is within the gap", () => {
  assert.deepEqual(coupled([at(0, 10)]).boxes[0].surfaces, [COUPLED_FLOOR]);
  // 7.6 mm up still stands on it; an inch up does not
  assert.deepEqual(coupled([at(0, 10, 0, 0.3)]).boxes[0].surfaces, [COUPLED_FLOOR]);
  assert.ok(1 * METERS_PER_INCH > 0.01);
  assert.deepEqual(coupled([at(0, 10, 0, 1)]).boxes[0].surfaces, []);
});

test("coupling: each wall a face is flush with, and its stretch of wall marked", () => {
  // facing down the room, the box stands behind its spot: its back meets the front wall
  const front = coupled([at(0, SIDE_FT)]);
  assert.deepEqual(front.boxes[0].surfaces, [COUPLED_FLOOR, "front"]);
  assert.equal(front.marks.length, 1);
  const [m] = front.marks;
  assert.ok(near(m.from.y, 0) && near(m.to.y, 0));
  assert.ok(near(Math.min(m.from.x, m.to.x), -1) && near(Math.max(m.from.x, m.to.x), 1));
  // turned round at the back wall
  assert.deepEqual(coupled([at(0, ROOM.lengthFt - SIDE_FT, 180)]).boxes[0].surfaces, [
    COUPLED_FLOOR,
    "back",
  ]);
  // the left wall is at -x, the right at +x; in a corner, both walls
  assert.deepEqual(coupled([at(-HALF + 1, 10)]).boxes[0].surfaces, [COUPLED_FLOOR, "left"]);
  assert.deepEqual(coupled([at(HALF - 1, 10)]).boxes[0].surfaces, [COUPLED_FLOOR, "right"]);
  assert.deepEqual(coupled([at(-HALF + 1, SIDE_FT)]).boxes[0].surfaces, [
    COUPLED_FLOOR,
    "front",
    "left",
  ]);
  // 2 cm off the wall is not coupled; an open side is no wall
  assert.deepEqual(coupled([at(0, SIDE_FT + 0.02 / 0.3048)]).boxes[0].surfaces, [COUPLED_FLOOR]);
  const openLeft = { ...ROOM, materials: { ...ROOM.materials, left: OPEN_SIDE } };
  assert.deepEqual(coupled([at(-HALF + 1, 10)], openLeft).boxes[0].surfaces, [COUPLED_FLOOR]);
});

test("coupling: two boxes side by side, with their shared face marked once", () => {
  const pair = coupled([at(0, 10), at(SIDE_FT, 10)]);
  assert.deepEqual(
    pair.boxes.map((b) => b.boxes),
    [[1], [0]],
  );
  assert.equal(pair.marks.length, 1);
  const [m] = pair.marks;
  assert.ok(near(m.from.x, 1) && near(m.to.x, 1));
  assert.ok(near(Math.min(m.from.y, m.to.y), 8) && near(Math.max(m.from.y, m.to.y), 10));
  // a 15 mm gap is not coupled; nor are two boxes that touch only at a corner
  assert.deepEqual(coupled([at(0, 10), at(SIDE_FT + 0.05, 10)]).boxes[0].boxes, []);
  assert.deepEqual(coupled([at(0, 10), at(SIDE_FT, 10 + SIDE_FT)]).boxes[0].boxes, []);
});

test("coupling: a box lifted onto another is coupled with it, not the floor; lifted clear, with nothing", () => {
  const stacked = coupled([at(0, 10), at(0, 10, 0, CUBE.h)]);
  assert.deepEqual(stacked.boxes[1], {
    surfaces: [],
    stages: [],
    boxes: [0],
    members: [{ surfaces: [], stages: [], boxes: [{ item: 0, box: 0 }] }],
  });
  assert.deepEqual(stacked.boxes[0], {
    surfaces: [COUPLED_FLOOR],
    stages: [],
    boxes: [1],
    members: [{ surfaces: [COUPLED_FLOOR], stages: [], boxes: [{ item: 1, box: 0 }] }],
  });
  // one on top of the other has no face to mark on the plan
  assert.equal(stacked.marks.length, 0);
  assert.deepEqual(coupled([at(0, 10), at(0, 10, 0, CUBE.h + 6)]).boxes[1].boxes, []);
  // above and beside: they share only an edge
  assert.deepEqual(coupled([at(0, 10), at(SIDE_FT, 10, 0, CUBE.h)]).boxes[1].boxes, []);
});

test("coupling: a rotated box meets a wall only with a face", () => {
  // a quarter turn: its back faces the left wall
  assert.deepEqual(coupled([at(-HALF + SIDE_FT, 10, 90)]).boxes[0].surfaces, [
    COUPLED_FLOOR,
    "left",
  ]);
  // at 45°, a corner on the front wall is not a face against it
  const corner = ((CUBE.d + CUBE.w / 2) / INCHES_PER_FOOT) * Math.SQRT1_2;
  const turned = standing([at(0, corner, 45)])[0].boxes[0].corners;
  assert.ok(near(Math.min(...turned.map((c) => c.y)), 0));
  assert.deepEqual(coupled([at(0, corner, 45)]).boxes[0].surfaces, [COUPLED_FLOOR]);
});

test("coupling: a mirrored pair stands as two boxes, coupled with each other at the center line", () => {
  const together = coupled([at(1, 10, 0, 0, true)]);
  assert.equal(together.boxes.length, 2);
  assert.deepEqual(
    together.boxes.map((b) => b.boxes),
    [[1], [0]],
  );
  // apart against the side walls: the box as set on the right, its image on the left
  const apart = coupled([at(HALF - 1, 10, 20, 0, true), at(0, 20)]);
  const walls = coupled([at(HALF - 1, 10, 0, 0, true)]);
  assert.deepEqual(
    walls.boxes.map((b) => b.surfaces),
    [
      [COUPLED_FLOOR, "right"],
      [COUPLED_FLOOR, "left"],
    ],
  );
  // toed in, neither meets a wall with a face
  assert.deepEqual(
    apart.boxes.map((b) => b.surfaces),
    [[COUPLED_FLOOR], [COUPLED_FLOOR], [COUPLED_FLOOR]],
  );
});

test("coupling: the ceiling when the top is within the gap, not marked; none outdoors or open", () => {
  /** the lift that puts the cube's top at the ceiling, in */
  const toCeiling = ROOM.ceilingFt * INCHES_PER_FOOT - CUBE.h;
  const up = coupled([at(0, 10, 0, toCeiling)]);
  assert.deepEqual(up.boxes[0].surfaces, [COUPLED_CEILING]);
  assert.deepEqual(up.boxes[0].members[0].surfaces, [COUPLED_CEILING]);
  assert.deepEqual(up.marks, []);
  assert.deepEqual(coupled([at(0, 10, 0, toCeiling - 1)]).boxes[0].surfaces, []);
  assert.deepEqual(
    coupled([at(0, 10, 0, toCeiling)], { ...ROOM, outdoors: true }).boxes[0].surfaces,
    [],
  );
  const open = { ...ROOM, materials: { ...ROOM.materials, [COUPLED_CEILING]: OPEN_SIDE } };
  assert.deepEqual(coupled([at(0, 10, 0, toCeiling)], open).boxes[0].surfaces, []);
});

test("coupling: outdoors there are no walls, only the ground and the other boxes", () => {
  const outdoors = { ...ROOM, outdoors: true };
  const out = coupled([at(-HALF + 1, SIDE_FT), at(-HALF + 1 + SIDE_FT, SIDE_FT)], outdoors);
  assert.deepEqual(
    out.boxes.map(({ surfaces, boxes }) => ({ surfaces, boxes })),
    [
      { surfaces: [COUPLED_FLOOR], boxes: [1] },
      { surfaces: [COUPLED_FLOOR], boxes: [0] },
    ],
  );
});

/** A drag of box `i` of `placements` to `to` (ft), snapping flush in `room`. */
const drag = (
  placements: readonly SpacePlacement[],
  i: number,
  to: { x: number; y: number },
  room: CoverageRoom = ROOM,
) => {
  const items = standing(placements);
  return withBoxMoved(placements, items[i].placement, to, room, {
    items,
    at: i,
    walls: roomWalls(room),
  });
};

test("snap: a box within reach of a wall snaps flush; beyond it, it stays on the grid", () => {
  // the back is a little under the reach off the front wall: flush
  const close = drag([at(0, 10)], 0, { x: 0.1, y: SIDE_FT + REACH_FT * 0.9 });
  assert.deepEqual([close[0].x, close[0].y], [0, SIDE_FT]);
  // a little over the reach: the quarter-foot grid
  const far = drag([at(0, 10)], 0, { x: 0.1, y: SIDE_FT + REACH_FT * 1.1 });
  assert.equal(far[0].y, Math.round((SIDE_FT + REACH_FT * 1.1) * 4) / 4);
  // into the corner: both walls
  const corner = drag([at(0, 10)], 0, { x: -HALF + 1 + 0.2, y: SIDE_FT + 0.2 });
  assert.deepEqual([corner[0].x, corner[0].y], [-HALF + 1, SIDE_FT]);
  // outdoors there is no wall to snap to
  const outdoors = drag([at(0, 10)], 0, { x: 0.1, y: SIDE_FT + 0.2 }, { ...ROOM, outdoors: true });
  assert.equal(outdoors[0].y, 2.25);
});

test("snap: a box within reach of another box's face snaps flush against it", () => {
  const placements = [at(0, 10), at(5, 10)];
  // the dragged box's left face 0.3 ft right of the other's right face
  const moved = drag(placements, 1, { x: SIDE_FT + 0.3, y: 10.1 });
  assert.deepEqual([moved[1].x, moved[1].y], [SIDE_FT, 10]);
  // and it is then coupled with it
  assert.deepEqual(coupled(moved).boxes[1].boxes, [0]);
  // a box at another height does not snap to it
  const lifted = [at(0, 10, 0, CUBE.h + 12), at(5, 10)];
  assert.equal(drag(lifted, 1, { x: SIDE_FT + 0.3, y: 10.1 })[1].x, 2.25);
});

test("snap: a mirrored pair's boxes snap together at the center line", () => {
  const moved = drag([at(4, 10, 0, 0, true)], 0, { x: 1.2, y: 10 });
  assert.equal(moved[0].x, 1);
  // its image dragged snaps the same
  assert.equal(drag([at(4, 10, 0, 0, true)], 1, { x: -1.2, y: 10 })[0].x, 1);
});

test("snap: a box turned off the room's square moves on the grid only", () => {
  const moved = drag([at(0, 10, 45)], 0, { x: 0.1, y: 1.6 });
  assert.deepEqual([moved[0].x, moved[0].y], [0, 1.5]);
});

test("snap: never into another box: the nearest snap that would overlap one gives way", () => {
  // a 3 in deep panel against the front wall, and a 25 in deep box dragged with its back 0.1 ft into it
  const depthFt = 25 / INCHES_PER_FOOT;
  const panel = { w: 24, h: 24, d: 3 };
  const placements = [at(0, panel.d / INCHES_PER_FOOT), at(0, 10)];
  const items = standing(placements, [panel, { ...CUBE, d: 25 }]);
  const raw = { x: 0, y: depthFt + 0.1 };
  const moved = withBoxMoved(placements, items[1].placement, raw, ROOM, {
    items,
    at: 1,
    walls: roomWalls(ROOM),
  });
  // the front wall is nearer, but flush with it the box would stand in the panel: it meets the panel's face instead
  assert.ok(near(moved[1].y, depthFt + panel.d / INCHES_PER_FOOT));
});

test("snap: off (or Alt held), a drag moves on the quarter-foot grid", () => {
  const moved = withBoxMoved(
    [at(0, 10)],
    standing([at(0, 10)])[0].placement,
    { x: 0.1, y: 2.1 },
    ROOM,
  );
  assert.deepEqual([moved[0].x, moved[0].y], [0, 2]);
  const free = withBoxMoved(
    [at(0, 10)],
    standing([at(0, 10)])[0].placement,
    { x: 0.1, y: 2.2 },
    ROOM,
  );
  assert.equal(free[0].y, 2.25);
});
