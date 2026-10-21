// A space's stages and risers on its floor plan: their outlines' geometry, what stands on what, the rules a layout keeps
// (no overlap at one level, a riser within its stage, a box within what it stands on), their straight faces (for the
// coupling, the snap, and the room model) and their solids (for the 3D view). Room feet: x across from the center line,
// y down the room from the front wall. Pure.
import type { CoverageRoom, FloorPoint, SpaceStage, StageFace } from "../../types";
import {
  STAGE_FACE,
  STAGE_MIN_AREA_SQFT,
  STAGE_ON_EDGE_FT,
  SPACE_TEXT,
} from "../../constants/space";

/** Nearer than this is the same, ft. */
const EPS = 1e-6;

/** How far past an edge's middle a point is read to tell which side of it the stage lies on, ft. */
const SIDE_PROBE_FT = 0.05;

/** An outline's edges, each from a corner to the next (the last back to the first). */
export const edgesOf = (pts: readonly FloorPoint[]): [FloorPoint, FloorPoint][] =>
  pts.map((a, i) => [a, pts[(i + 1) % pts.length]]);

/** A rectangle as a stage's 8 corners: its corners and its edges' middles, clockwise from the back left (x0, y0). */
export function rectCorners(x0: number, y0: number, x1: number, y1: number): FloorPoint[] {
  const mx = (x0 + x1) / 2,
    my = (y0 + y1) / 2;
  return [
    { x: x0, y: y0 },
    { x: mx, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: my },
    { x: x1, y: y1 },
    { x: mx, y: y1 },
    { x: x0, y: y1 },
    { x: x0, y: my },
  ];
}

/** An outline's bounding box, ft. */
export interface Bounds {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export function boundsOf(pts: readonly FloorPoint[]): Bounds {
  const xs = pts.map((p) => p.x),
    ys = pts.map((p) => p.y);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}

/** An outline's area, sq ft. */
export const areaOf = (pts: readonly FloorPoint[]) =>
  Math.abs(edgesOf(pts).reduce((a, [p, q]) => a + p.x * q.y - q.x * p.y, 0)) / 2;

/** A point's distance from a segment, ft. */
function segmentDistance(p: FloorPoint, a: FloorPoint, b: FloorPoint) {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const t = Math.min(
    1,
    Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)),
  );
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

/** Whether a point lies on an outline's edge (within `STAGE_ON_EDGE_FT`). */
const onEdge = (pts: readonly FloorPoint[], p: FloorPoint) =>
  edgesOf(pts).some(([a, b]) => segmentDistance(p, a, b) <= STAGE_ON_EDGE_FT);

/** Whether a point lies inside an outline (even–odd). */
function inside(pts: readonly FloorPoint[], p: FloorPoint) {
  let hit = false;
  for (const [a, b] of edgesOf(pts))
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x)
      hit = !hit;
  return hit;
}

/** Whether a point lies inside an outline, off its edges. */
export const strictlyInside = (pts: readonly FloorPoint[], p: FloorPoint) =>
  inside(pts, p) && !onEdge(pts, p);

const insideOrOn = (pts: readonly FloorPoint[], p: FloorPoint) => inside(pts, p) || onEdge(pts, p);

const orient = (a: FloorPoint, b: FloorPoint, c: FloorPoint) =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

/** Whether two segments cross at a point inside both (touching ends or collinear runs don't count). */
function crosses(a: FloorPoint, b: FloorPoint, c: FloorPoint, d: FloorPoint) {
  const o1 = orient(a, b, c),
    o2 = orient(a, b, d),
    o3 = orient(c, d, a),
    o4 = orient(c, d, b),
    e = 1e-9;
  return (
    ((o1 > e && o2 < -e) || (o1 < -e && o2 > e)) && ((o3 > e && o4 < -e) || (o3 < -e && o4 > e))
  );
}

const middle = (a: FloorPoint, b: FloorPoint): FloorPoint => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});

/** An outline's sample points: its corners, its edges' middles, and its center. */
const samples = (pts: readonly FloorPoint[]): FloorPoint[] => [
  ...pts,
  ...edgesOf(pts).map(([a, b]) => middle(a, b)),
  {
    x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
    y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
  },
];

const edgesCross = (a: readonly FloorPoint[], b: readonly FloorPoint[]) =>
  edgesOf(a).some(([p, q]) => edgesOf(b).some(([r, s]) => crosses(p, q, r, s)));

/** Whether two outlines share any area (touching edges don't count). */
export const shapesOverlap = (a: readonly FloorPoint[], b: readonly FloorPoint[]) =>
  edgesCross(a, b) ||
  samples(a).some((p) => strictlyInside(b, p)) ||
  samples(b).some((p) => strictlyInside(a, p));

