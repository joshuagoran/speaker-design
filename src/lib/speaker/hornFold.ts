// A folded horn path laid out as straight runs in the side view (`HornRun`): the duct, its walls, the boards between
// runs, whether it fits the box and whether runs cross, and where the drivers' spot puts the taps. Pure.
//
// The horn is a 2-D horn here: it is as wide as its mouth across the box (x), and its height is its area over that
// width. Each run is a straight piece of the centerline in the side view (z back from the baffle's inside face, y up,
// as the front view's y). The runs are laid out back from the mouth: the last one ends at the mouth's center on the
// baffle, and each run before ends where the next starts. So the mouth stays on the baffle whatever the runs.
//
// The walls follow the duct: at each point a run's walls stand half its height either side of the centerline, square
// to the run. At a corner the two runs' walls meet where their lines cross (a mitre). A wall on the box's inside face
// is the cabinet's own panel; a wall a board's thickness from another run's wall is one board between the two runs;
// any other wall is a board of its own. The start of the path is closed by a board across it.
//
// The drivers' spot (`HornMount`) is a point on one run's wall. One side of that board is the run; the other is the
// run across it, or the rear chamber where none is. Their path distances there are the taps.
//
// Units are inches (the views'), the runs' and segments' cm converted here. Angles: 0 toward the back, 90° up.
import type { HornMount, HornRun, HornSegment } from "../../types";
import type { FaceRect } from "./speakerLayout";
import { isStraightSegment, segmentAreaAt } from "../acoustics/hornSegments";
import { CM_PER_IN, CM2_PER_IN2 } from "../../constants/units";
import { HORN_PATH_STEPS } from "../../constants/hornPath";
import {
  FOLD_BOUNDARY_TOLERANCE_IN,
  FOLD_MIN_GAP_BOARDS,
  FOLD_MOUNT_REACH_IN,
  FOLD_MIN_RUN_IN,
  FOLD_SHARED_TOLERANCE_IN,
  FOLD_SHARP_TURN_DEG,
  FOLD_BOARD_END_BOARDS,
  FOLD_EDGE_FALL_IN,
  FOLD_TURN_MARGIN_IN,
  MAX_FOLD_LEGS,
} from "../../constants/hornFold";

/** A point in the side view, in: `z` back from the baffle's inside face, `y` up (the front view's y). */
export interface FoldPoint {
  z: number;
  y: number;
}

/** A run as laid out: its centerline, path distances, way, and its two walls' duct faces from its start to its end. */
export interface FoldRun {
  start: FoldPoint;
  end: FoldPoint;
  /** path distances at its start and end, in */
  s0: number;
  s1: number;
  /** its way, radians (0 toward the back, π/2 up) */
  angle: number;
  /** the duct's faces of its walls, start to end: `left` on the left of its way, `right` on the right */
  left: FoldPoint[];
  right: FoldPoint[];
}

/** A board of the horn: a wall that is not the cabinet's, as its duct face's points, and the runs on its two sides. */
export interface FoldBoard {
  /** the run it walls, and the side (1 left, −1 right); `run` −1 with side 0 is the board that closes the start */
  run: number;
  side: 1 | -1 | 0;
  points: FoldPoint[];
  /** its length along its duct face, in */
  lengthIn: number;
  /** the run on its other side; null where it faces the rest of the box */
  across: number | null;
  /** how far each end is cut off square, degrees: half the turn at a corner, 0 at a free end */
  endCutsDeg: [number, number];
}

/** The taps the drivers' spot gives, path distances in inches: null where that side of the cones faces no run. */
export interface FoldTaps {
  front: number | null;
  rear: number | null;
}

/** Where the drivers sit: the point on their wall, its normal into the run across, the runs on each side, the taps. */
export interface FoldMountSpot {
  at: FoldPoint;
  /** the unit normal out of the run, through the wall */
  normal: FoldPoint;
  /** the run the spot's wall belongs to, and the run across the board (null: the rear chamber) */
  run: number;
  across: number | null;
  taps: FoldTaps;
  /** the spot as a mount, inches: what the settings show */
  mount: MountIn;
}

