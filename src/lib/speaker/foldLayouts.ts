// The layouts a folded horn starts from (docs/folded-horn-plan.md, "Starting a design"): each places its corners and
// boards to fit the chamber's side section, as `HornBoards`. Pure.
import type {
  FoldCorner,
  FoldLeg,
  FoldSurface,
  FoldWall,
  HornBoards,
  SpeakerHorn,
} from "../../types";
import { driverRowsSpanIn, type FoldDriverBody, type FoldRoom } from "./hornBoards";
import {
  FOLD_CUTOUT_MARGIN_IN,
  FOLD_FACE,
  FOLD_MAGNET_CLEARANCE_IN,
  FOLD_WALL,
} from "../../constants/hornBoards";
import { HORN_DRIVE, HORN_PATH } from "../../constants/speakerSpec";

/**
 * A zigzag: `legs` legs (an even number, at least 2) stacked up the chamber, each as high as the others, joined by
 * turns at the back and the front. Boards run from the baffle and the back wall in turn, each stopping `turnShare` of a
 * leg's height short of the far wall (1: each turn as wide as a leg; less leaves longer boards and narrower turns).
 * Each leg is `growth` times as high as the one before (1: all alike; more: the passage grows toward the mouth). The closed end is on the baffle at the bottom; the mouth is
 * on the baffle at the top. The drivers sit on the first board, midway along it, the cone fronts down into the first
 * leg (a tapped horn's taps: the fronts near the closed end, the backs into the second leg). Without drivers
 * (`withDrivers` false) the throat is the closed end: a front-loaded horn.
 */
