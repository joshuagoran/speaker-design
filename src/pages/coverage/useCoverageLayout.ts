import { useEffect } from "react";
import {
  COVERAGE_LEVEL_REF,
  COVERAGE_TARGET_DB,
  LEGACY_LEVEL_MODE,
} from "../../constants/coverageLevel";
import { useStoredStateFrom } from "../../hooks/useStoredState";
import { COVERAGE_LAYOUT_KEY } from "../../constants/coverageTestIds";
import { LISTENER_TARGET_DB } from "../../lib/pa/optimize";
import type {
  CoverageBand,
  CoverageLayout,
  CoverageLevelMode,
  CoverageLevelRef,
  CoverageRoom,
  CoverageStack,
  FloorCrowd,
  FloorPoint,
  RoomMaterial,
  RoomSide,
  RoomSurface,
  SubPlacement,
} from "../../types";

/**
 * A dance floor about 1500 sq ft with a 14 ft drywall ceiling, block walls all round, an empty floor; the stacks a
 * few feet off the front wall, toed in a little.
 */
export const DEFAULT_COVERAGE_LAYOUT: CoverageLayout = {
  room: {
    widthFt: 34,
    lengthFt: 44,
    ceilingFt: 14,
    materials: {
      front: "concrete",
      back: "concrete",
      left: "concrete",
      right: "concrete",
      ceiling: "drywall",
    },
    crowd: "empty",
    outdoors: false,
  },
  stacks: [
    { x: -9, y: 3, aim: 12 },
    { x: 9, y: 3, aim: -12 },
  ],
  subs: "stacks",
  cluster: { x: 0, y: 2.5 },
  mirror: true,
  band: "sub",
  freqHz: 50,
  targetDb: LISTENER_TARGET_DB,
  levelRef: COVERAGE_LEVEL_REF.audience,
  earFt: 5.3,
  listener: { x: 3, y: 24 },
};

/** Room size limits, ft. */
export const ROOM_WIDTH_FT: [number, number] = [16, 80];
export const ROOM_LENGTH_FT: [number, number] = [16, 100];
export const ROOM_CEILING_FT: [number, number] = [8, 40];
/** How far the stacks may turn either way, degrees. */
const MAX_AIM_DEG = 60;

/** Snaps to a quarter foot. */
const snap = (v: number) => Math.round(v * 4) / 4;

/** The room's floor size, ft. */
type RoomFloor = Pick<CoverageRoom, "widthFt" | "lengthFt">;
/** The boxes' footprint, inches: the sub box's, which the map draws every box at. */
type Footprint = CoverageStack["footprint"];
/** How far something reaches from its position point either way across (`x`) and along (`y`) the room, ft. */
type Reach = FloorPoint;

/** The listener stays this far from every side, ft. */
const LISTENER_REACH: Reach = { x: 0.5, y: 0.5 };

/**
 * How far a box of this footprint reaches from its position point when turned `aim` degrees. The point is the box's
 * center (the map draws the box around it and the model puts its drivers there), so it reaches half its turned extent
 * each way.
 */
export const boxReach = (footprint: Footprint, aim: number): Reach => {
  const a = (aim * Math.PI) / 180,
    c = Math.abs(Math.cos(a)),
    s = Math.abs(Math.sin(a));
  const w = footprint.w / 12,
    d = footprint.d / 12;
  return { x: (w * c + d * s) / 2, y: (w * s + d * c) / 2 };
};

/**
 * How far the center subs reach from the cluster point: a pair side by side reaches a whole box width either way
 * (see `coverageBoxes`), one sub half of one. The subs face straight down the room.
 */
export const clusterReach = (footprint: Footprint, subs: CoverageLayout["subs"]): Reach => {
  const one = boxReach(footprint, 0);
  return subs === "center" ? { x: one.x * 2, y: one.y } : one;
};

