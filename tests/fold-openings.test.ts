// A folded horn's mouth and vent as the editor places and drags them (lib/speaker/foldOpenings): each stays next to
// one run of air along its wall, so a placement never opens the passage into the rear chamber.
import { describe, expect, test } from "vite-plus/test";
import assert from "node:assert";
import { FOLD_CHECK } from "../src/constants/foldHorn";
import { FOLD_WALL } from "../src/constants/speakerSpec";
import { foldTrace, type FoldDriverShape, type FoldTraceInput } from "../src/lib/speaker/foldTrace";
import { traceModel } from "../src/lib/speaker/foldHorn";
import {
  airRun,
  dragOpening,
  nearestWall,
  openingRun,
  placeOpening,
  uprightWall,
} from "../src/lib/speaker/foldOpenings";
import type { FoldBoard, FoldWall, HornFold, SidePoint } from "../src/types";

/** one 18″ driver, as the mock sets it */
const DRIVER_18: FoldDriverShape = { cutoutIn: 16.6, depthIn: 8.2, motorIn: 7.6, count: 1 };
const pt = (zIn: number, yIn: number): SidePoint => ({ zIn, yIn });
const board = (a: SidePoint, b: SidePoint): FoldBoard => ({ a, b });
/** the mock's front-loaded serpentine, in a 30 × 40 in side section 20 in wide: the rear chamber is under y = 12 */
const FRONT: HornFold = {
  boards: [
    board(pt(0, 12), pt(30, 12)),
    board(pt(30, 21), pt(8, 21)),
    board(pt(0, 30), pt(22, 30)),
  ],
  drivers: { board: 0, along: 0.66, face: 1 },
  mouth: { wall: FOLD_WALL.baffle, fromIn: 30.75, toIn: 40 },
};
const ROOM: Omit<FoldTraceInput, "fold"> = {
  depthIn: 30,
  heightIn: 40,
  widthIn: 20,
  boardIn: 0.75,
  driver: DRIVER_18,
};
const BOX = { depthIn: ROOM.depthIn, heightIn: ROOM.heightIn };
const GRID = foldTrace({ ...ROOM, fold: FRONT }).grid;
/** the editor's new mouth and vent: this far each side of the click, in */
const MOUTH_HALF_IN = 4;
const VENT_HALF_IN = 1.5;
const model = (fold: HornFold) => traceModel(foldTrace({ ...ROOM, fold }));
/** a click just inside `wall`, `alongIn` along it */
const onWall = (wall: FoldWall, alongIn: number): SidePoint =>
  wall === FOLD_WALL.baffle
    ? pt(0.1, alongIn)
    : wall === FOLD_WALL.back
      ? pt(BOX.depthIn - 0.1, alongIn)
      : wall === FOLD_WALL.bottom
        ? pt(alongIn, 0.1)
        : pt(alongIn, BOX.heightIn - 0.1);

describe("the vent that did not model", () => {
  test("the mouth the old tool placed just over the driver board opened into the rear chamber", () => {
    // a click on the baffle 13 in up, next to the passage: the old tool opened 9–17 in, across the board at 12 in
    const across: HornFold = { ...FRONT, mouth: { wall: FOLD_WALL.baffle, fromIn: 9, toIn: 17 } };
    expect(model(FRONT).drive).not.toBeNull();
    expect(model(across).drive).toBeNull();
  });

  test("the mouth tool stops at the board, and the horn still models", () => {
    const mouth = placeOpening(GRID, BOX, onWall(FOLD_WALL.baffle, 13), MOUTH_HALF_IN);
    assert(mouth);
    expect(mouth.wall).toBe(FOLD_WALL.baffle);
    expect(mouth.fromIn).toBeGreaterThanOrEqual(12 + 0.375);
    expect(mouth.toIn).toBe(17);
    expect(model({ ...FRONT, mouth }).drive).not.toBeNull();
  });

  test("a vent under the rear chamber vents it", () => {
    const vent = placeOpening(GRID, BOX, onWall(FOLD_WALL.bottom, 15), VENT_HALF_IN);
    expect(vent).toEqual({ wall: FOLD_WALL.bottom, fromIn: 13.5, toIn: 16.5 });
    assert(vent);
    const m = model({ ...FRONT, vent });
    expect(m.drive).not.toBeNull();
    expect(m.rearVent).not.toBeNull();
  });

  test("a vent next to the passage leaks: the horn models and the trace says so", () => {
    const vent = placeOpening(GRID, BOX, onWall(FOLD_WALL.top, 15), VENT_HALF_IN);
    assert(vent);
    const fold = { ...FRONT, vent };
    expect(model(fold).drive).not.toBeNull();
    expect(foldTrace({ ...ROOM, fold }).checks.map((c) => c.id)).toContain(FOLD_CHECK.ventLeak);
  });

  test("every mouth and vent placed along the walls models", () => {
    for (const wall of Object.values(FOLD_WALL)) {
      const span = uprightWall(wall) ? BOX.heightIn : BOX.depthIn;
      for (let along = 1; along < span; along += 2) {
        for (const [key, half] of [
          ["mouth", MOUTH_HALF_IN],
          ["vent", VENT_HALF_IN],
        ] as const) {
          const opening = placeOpening(GRID, BOX, onWall(wall, along), half);
          if (!opening) continue;
          expect(
            model({ ...FRONT, [key]: opening }).drive,
            `${key} on ${wall} at ${along}`,
          ).not.toBeNull();
        }
      }
    }
  });
});

describe("runs of air along a wall", () => {
  test("the nearest wall and the place along it", () => {
    expect(nearestWall(BOX, pt(0.5, 20))).toEqual({ wall: FOLD_WALL.baffle, alongIn: 20 });
    expect(nearestWall(BOX, pt(15, 39))).toEqual({ wall: FOLD_WALL.top, alongIn: 15 });
  });

  test("a board that meets the wall ends the run; on the board there is none", () => {
    const run = airRun(GRID, FOLD_WALL.baffle, 15);
    assert(run);
    expect(run.fromIn).toBeGreaterThan(12);
    expect(run.toIn).toBeLessThan(30);
    expect(airRun(GRID, FOLD_WALL.baffle, 12)).toBeNull();
    expect(placeOpening(GRID, BOX, onWall(FOLD_WALL.baffle, 12), MOUTH_HALF_IN)).toBeNull();
  });

  test("a click in the last cell of a wall reads that cell, not past the grid", () => {
    expect(airRun(GRID, FOLD_WALL.bottom, BOX.depthIn - 0.05)).toEqual(
      airRun(GRID, FOLD_WALL.bottom, 15),
    );
  });

  test("a dragged end stops at the run's end", () => {
    const vent = { wall: FOLD_WALL.bottom, fromIn: 13.5, toIn: 16.5 } as const;
    const run = openingRun(GRID, vent);
    const dragged = dragOpening(vent, vent.fromIn, pt(50, 0), BOX, run);
    expect(dragged).toEqual({ ...vent, toIn: 30 });
    const mouth = { wall: FOLD_WALL.baffle, fromIn: 14, toIn: 18 } as const;
    const down = dragOpening(mouth, mouth.toIn, pt(0, 2), BOX, openingRun(GRID, mouth));
    expect(down.fromIn).toBeGreaterThanOrEqual(12 + 0.375);
    expect(down.toIn).toBe(18);
  });
});
