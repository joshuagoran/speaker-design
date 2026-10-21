// The space's feed solver: what Calculate delays and Calculate gains set, worked out from the layout. Pure. It reads no
// delay, and a fill's level only as a step from its own, so running it again changes nothing.
//
// Mains (every placement that is not a fill) line up at the listener: each main's first arrival there (each driver's
// path at the speed of sound, with its member's delay) is found, and the latest one sets the time; each main waits
// until then. Mains keep their gain. Each fill works at its own aim point (where its axis meets ear height, or a wall
// first), against the nearest main there:
// - delay: it arrives FILL_PRECEDENCE_MS after that main (with the main's new delay), so the sound still seems to come
//   from the mains (the precedence effect). Never below 0.
// - gain: it plays at that main's level there, in FILL_ALIGN_BAND (the voice range a fill is there for).
// A mirrored pair is one placement: its two boxes share one delay and one gain.
import type { FloorPoint, PairSide, SpaceVenue } from "../../types";
import {
  spaceGridRequest,
  spaceLevelAt,
  type SpaceGridRequest,
  type SpaceModel,
  type SpacePlacementModel,
} from "./spaceCoverage";
import type { RoomPoint } from "./spaceLayout";
import { SPEED_OF_SOUND } from "../../constants/acoustics";
import { METERS_PER_FOOT } from "../../constants/units";
import {
  ARRIVAL_MAIN_CLOSE_MS,
  ARRIVAL_MAIN_ON_TIME_MS,
  ARRIVAL_STATUS,
  DELAY_NOTE,
  FILL_ALIGN_BAND,
  FILL_PRECEDENCE_MAX_MS,
  FILL_PRECEDENCE_MS,
} from "../../constants/space";

/** Milliseconds in a second. */
const MS_PER_S = 1000;

/** Why a solved delay is not what its rule asks (`DELAY_NOTE`). */
export type DelayNote = (typeof DELAY_NOTE)[keyof typeof DELAY_NOTE];

/** How an arrival at the listener compares with the mains (`ARRIVAL_STATUS`). */
export type ArrivalStatus = (typeof ARRIVAL_STATUS)[keyof typeof ARRIVAL_STATUS];

/** One placement's feed as the solver sets it: its delay and its level. */
export interface SolvedFeed {
  /** the delay Calculate delays sets, ms */
  delayMs: number;
  /** why the delay is not what its rule asks; null when it is */
  delayNote: DelayNote | null;
  /** the gain Calculate gains sets, dB: a fill's, matched to its main; a main keeps its own (lib/speaker/spaceGains) */
  levelDb: number;
}

/** The venue the solver reads: the listener, the ear height and the room. */
export type SolverVenue = Pick<SpaceVenue, "listener" | "earFt" | "room">;

/** A floor point at ear height, ft. */
const atEar = (p: FloorPoint, earFt: number): RoomPoint => ({ x: p.x, y: p.y, z: earFt });

/**
 * A box's first arrival at `at` (ft), ms: the least over its drivers of the path at the speed of sound plus its
 * member's delay (the placement's own delay left out); null when it has no modeled driver.
 */
export function boxArrivalMs(box: SpacePlacementModel, at: RoomPoint): number | null {
  const { response } = box;
  if (!response) return null;
  const times = box.item.drivers.flatMap((d) => {
    const member = response.members[d.member];
    if (!member) return [];
    const pathM = Math.hypot(d.at.x - at.x, d.at.y - at.y, d.at.z - at.z) * METERS_PER_FOOT;
    return [(pathM / SPEED_OF_SOUND) * MS_PER_S + member.delayMs];
  });
  return times.length ? Math.min(...times) : null;
}

/** The least of some times, null when none is known. */
const earliest = (times: readonly (number | null)[]) => {
  const known = times.filter((t): t is number => t !== null);
  return known.length ? Math.min(...known) : null;
};

/** Each placement's boxes (indexes into the model's boxes), by the placement's index; a mirrored pair has two. */
function boxesBySource(model: Pick<SpaceModel, "placements">): number[][] {
  const count = Math.max(0, ...model.placements.map((p) => p.item.placement.source + 1));
  const out: number[][] = Array.from({ length: count }, () => []);
  model.placements.forEach((p, i) => out[p.item.placement.source]?.push(i));
  return out;
}

/**
 * A box's aim point on the floor, ft: where its axis (from the middle of its drivers, along their mean yaw and tilt)
 * meets ear height, or a wall first. A box with no drivers aims at its own spot.
 */
