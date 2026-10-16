// A folded horn laid out in boards (docs/folded-horn-plan.md): its corners and flat boards in the chamber's side
// section, the passage between them measured at gates (its height there times the chamber's width is its area), the
// sections the engine reads, the taps where the drivers sit, and the checks every design passes. Pure.
//
// Side-section coordinates, in: `z` back from the baffle's inside face, `y` up from the clear bottom.
import type {
  FoldBoard,
  FoldFace,
  FoldLeg,
  FoldSurface,
  FoldWall,
  HornBoards,
  HornSegment,
} from "../../types";
import {
  FOLD_CONE_MARGIN_IN,
  FOLD_CUTOUT_MARGIN_IN,
  FOLD_FACE,
  FOLD_MAGNET_CLEARANCE_IN,
  FOLD_MIN_PASSAGE_IN,
  FOLD_TOUCH_IN,
  FOLD_WALL,
} from "../../constants/hornBoards";
import { HORN_PROFILE } from "../../constants/hornEngine";
import { CM2_PER_IN2, CM_PER_IN, CM3_PER_LITER } from "../../constants/units";

/** A point of the side section, in. */
export interface FoldPoint {
  z: number;
  y: number;
}

/** A gate: a line across the passage from `a` to `b`, and the path distance at its middle, in. */
export interface FoldGate {
  a: FoldPoint;
  b: FoldPoint;
  /** its length, in: the passage's height there */
  heightIn: number;
  /** the path distance at its middle from the closed end, in */
  alongIn: number;
}

/** The chamber's clear side section and its walls' thickness (every board is one wall thick), in. */
export interface FoldRoom {
  depthIn: number;
  heightIn: number;
  wallIn: number;
  /** the chamber's clear width: every board and passage runs it */
  widthIn: number;
}

/**
 * The drivers' body, in: the cutout, the motor's diameter, the depth behind the mounting face, one-way excursion; and
 * how many sit side by side across the board.
 */
export interface FoldDriverBody {
  cutoutIn: number;
  motorIn: number;
  depthIn: number;
  xmaxIn: number;
  count: number;
}

/** The taps where the drivers' two sides open into the passage, in along it; null: into the rear chamber. */
export interface FoldTaps {
  front: number | null;
  rear: number | null;
}

/**
 * The checks (docs/folded-horn-plan.md, "Checks"): the first board past the chamber, the first two boards that cross,
 * the first gate under the lowest passage, a passage that cannot be measured, and the drivers' fit (null without
 * drivers).
 */
export interface FoldChecks {
  outside: number | null;
  crossing: [number, number] | null;
  thin: number | null;
  broken: boolean;
  drivers: {
    facesPassage: boolean;
    cutoutFits: boolean;
    magnetClear: boolean;
    coneRoom: boolean;
  } | null;
}

/** A folded horn's boards worked out: its gates, sections, passage air, taps and checks. */
export interface FoldLayout {
  gates: FoldGate[];
  segments: HornSegment[];
  pathIn: number;
  airLiters: number;
  taps: FoldTaps | null;
  checks: FoldChecks;
  /** each board's outline (its line face, then its offset face back), for the views and the checks */
  outlines: FoldPoint[][];
  /** the drivers' basket and motor behind the mounting face, as one outline; null without drivers */
  driverBody: FoldPoint[] | null;
  /** the passage as pieces to draw: each leg, then each turn out to its far corners */
  pieces: FoldPoint[][];
  /** each board's length along its line face, in, and how far each end is cut off square, degrees */
  cuts: { lengthIn: number; endCutsDeg: [number, number] }[];
}

// ---- vectors
const add = (a: FoldPoint, b: FoldPoint, k = 1): FoldPoint => ({
  z: a.z + b.z * k,
  y: a.y + b.y * k,
});
const sub = (a: FoldPoint, b: FoldPoint): FoldPoint => ({ z: a.z - b.z, y: a.y - b.y });
const dot = (a: FoldPoint, b: FoldPoint) => a.z * b.z + a.y * b.y;
const cross = (a: FoldPoint, b: FoldPoint) => a.z * b.y - a.y * b.z;
const dist = (a: FoldPoint, b: FoldPoint) => Math.hypot(a.z - b.z, a.y - b.y);
const unit = (v: FoldPoint): FoldPoint => {
  const n = Math.hypot(v.z, v.y);
  return n > 0 ? { z: v.z / n, y: v.y / n } : { z: 0, y: 0 };
};
/** a direction turned a quarter turn left */
const leftOf = (v: FoldPoint): FoldPoint => ({ z: -v.y, y: v.z });
const midpoint = (a: FoldPoint, b: FoldPoint): FoldPoint => ({
  z: (a.z + b.z) / 2,
  y: (a.y + b.y) / 2,
});

