import { clamp } from "../../lib/clamp";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useConfigStore } from "../../components/saved-configs/useConfigStore";
import {
  audienceAverage,
  bandCenterHz,
  bandRangeHz,
  coverageStats,
  COVERAGE_BANDS,
  COVERAGE_GRID_COLS,
  QUICK_GRID_COLS,
  SINGLE_FREQ_RANGE,
} from "../../lib/acoustics/coverage";
import {
  meterSpotsOf,
  playsInBand,
  spaceCrossoversHz,
  spaceTargetAt,
  type BandRange,
  type MeterSpot,
} from "../../lib/speaker/spaceBalance";
import { COVERAGE_LEVEL_REF } from "../../constants/coverageLevel";
import { keysOf } from "../../lib/records";
import {
  bandOfPart,
  spaceGridRequest,
  spaceLevelAt,
  spaceModelLaidOut,
  spaceResponse,
  type SpaceGridRequest,
  type SpaceModel,
} from "../../lib/speaker/spaceCoverage";
import { aimedPlacement, movedPlacement, spaceLayout } from "../../lib/speaker/spaceLayout";
import {
  roomWalls,
  snapFlush,
  type RoomWall,
  type SnapStages,
  type StandingItem,
} from "../../lib/speaker/spaceCoupling";
import {
  movedPlan,
  planCenter,
  stageAt,
  stagesOn,
  straightEdges,
} from "../../lib/speaker/spaceStages";
import {
  freeSpot,
  keepsRules,
  spotPlans,
  withStageAdded,
  withStageBox,
  withStageDragged,
  withStageHeight,
  withStageRemoved,
  withStageShape,
  type StageBox,
} from "./stageEdits";
import { AIM_SNAP_DEG, MAP_DRAG_UPDATE_MS, SNAP_FLUSH_IN } from "../../constants/space";
import { withAmpPower } from "../../lib/speaker/spaceHardware";
import { runSpaceGrid, runSpaceQuickGrid, runSpaceReferenceGrid } from "../../lib/speaker/runSpace";
import {
  bandHeadrooms,
  leastHeadroom,
  mainGains,
  systemGainFor,
  type BandHeadroom,
  type BandLevels,
  type LevelBand,
} from "../../lib/speaker/spaceGains";
import { useHeld, useThrottled } from "../../hooks/useThrottled";
import { presetLayers } from "../stack/stackPresets";
import {
  EMPTY_START,
  STACK_START_DESIGN_NAMES,
  type DesignStart,
} from "../../constants/stackPresets";
import { spacePlacement } from "../../lib/speaker/specParts";
import {
  listenerArrivals,
  placementRequest,
  solveFeeds,
  type DelayNote,
  type SolvedFeed,
} from "../../lib/speaker/solveFeeds";
import { withSpeaker } from "../stack/useStack";
import type { RoomActions } from "../../components/ui/RoomFields";
import { SPACES_COLLECTION, SPACE_ITEM } from "../../constants/speakerSpec";
import type { PlaceItem } from "./placeOptions";
import {
  DRAFT_SPACE_ID,
  emptySpace,
  spaceDraft,
  spaceFromSaved,
  spaceSnapshot,
} from "./spaceSaves";
import { usePageDraft, type SharedMode } from "../../hooks/usePageDraft";
import {
  dragChanged,
  jobSettled,
  queueJob,
  takeJob,
  type JobLane,
  type JobLanes,
} from "./gridLanes";
import type {
  BandId,
  CoverageBand,
  CoverageGrid,
  CoverageGridView,
  CoverageLevelRef,
  FloorPoint,
  SpaceStage,
  StageShape,
  PlacedSource,
  SavedConfig,
  SpaceDesign,
  SpacePlacement,
  SpaceSpec,
  SpaceVenue,
  SpeakerSpec,
  StackDesign,
  StackSpec,
} from "../../types";
import { roundDelayMs } from "../../lib/format";

/** The band the Listener readout is in: the lowest, whatever band is on show. */
const LEVEL_BAND = "sub" satisfies CoverageBand;

/** The bands the reference is read in, from the lowest. */
const LEVEL_BANDS = keysOf(COVERAGE_BANDS);

/** Where a new placement stands: a little off the front wall, in the middle, ft. */
const NEW_SPOT: FloorPoint = { x: 0, y: 3 };

/** The room's floor: its width and length, ft. */
type RoomFloor = Pick<SpaceVenue["room"], "widthFt" | "lengthFt">;

/** Snaps to a quarter foot. */
const snap = (v: number) => Math.round(v * 4) / 4;

/** A point kept on the room's floor, ft. */
const inRoom = <P extends FloorPoint>(p: P, room: RoomFloor): P => ({
  ...p,
  x: clamp(p.x, -room.widthFt / 2, room.widthFt / 2),
  y: clamp(p.y, 0, room.lengthFt),
});

/** A point snapped to a quarter foot and kept on the room's floor, ft (a drag). */
const onFloor = (p: FloorPoint, room: RoomFloor): FloorPoint =>
  inRoom({ x: snap(p.x), y: snap(p.y) }, room);

/** A space kept inside its room (after the room changes size): each placement's spot on the floor and the listener. */
export function fittedSpace(space: SpaceSpec): SpaceSpec {
  const { room } = space.venue;
  return {
    ...space,
    placements: space.placements.map((p) => inRoom(p, room)),
    venue: {
      ...space.venue,
      listener: inRoom(space.venue.listener, room),
    },
  };
}

/** The box a map drag names, as the model places it (an index into its boxes): which placement it is and where it stands. */
export type DraggedBox = Pick<PlacedSource, "source" | "image" | "x" | "y">;