/** Keeps a point inside the room, so that what reaches `reach` from it at most touches the sides. */
const inRoom = <P extends FloorPoint>(p: P, room: RoomFloor, reach: Reach): P => {
  // something wider than the room sits in its middle
  const clamp = (v: number, lo: number, hi: number) =>
    lo > hi ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, v));
  const half = room.widthFt / 2;
  return {
    ...p,
    x: clamp(snap(p.x), -half + reach.x, half - reach.x),
    y: clamp(snap(p.y), reach.y, room.lengthFt - reach.y),
  };
};

/** A stack kept inside the room: at its aim, its box at most against the walls. */
export const stackInRoom = <S extends CoverageLayout["stacks"][0]>(
  s: S,
  room: RoomFloor,
  footprint: Footprint,
): S => inRoom(s, room, boxReach(footprint, s.aim));

/** Everything placed back inside the room after it, or the sub placement, changes. */
export const fitted = (l: CoverageLayout, footprint: Footprint): CoverageLayout => ({
  ...l,
  stacks: [
    stackInRoom(l.stacks[0], l.room, footprint),
    stackInRoom(l.stacks[1], l.room, footprint),
  ],
  cluster: inRoom(l.cluster, l.room, clusterReach(footprint, l.subs)),
  listener: inRoom(l.listener, l.room, LISTENER_REACH),
});

/**
 * A layout as stored: any saved field over the defaults. Layouts saved before materials had a wall on or off per side
 * (`walls`) and one `absorption` for them all; layouts saved before the target level had a `levelMode`.
 */
export type StoredCoverageLayout = Partial<Omit<CoverageLayout, "room">> & {
  levelMode?: CoverageLevelMode;
  room?: Partial<CoverageRoom> & {
    walls?: Partial<Record<RoomSide, boolean>>;
    absorption?: number;
  };
};

/**
 * The target and its reference for an old `levelMode`: "target at the listener" keeps the planner's target there; "at
 * its limit" asks the listener for the most the slider offers, so the system plays as loud as it can.
 */
const fromLevelMode = (
  mode: CoverageLevelMode | undefined,
): Partial<Pick<CoverageLayout, "targetDb" | "levelRef">> =>
  mode === LEGACY_LEVEL_MODE.listener
    ? { levelRef: COVERAGE_LEVEL_REF.listener }
    : mode === LEGACY_LEVEL_MODE.limit
      ? { levelRef: COVERAGE_LEVEL_REF.listener, targetDb: COVERAGE_TARGET_DB[1] }
      : {};

/** A stored layout over the defaults, so a layout saved before a field existed still loads. */
export const fromStored = ({ levelMode, ...s }: StoredCoverageLayout): CoverageLayout => {
  const { walls, absorption: _absorption, ...room } = s.room ?? {};
  // an old wall that was there is drywall, one that wasn't is open; its single absorption is dropped
  const old: Partial<Record<RoomSurface, RoomMaterial>> = {};
  if (walls)
    for (const [side, on] of Object.entries(walls))
      // boundary cast: Object.entries widens the keys of a Record<RoomSide, …> to string
      old[side as RoomSide] = on ? "drywall" : "open";
  const def = DEFAULT_COVERAGE_LAYOUT.room;
  return {
    ...DEFAULT_COVERAGE_LAYOUT,
    ...fromLevelMode(levelMode),
    ...s,
    room: { ...def, ...room, materials: { ...def.materials, ...old, ...room.materials } },
  };
};

/** The coverage page's layout and the ways to change it. */
export interface CoverageLayoutState {
  layout: CoverageLayout;
  /** move a stack (and, mirrored, the other) */
  moveStack: (i: 0 | 1, p: FloorPoint) => void;
  /** turn a stack to face `p` (and, mirrored, the other) */
  aimStack: (i: 0 | 1, p: FloorPoint) => void;
  moveCluster: (p: FloorPoint) => void;
  moveListener: (p: FloorPoint) => void;
  setRoomSize: (size: Pick<CoverageRoom, "widthFt" | "lengthFt">) => void;
  setMaterial: (surface: RoomSurface, material: RoomMaterial) => void;
  setCeilingFt: (ft: number) => void;
  setCrowd: (crowd: FloorCrowd) => void;
  setOutdoors: (outdoors: boolean) => void;
  setBand: (band: CoverageBand) => void;
  setFreqHz: (f: number) => void;
  setTargetDb: (db: number) => void;
  setLevelRef: (ref: CoverageLevelRef) => void;
  setSubs: (subs: SubPlacement) => void;
  setMirror: (mirror: boolean) => void;
  setEarFt: (ft: number) => void;
  reset: () => void;
}

