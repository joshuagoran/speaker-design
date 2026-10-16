// A chamber's drawn (folded) horn: its fold traced (lib/speaker/foldTrace) in the chamber's clear room, and the trace
// turned into what the sound model reads (lib/speaker/hornDesign `TracedHornModel`). Pure. Each fold keeps its last
// trace, so the many reads of one view trace it once.
import type {
  HornDrive,
  HornFold,
  FoldTrace,
  HornSegment,
  SpeakerCabinet,
  SpeakerChamber,
  SpeakerDriver,
} from "../../types";
import { foldTrace, type FoldDriverShape } from "./foldTrace";
import type { TracedHornModel } from "./hornDesign";
import { chamberClearFace, clearDepthIn } from "./chamberAir";
import { coneShapeOf } from "./speakerBuild";
import { CHAMBER_LOAD, FOLD_WALL, HORN_DRIVE, HORN_PATH } from "../../constants/speakerSpec";
import { HORN_PROFILE } from "../../constants/hornEngine";
import { CM_PER_IN, CM2_PER_IN2 } from "../../constants/units";

/** The longest section the sound model gets from a trace, in: shorter where a tap falls. */
const SECTION_IN = 2;
/** The least area a traced section gets, in²: the closed end's last cells can read narrower. */
const MIN_AREA_IN2 = 1;

/** A chamber's drawn horn: its trace (`FoldTrace`) and what the sound model reads of it. */
export interface TracedHorn extends TracedHornModel {
  trace: ReturnType<typeof foldTrace>;
}

/** The trace's room: the chamber's clear depth and face, the boards' thickness, and the drivers' shape. */
type TraceRoom = Omit<Parameters<typeof foldTrace>[0], "fold">;

/** Each fold's last room (as a key) and trace. */
const traced = new WeakMap<HornFold, { key: string; value: TracedHorn }>();

/**
 * The drivers as the trace draws them: the first cone driver's cutout, motor and depth, and every cone driver's count;
 * null without a cone driver.
 */
export function foldDriverShape(drivers: readonly SpeakerDriver[]): FoldDriverShape | null {
  const cones = drivers.flatMap((d) => {
    const shape = coneShapeOf(d);
    return shape ? [{ shape, count: d.count }] : [];
  });
  if (!cones.length) return null;
  return { ...cones[0].shape, count: cones.reduce((sum, c) => sum + c.count, 0) };
}

/** The chamber's room for its fold: clear depth and height, clear width, the boards' (walls') thickness, the drivers. */
export function foldRoom(
  cabinet: Pick<SpeakerCabinet, "chambers" | "panel" | "construction" | "insetIn">,
  chamber: SpeakerChamber,
): TraceRoom {
  const face = chamberClearFace(cabinet, chamber);
  return {
    depthIn: clearDepthIn(cabinet, chamber.dims),
    heightIn: face.h,
    widthIn: face.w,
    boardIn: cabinet.panel.thicknessIn,
    driver: foldDriverShape(chamber.drivers),
  };
}

/** The fold a folded horn starts from: no boards, no drivers, the mouth on the top quarter of the baffle. */
export const startFold = (heightIn: number): HornFold => ({
  boards: [],
  drivers: null,
  mouth: { wall: FOLD_WALL.baffle, fromIn: heightIn * 0.75, toIn: heightIn },
});

/** A chamber's folded horn as the views draw it: the fold, its drivers' rows, and the room it is drawn in. */
export interface FoldDrawing {
  /** the user's fold, or the default start (`startFold`) before one is drawn */
  fold: HornFold;
  /** the drivers' rows (`FoldTrace.parts`); empty before a fold is drawn */
  parts: FoldTrace["parts"];
  room: TraceRoom;
}

/** The chamber's folded horn as the views draw it; null when its horn is not folded. */
export function foldDrawing(
  cabinet: Pick<SpeakerCabinet, "chambers" | "panel" | "construction" | "insetIn">,
  chamber: SpeakerChamber,
): FoldDrawing | null {
  const horn = chamber.load.kind === CHAMBER_LOAD.horn ? chamber.load.horn : null;
  if (!horn || horn.path !== HORN_PATH.folded) return null;
  const room = foldRoom(cabinet, chamber);
  return {
    fold: horn.fold ?? startFold(room.heightIn),
    parts: tracedHorn(cabinet, chamber)?.trace.parts ?? [],
    room,
  };
}