/** Whether outline `a` lies within outline `b` (its edges may touch b's). */
export const within = (a: readonly FloorPoint[], b: readonly FloorPoint[]) =>
  samples(a).every((p) => insideOrOn(b, p)) && !edgesCross(a, b);

/** Whether an outline's edges never cross each other. */
export const isSimple = (pts: readonly FloorPoint[]) =>
  edgesOf(pts).every(([a, b], i, all) =>
    all.every(
      ([c, d], j) =>
        Math.abs(i - j) < 2 || Math.abs(i - j) === all.length - 1 || !crosses(a, b, c, d),
    ),
  );

/** The room's floor as an outline, ft. */
export const roomOutline = (room: Pick<CoverageRoom, "widthFt" | "lengthFt">) =>
  rectCorners(-room.widthFt / 2, 0, room.widthFt / 2, room.lengthFt);

/** An outline moved by `by`, ft. */
export const movedOutline = (pts: readonly FloorPoint[], by: FloorPoint): FloorPoint[] =>
  pts.map((p) => ({ x: p.x + by.x, y: p.y + by.y }));

// ---- What stands on what ----

/** The stage of an id; null for the floor or an id the list lacks. */
export const stageById = (stages: readonly SpaceStage[], id: SpaceStage["id"] | null) =>
  (id !== null && stages.find((s) => s.id === id)) || null;

/** The height of a stage's base above the floor, ft: 0 on the floor, its stage's top for a riser. */
export function stageBaseFt(stages: readonly SpaceStage[], stage: SpaceStage): number {
  const host = stageById(stages, stage.on);
  return host && host !== stage ? host.heightFt : 0;
}

/** The height of a stage's top above the floor, ft. */
export const stageTopFt = (stages: readonly SpaceStage[], stage: SpaceStage) =>
  stageBaseFt(stages, stage) + stage.heightFt;

/** The stages standing on a stage (its risers), or on the floor (null), in the list's order. */
export const stagesOn = (stages: readonly SpaceStage[], id: SpaceStage["id"] | null) =>
  stages.filter((s) => s.on === id);

/** A stage and its risers: what moves with it and goes with it. */
export const familyOf = (stages: readonly SpaceStage[], stage: SpaceStage) => [
  stage,
  ...stagesOn(stages, stage.id),
];

/** The stages in the list's order: each floor stage, then the risers on it. */
export const listedStages = (stages: readonly SpaceStage[]) =>
  stagesOn(stages, null).flatMap((s) => [s, ...stagesOn(stages, s.id)]);

/** Each stage's name, by id: stages and risers are each numbered in the list's order ("Stage 1", "Riser 1"). */
export function stageNames(stages: readonly SpaceStage[]): Map<SpaceStage["id"], string> {
  const names = new Map<SpaceStage["id"], string>();
  let floor = 0,
    risers = 0;
  for (const s of listedStages(stages))
    names.set(s.id, s.on === null ? SPACE_TEXT.stageName(++floor) : SPACE_TEXT.riserName(++risers));
  return names;
}

/** The highest stage under a point (off its edges); null: the floor. */
export function stageAt(stages: readonly SpaceStage[], p: FloorPoint): SpaceStage | null {
  let best: SpaceStage | null = null;
  for (const s of stages)
    if (strictlyInside(s.corners, p) && (!best || stageTopFt(stages, s) > stageTopFt(stages, best)))
      best = s;
  return best;
}

// ---- Boxes on the plan ----

/** A box's plan: each member box's footprint (its bottom face on the plan), ft. */
export type BoxPlan = readonly (readonly FloorPoint[])[];

/** The bottom face's corners of a box (`boxCorners`' order). */
const BOTTOM = [0, 1, 5, 4] as const;

/** A box's plan from its members' eight corners each (room feet). */
export const planOf = (boxes: readonly { corners: readonly FloorPoint[] }[]): BoxPlan =>
  boxes.map((b) => BOTTOM.map((k) => ({ x: b.corners[k].x, y: b.corners[k].y })));

/** The middle of a box's plan, ft (its bounding box's); `spot` for a box with no members. */
export function planCenter(plan: BoxPlan, spot: FloorPoint): FloorPoint {
  const all = plan.flat();
  if (!all.length) return spot;
  const b = boundsOf(all);
  return { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 };
}

/** A box's plan moved by `by`, ft. */
export const movedPlan = (plan: BoxPlan, by: FloorPoint): BoxPlan =>
  plan.map((m) => movedOutline(m, by));

// ---- The rules ----

/**
 * Whether a stage keeps the rules: a simple outline of at least `STAGE_MIN_AREA_SQFT`; a riser on a floor stage and
 * within it; a floor stage within the room; no other stage at its level overlapping it.
 */
