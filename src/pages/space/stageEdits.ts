// The Space page's edits to its stages: add, remove, reshape, size and move one (with its risers and the boxes on it).
// A new stage keeps every rule the space kept before (lib/speaker/spaceStages); the other edits keep the stages' rules
// only: the boxes on a stage ride along, and a box it leaves stands on what is under it. Pure.
import type { FloorPoint, SpacePlacement, SpaceSpec, SpaceStage, StageShape } from "../../types";
import { expandPlacements, type PlacedItem } from "../../lib/speaker/spaceLayout";
import {
  boundsOf,
  boxFits,
  familyOf,
  movedOutline,
  movedPlan,
  planCenter,
  planOf,
  rectCorners,
  roomOutline,
  shapesOverlap,
  stageAt,
  stageById,
  stageKeepsRules,
  stagesOn,
  stageTopFt,
  within,
  type BoxPlan,
} from "../../lib/speaker/spaceStages";
import {
  NEW_RISER,
  NEW_STAGE,
  PLACE_SPOT_STEP_FT,
  SNAP_FLUSH_IN,
  STAGE_HEIGHT_FT,
  STAGE_MIN_AREA_SQFT,
  STAGE_MIN_SIDE_FT,
  STAGE_SHAPE,
  STAGE_SPOT_STEP_FT,
  stageId,
} from "../../constants/space";
import { INCHES_PER_FOOT } from "../../constants/units";

/** What a stage edit reads and changes: the placements and the venue. */
type Layout = Pick<SpaceSpec, "placements" | "venue">;

/**
 * Each box's plan from its spot (`BoxPlan`), in the model's order (`expandPlacements`): the model lays the boxes out, so
 * an edit reads their plans from it and sets them on the spots it moves them to. Undefined: not laid out yet.
 */
export type SpotPlans = readonly (BoxPlan | undefined)[];

/** The model's boxes' plans, each from its spot. */
export const spotPlans = (items: readonly Pick<PlacedItem, "placement" | "boxes">[]): BoxPlan[] =>
  items.map((it) => movedPlan(planOf(it.boxes), { x: -it.placement.x, y: -it.placement.y }));

/** The plans of the space's boxes where they stand, in `expandPlacements`' order (none for a box not laid out yet). */
export const placedPlans = (placements: readonly SpacePlacement[], plans: SpotPlans): BoxPlan[] =>
  expandPlacements(placements).map((p, i) => {
    const plan = plans[i];
    return plan ? movedPlan(plan, p) : [];
  });

/**
 * The first free spot for placement `k`, ft: `from` when free, else the spot nearest the center line in the first free
 * row down the room from `from` (then in the rows in front of it), in `PLACE_SPOT_STEP_FT` steps. Free: each of its
 * boxes (a mirrored pair's both) stands on the floor within the room, clear of every stage and every other box. `from`
 * when no spot is free or its boxes are not laid out.
 */
export function freeSpot(
  layout: Layout,
  k: number,
  plans: SpotPlans,
  from: FloorPoint,
): FloorPoint {
  const { stages, room } = layout.venue;
  const floor = roomOutline(room);
  const placedAt = (to: FloorPoint) =>
    layout.placements.map((p, i) => (i === k ? { ...p, x: to.x, y: to.y } : p));
  const sources = expandPlacements(layout.placements).map((p) => p.source);
  if (!sources.some((source, i) => source === k && plans[i]?.length)) return from;
  const isFree = (to: FloorPoint) => {
    const all = placedPlans(placedAt(to), plans);
    const own = all.filter((_, i) => sources[i] === k);
    const others = all.filter((_, i) => sources[i] !== k).flat();
    return own.every((plan, j) =>
      plan.every(
        (m) =>
          within(m, floor) &&
          !stages.some((s) => shapesOverlap(m, s.corners)) &&
          !others.some((o) => shapesOverlap(m, o)) &&
          // a mirrored pair's two boxes stay clear of each other
          !own.some((twin, t) => t !== j && twin.some((o) => shapesOverlap(m, o))),
      ),
    );
  };
  if (isFree(from)) return from;
  const half = Math.floor(room.widthFt / 2 / PLACE_SPOT_STEP_FT);
  const xs = Array.from({ length: 2 * half + 1 }, (_, i) => (i - half) * PLACE_SPOT_STEP_FT).sort(
    (a, b) => Math.abs(a) - Math.abs(b) || a - b,
  );
  const rows = Math.floor(room.lengthFt / PLACE_SPOT_STEP_FT);
  const ys = Array.from({ length: rows + 1 }, (_, i) => i * PLACE_SPOT_STEP_FT);
  const order = [...ys.filter((y) => y >= from.y), ...ys.filter((y) => y < from.y).reverse()];
  for (const y of order)
    for (const x of xs) {
      const to = { x, y };
      if (isFree(to)) return to;
    }
  return from;
}