/** A line segment from `p` to `q`. */
type Segment = readonly [FoldPoint, FoldPoint];

/** Where the lines through two segments meet; null when they are parallel. */
function meet([p1, q1]: Segment, [p2, q2]: Segment): FoldPoint | null {
  const d1 = sub(q1, p1),
    d2 = sub(q2, p2);
  const den = cross(d1, d2);
  if (Math.abs(den) < 1e-9) return null;
  return add(p1, d1, cross(sub(p2, p1), d2) / den);
}

/** The foot of the perpendicular from `p` to the line through a segment. */
function footOn(p: FoldPoint, [a, b]: Segment): FoldPoint {
  const d = sub(b, a);
  const len2 = dot(d, d);
  return len2 > 0 ? add(a, d, dot(sub(p, a), d) / len2) : a;
}

/** How far along `dir` (a unit vector) from `p` the ray first meets a segment; Infinity for none. */
function rayTo(p: FoldPoint, dir: FoldPoint, [a, b]: Segment): number {
  const e = sub(b, a);
  const den = cross(dir, e);
  if (Math.abs(den) < 1e-12) return Infinity;
  const t = cross(sub(a, p), e) / den;
  const u = cross(sub(a, p), dir) / den;
  return t > FOLD_TOUCH_IN && u >= -1e-9 && u <= 1 + 1e-9 ? t : Infinity;
}

/** Whether two convex outlines overlap by more than `FOLD_TOUCH_IN` (touching is not overlapping). */
function overlaps(a: readonly FoldPoint[], b: readonly FoldPoint[]): boolean {
  for (const poly of [a, b])
    for (let i = 0; i < poly.length; i++) {
      const axis = unit(leftOf(sub(poly[(i + 1) % poly.length], poly[i])));
      const pa = a.map((p) => dot(p, axis)),
        pb = b.map((p) => dot(p, axis));
      const depth =
        Math.min(Math.max(...pa), Math.max(...pb)) - Math.max(Math.min(...pa), Math.min(...pb));
      if (depth <= FOLD_TOUCH_IN) return false;
    }
  return true;
}

// ---- surfaces
/** A wall of the side section as a segment, corner to corner. */
function wallSegment(wall: FoldWall, room: FoldRoom): Segment {
  const { depthIn: d, heightIn: h } = room;
  switch (wall) {
    case FOLD_WALL.baffle:
      return [
        { z: 0, y: 0 },
        { z: 0, y: h },
      ];
    case FOLD_WALL.back:
      return [
        { z: d, y: 0 },
        { z: d, y: h },
      ];
    case FOLD_WALL.top:
      return [
        { z: 0, y: h },
        { z: d, y: h },
      ];
    case FOLD_WALL.bottom:
      return [
        { z: 0, y: 0 },
        { z: d, y: 0 },
      ];
  }
}

/** A board's thickness as a vector: a wall's thickness to its `side` of a→b. */
function thicknessOf(plan: HornBoards, board: FoldBoard, wallIn: number): FoldPoint {
  const a = plan.corners[board.a],
    b = plan.corners[board.b];
  const n = leftOf(unit(sub(b, a)));
  return { z: n.z * board.side * wallIn, y: n.y * board.side * wallIn };
}

/** A board's face as a segment, from its `a` end to its `b` end. */
function faceSegment(plan: HornBoards, i: number, face: FoldFace, wallIn: number): Segment {
  const board = plan.boards[i];
  const a = plan.corners[board.a],
    b = plan.corners[board.b];
  if (face === FOLD_FACE.line) return [a, b];
  const t = thicknessOf(plan, board, wallIn);
  return [add(a, t), add(b, t)];
}

