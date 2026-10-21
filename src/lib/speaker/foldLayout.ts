// A folded horn laid out for a straight horn: boards, drivers and a mouth placed so the traced passage (foldTrace)
// follows the straight horn's areas, taps and length. Pure.
//
// Each family is a shape with a few settings (board heights and ends, the drivers' place). A seed for each family asks
// each leg for the target's width where the leg falls along the path, fitted to the room's height. The search traces
// every seed, then sizes the best few again from their traces: each leg's wanted width scaled by the target's width
// over the traced width at the leg's place on the traced path. Then it moves the best fold's settings, one at a time
// and in the groups each family gives (coordinate descent, halving its steps down to the editor's 0.25 in snap), and
// keeps a move when the traced fold scores better. It stops at `FOLD_LAYOUT_MAX_TRACES` traces.
import type {
  FoldBoard,
  FoldTrace,
  HornDrive,
  HornFold,
  HornSegment,
  SidePoint,
} from "../../types";
import { foldAcross, foldTrace, type FoldTraceInput } from "./foldTrace";
import { traceModel } from "./foldHorn";
import { offTargetDb, targetPathPoints } from "./foldMatch";
import { left, sub, unit } from "./foldGeometry";
import {
  FOLD_CUTOUT_SPARE_IN,
  FOLD_DRIVER_GAP_IN,
  FOLD_LAYOUT_CALIBRATE_ROUNDS,
  FOLD_LAYOUT_CALIBRATE_SEEDS,
  FOLD_LAYOUT_FAMILY,
  FOLD_LAYOUT_FIRST_STEP_IN,
  FOLD_LAYOUT_HARD_CHECKS,
  FOLD_LAYOUT_MARGIN_IN,
  FOLD_LAYOUT_MAX_LEGS,
  FOLD_LAYOUT_MAX_TRACES,
  FOLD_LAYOUT_MIN_LEG_IN,
  FOLD_LAYOUT_PATH_DB_PER_IN,
  FOLD_LAYOUT_RATIO_MAX,
  FOLD_LAYOUT_SOFT_CHECK_DB,
  FOLD_LAYOUT_TAP_DB_PER_IN,
  FOLD_LAYOUT_TAPPED_PLANS,
  FOLD_LAYOUT_TURN_SHARE,
  FOLD_MAGNET_CLEAR_IN,
  FOLD_SNAP_IN,
  FOLD_THIN_IN,
  type FoldLayoutFamily,
} from "../../constants/foldHorn";
import { FOLD_WALL, HORN_DRIVE } from "../../constants/speakerSpec";
import { CM_PER_IN } from "../../constants/units";

/** The room a fold is laid out in: the chamber's side section, width, boards and drivers (`FoldTraceInput` less the fold). */
type FoldRoom = Omit<FoldTraceInput, "fold">;

/**
 * The drivers as the layout places them: their shape (`FoldDriverShape`) and how far their rows reach along a board
 * from the rows' center to the outer cutout's center (`foldDriverParts` puts as many across the width as fit, the rest
 * in more rows along the board).
 */
interface DriverShape extends NonNullable<FoldRoom["driver"]> {
  /** from the rows' center to the outer row's center, in; 0 for one row */
  rowsHalfIn: number;
}

/** What the search reads of the straight horn: its length and taps, in, and its area along the path. */
interface TargetShape {
  /** the straight horn's length, in */
  lengthIn: number;
  /** where the cones open, in from the start (the closed end, or the throat of a front-loaded horn), nearest first */
  taps: number[];
  /** the straight horn's area `sIn` in from its start, in² (its ends held past them) */
  areaAt: (sIn: number) => number;
}

/** How a traced fold scores against the target; lower is better. */
export interface FoldLayoutScore {
  /** the whole score, dB: the area match plus the taps', the length's and the soft checks' shares */
  score: number;
  /** the area match (`offTargetDb`), dB */
  offDb: number;
  /** how far the traced taps sit from the target's, in, summed */
  tapOffIn: number;
  /** how much longer or shorter the traced path is than the target, in */
  pathOffIn: number;
}

/** A layout search's result: the best fold and its score, the family it came from, and how many folds it traced. */
export interface FoldLayoutResult extends FoldLayoutScore {
  fold: HornFold;
  family: FoldLayoutFamily;
  /** how many folds the search traced */
  traces: number;
}

