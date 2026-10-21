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
import { runSpaceGrid, runSpaceQuickGrid } from "../../lib/speaker/runSpace";
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

/** What the library's row says when a document holds no space. */
const MISSING_SPACE_TEXT = "That save holds no space";

/**
 * The band Calculate levels reads the reference in: the lowest. It sets System level so that this band reaches the
 * Target level at the reference; the band on show never changes it. The Listener readout is in it too.
 */
const LEVEL_BAND = "sub" satisfies CoverageBand;

/** Where a new placement stands: a little off the front wall, in the middle, ft. */
const NEW_SPOT: FloorPoint = { x: 0, y: 3 };

/** The room's floor: its width and length, ft. */
type RoomFloor = Pick<SpaceVenue["room"], "widthFt" | "lengthFt">;

/** Snaps to a quarter foot. */
const snap = (v: number) => Math.round(v * 4) / 4;

/** A value kept between `lo` and `hi`. */
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

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
 * layout, or the Hi-fi pair in its room). A PA preset takes its music balance in its band Levels. Its id is the draft
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

/**
 * The System level Calculate levels sets, dB: what brings the reference's level (at the limit) down to the target, or 0
 * (the limit) when it doesn't reach it.
 */
const systemGain = (target: number, atLimit: number | null) =>
  atLimit !== null ? Math.min(0, target - atLimit) : 0;

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
  const { design, solved } = withSolvedFeeds(d, (p, s) => ({ ...p, delayMs: tenth(s.delayMs) }));
  return { design, notes: solved.map((s) => s.delayNote) };
}

/** What Calculate levels reads: the reference's level at the limit in LEVEL_BAND (null: nothing reaches it) and its target there. */
export interface ReferenceLevel {
  target: number;
  atLimit: number | null;
}

/**
 * The reference's level at the limit in LEVEL_BAND, and its target there. The audience average needs a grid, so it is
 * worked out on the worker.
 */
export async function referenceLevel(d: SpaceDesign): Promise<ReferenceLevel> {
  const { venue } = d.space;
  const { room } = venue;
  const model = spaceModelLaidOut(d);
  const target = spaceTargetAt(
    venue.targetDb,
    bandCenterHz(LEVEL_BAND, SINGLE_FREQ_RANGE[0]),
    spaceCrossoversHz(d),
    venue.balance,
  );
  if (!model.scene.sources.length) return { target, atLimit: null };
  const req = spaceGridRequest(
    model,
    { room, earFt: venue.earFt },
    LEVEL_BAND,
    SINGLE_FREQ_RANGE[0],
    COVERAGE_GRID_COLS,
  );
  const boxes = model.placements.map((p) => ({ x: p.item.placement.x, y: p.item.placement.y }));
  if (venue.levelRef === COVERAGE_LEVEL_REF.audience) {
    const grid = await runSpaceGrid({ ...req, cols: COVERAGE_GRID_COLS });
    return { target, atLimit: audienceAverage(grid, room, boxes) };
  }
  const atLimit = referenceAtLimit(
    venue.levelRef,
    req,
    { listener: venue.listener, meterSpots: meterSpotsOf(d, model, room), boxes },
    null,
    bandRangeHz(LEVEL_BAND, SINGLE_FREQ_RANGE[0]),
  );
  return { target, atLimit };
}

/**
 * Calculate levels: each fill's Level as the solver sets it (the nearest main's, where it aims), then System level so
 * the reference reaches the target, never past the limit. It also gives what it read, for the page's note.
 */
