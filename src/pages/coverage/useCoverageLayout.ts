import { useStoredStateFrom } from "../../hooks/useStoredState";
import type {
  CoverageBand,
  CoverageLayout,
  CoverageLevelMode,
  CoverageRoom,
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
  levelMode: "listener",
  earFt: 5.3,
  listener: { x: 3, y: 24 },
  subDelay: "auto",
};

/** Room size limits, ft. */
export const ROOM_WIDTH_FT: [number, number] = [16, 80];
export const ROOM_LENGTH_FT: [number, number] = [16, 100];
export const ROOM_CEILING_FT: [number, number] = [8, 40];
/** How far the sub delay set by hand goes either way, ms: a period at 100 Hz. */
export const SUB_DELAY_MAX_MS = 10;
/** How far the stacks may turn either way, degrees. */
const MAX_AIM_DEG = 60;

/** Snaps to a quarter foot. */
const snap = (v: number) => Math.round(v * 4) / 4;

/** Keeps a point inside the room, `margin` ft from every side. */
const inRoom = <P extends FloorPoint>(
  p: P,
  room: Pick<CoverageRoom, "widthFt" | "lengthFt">,
  margin: number,
): P => ({
  ...p,
  x: Math.max(-room.widthFt / 2 + margin, Math.min(room.widthFt / 2 - margin, snap(p.x))),
  y: Math.max(margin, Math.min(room.lengthFt - margin, snap(p.y))),
});

/** Everything placed back inside the room after it changes size. */
const fitted = (l: CoverageLayout): CoverageLayout => ({
  ...l,
  stacks: [inRoom(l.stacks[0], l.room, 1), inRoom(l.stacks[1], l.room, 1)],
  cluster: inRoom(l.cluster, l.room, 2),
  listener: inRoom(l.listener, l.room, 0.5),
});

/**
 * A layout as stored: any saved field over the defaults. Layouts saved before materials had a wall on or off per side
 * (`walls`) and one `absorption` for them all.
 */
export type StoredCoverageLayout = Partial<Omit<CoverageLayout, "room">> & {
  room?: Partial<CoverageRoom> & {
    walls?: Partial<Record<RoomSide, boolean>>;
    absorption?: number;
  };
};

/** A stored layout over the defaults, so a layout saved before a field existed still loads. */
export const fromStored = (s: StoredCoverageLayout): CoverageLayout => {
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
  setLevelMode: (mode: CoverageLevelMode) => void;
  setSubs: (subs: SubPlacement) => void;
  setMirror: (mirror: boolean) => void;
  setEarFt: (ft: number) => void;
  setSubDelay: (delay: CoverageLayout["subDelay"]) => void;
  reset: () => void;
}

/** The floor layout, remembered per viewer: it belongs to the venue, not to the design, so it isn't saved with configs. */
export function useCoverageLayout(): CoverageLayoutState {
  const [layout, setLayout] = useStoredStateFrom<CoverageLayout, StoredCoverageLayout>(
    "coverage.layout",
    {},
    fromStored,
  );
  const update = (fn: (l: CoverageLayout) => CoverageLayout) => setLayout((l) => fn(l));
  const withStack = (l: CoverageLayout, i: 0 | 1, s: CoverageLayout["stacks"][0]) => {
    const stacks: CoverageLayout["stacks"] = [...l.stacks];
    stacks[i] = s;
    if (l.mirror) stacks[i === 0 ? 1 : 0] = { x: -s.x, y: s.y, aim: -s.aim };
    return { ...l, stacks };
  };
  return {
    layout,
    moveStack: (i, p) =>
      update((l) => withStack(l, i, inRoom({ ...l.stacks[i], x: p.x, y: p.y }, l.room, 1))),
    aimStack: (i, p) =>
      update((l) => {
        const s = l.stacks[i],
          deg = (Math.atan2(p.x - s.x, p.y - s.y) * 180) / Math.PI;
        return withStack(l, i, {
          ...s,
          aim: Math.round(Math.max(-MAX_AIM_DEG, Math.min(MAX_AIM_DEG, deg))),
        });
      }),
    moveCluster: (p) => update((l) => ({ ...l, cluster: inRoom(p, l.room, 2) })),
    moveListener: (p) => update((l) => ({ ...l, listener: inRoom(p, l.room, 0.5) })),
    setRoomSize: (size) => update((l) => fitted({ ...l, room: { ...l.room, ...size } })),
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
    setLevelMode: (levelMode) => update((l) => ({ ...l, levelMode })),
    setSubs: (subs) => update((l) => ({ ...l, subs })),
    setMirror: (mirror) =>
      update((l) => {
        const m = { ...l, mirror };
        return mirror ? withStack(m, 0, l.stacks[0]) : m;
      }),
    setEarFt: (earFt) => update((l) => ({ ...l, earFt })),
    setSubDelay: (subDelay) => update((l) => ({ ...l, subDelay })),
    reset: () => setLayout(DEFAULT_COVERAGE_LAYOUT),
  };
}
