// The Space page's edits to its stages: add, remove, reshape, size and move one (with its risers and the boxes on it),
// each kept only when it breaks no rule the space kept before (lib/speaker/spaceStages). Pure.
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
  NEW_RISER_SMALL,
  NEW_STAGE,
  SNAP_FLUSH_IN,
  STAGE_HEIGHT_FT,
  STAGE_MIN_SIDE_FT,
  STAGE_SHAPE,
  STAGE_SPOT_STEP_FT,
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

/** The rules a layout breaks: each stage (by id) and box (by its index) that breaks one. */
function broken(layout: Layout, plans: SpotPlans): Set<string> {
  const { stages, room } = layout.venue;
  const out = new Set<string>();
  for (const s of stages) if (!stageKeepsRules(stages, room, s)) out.add(`stage:${s.id}`);
  placedPlans(layout.placements, plans).forEach((plan, i) => {
    if (!boxFits(stages, plan)) out.add(`box:${i}`);
  });
  return out;
}

/** Whether `after` breaks no rule `before` kept (a layout that broke one already can still change elsewhere). */
export function keepsRules(before: Layout, after: Layout, plans: SpotPlans): boolean {
  const was = broken(before, plans);
  return [...broken(after, plans)].every((k) => was.has(k));
}

/** `after` when it keeps the rules `before` kept, else `before`. */
const ruled = <L extends Layout>(before: L, after: L, plans: SpotPlans): L =>
  keepsRules(before, after, plans) ? after : before;

/** A layout with its stages changed. */
const withStages = <L extends Layout>(layout: L, stages: readonly SpaceStage[]): L => ({
  ...layout,
  venue: { ...layout.venue, stages },
});

/** A new stage's id: one no stage in the list has. */
function newStageId(stages: readonly SpaceStage[]): SpaceStage["id"] {
  let n = stages.length + 1;
  while (stages.some((s) => s.id === `stage-${n}`)) n++;
  return `stage-${n}`;
}

/**
 * The layout with a new stage on `on` (a floor stage's id; null: the floor), or null when no spot is free: a stage
 * `NEW_STAGE` big, at the first free spot nearest the middle of the front wall; a riser `NEW_RISER` big (or
 * `NEW_RISER_SMALL` where that doesn't fit), at the first free spot nearest the middle of its stage's back edge.
 */
export function withStageAdded<L extends Layout>(
  layout: L,
  on: SpaceStage["id"] | null,
  plans: SpotPlans,
): { layout: L; id: SpaceStage["id"] } | null {
  const { stages, room } = layout.venue;
  const host = stageById(stages, on);
  const sizes = host ? [NEW_RISER, NEW_RISER_SMALL] : [NEW_STAGE];
  const area = host
    ? boundsOf(host.corners)
    : { x0: -room.widthFt / 2, x1: room.widthFt / 2, y0: 0, y1: room.lengthFt };
  const midX = (area.x0 + area.x1) / 2;
  const id = newStageId(stages);
  for (const size of sizes) {
    const xs: number[] = [];
    for (let x = area.x0; x <= area.x1 - size.widthFt + 1e-9; x += STAGE_SPOT_STEP_FT) xs.push(x);
    xs.sort(
      (a, b) => Math.abs(a + size.widthFt / 2 - midX) - Math.abs(b + size.widthFt / 2 - midX),
    );
    for (let y = area.y0; y <= area.y1 - size.depthFt + 1e-9; y += STAGE_SPOT_STEP_FT)
      for (const x of xs) {
        const stage: SpaceStage = {
          id,
          shape: STAGE_SHAPE.rectangle,
          corners: rectCorners(x, y, x + size.widthFt, y + size.depthFt),
          heightFt: size.heightFt,
          on: host ? host.id : null,
        };
        const after = withStages(layout, [...stages, stage]);
        if (keepsRules(layout, after, plans)) return { layout: after, id };
      }
  }
  return null;
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
  plans: SpotPlans,
): L {
  const after = withStage(layout, id, (s) => {
    if (shape === STAGE_SHAPE.polygon) return { ...s, shape };
    const b = boundsOf(s.corners);
    return { ...s, shape, corners: rectCorners(b.x0, b.y0, b.x1, b.y1) };
  });
  return ruled(layout, after, plans);
}

/** The layout with a stage's height above what it stands on set, ft (within `STAGE_HEIGHT_FT`). */
export function withStageHeight<L extends Layout>(
  layout: L,
  id: SpaceStage["id"],
  heightFt: number,
  plans: SpotPlans,
): L {
  const [lo, hi] = STAGE_HEIGHT_FT;
  const after = withStage(layout, id, (s) => ({
    ...s,
    heightFt: Math.min(hi, Math.max(lo, heightFt)),
  }));
  return ruled(layout, after, plans);
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
 * The placements with the boxes standing on `ids` (as `layout` stands them) moved by `by`, ft: a placement moves once,
 * by its box as set, or by its mirror image (which moves the other way across the room).
 */
function ridersMoved(
  layout: Layout,
  ids: ReadonlySet<SpaceStage["id"]>,
  by: FloorPoint,
  plans: SpotPlans,
): SpacePlacement[] {
  const { stages } = layout.venue;
  const placed = placedPlans(layout.placements, plans);
  const riding = new Map<number, boolean>();
  expandPlacements(layout.placements).forEach((p, i) => {
    const plan = placed[i];
    if (!plan.length) return;
    const on = stageAt(stages, planCenter(plan, p));
    if (!on || !ids.has(on.id)) return;
    if (!riding.has(p.source) || !p.image) riding.set(p.source, p.image);
  });
  return layout.placements.map((p, k) => {
    const image = riding.get(k);
    return image === undefined ? p : { ...p, x: p.x + (image ? -by.x : by.x), y: p.y + by.y };
  });
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
 * moves to the new box; its risers and the boxes on it move with its back left corner.
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
  return ruled(layout, after, plans);
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

/** The lines a dragged stage's corners snap to, ft: the walls, the other stages' corners, and the boxes' faces. */
function snapLines(layout: Layout, skip: ReadonlySet<SpaceStage["id"]>, plans: SpotPlans) {
  const { stages, room } = layout.venue;
  const others = stages.filter((s) => !skip.has(s.id)).flatMap((s) => s.corners);
  const boxes = placedPlans(layout.placements, plans).flatMap((plan) => plan.flat());
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
 * stage again), a rectangle's edge moved by its handle, or a polygon's corner. Null when it breaks a rule `start` kept.
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
    // the move that puts a corner on a line, the nearest such corner on each axis
    let by = drag.by;
    if (drag.snaps) {
      let gapX = SNAP_FT,
        gapY = SNAP_FT;
      const snapped = { x: quarter(by.x), y: quarter(by.y) };
      for (const p of stage.corners) {
        const ox = snapTo(p.x + by.x, lines.x) - p.x,
          oy = snapTo(p.y + by.y, lines.y) - p.y;
        if (ox !== by.x && Math.abs(ox - by.x) < gapX) {
          gapX = Math.abs(ox - by.x);
          snapped.x = ox;
        }
        if (oy !== by.y && Math.abs(oy - by.y) < gapY) {
          gapY = Math.abs(oy - by.y);
          snapped.y = oy;
        }
      }
      by = snapped;
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
  return keepsRules(start, after, plans) ? after : null;
}