/** A folded path laid out in runs. */
export interface HornFold {
  runs: FoldRun[];
  boards: FoldBoard[];
  /** the duct's width across the box and its center line across it, in */
  widthIn: number;
  cx: number;
  pathIn: number;
  /** the first run that leaves the box's clear room; null when all fit */
  outside: number | null;
  /** the first two runs that cross or stand closer than a board; null when none */
  crossing: [number, number] | null;
  /** the first corner (the run after it) that turns more than the duct can follow; null when none */
  sharpTurn: number | null;
  /** every run inside the box, none crossing, no sharp turn */
  fits: boolean;
  /** the drivers' spot; null for a front-loaded horn (its drivers are at the start) or no spot */
  mount: FoldMountSpot | null;
}

/** A run in the views' units: its length, in, and its way, degrees. */
export interface RunIn {
  lengthIn: number;
  angleDeg: number;
}

/** What `hornFold` reads. */
export interface HornFoldInput {
  segments: readonly HornSegment[];
  /** every area as a share of the settings' (as `hornPath`'s) */
  areaScale: number;
  mouth: FaceRect;
  clear: FaceRect;
  depthIn: number;
  wallIn: number;
  /** the runs, start to mouth, already fitted to the path's length (`fittedRuns`) */
  runs: readonly RunIn[];
  /** the drivers' spot (lengths in inches), or null */
  mount: MountIn | null;
  /** with no `mount`: the taps (inches) the spot should come closest to; the fold then picks that spot */
  wantTaps?: FoldTaps | null;
}

/** A drivers' spot in the views' units: its distance along its run in inches. */
export type MountIn = Omit<HornMount, "alongCm"> & { alongIn: number };

const RAD_PER_DEG = Math.PI / 180;

/**
 * The duct's height along the path, in, as a function of the path distance (in): its area there (the segments', by
 * their flare laws, times `areaScale`) over its width (the mouth's).
 */
function heightOf(input: Pick<HornFoldInput, "segments" | "areaScale" | "mouth">) {
  const { segments, areaScale, mouth } = input;
  const lengths = segments.map((x) => x.length / CM_PER_IN);
  const starts = lengths.map((_, i) => lengths.slice(0, i).reduce((a, b) => a + b, 0));
  const pathIn = lengths.reduce((a, b) => a + b, 0);
  return (sAt: number) => {
    const at = Math.min(pathIn, Math.max(0, sAt));
    const i = Math.max(0, starts.filter((start) => start <= at + 1e-9).length - 1);
    return (
      ((segmentAreaAt(segments[i], (at - starts[i]) * CM_PER_IN) / CM2_PER_IN2) * areaScale) /
      mouth.w
    );
  };
}

/** How many steps the drivers' spot takes looking past its board for the run across. */
const MOUNT_PROBE_STEPS = 8;

/** The direction of a way, radians, in (z, y). */
const dir = (angle: number): FoldPoint => ({ z: Math.cos(angle), y: Math.sin(angle) });
/** The left normal of a way: the direction turned a quarter toward +y from +z. */
const leftOf = (angle: number): FoldPoint => ({ z: -Math.sin(angle), y: Math.cos(angle) });
const add = (a: FoldPoint, b: FoldPoint, k = 1): FoldPoint => ({
  z: a.z + k * b.z,
  y: a.y + k * b.y,
});
const dot = (a: FoldPoint, b: FoldPoint) => a.z * b.z + a.y * b.y;
const sub = (a: FoldPoint, b: FoldPoint): FoldPoint => ({ z: a.z - b.z, y: a.y - b.y });
const dist = (a: FoldPoint, b: FoldPoint) => Math.hypot(a.z - b.z, a.y - b.y);

/**
 * The runs fitted to a path `pathIn` long, in inches: the first run (from the path's start) takes up any difference,
 * so the runs after it stay where they are; it never goes below `FOLD_MIN_RUN_IN`.
 */