/**
 * A family's shape with its plan set: the leg widths its seed asks for, the settings that give them, where each width
 * is read in a trace, the fold a set of settings makes, and the settings the descent also moves together.
 */
interface Candidate {
  family: FoldLayoutFamily;
  /** the widths the seed asks for, in, one for each probe */
  widths: number[];
  /** the settings (in) that give these widths, fitted to the room; null when they do not fit */
  settingsFor: (widths: readonly number[]) => number[] | null;
  /** a point in the air of each leg the widths size, for these settings */
  probes: (settings: readonly number[]) => SidePoint[];
  /** the fold these settings make; null when they make no valid fold */
  build: (settings: readonly number[]) => HornFold | null;
  /** moves besides each setting alone: each a weight for every setting (1 moves it with the step) */
  groups: number[][];
}

/** A length snapped to the editor's grid (`FOLD_SNAP_IN`). */
const snap = (v: number) => Math.round(v / FOLD_SNAP_IN) * FOLD_SNAP_IN;
/** A length snapped up to the grid. */
const snapUp = (v: number) => Math.ceil(v / FOLD_SNAP_IN - 1e-9) * FOLD_SNAP_IN;
/** `v` held between `lo` and `hi`. */
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** The values added up. */
const sum = (values: readonly number[]) => values.reduce((total, v) => total + v, 0);

/** The straight horn's length, taps and area along it, from its segments and drive. */
function targetShape(target: readonly HornSegment[], drive: HornDrive): TargetShape | null {
  const points = targetPathPoints(target);
  if (points.length < 2) return null;
  /** the distance to segment boundary `i` from the start, in */
  const boundaryIn = (i: number) => sum(target.slice(0, i).map((s) => s.length)) / CM_PER_IN;
  const taps =
    drive.kind === HORN_DRIVE.tapped
      ? [boundaryIn(drive.frontTap), boundaryIn(drive.rearTap)].sort((p, q) => p - q)
      : drive.kind === HORN_DRIVE.offset
        ? [boundaryIn(drive.tap)]
        : [];
  return {
    lengthIn: points[points.length - 1].sIn,
    taps,
    areaAt: (sIn) => interpolate(points, sIn, (p) => p.areaIn2),
  };
}

/** A value along a path at `sIn`, between the two nearest points (`points` in order of `sIn`), held past the ends. */
function interpolate<P extends { sIn: number }>(
  points: readonly P[],
  sIn: number,
  value: (p: P) => number,
): number {
  const after = points.findIndex((p) => p.sIn >= sIn);
  if (after <= 0) return value(points[after === 0 ? 0 : points.length - 1]);
  const p = points[after - 1];
  const q = points[after];
  return value(p) + ((value(q) - value(p)) * (sIn - p.sIn)) / (q.sIn - p.sIn || 1);
}

/** The taps a trace opens, in from the closed end, nearest first. */
const openedTaps = (trace: FoldTrace) =>
  [trace.taps.front, trace.taps.back].filter((t): t is number => t !== null).sort((p, q) => p - q);

/** Where the sound model's horn starts in a trace, in from the closed end: a front-loaded horn starts at the cones. */
const hornStart = (trace: FoldTrace, kind: HornDrive["kind"]) =>
  kind === HORN_DRIVE.front ? (openedTaps(trace)[0] ?? 0) : 0;

/**
 * How a trace scores against the target: null when it fails a hard check (`FOLD_LAYOUT_HARD_CHECKS`), traces as another
 * horn type, or gives the sound model no horn. A front-loaded fold is read from its cones, as the sound model reads it.
 */
function scoreTrace(
  trace: FoldTrace,
  target: readonly HornSegment[],
  shape: TargetShape,
  kind: HornDrive["kind"],
): FoldLayoutScore | null {
  if (trace.hornType !== kind) return null;
  if (trace.checks.some((c) => FOLD_LAYOUT_HARD_CHECKS.includes(c.id))) return null;
  if (!traceModel(trace).drive) return null;
  const opened = openedTaps(trace);
  const start = hornStart(trace, kind);
  const sections = trace.sections.flatMap((q) =>
    q.sIn >= start ? [{ sIn: q.sIn - start, areaIn2: q.areaIn2 }] : [],
  );
  const offDb = offTargetDb(sections, target);
  if (offDb === null) return null;
  const tapOffIn = sum(shape.taps.map((t, i) => Math.abs((opened[i] ?? 0) - start - t)));
  const pathOffIn = Math.abs(trace.pathIn - start - shape.lengthIn);
  const soft = trace.checks.filter((c) => !FOLD_LAYOUT_HARD_CHECKS.includes(c.id)).length;
  return {
    score:
      offDb +
      FOLD_LAYOUT_TAP_DB_PER_IN * tapOffIn +
      FOLD_LAYOUT_PATH_DB_PER_IN * pathOffIn +
      FOLD_LAYOUT_SOFT_CHECK_DB * soft,
    offDb,
    tapOffIn,
    pathOffIn,
  };
}

