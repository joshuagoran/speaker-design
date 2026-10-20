// The space model: every placement's stack in the room, summed across the floor on the coverage engine
// (lib/acoustics/coverage: the floor bounce, the walls and ceiling by their materials, the diffuse field and the room's modes).
// Each placement plays its stack's response (lib/speaker/stackResponse: each member's speaker through its crossover,
// level and delay), with each band's amp power from its speaker; each driver spot radiates its band's share with its own
// coverage, at its place and along its aim (lib/speaker/spaceLayout); each cone band has its baffle step (the speaker
// model is half-space; the floor image puts the floor back). Pure.
//
// A horn-loaded box's mouth and vent exit take their load from where the box stands (lib/speaker/spaceLoading, from
// what it is coupled with, lib/speaker/spaceCoupling); every other box plays as it does alone.
//
// Each placement's own delay and level are its solved ones (lib/speaker/solveFeeds: Auto ones from the layout, the rest
// as typed).
//
// The whole space plays from one input. At its music limit the placement with the least headroom (less its level) sets
// the level; the page then turns it down so the reference (the audience's average) gets the target, never past the limit.
import type {
  BandId,
  BoxLoading,
  Complex,
  CoverageBand,
  CoverageGrid,
  FloorPoint,
  FrequencyPoint,
  SpaceDesign,
  SpaceVenue,
  StackLimits,
  StackResponse,
} from "../../types";
import {
  coverageFrequencies,
  coverageGrid,
  levelAtPoint,
  RESPONSE_FREQS,
  sceneOf,
  sceneSlots,
  slotResponse,
  type CoveragePattern,
  type CoverageScene,
  type CoverageSlot,
  type CoverageVoice,
  type SceneDriver,
} from "../acoustics/coverage";
import { baffleStepShelf } from "../acoustics/directivity";
import { abs } from "../acoustics/complex";
import { coaxParts, FILL_OPTIONS, hifiDriverById } from "../data";
import { byId } from "../tables";
import { stackLimits, stackResponse } from "./stackResponse";
import {
  chamberCones,
  hfBandOf,
  passbandDb,
  SPEAKER_RESPONSE_FREQUENCIES,
} from "./speakerResponse";
import { coneParts, isConeKind } from "./driverParts";
import { driverHorn, speakerLayout } from "./speakerLayout";
import { spaceLayout, type BandOfPart, type PlacedDriver, type PlacedItem } from "./spaceLayout";
import { spaceCoupling } from "./spaceCoupling";
import { boxLoadings } from "./spaceLoading";
import { typedFeed, type SolvedFeed } from "./solveFeeds";
import { DRIVER_KIND } from "../../constants/speakerSpec";
import { DRIVER_PART } from "../../constants/space";
import { COAX_HF_EXIT_IN } from "../../constants/coax";
import { METERS_PER_FOOT, METERS_PER_INCH, SQ_CM_PER_SQ_M } from "../../constants/units";

/** The band a driver part feeds, as the speaker model feeds it: a cone its chamber's first cone's first band. */
export const bandOfPart: BandOfPart = (chamber, driver, part) =>
  part === DRIVER_PART.cone
    ? isConeKind(driver.kind)
      ? (chamberCones(chamber)?.first.bands[0] ?? null)
      : null
    : hfBandOf(driver);

/** A piston of `diaIn` inches across. */
const piston = (diaIn: number): CoveragePattern => ({ a: (diaIn / 2) * METERS_PER_INCH });

/**
 * How a driver spot spreads its sound: a horn-loaded chamber's mouth or a cone as a piston of its area; an HF section
 * on a horn or waveguide (its own, as a ribbon's plate or a coaxial's cone) by that horn's coverage and mouth, or else a
 * piston of its exit (a bare 1″ exit where the catalog gives none).
 */
