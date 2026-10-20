// What each placed box stands right against (the floor, a wall, another box), and the snap that puts a dragged box
// flush against a wall or a box. Both read the boxes as lib/speaker/spaceLayout places them: room feet, x across from
// the center line, y down the room from the front wall, z up from the floor. Pure.
import type { CoupledSurface, CoverageRoom, FloorPoint, PlacedSource, RoomSide } from "../../types";
import type { PlacedBox, RoomPoint } from "./spaceLayout";
import { COUPLED_FLOOR, COUPLING_GAP_M, OPEN_SIDE } from "../../constants/space";
import { INCHES_PER_FOOT, METERS_PER_FOOT, METERS_PER_INCH } from "../../constants/units";

/** One box of a placement as it stands (`expandPlacements`): its spot, aim and lift, and its members' corners. */
export interface StandingItem {
  placement: Pick<PlacedSource, "source" | "x" | "y" | "liftIn" | "aim" | "mirrored">;
  boxes: readonly Pick<PlacedBox, "corners">[];
}

/** A wall of the room: its side and where it stands, ft (x for a side wall, y for the front and back). */
export interface RoomWall {
  side: RoomSide;
  at: number;
}

/** What one box (`StandingItem`) is coupled with: the floor and walls, and the other boxes (their indexes). */
export interface BoxCoupling {
  surfaces: CoupledSurface[];
  boxes: number[];
}

/** A coupled face on the floor plan, ft: along a wall where a box meets it, or along the face two boxes share. */
export interface CouplingMark {
  from: FloorPoint;
  to: FloorPoint;
}

/** Nearer than this is the same, ft. */
const EPS = 1e-6;

/** The coupling gap, ft. */
const GAP_FT = COUPLING_GAP_M / METERS_PER_FOOT;

/** A floor axis and the one across it. */
const AXES = [
  ["x", "y"],
  ["y", "x"],
] as const;

/** A point on the floor from a value on `axis` and one across it. */
const ON_AXIS: Record<keyof FloorPoint, (along: number, across: number) => FloorPoint> = {
  x: (along, across) => ({ x: along, y: across }),
  y: (along, across) => ({ x: across, y: along }),
};

/**
 * Each wall: the floor axis it stands across, the axis along it, and whether a box meets it with its low face (the
 * smaller x or y).
 */
const WALL_FACE: Record<
  RoomSide,
  { axis: keyof FloorPoint; along: keyof FloorPoint; low: boolean }
> = {
  front: { axis: "y", along: "x", low: true },
  back: { axis: "y", along: "x", low: false },
  left: { axis: "x", along: "y", low: true },
  right: { axis: "x", along: "y", low: false },
};

/** The walls in the order a couplings line names them. */
const WALL_ORDER: readonly RoomSide[] = ["front", "back", "left", "right"];

/** The six faces of a box, as corner indexes (`boxCorners`' order) in a loop around each. */
const FACES = [
  [0, 1, 2, 3],
  [4, 5, 6, 7],
  [0, 1, 5, 4],
  [3, 2, 6, 7],
  [0, 3, 7, 4],
  [1, 2, 6, 5],
] as const;

/** The bottom face's corners: a box's footprint on the plan. */
const BOTTOM = FACES[2];

/**
 * The room's walls: none outdoors, and none on an open side. Left is the side at -x, as the listener sees it facing
 * the front wall.
 */
export function roomWalls(
  room: Pick<CoverageRoom, "widthFt" | "lengthFt" | "outdoors" | "materials">,
): RoomWall[] {
  if (room.outdoors) return [];
  const at: Record<RoomSide, number> = {
    front: 0,
    back: room.lengthFt,
    left: -room.widthFt / 2,
    right: room.widthFt / 2,
  };
  return WALL_ORDER.filter((side) => room.materials[side] !== OPEN_SIDE).map((side) => ({
    side,
    at: at[side],
  }));
}

