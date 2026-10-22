// The dispersion map of a speaker or a stack (the Speaker and Stack pages): level
// against angle and frequency, relative to on axis, on the shared grid (−90 to +90°, 50 Hz to 20 kHz). Pure.
//
// Each driver spot radiates its band's share as the stack model plays it (lib/speaker/stackResponse: each member's
// speaker through its crossover, its level, polarity and delay), with a cone's baffle step as the Space page has it
// (lib/speaker/spaceCoverage `radiatedAt`), with its own coverage (spaceCoverage driverPattern: a cone as a piston, a
// horn-loaded chamber's mouth by its size and walls, a horn or waveguide by its rated coverage), at its place in the
// stack and along its axis (lib/speaker/spaceLayout: its member's aim, turned for a mouth that opens in the back, top or
// bottom). A horn-loaded chamber radiates from its mouth alone. Its level off its axis, behind its box too, is the
// Space page's (lib/acoustics/coverage `directivityAt`, `directivityGain`, `offAxis`). The arc
// is DISPERSION_DISTANCE_M out from the middle of the stack's front at its listening height (the highest band's
// center, as the stack model's listening point): horizontal at that height, vertical below (−) to above (+) it. Each
// spot's path sets its level (1/r) and its time against the arc's radius, as the stack model does at its listening
// point. Not modeled: the room, diffraction.
import type {
  BandId,
  DispersionPlane,
  HifiDispersionMap,
  SpeakerSpec,
  StackMemberResponse,
  StackResponse,
  StackSpec,
} from "../../types";
import { dispersionGrid } from "../acoustics/directivity";
import {
  arrival,
  directivityAt,
  directivityGain,
  offAxis,
  sourceAxis,
} from "../acoustics/coverage";
import { CHAMBER_LOAD } from "../../constants/speakerSpec";
import { add, complex, levelDb } from "../acoustics/complex";
import { bandOfPart, driverPattern, radiatedAt, spotBaffleWIn, spotBoxWIn } from "./spaceCoverage";
import { layStack } from "./spaceLayout";
import { memberGain, stackCrossoversHz } from "./stackResponse";
import { bandCenters } from "./stackLayout";
import { stackMember } from "./specParts";
import { speakerLayout } from "./speakerLayout";
import { hornMouth } from "./hornMouth";
import { DISPERSION_DISTANCE_M } from "../../constants/chartScales";
import { METERS_PER_FOOT, METERS_PER_INCH, MS_PER_S, RAD } from "../../constants/units";

/** The stack laid out where its own frame is the room's: its base's front center on the floor's origin, unturned. */
const OWN_POSE = {
  x: 0,
  y: 0,
  liftIn: 0,
  aim: { yawDeg: 0, pitchDeg: 0 },
  image: false,
  upsideDown: false,
};

/** What the map reads of the stack model: each member's response and delay, and the listening height. */
export type DispersionModel = Pick<StackResponse, "listenHeightIn"> & {
  members: readonly (Pick<StackMemberResponse, "response" | "delayMs"> | null)[];
};

/**
 * The map of a stack (a speaker alone is a stack of one on its input range), from its model (`stackResponse`, or the
 * Speaker page's response as one member), in `plane`.
 */
export function stackDispersionMap(
  stack: Pick<StackSpec, "members">,
  speakers: readonly SpeakerSpec[],
  model: DispersionModel,
  plane: DispersionPlane,
): HifiDispersionMap {
  const { angles, freqs } = dispersionGrid();
  const { drivers } = layStack({ stack, speakers }, OWN_POSE, bandOfPart);
  /** how many spots feed each member's band: each plays its share */
  const spots = new Map<string, number>();
  const key = (member: number, band: BandId) => `${member}/${band}`;
  for (const d of drivers)
    spots.set(key(d.member, d.band), (spots.get(key(d.member, d.band)) ?? 0) + 1);
  const sources = drivers.flatMap((d) => {
    const m = model.members[d.member];
    const band = m?.response.bands.find((b) => b.id === d.band);
    if (!m || !band) return [];
    const gain = memberGain(stack.members[d.member]);
    return [
      {
        // across, forward and up, m
        x: d.at.x * METERS_PER_FOOT,
        y: d.at.y * METERS_PER_FOOT,
        z: d.at.z * METERS_PER_FOOT,
        axis: sourceAxis(d.yaw, d.pitch),
        pattern: driverPattern(d),
        boxWIn: spotBoxWIn(d),
        baffleWIn: spotBaffleWIn(d),
        gain: gain / (spots.get(key(d.member, d.band)) ?? 1),
        delayS: m.delayMs / MS_PER_S,
        pressure: band.pressure,
      },
    ];
  });
  const D = DISPERSION_DISTANCE_M;
  const axisZ = model.listenHeightIn * METERS_PER_INCH;
  /** a point on the arc at `deg`, m: across, forward and up */
  const arcPoint = (deg: number) =>
    plane === "h"
      ? { x: D * Math.sin(deg * RAD), y: D * Math.cos(deg * RAD), z: axisZ }
      : { x: 0, y: D * Math.cos(deg * RAD), z: axisZ + D * Math.sin(deg * RAD) };
  /** each source's pressure and directivity at each frequency */
  const feeds = sources.map((s) => freqs.map((f) => radiatedAt(s.pressure, f, s.baffleWIn)));
  const directivity = sources.map((s) => freqs.map((f) => directivityAt(s.pattern, f, s.boxWIn)));
  const levelsAt = (deg: number) => {
    const p = arcPoint(deg);
    const paths = sources.map((s) => {
      const dx = p.x - s.x,
        dy = p.y - s.y,
        dz = p.z - s.z;
      return { r: Math.hypot(dx, dy, dz), ...offAxis(dx, dy, dz, s.axis) };
    });
    return freqs.map((f, i) => {
      let sum = complex(0);
      sources.forEach((s, k) => {
        const { r, th, tv } = paths[k];
        const gain = s.gain * directivityGain(directivity[k][i], th, tv);
        sum = add(sum, arrival(feeds[k][i], f, gain, r, D, s.delayS));
      });
      return levelDb(sum);
    });
  };
  const on = levelsAt(0);
  const rows = angles.map((deg) => (deg === 0 ? on : levelsAt(deg)).map((v, i) => v - on[i]));
  return { angles, freqs, rows, crossovers: stackCrossoversHz(stack, speakers) };
}

/**
 * Whether the map models these speakers: every horn-loaded chamber has a mouth it radiates from (lib/speaker/hornMouth).
 * Not yet a back-loaded horn (its mouth and its cones both radiate) or a folded horn with no drawing (its cones would
 * stand in for its mouth, so the map would be wrong).
 */
export const dispersionModeled = (speakers: readonly Pick<SpeakerSpec, "cabinet">[]) =>
  speakers.every((s) =>
    speakerLayout(s.cabinet).chambers.every(
      (placed) =>
        placed.chamber.load.kind !== CHAMBER_LOAD.horn || hornMouth(s.cabinet, placed) !== null,
    ),
  );

/**
 * The map of one speaker on its input range (the Speaker page's), from its response: a stack of one at the base, its
 * listening height its highest band's center.
 */
export function speakerDispersionMap(
  spec: SpeakerSpec,
  response: StackMemberResponse["response"],
  plane: DispersionPlane,
): HifiDispersionMap {
  const centers = bandCenters(spec).map((b) => b.y);
  return stackDispersionMap(
    { members: [stackMember(spec.id, spec.input)] },
    [spec],
    {
      members: [{ response, delayMs: 0 }],
      listenHeightIn: centers.length ? Math.max(...centers) : 0,
    },
    plane,
  );
}