export function aimPoint(
  box: Pick<SpacePlacementModel, "item">,
  venue: Pick<SolverVenue, "earFt" | "room">,
): FloorPoint {
  const { drivers, placement } = box.item;
  if (!drivers.length) return { x: placement.x, y: placement.y };
  /** the mean of some numbers */
  const mean = (v: readonly number[]) => v.reduce((a, b) => a + b, 0) / v.length;
  const from: RoomPoint = {
    x: mean(drivers.map((d) => d.at.x)),
    y: mean(drivers.map((d) => d.at.y)),
    z: mean(drivers.map((d) => d.at.z)),
  };
  const yaw = mean(drivers.map((d) => d.yaw));
  const pitch = mean(drivers.map((d) => d.pitch));
  /** the axis's direction: across, down the room and up, per foot along it (yaw 0 is straight down the room) */
  const dir = {
    x: Math.sin(yaw) * Math.cos(pitch),
    y: Math.cos(yaw) * Math.cos(pitch),
    z: Math.sin(pitch),
  };
  const half = venue.room.widthFt / 2,
    { lengthFt } = venue.room;
  /** how far along the axis it reaches `to` on one coordinate, ft; Infinity when it never does going forward */
  const reach = (start: number, step: number, to: number) => {
    const t = step ? (to - start) / step : Infinity;
    return t > 0 ? t : Infinity;
  };
  const t = Math.min(
    reach(from.z, dir.z, venue.earFt),
    reach(from.x, dir.x, dir.x > 0 ? half : -half),
    reach(from.y, dir.y, dir.y > 0 ? lengthFt : 0),
  );
  if (!Number.isFinite(t)) return { x: from.x, y: from.y };
  return {
    x: Math.max(-half, Math.min(half, from.x + dir.x * t)),
    y: Math.max(0, Math.min(lengthFt, from.y + dir.y * t)),
  };
}

/** The nearest distance from any driver of some boxes to `at`, ft; Infinity when they have none. */
const nearestFt = (
  model: Pick<SpaceModel, "placements">,
  boxes: readonly number[],
  at: RoomPoint,
) =>
  Math.min(
    ...boxes.flatMap((i) =>
      (model.placements[i]?.item.drivers ?? []).map((d) =>
        Math.hypot(d.at.x - at.x, d.at.y - at.y, d.at.z - at.z),
      ),
    ),
  );

/** A request with every placement but `source` silent. */
export function placementRequest<R extends Pick<SpaceGridRequest, "outputs">>(
  model: Pick<SpaceModel, "feeds">,
  req: R,
  source: number,
): R {
  return {
    ...req,
    outputs: req.outputs.map((out) =>
      Object.fromEntries(
        model.feeds.flatMap((f) =>
          f.placement === source && out[f.id] ? [[f.id, out[f.id]]] : [],
        ),
      ),
    ),
  };
}

/**
 * Placement `source`'s level alone at a floor spot (ft, at ear height), dB: every other placement silent, in the
 * request's band, at the levels the model plays.
 */
export const placementLevelAt = (
  model: Pick<SpaceModel, "feeds">,
  req: Omit<SpaceGridRequest, "cols">,
  source: number,
  at: FloorPoint,
): number => spaceLevelAt(placementRequest(model, req, source), at);

/**
 * Every placement's feed, by its index in the space (see the file's note), from `model` as it plays. A placement with
 * no modeled box keeps its level and gets no delay.
 */
export function solveFeeds(model: SpaceModel, venue: SolverVenue): SolvedFeed[] {
  const bySource = boxesBySource(model);
  /** each placement as set: its first box carries its modes and role */
  const setOf = (k: number) => model.placements[bySource[k]?.[0] ?? -1]?.item.placement;
  const isFill = (k: number) => setOf(k)?.fill ?? false;
  const solved: SolvedFeed[] = bySource.map((_, k) => ({
    delayMs: 0,
    delayNote: null,
    levelDb: setOf(k)?.levelDb ?? 0,
  }));
  /** placement `k`'s first arrival at `at`, ms, without its own delay */
  const arrivalAt = (k: number, at: RoomPoint) =>
    earliest((bySource[k] ?? []).map((i) => boxArrivalMs(model.placements[i], at)));

  // the mains, at the listener: the latest one sets the time
  const listener = atEar(venue.listener, venue.earFt);
  const mainArrival = new Map(
    bySource.flatMap((_, k) => {
      const t = isFill(k) ? null : arrivalAt(k, listener);
      return t === null ? [] : [[k, t] as const];
    }),
  );
  const heard = [...mainArrival.keys()];
  const latest = Math.max(...heard.map((k) => mainArrival.get(k) ?? 0));
  for (const k of heard)
    solved[k] = { ...solved[k], delayMs: latest - (mainArrival.get(k) ?? latest) };

  // each fill against the nearest main at each of its boxes' aim points
  /** the band the fill levels are matched in, worked out only when a fill needs it */
  let levelReq: Omit<SpaceGridRequest, "cols"> | null = null;
  const levelAt = (source: number, at: FloorPoint) => {
    levelReq ??= spaceGridRequest(model, venue, FILL_ALIGN_BAND, 0, 1);
    return placementLevelAt(model, levelReq, source, at);
  };
  bySource.forEach((boxes, k) => {
    const feed = solved[k];
    if (!isFill(k)) return;
    if (!heard.length) {
      solved[k] = { ...feed, delayNote: DELAY_NOTE.noMain };
      return;
    }
    const sides = boxes.flatMap((i) => {
      const box = model.placements[i];
      const spot = aimPoint(box, venue);
      const at = atEar(spot, venue.earFt);
      const own = boxArrivalMs(box, at);
      if (own === null) return [];
      const main = heard.reduce((a, b) =>
        nearestFt(model, bySource[b] ?? [], at) < nearestFt(model, bySource[a] ?? [], at) ? b : a,
      );
      const mainT = arrivalAt(main, at) ?? 0;
      return [{ spot, main, waitMs: mainT + solved[main].delayMs - own + FILL_PRECEDENCE_MS }];
    });
    if (!sides.length) return;
    // a pair waits for its later box, so neither box plays before the mains in its area
    const wait = Math.max(...sides.map((s) => s.waitMs));
    // the fill (both boxes of a pair) moves by the step that lands it on the main's level there; a pair takes the mean
    const steps = sides
      .map((s) => levelAt(s.main, s.spot) - levelAt(k, s.spot))
      .filter(Number.isFinite);
    solved[k] = {
      delayMs: Math.max(0, wait),
      delayNote: wait < 0 ? DELAY_NOTE.clamped : null,
      levelDb: steps.length
        ? feed.levelDb + steps.reduce((a, b) => a + b, 0) / steps.length
        : feed.levelDb,
    };
  });
  return solved;
}