/**
 * What a drag snaps flush against (`snapFlush`): the boxes as they stand, the dragged one's index among them, the
 * room's walls, and the stages' edges at its level with the rules a spot keeps.
 */
export interface FlushSnap {
  items: readonly StandingItem[];
  at: number;
  walls: readonly RoomWall[];
  stages?: SnapStages;
}

/**
 * The placements after a map drag moved a box to `p`, snapped and kept on the floor: the box as set moves its placement
 * there; the mirror image of a pair moves it to the mirror image of the spot, so the other box follows as its mirror.
 * With `flush`, a box near a wall or another box snaps flush against it (`snapFlush`); without, it moves on the
 * quarter-foot grid.
 */
export function withBoxMoved(
  placements: readonly SpacePlacement[],
  box: DraggedBox,
  p: FloorPoint,
  room: RoomFloor,
  flush?: FlushSnap,
): SpacePlacement[] {
  const grid = onFloor(p, room);
  const to = flush
    ? inRoom(
        snapFlush(p, grid, flush.items, flush.at, flush.walls, SNAP_FLUSH_IN, flush.stages),
        room,
      )
    : grid;
  return placements.map((o, i) => (i === box.source ? movedPlacement(o, box.image, to) : o));
}

/**
 * The placements after a map drag turned a box to face `p` on the floor: the box as set turns its placement; the image
 * of a pair turns it the other way, so the other box follows as its mirror.
 */
export function withBoxAimed(
  placements: readonly SpacePlacement[],
  box: DraggedBox,
  p: FloorPoint,
  stepDeg?: number,
): SpacePlacement[] {
  return placements.map((o, i) => (i === box.source ? aimedPlacement(o, box, p, stepDeg) : o));
}

/**
 * The design with its placements changed by `edit`, or the design as it was when the change breaks a rule the space
 * kept (`keepsRules`). The boxes are laid out again after the change, so a turned box is checked at its new aim. A
 * change that adds or drops a mirror image changes which plan is whose: it is not checked.
 */
export function withPlacementsRuled(
  d: SpaceDesign,
  edit: (list: readonly SpacePlacement[]) => SpacePlacement[],
): SpaceDesign {
  const before = d.space.placements;
  const placements = edit(before);
  const next = { ...d, space: { ...d.space, placements } };
  const sameImages =
    placements.length === before.length &&
    placements.every((p, i) => p.mirrored === before[i]?.mirrored);
  if (!sameImages) return next;
  // only the boxes' plans are read: no driver feeds a band
  const plansOf = (design: SpaceDesign) => spotPlans(spaceLayout(design, () => null));
  return keepsRules(d.space, next.space, plansOf(d), plansOf(next)) ? next : d;
}

/**
 * A copy of a library stack for a space: its speakers as the space's own copies (`withSpeaker`), and the stack under a
 * new id and a numbered name where the space holds another stack by its id.
 */
export function withStack(
  design: Pick<SpaceDesign, "stacks" | "speakers">,
  saved: StackDesign,
): Pick<SpaceDesign, "stacks" | "speakers"> & { stack: StackSpec } {
  let speakers = [...design.speakers];
  const ids = new Map<string, string>();
  for (const s of saved.speakers) {
    const copy = withSpeaker(speakers, s);
    ids.set(s.id, copy.id);
    if (!speakers.some((o) => o.id === copy.id)) speakers = [...speakers, copy];
  }
  const members = saved.stack.members.map((m) => ({
    ...m,
    speakerId: ids.get(m.speakerId) ?? m.speakerId,
  }));
  const stack0 = { ...saved.stack, members };
  const held = design.stacks.find((s) => s.id === stack0.id);
  let stack = stack0;
  if (held && JSON.stringify(held) !== JSON.stringify(stack0)) {
    let n = 2;
    while (design.stacks.some((s) => s.id === `${stack0.id}/${n}`)) n++;
    stack = { ...stack0, id: `${stack0.id}/${n}`, name: `${stack0.name} (copy ${n})` };
  }
  const stacks = held && stack === stack0 ? design.stacks : [...design.stacks, stack];
  return { stack, stacks, speakers };
}

/**
 * A new space from a start: the empty space, or a preset read in as a space (a PA layout on the PA floor's starting
 * layout, or the Hi-fi pair in its room). A PA preset's bands start at their calculated Gains. Its id is the draft
 * id: no save.
 */
export function spaceFromStart(start: DesignStart): SpaceDesign {
  if (start === EMPTY_START) return emptySpace();
  const read = presetLayers(start, { id: DRAFT_SPACE_ID, name: STACK_START_DESIGN_NAMES[start] });
  return { space: read.space, stacks: [read.stack], speakers: read.speakers };
}

/**
 * One grid for the worker: the request and its columns (`quick`: a drag's quick pass), the frequency its band's target
 * is read at (Hz), and the boxes' spots it was asked for (the audience average and the stats leave the floor in front
 * of them out, whatever the boxes are by then). `seq` orders the jobs as they were asked for.
 */
interface GridJob {
  req: Omit<SpaceGridRequest, "cols">;
  cols: number;
  quick: boolean;
  seq: number;
  centerHz: number;
  spots: readonly FloorPoint[];
}

/** A lane of grid jobs, with its worker and what stops the job under way. */
type GridLane = JobLane<GridJob> & { run: typeof runSpaceGrid; stop: AbortController };

/**
 * The mean of a request's levels at the 1 m spots of the placements that play in the band, dB, skipping levels that
 * aren't finite; where no placement plays in the band, of all the spots. Null when none is (no spots, or nothing
 * reaches them).
 */