const sub = (a: RoomPoint, b: RoomPoint): RoomPoint => ({
  x: a.x - b.x,
  y: a.y - b.y,
  z: a.z - b.z,
});
const dot = (a: RoomPoint, b: RoomPoint) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: RoomPoint, b: RoomPoint): RoomPoint => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const unit = (a: RoomPoint): RoomPoint => {
  const n = Math.hypot(a.x, a.y, a.z) || 1;
  return { x: a.x / n, y: a.y / n, z: a.z / n };
};
const mean = (ps: readonly RoomPoint[]): RoomPoint => ({
  x: ps.reduce((s, p) => s + p.x, 0) / ps.length,
  y: ps.reduce((s, p) => s + p.y, 0) / ps.length,
  z: ps.reduce((s, p) => s + p.z, 0) / ps.length,
});

/** The overlap of two spans, lo and hi each (less than 0: apart). */
const spanOverlap = (aLo: number, aHi: number, bLo: number, bHi: number) =>
  Math.min(aHi, bHi) - Math.max(aLo, bLo);

/** Whether two convex outlines on a plane share some area (only touching is not), by their separating axes. */
function overlapping(a: readonly FloorPoint[], b: readonly FloorPoint[]): boolean {
  for (const poly of [a, b])
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i],
        q = poly[(i + 1) % poly.length];
      const n = { x: p.y - q.y, y: q.x - p.x };
      const len = Math.hypot(n.x, n.y);
      if (len < EPS) continue;
      const along = (o: FloorPoint) => (o.x * n.x + o.y * n.y) / len;
      const pa = a.map(along),
        pb = b.map(along);
      if (spanOverlap(Math.min(...pa), Math.max(...pa), Math.min(...pb), Math.max(...pb)) <= EPS)
        return false;
    }
  return true;
}

/** A face of a box: its corners, its outward normal and two unit edges along it. */
interface Face {
  corners: readonly RoomPoint[];
  normal: RoomPoint;
  u: RoomPoint;
  v: RoomPoint;
}

/** A box's six faces, each with its normal out of the box. */
function facesOf(corners: readonly RoomPoint[]): Face[] {
  const center = mean(corners);
  return FACES.map((idx) => {
    const c = idx.map((i) => corners[i]);
    const u = unit(sub(c[1], c[0])),
      v = unit(sub(c[3], c[0]));
    const n = unit(cross(u, v));
    const out = dot(n, sub(mean(c), center)) >= 0;
    return { corners: c, normal: out ? n : { x: -n.x, y: -n.y, z: -n.z }, u, v };
  });
}

/** A face's points on its own plane: along its two edges from its first corner. */
const onFace = (f: Face, ps: readonly RoomPoint[]): FloorPoint[] =>
  ps.map((p) => ({ x: dot(sub(p, f.corners[0]), f.u), y: dot(sub(p, f.corners[0]), f.v) }));

/**
 * Where two faces meet: null when they are not within the coupling gap facing each other with a shared area; else the
 * shared stretch on the plan (null for a face that is not upright: a box standing on another).
 */
function sharedFace(a: Face, b: Face): { mark: CouplingMark | null } | null {
  if (dot(a.normal, b.normal) > -1 + EPS) return null;
  if (b.corners.some((c) => Math.abs(dot(sub(c, a.corners[0]), a.normal)) > GAP_FT)) return null;
  if (!overlapping(onFace(a, a.corners), onFace(a, b.corners))) return null;
  if (Math.abs(a.normal.z) > 0.5) return { mark: null };
  // the face's line on the plan: through its first corner, across its normal
  const h = unit({ x: -a.normal.y, y: a.normal.x, z: 0 });
  const o = a.corners[0];
  const t = (ps: readonly RoomPoint[]) => ps.map((p) => (p.x - o.x) * h.x + (p.y - o.y) * h.y);
  const ta = t(a.corners),
    tb = t(b.corners);
  const lo = Math.max(Math.min(...ta), Math.min(...tb)),
    hi = Math.min(Math.max(...ta), Math.max(...tb));
  if (hi - lo <= EPS) return { mark: null };
  const at = (s: number) => ({ x: o.x + h.x * s, y: o.y + h.y * s });
  return { mark: { from: at(lo), to: at(hi) } };
}