/** The chamber's drawn horn, traced; null when its horn is not folded or not drawn. */
export function tracedHorn(
  cabinet: Pick<SpeakerCabinet, "chambers" | "panel" | "construction" | "insetIn">,
  chamber: SpeakerChamber,
): TracedHorn | null {
  const horn = chamber.load.kind === CHAMBER_LOAD.horn ? chamber.load.horn : null;
  if (!horn?.fold || horn.path !== HORN_PATH.folded) return null;
  const room = foldRoom(cabinet, chamber);
  const key = JSON.stringify(room);
  const kept = traced.get(horn.fold);
  if (kept?.key === key) return kept.value;
  const trace = foldTrace({ ...room, fold: horn.fold });
  const value: TracedHorn = { trace, ...traceModel(trace) };
  traced.set(horn.fold, { key, value });
  return value;
}

/**
 * What the sound model reads of a trace: conical sections at most `SECTION_IN` long, with a boundary at each tap, and
 * the drive on those boundaries; the sealed air the cones' other side opens into. A tapped or offset horn starts at the
 * closed end; a front-loaded one starts at the cones (the stub behind them is part of the cones' air). No drive when
 * the trace finds no horn.
 */
export function traceModel(trace: ReturnType<typeof foldTrace>): TracedHornModel {
  const { hornType, taps, sections, pathIn, sealed } = trace;
  const none: TracedHornModel = { segments: [], drive: null, rearLiters: null };
  if (!hornType || !sections.length || !(pathIn > 0)) return none;
  const opened = [taps.front, taps.back]
    .filter((t): t is number => t !== null)
    .sort((p, q) => p - q);
  if (!opened.length) return none;
  const start = hornType === HORN_DRIVE.front ? opened[0] : 0;
  const marks = hornType === HORN_DRIVE.front ? [] : opened.filter((t) => t > 0 && t < pathIn);
  const cuts = sectionCuts(start, pathIn, marks);
  if (cuts.length < 2) return none;
  const areaAt = (s: number) => Math.max(MIN_AREA_IN2, interpolate(sections, s)) * CM2_PER_IN2;
  const segments: HornSegment[] = cuts.slice(1).map((s, i) => ({
    profile: HORN_PROFILE.conical,
    s1: areaAt(cuts[i]),
    s2: areaAt(s),
    length: (s - cuts[i]) * CM_PER_IN,
  }));
  /** the boundary index of a tap */
  const at = (t: number) => cuts.indexOf(t);
  const drive: HornDrive | null =
    hornType === HORN_DRIVE.tapped && marks.length === 2
      ? { kind: HORN_DRIVE.tapped, frontTap: at(marks[0]), rearTap: at(marks[1]) }
      : hornType === HORN_DRIVE.offset && marks.length >= 1
        ? { kind: HORN_DRIVE.offset, tap: at(marks[0]) }
        : hornType === HORN_DRIVE.front
          ? { kind: HORN_DRIVE.front }
          : null;
  if (!drive) return none;
  /** the sealed air the cones' closed side opens into: a front-loaded or offset horn's rear chamber */
  const rear =
    hornType === HORN_DRIVE.tapped
      ? undefined
      : sealed.find((p) => (taps.front === null ? p.opensToFront : p.opensToBack));
  return { segments, drive, rearLiters: rear ? rear.liters : null };
}

/** The section boundaries from `start` to `end`, in: every tap in `marks`, and no section longer than `SECTION_IN`. */
function sectionCuts(start: number, end: number, marks: readonly number[]): number[] {
  const stops = [start, ...marks.filter((m) => m > start && m < end), end];
  return stops.flatMap((s, i) => {
    if (i === stops.length - 1) return [s];
    const n = Math.max(1, Math.ceil((stops[i + 1] - s) / SECTION_IN));
    return Array.from({ length: n }, (_, k) => s + ((stops[i + 1] - s) * k) / n);
  });
}

/** The traced area at `s` in from the closed end, in², between the two nearest sections. */
function interpolate(sections: ReturnType<typeof foldTrace>["sections"], s: number): number {
  const after = sections.findIndex((q) => q.sIn >= s);
  if (after <= 0) return sections[after === 0 ? 0 : sections.length - 1].areaIn2;
  const p = sections[after - 1];
  const q = sections[after];
  const k = (s - p.sIn) / (q.sIn - p.sIn || 1);
  return p.areaIn2 + (q.areaIn2 - p.areaIn2) * k;
}