function oneMeterAverage(
  req: Omit<SpaceGridRequest, "cols">,
  spots: readonly MeterSpot[],
  band: BandRange,
) {
  const playing = spots.filter((s) => playsInBand(s.passbands, band));
  const levels = (playing.length ? playing : spots)
    .map((s) => spaceLevelAt(req, s.at))
    .filter(Number.isFinite);
  return levels.length ? levels.reduce((a, b) => a + b, 0) / levels.length : null;
}

/** Where a level reference reads: the listener, the spots 1 m in front of the placements, and the boxes' spots. */
interface ReferenceSpots {
  listener: FloorPoint;
  meterSpots: readonly MeterSpot[];
  /** the boxes' spots: the audience average leaves the floor right in front of them out */
  boxes: readonly FloorPoint[];
}

/**
 * A request's level at the limit at the reference, dB: the audience average over the grid's floor (needs `grid`; null
 * without it), the level at the listener, or the mean of the 1 m spots of the placements that play in `band`. Null
 * when nothing reaches it.
 */
export function referenceAtLimit(
  levelRef: CoverageLevelRef,
  req: Omit<SpaceGridRequest, "cols">,
  spots: ReferenceSpots,
  grid: CoverageGrid | null,
  band: BandRange,
): number | null {
  if (levelRef === COVERAGE_LEVEL_REF.listener) return spaceLevelAt(req, spots.listener);
  if (levelRef === COVERAGE_LEVEL_REF.stacks) return oneMeterAverage(req, spots.meterSpots, band);
  return grid ? audienceAverage(grid, req.room, spots.boxes) : null;
}

/** A value rounded to a tenth, as a field shows it. */
const tenth = (v: number) => Math.round(v * 10) / 10;

/** The space with each placement's delay and level set by `edit` from what the solver works out for it. */
function withSolvedFeeds(
  d: SpaceDesign,
  edit: (p: SpacePlacement, solved: SolvedFeed) => SpacePlacement,
): { design: SpaceDesign; solved: SolvedFeed[] } {
  const solved = solveFeeds(spaceModelLaidOut(d), d.space.venue);
  const placements = d.space.placements.map((p, k) => {
    const feed = solved[k];
    return feed ? edit(p, feed) : p;
  });
  return { design: { ...d, space: { ...d.space, placements } }, solved };
}

/**
 * Calculate delays: each placement's Delay as the solver sets it (the mains together at the listener, each fill after
 * its nearest main), and the solver's note on each (by placement).
 */
export function withCalculatedDelays(d: SpaceDesign): {
  design: SpaceDesign;
  notes: (DelayNote | null)[];
} {
  const { design, solved } = withSolvedFeeds(d, (p, s) => ({
    ...p,
    delayMs: roundDelayMs(s.delayMs),
  }));
  return { design, notes: solved.map((s) => s.delayNote) };
}

/** Each band's target at the reference, dB: the Target level, under the band balance above each crossover. */
export function bandTargets(d: SpaceDesign): Record<LevelBand, number> {
  const { venue } = d.space;
  const crossovers = spaceCrossoversHz(d);
  const at = (b: LevelBand) =>
    spaceTargetAt(venue.targetDb, bandCenterHz(b, SINGLE_FREQ_RANGE[0]), crossovers, venue.balance);
  return { sub: at("sub"), kick: at("kick"), mid: at("mid"), high: at("high") };
}

/** The reference's request in band `b`: the whole space, or placement `source` alone. */
function bandRequest(
  d: SpaceDesign,
  model: SpaceModel,
  b: LevelBand,
  source: number | null,
): Omit<SpaceGridRequest, "cols"> {
  const { room, earFt } = d.space.venue;
  const req = spaceGridRequest(model, { room, earFt }, b, SINGLE_FREQ_RANGE[0], COVERAGE_GRID_COLS);
  return source === null ? req : placementRequest(model, req, source);
}

/** The boxes' spots in a model: the audience average leaves the floor right in front of them out. */
const boxSpots = (model: SpaceModel): FloorPoint[] =>
  model.placements.map((p) => ({ x: p.item.placement.x, y: p.item.placement.y }));

/** Levels kept where something reaches the reference. */
function reached(levels: readonly (readonly [LevelBand, number | null])[]): BandLevels {
  const out: BandLevels = {};
  for (const [b, db] of levels) if (db !== null && Number.isFinite(db)) out[b] = db;
  return out;
}

/**
 * Each band's level at the listener or 1 m from the speakers at System gain 0, dB: of the whole space, or of placement
 * `source` alone (null: the whole space). Null for the audience average: it needs grids (`referenceLevels`).
 */
export function referenceLevelsNow(
  d: SpaceDesign,
  model: SpaceModel,
  source: number | null = null,
): BandLevels | null {
  const { venue } = d.space;
  if (venue.levelRef === COVERAGE_LEVEL_REF.audience) return null;
  if (!model.scene.sources.length) return {};
  const spots: ReferenceSpots = {
    listener: venue.listener,
    meterSpots: meterSpotsOf(d, model, venue.room),
    boxes: boxSpots(model),
  };
  return reached(
    LEVEL_BANDS.map((b) => [
      b,
      referenceAtLimit(
        venue.levelRef,
        bandRequest(d, model, b, source),
        spots,
        null,
        bandRangeHz(b, SINGLE_FREQ_RANGE[0]),
      ),
    ]),
  );
}