/**
 * What each box stands right against, in `items`' order (a mirrored pair as two, `expandPlacements`): the floor (its
 * lift within the coupling gap, `COUPLING_GAP_M`), each wall a face of it is within the gap of, and each other box with
 * a face within the gap of one of its own and a shared area. With the marks the plan draws: each stretch of wall a box
 * meets, and once each upright face two boxes share.
 */
export function spaceCoupling(
  items: readonly StandingItem[],
  walls: readonly RoomWall[],
): { boxes: BoxCoupling[]; marks: CouplingMark[] } {
  const marks: CouplingMark[] = [];
  const faces = items.map((it) => it.boxes.map((b) => facesOf(b.corners)));
  const boxes = items.map((it, i): BoxCoupling => {
    const surfaces: CoupledSurface[] = [];
    if (it.placement.liftIn * METERS_PER_INCH <= COUPLING_GAP_M) surfaces.push(COUPLED_FLOOR);
    for (const wall of walls) {
      const { axis, along, low } = WALL_FACE[wall.side];
      const against = faces[i]
        .flat()
        .filter(
          (f) =>
            (low ? f.normal[axis] < -0.5 : f.normal[axis] > 0.5) &&
            f.corners.every((c) => Math.abs(c[axis] - wall.at) <= GAP_FT),
        );
      if (!against.length) continue;
      surfaces.push(wall.side);
      for (const f of against) {
        const span = f.corners.map((c) => c[along]);
        marks.push({
          from: ON_AXIS[axis](wall.at, Math.min(...span)),
          to: ON_AXIS[axis](wall.at, Math.max(...span)),
        });
      }
    }
    return { surfaces, boxes: [] };
  });
  for (let i = 0; i < items.length; i++)
    for (let j = i + 1; j < items.length; j++) {
      let coupled = false;
      for (const fa of faces[i].flat())
        for (const fb of faces[j].flat()) {
          const met = sharedFace(fa, fb);
          if (!met) continue;
          coupled = true;
          if (met.mark) marks.push(met.mark);
        }
      if (!coupled) continue;
      boxes[i].boxes.push(j);
      boxes[j].boxes.push(i);
    }
  return { boxes, marks };
}

/** A box's extent, ft: low and high on the plan, and its height span. */
interface Extent {
  lo: FloorPoint;
  hi: FloorPoint;
  zLo: number;
  zHi: number;
}

const extentOf = (corners: readonly RoomPoint[]): Extent => ({
  lo: { x: Math.min(...corners.map((c) => c.x)), y: Math.min(...corners.map((c) => c.y)) },
  hi: { x: Math.max(...corners.map((c) => c.x)), y: Math.max(...corners.map((c) => c.y)) },
  zLo: Math.min(...corners.map((c) => c.z)),
  zHi: Math.max(...corners.map((c) => c.z)),
});

/** An extent's outline on the plan, moved by `by`. */
const outline = (e: Extent, by: FloorPoint): FloorPoint[] => [
  { x: e.lo.x + by.x, y: e.lo.y + by.y },
  { x: e.hi.x + by.x, y: e.lo.y + by.y },
  { x: e.hi.x + by.x, y: e.hi.y + by.y },
  { x: e.lo.x + by.x, y: e.hi.y + by.y },
];

/** Whether a yaw is a whole number of quarter turns (the box's faces square with the room). */
const quarterTurn = (yawDeg: number) => Math.abs(yawDeg / 90 - Math.round(yawDeg / 90)) < EPS;

/**
 * Where a dragged box lands: `grid` (the drag on the quarter-foot grid), except that on each axis a face of it within
 * `reachIn` inches of a wall, or of another box's face (one squared with the room, sharing some height and some width
 * across the axis), snaps flush against the nearest. A mirrored pair's two boxes snap together at the center line. Only a box
 * squared with the room snaps, and never into another box: a snap that would overlap one gives way to the next
 * nearest, and with none left the box stays on the grid.
 * `items` are the boxes as they stand (`expandPlacements`); `at` is the dragged one's index; `raw` is where the drag is.
 */
