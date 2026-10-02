import { useStoredStateFrom } from "../../hooks/useStoredState";
import type {
  CoverageBand,
  CoverageLayout,
  CoverageLevelMode,
  CoverageRoom,
  FloorPoint,
  RoomSide,
  SubPlacement,
} from "../../types";

/** A dance floor about 1500 sq ft, walls all round, the stacks a few feet off the front wall, toed in a little. */
export const DEFAULT_COVERAGE_LAYOUT: CoverageLayout = {
  room: {
    widthFt: 34,
    lengthFt: 44,
    walls: { front: true, back: true, left: true, right: true },
    absorption: 0.3,
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
};

/** Room size limits, ft. */
export const ROOM_WIDTH_FT: [number, number] = [16, 80];
export const ROOM_LENGTH_FT: [number, number] = [16, 100];
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

/** A stored layout over the defaults, so a layout saved before a field existed still loads. */
const fromStored = (s: Partial<CoverageLayout>): CoverageLayout => ({
  ...DEFAULT_COVERAGE_LAYOUT,
  ...s,
  room: {
    ...DEFAULT_COVERAGE_LAYOUT.room,
    ...s.room,
    walls: { ...DEFAULT_COVERAGE_LAYOUT.room.walls, ...s.room?.walls },
  },
});

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
  toggleWall: (side: RoomSide) => void;
  setAbsorption: (a: number) => void;
  setOutdoors: (outdoors: boolean) => void;
  setBand: (band: CoverageBand) => void;
  setFreqHz: (f: number) => void;
  setLevelMode: (mode: CoverageLevelMode) => void;
  setSubs: (subs: SubPlacement) => void;
  setMirror: (mirror: boolean) => void;
  setEarFt: (ft: number) => void;
  reset: () => void;
}

/** The floor layout, remembered per viewer: it belongs to the venue, not to the design, so it isn't saved with configs. */
export function useCoverageLayout(): CoverageLayoutState {
  const [layout, setLayout] = useStoredStateFrom<CoverageLayout, Partial<CoverageLayout>>(
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
    toggleWall: (side) =>
      update((l) => ({
        ...l,
        room: { ...l.room, walls: { ...l.room.walls, [side]: !l.room.walls[side] } },
      })),
    setAbsorption: (absorption) => update((l) => ({ ...l, room: { ...l.room, absorption } })),
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
    reset: () => setLayout(DEFAULT_COVERAGE_LAYOUT),
  };
}