/** A surface (a board's face or a wall) as a segment. */
function surfaceSegment(plan: HornBoards, s: FoldSurface, room: FoldRoom): Segment {
  return "wall" in s ? wallSegment(s.wall, room) : faceSegment(plan, s.board, s.face, room.wallIn);
}

/** A board's outline: its line face a→b, then its offset face b→a. */
export function boardOutline(plan: HornBoards, i: number, wallIn: number): FoldPoint[] {
  const [a, b] = faceSegment(plan, i, FOLD_FACE.line, wallIn);
  const [oa, ob] = faceSegment(plan, i, FOLD_FACE.offset, wallIn);
  return [a, b, ob, oa];
}

const sameSurface = (s: FoldSurface, t: FoldSurface) =>
  "wall" in s
    ? "wall" in t && s.wall === t.wall
    : !("wall" in t) && s.board === t.board && s.face === t.face;

// ---- the passage
/** The gate across a leg through `p`, square to the leg's way `dir`, from its left side to its right. */
function gateAcross(p: FoldPoint, dir: FoldPoint, left: Segment, right: Segment): Segment | null {
  const across: Segment = [p, add(p, leftOf(dir))];
  const a = meet(across, left),
    b = meet(across, right);
  return a && b ? [a, b] : null;
}

/** A leg's way: its two sides' directions, made to agree with `toward`, averaged. */
function legWay(left: Segment, right: Segment, toward: FoldPoint): FoldPoint {
  const dl = unit(sub(left[1], left[0])),
    dr = unit(sub(right[1], right[0]));
  const l = dot(dl, toward) < 0 ? { z: -dl.z, y: -dl.y } : dl;
  const r = dot(dr, toward) < 0 ? { z: -dr.z, y: -dr.y } : dr;
  return unit(add(l, r));
}

/**
 * Where turn `k` (from leg k into leg k + 1) pivots, and the gate across its opening. Around one board (its two faces
 * the turn's inner sides): from the middle of the board's end, past it, to the first surface beyond. Between two
 * surfaces: from where the inner sides meet to where the outer sides meet.
 */
function turnGate(
  plan: HornBoards,
  room: FoldRoom,
  k: number,
  from: FoldPoint,
  sides: (s: FoldSurface) => Segment,
): { gate: Segment; outer: FoldPoint[] } | null {
  const leg = plan.legs[k],
    next = plan.legs[k + 1];
  const inner = (l: FoldLeg) => ((leg.turn ?? 1) > 0 ? l.left : l.right);
  const outer = (l: FoldLeg) => ((leg.turn ?? 1) > 0 ? l.right : l.left);
  const ia = inner(leg),
    ib = inner(next);
  if (!("wall" in ia) && !("wall" in ib) && ia.board === ib.board && ia.face !== ib.face) {
    const board = plan.boards[ia.board];
    const ca = plan.corners[board.a],
      cb = plan.corners[board.b];
    // the turn goes round the board's free end; with both ends free, the end the leg runs toward
    const atB =
      ca.wall !== null ? true : cb.wall !== null ? false : dist(cb, from) >= dist(ca, from);
    const [end, other] = atB ? [cb, ca] : [ca, cb];
    const t = thicknessOf(plan, board, room.wallIn);
    const tip = add(end, t, 0.5);
    const out = unit(sub(end, other));
    /** the nearest surface past the board's end, and how far */
    const none: { d: number; s: Segment | null } = { d: Infinity, s: null };
    const hit = everySegment(plan, room, ia.board).reduce((best, s) => {
      const d = rayTo(tip, out, s);
      return d < best.d ? { d, s } : best;
    }, none);
    if (!Number.isFinite(hit.d) || !hit.s) return null;
    // the turn's far corners: where each leg's outer side meets the surface the turn runs against
    const far = [meet(sides(outer(leg)), hit.s), meet(sides(outer(next)), hit.s)].filter(
      (p): p is FoldPoint => p !== null,
    );
    return { gate: [tip, add(tip, out, hit.d)], outer: far };
  }
  const pivot = meet(sides(ia), sides(ib));
  if (!pivot) return null;
  const oa = sides(outer(leg)),
    ob = sides(outer(next));
  const corner = meet(oa, ob) ?? footOn(pivot, oa);
  return { gate: [pivot, corner], outer: [corner] };
}

