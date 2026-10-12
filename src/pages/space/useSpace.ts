import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useConfigStore } from "../../components/saved-configs/useConfigStore";
import { audienceAverage, coverageStats, COVERAGE_GRID_COLS } from "../../lib/pa/coverage";
import {
  spaceGridRequest,
  spaceLevelAt,
  spaceModel,
  spaceResponse,
  type SpaceGridRequest,
} from "../../lib/speaker/spaceCoverage";
import { resolvedPlacement } from "../../lib/speaker/spaceLayout";
import { numberChannels } from "../../lib/speaker/spaceHardware";
import { runSpaceGrid } from "../../lib/speaker/runSpace";
import { startLayers } from "../stack/stackPresets";
import { STACK_START_NAMES, type StackStart } from "../../constants/stackPresets";
import { spacePlacement } from "../../lib/speaker/specParts";
import { readStoredJson } from "../../lib/storage";
import { withSpeaker } from "../stack/useStack";
import { fromStored, type StoredCoverageLayout } from "../coverage/useCoverageLayout";
import { COVERAGE_LAYOUT_KEY } from "../../constants/coverageTestIds";
import type { RoomActions } from "../../components/ui/RoomFields";
import { SPACES_COLLECTION, SPACE_ITEM } from "../../constants/speakerSpec";
import { SPACE_YAW_DEG } from "../../constants/space";
import { DRAFT_SPACE_ID, emptySpace, spaceFromSaved, spaceSnapshot } from "./spaceSaves";
import type {
  CoverageBand,
  CoverageGrid,
  CoverageGridView,
  FloorPoint,
  ListeningArea,
  PaPlannerDesign,
  SavedConfig,
  SpaceAmp,
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

/** A listening area kept inside the room: no wider or longer than it, its edges on its floor. */
function areaInRoom(area: ListeningArea, room: SpaceVenue["room"]): ListeningArea {
  const widthFt = Math.min(area.widthFt, room.widthFt),
    lengthFt = Math.min(area.lengthFt, room.lengthFt);
  return {
    widthFt,
    lengthFt,
    x: clamp(area.x, -(room.widthFt - widthFt) / 2, (room.widthFt - widthFt) / 2),
    y: clamp(area.y, lengthFt / 2, room.lengthFt - lengthFt / 2),
  };
}

/**
 * A space kept inside its room (after the room changes size): each placement's spot on the floor (a follower's stored
 * spot too, so it lands inside when it goes on its own), the listener, and the listening area.
 */
export function fittedSpace(space: SpaceSpec): SpaceSpec {
  const { room } = space.venue;
  return {
    ...space,
    placements: space.placements.map((p) => inRoom(p, room)),
    venue: {
      ...space.venue,
      listener: inRoom(space.venue.listener, room),
      area: areaInRoom(space.venue.area, room),
    },
  };
}

/**
 * The placements with placement `k` set to follow placement `follows` (an earlier one), or to stand on its own (null).
 * Either way it keeps where it stands as it stands: on its own, where its lead put it; following, its lead's item, spot,
 * lift and aim mirrored, its channels dropped when its item changes (they fed the old item's bands).
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
  const sameItem = JSON.stringify(after.item) === JSON.stringify(before.item);
  return set.map((p, i) =>
    i === k ? { ...after, follows, channels: sameItem ? after.channels : [] } : p,
  );
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
    { id: DRAFT_SPACE_ID, name: STACK_START_NAMES[start] },
    { pa, floor },
  );
  return { space: read.space, stacks: [read.stack], speakers: read.speakers };
}

/**
 * The system's gain, dB: what brings the listening area's average (at the limit) down to the target, or 0 (the limit)
 * when it doesn't reach it.
 */
const systemGain = (target: number, atLimit: number | null) =>
  atLimit !== null ? Math.min(0, target - atLimit) : 0;

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
  // the model reads the placements, the amps, the room, the stacks and the speakers, a step behind the typing
  const placements = useDeferredValue(space.placements);
  const amps = useDeferredValue(space.amps);
  const room = useDeferredValue(venue.room);
  const stacks = useDeferredValue(design.stacks);
  const speakers = useDeferredValue(design.speakers);
  const model = useMemo(
    () =>
      spaceModel({
        space: { ...space, placements, amps, venue: { ...venue, room } },
        stacks,
        speakers,
      }),
    // the model reads only these (the name, the listener, the area and the target don't move it)
    [placements, amps, room, stacks, speakers],
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
  const [shown, setShown] = useState<{ grid: CoverageGrid; req: typeof req } | null>(null);
  const [failed, setFailed] = useState<{ req: typeof req; message: string } | null>(null);
  const busy = useRef(false);
  const want = useRef<typeof req | null>(null);
  const pump = () => {
    if (busy.current || !want.current) return;
    const next = want.current;
    want.current = null;
    busy.current = true;
    runSpaceGrid({ ...next, cols: COVERAGE_GRID_COLS })
      .then(
        (grid) => {
          setShown({ grid, req: next });
          setFailed(null);
        },
        (e: unknown) =>
          setFailed({ req: next, message: e instanceof Error ? e.message : String(e) }),
      )
      .finally(() => {
        busy.current = false;
        pump();
      });
  };
  const placed = model.scene.sources.length > 0;
  useEffect(() => {
    if (!placed) return;
    want.current = req;
    pump();
  }, [req, placed]);

  // the grid on show, with the gain that brings its listening area to the target
  const view = useMemo<CoverageGridView | null>(() => {
    if (!shown || !placed) return null;
    const atLimit = audienceAverage(shown.grid, shown.req.room, spots, venue.area);
    const gain = systemGain(venue.targetDb, atLimit);
    return {
      grid: shown.grid,
      room: shown.req.room,
      target: venue.targetDb - gain,
      gain,
      atLimit,
    };
  }, [shown, placed, spots, venue.area, venue.targetDb]);
  const stats = useMemo(
    () => (view ? coverageStats(view.grid, view.room, spots, view.target, venue.area) : null),
    [view, spots, venue.area],
  );
  const gain = view ? view.gain : 0;
  const listenerAtLimit = useMemo(
    () => (placed ? spaceLevelAt(req, venue.listener) : null),
    [placed, req, venue.listener],
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
  const store = useConfigStore(SPACES_COLLECTION);

  /** every edit to the space: the channels renumbered after it */
  const editSpace = (edit: (s: SpaceSpec) => SpaceSpec) =>
    setDesign((d) => {
      const next = edit(d.space);
      return { ...d, space: { ...next, placements: numberChannels(next.placements) } };
    });
  const editPlacements = (edit: (list: readonly SpacePlacement[]) => SpacePlacement[]) =>
    editSpace((s) => ({ ...s, placements: edit(s.placements) }));
  const editPlacement = (k: number, edit: (p: SpacePlacement) => SpacePlacement) =>
    editPlacements((list) => list.map((p, i) => (i === k ? edit(p) : p)));
  /** the placement a map drag moves: the one a mirror pair's follower follows */
  const leadOf = (k: number): number => {
    const j = space.placements[k]?.follows;
    return j !== null && j !== undefined && j >= 0 && j < k ? leadOf(j) : k;
  };
  const isFollower = (k: number) => leadOf(k) !== k;
  const editVenue = (edit: (v: SpaceVenue) => SpaceVenue) =>
    editSpace((s) => ({ ...s, venue: edit(s.venue) }));
  /** places an item at the new spot, with no channels yet */
  const place = (d: SpaceDesign, item: SpacePlacement["item"]): SpaceDesign => ({
    ...d,
    space: {
      ...d.space,
      placements: [...d.space.placements, spacePlacement(NEW_SPOT, item, 0, [])],
    },
  });

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
    response,
    store,
    snapshot: () => spaceSnapshot(design),
    /** opens a saved space: the document's id and name, its placements, hardware, venue, stacks and speakers */
    restore: (c: SavedConfig) => {
      const saved = spaceFromSaved(c);
      if (saved) setDesign(saved);
      else store.flash(MISSING_SPACE_TEXT);
    },
    setName: (name: string) => editSpace((s) => ({ ...s, name })),
    editVenue,
    editPlacement,
    isFollower,
    addStack: (saved: StackDesign) =>
      setDesign((d) => {
        const copy = withStack(d, saved);
        return place(
          { ...d, stacks: copy.stacks, speakers: copy.speakers },
          { kind: SPACE_ITEM.stack, id: copy.stack.id },
        );
      }),
    addSpeaker: (speaker: SpeakerSpec) =>
      setDesign((d) => {
        const copy = withSpeaker(d.speakers, speaker);
        const held = d.speakers.some((s) => s.id === copy.id);
        return place(
          { ...d, speakers: held ? d.speakers : [...d.speakers, copy] },
          { kind: SPACE_ITEM.speaker, id: copy.id },
        );
      }),
    /** adds placement `k`'s mirror image across the center line, following it, on channels of its own (none yet) */
    addMirrorPair: (k: number) =>
      editPlacements((list) =>
        withFollows([...list, { ...list[k], channels: [] }], list.length, k),
      ),
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
    addAmp: (amp: Omit<SpaceAmp, "id">) =>
      editSpace((s) => {
        let n = s.amps.length + 1;
        while (s.amps.some((a) => a.id === `amp${n}`)) n++;
        return { ...s, amps: [...s.amps, { ...amp, id: `amp${n}` }] };
      }),
    editAmp: (i: number, edit: (a: SpaceAmp) => SpaceAmp) =>
      editSpace((s) => ({ ...s, amps: s.amps.map((a, j) => (j === i ? edit(a) : a)) })),
    /** removes an amp, and the channels it gave */
    removeAmp: (i: number) =>
      editSpace((s) => {
        const gone = s.amps[i]?.id;
        return {
          ...s,
          amps: s.amps.filter((_, j) => j !== i),
          placements: s.placements.map((p) => ({
            ...p,
            channels: p.channels.filter((c) => c.amp !== gone),
          })),
        };
      }),
    setFrontEnd: (frontEnd: SpaceSpec["frontEnd"]) => editSpace((s) => ({ ...s, frontEnd })),
  };
}

/** What `useSpace` returns. */
export type SpacePlanner = ReturnType<typeof useSpace>;
