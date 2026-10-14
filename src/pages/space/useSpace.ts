import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useConfigStore } from "../../components/saved-configs/useConfigStore";
import {
  audienceAverage,
  bandCenterHz,
  coverageStats,
  COVERAGE_BANDS,
  COVERAGE_GRID_COLS,
} from "../../lib/pa/coverage";
import { oneMeterSpots, spaceCrossoversHz, spaceTargetAt } from "../../lib/speaker/spaceBalance";
import { COVERAGE_LEVEL_REF } from "../../constants/coverageLevel";
import { keysOf } from "../../lib/records";
import {
  spaceGridRequest,
  spaceLevelAt,
  spaceModel,
  spaceResponse,
  type SpaceGridRequest,
} from "../../lib/speaker/spaceCoverage";
import { resolvedPlacement } from "../../lib/speaker/spaceLayout";
import { withAmpPower } from "../../lib/speaker/spaceHardware";
import { runSpaceGrid } from "../../lib/speaker/runSpace";
import { startLayers } from "../stack/stackPresets";
import { STACK_START_DESIGN_NAMES, type StackStart } from "../../constants/stackPresets";
import { spacePlacement } from "../../lib/speaker/specParts";
import { fillAlignment, placementLead } from "../../lib/speaker/fillAlign";
import { readStoredJson } from "../../lib/storage";
import { withSpeaker } from "../stack/useStack";
import { fromStored, type StoredCoverageLayout } from "../coverage/useCoverageLayout";
import { COVERAGE_LAYOUT_KEY } from "../../constants/coverageTestIds";
import type { RoomActions } from "../../components/ui/RoomFields";
import { SPACES_COLLECTION, SPACE_ITEM } from "../../constants/speakerSpec";
import { SPACE_YAW_DEG } from "../../constants/space";
import type { PlaceItem } from "./placeOptions";
import { DRAFT_SPACE_ID, emptySpace, spaceFromSaved, spaceSnapshot } from "./spaceSaves";
import type {
  BandId,
  CoverageBand,
  CoverageGrid,
  CoverageGridView,
  CoverageLevelRef,
  FloorPoint,
  PaPlannerDesign,
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

/** Where a new placement stands: a little off the front wall, in the middle, ft. */
const NEW_SPOT: FloorPoint = { x: 0, y: 3 };

/** Snaps to a quarter foot. */
const snap = (v: number) => Math.round(v * 4) / 4;

/** A value kept between `lo` and `hi`. */
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** A point kept on the room's floor, ft. */
const inRoom = <P extends FloorPoint>(p: P, room: SpaceVenue["room"]): P => ({
  ...p,
  x: clamp(p.x, -room.widthFt / 2, room.widthFt / 2),
  y: clamp(p.y, 0, room.lengthFt),
});

/** A point snapped to a quarter foot and kept on the room's floor, ft (a drag). */
const onFloor = (p: FloorPoint, room: SpaceVenue["room"]): FloorPoint =>
  inRoom({ x: snap(p.x), y: snap(p.y) }, room);

/**
 * A space kept inside its room (after the room changes size): each placement's spot on the floor (a follower's stored
 * spot too, so it lands inside when it goes on its own) and the listener.
 */
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

/**
 * The placements with placement `k` set to follow placement `follows` (an earlier one), or to stand on its own (null).
 * Either way it keeps where it stands as it stands: on its own, where its lead put it; following, its lead's item, spot,
 * lift and aim mirrored.
 */
export function withFollows(
  placements: readonly SpacePlacement[],
  k: number,
  follows: SpacePlacement["follows"],
): SpacePlacement[] {
  const before = resolvedPlacement(placements, k);
  const set = placements.map((p, i) => (i === k ? { ...p, follows } : p));
  // on its own it stays as it stood; following, it stands as its lead puts it
  const after = follows === null ? before : resolvedPlacement(set, k);
  return set.map((p, i) => (i === k ? { ...after, follows } : p));
}

/**
 * The placements left when placement `k` goes: one that followed it keeps where it stood, on its own; the later ones'
 * references move down one.
 */
export function withoutPlacement(
  placements: readonly SpacePlacement[],
  k: number,
): SpacePlacement[] {
  return placements.flatMap((p, i) => {
    if (i === k) return [];
    if (p.follows === k) return [{ ...resolvedPlacement(placements, i), follows: null }];
    return [{ ...p, follows: p.follows !== null && p.follows > k ? p.follows - 1 : p.follows }];
  });
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
 * A start read in as a space: a preset (a PA layout on the PA floor's starting layout, or the Hi-fi pair in its room), or
 * the current PA design on the Coverage page's floor (as that page last left it). A PA design takes its music balance
 * in its band Levels.
 */
export function spaceFromStart(start: StackStart, pa: PaPlannerDesign): SpaceDesign {
  const floor = fromStored(readStoredJson<StoredCoverageLayout>(COVERAGE_LAYOUT_KEY, {}));
  const read = startLayers(
    start,
    { id: DRAFT_SPACE_ID, name: STACK_START_DESIGN_NAMES[start] },
    { pa, floor },
  );
  return { space: read.space, stacks: [read.stack], speakers: read.speakers };
}

/** One grid for the worker: the request, and the frequency its band's target is read at, Hz. */
interface GridJob {
  req: Omit<SpaceGridRequest, "cols">;
  centerHz: number;
}

/**
 * The mean of a request's levels at the spots, dB, skipping levels that aren't finite; null when none is (no spots, or
 * nothing reaches them).
 */
function oneMeterAverage(req: Omit<SpaceGridRequest, "cols">, spots: readonly FloorPoint[]) {
  const levels = spots.map((p) => spaceLevelAt(req, p)).filter(Number.isFinite);
  return levels.length ? levels.reduce((a, b) => a + b, 0) / levels.length : null;
}

/** Where a level reference reads: the listener, the spots 1 m in front of the placements, and the boxes' spots. */
interface ReferenceSpots {
  /** the listener's spot; null when the reference is not the listener (so moving the listener moves nothing else) */
  listener: FloorPoint | null;
  meterSpots: readonly FloorPoint[];
  /** the boxes' spots: the audience average leaves the floor right in front of them out (as on the coverage page) */
  boxes: readonly FloorPoint[];
}

/**
 * A request's level at the limit at the reference, as the coverage page reads it, dB: the audience average over the
 * grid's floor (needs `grid`; null without it), the level at the listener, or the mean of the 1 m spots. Null when
 * nothing reaches it. Only the listener's own reference reads the listener.
 */
export function referenceAtLimit(
  levelRef: CoverageLevelRef,
  req: Omit<SpaceGridRequest, "cols">,
  spots: ReferenceSpots,
  grid: CoverageGrid | null,
): number | null {
  if (levelRef === COVERAGE_LEVEL_REF.listener)
    return spots.listener && spaceLevelAt(req, spots.listener);
  if (levelRef === COVERAGE_LEVEL_REF.stacks) return oneMeterAverage(req, spots.meterSpots);
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
export function useSpace() {
  const [design, setDesign] = useState<SpaceDesign>(emptySpace);
  const [band, setBand] = useState<CoverageBand>("mid");
  const [freqHz, setFreqHz] = useState(63);
  const { space } = design;
  const { venue } = space;
  // the model reads the placements, the room, the stacks and the speakers, a step behind the typing
  const placements = useDeferredValue(space.placements);
  const room = useDeferredValue(venue.room);
  const stacks = useDeferredValue(design.stacks);
  const speakers = useDeferredValue(design.speakers);
  const model = useMemo(
    () =>
      spaceModel({
        space: { ...space, placements, venue: { ...venue, room } },
        stacks,
        speakers,
      }),
    // the model reads only these (the name, the listener and the target don't move it)
    [placements, room, stacks, speakers],
  );
  const req = useMemo<Omit<SpaceGridRequest, "cols">>(
    () => spaceGridRequest(model, { room, earFt: venue.earFt }, band, freqHz, COVERAGE_GRID_COLS),
    [model, room, venue.earFt, band, freqHz],
  );
  /** the boxes' spots: the stats leave the floor right in front of them out */
  const spots = useMemo(
    () => model.placements.map((p) => ({ x: p.item.placement.x, y: p.item.placement.y })),
    [model],
  );

  // the worker queue: one job at a time, and only the newest waiting job is kept (as the coverage page's)
  // each job carries the frequency its band's target is read at, so a grid on show keeps its own band's target
  const [shown, setShown] = useState<(GridJob & { grid: CoverageGrid }) | null>(null);
  const [failed, setFailed] = useState<{ req: typeof req; message: string } | null>(null);
  const busy = useRef(false);
  const want = useRef<GridJob | null>(null);
  const pump = () => {
    if (busy.current || !want.current) return;
    const next = want.current;
    want.current = null;
    busy.current = true;
    runSpaceGrid({ ...next.req, cols: COVERAGE_GRID_COLS })
      .then(
        (grid) => {
          setShown({ ...next, grid });
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
  useEffect(() => {
    if (!placed) return;
    want.current = { req, centerHz: bandCenterHz(band, freqHz) };
    pump();
  }, [req, placed]);

  // where the target is measured, and the music balance it follows across the bands (lib/speaker/spaceBalance)
  const { levelRef, balance } = venue;
  const crossovers = useMemo(
    () => spaceCrossoversHz({ space: { ...space, placements }, stacks, speakers }),
    // the crossovers read only these
    [placements, stacks, speakers],
  );
  /** the target in the band on show */
  const target = spaceTargetAt(venue.targetDb, bandCenterHz(band, freqHz), crossovers, balance);
  const listenerAtLimit = useMemo(
    () => (placed ? spaceLevelAt(req, venue.listener) : null),
    [placed, req, venue.listener],
  );
  /** the spots 1 m in front of each placement that holds a modeled stack or speaker */
  const meterSpots = useMemo(
    () =>
      oneMeterSpots({ space: { ...space, placements } }, room).filter(
        (_, k) => model.placements[k]?.response,
      ),
    // the spots read the placements, the room and which placements the model holds
    [placements, room, model],
  );
  /** the listener's spot when it is the reference; null otherwise, so the other references ignore the listener */
  const refListener = levelRef === COVERAGE_LEVEL_REF.listener ? venue.listener : null;
  /** a request's level at the limit at the reference, when points alone give it (not the audience average) */
  const pointRefAtLimit = (r: Omit<SpaceGridRequest, "cols">) =>
    referenceAtLimit(levelRef, r, { listener: refListener, meterSpots, boxes: spots }, null);
  const refAtLimit = useMemo(
    () => (placed ? pointRefAtLimit(req) : null),
    // the reference reads these
    [placed, req, levelRef, refListener, meterSpots],
  );
  // the grid on show: the audience's average at the limit, and the gain that brings the reference to the target
  const audienceAtLimit = useMemo(
    () => (shown && placed ? audienceAverage(shown.grid, shown.req.room, spots) : null),
    [shown, placed, spots],
  );
  const fromGrid = levelRef === COVERAGE_LEVEL_REF.audience;
  // the grid on show with the target and gain of the band it belongs to (an older band's while the next computes)
  const view = useMemo<CoverageGridView | null>(() => {
    if (!shown || !placed) return null;
    const atLimit = fromGrid
      ? audienceAtLimit
      : shown.req === req
        ? refAtLimit
        : pointRefAtLimit(shown.req);
    const t = spaceTargetAt(venue.targetDb, shown.centerHz, crossovers, balance);
    const g = systemGain(t, atLimit);
    return { grid: shown.grid, room: shown.req.room, target: t - g, gain: g, atLimit };
    // the reference reads these (an older grid's, the listener or the 1 m spots too)
  }, [
    shown,
    placed,
    fromGrid,
    audienceAtLimit,
    req,
    refAtLimit,
    refListener,
    meterSpots,
    venue.targetDb,
    crossovers,
    balance,
  ]);
  // the audience average needs the grid, so its gain and target follow the grid on show, never mixing that grid's
  // average with the current band's target (as the coverage page's)
  const currentAtLimit = fromGrid ? (view ? view.atLimit : null) : refAtLimit;
  const refTarget = fromGrid && view ? view.target + view.gain : target;
  const stats = useMemo(
    () => (view ? coverageStats(view.grid, view.room, spots, view.target) : null),
    [view, spots],
  );
  const gain = fromGrid ? (view ? view.gain : 0) : systemGain(target, currentAtLimit);
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
  /** the placement a map drag moves: the one a mirrored copy follows */
  const leadOf = (k: number) => placementLead(space.placements, k);
  const isFollower = (k: number) => leadOf(k) !== k;
  const editVenue = (edit: (v: SpaceVenue) => SpaceVenue) =>
    editSpace((s) => ({ ...s, venue: edit(s.venue) }));
  return {
    design,
    setDesign,
    model,
    view,
    stats,
    gain,
    band,
    setBand,
    freqHz,
    setFreqHz,
    isPending: placed && !(failed && failed.req === req) && (!shown || shown.req !== req),
    error: failed ? failed.message : "",
    listenerDb: listenerAtLimit !== null ? listenerAtLimit + gain : null,
    /** the audience's average at the space's level (null until a grid arrives) */
    audienceDb: audienceAtLimit !== null ? audienceAtLimit + gain : null,
    audienceAtLimit,
    /** the target in the band on show, where it is measured, and the reference's level at the space's level */
    target,
    levelRef,
    balance,
    /** the target the reference's level is held to: the shown grid's band's, for the audience average */
    refTarget,
    refDb: currentAtLimit !== null ? currentAtLimit + gain : null,
    bandLevels,
    response,
    targetCurve,
    store,
    snapshot: () => spaceSnapshot(design),
    /** opens a saved space: the document's id and name, its placements, venue, stacks and speakers */
    restore: (c: SavedConfig) => {
      const saved = spaceFromSaved(c);
      if (saved) setDesign(saved);
      else store.flash(MISSING_SPACE_TEXT);
    },
    setName: (name: string) => editSpace((s) => ({ ...s, name })),
    editVenue,
    editPlacement,
    isFollower,
    /** places a Place choice's item at the new spot, its speakers copied into the space */
    place: (item: PlaceItem) => setDesign((d) => withItemPlaced(d, item)),
    /** adds placement `k`'s mirror image across the center line, following it */
    addMirrorPair: (k: number) =>
      editPlacements((list) => withFollows([...list, list[k]], list.length, k)),
    /** sets placement `k` to follow placement `follows`, or to stand on its own (null), where it stands */
    setFollows: (k: number, follows: SpacePlacement["follows"]) =>
      editPlacements((list) => withFollows(list, k, follows)),
    /** removes a placement; a stack or speaker nothing places any more stays (the save keeps only what is placed) */
    removePlacement: (k: number) => editPlacements((list) => withoutPlacement(list, k)),
    /** moves a placement on the floor (a follower moves the one it follows, mirrored) */
    movePlacement: (k: number, p: FloorPoint) => {
      const j = leadOf(k);
      const to = onFloor(j === k ? p : { x: -p.x, y: p.y }, venue.room);
      editPlacement(j, (o) => ({ ...o, ...to }));
    },
    /** turns a placement to face `p` on the floor (a follower turns the one it follows, mirrored) */
    aimPlacement: (k: number, p: FloorPoint) => {
      const at = resolvedPlacement(space.placements, k);
      const deg = (Math.atan2(p.x - at.x, p.y - at.y) * 180) / Math.PI;
      const yawDeg = Math.round(Math.max(-SPACE_YAW_DEG, Math.min(SPACE_YAW_DEG, deg)));
      const j = leadOf(k);
      editPlacement(j, (o) => ({
        ...o,
        aim: { ...o.aim, yawDeg: j === k ? yawDeg : -yawDeg },
      }));
    },
    moveListener: (p: FloorPoint) => editVenue((v) => ({ ...v, listener: onFloor(p, v.room) })),
    /**
     * sets the delay and level of placement `k` (its lead, with its mirrored copy following) to play with placement `to`
     * and its copy at the listener, a little after them (lib/speaker/fillAlign); false when there is nothing to align to
     */
    alignTo: (k: number, to: number) => {
      const aligned = fillAlignment(model, venue, space.placements, k, to);
      if (aligned)
        editPlacement(aligned.placement, (p) => ({
          ...p,
          levelDb: aligned.levelDb,
          delayMs: aligned.delayMs,
        }));
      return aligned !== null;
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