/** One placement's arrival at the listener (a pair's box, where the two differ). */
export interface ListenerArrival {
  /** the placement (its index in the space) and, for one box of a pair, its side; null: the placement as a whole */
  placement: number;
  side: PairSide | null;
  fill: boolean;
  /** its first arrival at the listener after the latest main's, ms, with every delay: + later, − earlier */
  afterMainsMs: number;
  status: ArrivalStatus;
}

/**
 * How an arrival compares with the mains: a main on time within ARRIVAL_MAIN_ON_TIME_MS of the latest main, close
 * within ARRIVAL_MAIN_CLOSE_MS, off beyond; a fill on time FILL_PRECEDENCE_MS to FILL_PRECEDENCE_MAX_MS after them,
 * close otherwise.
 */
export function arrivalStatus(afterMainsMs: number, fill: boolean): ArrivalStatus {
  if (fill)
    return afterMainsMs >= FILL_PRECEDENCE_MS && afterMainsMs <= FILL_PRECEDENCE_MAX_MS
      ? ARRIVAL_STATUS.onTime
      : ARRIVAL_STATUS.close;
  const off = Math.abs(afterMainsMs);
  return off <= ARRIVAL_MAIN_ON_TIME_MS
    ? ARRIVAL_STATUS.onTime
    : off <= ARRIVAL_MAIN_CLOSE_MS
      ? ARRIVAL_STATUS.close
      : ARRIVAL_STATUS.off;
}

/** An arrival as the list rounds it, ms: a pair's boxes that round the same are one row. */
const shownMs = (ms: number) => ms.toFixed(1);

/**
 * Each placement's arrival at the listener (ft, at ear height) with its delay, after the latest main's: one row a
 * placement, or one a box for a pair whose boxes differ. Empty when no main is heard there.
 */
export function listenerArrivals(
  model: Pick<SpaceModel, "placements">,
  listener: FloorPoint,
  earFt: SpaceVenue["earFt"],
): ListenerArrival[] {
  const at = atEar(listener, earFt);
  const bySource = boxesBySource(model);
  /** each box's arrival with its placement's delay, by placement */
  const times = bySource.map((boxes) =>
    boxes.flatMap((i) => {
      const box = model.placements[i];
      const t = boxArrivalMs(box, at);
      return t === null
        ? []
        : [{ side: box.item.placement.side, ms: t + box.item.placement.delayMs }];
    }),
  );
  const fillOf = (k: number) =>
    model.placements[bySource[k]?.[0] ?? -1]?.item.placement.fill ?? false;
  const mainTimes = times.flatMap((t, k) =>
    fillOf(k) || !t.length ? [] : [Math.min(...t.map((b) => b.ms))],
  );
  if (!mainTimes.length) return [];
  const latest = Math.max(...mainTimes);
  return times.flatMap((boxes, k): ListenerArrival[] => {
    if (!boxes.length) return [];
    const fill = fillOf(k);
    const row = (side: PairSide | null, ms: number): ListenerArrival => ({
      placement: k,
      side,
      fill,
      afterMainsMs: ms - latest,
      status: arrivalStatus(ms - latest, fill),
    });
    const split = new Set(boxes.map((b) => shownMs(b.ms - latest))).size > 1;
    return split
      ? boxes.map((b) => row(b.side, b.ms))
      : [row(null, Math.min(...boxes.map((b) => b.ms)))];
  });
}