/** Every segment a ray can meet: the walls and each board's four edges, but board `skip`'s. */
function everySegment(plan: HornBoards, room: FoldRoom, skip: number): Segment[] {
  const walls = Object.values(FOLD_WALL).map((w) => wallSegment(w, room));
  const edges = plan.boards.flatMap((_, i) => {
    if (i === skip) return [];
    const o = boardOutline(plan, i, room.wallIn);
    return o.map((p, j): Segment => [p, o[(j + 1) % o.length]]);
  });
  return [...walls, ...edges];
}

/**
 * The passage's gates, closed end first: the closed end's, then for each turn the gate where its leg ends, the gate
 * across the turn and the gate where the next leg starts, then the mouth's. Null when a gate cannot be found (sides
 * that never meet).
 */
function gatesOf(
  plan: HornBoards,
  room: FoldRoom,
): { gates: Segment[]; turnCorners: FoldPoint[][] } | null {
  const { legs } = plan;
  if (legs.length === 0) return null;
  const sides = (s: FoldSurface) => surfaceSegment(plan, s, room);
  const first = legs[0],
    last = legs[legs.length - 1];
  const closedSeg = sides(plan.closed);
  const ca = meet(sides(first.left), closedSeg),
    cb = meet(sides(first.right), closedSeg);
  const mouthSeg = wallSegment(plan.mouth, room);
  const ma = meet(sides(last.left), mouthSeg),
    mb = meet(sides(last.right), mouthSeg);
  if (!ca || !cb || !ma || !mb) return null;
  const closed: Segment = [ca, cb],
    mouth: Segment = [ma, mb];
  // the turns, in order: each pivots after the last
  const turns: Segment[] = [];
  const turnCorners: FoldPoint[][] = [];
  let from = midpoint(ca, cb);
  for (let k = 0; k + 1 < legs.length; k++) {
    const turn = turnGate(plan, room, k, from, sides);
    if (!turn) return null;
    turns.push(turn.gate);
    turnCorners.push(turn.outer);
    from = turn.gate[0];
  }
  // each leg runs from its start (the closed end, or the last turn's pivot) to its end (the next pivot, or the mouth)
  const startOf = (k: number) => (k === 0 ? midpoint(ca, cb) : turns[k - 1][0]);
  const endOf = (k: number) => (k === legs.length - 1 ? midpoint(ma, mb) : turns[k][0]);
  const out: Segment[] = [closed];
  for (let k = 0; k + 1 < legs.length; k++) {
    const way = legWay(sides(legs[k].left), sides(legs[k].right), sub(endOf(k), startOf(k)));
    const end = gateAcross(turns[k][0], way, sides(legs[k].left), sides(legs[k].right));
    const nextWay = legWay(
      sides(legs[k + 1].left),
      sides(legs[k + 1].right),
      sub(endOf(k + 1), startOf(k + 1)),
    );
    const start = gateAcross(
      turns[k][0],
      nextWay,
      sides(legs[k + 1].left),
      sides(legs[k + 1].right),
    );
    if (!end || !start) return null;
    // the turn's gate from its left side to its right, as every other gate: a turn to the right pivots on its right
    const [pivot, corner] = turns[k];
    out.push(end, (legs[k].turn ?? 1) > 0 ? [pivot, corner] : [corner, pivot], start);
  }
  out.push(mouth);
  return { gates: out, turnCorners };
}

/** The convex hull of some points, counterclockwise. */
function hull(points: readonly FoldPoint[]): FoldPoint[] {
  const ps = [...points].sort((a, b) => a.z - b.z || a.y - b.y);
  if (ps.length < 3) return ps;
  const half = (list: FoldPoint[]) => {
    const out: FoldPoint[] = [];
    for (const p of list) {
      while (
        out.length >= 2 &&
        cross(sub(out[out.length - 1], out[out.length - 2]), sub(p, out[out.length - 2])) <= 0
      )
        out.pop();
      out.push(p);
    }
    out.pop();
    return out;
  };
  return [...half(ps), ...half([...ps].reverse())];
}

/**
 * The passage as pieces to draw: each leg between its start and end gates, and each turn between the gates either side
 * of it out to its far corners.
 */