export function driverPattern(d: Pick<PlacedDriver, "driver" | "part" | "mouth">): CoveragePattern {
  const { driver } = d;
  if (d.mouth) return { a: Math.sqrt((d.mouth.w * d.mouth.h) / Math.PI) * METERS_PER_INCH };
  if (d.part === DRIVER_PART.cone) {
    const parts = coneParts(driver);
    return { a: parts ? Math.sqrt(parts.ts.Sd / SQ_CM_PER_SQ_M / Math.PI) : 0 };
  }
  const horn = driverHorn(driver);
  if (horn?.hf)
    return {
      horn: {
        covH: horn.hf.covH,
        covV: horn.hf.covV || horn.hf.covH,
        wIn: horn.size.w,
        hIn: horn.size.h,
      },
    };
  const coax =
    driver.kind === DRIVER_KIND.coaxial ? byId(FILL_OPTIONS, driver.driverId) : undefined;
  const tweeter =
    driver.kind === DRIVER_KIND.tweeter
      ? hifiDriverById("tweeter", driver.driverId)
      : coax && coaxParts(coax).tweeter;
  if (tweeter?.ownGuide) {
    const { covH, covV, w, h } = tweeter.ownGuide;
    return { horn: { covH, covV, wIn: w, hIn: h } };
  }
  return piston(tweeter ? tweeter.domeIn : COAX_HF_EXIT_IN);
}

/** One box in the model (a mirrored pair is two, `expandPlacements`): laid out, its stack's response and limits, and its headroom. */
export interface SpacePlacementModel {
  item: PlacedItem;
  response: StackResponse | null;
  limits: StackLimits | null;
  /** its input's headroom to its music limit over its response, dB (null: no limit known) */
  headroomDb: number | null;
}

/** What a voice plays: its band's pressure at 1 m (one per speaker-model frequency), its level, delay, baffle and share. */
interface VoiceFeed extends CoverageVoice {
  /** the placement it belongs to (its index in the space, shared by a mirrored pair's boxes), and the band it plays */
  placement: number;
  band: BandId;
  pressure: readonly Complex[];
  /** the member's level and the placement's, dB */
  gainDb: number;
  /** of that level, the member's, dB */
  memberLevelDb: number;
  /** the member's delay and the placement's, ms */
  delayMs: number;
  /** of that delay, the member's: the stack's own alignment, ms */
  memberDelayMs: number;
  /** the baffle's width for a cone band's baffle step, in; null for an HF section */
  baffleWIn: number | null;
  /** the band's share each of its spots plays: one over their count */
  share: number;
}

/** The space worked out: each placement, the scene to sum, what each voice plays, and the space's headroom. */
export interface SpaceModel {
  /** each box placed, in the placements' order, a mirrored pair as two */
  placements: SpacePlacementModel[];
  scene: CoverageScene;
  feeds: VoiceFeed[];
  /** each placement's delay and level (by its index in the space; a mirrored pair is one), as the solver sets them */
  solved: SolvedFeed[];
  /** the space's input headroom at its music limit, dB: the least of its placements', less their levels; 0 unknown */
  headroomDb: number;
  /** a placement names a stack or speaker the design lacks */
  missing: boolean;
  /** what each box stands right against, in `placements`' order, with the marks the plan draws */
  coupling: ReturnType<typeof spaceCoupling>;
}

/** Milliseconds in a second. */
const MS_PER_S = 1000;

/** An angle wrapped to ±π. */
const wrapAngle = (a: number) => a - 2 * Math.PI * Math.round(a / (2 * Math.PI));

/** A pressure on the speaker model's frequencies read at `f`: its level and phase between grid points on log frequency. */
export function pressureAt(ps: readonly Complex[], f: number): Complex {
  const freqs = SPEAKER_RESPONSE_FREQUENCIES;
  const n = freqs.length;
  if (f <= freqs[0]) return ps[0];
  if (f >= freqs[n - 1]) return ps[n - 1];
  let lo = 0,
    hi = n - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (freqs[m] <= f) lo = m;
    else hi = m;
  }
  const t = Math.log(f / freqs[lo]) / Math.log(freqs[hi] / freqs[lo]);
  const a = ps[lo],
    b = ps[hi],
    ma = abs(a),
    mb = abs(b);
  if (!ma || !mb) return { re: a.re + (b.re - a.re) * t, im: a.im + (b.im - a.im) * t };
  const pa = Math.atan2(a.im, a.re);
  const mag = ma * Math.pow(mb / ma, t),
    ph = pa + t * wrapAngle(Math.atan2(b.im, b.re) - pa);
  return { re: mag * Math.cos(ph), im: mag * Math.sin(ph) };
}