export function fittedRuns(runs: readonly HornRun[], pathIn: number): RunIn[] {
  const inches = runs.map((r) => ({ lengthIn: r.lengthCm / CM_PER_IN, angleDeg: r.angleDeg }));
  if (inches.length === 0) return inches;
  const rest = inches.slice(1).reduce((sum, r) => sum + r.lengthIn, 0);
  inches[0] = { ...inches[0], lengthIn: Math.max(FOLD_MIN_RUN_IN, pathIn - rest) };
  return inches;
}

/** Where two lines cross: through `a` along `da`, through `b` along `db`; null when they are parallel. */
function crossing(a: FoldPoint, da: FoldPoint, b: FoldPoint, db: FoldPoint): FoldPoint | null {
  const den = da.z * db.y - da.y * db.z;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((b.z - a.z) * db.y - (b.y - a.y) * db.z) / den;
  return add(a, da, t);
}

/** Whether a point is inside a polygon (even-odd). */
function inside(p: FoldPoint, poly: readonly FoldPoint[]): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i],
      b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.z < ((b.z - a.z) * (p.y - a.y)) / (b.y - a.y) + a.z)
      hit = !hit;
  }
  return hit;
}

/** The distance from a point to a segment. */
function toSegment(p: FoldPoint, a: FoldPoint, b: FoldPoint): number {
  const ab = sub(b, a);
  const len2 = dot(ab, ab);
  const t = len2 > 0 ? Math.min(1, Math.max(0, dot(sub(p, a), ab) / len2)) : 0;
  return dist(p, add(a, ab, t));
}

/** The distance from a point to a polyline. */
const toPolyline = (p: FoldPoint, line: readonly FoldPoint[]) =>
  line.slice(1).reduce((best, b, i) => Math.min(best, toSegment(p, line[i], b)), Infinity);

/** The length of a polyline. */
const lengthOf = (line: readonly FoldPoint[]) =>
  line.slice(1).reduce((sum, b, i) => sum + dist(line[i], b), 0);

/** Whether two segments cross. */
function segmentsCross(a: FoldPoint, b: FoldPoint, c: FoldPoint, d: FoldPoint): boolean {
  const side = (p: FoldPoint, q: FoldPoint, r: FoldPoint) =>
    Math.sign((q.z - p.z) * (r.y - p.y) - (q.y - p.y) * (r.z - p.z));
  return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
}

/** The distance between two outlines: 0 where they overlap or cross, else the nearest their edges come. */
function gapBetween(a: readonly FoldPoint[], b: readonly FoldPoint[]): number {
  if (a.some((p) => inside(p, b)) || b.some((p) => inside(p, a))) return 0;
  let best = Infinity;
  for (let i = 0; i < a.length; i++) {
    const p = a[i],
      q = a[(i + 1) % a.length];
    for (let j = 0; j < b.length; j++) {
      const r = b[j],
        t = b[(j + 1) % b.length];
      if (segmentsCross(p, q, r, t)) return 0;
      best = Math.min(
        best,
        toSegment(p, r, t),
        toSegment(q, r, t),
        toSegment(r, p, q),
        toSegment(t, p, q),
      );
    }
  }
  return best;
}

/** A run's outline: its left wall start to end, then its right wall back. */
const outline = (run: FoldRun) => [...run.left, ...[...run.right].reverse()];

/**
 * The folded path laid out from its runs, or null with no runs or segments. The checks: a run past the box's clear room
 * (`outside`), two runs that cross or stand closer than half a board (`crossing`, runs that do not meet at a corner;
 * the board between two nested legs is a little thinner where a wall flares), and a
 * corner that turns more than `FOLD_SHARP_TURN_DEG` (`sharpTurn`).
 */
