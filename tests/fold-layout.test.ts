// The fold layout search (lib/speaker/foldLayout): for a tapped, an offset and a front-loaded straight horn in a
// 30 × 40 × 20 in room with an 18″ driver, the fold it lays out traces as the same horn type, passes the hard checks,
// and follows the target's areas, taps and length within the limits below. The targets are the editor's starts, traced
// (folds the search can reach), and parabolic horns as Design from goals sizes them.
import { describe, expect, test } from "vite-plus/test";
import {
  FOLD_LAYOUT_HARD_CHECKS,
  FOLD_LAYOUT_MAX_TRACES,
  FOLD_SNAP_IN,
} from "../src/constants/foldHorn";
import { FOLD_WALL, HORN_DRIVE } from "../src/constants/speakerSpec";
import { HORN_PROFILE } from "../src/constants/hornEngine";
import { CM2_PER_IN2, CM_PER_IN } from "../src/constants/units";
import { foldTrace, type FoldDriverShape } from "../src/lib/speaker/foldTrace";
import { traceModel } from "../src/lib/speaker/foldHorn";
import { foldLayout, foldLayoutScore, foldLayoutSearch } from "../src/lib/speaker/foldLayout";
import type { FoldBoard, HornDrive, HornFold, HornSegment, SidePoint } from "../src/types";

/** one 18″ driver, as the fold-horn tests set it */
const DRIVER_18: FoldDriverShape = { cutoutIn: 16.6, depthIn: 8.2, motorIn: 7.6, count: 1 };
const ROOM = { depthIn: 30, heightIn: 40, widthIn: 20, boardIn: 0.75, driver: DRIVER_18 };
const pt = (zIn: number, yIn: number): SidePoint => ({ zIn, yIn });
const board = (a: SidePoint, b: SidePoint): FoldBoard => ({ a, b });

/** the editor's starts (tests/fold-horn.test.ts) */
const TAPPED: HornFold = {
  boards: [
    board(pt(0, 22), pt(19.5, 22)),
    board(pt(0, 15), pt(11, 15)),
    board(pt(19, 7.5), pt(8.5, 7.5)),
    board(pt(19, 7.5), pt(19, 22)),
  ],
  drivers: { board: 0, along: 0.5, face: -1 },
  mouth: { wall: FOLD_WALL.baffle, fromIn: 22.75, toIn: 40 },
};
const OFFSET: HornFold = {
  boards: [
    board(pt(0, 12), pt(30, 12)),
    board(pt(30, 21), pt(8, 21)),
    board(pt(0, 30), pt(22, 30)),
  ],
  drivers: { board: 0, along: 0.63, face: 1 },
  mouth: { wall: FOLD_WALL.baffle, fromIn: 30.75, toIn: 40 },
};
const FRONT: HornFold = { ...OFFSET, drivers: { board: 0, along: 0.66, face: 1 } };

/** a start traced and read as the sound model reads it: its segments and drive */
function tracedTarget(fold: HornFold): { target: HornSegment[]; drive: HornDrive } {
  const model = traceModel(foldTrace({ ...ROOM, fold }));
  if (!model.drive) throw new Error("the start traces as a horn");
  return { target: [...model.segments], drive: model.drive };
}

/**
 * A straight horn as Design from goals sizes it: parabolic sections `lengthIn` long, the area growing evenly from
 * `fromIn2` to `toIn2`, split at the taps (shares of the path).
 */
function parabolic(
  lengthIn: number,
  fromIn2: number,
  toIn2: number,
  taps: number[],
): HornSegment[] {
  const cuts = [0, ...taps, 1];
  const areaAt = (share: number) => (fromIn2 + (toIn2 - fromIn2) * share) * CM2_PER_IN2;
  return cuts.slice(1).map((end, i) => ({
    profile: HORN_PROFILE.parabolic,
    s1: areaAt(cuts[i]),
    s2: areaAt(end),
    length: (end - cuts[i]) * lengthIn * CM_PER_IN,
  }));
}

/**
 * Each case: the target, its drive and the limits it meets: the area match (dB), the taps' distance from the target's
 * (in, summed) and the path's (in). The starts' limits are tight: the search reaches them. The parabolic ones are
 * looser: the trace narrows to a point at the closed end (over 1 dB of the match by itself), a fold's taps sit where
 * its drivers fit, and its legs fill the room. The path runs along the passage's middle, so a leg gives about the
 * room's 30 in depth: the front-loaded parabolic horn (60 in from the cones) falls between two legs (about 48 in) and
 * three (about 77 in), and the tapped one's legs come out wider than its areas.
 */
const CASES: {
  name: string;
  target: HornSegment[];
  drive: HornDrive;
  offDb: number;
  tapIn: number;
  pathIn: number;
}[] = [
  { name: "tapped start", ...tracedTarget(TAPPED), offDb: 1.25, tapIn: 2, pathIn: 2 },
  { name: "offset start", ...tracedTarget(OFFSET), offDb: 0.75, tapIn: 1, pathIn: 3 },
  { name: "front-loaded start", ...tracedTarget(FRONT), offDb: 0.75, tapIn: 0, pathIn: 2 },
  {
    name: "tapped parabolic",
    target: parabolic(80, 100, 300, [0.1, 0.55]),
    drive: { kind: HORN_DRIVE.tapped, frontTap: 1, rearTap: 2 },
    offDb: 2.75,
    tapIn: 12,
    pathIn: 8,
  },
  {
    name: "offset parabolic",
    target: parabolic(75, 120, 220, [0.25]),
    drive: { kind: HORN_DRIVE.offset, tap: 1 },
    offDb: 2.25,
    tapIn: 1,
    pathIn: 8,
  },
  {
    name: "front-loaded parabolic",
    target: parabolic(60, 140, 220, []),
    drive: { kind: HORN_DRIVE.front },
    offDb: 0.75,
    tapIn: 0,
    pathIn: 12,
  },
];

const onGrid = (v: number) => Math.abs(v / FOLD_SNAP_IN - Math.round(v / FOLD_SNAP_IN)) < 1e-9;

describe("foldLayout", () => {
  for (const c of CASES)
    test(
      `${c.name}: the same horn type, the checks pass, close to the target`,
      { timeout: 20000 },
      () => {
        const result = foldLayoutSearch(ROOM, c.target, c.drive);
        expect(result).not.toBeNull();
        if (!result) return;
        expect(result.traces).toBeLessThanOrEqual(FOLD_LAYOUT_MAX_TRACES);
        const trace = foldTrace({ ...ROOM, fold: result.fold });
        expect(trace.hornType).toBe(c.drive.kind);
        expect(trace.checks.filter((check) => FOLD_LAYOUT_HARD_CHECKS.includes(check.id))).toEqual(
          [],
        );
        expect(traceModel(trace).drive?.kind).toBe(c.drive.kind);
        expect(result.offDb).toBeLessThanOrEqual(c.offDb);
        expect(result.tapOffIn).toBeLessThanOrEqual(c.tapIn + 0.5);
        expect(result.pathOffIn).toBeLessThanOrEqual(c.pathIn);
        // the score is the fold's own, and every board end sits on the editor's grid
        expect(foldLayoutScore(ROOM, result.fold, c.target, c.drive)?.score).toBeCloseTo(
          result.score,
          9,
        );
        const ends = result.fold.boards.flatMap((b) => [b.a.zIn, b.a.yIn, b.b.zIn, b.b.yIn]);
        expect(ends.every(onGrid)).toBe(true);
      },
    );

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