/** Each band's level at the reference at System gain 0 (`referenceLevelsNow`); the audience average's grids on the worker. */
export async function referenceLevels(
  d: SpaceDesign,
  model: SpaceModel,
  source: number | null = null,
): Promise<BandLevels> {
  const now = referenceLevelsNow(d, model, source);
  if (now) return now;
  if (!model.scene.sources.length) return {};
  const { room } = d.space.venue;
  const levels: [LevelBand, number | null][] = [];
  // one grid at a time: the worker runs them in turn
  for (const b of LEVEL_BANDS) {
    const grid = await runSpaceReferenceGrid({
      ...bandRequest(d, model, b, source),
      cols: COVERAGE_GRID_COLS,
    });
    levels.push([b, audienceAverage(grid, room, boxSpots(model))]);
  }
  return reached(levels);
}

/** The space with its venue changed by `edit`. */
const withVenue = (d: SpaceDesign, edit: Partial<SpaceVenue>): SpaceDesign => ({
  ...d,
  space: { ...d.space, venue: { ...d.space.venue, ...edit } },
});

/** A band of a box by name, as the limit notes name it: the band's and the box's (its speaker's). */
export interface NamedBand {
  band: string;
  box: string;
}

/** A driver band's names (`NamedBand`); null when the model has no such band. */
export function bandNames(
  model: Pick<SpaceModel, "placements">,
  h: BandHeadroom,
): NamedBand | null {
  const speaker = model.placements[h.box]?.response?.members[h.member]?.speaker;
  const band = speaker?.bands.find((b) => b.id === h.band);
  return speaker && band ? { band: band.name, box: speaker.name } : null;
}

/** What Calculate gains reports when a limit holds System gain down: how far every band is under it, dB, and the band. */
export interface GainLimit {
  belowDb: number;
  limit: NamedBand | null;
}

/**
 * Calculate gains (lib/speaker/spaceGains): each main's Gain from its levels at the reference, then each fill's (the
 * nearest main's level where it aims), then System gain, so no driver band goes past its limit. It also gives the
 * limit that held System gain down; null when none did.
 */
export async function withCalculatedGains(
  d: SpaceDesign,
): Promise<{ design: SpaceDesign; limit: GainLimit | null }> {
  const start = withVenue(d, { systemDb: 0 });
  const model = spaceModelLaidOut(start);
  const { placements } = start.space;
  const heard = new Set(model.placements.map((p) => p.item.placement.source));
  const mains = placements.flatMap((p, k) => (!p.fill && heard.has(k) ? [k] : []));
  const levels: BandLevels[] = [];
  for (const k of mains) levels.push(await referenceLevels(start, model, k));
  const gains = mainGains(
    mains.map((k, i) => ({ gainDb: placements[k]?.levelDb ?? 0, levels: levels[i] ?? {} })),
    bandTargets(start),
  );
  const gained: SpaceDesign = {
    ...start,
    space: {
      ...start.space,
      placements: placements.map((p, k) => {
        const i = mains.indexOf(k);
        return i < 0 ? p : { ...p, levelDb: tenth(gains[i] ?? p.levelDb) };
      }),
    },
  };
  const { design: filled } = withSolvedFeeds(gained, (p, s) =>
    p.fill ? { ...p, levelDb: tenth(s.levelDb) } : p,
  );
  const filledModel = spaceModelLaidOut(filled);
  const bands = bandHeadrooms(filledModel);
  const systemDb = tenth(systemGainFor(bands));
  const least = leastHeadroom(bands);
  return {
    design: withVenue(filled, { systemDb }),
    limit:
      systemDb < 0 && least ? { belowDb: -systemDb, limit: bandNames(filledModel, least) } : null,
  };
}

/** The space with an item placed at the first free spot from the new spot (`freeSpot`). */
function withPlaced(d: SpaceDesign, item: SpacePlacement["item"]): SpaceDesign {
  const added = spacePlacement(NEW_SPOT, item, 0);
  const at = (spot: FloorPoint): SpaceDesign => ({
    ...d,
    space: { ...d.space, placements: [...d.space.placements, { ...added, ...spot }] },
  });
  const placed = at(NEW_SPOT);
  // only the boxes' plans are read: no driver feeds a band
  const plans = spotPlans(spaceLayout(placed, () => null));
  return at(freeSpot(placed.space, d.space.placements.length, plans, NEW_SPOT));
}

/** The space with a stack placed: its copy in the space (`withStack`), at the new spot. */
export function withStackPlaced(d: SpaceDesign, saved: StackDesign): SpaceDesign {
  const copy = withStack(d, saved);
  return withPlaced(
    { ...d, stacks: copy.stacks, speakers: copy.speakers },
    { kind: SPACE_ITEM.stack, id: copy.stack.id },
  );
}

/** The space with a speaker placed alone: its copy in the space (`withSpeaker`), at the new spot. */
export function withSpeakerPlaced(d: SpaceDesign, speaker: SpeakerSpec): SpaceDesign {
  const copy = withSpeaker(d.speakers, speaker);
  const held = d.speakers.some((s) => s.id === copy.id);
  return withPlaced(
    { ...d, speakers: held ? d.speakers : [...d.speakers, copy] },
    { kind: SPACE_ITEM.speaker, id: copy.id },
  );
}

/** The space with a Place choice's item placed (a stack with its speakers, or a speaker alone). */
export const withItemPlaced = (d: SpaceDesign, item: PlaceItem): SpaceDesign =>
  item.kind === SPACE_ITEM.stack
    ? withStackPlaced(d, item.design)
    : withSpeakerPlaced(d, item.speaker);

/**
 * The Space page's state: the space and the stacks and speakers it places, its model and floor map, the edits the
 * settings make and the library (the signed-in user's `spaces`). Held in App, so the space survives switching pages.
 */