export function hornFold(input: HornFoldInput): HornFold | null {
  const { segments, areaScale, mouth, clear, depthIn, wallIn, runs } = input;
  if (runs.length === 0 || segments.length === 0) return null;
  const pathIn = segments.reduce((sum, x) => sum + x.length, 0) / CM_PER_IN;
  const widthIn = mouth.w;
  const heightAt = heightOf(input);
  // the centerline, back from the mouth
  const angles = runs.map((r) => r.angleDeg * RAD_PER_DEG);
  const points: FoldPoint[] = [{ z: 0, y: mouth.y + mouth.h / 2 }];
  for (let k = runs.length - 1; k >= 0; k--)
    points.unshift(add(points[0], dir(angles[k]), -runs[k].lengthIn));
  const s0s = runs.map((_, k) => runs.slice(0, k).reduce((sum, r) => sum + r.lengthIn, 0));
  /** a wall's duct face where runs `k` and `k + 1` meet, on `side`: the mitre, or the plain offset where they are in line */
  const corner = (k: number, side: 1 | -1) => {
    const h = heightAt(s0s[k + 1]) / 2;
    const p = points[k + 1];
    const a = add(p, leftOf(angles[k]), side * h),
      b = add(p, leftOf(angles[k + 1]), side * h);
    return crossing(a, dir(angles[k]), b, dir(angles[k + 1])) ?? a;
  };
  /** whether a segment of the path flares (and so takes steps along a run) */
  const flares = segments.some((s) => !isStraightSegment(s));
  const foldRuns: FoldRun[] = runs.map((run, k) => {
    const steps = flares ? HORN_PATH_STEPS : 1;
    const wall = (side: 1 | -1) =>
      Array.from({ length: steps + 1 }, (_, j) => {
        if (j === 0 && k > 0) return corner(k - 1, side);
        if (j === steps && k < runs.length - 1) return corner(k, side);
        const along = (run.lengthIn * j) / steps;
        const at = add(points[k], dir(angles[k]), along);
        const point = add(at, leftOf(angles[k]), (side * heightAt(s0s[k] + along)) / 2);
        // the mouth's run ends on the baffle: its walls stop at the baffle's plane
        const d = dir(angles[k]);
        return j === steps && k === runs.length - 1 && Math.abs(d.z) > 1e-6
          ? add(point, d, -point.z / d.z)
          : point;
      });
    return {
      start: points[k],
      end: points[k + 1],
      s0: s0s[k],
      s1: s0s[k] + run.lengthIn,
      angle: angles[k],
      left: wall(1),
      right: wall(-1),
    };
  });

  // the checks
  const tol = FOLD_BOUNDARY_TOLERANCE_IN;
  const inBox = (p: FoldPoint) =>
    p.z >= -tol && p.z <= depthIn + tol && p.y >= clear.y - tol && p.y <= clear.y + clear.h + tol;
  const outsideRun = foldRuns.findIndex((r) => ![...r.left, ...r.right].every(inBox));
  let crossingPair: [number, number] | null = null;
  for (let i = 0; i < foldRuns.length && !crossingPair; i++)
    for (let j = i + 2; j < foldRuns.length; j++)
      if (gapBetween(outline(foldRuns[i]), outline(foldRuns[j])) < FOLD_MIN_GAP_BOARDS * wallIn) {
        crossingPair = [i, j];
        break;
      }
  const turnDeg = (k: number) => {
    const d = Math.abs(runs[k + 1].angleDeg - runs[k].angleDeg) % 360;
    return d > 180 ? 360 - d : d;
  };
  const sharp = runs.slice(0, -1).findIndex((_, k) => turnDeg(k) > FOLD_SHARP_TURN_DEG);

  // the boards: every wall not on the box's inside, one board for two runs a board apart, and the start's end board
  const onBoundary = (line: readonly FoldPoint[]) =>
    [
      (p: FoldPoint) => Math.abs(p.z - depthIn),
      (p: FoldPoint) => Math.abs(p.y - clear.y),
      (p: FoldPoint) => Math.abs(p.y - (clear.y + clear.h)),
    ].some((off) => line.every((p) => off(p) <= tol));
  /** the run whose opposite wall stands a board's thickness out from this wall's middle, if any */
  const acrossOf = (k: number, side: 1 | -1, line: readonly FoldPoint[]): number | null => {
    const mid = line[Math.floor(line.length / 2)];
    const probe = add(mid, leftOf(angles[k]), side * wallIn);
    const found = foldRuns.findIndex(
      (r, m) =>
        m !== k &&
        (toPolyline(probe, r.left) <= FOLD_SHARED_TOLERANCE_IN ||
          toPolyline(probe, r.right) <= FOLD_SHARED_TOLERANCE_IN),
    );
    return found < 0 ? null : found;
  };
  const cutAt = (k: number) => (k < 0 || k >= runs.length - 1 ? 0 : turnDeg(k) / 2);
  const boards: FoldBoard[] = [];
  foldRuns.forEach((run, k) => {
    for (const side of [1, -1] as const) {
      const line = side === 1 ? run.left : run.right;
      // a turn's inner wall no longer than a board or two is the end of the board between its legs, not a board
      if (onBoundary(line) || lengthOf(line) < FOLD_BOARD_END_BOARDS * wallIn) continue;
      const across = acrossOf(k, side, line);
      // a board between two runs is counted once, with the lower run
      if (across !== null && across < k) continue;
      boards.push({
        run: k,
        side,
        points: line,
        lengthIn: lengthOf(line),
        across,
        endCutsDeg: [cutAt(k - 1), cutAt(k)],
      });
    }
  });
  const [first] = foldRuns;
  const startLine = [first.left[0], first.right[0]];
  if (!onBoundary(startLine))
    boards.push({
      run: -1,
      side: 0,
      points: startLine,
      lengthIn: lengthOf(startLine),
      across: null,
      endCutsDeg: [0, 0],
    });

  return {
    runs: foldRuns,
    boards,
    widthIn,
    cx: mouth.x + mouth.w / 2,
    pathIn,
    outside: outsideRun < 0 ? null : outsideRun,
    crossing: crossingPair,
    sharpTurn: sharp < 0 ? null : sharp + 1,
    fits: outsideRun < 0 && crossingPair === null && sharp < 0,
    mount: input.mount
      ? mountSpot(foldRuns, input.mount, heightAt, wallIn)
      : input.wantTaps
        ? closestSpot(foldRuns, input.wantTaps, heightAt, wallIn)
        : null,
  };
}