/**
 * Heights that sum to `total`: each `wanted` height scaled by one factor, none under its `least`; those held at their
 * least leave the rest to the others. Null when the leasts alone pass `total`.
 */
function fitHeights(
  wanted: readonly number[],
  least: readonly number[],
  total: number,
): number[] | null {
  if (sum(least) > total) return null;
  const held = wanted.map(() => false);
  for (let pass = 0; pass <= wanted.length; pass++) {
    const fixed = sum(least.filter((_, i) => held[i]));
    const free = sum(wanted.map((h, i) => (held[i] ? 0 : Math.max(h, FOLD_SNAP_IN))));
    const k = (total - fixed) / free;
    const heights = wanted.map((h, i) => (held[i] ? least[i] : Math.max(h, FOLD_SNAP_IN) * k));
    const under = heights.findIndex((h, i) => !held[i] && h < least[i]);
    if (under < 0) return heights;
    held[under] = true;
  }
  return null;
}

/** The face (`FoldDrivers.face`) that turns the cones up (`up`) or down on a board from `a` to `b`. */
function faceFor(a: SidePoint, b: SidePoint, up: boolean): 1 | -1 {
  const normal = left(unit(sub(b, a)));
  return normal.yIn >= 0 === up ? 1 : -1;
}

/** The room a motor takes behind its board, in: its depth, its clearance and a margin. */
const motorRoomIn = (driver: DriverShape) =>
  driver.depthIn + FOLD_MAGNET_CLEAR_IN + FOLD_LAYOUT_MARGIN_IN;
/**
 * The least distance from a cutout's center to its board's end, in: the cutout's spare on the board, or the basket rim's
 * clearance from a wall the board meets, whichever is more.
 */
const cutoutEndIn = (driver: DriverShape) =>
  driver.rowsHalfIn + driver.cutoutIn / 2 + Math.max(FOLD_CUTOUT_SPARE_IN, FOLD_MAGNET_CLEAR_IN);

/** The drivers' place along a board `lengthIn` long, held on the grid with room for the cutout at both ends. */
function placeOnBoard(pos: number, lengthIn: number, driver: DriverShape): number | null {
  const lo = snapUp(cutoutEndIn(driver));
  const hi = Math.floor((lengthIn - cutoutEndIn(driver)) / FOLD_SNAP_IN) * FOLD_SNAP_IN;
  return lo <= hi ? clamp(pos, lo, hi) : null;
}

/**
 * Where drivers on a serpentine's inner board `carrier` go, in from its wall end (`alongIn`), to put the taps nearest
 * the target's, and how far off the taps then fall, in, summed (`offIn`): the fronts open in the leg under the board
 * at that distance along it, the backs at the same place in the leg over it (the basket's middle), which runs back the
 * other way. Each leg is taken as `legIn` of path, its board as 4/5 of the depth `depthIn`.
 */
function innerPlace(
  shape: TargetShape,
  driver: DriverShape,
  depthIn: number,
  legIn: number,
  carrier: number,
): { alongIn: number; offIn: number } {
  const [front = 0, back = 0] = shape.taps;
  const boardIn = 0.8 * depthIn;
  let best = cutoutEndIn(driver);
  let bestOff = Infinity;
  for (let u = snapUp(cutoutEndIn(driver)); u <= boardIn - cutoutEndIn(driver); u += FOLD_SNAP_IN) {
    const off =
      Math.abs((carrier - 1) * legIn + u - front) + Math.abs(carrier * legIn + boardIn - u - back);
    if (off < bestOff) {
      bestOff = off;
      best = u;
    }
  }
  return { alongIn: best, offIn: bestOff };
}

/**
 * A serpentine's layout: how many legs, whether a sealed chamber sits under them, and where the drivers go. The mouth
 * opens in the baffle at the last leg's end, as real folded horns' do.
 */