/** The stages (by id) that break a stage rule. */
const brokenStages = ({ venue: { stages, room } }: Layout) =>
  new Set(stages.filter((s) => !stageKeepsRules(stages, room, s)).map((s) => s.id));

/** The boxes (by index) that break a box rule. */
const brokenBoxes = (layout: Layout, plans: SpotPlans) =>
  new Set(
    placedPlans(layout.placements, plans).flatMap((plan, i) =>
      boxFits(layout.venue.stages, plan) ? [] : [i],
    ),
  );

/** Whether every one of `now` was in `was`. */
const noneNew = <T>(was: ReadonlySet<T>, now: ReadonlySet<T>) => [...now].every((k) => was.has(k));

/** Whether `after`'s stages break no stage rule `before`'s kept; the boxes are not checked. */
const stagesKeepRules = (before: Layout, after: Layout): boolean =>
  noneNew(brokenStages(before), brokenStages(after));

/**
 * Whether `after` breaks no rule `before` kept (a layout that broke one already can still change elsewhere). The boxes'
 * plans are `plans` in both; `afterPlans` are `after`'s where they differ (a box turned).
 */
export const keepsRules = (
  before: Layout,
  after: Layout,
  plans: SpotPlans,
  afterPlans: SpotPlans = plans,
): boolean =>
  stagesKeepRules(before, after) &&
  noneNew(brokenBoxes(before, plans), brokenBoxes(after, afterPlans));

/** `after` when its stages keep the rules `before`'s kept, else `before`: a stage edit never fails on the boxes. */
const ruled = <L extends Layout>(before: L, after: L): L =>
  stagesKeepRules(before, after) ? after : before;

/** A layout with its stages changed. */
const withStages = <L extends Layout>(layout: L, stages: readonly SpaceStage[]): L => ({
  ...layout,
  venue: { ...layout.venue, stages },
});

/** A new stage's id: one no stage in the list has. */
function newStageId(stages: readonly SpaceStage[]): SpaceStage["id"] {
  let n = stages.length + 1;
  while (stages.some((s) => s.id === stageId(n))) n++;
  return stageId(n);
}

/** A new stage's footprint, ft. */
type StageSize = Record<"widthFt" | "depthFt", number>;

/** A new stage's size, ft: `size` scaled to `widthFt` wide, its proportions kept. */
const scaledTo = (size: StageSize, widthFt: number): StageSize => ({
  widthFt,
  depthFt: (widthFt * size.depthFt) / size.widthFt,
});

/**
 * The layout with a new stage on `on` (a floor stage's id; null: the floor), and its id: a stage `NEW_STAGE` big, at
 * the first free spot nearest the middle of the front wall; a riser `NEW_RISER` big, at the first free spot nearest
 * the middle of its stage's back edge. Where that size has no free spot, it is the largest size with one, its
 * proportions kept, in `STAGE_SPOT_STEP_FT` steps of width. Where even the smallest stage the rules allow
 * (`STAGE_MIN_AREA_SQFT`, `STAGE_MIN_SIDE_FT`) has none, it is that smallest stage at the first spot, and the stage
 * checks flag it.
 */