function piecesOf(
  gates: readonly Segment[],
  turnCorners: readonly FoldPoint[][],
  legs: number,
): FoldPoint[][] {
  const legGates = (k: number): [Segment, Segment] => [
    gates[k === 0 ? 0 : 3 * k],
    gates[k === legs - 1 ? gates.length - 1 : 3 * k + 1],
  ];
  const legPieces = Array.from({ length: legs }, (_, k) => hull(legGates(k).flat()));
  const turnPieces = turnCorners.map((corners, k) =>
    hull([...gates[3 * k + 1], ...gates[3 * k + 3], ...corners]),
  );
  return [...legPieces, ...turnPieces];
}

/** The sections between consecutive gates: each area the gate's height times the width, growing linearly between. */
function sectionsOf(gates: readonly FoldGate[], widthIn: number): HornSegment[] {
  const out: HornSegment[] = [];
  for (let i = 0; i + 1 < gates.length; i++) {
    const lengthCm = (gates[i + 1].alongIn - gates[i].alongIn) * CM_PER_IN;
    const s2 = gates[i + 1].heightIn * widthIn * CM2_PER_IN2;
    const s1 = out.length ? out[out.length - 1].s2 : gates[i].heightIn * widthIn * CM2_PER_IN2;
    // gates at one place (a straight turn's two leg gates) add no section; the next starts at the later area
    if (lengthCm < MIN_SECTION_CM) {
      if (out.length) out[out.length - 1] = { ...out[out.length - 1], s2 };
      continue;
    }
    out.push({ profile: HORN_PROFILE.parabolic, s1, s2, length: lengthCm });
  }
  return out;
}

/** The shortest section kept, cm: shorter steps between gates fold into the section before. */
const MIN_SECTION_CM = 0.05;

// ---- the drivers
/** The point on board `i`'s line face `alongIn` from its `a` corner. */
function onBoard(plan: HornBoards, i: number, alongIn: number): FoldPoint {
  const board = plan.boards[i];
  const a = plan.corners[board.a],
    b = plan.corners[board.b];
  return add(a, unit(sub(b, a)), alongIn);
}

const otherFace = (face: FoldFace): FoldFace =>
  face === FOLD_FACE.line ? FOLD_FACE.offset : FOLD_FACE.line;

/**
 * The path distance where a point on one of a leg's sides opens into the passage: the point projected onto the leg's
 * center line, between its start and end gates. Null when no leg has that side.
 */
function tapAt(
  plan: HornBoards,
  gates: readonly FoldGate[],
  side: FoldSurface,
  p: FoldPoint,
): number | null {
  // the closed end's surface opens at the path's start (a front-loaded horn's drivers)
  if (sameSurface(plan.closed, side)) return 0;
  const k = plan.legs.findIndex((l) => sameSurface(l.left, side) || sameSurface(l.right, side));
  if (k < 0) return null;
  // leg k runs from gate 3k (its start; the closed end's for the first) to gate 3k + 1 (its end; the mouth's for the last)
  const g0 = gates[k === 0 ? 0 : 3 * k],
    g1 = gates[k === plan.legs.length - 1 ? gates.length - 1 : 3 * k + 1];
  const m0 = midpoint(g0.a, g0.b),
    m1 = midpoint(g1.a, g1.b);
  const d = sub(m1, m0);
  const len2 = dot(d, d);
  const t = len2 > 0 ? Math.min(1, Math.max(0, dot(sub(p, m0), d) / len2)) : 0;
  return g0.alongIn + t * (g1.alongIn - g0.alongIn);
}

/**
 * The drivers' basket and motor as one outline: from the cutout on the board's back face (away from the cone fronts)
 * narrowing to the motor at the drivers' depth.
 */
function driverOutline(plan: HornBoards, room: FoldRoom, body: FoldDriverBody): FoldPoint[] | null {
  const drivers = plan.drivers;
  if (!drivers) return null;
  const board = plan.boards[drivers.board];
  const a = plan.corners[board.a],
    b = plan.corners[board.b];
  const along = unit(sub(b, a));
  const t = thicknessOf(plan, board, room.wallIn);
  // the magnet side: past the offset face when the fronts face the line face, else back past the line face
  const towardMagnet = drivers.coneFace === FOLD_FACE.line ? unit(t) : unit({ z: -t.z, y: -t.y });
  const base =
    drivers.coneFace === FOLD_FACE.line
      ? add(onBoard(plan, drivers.board, drivers.alongIn), t)
      : onBoard(plan, drivers.board, drivers.alongIn);
  const back = add(base, towardMagnet, body.depthIn);
  return [
    add(base, along, -body.cutoutIn / 2),
    add(base, along, body.cutoutIn / 2),
    add(back, along, body.motorIn / 2),
    add(back, along, -body.motorIn / 2),
  ];
}