export function zigzagBoards(
  room: Pick<FoldRoom, "depthIn" | "heightIn" | "wallIn">,
  legs: number,
  withDrivers = true,
  turnShare = 1,
  growth = 1,
): HornBoards {
  /** the legs, an even number */
  const n = Math.max(2, legs - (legs % 2));
  /** the side section's depth and height, and a board's thickness, in */
  const { depthIn: d, heightIn: h, wallIn: t } = room;
  /** the legs' heights, in: each `growth` times the one before (1: all alike), filling the height between the boards */
  const scale = Array.from({ length: n }, (_, i) => growth ** i);
  const total = scale.reduce((sum, s) => sum + s, 0);
  const legH = scale.map((s) => ((h - (n - 1) * t) * s) / total);
  /** each turn's width, in: its two legs' mean height, or a share of it (a narrower turn leaves longer boards) */
  const turnIn = (i: number) => ((legH[i] + legH[i + 1]) / 2) * turnShare;
  const corners: FoldCorner[] = [];
  const boards: HornBoards["boards"] = [];
  for (let i = 0; i < n - 1; i++) {
    // board i's line face is its bottom; it runs from the baffle (even) or the back (odd)
    const y = legH.slice(0, i + 1).reduce((sum, x) => sum + x, 0) + i * t;
    const fromBaffle = i % 2 === 0;
    corners.push(
      { z: fromBaffle ? 0 : d, y, wall: fromBaffle ? FOLD_WALL.baffle : FOLD_WALL.back },
      { z: fromBaffle ? d - turnIn(i) : turnIn(i), y, wall: null },
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
    drivers: withDrivers
      ? { board: 0, alongIn: (d - turnIn(0)) / 2, coneFace: FOLD_FACE.line }
      : null,
  };
}

/**
 * Whether a horn's path is folded: its own setting, or always for a tapped or offset horn (their drivers sit on a
 * board between parts of the path, which only boards can lay out).
 */
export const isFolded = (horn: Pick<SpeakerHorn, "path" | "drive">) =>
  horn.path === HORN_PATH.folded ||
  horn.drive.kind === HORN_DRIVE.tapped ||
  horn.drive.kind === HORN_DRIVE.offset;

/**
 * How near a wall the drivers' middle may sit, in: the cutout's half and its margin on the board, or the body's widest
 * step and the clearance round it, and half the spread of their rows along the board where they take several (across a
 * chamber `widthIn` wide).
 */
const driverWallIn = (
  body: Pick<FoldDriverBody, "cutoutIn" | "steps" | "count">,
  widthIn: number,
) =>
  Math.max(
    body.cutoutIn / 2 + FOLD_CUTOUT_MARGIN_IN,
    Math.max(0, ...body.steps.map((step) => step.rIn)) + FOLD_MAGNET_CLEARANCE_IN,
  ) +
  driverRowsSpanIn(body, widthIn) / 2;

/**
 * An offset-driver horn's zigzag: a sealed rear chamber `rearIn` high across the bottom (a board from the baffle to the
 * back wall closes it), and above it `legs` legs (an odd number, at least 1) stacked as in `zigzagBoards`. The first leg
 * runs forward from its closed end at the back wall, so the mouth is on the baffle at the top. The drivers sit on the
 * rear chamber's board near the closed end, the cone fronts up into the first leg and their backs into the chamber.
 */
export function offsetZigzagBoards(
  room: Pick<FoldRoom, "depthIn" | "heightIn" | "wallIn" | "widthIn">,
  legs: number,
  rearIn: number,
  body: Pick<FoldDriverBody, "cutoutIn" | "steps" | "count">,
  turnShare = 1,
  growth = 1,
): HornBoards {
  /** the legs, an odd number */
  const n = Math.max(1, legs - ((legs + 1) % 2));
  /** the side section's depth and height, and a board's thickness, in */
  const { depthIn: d, heightIn: h, wallIn: t } = room;
  /** the legs' heights, in: each `growth` times the one before, filling the height above the rear chamber's board */
  const scale = Array.from({ length: n }, (_, i) => growth ** i);
  const total = scale.reduce((sum, s) => sum + s, 0);
  const above = h - rearIn - t;
  const legH = scale.map((s) => ((above - (n - 1) * t) * s) / total);
  /** each turn's width, in: its two legs' mean height, or a share of it */
  const turnIn = (i: number) => ((legH[i] + legH[i + 1]) / 2) * turnShare;
  // board 0 closes the rear chamber, wall to wall; its line face is its bottom
  const corners: FoldCorner[] = [
    { z: 0, y: rearIn, wall: FOLD_WALL.baffle },
    { z: d, y: rearIn, wall: FOLD_WALL.back },
  ];
  const boards: HornBoards["boards"] = [{ a: 0, b: 1, side: 1 }];
  for (let i = 0; i < n - 1; i++) {
    // board i + 1 tops leg i: from the back wall (even i: leg i runs forward, turning at the front) or the baffle
    const y = rearIn + t + legH.slice(0, i + 1).reduce((sum, x) => sum + x, 0) + i * t;
    const fromBack = i % 2 === 0;
    corners.push(
      { z: fromBack ? d : 0, y, wall: fromBack ? FOLD_WALL.back : FOLD_WALL.baffle },
      { z: fromBack ? turnIn(i) : d - turnIn(i), y, wall: null },
    );
    boards.push({ a: 2 * i + 2, b: 2 * i + 3, side: fromBack ? -1 : 1 });
  }
  const below = (i: number): FoldLeg["left"] => ({ board: i, face: FOLD_FACE.offset });
  const top = (i: number): FoldLeg["left"] =>
    i === n - 1 ? { wall: FOLD_WALL.top } : { board: i + 1, face: FOLD_FACE.line };
  const legList: FoldLeg[] = Array.from({ length: n }, (_, i) => {
    // even legs run forward (their left is down), odd legs back (their left is up); each turns up into the next
    const forward = i % 2 === 0;
    const leg: FoldLeg = forward
      ? { left: below(i), right: top(i) }
      : { left: top(i), right: below(i) };
    return i < n - 1 ? { ...leg, turn: forward ? -1 : 1 } : leg;
  });
  return {
    corners,
    boards,
    closed: { wall: FOLD_WALL.back },
    legs: legList,
    mouth: FOLD_WALL.baffle,
    // as near the closed end as the cutout's margin and the driver's clearance from the back wall allow
    drivers: {
      board: 0,
      alongIn: d - driverWallIn(body, room.widthIn),
      coneFace: FOLD_FACE.offset,
    },
  };
}

/**
 * The boards mirrored top to bottom in a side section `heightIn` high: the mouth at the other end of the baffle. Each
 * board's thickness, each leg's sides and each turn swap sides with it.
 */
export function mirroredBoards(plan: HornBoards, heightIn: number): HornBoards {
  const wall = (w: FoldWall): FoldWall =>
    w === FOLD_WALL.top ? FOLD_WALL.bottom : w === FOLD_WALL.bottom ? FOLD_WALL.top : w;
  const surface = (s: FoldSurface): FoldSurface => ("wall" in s ? { wall: wall(s.wall) } : s);
  return {
    corners: plan.corners.map((c) => ({ ...c, y: heightIn - c.y, wall: c.wall && wall(c.wall) })),
    boards: plan.boards.map((b) => ({ ...b, side: b.side === 1 ? -1 : 1 })),
    closed: surface(plan.closed),
    legs: plan.legs.map((l) => ({
      left: surface(l.right),
      right: surface(l.left),
      ...(l.turn ? { turn: l.turn === 1 ? -1 : 1 } : {}),
    })),
    mouth: wall(plan.mouth),
    drivers: plan.drivers,
  };
}

/** Whether a horn's mouth is set at the bottom of the baffle (its place below the chamber's middle, `heightIn` high). */
export const mouthAtBottom = (horn: Pick<SpeakerHorn, "mouthPosition">, heightIn: number) =>
  horn.mouthPosition !== undefined && horn.mouthPosition.yIn < heightIn / 2;

/**
 * A tapped horn's spiral, the classic layout: the mouth's leg across the top, the drivers' board under it, and under
 * that `inner` legs (an odd number, at least 3) zigzagging down the box, each `growth` times as high as the one before;
 * the last runs back along the bottom and turns up a riser at the back wall into the mouth's leg. The drivers sit near
 * the front of their board: the cone fronts down into the first leg near the closed end (on the baffle), the backs up
 * into the mouth's leg near the mouth. The mouth's leg takes `mouthShare` of the height; turns are `turnShare` of the
 * legs' height wide.
 */
export function spiralBoards(
  room: Pick<FoldRoom, "depthIn" | "heightIn" | "wallIn" | "widthIn">,
  inner: number,
  mouthShare: number,
  body: Pick<FoldDriverBody, "cutoutIn" | "steps" | "count">,
  turnShare = 1,
  growth = 1,
): HornBoards {
  /** the inner legs, an odd number */
  const k = Math.max(3, inner - ((inner + 1) % 2));
  /** the side section's depth and height, and a board's thickness, in */
  const { depthIn: d, heightIn: h, wallIn: t } = room;
  /** the mouth's leg's height, and the inner legs' heights from the top down, in */
  const mouthH = (h - k * t) * mouthShare;
  const scale = Array.from({ length: k }, (_, i) => growth ** i);
  const total = scale.reduce((sum, s) => sum + s, 0);
  const legH = scale.map((s) => ((h - k * t - mouthH) * s) / total);
  /** the riser's width, and the riser board's front face, in from the baffle */
  const riserIn = (legH[k - 1] + mouthH) / 2;
  const zR = d - riserIn - t;
  /** each inner board's line face (its bottom) height: board i tops leg i */
  const yTop = (i: number) =>
    h - mouthH - t - legH.slice(0, i).reduce((sum, x) => sum + x, 0) - i * t;
  const yD = yTop(0);
  /** the turn below inner board i's free end, in */
  const turnIn = (i: number) => ((legH[i - 1] + legH[i]) / 2) * turnShare;
  const corners: FoldCorner[] = [
    // 0, 1: the drivers' board, from the baffle over the riser board's top
    { z: 0, y: yD, wall: FOLD_WALL.baffle },
    { z: zR + t, y: yD, wall: null },
  ];
  const boards: HornBoards["boards"] = [{ a: 0, b: 1, side: 1 }];
  // the inner boards: after a leg running back, from the baffle; after one running forward, from the riser board
  for (let i = 1; i < k; i++) {
    const y = yTop(i);
    const fromBaffle = i % 2 === 1;
    corners.push(
      { z: fromBaffle ? 0 : zR, y, wall: fromBaffle ? FOLD_WALL.baffle : null },
      { z: fromBaffle ? zR - turnIn(i) : turnIn(i), y, wall: null },
    );
    boards.push({ a: corners.length - 2, b: corners.length - 1, side: fromBaffle ? 1 : -1 });
  }
  // the riser board: up from the last inner board's back corner to the drivers' board, its thickness to the back
  const lastBack = corners.length - 2;
  corners.push({ z: zR, y: yD, wall: null });
  boards.push({ a: lastBack, b: corners.length - 1, side: -1 });
  const riser = boards.length - 1;
  const frontIn = driverWallIn(body, room.widthIn);
  const legs: FoldLeg[] = Array.from({ length: k }, (_, i) => {
    const up: FoldLeg["left"] = { board: i, face: FOLD_FACE.line };
    const down: FoldLeg["left"] =
      i === k - 1 ? { wall: FOLD_WALL.bottom } : { board: i + 1, face: FOLD_FACE.offset };
    // even legs run back (their left is up, turning down to the right), odd legs forward (turning down to the left);
    // the last turns up into the riser, to its left
    const back = i % 2 === 0;
    const leg: FoldLeg = back ? { left: up, right: down } : { left: down, right: up };
    return { ...leg, turn: i === k - 1 ? 1 : back ? -1 : 1 };
  });
  legs.push(
    // the riser, up the back wall, turning forward into the mouth's leg
    { left: { board: riser, face: FOLD_FACE.offset }, right: { wall: FOLD_WALL.back }, turn: 1 },
    // the mouth's leg, forward over the drivers' board to the mouth
    { left: { board: 0, face: FOLD_FACE.offset }, right: { wall: FOLD_WALL.top } },
  );
  return {
    corners,
    boards,
    closed: { wall: FOLD_WALL.baffle },
    legs,
    mouth: FOLD_WALL.baffle,
    // as near the closed end as the cutout's margin and the driver's clearance from the baffle allow
    drivers: { board: 0, alongIn: frontIn, coneFace: FOLD_FACE.line },
  };
}