export async function withCalculatedLevels(
  d: SpaceDesign,
): Promise<{ design: SpaceDesign; reference: ReferenceLevel }> {
  const { design } = withSolvedFeeds(d, (p, s) =>
    p.fill ? { ...p, levelDb: tenth(s.levelDb) } : p,
  );
  const reference = await referenceLevel(design);
  const systemDb = tenth(systemGain(reference.target, reference.atLimit));
  return {
    design: { ...design, space: { ...design.space, venue: { ...design.space.venue, systemDb } } },
    reference,
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
    [placements, stages, room, stacks, speakers],
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
  // where the target is measured, and the music balance it follows across the bands (lib/speaker/spaceBalance)
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
  /** the listener's level at the limit in the lowest band, the same in every band on show */
  const listenerAtLimit = useMemo(
    () => (placed ? spaceLevelAt(levelBandReq, venue.listener) : null),
    [placed, levelBandReq, venue.listener],
  );
  // the grid on show: the audience's average at the limit in its band (over the spots it was computed with)
  const audienceAtLimit = useMemo(
    () => (shown && placed ? audienceAverage(shown.grid, shown.req.room, shown.spots) : null),
    [shown, placed],
  );
  /** every placement plays at System level, dB: 0 is the limit */
  const gain = venue.systemDb;
  // the grid on show with the target of its band, at System level (an older space's while the next computes)
  const view = useMemo<CoverageGridView | null>(() => {
    if (!shown || !placed) return null;
    const t = spaceTargetAt(venue.targetDb, shown.centerHz, crossovers, balance);
    return { grid: shown.grid, room: shown.req.room, target: t - gain, gain };
  }, [shown, placed, gain, venue.targetDb, crossovers, balance]);
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
  /** what the last Calculate levels read, while the space is as it left it */
  const [levelNote, setLevelNote] = useState<{
    space: SpaceSpec;
    reference: ReferenceLevel;
  } | null>(null);
  /** each band's level at the listener at the limit (the model from before a drag, while it lasts) */
  const bandsAtLimit = useMemo(
    () =>
      placed
        ? keysOf(COVERAGE_BANDS).map((b) => ({
            band: b,
            db: spaceLevelAt(
              spaceGridRequest(
                settledModel,
                { room, earFt: venue.earFt },
                b,
                freqHz,
                COVERAGE_GRID_COLS,
              ),
              venue.listener,
            ),
          }))
        : [],
    [placed, settledModel, room, venue.earFt, venue.listener, freqHz],
  );
  /** each band's level at the listener at the space's level, and its target */
  const bandLevels = useMemo(
    () =>
      bandsAtLimit.map(({ band: b, db }) => ({
        band: b,
        db: db + gain,
        target: spaceTargetAt(venue.targetDb, bandCenterHz(b, freqHz), crossovers, balance),
      })),
    [bandsAtLimit, venue.targetDb, freqHz, gain, crossovers, balance],
  );
  const responseAtLimit = useMemo(
    () => (placed ? spaceResponse(settledModel, venue, venue.listener) : []),
    // the response reads the model, the listener and the ear
    [placed, settledModel, venue.listener, venue.earFt],
  );
  const response = useMemo(
    () => responseAtLimit.map((o) => ({ f: o.f, spl: o.spl + gain })),
    [responseAtLimit, gain],
  );
  /** the target across the response chart's frequencies, under the music balance */
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
  /** Calculate levels from `d`; the result replaces the space unless it changed meanwhile */
  const calculateLevels = async (d: SpaceDesign) => {
    const { design: next, reference } = await withCalculatedLevels(d);
    setDesign((now) => (now.space === d.space ? next : now));
    setLevelNote({ space: next.space, reference });
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
    gain,
    band,
    setBand,
    freqHz,
    setFreqHz,
    isPending: placed && !(failed && failed.req === req) && (!shown || shown.req !== req),
    error: failed ? failed.message : "",
    /** the listener's level in the lowest band at System level: the same in every band on show */
    listenerDb: listenerAtLimit !== null ? listenerAtLimit + gain : null,
    /** the audience's average at the space's level (null until a grid arrives) */
    audienceDb: audienceAtLimit !== null ? audienceAtLimit + gain : null,
    audienceAtLimit,
    /** the target in the band on show, and where it is measured */
    target,
    levelRef,
    balance,
    /** the target in the lowest band: what the Listener readout is compared with */
    levelBandTarget,
    bandLevels,
    response,
    targetCurve,
    store,
    snapshot: () => spaceSnapshot(design),
    /** opens a saved space: the document's id and name, its placements, venue, stacks and speakers */
    restore: (c: SavedConfig) => {
      const saved = spaceFromSaved(c);
      if (saved) replaceDesign(saved);
      else store.flash(MISSING_SPACE_TEXT);
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
    /** a start from "New from…": a preset or template gets Calculate delays and Calculate levels once */
    start: (id: DesignStart) => {
      const fresh = spaceFromStart(id);
      if (id === EMPTY_START) return replaceDesign(fresh);
      const { design: aligned } = withCalculatedDelays(fresh);
      replaceDesign(aligned);
      void calculateLevels(aligned);
    },
    /** sets every placement's Delay once, and keeps the solver's notes */
    calculateDelays: () => {
      const { design: next, notes } = withCalculatedDelays(design);
      setDesign(next);
      setDelayNotes({ placements: next.space.placements, notes });
    },
    /** sets each fill's Level and System level once */
    calculateLevels: () => calculateLevels(design),
    /** the notes from the last Calculate delays, by placement; empty once a placement changes */
    delayNotes: delayNotes && delayNotes.placements === space.placements ? delayNotes.notes : [],
    /** what the last Calculate levels read; null once the space changes */
    levelNote: levelNote && levelNote.space === space ? levelNote.reference : null,
    /** the stages' edits (pages/space/stageEdits), each kept only when it breaks no stage rule */
    stages: {
      /** adds a stage on the floor (null) or a riser on a floor stage; its id, or null when no spot is free */
      add: (on: SpaceStage["id"] | null): SpaceStage["id"] | null => {
        const added = withStageAdded(space, on, plans);
        if (added)
          editSpace((s) => ({ ...s, venue: { ...s.venue, stages: added.layout.venue.stages } }));
        return added ? added.id : null;
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
