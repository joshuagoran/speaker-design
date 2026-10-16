// The layouts a folded horn starts from (docs/folded-horn-plan.md, "Starting a design"): each places its corners and
// boards to fit the chamber's side section, as `HornBoards`. Pure.
import type { FoldCorner, FoldLeg, HornBoards } from "../../types";
import type { FoldRoom } from "./hornBoards";
import { FOLD_FACE, FOLD_WALL } from "../../constants/hornBoards";

/**
 * A zigzag: `legs` legs (an even number, at least 2) stacked up the chamber, each as high as the others, joined by
 * turns at the back and the front. Boards run from the baffle and the back wall in turn, each stopping `turnShare` of a
 * leg's height short of the far wall (1: each turn as wide as a leg; less leaves longer boards and narrower turns). The closed end is on the baffle at the bottom; the mouth is
 * on the baffle at the top. The drivers sit on the first board, midway along it, the cone fronts down into the first
 * leg (a tapped horn's taps: the fronts near the closed end, the backs into the second leg). Without drivers
 * (`withDrivers` false) the throat is the closed end: a front-loaded horn.
 */
export function zigzagBoards(
  room: Pick<FoldRoom, "depthIn" | "heightIn" | "wallIn">,
  legs: number,
  withDrivers = true,
  turnShare = 1,
): HornBoards {
  const n = Math.max(2, legs - (legs % 2));
  const { depthIn: d, heightIn: h, wallIn: t } = room;
  /** each leg's height, in */
  const legH = (h - (n - 1) * t) / n;
  /** each turn's width, in: a leg's height, or a share of it (a narrower turn leaves longer boards) */
  const turnIn = legH * turnShare;
  const corners: FoldCorner[] = [];
  const boards: HornBoards["boards"] = [];
  for (let i = 0; i < n - 1; i++) {
    // board i's line face is its bottom; it runs from the baffle (even) or the back (odd)
    const y = (i + 1) * legH + i * t;
    const fromBaffle = i % 2 === 0;
    corners.push(
      { z: fromBaffle ? 0 : d, y, wall: fromBaffle ? FOLD_WALL.baffle : FOLD_WALL.back },
      { z: fromBaffle ? d - turnIn : turnIn, y, wall: null },
    );
    // a→b runs back from the baffle (its left is up) or forward from the back (its right is up): the thickness up
    boards.push({ a: 2 * i, b: 2 * i + 1, side: fromBaffle ? 1 : -1 });
  }
  const below = (i: number): FoldLeg["left"] =>
    i === 0 ? { wall: FOLD_WALL.bottom } : { board: i - 1, face: FOLD_FACE.offset };
  const above = (i: number): FoldLeg["left"] =>
    i === n - 1 ? { wall: FOLD_WALL.top } : { board: i, face: FOLD_FACE.line };
  const legList: FoldLeg[] = Array.from({ length: n }, (_, i) => {
    // even legs run back (their left is up), odd legs forward (their left is down); each turns up into the next
    const back = i % 2 === 0;
    const leg: FoldLeg = back
      ? { left: above(i), right: below(i) }
      : { left: below(i), right: above(i) };
    return i < n - 1 ? { ...leg, turn: back ? 1 : -1 } : leg;
  });
  return {
    corners,
    boards,
    closed: { wall: FOLD_WALL.baffle },
    legs: legList,
    mouth: FOLD_WALL.baffle,
    drivers: withDrivers ? { board: 0, alongIn: (d - turnIn) / 2, coneFace: FOLD_FACE.line } : null,
  };
}