/**
 * The floor layout, remembered per viewer: it belongs to the venue, not to the design, so it isn't saved with configs.
 * `footprint` is the design's box, inches, so a box can go right against a wall and no further.
 */
export function useCoverageLayout(footprint: Footprint): CoverageLayoutState {
  const [layout, setLayout] = useStoredStateFrom<CoverageLayout, StoredCoverageLayout>(
    COVERAGE_LAYOUT_KEY,
    {},
    fromStored,
  );
  const update = (fn: (l: CoverageLayout) => CoverageLayout) => setLayout((l) => fn(l));
  // a new sub box may reach through a wall it stood against: fit everything back inside
  useEffect(() => setLayout((l) => fitted(l, footprint)), [footprint.w, footprint.d]);
  const withStack = (l: CoverageLayout, i: 0 | 1, s: CoverageLayout["stacks"][0]) => {
    const stacks: CoverageLayout["stacks"] = [...l.stacks];
    stacks[i] = s;
    if (l.mirror) stacks[i === 0 ? 1 : 0] = { x: -s.x, y: s.y, aim: -s.aim };
    return { ...l, stacks };
  };
  return {
    layout,
    moveStack: (i, p) =>
      update((l) =>
        withStack(l, i, stackInRoom({ ...l.stacks[i], x: p.x, y: p.y }, l.room, footprint)),
      ),
    aimStack: (i, p) =>
      update((l) => {
        const s = l.stacks[i],
          deg = (Math.atan2(p.x - s.x, p.y - s.y) * 180) / Math.PI;
        const aim = Math.round(Math.max(-MAX_AIM_DEG, Math.min(MAX_AIM_DEG, deg)));
        // a box turned against a wall would reach through it, so it moves back just enough
        return withStack(l, i, stackInRoom({ ...s, aim }, l.room, footprint));
      }),
    moveCluster: (p) =>
      update((l) => ({ ...l, cluster: inRoom(p, l.room, clusterReach(footprint, l.subs)) })),
    moveListener: (p) => update((l) => ({ ...l, listener: inRoom(p, l.room, LISTENER_REACH) })),
    setRoomSize: (size) => update((l) => fitted({ ...l, room: { ...l.room, ...size } }, footprint)),
    setMaterial: (surface, material) =>
      update((l) => ({
        ...l,
        room: { ...l.room, materials: { ...l.room.materials, [surface]: material } },
      })),
    setCeilingFt: (ceilingFt) => update((l) => ({ ...l, room: { ...l.room, ceilingFt } })),
    setCrowd: (crowd) => update((l) => ({ ...l, room: { ...l.room, crowd } })),
    setOutdoors: (outdoors) => update((l) => ({ ...l, room: { ...l.room, outdoors } })),
    setBand: (band) => update((l) => ({ ...l, band })),
    setFreqHz: (freqHz) => update((l) => ({ ...l, freqHz })),
    setTargetDb: (targetDb) => update((l) => ({ ...l, targetDb })),
    setLevelRef: (levelRef) => update((l) => ({ ...l, levelRef })),
    // a pair is twice as wide as one sub, so the cluster may have to come off a wall
    setSubs: (subs) => update((l) => fitted({ ...l, subs }, footprint)),
    setMirror: (mirror) =>
      update((l) => {
        const m = { ...l, mirror };
        return mirror ? withStack(m, 0, l.stacks[0]) : m;
      }),
    setEarFt: (earFt) => update((l) => ({ ...l, earFt })),
    reset: () => setLayout(DEFAULT_COVERAGE_LAYOUT),
  };
}