export function withStageAdded<L extends Layout>(
  layout: L,
  on: SpaceStage["id"] | null,
  plans: SpotPlans,
): { layout: L; id: SpaceStage["id"] } {
  const { stages, room } = layout.venue;
  const host = stageById(stages, on);
  const full = host ? NEW_RISER : NEW_STAGE;
  const area = host
    ? boundsOf(host.corners)
    : { x0: -room.widthFt / 2, x1: room.widthFt / 2, y0: 0, y1: room.lengthFt };
  const midX = (area.x0 + area.x1) / 2;
  const id = newStageId(stages);
  const ratio = full.depthFt / full.widthFt;
  const step = STAGE_SPOT_STEP_FT;
  /** the widths tried, in steps: the smallest the rules allow, and the largest the area holds (at most the full one) */
  const fewest = Math.ceil(
    Math.max(Math.sqrt(STAGE_MIN_AREA_SQFT / ratio), STAGE_MIN_SIDE_FT, STAGE_MIN_SIDE_FT / ratio) /
      step -
      1e-9,
  );
  const most = Math.max(
    fewest,
    Math.floor(
      Math.min(full.widthFt, area.x1 - area.x0, (area.y1 - area.y0) / ratio) / step + 1e-9,
    ),
  );
  const newStage = (x: number, y: number, size: StageSize): SpaceStage => ({
    id,
    shape: STAGE_SHAPE.rectangle,
    corners: rectCorners(x, y, x + size.widthFt, y + size.depthFt),
    heightFt: full.heightFt,
    on: host ? host.id : null,
  });
  /** the size's free spot nearest the middle of the area's first edge, as the layout; null when none is free */
  const placed = (size: StageSize): L | null => {
    const xs: number[] = [];
    for (let x = area.x0; x <= area.x1 - size.widthFt + 1e-9; x += step) xs.push(x);
    xs.sort(
      (a, b) => Math.abs(a + size.widthFt / 2 - midX) - Math.abs(b + size.widthFt / 2 - midX),
    );
    for (let y = area.y0; y <= area.y1 - size.depthFt + 1e-9; y += step)
      for (const x of xs) {
        const after = withStages(layout, [...stages, newStage(x, y, size)]);
        if (keepsRules(layout, after, plans)) return after;
      }
    return null;
  };
  // the full size first; then the largest size with a free spot, found by halving (a smaller stage fits where a larger
  // one does)
  const fullFits = placed(scaledTo(full, most * step));
  if (fullFits) return { layout: fullFits, id };
  let best: L | null = null;
  let lo = fewest,
    hi = most - 1;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const at = placed(scaledTo(full, mid * step));
    if (at) {
      best = at;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  if (best) return { layout: best, id };
  const smallest = scaledTo(full, fewest * step);
  return {
    layout: withStages(layout, [
      ...stages,
      newStage(midX - smallest.widthFt / 2, area.y0, smallest),
    ]),
    id,
  };
}

/** The layout without a stage and its risers; the boxes on them step down to what is under them. */
export function withStageRemoved<L extends Layout>(layout: L, id: SpaceStage["id"]): L {
  const { stages } = layout.venue;
  const stage = stageById(stages, id);
  if (!stage) return layout;
  const gone = new Set(familyOf(stages, stage).map((s) => s.id));
  return withStages(
    layout,
    stages.filter((s) => !gone.has(s.id)),
  );
}

/** The layout with one stage changed by `edit`. */
const withStage = <L extends Layout>(
  layout: L,
  id: SpaceStage["id"],
  edit: (s: SpaceStage) => SpaceStage,
): L =>
  withStages(
    layout,
    layout.venue.stages.map((s) => (s.id === id ? edit(s) : s)),
  );

/** The layout with a stage's shape set: a polygon squared to its outline; a rectangle keeps its corners. */
export function withStageShape<L extends Layout>(
  layout: L,
  id: SpaceStage["id"],
  shape: StageShape,
): L {
  const after = withStage(layout, id, (s) => {
    if (shape === STAGE_SHAPE.polygon) return { ...s, shape };
    const b = boundsOf(s.corners);
    return { ...s, shape, corners: rectCorners(b.x0, b.y0, b.x1, b.y1) };
  });
  return ruled(layout, after);
}

/** The layout with a stage's height above what it stands on set, ft (within `STAGE_HEIGHT_FT`). */
export function withStageHeight<L extends Layout>(
  layout: L,
  id: SpaceStage["id"],
  heightFt: number,
): L {
  const [lo, hi] = STAGE_HEIGHT_FT;
  const after = withStage(layout, id, (s) => ({
    ...s,
    heightFt: Math.min(hi, Math.max(lo, heightFt)),
  }));
  return ruled(layout, after);
}

/** A stage's place and size as its fields set them, ft: its middle from the center line, its back edge, its width, depth. */
export interface StageBox {
  x: number;
  y: number;
  w: number;
  d: number;
}

/** A stage's place and size (`StageBox`), from its outline. */
export function stageBox(stage: Pick<SpaceStage, "corners">): StageBox {
  const b = boundsOf(stage.corners);
  return { x: (b.x0 + b.x1) / 2, y: b.y0, w: b.x1 - b.x0, d: b.y1 - b.y0 };
}

/**
 * The placements with the boxes standing on `ids` (as `layout` stands them) moved by `by`, ft: a placement moves once.
 * A mirrored pair moves down the room only: across it, it stays where it is.
 */
function ridersMoved(
  layout: Layout,
  ids: ReadonlySet<SpaceStage["id"]>,
  by: FloorPoint,
  plans: SpotPlans,
): SpacePlacement[] {
  const { stages } = layout.venue;
  const placed = placedPlans(layout.placements, plans);
  const riding = new Set<number>();
  expandPlacements(layout.placements).forEach((p, i) => {
    const plan = placed[i];
    if (!plan.length) return;
    const on = stageAt(stages, planCenter(plan, p));
    if (on && ids.has(on.id)) riding.add(p.source);
  });
  return layout.placements.map((p, k) =>
    riding.has(k) ? { ...p, x: p.mirrored ? p.x : p.x + by.x, y: p.y + by.y } : p,
  );
}

/** The layout with a stage and its risers, and the boxes on them, moved by `by`, ft. */
function withFamilyMoved<L extends Layout>(
  layout: L,
  stage: SpaceStage,
  by: FloorPoint,
  plans: SpotPlans,
): L {
  const { stages } = layout.venue;
  const ids = new Set(familyOf(stages, stage).map((s) => s.id));
  return {
    ...withStages(
      layout,
      stages.map((s) => (ids.has(s.id) ? { ...s, corners: movedOutline(s.corners, by) } : s)),
    ),
    placements: ridersMoved(layout, ids, by, plans),
  };
}

/**
 * The layout with a stage's place and size set from its fields (`StageBox`, any part of it): its outline scales and
 * moves to the new box; its risers and the boxes on it move with its back left corner. A change that breaks a stage
 * rule leaves the layout as it was.
 */
export function withStageBox<L extends Layout>(
  layout: L,
  id: SpaceStage["id"],
  set: Partial<StageBox>,
  plans: SpotPlans,
): L {
  const stage = stageById(layout.venue.stages, id);
  if (!stage) return layout;
  const was = boundsOf(stage.corners);
  const box = { ...stageBox(stage), ...set };
  const w = Math.max(STAGE_MIN_SIDE_FT, box.w),
    d = Math.max(STAGE_MIN_SIDE_FT, box.d);
  const x0 = box.x - w / 2,
    y0 = box.y;
  const by = { x: x0 - was.x0, y: y0 - was.y0 };
  const sx = w / (was.x1 - was.x0 || 1),
    sy = d / (was.y1 - was.y0 || 1);
  const moved = withFamilyMoved(layout, stage, by, plans);
  const after = withStage(moved, id, (s) => ({
    ...s,
    corners: stage.corners.map((p) => ({
      x: x0 + (p.x - was.x0) * sx,
      y: y0 + (p.y - was.y0) * sy,
    })),
  }));
  return ruled(layout, after);
}

/** Snaps to a quarter foot. */
const quarter = (v: number) => Math.round(v * 4) / 4;

/** The reach of a stage's snap, ft. */
const SNAP_FT = SNAP_FLUSH_IN / INCHES_PER_FOOT;

/** The nearest line within the snap's reach, else `v`. */
function snapTo(v: number, lines: readonly number[]): number {
  let best = v,
    gap = SNAP_FT;
  for (const l of lines)
    if (Math.abs(v - l) < gap) {
      gap = Math.abs(v - l);
      best = l;
    }
  return best;
}

/**
 * The lines a dragged stage's corners snap to, ft: the walls, the other stages' corners, and the faces of the boxes
 * that don't stand on it.
 */
function snapLines(layout: Layout, skip: ReadonlySet<SpaceStage["id"]>, plans: SpotPlans) {
  const { stages, room } = layout.venue;
  const others = stages.filter((s) => !skip.has(s.id)).flatMap((s) => s.corners);
  // the boxes on the stages that move are left out: they move with them
  const boxes = placedPlans(layout.placements, plans)
    .filter((plan) => {
      const on = plan.length ? stageAt(stages, planCenter(plan, { x: 0, y: 0 })) : null;
      return !on || !skip.has(on.id);
    })
    .flatMap((plan) => plan.flat());
  return {
    x: [-room.widthFt / 2, room.widthFt / 2, ...others.map((p) => p.x), ...boxes.map((p) => p.x)],
    y: [0, room.lengthFt, ...others.map((p) => p.y), ...boxes.map((p) => p.y)],
  };
}

/** A drag on a stage: the whole stage (`handle` null) or one of its 8 handles, by `by` from where it started, ft. */
export interface StageDrag {
  id: SpaceStage["id"];
  handle: number | null;
  by: FloorPoint;
  /** whether it snaps: on the quarter-foot grid, and within reach of the walls, stages and boxes */
  snaps: boolean;
}

/**
 * The layout after a drag from `start` (as it was when the drag began): the stage moved with its risers and the boxes
 * on it (a stage dropped wholly on a floor stage becomes its riser, unless it has risers of its own; off it, a floor
 * stage again), a rectangle's edge moved by its handle, or a polygon's corner. A box the stage leaves stands on what is
 * under it. Null when it breaks a stage rule `start` kept.
 */
export function withStageDragged<L extends Layout>(
  start: L,
  drag: StageDrag,
  plans: SpotPlans,
): L | null {
  const { stages } = start.venue;
  const stage = stageById(stages, drag.id);
  if (!stage) return null;
  const family = familyOf(stages, stage);
  const lines = snapLines(start, new Set(family.map((s) => s.id)), plans);
  const sx = (v: number) => (drag.snaps ? snapTo(quarter(v), lines.x) : v);
  const sy = (v: number) => (drag.snaps ? snapTo(quarter(v), lines.y) : v);
  let after: L;
  if (drag.handle === null) {
    // the move that puts a corner on a line, the nearest such corner on each axis (one on a line already stays)
    let by = drag.by;
    if (drag.snaps) {
      const axis = (k: keyof FloorPoint) => {
        let best: number | null = null,
          gap = SNAP_FT;
        for (const p of stage.corners)
          for (const l of lines[k]) {
            const off = Math.abs(l - (p[k] + by[k]));
            if (off < gap || (off === gap && best === null)) {
              gap = off;
              best = l - p[k];
            }
          }
        return best ?? quarter(by[k]);
      };
      by = { x: axis("x"), y: axis("y") };
    }
    const moved = withFamilyMoved(start, stage, by, plans);
    const corners = movedOutline(stage.corners, by);
    // a stage with risers stays on the floor: no risers on risers
    const hosts = stagesOn(stages, stage.id).length
      ? []
      : stagesOn(stages, null).filter((o) => o.id !== stage.id && within(corners, o.corners));
    const host = hosts.reduce<SpaceStage | null>(
      (a, o) => (!a || stageTopFt(stages, o) > stageTopFt(stages, a) ? o : a),
      null,
    );
    after = withStage(moved, stage.id, (s) => ({ ...s, on: host ? host.id : null }));
  } else if (stage.shape === STAGE_SHAPE.rectangle) {
    // handles 0–2 are the back edge, 2–4 the right, 4–6 the front, 6, 7 and 0 the left
    const k = drag.handle;
    let { x0, x1, y0, y1 } = boundsOf(stage.corners);
    if ([0, 6, 7].includes(k)) x0 = Math.min(sx(x0 + drag.by.x), x1 - STAGE_MIN_SIDE_FT);
    if ([2, 3, 4].includes(k)) x1 = Math.max(sx(x1 + drag.by.x), x0 + STAGE_MIN_SIDE_FT);
    if ([0, 1, 2].includes(k)) y0 = Math.min(sy(y0 + drag.by.y), y1 - STAGE_MIN_SIDE_FT);
    if ([4, 5, 6].includes(k)) y1 = Math.max(sy(y1 + drag.by.y), y0 + STAGE_MIN_SIDE_FT);
    after = withStage(start, stage.id, (s) => ({ ...s, corners: rectCorners(x0, y0, x1, y1) }));
  } else {
    const k = drag.handle;
    after = withStage(start, stage.id, (s) => ({
      ...s,
      corners: s.corners.map((p, i) =>
        i === k ? { x: sx(p.x + drag.by.x), y: sy(p.y + drag.by.y) } : p,
      ),
    }));
  }
  return stagesKeepRules(start, after) ? after : null;
}
