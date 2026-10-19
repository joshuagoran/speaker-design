// The fold layout search (lib/speaker/foldLayout): for a tapped, an offset and a front-loaded straight horn in a
// 30 × 40 × 20 in room with an 18″ driver, the fold it lays out traces as the same horn type, passes the hard checks,
// and follows the target's areas, taps and length within the limits below. The targets are the editor's starts, traced
// (folds the search can reach), and parabolic horns as Design from goals sizes them.
import { describe, expect, test } from "vite-plus/test";
import { FOLD_WALL, HORN_DRIVE } from "../src/constants/speakerSpec";
import { foldTrace, type FoldDriverShape } from "../src/lib/speaker/foldTrace";
import { traceModel } from "../src/lib/speaker/foldHorn";
import { foldLayout } from "../src/lib/speaker/foldLayout";
import type { FoldBoard, HornDrive, HornFold, HornSegment, SidePoint } from "../src/types";

/** one 18″ driver, as the fold-horn tests set it */
const DRIVER_18: FoldDriverShape = { cutoutIn: 16.6, depthIn: 8.2, motorIn: 7.6, count: 1 };
const ROOM = { depthIn: 30, heightIn: 40, widthIn: 20, boardIn: 0.75, driver: DRIVER_18 };
const pt = (zIn: number, yIn: number): SidePoint => ({ zIn, yIn });
const board = (a: SidePoint, b: SidePoint): FoldBoard => ({ a, b });

const OFFSET: HornFold = {
  boards: [
    board(pt(0, 12), pt(30, 12)),
    board(pt(30, 21), pt(8, 21)),
    board(pt(0, 30), pt(22, 30)),
  ],
  drivers: { board: 0, along: 0.63, face: 1 },
  mouth: { wall: FOLD_WALL.baffle, fromIn: 30.75, toIn: 40 },
};
/** a start traced and read as the sound model reads it: its segments and drive */
function tracedTarget(fold: HornFold): { target: HornSegment[]; drive: HornDrive } {
  const model = traceModel(foldTrace({ ...ROOM, fold }));
  if (!model.drive) throw new Error("the start traces as a horn");
  return { target: [...model.segments], drive: model.drive };
}

describe("foldLayout", () => {
  test("no drivers or a back-loaded horn: no fold", () => {
    const { target, drive } = tracedTarget(OFFSET);
    expect(foldLayout({ ...ROOM, driver: null }, target, drive)).toBeNull();
    expect(foldLayout(ROOM, target, { kind: HORN_DRIVE.back })).toBeNull();
  });

  test("drivers too big for any board: no fold", () => {
    const { target, drive } = tracedTarget(OFFSET);
    const room = { ...ROOM, driver: { ...DRIVER_18, count: 2 }, widthIn: 16, depthIn: 22 };
    expect(foldLayout(room, target, drive)).toBeNull();
  });
});
