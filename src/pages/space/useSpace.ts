import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useConfigStore } from "../../components/saved-configs/useConfigStore";
import {
  audienceAverage,
  bandCenterHz,
  bandRangeHz,
  coverageStats,
  COVERAGE_BANDS,
  COVERAGE_GRID_COLS,
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
  spaceGridRequest,
  spaceLevelAt,
  spaceModelLaidOut,
  spaceResponse,
  withSolved,
  type SpaceGridRequest,
} from "../../lib/speaker/spaceCoverage";
import { aimedPlacement, movedPlacement } from "../../lib/speaker/spaceLayout";
import { withAmpPower } from "../../lib/speaker/spaceHardware";
import { runSpaceGrid } from "../../lib/speaker/runSpace";
import { presetLayers } from "../stack/stackPresets";
import { STACK_START_DESIGN_NAMES, type StackPreset } from "../../constants/stackPresets";
import { spacePlacement } from "../../lib/speaker/specParts";
import { listenerArrivals, solveFeeds } from "../../lib/speaker/solveFeeds";
import { withSpeaker } from "../stack/useStack";
import type { RoomActions } from "../../components/ui/RoomFields";
import { SPACES_COLLECTION, SPACE_ITEM } from "../../constants/speakerSpec";
import type { PlaceItem } from "./placeOptions";
import { DRAFT_SPACE_ID, spaceDraft, spaceFromSaved, spaceSnapshot } from "./spaceSaves";
import { usePageDraft, type SharedMode } from "../../hooks/usePageDraft";
import type {
  BandId,
  CoverageBand,
  CoverageGrid,
  CoverageGridView,
  CoverageLevelRef,
  FloorPoint,
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
 * The band the space's turn-down is set in: the lowest. The space is turned down once, so that this band reaches the
 * Target level at the reference; the band on show never changes it (it changes only which band the map and the
 * per-band figures are about).
 */
const TURN_DOWN_BAND = "sub" satisfies CoverageBand;

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

/**
 * A space kept inside its room (after the room changes size): each placement's spot on the floor, the listener and the
 * alignment point.
 */
export function fittedSpace(space: SpaceSpec): SpaceSpec {
  const { room } = space.venue;
  return {
    ...space,
    placements: space.placements.map((p) => inRoom(p, room)),
    venue: {
      ...space.venue,
      listener: inRoom(space.venue.listener, room),
      alignAt: inRoom(space.venue.alignAt, room),
    },
  };
}

/** The box a map drag names, as the model places it (an index into its boxes): which placement it is and where it stands. */
export type DraggedBox = Pick<PlacedSource, "source" | "image" | "x" | "y">;

/**
 * The placements after a map drag moved a box to `p`, snapped and kept on the floor: the box as set moves its placement
 * there; the mirror image of a pair moves it to the mirror image of the spot, so the other box follows as its mirror.
 */
export function withBoxMoved(
  placements: readonly SpacePlacement[],
  box: DraggedBox,
  p: FloorPoint,
  room: RoomFloor,
): SpacePlacement[] {
  const to = onFloor(p, room);
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
): SpacePlacement[] {
  return placements.map((o, i) => (i === box.source ? aimedPlacement(o, box, p) : o));
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
 * A preset read in as a space: a PA layout on the PA floor's starting layout, or the Hi-fi pair in its room. A PA preset
 * takes its music balance in its band Levels.
 */
export function spaceFromStart(start: StackPreset): SpaceDesign {
  const read = presetLayers(start, { id: DRAFT_SPACE_ID, name: STACK_START_DESIGN_NAMES[start] });
  return { space: read.space, stacks: [read.stack], speakers: read.speakers };
}

/** Whether a job needs the turn-down band's grid: not at all, or it is the job's own, or it is another grid. */
const ANCHOR_GRID = { none: "none", own: "own", other: "other" } as const;

/**
 * One grid for the worker: the request, the frequency its band's target is read at (Hz), and the boxes' spots it was
 * asked for (the audience average and the stats leave the floor in front of them out, whatever the boxes are by then).
 * `anchor` is the same space's request in the turn-down band; `anchorGrid` says whether the turn-down reads the
 * audience average, which needs that band's grid too.
 */
interface GridJob {
  req: Omit<SpaceGridRequest, "cols">;
  centerHz: number;
  spots: readonly FloorPoint[];
  anchor: Omit<SpaceGridRequest, "cols">;
  anchorGrid: (typeof ANCHOR_GRID)[keyof typeof ANCHOR_GRID];
}

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
  /** the listener's spot; null when the reference is not the listener (so moving the listener moves nothing else) */
  listener: FloorPoint | null;
  meterSpots: readonly MeterSpot[];
  /** the boxes' spots: the audience average leaves the floor right in front of them out */
  boxes: readonly FloorPoint[];
}

/**
 * A request's level at the limit at the reference, dB: the audience average over the
 * grid's floor (needs `grid`; null without it), the level at the listener, or the mean of the 1 m spots of the
 * placements that play in `band`. Null when nothing reaches it. Only the listener's own reference reads the listener.
 */
export function referenceAtLimit(
  levelRef: CoverageLevelRef,
  req: Omit<SpaceGridRequest, "cols">,
  spots: ReferenceSpots,
  grid: CoverageGrid | null,
  band: BandRange,
): number | null {
  if (levelRef === COVERAGE_LEVEL_REF.listener)
    return spots.listener && spaceLevelAt(req, spots.listener);
  if (levelRef === COVERAGE_LEVEL_REF.stacks) return oneMeterAverage(req, spots.meterSpots, band);
  return grid ? audienceAverage(grid, req.room, spots.boxes) : null;
}

/**
 * The system's gain, dB: what brings the reference's level (at the limit) down to the target, or 0 (the limit) when it
 * doesn't reach it.
 */
const systemGain = (target: number, atLimit: number | null) =>
  atLimit !== null ? Math.min(0, target - atLimit) : 0;

/** The space with an item placed at the new spot. */
const withPlaced = (d: SpaceDesign, item: SpacePlacement["item"]): SpaceDesign => ({
  ...d,
  space: {
    ...d.space,
    placements: [...d.space.placements, spacePlacement(NEW_SPOT, item, 0)],
  },
});

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
  const { space } = design;
  const { venue } = space;
  // the model reads the placements, the room, the stacks and the speakers, a step behind the typing
  const placements = useDeferredValue(space.placements);
  const room = useDeferredValue(venue.room);
  const stacks = useDeferredValue(design.stacks);
  const speakers = useDeferredValue(design.speakers);
  /** the model at the typed delays and levels (Auto ones at 0): what the solver reads */
  const laidOut = useMemo(
    () =>
      spaceModelLaidOut({
        space: { ...space, placements, venue: { ...venue, room } },
        stacks,
        speakers,
      }),
    // the model reads only these (the name, the listener and the target don't move it)
    [placements, room, stacks, speakers],
  );
  /** every Auto delay and level, solved from the layout (the listener doesn't move them) */
  const solved = useMemo(
    () => solveFeeds(laidOut, { alignAt: venue.alignAt, earFt: venue.earFt, room }),
    [laidOut, venue.alignAt, venue.earFt, room],
  );
  const model = useMemo(() => withSolved(laidOut, solved), [laidOut, solved]);
  /** each placement's arrival at the listener against the latest main */
  const arrivals = useMemo(
    () => listenerArrivals(model, venue.listener, venue.earFt),
    [model, venue.listener, venue.earFt],
  );
  const req = useMemo<Omit<SpaceGridRequest, "cols">>(
    () => spaceGridRequest(model, { room, earFt: venue.earFt }, band, freqHz, COVERAGE_GRID_COLS),
    [model, room, venue.earFt, band, freqHz],
  );
  /** the space in the turn-down band: what sets the turn-down, whatever band is on show (no frequency is read) */
  const anchorReq = useMemo<Omit<SpaceGridRequest, "cols">>(
    () =>
      spaceGridRequest(
        model,
        { room, earFt: venue.earFt },
        TURN_DOWN_BAND,
        SINGLE_FREQ_RANGE[0],
        COVERAGE_GRID_COLS,
      ),
    [model, room, venue.earFt],
  );
  /** the boxes' spots: the stats leave the floor right in front of them out */
  const spots = useMemo(
    () => model.placements.map((p) => ({ x: p.item.placement.x, y: p.item.placement.y })),
    [model],
  );

  // the worker queue: one job at a time, and only the newest waiting job is kept
  // each job carries the frequency its band's target is read at, so a grid on show keeps its own band's target
  const [shown, setShown] = useState<
    (GridJob & { grid: CoverageGrid; anchorOf: CoverageGrid | null }) | null
  >(null);
  const [failed, setFailed] = useState<{ req: typeof req; message: string } | null>(null);
  const busy = useRef(false);
  const want = useRef<GridJob | null>(null);
  /** the turn-down band's last grid, by its request: a change of band on show doesn't compute it again */
  const anchorCache = useRef<{ req: GridJob["anchor"]; grid: CoverageGrid } | null>(null);
  const pump = () => {
    if (busy.current || !want.current) return;
    const next = want.current;
    want.current = null;
    busy.current = true;
    /** the turn-down band's grid for the grid just computed: the same grid, a kept one or a new one */
    const anchorOf = async (grid: CoverageGrid): Promise<CoverageGrid | null> => {
      if (next.anchorGrid === ANCHOR_GRID.none) return null;
      if (next.anchorGrid === ANCHOR_GRID.own) return grid;
      const kept = anchorCache.current;
      if (kept && kept.req === next.anchor) return kept.grid;
      const made = await runSpaceGrid({ ...next.anchor, cols: COVERAGE_GRID_COLS });
      anchorCache.current = { req: next.anchor, grid: made };
      return made;
    };
    runSpaceGrid({ ...next.req, cols: COVERAGE_GRID_COLS })
      .then(async (grid) => ({ grid, anchor: await anchorOf(grid) }))
      .then(
        ({ grid, anchor }) => {
          setShown({ ...next, grid, anchorOf: anchor });
          setFailed(null);
        },
        (e: unknown) =>
          setFailed({ req: next.req, message: e instanceof Error ? e.message : String(e) }),
      )
      .finally(() => {
        busy.current = false;
        pump();
      });
  };
  const placed = model.scene.sources.length > 0;
  // where the target is measured, and the music balance it follows across the bands (lib/speaker/spaceBalance)
  const { levelRef, balance } = venue;
  const fromGrid = levelRef === COVERAGE_LEVEL_REF.audience;
  /** what the job needs of the turn-down band: only the audience average reads a grid there */
  const anchorGrid = !fromGrid
    ? ANCHOR_GRID.none
    : band === TURN_DOWN_BAND
      ? ANCHOR_GRID.own
      : ANCHOR_GRID.other;
  useEffect(() => {
    if (!placed) return;
    want.current = {
      req,
      centerHz: bandCenterHz(band, freqHz),
      spots,
      anchor: anchorReq,
      anchorGrid,
    };
    pump();
  }, [req, placed, anchorReq, anchorGrid]);

  const crossovers = useMemo(
    () => spaceCrossoversHz({ space: { ...space, placements }, stacks, speakers }),
    // the crossovers read only these
    [placements, stacks, speakers],
  );
  /** the target in the band on show: what the map is compared with */
  const target = spaceTargetAt(venue.targetDb, bandCenterHz(band, freqHz), crossovers, balance);
  /** the target in the turn-down band: what the reference is turned down to, whatever band is on show */
  const turnDownTarget = spaceTargetAt(
    venue.targetDb,
    bandCenterHz(TURN_DOWN_BAND, freqHz),
    crossovers,
    balance,
  );
  /** the listener's level at the limit in the turn-down band, the same in every band on show */
  const listenerAtLimit = useMemo(
    () => (placed ? spaceLevelAt(anchorReq, venue.listener) : null),
    [placed, anchorReq, venue.listener],
  );
  /** the spots 1 m in front of each placement that holds a modeled stack or speaker, with the bands its boxes play */
  const meterSpots = useMemo(
    () => meterSpotsOf({ space: { ...space, placements } }, model, room),
    // the spots read the placements, the room and which placements the model holds
    [placements, room, model],
  );
  /** the listener's spot when it is the reference; null otherwise, so the other references ignore the listener */
  const refListener = levelRef === COVERAGE_LEVEL_REF.listener ? venue.listener : null;
  /** a request's level at the limit at the reference, when points alone give it (not the audience average) */
  const pointRefAtLimit = (r: Omit<SpaceGridRequest, "cols">) =>
    referenceAtLimit(
      levelRef,
      r,
      { listener: refListener, meterSpots, boxes: spots },
      null,
      bandRangeHz(TURN_DOWN_BAND, SINGLE_FREQ_RANGE[0]),
    );
  /** the reference's level at the limit in the turn-down band (points alone; the audience average comes from its grid) */
  const anchorAtLimit = useMemo(
    () => (placed ? pointRefAtLimit(anchorReq) : null),
    // the reference reads these
    [placed, anchorReq, levelRef, refListener, meterSpots],
  );
  // the grid on show: the audience's average at the limit in its band (over the spots it was computed with)
  const audienceAtLimit = useMemo(
    () => (shown && placed ? audienceAverage(shown.grid, shown.req.room, shown.spots) : null),
    [shown, placed],
  );
  /** the reference's level at the limit in the turn-down band, for the grid on show (an older space's while the next computes) */
  const shownAnchorAtLimit = useMemo(() => {
    if (!shown || !placed) return null;
    if (!fromGrid)
      return shown.anchor === anchorReq ? anchorAtLimit : pointRefAtLimit(shown.anchor);
    return shown.anchorOf ? audienceAverage(shown.anchorOf, shown.req.room, shown.spots) : null;
    // the reference reads these (an older space's, the listener or the 1 m spots too)
  }, [shown, placed, fromGrid, anchorReq, anchorAtLimit, refListener, meterSpots]);
  // the grid on show with the target of its band and the one turn-down (an older space's while the next computes); the
  // audience average needs the turn-down band's grid, so the view waits for it rather than mix two spaces
  const view = useMemo<CoverageGridView | null>(() => {
    if (!shown || !placed || (fromGrid && !shown.anchorOf)) return null;
    const g = systemGain(turnDownTarget, shownAnchorAtLimit);
    const t = spaceTargetAt(venue.targetDb, shown.centerHz, crossovers, balance);
    return {
      grid: shown.grid,
      room: shown.req.room,
      target: t - g,
      gain: g,
      atLimit: shownAnchorAtLimit,
    };
  }, [
    shown,
    placed,
    fromGrid,
    shownAnchorAtLimit,
    turnDownTarget,
    venue.targetDb,
    crossovers,
    balance,
  ]);
  const stats = useMemo(
    () => (view && shown ? coverageStats(view.grid, view.room, shown.spots, view.target) : null),
    [view, shown],
  );
  /** the space's one turn-down, dB: the turn-down band reaches the Target at the reference, never past the limit */
  const gain = fromGrid ? (view ? view.gain : 0) : systemGain(turnDownTarget, anchorAtLimit);
  /** the turn-down: its gain, the target it reaches for (in the turn-down band) and the reference's level at the limit */
  const turn = {
    gain,
    target: turnDownTarget,
    atLimit: fromGrid ? (view ? view.atLimit : null) : anchorAtLimit,
  };
  /** each band's level at the listener at the space's level, and its target */
  const bandLevels = useMemo(
    () =>
      placed
        ? keysOf(COVERAGE_BANDS).map((b) => ({
            band: b,
            db:
              spaceLevelAt(
                spaceGridRequest(
                  model,
                  { room, earFt: venue.earFt },
                  b,
                  freqHz,
                  COVERAGE_GRID_COLS,
                ),
                venue.listener,
              ) + gain,
            target: spaceTargetAt(venue.targetDb, bandCenterHz(b, freqHz), crossovers, balance),
          }))
        : [],
    [
      placed,
      model,
      room,
      venue.earFt,
      venue.listener,
      venue.targetDb,
      freqHz,
      gain,
      crossovers,
      balance,
    ],
  );
  const responseAtLimit = useMemo(
    () => (placed ? spaceResponse(model, venue, venue.listener) : []),
    // the response reads the model, the listener and the ear
    [placed, model, venue.listener, venue.earFt],
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
  const editPlacement = (k: number, edit: (p: SpacePlacement) => SpacePlacement) =>
    editPlacements((list) => list.map((p, i) => (i === k ? edit(p) : p)));
  /** the box the model places at index `i` (what the map draws; a mirrored pair is two boxes) */
  const boxAt = (i: number): DraggedBox | undefined => model.placements[i]?.item.placement;
  const editVenue = (edit: (v: SpaceVenue) => SpaceVenue) =>
    editSpace((s) => ({ ...s, venue: edit(s.venue) }));
  const replaceDesign = (d: SpaceDesign) => {
    setDesign(d);
    setReplaced((n) => n + 1);
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
    arrivals,
    view,
    stats,
    gain,
    band,
    setBand,
    freqHz,
    setFreqHz,
    isPending:
      placed &&
      !(failed && failed.req === req) &&
      (!shown || shown.req !== req || (fromGrid && !shown.anchorOf)),
    error: failed ? failed.message : "",
    /** the listener's level in the turn-down band at the space's level: the same in every band on show */
    listenerDb: listenerAtLimit !== null ? listenerAtLimit + gain : null,
    /** the audience's average at the space's level (null until a grid arrives) */
    audienceDb: audienceAtLimit !== null ? audienceAtLimit + gain : null,
    audienceAtLimit,
    /** the target in the band on show, and where it is measured */
    target,
    levelRef,
    balance,
    /** the one turn-down (the same in every band on show) and what it reaches for */
    turn,
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
    editVenue,
    editPlacement,
    /** places a Place choice's item at the new spot, its speakers copied into the space */
    place: (item: PlaceItem) => setDesign((d) => withItemPlaced(d, item)),
    /** removes a placement; a stack or speaker nothing places any more stays (the save keeps only what is placed) */
    removePlacement: (k: number) => editPlacements((list) => list.filter((_, i) => i !== k)),
    /** moves a box of the map (an index into the model's boxes) on the floor; its placement's other box follows */
    moveBox: (i: number, p: FloorPoint) => {
      const box = boxAt(i);
      if (box) editPlacements((list) => withBoxMoved(list, box, p, venue.room));
    },
    /** turns a box of the map to face `p` on the floor; its placement's other box follows */
    aimBox: (i: number, p: FloorPoint) => {
      const box = boxAt(i);
      if (box) editPlacements((list) => withBoxAimed(list, box, p));
    },
    moveListener: (p: FloorPoint) => editVenue((v) => ({ ...v, listener: onFloor(p, v.room) })),
    /** moves the alignment point, where the mains arrive together */
    moveAlignAt: (p: FloorPoint) => editVenue((v) => ({ ...v, alignAt: onFloor(p, v.room) })),
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