/** How many places along a run the closest spot tries. */
const SPOT_STEPS = 48;

/**
 * The spot whose taps come closest to `want` (the sum of the two taps' distances, inches): every run, both walls, both
 * ways the cones can face, at `SPOT_STEPS` places along the run. A tap that should face the rear chamber (null) only
 * takes a spot whose side faces no run, and the other way round. Null where no spot can give the taps' kind.
 */
function closestSpot(
  runs: readonly FoldRun[],
  want: FoldTaps,
  heightAt: (s: number) => number,
  wallIn: number,
): FoldMountSpot | null {
  let best: FoldMountSpot | null = null,
    bestMiss = Infinity;
  const miss = (got: number | null, wanted: number | null) =>
    (got === null) !== (wanted === null)
      ? Infinity
      : got === null || wanted === null
        ? 0
        : Math.abs(got - wanted);
  for (const spot of everySpot(runs, heightAt, wallIn, SPOT_STEPS)) {
    const m = miss(spot.taps.front, want.front) + miss(spot.taps.rear, want.rear);
    if (m < bestMiss) {
      bestMiss = m;
      best = spot;
    }
  }
  return best;
}

/** Every spot on every run's two walls, both ways the cones can face, at `steps` + 1 places along each run. */
function everySpot(
  runs: readonly FoldRun[],
  heightAt: (s: number) => number,
  wallIn: number,
  steps: number,
): FoldMountSpot[] {
  return runs.flatMap((run, k) =>
    ([1, -1] as const).flatMap((side) =>
      [true, false].flatMap((frontInRun) =>
        Array.from({ length: steps + 1 }, (_, j) =>
          mountSpot(
            runs,
            { run: k, side, frontInRun, alongIn: ((run.s1 - run.s0) * j) / steps },
            heightAt,
            wallIn,
          ),
        ).filter((spot): spot is FoldMountSpot => spot !== null),
      ),
    ),
  );
}