interface SerpentinePlan {
  /** how many legs the path runs in, closed end at the bottom */
  legs: number;
  /**
   * the board the drivers sit on: 0 for a full-depth board over a sealed chamber (cones up into the first leg, the
   * motors in the chamber), or an inner board's number from 1 (cones down into the leg under it, the motors in the leg
   * over it)
   */
  carrier: number;
}

/**
 * A serpentine: `legs` legs stacked up the chamber, each running front to back or back to front, turning round the free
 * end of the board between it and the next. The last leg ends at the baffle. Its settings, in: the chamber board's
 * height (when it has one), each inner board's height at its wall end and at its free end, and the drivers' place
 * along their board from its wall end. Each turn's opening follows the two legs it joins. Its widths: each leg's
 * height at the back, then each at the baffle.
 */
function serpentine(
  room: FoldRoom,
  driver: DriverShape,
  shape: TargetShape,
  kind: HornDrive["kind"],
  plan: SerpentinePlan,
): Candidate {
  const { depthIn: D, heightIn: H, widthIn: W, boardIn: t } = room;
  const { legs: N, carrier } = plan;
  const chamber = carrier === 0;
  /** whether leg `k` (from 1) starts at the back: the last leg starts at the back and ends at the baffle */
  const startsAtBack = (k: number) => (N - k) % 2 === 0;
  /** the z of the wall at the back (true) or the baffle */
  const wallZ = (back: boolean) => (back ? D : 0);
  /** the sides, back first, in the order the widths list them */
  const SIDES = [true, false] as const;
  /** how many settings come before the inner boards' */
  const lead = chamber ? 1 : 0;

  // the seed: each leg's height at its two ends from the target's area where they fall along the path
  const pathIn = shape.lengthIn + (kind === HORN_DRIVE.front ? cutoutEndIn(driver) : 0);
  const legIn = pathIn / N;
  const widths = SIDES.flatMap((back) =>
    Array.from({ length: N }, (_, i) => {
      const atStart = startsAtBack(i + 1) === back;
      return shape.areaAt(Math.min(shape.lengthIn, (atStart ? i : i + 1) * legIn)) / W;
    }),
  );
  const least = Array.from({ length: N }, (_, i) =>
    !chamber && i === carrier ? motorRoomIn(driver) : FOLD_LAYOUT_MIN_LEG_IN,
  );
  const boardsIn = (N - 1) * t;
  const chamberMin = t / 2 + motorRoomIn(driver);
  const chamberMax = H - t / 2 - boardsIn - sum(least);
  const along = chamber
    ? kind === HORN_DRIVE.front
      ? cutoutEndIn(driver) + FOLD_LAYOUT_MARGIN_IN
      : (shape.taps[0] ?? 0)
    : innerPlace(shape, driver, D, legIn, carrier).alongIn;

  const settingsFor = (wanted: readonly number[]): number[] | null => {
    if (chamber && chamberMin > chamberMax) return null;
    const sides = SIDES.map((_, s) => wanted.slice(s * N, (s + 1) * N));
    const chamberY = chamber
      ? clamp(H - t / 2 - boardsIn - (sum(sides[0]) + sum(sides[1])) / 2, chamberMin, chamberMax)
      : -t / 2;
    /** board centers by leg boundary at each side: 0 the chamber board or under the bottom, N over the top */
    const ys = sides.map((here) => {
      const heights = fitHeights(here, least, H + t / 2 - chamberY - N * t);
      return heights?.reduce<number[]>((at, h) => [...at, at[at.length - 1] + h + t], [chamberY]);
    });
    const [atBack, atBaffle] = ys;
    if (!atBack || !atBaffle) return null;
    const inner = Array.from({ length: N - 1 }, (_, i) => {
      const k = i + 1;
      const yAt = (back: boolean) => (back ? atBack[k] : atBaffle[k]);
      return [yAt(startsAtBack(k)), yAt(!startsAtBack(k))];
    }).flat();
    return [...(chamber ? [chamberY] : []), ...inner, along].map(snap);
  };

  /** the boards' heights for a set of settings: board `k` (0 the chamber board or the bottom, N the top) at a side */
  const heightsOf = (settings: readonly number[]) => {
    const p = settings.map(snap);
    const y0 = chamber ? p[0] : -t / 2;
    /** board `k`'s height at its wall end (`wallEnd`) or its free end */
    const boardY = (k: number, wallEnd: boolean) =>
      k === 0 ? y0 : k === N ? H + t / 2 : p[lead + 2 * (k - 1) + (wallEnd ? 0 : 1)];
    /** board `k`'s height at the back (true) or the baffle: its wall end sits at the side its leg starts */
    const yAt = (k: number, back: boolean) =>
      boardY(k, k === 0 || k === N || startsAtBack(k) === back);
    return { y0, boardY, yAt, pos: p[p.length - 1] };
  };

  const probes = (settings: readonly number[]): SidePoint[] => {
    const { yAt } = heightsOf(settings);
    return SIDES.flatMap((back) =>
      Array.from({ length: N }, (_, i) => ({
        zIn: back ? 0.75 * D : 0.25 * D,
        yIn: (yAt(i, back) + yAt(i + 1, back)) / 2,
      })),
    );
  };

  const build = (settings: readonly number[]): HornFold | null => {
    const { y0, boardY, yAt, pos } = heightsOf(settings);
    /** leg `k`'s height at the back or the baffle */
    const legAt = (k: number, back: boolean) => yAt(k, back) - yAt(k - 1, back) - t;
    for (let k = 1; k <= N; k++)
      if (legAt(k, true) < FOLD_THIN_IN || legAt(k, false) < FOLD_THIN_IN) return null;
    if (chamber && y0 < t / 2 + driver.depthIn) return null;
    const boards: FoldBoard[] = [];
    if (chamber) {
      const closedBack = startsAtBack(1);
      boards.push({
        a: { zIn: wallZ(closedBack), yIn: y0 },
        b: { zIn: wallZ(!closedBack), yIn: y0 },
      });
    }
    for (let k = 1; k < N; k++) {
      const back = startsAtBack(k);
      // the turn's opening: the mean of the two legs it joins, at the leg's end
      const gap = snap(
        Math.max(FOLD_LAYOUT_MIN_LEG_IN, (legAt(k, !back) + legAt(k + 1, !back)) / 2) + t / 2,
      );
      if (gap > D - FOLD_LAYOUT_MIN_LEG_IN) return null;
      boards.push({
        a: { zIn: wallZ(back), yIn: boardY(k, true) },
        b: { zIn: back ? gap : D - gap, yIn: boardY(k, false) },
      });
    }
    const board = chamber ? 0 : carrier - 1;
    const mount = boards[board];
    if (!mount) return null;
    const lengthIn = Math.hypot(mount.b.zIn - mount.a.zIn, mount.b.yIn - mount.a.yIn);
    const place = placeOnBoard(pos, lengthIn, driver);
    if (place === null) return null;
    const lastY = N > 1 ? boardY(N - 1, true) : y0;
    return {
      boards,
      drivers: { board, along: place / lengthIn, face: faceFor(mount.a, mount.b, chamber) },
      mouth: { wall: FOLD_WALL.baffle, fromIn: lastY + t / 2, toIn: H },
    };
  };

  /** the settings' count: the chamber board, two for each inner board, the drivers' place */
  const count = lead + 2 * (N - 1) + 1;
  const weights = (moved: (i: number) => boolean) =>
    Array.from({ length: count }, (_, i) => (moved(i) ? 1 : 0));
  const isInner = (i: number) => i >= lead && i < count - 1;
  const groups = [
    // each inner board up or down whole
    ...Array.from({ length: N - 1 }, (_, b) =>
      weights((i) => i === lead + 2 * b || i === lead + 2 * b + 1),
    ),
    // every inner board together, and with the chamber board
    ...(N > 1 ? [weights(isInner)] : []),
    ...(chamber && N > 1 ? [weights((i) => i < count - 1)] : []),
  ];
  return { family: FOLD_LAYOUT_FAMILY.serpentine, widths, settingsFor, probes, build, groups };
}