export function snapFlush(
  raw: FloorPoint,
  grid: FloorPoint,
  items: readonly StandingItem[],
  at: number,
  walls: readonly RoomWall[],
  reachIn: number,
): FloorPoint {
  const reachFt = reachIn / INCHES_PER_FOOT;
  const dragged = items[at];
  if (!dragged || !quarterTurn(dragged.placement.aim.yawDeg)) return grid;
  const { placement } = dragged;
  const spot = { x: placement.x, y: placement.y };
  // the dragged box's members, from its spot
  const own = dragged.boxes.map((b): Extent => {
    const e = extentOf(b.corners);
    return {
      ...e,
      lo: { x: e.lo.x - spot.x, y: e.lo.y - spot.y },
      hi: { x: e.hi.x - spot.x, y: e.hi.y - spot.y },
    };
  });
  // every other box (its own pair's other box follows it, so it is not one)
  const others = items.flatMap((it) =>
    it.placement.source === placement.source
      ? []
      : it.boxes.map((b) => {
          const foot = BOTTOM.map((k) => b.corners[k]);
          const square = foot.every((c, k) => {
            const next = foot[(k + 1) % foot.length];
            return Math.abs(next.x - c.x) < EPS || Math.abs(next.y - c.y) < EPS;
          });
          return {
            extent: extentOf(b.corners),
            plan: foot.map((c) => ({ x: c.x, y: c.y })),
            square,
          };
        }),
  );
  const sharesHeight = (a: Extent, b: Extent) => spanOverlap(a.zLo, a.zHi, b.zLo, b.zHi) > EPS;
  const candidates: Record<keyof FloorPoint, number[]> = { x: [], y: [] };
  for (const m of own) {
    for (const wall of walls) {
      const { axis, low } = WALL_FACE[wall.side];
      candidates[axis].push(wall.at - (low ? m.lo[axis] : m.hi[axis]));
    }
    for (const o of others) {
      if (!o.square || !sharesHeight(m, o.extent)) continue;
      for (const [axis, across] of AXES) {
        const side = raw[across];
        if (
          spanOverlap(
            side + m.lo[across],
            side + m.hi[across],
            o.extent.lo[across],
            o.extent.hi[across],
          ) <= EPS
        )
          continue;
        candidates[axis].push(o.extent.hi[axis] - m.lo[axis], o.extent.lo[axis] - m.hi[axis]);
      }
    }
    // a pair's other box is this one's mirror image: they meet at the center line
    if (placement.mirrored) candidates.x.push(-m.lo.x, -m.hi.x);
  }
  /** an axis's snaps within reach, nearest first, then its value on the grid */
  const options = (axis: keyof FloorPoint) => [
    ...candidates[axis]
      .filter((v) => Math.abs(v - raw[axis]) <= reachFt)
      .sort((p, q) => Math.abs(p - raw[axis]) - Math.abs(q - raw[axis]))
      .map((v) => ({ v, snapped: true })),
    { v: grid[axis], snapped: false },
  ];
  const overlaps = (p: FloorPoint) =>
    own.some(
      (m) =>
        others.some((o) => sharesHeight(m, o.extent) && overlapping(outline(m, p), o.plan)) ||
        (placement.mirrored &&
          own.some((m2) => {
            const image: Extent = {
              ...m2,
              lo: { x: -(p.x + m2.hi.x), y: p.y + m2.lo.y },
              hi: { x: -(p.x + m2.lo.x), y: p.y + m2.hi.y },
            };
            return (
              sharesHeight(m, m2) && overlapping(outline(m, p), outline(image, { x: 0, y: 0 }))
            );
          })),
    );
  // both axes snapped first, then one, then neither; the nearest first at each
  const tries = options("x")
    .flatMap((x) =>
      options("y").map((y) => ({
        p: { x: x.v, y: y.v },
        free: Number(!x.snapped) + Number(!y.snapped),
        off: Math.abs(x.v - raw.x) + Math.abs(y.v - raw.y),
      })),
    )
    .filter((t) => t.free < 2)
    .sort((p, q) => p.free - q.free || p.off - q.off);
  return tries.find((t) => !overlaps(t.p))?.p ?? grid;
}