/**
 * A placement's stack at its speakers' amp powers, each member's horn on its `loading`: its response and limits (null
 * when the design lacks what it places).
 */
function placementModel(
  item: PlacedItem,
  loading: readonly (BoxLoading | undefined)[],
  cache: Map<string, Pick<SpacePlacementModel, "response" | "limits">>,
): SpacePlacementModel {
  if (!item.stack) return { item, response: null, limits: null, headroomDb: null };
  const { placement } = item;
  // what moves the model: the item and its horns' loading (boxes alike and loaded alike share it, as a mirrored pair)
  const key = JSON.stringify([placement.item, loading]);
  let run = cache.get(key);
  if (!run) {
    const { stack, speakers } = item.stack;
    const response = stackResponse(stack, speakers, loading);
    run = { response, limits: stackLimits(stack, response) };
    cache.set(key, run);
  }
  const { response, limits } = run;
  const live = response && response.members.some((m) => m !== null);
  const headroomDb =
    live && limits && limits.musicDb !== null ? limits.musicDb - passbandDb(response.sum) : null;
  return { item, response, limits, headroomDb };
}

/**
 * The model with each placement playing `solved` (by its index in the space): its feeds' delays and levels, and the
 * space's headroom (the least of its placements', less their levels).
 */
export function withSolved(model: SpaceModel, solved: SolvedFeed[]): SpaceModel {
  const rooms = model.placements.flatMap((p) =>
    p.headroomDb === null ? [] : [p.headroomDb - (solved[p.item.placement.source]?.levelDb ?? 0)],
  );
  return {
    ...model,
    feeds: model.feeds.map((f) => ({
      ...f,
      delayMs: f.memberDelayMs + (solved[f.placement]?.delayMs ?? 0),
      gainDb: f.memberLevelDb + (solved[f.placement]?.levelDb ?? 0),
    })),
    solved,
    headroomDb: rooms.length ? Math.min(...rooms) : 0,
  };
}

/**
 * The space worked out with each placement's typed delay and level, Auto ones at 0 (what the solver reads; `withSolved`
 * sets the solved ones). Moving the listener or the alignment point doesn't change it.
 */
export function spaceModelLaidOut(design: SpaceDesign): SpaceModel {
  const cache = new Map<string, Pick<SpacePlacementModel, "response" | "limits">>();
  const items = spaceLayout(design, bandOfPart);
  const coupling = spaceCoupling(items, design.space.venue.room);
  const loadings = boxLoadings(items, coupling.boxes);
  const placements = items.map((item, k) => placementModel(item, loadings[k] ?? [], cache));
  const feeds = new Map<string, VoiceFeed>();
  const boxes = placements.map(({ item, response }, k): SceneDriver[] => {
    if (!response) return [];
    const { placement } = item;
    /** how many spots feed each of a member's bands */
    const spots = new Map<string, number>();
    for (const d of item.drivers) {
      const key = `${d.member}/${d.band}`;
      spots.set(key, (spots.get(key) ?? 0) + 1);
    }
    return item.drivers.flatMap((d): SceneDriver[] => {
      const member = response.members[d.member];
      const band = member?.response.bands.find((b) => b.id === d.band);
      if (!member || !band) return [];
      const pattern = driverPattern(d);
      const id = `${k}/${d.member}/${d.band}/${JSON.stringify(pattern)}`;
      if (!feeds.has(id))
        feeds.set(id, {
          placement: placement.source,
          band: d.band,
          id,
          pattern,
          pressure: band.pressure,
          // the placement's own level and delay are added by `withSolved`
          gainDb: 0,
          memberLevelDb: item.stack ? item.stack.stack.members[d.member].levelDb : 0,
          delayMs: 0,
          memberDelayMs: member.delayMs,
          baffleWIn: d.part === DRIVER_PART.cone ? speakerLayout(d.speaker.cabinet).size.w : null,
          share: 1 / (spots.get(`${d.member}/${d.band}`) ?? 1),
        });
      return [
        {
          voice: id,
          x: d.at.x * METERS_PER_FOOT,
          y: d.at.y * METERS_PER_FOOT,
          z: d.at.z * METERS_PER_FOOT,
          yaw: d.yaw,
          pitch: d.pitch,
          // the stack's delays already align its members; a speaker's bands play together (the speaker model's sum)
          alignM: 0,
        },
      ];
    });
  });
  const list = [...feeds.values()];
  // each placement at its typed delay and level, Auto ones at 0
  return withSolved(
    {
      placements,
      scene: sceneOf(
        design.space.venue.room,
        list.map(({ id, pattern }) => ({ id, pattern })),
        boxes,
      ),
      feeds: list,
      solved: [],
      headroomDb: 0,
      missing: placements.some((p) => !p.item.stack || p.response?.members.some((m) => m === null)),
      coupling,
    },
    design.space.placements.map(typedFeed),
  );
}