// ---- the whole
/**
 * A folded horn's boards worked out in a chamber's side section (`room`): the gates, the sections (each area the gate's
 * height times the chamber's width, growing linearly between gates), the path's length and air, the taps where the
 * drivers sit, each board's outline, the drivers' body, and the checks. `body` is the drivers' size (null: no driver
 * checks or body).
 */
export function hornBoardsLayout(
  plan: HornBoards,
  room: FoldRoom,
  body: FoldDriverBody | null,
): FoldLayout {
  const outlines = plan.boards.map((_, i) => boardOutline(plan, i, room.wallIn));
  const found = gatesOf(plan, room);
  const raw = found?.gates ?? null;
  const broken = !raw || raw.some(([a, b]) => ![a.z, a.y, b.z, b.y].every(Number.isFinite));
  const pieces = found && !broken ? piecesOf(found.gates, found.turnCorners, plan.legs.length) : [];
  let along = 0;
  const gates: FoldGate[] = (broken || !raw ? [] : raw).map(([a, b], i, all) => {
    if (i > 0) along += dist(midpoint(all[i - 1][0], all[i - 1][1]), midpoint(a, b));
    return { a, b, heightIn: dist(a, b), alongIn: along };
  });
  const segments = sectionsOf(gates, room.widthIn);
  const airLiters =
    segments.reduce((sum, s) => sum + ((s.s1 + s.s2) / 2) * s.length, 0) / CM3_PER_LITER;
  const drivers = plan.drivers;
  const taps: FoldTaps | null =
    drivers && !broken
      ? {
          front: tapAt(
            plan,
            gates,
            { board: drivers.board, face: drivers.coneFace },
            onBoard(plan, drivers.board, drivers.alongIn),
          ),
          rear: tapAt(
            plan,
            gates,
            { board: drivers.board, face: otherFace(drivers.coneFace) },
            onBoard(plan, drivers.board, drivers.alongIn),
          ),
        }
      : null;
  const driverBody = body ? driverOutline(plan, room, body) : null;
  const cuts: FoldLayout["cuts"] = plan.boards.map((board, i) => ({
    lengthIn: dist(plan.corners[board.a], plan.corners[board.b]),
    endCutsDeg: [endCut(plan, i, board.a, room), endCut(plan, i, board.b, room)] as [
      number,
      number,
    ],
  }));
  return {
    pieces,
    cuts,
    gates,
    segments,
    pathIn: along,
    airLiters,
    taps,
    outlines,
    driverBody,
    checks: checksOf(plan, room, body, { outlines, gates, broken, taps, driverBody }),
  };
}

