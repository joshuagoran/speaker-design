// The dispersion map of a speaker or a stack (the Speaker and Stack pages): level
// against angle and frequency, relative to on axis, on the shared grid (−90 to +90°, 50 Hz to 20 kHz). Pure.
//
// Each driver spot radiates its band's share as the stack model plays it (lib/speaker/stackResponse: each member's
// speaker through its crossover, its level and delay), with its own coverage (lib/speaker/spaceCoverage driverPattern:
// a cone or a horn mouth as a piston, a horn or waveguide by its rated coverage), at its place in the stack and along
// its member's aim (lib/speaker/spaceLayout). The arc is DISPERSION_DISTANCE_M out from the middle of the stack's
// front at its listening height (the highest band's center, as the stack model's listening point): horizontal at that
// height, vertical below (−) to above (+) it. Each spot's path sets its level (1/r) and its time against the arc's
// radius, as the stack model does at its listening point. Not modeled: the room, the baffle step, diffraction.
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
import { CHAMBER_LOAD } from "../../constants/speakerSpec";
import { patternDirectivity } from "../acoustics/dispersion";
import { abs, add, complex, multiply, phasor, scale } from "../acoustics/complex";
import { bandOfPart, driverPattern, pressureAt } from "./spaceCoverage";
import { layStack, placementFrame } from "./spaceLayout";
import { stackCrossoversHz } from "./stackResponse";
import { bandCenters } from "./stackLayout";
import { stackMember } from "./specParts";
import { SPEED_OF_SOUND } from "../../constants/acoustics";
import { DISPERSION_DISTANCE_M } from "../../constants/chartScales";
import { METERS_PER_FOOT, METERS_PER_INCH, RAD } from "../../constants/units";

/** Milliseconds in a second. */
const MS_PER_S = 1000;

/** The stack laid out where its own frame is the room's: its base's front center on the floor's origin, unturned. */
const OWN_FRAME = placementFrame({
  x: 0,
  y: 0,
  liftIn: 0,
  aim: { yawDeg: 0, pitchDeg: 0 },
  mirror: false,
});

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
  const { drivers } = layStack({ stack, speakers }, OWN_FRAME, bandOfPart);
  /** how many spots feed each member's band: each plays its share */
  const spots = new Map<string, number>();
  const key = (member: number, band: BandId) => `${member}/${band}`;
  for (const d of drivers)
    spots.set(key(d.member, d.band), (spots.get(key(d.member, d.band)) ?? 0) + 1);
  const sources = drivers.flatMap((d) => {
    const m = model.members[d.member];
    const band = m?.response.bands.find((b) => b.id === d.band);
    if (!m || !band) return [];
    const gain = Math.pow(10, stack.members[d.member].levelDb / 20);
    return [
      {
        // across, forward and up, m
        x: d.at.x * METERS_PER_FOOT,
        y: d.at.y * METERS_PER_FOOT,
        z: d.at.z * METERS_PER_FOOT,
        pitch: d.pitch,
        pattern: driverPattern(d),
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
  /** each source's pressure at each frequency */
  const feeds = sources.map((s) => freqs.map((f) => pressureAt(s.pressure, f)));
  const levelsAt = (deg: number) => {
    const p = arcPoint(deg);
    const paths = sources.map((s) => {
      const dx = p.x - s.x,
        dy = p.y - s.y,
        dz = p.z - s.z;
      const r = Math.hypot(dx, dy, dz);
      return { r, th: Math.atan2(dx, dy), tv: Math.atan2(dz, Math.hypot(dx, dy)) - s.pitch };
    });
    return freqs.map((f, i) => {
      let sum = complex(0);
      sources.forEach((s, k) => {
        const { r, th, tv } = paths[k];
        const seconds = (r - D) / SPEED_OF_SOUND + s.delayS;
        const amp = (s.gain * patternDirectivity(s.pattern, f, th, tv) * D) / r;
        sum = add(sum, multiply(scale(feeds[k][i], amp), phasor(-2 * Math.PI * f * seconds)));
      });
      return 20 * Math.log10(Math.max(1e-9, abs(sum)));
    });
  };
  const on = levelsAt(0);
  const rows = angles.map((deg) => (deg === 0 ? on : levelsAt(deg)).map((v, i) => v - on[i]));
  return { angles, freqs, rows, crossovers: stackCrossoversHz(stack, speakers) };
}

/**
 * The map of one speaker on its input range (the Speaker page's), from its response: a stack of one at the base, its
 * listening height its highest band's center.
 */
/**
 * Whether the map models these speakers: not yet one with a horn-loaded chamber (its cones stand in for its mouth, so
 * the map would be wrong; issue #202).
 */
export const dispersionModeled = (speakers: readonly Pick<SpeakerSpec, "cabinet">[]) =>
  speakers.every((s) => s.cabinet.chambers.every((c) => c.load.kind !== CHAMBER_LOAD.horn));

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