/**
 * A tapped spiral (the mock's start): a center board `A` from the baffle, the drivers on it facing down; a board `V`
 * down from its far end, and `C` from `V`'s foot back toward the baffle; `B` from the baffle between `C` and `A`. The
 * path runs from the mouth over `A`, down behind `V`, along the bottom, up past `C`'s end, back over `C`, round `B`'s
 * end and forward under `A` to the closed end at the baffle. Settings, in: the heights of `C`, `B` and `A`, the ends
 * of `C` and `B`, `V`'s place back from the baffle, and the drivers' place along `A`. Its widths, closed end first:
 * under `A`, over `C`, the opening past `C`'s end, the bottom, behind `V`, over `A`.
 */
function spiral(room: FoldRoom, driver: DriverShape, shape: TargetShape): Candidate {
  const { depthIn: D, heightIn: H, widthIn: W, boardIn: t } = room;
  const motor = motorRoomIn(driver);
  const thin = FOLD_THIN_IN + t;
  /** `V`'s least place back from the baffle: room for the cutout on `A` short of `V`'s face */
  const zVMin = snapUp(2 * snapUp(cutoutEndIn(driver)) + t / 2);
  // the widths at the legs' places along the path, from a first guess in the mock's proportions
  const g = { yC: 0.19 * H, yB: 0.375 * H, yA: 0.55 * H, zC: 0.28 * D, zB: 0.37 * D, zV: 0.63 * D };
  const w1 = g.yA - g.yB - t;
  const w2 = g.yB - g.yC - t;
  const w4 = g.yC - t / 2;
  const w6 = H - g.yA - t / 2;
  /** the legs' lengths along the path, in the widths' order */
  const lengths = [
    g.zB,
    (g.zB + g.zV) / 2 - g.zC / 2 + (w1 + w2) / 2,
    w2 / 2 + t + w4 / 2,
    D - g.zC / 2 - (D - g.zV) / 2,
    H - w4 / 2 - w6 / 2,
    (g.zV + D) / 2,
  ];
  const total = sum(lengths);
  const widths = lengths.map((l, i) => {
    const mid = (sum(lengths.slice(0, i)) + l / 2) / total;
    return shape.areaAt(mid * shape.lengthIn) / W;
  });
  const pos = shape.taps[0] ?? 0;

  const settingsFor = (wanted: readonly number[]): number[] | null => {
    const [under, over, opening, bottom, behind, mouthLeg] = wanted;
    const up = fitHeights(
      [bottom, over, under, mouthLeg],
      [FOLD_LAYOUT_MIN_LEG_IN, FOLD_LAYOUT_MIN_LEG_IN, FOLD_LAYOUT_MIN_LEG_IN, motor],
      H - 3 * t,
    );
    if (!up) return null;
    const yC = up[0] + t / 2;
    const yB = yC + t + up[1];
    const yA = yB + t + up[2];
    const zV = clamp(D - t / 2 - behind, zVMin, D - t / 2 - FOLD_LAYOUT_MIN_LEG_IN);
    const zB = clamp(
      zV - t - (up[1] + up[2]) / 2,
      FOLD_LAYOUT_MIN_LEG_IN,
      zV - t - FOLD_LAYOUT_MIN_LEG_IN,
    );
    const zC = clamp(opening + t / 2, FOLD_LAYOUT_MIN_LEG_IN + t / 2, zV - FOLD_LAYOUT_MIN_LEG_IN);
    return [yC, yB, yA, zC, zB, zV, pos].map(snap);
  };

  const probes = (settings: readonly number[]): SidePoint[] => {
    const [yC, yB, yA, zC, zB, zV] = settings.map(snap);
    return [
      { zIn: zB / 2, yIn: (yB + yA) / 2 },
      { zIn: (zC + zB) / 2, yIn: (yC + yB) / 2 },
      { zIn: zC / 2, yIn: yC },
      { zIn: (zC + zV) / 2, yIn: yC / 2 },
      { zIn: (zV + D) / 2, yIn: (yC + yA) / 2 },
      // just in from the mouth, clear of the motors over `A`
      { zIn: FOLD_LAYOUT_MIN_LEG_IN, yIn: (yA + H) / 2 },
    ];
  };

  const build = (settings: readonly number[]): HornFold | null => {
    const [yC, yB, yA, zC, zB, zV, along] = settings.map(snap);
    if (yC < thin - t / 2 || yB - yC < thin || yA - yB < thin || H - yA < motor + t / 2)
      return null;
    if (zC < thin - t / 2 || zC > zV - thin || zB > zV - thin || zB < thin || zV > D - thin)
      return null;
    const place = placeOnBoard(along, zV - t / 2, driver);
    if (place === null) return null;
    const a = { zIn: 0, yIn: yA };
    const corner = { zIn: zV, yIn: yA };
    return {
      boards: [
        { a, b: corner },
        { a: corner, b: { zIn: zV, yIn: yC } },
        { a: { zIn: zV, yIn: yC }, b: { zIn: zC, yIn: yC } },
        { a: { zIn: 0, yIn: yB }, b: { zIn: zB, yIn: yB } },
      ],
      drivers: { board: 0, along: place / zV, face: faceFor(a, corner, false) },
      mouth: { wall: FOLD_WALL.baffle, fromIn: yA + t / 2, toIn: H },
    };
  };

  const groups = [
    // the boards across (C, B, A) up or down together; B and A together; V with B's end
    [1, 1, 1, 0, 0, 0, 0],
    [0, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 0],
  ];
  return { family: FOLD_LAYOUT_FAMILY.spiral, widths, settingsFor, probes, build, groups };
}