export function stageKeepsRules(
  stages: readonly SpaceStage[],
  room: Pick<CoverageRoom, "widthFt" | "lengthFt">,
  stage: SpaceStage,
): boolean {
  if (!isSimple(stage.corners) || areaOf(stage.corners) < STAGE_MIN_AREA_SQFT) return false;
  if (stage.on !== null) {
    const host = stageById(stages, stage.on);
    // a riser stands on a floor stage, never on another riser
    if (!host || host.on !== null || !within(stage.corners, host.corners)) return false;
  } else if (!within(stage.corners, roomOutline(room))) return false;
  return !stages.some(
    (o) => o !== stage && o.on === stage.on && shapesOverlap(o.corners, stage.corners),
  );
}

/**
 * Whether a box fits where it stands (the highest stage under its plan's middle): within that stage, and clear of the
 * stages standing at its level (on the floor, the floor stages; on a stage, its risers). A box with no plan fits.
 */
export function boxFits(stages: readonly SpaceStage[], plan: BoxPlan): boolean {
  if (!plan.length) return true;
  const host = stageAt(stages, planCenter(plan, { x: 0, y: 0 }));
  const beside = stagesOn(stages, host ? host.id : null);
  return plan.every(
    (m) => (!host || within(m, host.corners)) && !beside.some((s) => shapesOverlap(m, s.corners)),
  );
}

// ---- Straight faces ----

/**
 * A stage's straight edge: one that runs straight across the room (`axis` "y": it stands at y = `at`) or straight down
 * it (`axis` "x"), from `lo` to `hi` along it, ft; `out` is the way its face looks, along `axis` (+1 or −1); `face`
 * what the coupling calls it. Collinear edges in a row are one.
 */
export interface StageEdge {
  stage: SpaceStage;
  face: StageFace;
  axis: keyof FloorPoint;
  at: number;
  lo: number;
  hi: number;
  out: 1 | -1;
}

/** The other floor axis. */
const ACROSS: Record<keyof FloorPoint, keyof FloorPoint> = { x: "y", y: "x" };

/** A stage's straight edges (angled ones left out). */
export function straightEdges(stage: SpaceStage): StageEdge[] {
  const out: StageEdge[] = [];
  for (const [a, b] of edgesOf(stage.corners)) {
    const axis: keyof FloorPoint | null =
      Math.abs(a.y - b.y) < EPS ? "y" : Math.abs(a.x - b.x) < EPS ? "x" : null;
    if (!axis || Math.hypot(a.x - b.x, a.y - b.y) < EPS) continue;
    const along = ACROSS[axis];
    const lo = Math.min(a[along], b[along]),
      hi = Math.max(a[along], b[along]);
    const m = middle(a, b);
    const probe = { ...m, [axis]: m[axis] - SIDE_PROBE_FT };
    // the stage lies on the low side: its face looks toward + along the axis
    const look: 1 | -1 = strictlyInside(stage.corners, probe) ? 1 : -1;
    const face = axis === "x" ? STAGE_FACE.side : look === 1 ? STAGE_FACE.front : STAGE_FACE.back;
    const last = out[out.length - 1];
    if (
      last &&
      last.axis === axis &&
      Math.abs(last.at - a[axis]) < EPS &&
      last.out === look &&
      (Math.abs(last.hi - lo) < EPS || Math.abs(last.lo - hi) < EPS)
    ) {
      last.lo = Math.min(last.lo, lo);
      last.hi = Math.max(last.hi, hi);
      continue;
    }
    out.push({ stage, face, axis, at: a[axis], lo, hi, out: look });
  }
  // the outline's last edge may run on from its first
  const first = out[0],
    last = out[out.length - 1];
  if (
    out.length > 1 &&
    first.axis === last.axis &&
    Math.abs(first.at - last.at) < EPS &&
    first.out === last.out &&
    (Math.abs(last.hi - first.lo) < EPS || Math.abs(last.lo - first.hi) < EPS)
  ) {
    first.lo = Math.min(first.lo, last.lo);
    first.hi = Math.max(first.hi, last.hi);
    out.pop();
  }
  return out;
}

/** A stage as a solid: its outline from its base to its top above the floor, ft; a riser stands on a stage. */
export interface StageSolid {
  id: SpaceStage["id"];
  corners: readonly FloorPoint[];
  baseFt: number;
  topFt: number;
  riser: boolean;
}

/** Every stage as a solid, the floor stages first. */
export const stageSolids = (stages: readonly SpaceStage[]): StageSolid[] =>
  listedStages(stages).map((s) => ({
    id: s.id,
    corners: s.corners,
    baseFt: stageBaseFt(stages, s),
    topFt: stageTopFt(stages, s),
    riser: s.on !== null,
  }));