/** Every spot the fold's runs offer (`everySpot`), at `steps` + 1 places along each run: what a search tries. */
export const foldSpots = (input: HornFoldInput, fold: HornFold, steps: number) =>
  everySpot(fold.runs, heightOf(input), input.wallIn, steps);

/**
 * The drivers' spot on their wall and the taps it gives: the run's own tap at the spot, and across the board the run
 * whose duct holds the point just past it (its tap where that point projects onto its centerline), or the rear chamber
 * (null) where no run is. The cone fronts face the run or the other side, as the mount says. Null for a run that is
 * not there.
 */
function mountSpot(
  runs: readonly FoldRun[],
  mount: MountIn,
  heightAt: (s: number) => number,
  wallIn: number,
): FoldMountSpot | null {
  const run = runs[mount.run];
  if (!run) return null;
  const lengthIn = run.s1 - run.s0;
  const along = Math.min(lengthIn, Math.max(0, mount.alongIn));
  const s = run.s0 + along;
  const left = leftOf(run.angle);
  const normal = { z: left.z * mount.side, y: left.y * mount.side };
  const at = add(add(run.start, dir(run.angle), along), normal, heightAt(s) / 2);
  // the first run past the board, out to `FOLD_MOUNT_REACH_IN` beyond it; none: the rear chamber
  let probe = at,
    across: number | null = null;
  for (let step = 0; step <= MOUNT_PROBE_STEPS && across === null; step++) {
    probe = add(at, normal, wallIn + (FOLD_MOUNT_REACH_IN * step) / MOUNT_PROBE_STEPS);
    const hit = runs.findIndex((r, m) => m !== mount.run && inside(probe, outline(r)));
    if (hit >= 0) across = hit;
  }
  const acrossS =
    across === null
      ? null
      : (() => {
          const r = runs[across];
          const len = r.s1 - r.s0;
          return r.s0 + Math.min(len, Math.max(0, dot(sub(probe, r.start), dir(r.angle))));
        })();
  return {
    at,
    normal,
    run: mount.run,
    across,
    taps: mount.frontInRun ? { front: s, rear: acrossS } : { front: acrossS, rear: s },
    mount: { ...mount, alongIn: along },
  };
}

/** What the square folds read: the path's sections, the mouth, the box's clear room and the wall's thickness. */
export type SquareFoldInput = Pick<
  HornFoldInput,
  "segments" | "areaScale" | "mouth" | "clear" | "depthIn" | "wallIn"
>;

/** An angle in degrees, kept from 0 to 360. */
const turnOf = (deg: number) => ((deg % 360) + 360) % 360;

/**
 * The automatic folds as runs (cm, as the horn stores them), laid out back from the mouth: legs along the box's depth,
 * joined by turns up or down the box. The legs nest: the board between two legs is a straight line, so each leg is
 * as high at each end as its area there needs. The mouth's leg has its outer wall flat along the mouth's edge (the
 * box's top for a mouth at the top); every leg after it lies a board's thickness inside the one before. A turn's run
 * stands half its duct's height from the wall it turns at, so its walls meet the box. The legs stack away from the
 * mouth's edge with more room. The first leg (the path's start) takes what is left of the path.
 */