export function useSpace(initialBand: CoverageBand = "mid") {
  const [design, setDesign, sharedDraft] = usePageDraft(spaceDraft);
  const [band, setBand] = useState<CoverageBand>(initialBand);
  const [freqHz, setFreqHz] = useState(63);
  /** how many times the design was replaced whole (a start, a clear, an opened save): a page's picks into it end then */
  const [replaced, setReplaced] = useState(0);
  /** whether a dragged box snaps flush against a wall or another box */
  const [snapsFlush, setSnapsFlush] = useState(true);
  /**
   * whether a box, its aim, or a stage is being dragged on the map: the model then follows the drag
   * at most every MAP_DRAG_UPDATE_MS, the map takes quick passes, and the 3D view, the band levels and the response at
   * the listener wait for the drag's end
   */
  const [dragging, setDragging] = useState(false);
  const { space } = design;
  const { venue } = space;
  /** the space the model reads: during a drag, a step behind it */
  const modelSpace = useThrottled(space, dragging, MAP_DRAG_UPDATE_MS);
  // the model reads the placements, the stages, the room, the stacks and the speakers, a step behind the typing
  const placements = useDeferredValue(modelSpace.placements);
  const stages = useDeferredValue(modelSpace.venue.stages);
  const room = useDeferredValue(venue.room);
  const stacks = useDeferredValue(design.stacks);
  const speakers = useDeferredValue(design.speakers);
  /** the boxes as the design places them now, which the map draws: a drag's box follows the pointer */
  const items = useMemo(
    () => spaceLayout(design, bandOfPart),
    // the layout reads only these
    [design.space.placements, design.space.venue.stages, design.stacks, design.speakers],
  );
  /** the model at the delays and levels as set */
  const model = useMemo(
    () =>
      spaceModelLaidOut({
        space: { ...space, placements, venue: { ...venue, room, stages } },
        stacks,
        speakers,
      }),
    // the model reads only these (the name, the listener and the target don't move it)
    [placements, stages, room, venue.systemDb, stacks, speakers],
  );
  /** each placement's arrival at the listener against the latest main */
  const arrivals = useMemo(
    () => listenerArrivals(model, venue.listener, venue.earFt),
    [model, venue.listener, venue.earFt],
  );
  /** the map's columns: fewer during a drag (its quick pass) */
  const cols = dragging ? QUICK_GRID_COLS : COVERAGE_GRID_COLS;
  const req = useMemo<Omit<SpaceGridRequest, "cols">>(
    () => spaceGridRequest(model, { room, earFt: venue.earFt }, band, freqHz, cols, dragging),
    [model, room, venue.earFt, band, freqHz, cols, dragging],
  );
  /** the space in the lowest band: what the Listener readout reads, whatever band is on show (no frequency is read) */
  const levelBandReq = useMemo<Omit<SpaceGridRequest, "cols">>(
    () =>
      spaceGridRequest(
        model,
        { room, earFt: venue.earFt },
        LEVEL_BAND,
        SINGLE_FREQ_RANGE[0],
        cols,
        dragging,
      ),
    [model, room, venue.earFt, cols, dragging],
  );
  /** the model the band levels, the response and the 3D view read: during a drag, the one from before it */
  const settledModel = useHeld(model, dragging);
  const settledStages = useHeld(stages, dragging);
  /** what each box stands right against: the floor, the walls and the other boxes, with the map's marks */
  const { coupling } = model;
  /** the boxes' spots: the stats leave the floor right in front of them out */
  const spots = useMemo(
    () => model.placements.map((p) => ({ x: p.item.placement.x, y: p.item.placement.y })),
    [model],
  );

  // two worker lanes, full passes and a drag's quick ones (./gridLanes). Each job carries the frequency its band's target
  // is read at, so a grid on show keeps its own band's target
  const [shown, setShown] = useState<(GridJob & { grid: CoverageGrid }) | null>(null);
  const [failed, setFailed] = useState<{ req: typeof req; message: string } | null>(null);
  const lanes = useRef<JobLanes<GridJob, GridLane>>({
    full: { run: runSpaceGrid, busy: false, want: null, stop: new AbortController() },
    quick: { run: runSpaceQuickGrid, busy: false, want: null, stop: new AbortController() },
    seq: 0,
    shownSeq: 0,
  });
  const pump = (lane: GridLane) => {
    const next = takeJob(lane);
    if (!next) return;
    const { signal } = lane.stop;
    lane
      .run({ ...next.req, cols: next.cols }, { signal })
      .then(
        (grid) => {
          if (!jobSettled(lanes.current, lane, next).show) return;
          setShown({ ...next, grid });
          setFailed(null);
        },
        (error: unknown) => {
          const end = jobSettled(lanes.current, lane, next, { error });
          if (!end.show && end.failure !== null) setFailed({ req: next.req, message: end.failure });
        },
      )
      .finally(() => pump(lane));
  };
  // a drag stops the full pass under way: the drag has made it old (its worker starts again for the next one). Its end
  // drops the quick pass that waits
  useEffect(() => {
    dragChanged(lanes.current, dragging);
    if (!dragging) return;
    const { full } = lanes.current;
    full.stop.abort();
    full.stop = new AbortController();
  }, [dragging]);
  const placed = model.scene.sources.length > 0;
  // where the target is measured, and the Band balance it follows across the bands (lib/speaker/spaceBalance)
  const { levelRef, balance } = venue;
  /**
   * whether the model reads the placements and stages from before the latest: just after a drag, the deferred ones are
   * a render behind the space at its end
   */
  const behind = placements !== modelSpace.placements || stages !== modelSpace.venue.stages;
  useEffect(() => {
    // a full pass waits for the latest space: none runs for the model from before a drag's end
    if (!placed || (!dragging && behind)) return;
    const lane = queueJob(
      lanes.current,
      (seq) => ({
        req,
        cols,
        quick: dragging,
        seq,
        centerHz: bandCenterHz(band, freqHz),
        spots,
      }),
      dragging,
    );
    pump(lane);
  }, [req, placed, behind]);

  const crossovers = useMemo(
    () => spaceCrossoversHz({ space: { ...space, placements }, stacks, speakers }),
    // the crossovers read only these
    [placements, stacks, speakers],
  );
  /** the target in the band on show: what the map is compared with */
  const target = spaceTargetAt(venue.targetDb, bandCenterHz(band, freqHz), crossovers, balance);
  /** the target in the lowest band: what the Listener readout is compared with, whatever band is on show */
  const levelBandTarget = spaceTargetAt(
    venue.targetDb,
    bandCenterHz(LEVEL_BAND, freqHz),
    crossovers,
    balance,
  );
  /** the listener's level at System gain in the lowest band, the same in every band on show */
  const listenerLevel = useMemo(
    () => (placed ? spaceLevelAt(levelBandReq, venue.listener) : null),
    [placed, levelBandReq, venue.listener],
  );
  // the grid on show: the audience's average at System gain in its band (over the spots it was computed with)
  const audienceLevel = useMemo(
    () => (shown && placed ? audienceAverage(shown.grid, shown.req.room, shown.spots) : null),
    [shown, placed],
  );
  // the grid on show (at System gain, as the model plays) with the target of its band (an older space's while the next
  // computes)
  const view = useMemo<CoverageGridView | null>(() => {
    if (!shown || !placed) return null;
    const target = spaceTargetAt(venue.targetDb, shown.centerHz, crossovers, balance);
    return { grid: shown.grid, room: shown.req.room, target };
  }, [shown, placed, venue.targetDb, crossovers, balance]);
  const settledView = useHeld(view, dragging);
  const stats = useMemo(
    () => (view && shown ? coverageStats(view.grid, view.room, shown.spots, view.target) : null),
    [view, shown],
  );
  /** the notes from the last Calculate delays, while the placements are as it left them */
  const [delayNotes, setDelayNotes] = useState<{
    placements: readonly SpacePlacement[];
    notes: (DelayNote | null)[];
  } | null>(null);
  /** what the last Calculate gains reported, while the space is as it left it */
  const [gainNote, setGainNote] = useState<{ space: SpaceSpec; limit: GainLimit | null } | null>(
    null,
  );
  /** the space the model reads, for the levels at the reference (the model from before a drag, while it lasts) */
  const modelDesign = useMemo(
    () => ({
      space: { ...space, placements, venue: { ...venue, room, stages } },
      stacks,
      speakers,
    }),
    // the reference reads the placements, the room, the ear, the listener, where it is measured and System gain
    [
      placements,
      stages,
      room,
      venue.earFt,
      venue.listener,
      venue.levelRef,
      venue.systemDb,
      stacks,
      speakers,
    ],
  );
  /** each band's level at the reference at System gain: at once, or the audience's from the worker */
  const levelsNow = useMemo(
    () => referenceLevelsNow(modelDesign, settledModel),
    [modelDesign, settledModel],
  );
  const [audienceLevels, setAudienceLevels] = useState<{
    model: SpaceModel;
    levels: BandLevels;
  } | null>(null);
  useEffect(() => {
    if (levelsNow) return;
    let live = true;
    referenceLevels(modelDesign, settledModel).then(
      (levels) => {
        if (live) setAudienceLevels({ model: settledModel, levels });
      },
      () => {},
    );
    return () => {
      live = false;
    };
  }, [levelsNow, modelDesign, settledModel]);
  const atReference =
    levelsNow ??
    (audienceLevels && audienceLevels.model === settledModel ? audienceLevels.levels : {});
  /** each band's level at the reference at the space's System gain, and its target */
  const bandLevels = useMemo(
    () =>
      placed
        ? LEVEL_BANDS.flatMap((b) => {
            const db = atReference[b];
            return db === undefined
              ? []
              : [
                  {
                    band: b,
                    db,
                    target: spaceTargetAt(
                      venue.targetDb,
                      bandCenterHz(b, freqHz),
                      crossovers,
                      balance,
                    ),
                  },
                ];
          })
        : [],
    [placed, atReference, venue.targetDb, freqHz, crossovers, balance],
  );
  /** every driver band's headroom at the space's System gain */
  const headrooms = useMemo(() => bandHeadrooms(model), [model]);
  /** each driver band past its limit, by name, with how far, dB: once for a band a mirrored pair plays twice */
  const overLimit = useMemo(() => {
    const out = new Map<string, NamedBand & { overDb: number }>();
    for (const h of headrooms) {
      const names = h.headroomDb < 0 ? bandNames(model, h) : null;
      if (!names) continue;
      const key = JSON.stringify([h.placement, h.member, h.band]);
      const overDb = Math.max(-h.headroomDb, out.get(key)?.overDb ?? 0);
      out.set(key, { ...names, overDb });
    }
    return [...out.values()];
  }, [headrooms, model]);
  const response = useMemo(
    () => (placed ? spaceResponse(settledModel, venue, venue.listener) : []),
    // the response reads the model, the listener and the ear
    [placed, settledModel, venue.listener, venue.earFt],
  );
  /** the target across the response chart's frequencies, under the Band balance */
  const targetCurve = useMemo(
    () =>
      response.map((o) => ({
        f: o.f,
        spl: spaceTargetAt(venue.targetDb, o.f, crossovers, balance),
      })),
    [response, venue.targetDb, crossovers, balance],
  );
  const store = useConfigStore(SPACES_COLLECTION);

  /** every edit to the space */
  const editSpace = (edit: (s: SpaceSpec) => SpaceSpec) =>
    setDesign((d) => ({ ...d, space: edit(d.space) }));
  const editPlacements = (edit: (list: readonly SpacePlacement[]) => SpacePlacement[]) =>
    editSpace((s) => ({ ...s, placements: edit(s.placements) }));
  /** each box's plan from its spot, as the design lays it out now: what the stage rules read */
  const plans = useMemo(() => spotPlans(items), [items]);
  /** a change to the space kept only when it breaks no rule the space kept (lib/speaker/spaceStages) */
  const editRuled = (edit: (s: SpaceSpec) => SpaceSpec) =>
    editSpace((s) => {
      const next = edit(s);
      return keepsRules(s, next, plans) ? next : s;
    });
  /** a change to one placement, kept only when it breaks no rule the space kept (a turn: at its new aim) */
  const editPlacement = (k: number, edit: (p: SpacePlacement) => SpacePlacement) =>
    setDesign((d) => withPlacementsRuled(d, (list) => list.map((p, i) => (i === k ? edit(p) : p))));
  /** the space when a stage drag began: each move of the drag starts from it */
  const stageDragStart = useRef<SpaceSpec | null>(null);
  /** the box the design places at index `i` (what the map draws; a mirrored pair is two boxes) */
  const boxAt = (i: number): DraggedBox | undefined => items[i]?.placement;
  const editVenue = (edit: (v: SpaceVenue) => SpaceVenue) =>
    editSpace((s) => ({ ...s, venue: edit(s.venue) }));
  const replaceDesign = (d: SpaceDesign) => {
    setDesign(d);
    setReplaced((n) => n + 1);
  };
  /** Calculate gains from `d`; the result replaces the space unless it changed meanwhile */
  const calculateGains = async (d: SpaceDesign) => {
    const { design: next, limit } = await withCalculatedGains(d);
    setDesign((now) => (now.space === d.space ? next : now));
    setGainNote({ space: next.space, limit });
  };
  /** the shared view: a link's space shows in place of the page's own, and the page's picks end with each switch */
  const sharedView: SharedMode<SpaceDesign> = {
    ...sharedDraft,
    open: (d) => {
      sharedDraft.open(d);
      setReplaced((n) => n + 1);
    },
    close: () => {
      sharedDraft.close();
      setReplaced((n) => n + 1);
    },
  };
  return {
    design,
    sharedView,
    setDesign,
    replaced,
    /** replaces the design whole: a start, a clear or an opened save */
    replaceDesign,
    model,
    /** the boxes as the design places them now (the model's may be a step behind a drag), in the model's order */
    items,
    /** what the 3D view shows: during a drag, the model, stages and map from before it */
    settled: {
      model: settledModel,
      stages: settledStages,
      view: settledView,
    },
    /** a drag of a box, its aim, or a stage on the map begins (true) or ends */
    setDragging,
    arrivals,
    view,
    stats,
    band,
    setBand,
    freqHz,
    setFreqHz,
    isPending: placed && !(failed && failed.req === req) && (!shown || shown.req !== req),
    error: failed ? failed.message : "",
    /** the listener's level in the lowest band at System gain: the same in every band on show */
    listenerDb: listenerLevel,
    /** the audience's average at the space's level (null until a grid arrives) */
    audienceDb: audienceLevel,
    /** the audience's average at full power: with System gain at 0 dB */
    audienceAtLimit: audienceLevel !== null ? audienceLevel - venue.systemDb : null,
    /** the target in the band on show, and where it is measured */
    target,
    levelRef,
    balance,
    /** the target in the lowest band: what the Listener readout is compared with */
    levelBandTarget,
    bandLevels,
    overLimit,
    response,
    targetCurve,
    store,
    snapshot: () => spaceSnapshot(design),
    /** whether a save holds a space: the library lists only those */
    holds: (c: SavedConfig) => spaceFromSaved(c) !== null,
    /** opens a saved space: the document's id and name, its placements, venue, stacks and speakers */
    restore: (c: SavedConfig) => {
      const saved = spaceFromSaved(c);
      // the library lists only saves that hold a space (`holds`)
      if (saved) replaceDesign(saved);
    },
    setName: (name: string) => editSpace((s) => ({ ...s, name })),
    /** sets the save the space is open in, as its id; null: none (a new space's draft id) */
    setOpenId: (id: string | null) => editSpace((s) => ({ ...s, id: id ?? DRAFT_SPACE_ID })),
    editVenue,
    editPlacement,
    /** places a Place choice's item at the new spot, its speakers copied into the space */
    place: (item: PlaceItem) => setDesign((d) => withItemPlaced(d, item)),
    /** removes a placement; a stack or speaker nothing places any more stays (the save keeps only what is placed) */
    removePlacement: (k: number) => editPlacements((list) => list.filter((_, i) => i !== k)),
    coupling,
    snapsFlush,
    setSnapsFlush,
    /**
     * moves a box of the map (an index into the model's boxes) on the floor; its placement's other box follows. It
     * snaps flush against a wall or another box while Snap to walls & boxes is on, unless `free` (Alt held)
     */
    moveBox: (i: number, p: FloorPoint, free: boolean) => {
      const box = boxAt(i);
      if (!box) return;
      const plan = plans[i];
      editRuled((s) => {
        const { stages } = s.venue;
        // the stage it would stand on: its edges, and those of the stages beside it at that level
        const host = plan ? stageAt(stages, planCenter(movedPlan(plan, p), p)) : null;
        const edges = [...stagesOn(stages, host ? host.id : null), ...(host ? [host] : [])].flatMap(
          straightEdges,
        );
        const placedAt = (to: FloorPoint) =>
          s.placements.map((o, k) => (k === box.source ? movedPlacement(o, box.image, to) : o));
        const flush: FlushSnap | undefined =
          snapsFlush && !free
            ? {
                items,
                at: i,
                walls: roomWalls(s.venue.room),
                stages: {
                  edges,
                  fits: (to) => keepsRules(s, { ...s, placements: placedAt(to) }, plans),
                },
              }
            : undefined;
        return { ...s, placements: withBoxMoved(s.placements, box, p, s.venue.room, flush) };
      });
    },
    /**
     * turns a box of the map to face `p` on the floor; its placement's other box follows. `stepped` (Shift held): in
     * `AIM_SNAP_DEG` steps. A turn that breaks a rule the space kept is undone
     */
    aimBox: (i: number, p: FloorPoint, stepped: boolean) => {
      const box = boxAt(i);
      if (box)
        setDesign((d) =>
          withPlacementsRuled(d, (list) =>
            withBoxAimed(list, box, p, stepped ? AIM_SNAP_DEG : undefined),
          ),
        );
    },
    moveListener: (p: FloorPoint) => editVenue((v) => ({ ...v, listener: onFloor(p, v.room) })),
    /** a start from "New from…": a preset or template gets Calculate delays and Calculate gains once */
    start: (id: DesignStart) => {
      const fresh = spaceFromStart(id);
      if (id === EMPTY_START) return replaceDesign(fresh);
      const { design: aligned } = withCalculatedDelays(fresh);
      replaceDesign(aligned);
      void calculateGains(aligned);
    },
    /** sets every placement's Delay once, and keeps the solver's notes */
    calculateDelays: () => {
      const { design: next, notes } = withCalculatedDelays(design);
      setDesign(next);
      setDelayNotes({ placements: next.space.placements, notes });
    },
    /** sets each placement's Gain and System gain once */
    calculateGains: () => calculateGains(design),
    /** the notes from the last Calculate delays, by placement; empty once a placement changes */
    delayNotes: delayNotes && delayNotes.placements === space.placements ? delayNotes.notes : [],
    /** the limit that held the last Calculate gains down; null once the space changes, or when none did */
    gainLimit: gainNote && gainNote.space === space ? gainNote.limit : null,
    /** the stages' edits (pages/space/stageEdits), each kept only when it breaks no stage rule */
    stages: {
      /** adds a stage on the floor (null) or a riser on a floor stage, smaller where the full size has no room; its id */
      add: (on: SpaceStage["id"] | null): SpaceStage["id"] => {
        const added = withStageAdded(space, on, plans);
        editSpace((s) => ({ ...s, venue: { ...s.venue, stages: added.layout.venue.stages } }));
        return added.id;
      },
      remove: (id: SpaceStage["id"]) => editSpace((s) => withStageRemoved(s, id)),
      setShape: (id: SpaceStage["id"], shape: StageShape) =>
        editSpace((s) => withStageShape(s, id, shape)),
      setHeight: (id: SpaceStage["id"], heightFt: number) =>
        editSpace((s) => withStageHeight(s, id, heightFt)),
      setBox: (id: SpaceStage["id"], box: Partial<StageBox>) =>
        editSpace((s) => withStageBox(s, id, box, plans)),
      /** a drag on the map begins: its moves start from the space as it is now */
      beginDrag: () => {
        stageDragStart.current = space;
      },
      /**
       * a drag on the map moves stage `id` (handle null) or one of its handles by `by` from where it began; it snaps
       * while Snap to walls & boxes is on, unless `free` (Alt held). A move that breaks a stage rule keeps the last one.
       */
      drag: (id: SpaceStage["id"], handle: number | null, by: FloorPoint, free: boolean) => {
        const start = stageDragStart.current;
        if (!start) return;
        const after = withStageDragged(
          start,
          { id, handle, by, snaps: snapsFlush && !free },
          plans,
        );
        if (after)
          editSpace((s) => ({
            ...s,
            placements: after.placements,
            venue: { ...s.venue, stages: after.venue.stages },
          }));
      },
    },
    /** the room's settings (`RoomFields`) */
    room: {
      // a smaller room keeps what it holds inside
      setRoomSize: (size) =>
        editSpace((s) =>
          fittedSpace({ ...s, venue: { ...s.venue, room: { ...s.venue.room, ...size } } }),
        ),
      setMaterial: (surface, material) =>
        editVenue((v) => ({
          ...v,
          room: { ...v.room, materials: { ...v.room.materials, [surface]: material } },
        })),
      setCeilingFt: (ceilingFt) => editVenue((v) => ({ ...v, room: { ...v.room, ceilingFt } })),
      setCrowd: (crowd) => editVenue((v) => ({ ...v, room: { ...v.room, crowd } })),
      setOutdoors: (outdoors) => editVenue((v) => ({ ...v, room: { ...v.room, outdoors } })),
    } satisfies RoomActions,
    /** sets the amp power of `bands` of the space's speaker `speakerId`, W (every placement of it shares it) */
    setAmpPower: (speakerId: SpeakerSpec["id"], bands: readonly BandId[], watts: number) =>
      setDesign((d) => ({
        ...d,
        speakers: d.speakers.map((s) => (s.id === speakerId ? withAmpPower(s, bands, watts) : s)),
      })),
  };
}

/** What `useSpace` returns. */
export type SpacePlanner = ReturnType<typeof useSpace>;