/** The families' plans that suit a horn type: spirals and serpentines with inner drivers for a tapped horn, serpentines over a sealed chamber otherwise. */
function candidatesFor(
  room: FoldRoom,
  driver: DriverShape,
  shape: TargetShape,
  kind: HornDrive["kind"],
): Candidate[] {
  /** the target's mean width, in: its mean area over the room's width */
  const meanWidthIn =
    sum(Array.from({ length: 11 }, (_, i) => shape.areaAt((i / 10) * shape.lengthIn))) /
    11 /
    room.widthIn;
  /** the path one leg gives: the depth less what its turn cuts off */
  const legPathIn = Math.max(
    FOLD_LAYOUT_MIN_LEG_IN,
    room.depthIn - FOLD_LAYOUT_TURN_SHARE * meanWidthIn,
  );
  /** the legs whose count puts the path nearest the target's length, and one either side */
  const nearest = Math.round(shape.lengthIn / legPathIn);
  const legCounts = [nearest - 1, nearest, nearest + 1].filter(
    (n) => n >= (kind === HORN_DRIVE.tapped ? 2 : 1) && n <= FOLD_LAYOUT_MAX_LEGS,
  );
  // over a sealed chamber: the drivers on the chamber board; tapped: the drivers on each inner board in turn
  // (the tapped plans whose taps can fall nearest the target's)
  const plans: SerpentinePlan[] =
    kind === HORN_DRIVE.tapped
      ? legCounts
          .flatMap((legs) =>
            Array.from({ length: legs - 1 }, (_, i) => {
              const place = innerPlace(shape, driver, room.depthIn, shape.lengthIn / legs, i + 1);
              return { legs, carrier: i + 1, offIn: place.offIn };
            }),
          )
          .sort((p, q) => p.offIn - q.offIn)
          .slice(0, FOLD_LAYOUT_TAPPED_PLANS)
      : legCounts.map((legs) => ({ legs, carrier: 0 }));
  return [
    ...(kind === HORN_DRIVE.tapped ? [spiral(room, driver, shape)] : []),
    ...plans.map((plan) => serpentine(room, driver, shape, kind, plan)),
  ];
}