export function squareFolds(input: SquareFoldInput): HornRun[] {
  const { segments, areaScale, mouth, clear, depthIn, wallIn } = input;
  const lengths = segments.map((x) => x.length / CM_PER_IN);
  const starts = lengths.map((_, i) => lengths.slice(0, i).reduce((a, b) => a + b, 0));
  const pathIn = lengths.reduce((a, b) => a + b, 0);
  if (pathIn <= 0) return [];
  const heightAt = (sAt: number) => {
    const at = Math.min(pathIn, Math.max(0, sAt));
    const i = Math.max(0, starts.filter((start) => start <= at + 1e-9).length - 1);
    return (
      ((segmentAreaAt(segments[i], (at - starts[i]) * CM_PER_IN) / CM2_PER_IN2) * areaScale) /
      mouth.w
    );
  };
  const mouthY = mouth.y + mouth.h / 2;
  /** −1: the legs stack down from a mouth with more room below it; 1: up */
  const sign = mouthY - clear.y >= clear.y + clear.h - mouthY ? -1 : 1;
  /** a wall's line in the side view, and its y at depth `z` */
  type Line = { a: FoldPoint; b: FoldPoint };
  const yOn = (line: Line, z: number) =>
    Math.abs(line.b.z - line.a.z) < 1e-9
      ? line.a.y
      : line.a.y + ((line.b.y - line.a.y) * (z - line.a.z)) / (line.b.z - line.a.z);
  /**
   * the current leg's outer wall: along the mouth's far edge for the mouth's leg, falling a little away from the box's
   * wall toward the back, so the tilted leg's corner at the turn stays inside
   */
  const edge = mouthY - (sign * mouth.h) / 2;
  let outer: Line = {
    a: { z: 0, y: edge },
    b: { z: depthIn, y: edge + sign * FOLD_EDGE_FALL_IN },
  };
  const points: FoldPoint[] = [{ z: 0, y: mouthY }];
  /** the path distance at the point laid out last */
  let s = pathIn;
  let toFront = true;
  for (let leg = 0; s > 1e-9 && leg < MAX_FOLD_LEGS; leg++) {
    const near = points[0];
    // the turn at the leg's far end stands half its duct's height (and a margin) from the wall; that height comes
    // from the far end's path distance, which the leg's length sets: settle it in a few passes
    let far = near,
      length = 0,
      hFar = 0;
    for (let pass = 0, guess = depthIn; pass < 3; pass++) {
      hFar = heightAt(s - guess);
      const inset = hFar / 2 + FOLD_TURN_MARGIN_IN;
      const zFar = toFront ? depthIn - inset : inset;
      far = { z: zFar, y: yOn(outer, zFar) + (sign * hFar) / 2 };
      length = dist(near, far);
      guess = length;
    }
    if (length >= s - 1e-9) {
      // the path's start: a part of the leg, along the same line
      const k = s / length;
      points.unshift({ z: near.z + (far.z - near.z) * k, y: near.y + (far.y - near.y) * k });
      s = 0;
      break;
    }
    points.unshift(far);
    s -= length;
    // the leg's inner wall, and the next leg's outer wall a board inside it
    const hNear = heightAt(s + length);
    const inner: Line = {
      a: { z: near.z, y: near.y + (sign * hNear) / 2 },
      b: { z: far.z, y: far.y + (sign * hFar) / 2 },
    };
    const next: Line = {
      a: { z: inner.a.z, y: inner.a.y + sign * wallIn },
      b: { z: inner.b.z, y: inner.b.y + sign * wallIn },
    };
    // the turn: from this leg's far end across to the next leg's near end, at the same depth
    const nextNear = { z: far.z, y: yOn(next, far.z) + (sign * heightAt(s)) / 2 };
    const turnIn = dist(far, nextNear);
    if (turnIn >= s - 1e-9) {
      points.unshift({ z: far.z, y: far.y + Math.sign(nextNear.y - far.y) * s });
      s = 0;
      break;
    }
    points.unshift(nextNear);
    s -= turnIn;
    outer = next;
    toFront = !toFront;
  }
  return points.slice(1).map((b, i) => {
    const a = points[i];
    return {
      lengthCm: dist(a, b) * CM_PER_IN,
      angleDeg: turnOf((Math.atan2(b.y - a.y, b.z - a.z) * 180) / Math.PI),
    };
  });
}