/** Each voice's output at 1 m at `f`, the space at its music limit: its band's share, level, delay and baffle step. */
export function spaceOutputs(model: SpaceModel, f: number): CoverageSlot["out"] {
  const out: CoverageSlot["out"] = {};
  for (const v of model.feeds) {
    const p = pressureAt(v.pressure, f);
    let mag = abs(p) * Math.pow(10, (v.gainDb + model.headroomDb) / 20) * v.share,
      ph = Math.atan2(p.im, p.re) - (2 * Math.PI * f * v.delayMs) / MS_PER_S;
    if (v.baffleWIn !== null) {
      const shelf = baffleStepShelf(f, v.baffleWIn);
      mag *= abs(shelf);
      ph += Math.atan2(shelf.im, shelf.re);
    }
    out[v.id] = { re: mag * Math.cos(ph), im: mag * Math.sin(ph) };
  }
  return out;
}

/** What the floor map's worker computes from: the scene, each frequency's outputs, the room's floor and the ear. */
export interface SpaceGridRequest {
  scene: CoverageScene;
  freqs: number[];
  /** each frequency's share of the band average's weight (`coverageFrequencies`) */
  shares: number[];
  coherent: boolean;
  outputs: CoverageSlot["out"][];
  room: Pick<SpaceVenue["room"], "widthFt" | "lengthFt">;
  earFt: SpaceVenue["earFt"];
  cols: number;
}

/** The floor map's request in a band (or at one frequency), `cols` cells across. */
export function spaceGridRequest(
  model: SpaceModel,
  venue: Pick<SpaceVenue, "room" | "earFt">,
  band: CoverageBand,
  freqHz: number,
  cols: number,
): SpaceGridRequest {
  const { freqs, shares, coherent } = coverageFrequencies(
    band,
    freqHz,
    model.scene.modal?.crossoverHz ?? null,
  );
  return {
    scene: model.scene,
    freqs,
    shares,
    coherent,
    outputs: freqs.map((f) => spaceOutputs(model, f)),
    room: { widthFt: venue.room.widthFt, lengthFt: venue.room.lengthFt },
    earFt: venue.earFt,
    cols,
  };
}

/** The slots a request sums. */
const requestSlots = (req: Omit<SpaceGridRequest, "room" | "cols" | "earFt">) =>
  sceneSlots(req.scene, req.freqs, req.coherent, (_, i) => req.outputs[i], req.shares);

/** The floor map for a request: what the worker runs. The space at its music limit, dB SPL. */
export const computeSpaceGrid = (req: SpaceGridRequest): CoverageGrid =>
  coverageGrid(req.scene, requestSlots(req), req.room, req.earFt, req.cols);

/** A request's level at one spot (ft), at ear height: what its grid shows there, at the music limit. */
export const spaceLevelAt = (req: Omit<SpaceGridRequest, "cols">, at: FloorPoint): number =>
  levelAtPoint(
    req.scene,
    requestSlots(req),
    at.x * METERS_PER_FOOT,
    at.y * METERS_PER_FOOT,
    req.earFt * METERS_PER_FOOT,
  );

/** The response at a spot (ft), at ear height, each frequency summed as a band average sums it; at the music limit. */
export const spaceResponse = (
  model: SpaceModel,
  venue: Pick<SpaceVenue, "earFt">,
  at: FloorPoint,
): FrequencyPoint[] =>
  slotResponse(
    model.scene,
    sceneSlots(model.scene, RESPONSE_FREQS, false, (f) => spaceOutputs(model, f)),
    at,
    venue.earFt,
  );