/**
 * The best fold the search finds for a straight horn (`target`, throat or closed end first, with its `drive`) in a
 * room, with its score, its family and how many folds it traced; null when no fold it tries passes. It traces at most
 * `maxTraces` folds (a quick layout can ask for fewer).
 */
export function foldLayoutSearch(
  room: FoldRoom,
  target: readonly HornSegment[],
  drive: HornDrive,
  maxTraces: number = FOLD_LAYOUT_MAX_TRACES,
): FoldLayoutResult | null {
  const shape = targetShape(target, drive);
  if (!room.driver || !shape || drive.kind === HORN_DRIVE.back) return null;
  const rows = Math.ceil(room.driver.count / foldAcross(room.widthIn, room.driver.cutoutIn));
  const driver: DriverShape = {
    ...room.driver,
    rowsHalfIn: ((rows - 1) * (room.driver.cutoutIn + FOLD_DRIVER_GAP_IN)) / 2,
  };
  const kind = drive.kind;
  let traces = 0;
  /** each fold traced, by its JSON: the trace and its score (null: it does not pass) */
  const traced = new Map<string, { trace: FoldTrace; score: FoldLayoutScore | null }>();
  /** a candidate's fold for `settings`, traced (once) and scored; null with no fold or no traces left */
  const evaluate = (candidate: Candidate, settings: readonly number[]) => {
    const fold = candidate.build(settings);
    if (!fold) return null;
    const key = JSON.stringify(fold);
    let read = traced.get(key);
    if (!read) {
      if (traces >= maxTraces) return null;
      traces++;
      const trace = foldTrace({ ...room, fold });
      read = { trace, score: scoreTrace(trace, target, shape, kind) };
      traced.set(key, read);
    }
    return { fold, ...read };
  };
  /** a point the search has traced: its candidate, the widths and settings it came from, its fold and score */
  type Point = {
    candidate: Candidate;
    widths: number[];
    settings: number[];
    fold: HornFold;
    trace: FoldTrace;
    score: FoldLayoutScore | null;
  };
  const rank = (p: Point) => p.score?.score ?? Infinity;
  /** the widths sized again from a point's trace: each scaled by the target's width over the traced one there */
  const resize = (p: Point): number[] => {
    const { grid, pathIn, sections } = p.trace;
    const start = hornStart(p.trace, kind);
    const probes = p.candidate.probes(p.settings);
    return p.widths.map((w, j) => {
      const probe = probes[j];
      if (!probe) return w;
      const i = Math.floor(probe.zIn / grid.cellIn);
      const k = Math.floor(probe.yIn / grid.cellIn);
      if (i < 0 || k < 0 || i >= grid.nz || k >= grid.ny || !sections.length) return w;
      const d = grid.dist[k * grid.nz + i];
      if (!Number.isFinite(d)) return w;
      const sIn = pathIn - d;
      const tracedIn = interpolate(sections, sIn, (q) => q.widthIn);
      const wantIn = shape.areaAt(Math.max(0, sIn - start)) / room.widthIn;
      if (!(tracedIn > 0)) return w;
      return w * clamp(wantIn / tracedIn, 1 / FOLD_LAYOUT_RATIO_MAX, FOLD_LAYOUT_RATIO_MAX);
    });
  };
  const pointAt = (candidate: Candidate, widths: number[]): Point | null => {
    const settings = candidate.settingsFor(widths);
    const at = settings && evaluate(candidate, settings);
    return settings && at ? { candidate, widths, settings, ...at } : null;
  };

  // the seeds, then the best few sized again from their traces
  const seeds = candidatesFor(room, driver, shape, kind)
    .map((c) => pointAt(c, c.widths))
    .filter((p): p is Point => p !== null)
    .sort((p, q) => rank(p) - rank(q));
  const points = [...seeds];
  // the best few, and the best of each family (a family's seed can rank low until it is sized from its trace)
  const families = new Set(seeds.map((p) => p.candidate.family));
  const sized = [
    ...seeds.slice(0, FOLD_LAYOUT_CALIBRATE_SEEDS),
    ...[...families].flatMap((family) => {
      const top = seeds.find((p) => p.candidate.family === family);
      return top && seeds.indexOf(top) >= FOLD_LAYOUT_CALIBRATE_SEEDS ? [top] : [];
    }),
  ];
  for (const seed of sized) {
    let at: Point | null = seed;
    for (let round = 0; round < FOLD_LAYOUT_CALIBRATE_ROUNDS && at; round++) {
      at = pointAt(at.candidate, resize(at));
      if (at) points.push(at);
    }
  }
  const first = points.reduce<Point | null>((b, p) => (!b || rank(p) < rank(b) ? p : b), null);
  if (!first?.score) return null;
  let best: Point = first;

  // coordinate descent: each setting, and each group, a step up and down, carried on while it helps; the step halves
  // when nothing does
  const directions = [
    ...first.settings.map((_, i) => first.settings.map((__, j) => (i === j ? 1 : 0))),
    ...first.candidate.groups,
  ];
  for (let step = FOLD_LAYOUT_FIRST_STEP_IN; step >= FOLD_SNAP_IN && traces < maxTraces;) {
    let moved = false;
    for (const direction of directions)
      for (const sign of [1, -1])
        for (;;) {
          const from = best;
          const settings = from.settings.map((v, j) => v + sign * step * (direction[j] ?? 0));
          const at = evaluate(from.candidate, settings);
          if (!at?.score || !(at.score.score < rank(from))) break;
          best = { ...from, settings, ...at };
          moved = true;
        }
    if (!moved) step /= 2;
  }
  const { fold, candidate, score } = best;
  return score && { fold, family: candidate.family, traces, ...score };
}

/**
 * A fold for a straight horn (`target` with its `drive`) in a room: boards, drivers and a mouth whose traced passage
 * follows the target's areas, taps and length, and passes the mouth, drivers, rear chamber, cutout and magnet checks.
 * Null when no fold the search tries passes them as the same horn type.
 */
export function foldLayout(
  room: FoldRoom,
  target: readonly HornSegment[],
  drive: HornDrive,
): HornFold | null {
  return foldLayoutSearch(room, target, drive)?.fold ?? null;
}