/** The checks, from the worked-out outlines, gates, taps and drivers' body. */
function checksOf(
  plan: HornBoards,
  room: FoldRoom,
  body: FoldDriverBody | null,
  {
    outlines,
    gates,
    broken,
    taps,
    driverBody,
  }: Pick<FoldLayout, "outlines" | "gates" | "taps" | "driverBody"> & { broken: boolean },
): FoldChecks {
  const inRoom = (p: FoldPoint) =>
    p.z >= -FOLD_TOUCH_IN &&
    p.z <= room.depthIn + FOLD_TOUCH_IN &&
    p.y >= -FOLD_TOUCH_IN &&
    p.y <= room.heightIn + FOLD_TOUCH_IN;
  const outside = outlines.findIndex((o) => !o.every(inRoom));
  let crossing: [number, number] | null = null;
  const shareCorner = (i: number, j: number) => {
    const bi = plan.boards[i],
      bj = plan.boards[j];
    return bi.a === bj.a || bi.a === bj.b || bi.b === bj.a || bi.b === bj.b;
  };
  for (let i = 0; i < outlines.length && !crossing; i++)
    for (let j = i + 1; j < outlines.length; j++)
      if (!shareCorner(i, j) && overlaps(outlines[i], outlines[j])) {
        crossing = [i, j];
        break;
      }
  const thin = gates.findIndex((g) => g.heightIn < FOLD_MIN_PASSAGE_IN);
  const drivers = plan.drivers;
  let driverChecks: FoldChecks["drivers"] = null;
  if (drivers && body && driverBody) {
    // the room the motor needs: its body, deeper and wider by the clearance the air behind the cone flows through
    const keepOut = driverOutline(plan, room, {
      ...body,
      depthIn: body.depthIn + FOLD_MAGNET_CLEARANCE_IN,
      motorIn: body.motorIn + 2 * FOLD_MAGNET_CLEARANCE_IN,
    });
    const board = plan.boards[drivers.board];
    const lengthIn = dist(plan.corners[board.a], plan.corners[board.b]);
    const need = body.cutoutIn / 2 + FOLD_CUTOUT_MARGIN_IN;
    // the cone side: from the mounting point straight out of the cone fronts' face to the first surface beyond
    const t = thicknessOf(plan, board, room.wallIn);
    const out = drivers.coneFace === FOLD_FACE.line ? unit({ z: -t.z, y: -t.y }) : unit(t);
    const start =
      drivers.coneFace === FOLD_FACE.line
        ? onBoard(plan, drivers.board, drivers.alongIn)
        : add(onBoard(plan, drivers.board, drivers.alongIn), t);
    const room0 = everySegment(plan, room, drivers.board).reduce(
      (best, s) => Math.min(best, rayTo(start, out, s)),
      Infinity,
    );
    driverChecks = {
      facesPassage: taps?.front != null,
      // along the board, and side by side across the chamber's width, each with the margin to spare
      cutoutFits:
        drivers.alongIn >= need &&
        drivers.alongIn <= lengthIn - need &&
        body.count * body.cutoutIn + (body.count + 1) * FOLD_CUTOUT_MARGIN_IN <= room.widthIn,
      magnetClear:
        keepOut !== null &&
        keepOut.every(inRoom) &&
        outlines.every((o, i) => i === drivers.board || !overlaps(o, keepOut)),
      coneRoom: room0 >= body.xmaxIn + FOLD_CONE_MARGIN_IN,
    };
  }
  return {
    outside: outside < 0 ? null : outside,
    crossing,
    thin: thin < 0 ? null : thin,
    broken,
    drivers: driverChecks,
  };
}

/** The angle between two lines, degrees, from 0 (parallel) to 90 (square). */
function lineAngle(a: FoldPoint, b: FoldPoint): number {
  const c = Math.abs(dot(unit(a), unit(b)));
  return (Math.acos(Math.min(1, c)) * 180) / Math.PI;
}

/**
 * How far board `i`'s end at corner `c` is cut off square, degrees: against a wall, by the angle it meets the wall at
 * (none when square to it); where it meets another board at a shared corner, a mitre (half the turn between them); a
 * free end, square.
 */
function endCut(plan: HornBoards, i: number, c: number, room: FoldRoom): number {
  const board = plan.boards[i];
  const corner = plan.corners[c];
  const other = plan.corners[c === board.a ? board.b : board.a];
  const way = sub(other, corner);
  if (corner.wall !== null) {
    const [wa, wb] = wallSegment(corner.wall, room);
    return 90 - lineAngle(way, sub(wb, wa));
  }
  const j = plan.boards.findIndex((b, k) => k !== i && (b.a === c || b.b === c));
  if (j < 0) return 0;
  const bj = plan.boards[j];
  const far = plan.corners[bj.a === c ? bj.b : bj.a];
  // the angle between the two boards, 180 straight on to 0 folded back; each end takes half of what it turns
  const cos = dot(unit(way), unit(sub(far, corner)));
  const between = (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
  return (180 - between) / 2;
}

/** Whether a worked-out layout passes every check. */
export const foldPasses = ({ checks }: Pick<FoldLayout, "checks">) =>
  checks.outside === null &&
  checks.crossing === null &&
  checks.thin === null &&
  !checks.broken &&
  (checks.drivers === null || Object.values(checks.drivers).every(Boolean));
