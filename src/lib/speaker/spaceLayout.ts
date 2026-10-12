// Where a space's placements put their boxes and drivers in the room: each placement's stack laid out (lib/speaker/
// stackLayout), then turned by the one aim model and set on the floor. The coverage model (lib/speaker/spaceCoverage)
// reads the drivers; the Space page's plan and side views read the boxes. Pure.
//
// The aim model: a member tilts about its bottom front edge by its cabinet's kick-back (`SpeakerCabinet.tiltDeg`) and
// its tilt in the stack (`StackPose.pitchDeg`); the placement tilts the whole stack about its base's front center by its
// pitch, lifts it, turns it by its yaw and sets that point on its spot. A driver's axis points along its member's
// front: the placement's yaw, and the three tilts added. What stands on a tilted member doesn't follow its tilt.
//
// Room coordinates are feet: x across from the center line (+ to the right, seen from the audience), y down the room
// from the front wall, z up from the floor. A stack's own coordinates are inches (lib/speaker/stackLayout).
import type {
  DriverPart,
  SpaceDesign,
  SpacePlacement,
  SpeakerChamber,
  SpeakerDriver,
  SpeakerSpec,
  StackMember,
  StackSpec,
} from "../../types";
import { stackLayout, driverSpotsIn, type StackPoint } from "./stackLayout";
import { stackMember } from "./specParts";
import { SPACE_ITEM } from "../../constants/speakerSpec";
import { INCHES_PER_FOOT } from "../../constants/units";
import { DRIVER_PART } from "../../constants/space";

/** A point in the room, ft: across, down the room, up. */
export interface RoomPoint {
  x: number;
  y: number;
  z: number;
}

/** Radians in a degree. */
const RAD = Math.PI / 180;

/**
 * The placement as it stands: one that follows an earlier one (a mirror pair) takes that one's item, spot, lift and aim,
 * x and yaw turned over and the image mirrored; its own level, delay and channels stay.
 */
export function resolvedPlacement(
  placements: readonly SpacePlacement[],
  k: number,
): SpacePlacement {
  const p = placements[k];
  const j = p.follows;
  if (j === null || j < 0 || j >= k) return p;
  const lead = resolvedPlacement(placements, j);
  return {
    ...p,
    item: lead.item,
    x: -lead.x,
    y: lead.y,
    liftIn: lead.liftIn,
    aim: { yawDeg: -lead.aim.yawDeg, pitchDeg: lead.aim.pitchDeg },
    mirror: !lead.mirror,
  };
}

/**
 * What a placement places, as a stack: its stack and the speakers it names, or a speaker alone as a stack of one on its
 * own input range; null when the design holds neither.
 */
export function placementStack(
  design: Pick<SpaceDesign, "stacks" | "speakers">,
  item: SpacePlacement["item"],
): { stack: Pick<StackSpec, "members">; speakers: readonly SpeakerSpec[] } | null {
  if (item.kind === SPACE_ITEM.stack) {
    const stack = design.stacks.find((s) => s.id === item.id);
    return stack ? { stack, speakers: design.speakers } : null;
  }
  const speaker = design.speakers.find((s) => s.id === item.id);
  return speaker
    ? { stack: { members: [stackMember(speaker.id, speaker.input)] }, speakers: [speaker] }
    : null;
}

/** Turns a point (in, across / up / back) about the origin by `pitch` radians, + up: the front rises. */
function tilt(p: StackPoint, pitch: number): StackPoint {
  const c = Math.cos(pitch),
    s = Math.sin(pitch);
  const forward = -p.z,
    up = p.y;
  return { x: p.x, y: forward * s + up * c, z: -(forward * c - up * s) };
}

/** A placement's frame: a point in its stack (in) to the room (ft), and its yaw and pitch, radians. */
export function placementFrame(p: SpacePlacement) {
  const yaw = p.aim.yawDeg * RAD,
    pitch = p.aim.pitchDeg * RAD;
  const cy = Math.cos(yaw),
    sy = Math.sin(yaw);
  const side = p.mirror ? -1 : 1;
  return {
    yaw,
    pitch,
    toRoom: (q: StackPoint): RoomPoint => {
      const t = tilt({ ...q, x: side * q.x }, pitch);
      const forward = -t.z;
      return {
        x: p.x + (t.x * cy + forward * sy) / INCHES_PER_FOOT,
        y: p.y + (forward * cy - t.x * sy) / INCHES_PER_FOOT,
        z: (p.liftIn + t.y) / INCHES_PER_FOOT,
      };
    },
  };
}

/** One driver spot placed in the room: what it is, which band it feeds, where it is and where it points. */
export interface PlacedDriver {
  /** the stack member it belongs to */
  member: number;
  speaker: SpeakerSpec;
  chamber: SpeakerChamber;
  driver: SpeakerDriver;
  part: DriverPart;
  band: string;
  /** a horn-loaded chamber's mouth, in, where the spot is its mouth */
  mouth: { w: number; h: number } | null;
  at: RoomPoint;
  /** its axis, radians: the placement's yaw, and every tilt added */
  yaw: number;
  pitch: number;
}

/** One member's box placed in the room: its eight corners, ft (front bottom left first, as `BOX_CORNERS`). */
export interface PlacedBox {
  member: number;
  speaker: SpeakerSpec;
  corners: RoomPoint[];
  /** its pitch, radians: the placement's, its tilt in the stack and its kick-back */
  pitch: number;
}

/** A box's corners, each as a share of its width (from its left), height and depth (from its front). */
const BOX_CORNERS: readonly [number, number, number][] = [
  [-0.5, 0, 0],
  [0.5, 0, 0],
  [0.5, 1, 0],
  [-0.5, 1, 0],
  [-0.5, 0, 1],
  [0.5, 0, 1],
  [0.5, 1, 1],
  [-0.5, 1, 1],
];

/** One placement laid out: as it stands (`resolvedPlacement`), its stack, its boxes and drivers; null stack: missing. */
export interface PlacedItem {
  placement: SpacePlacement;
  stack: ReturnType<typeof placementStack>;
  boxes: PlacedBox[];
  drivers: PlacedDriver[];
}

/** The band a driver part feeds: a cone its chamber's first cone's first band, an HF section its own (`hfBandOf`). */
export type BandOfPart = (
  chamber: SpeakerChamber,
  driver: SpeakerDriver,
  part: DriverPart,
) => string | null;

/**
 * Each placement laid out in the room. `bandOf` names the band each driver part feeds (lib/speaker/spaceCoverage
 * passes the speaker model's rule); a part on no band is left out.
 */
export function spaceLayout(
  design: Pick<SpaceDesign, "space" | "stacks" | "speakers">,
  bandOf: BandOfPart,
): PlacedItem[] {
  const { placements } = design.space;
  return placements.map((_, k) => {
    const placement = resolvedPlacement(placements, k);
    const stack = placementStack(design, placement.item);
    if (!stack) return { placement, stack, boxes: [], drivers: [] };
    const frame = placementFrame(placement);
    const placed = stackLayout(stack.stack, stack.speakers);
    const boxes: PlacedBox[] = [];
    const drivers: PlacedDriver[] = [];
    placed.forEach((m, k2) => {
      const { speaker } = m;
      if (!speaker) return;
      const member: StackMember = stack.stack.members[k2];
      const memberPitch = (speaker.cabinet.tiltDeg + member.pose.pitchDeg) * RAD;
      const side = member.mirror ? -1 : 1;
      /** a point of the member (in: across its center line, up from its bottom, back from its front) in the room */
      const inRoom = (q: StackPoint) => {
        const t = tilt({ ...q, x: side * q.x }, memberPitch);
        return frame.toRoom({ x: m.at.x + t.x, y: m.at.y + t.y, z: m.at.z + t.z });
      };
      const pitch = frame.pitch + memberPitch;
      boxes.push({
        member: k2,
        speaker,
        pitch,
        corners: BOX_CORNERS.map(([w, h, d]) =>
          inRoom({ x: w * m.size.w, y: h * m.size.h, z: d * m.size.d }),
        ),
      });
      for (const spot of driverSpotsIn(speaker))
        for (const part of [DRIVER_PART.cone, DRIVER_PART.hf]) {
          const band = bandOf(spot.chamber, spot.driver, part);
          if (band === null) continue;
          for (const q of spot.points)
            drivers.push({
              member: k2,
              speaker,
              chamber: spot.chamber,
              driver: spot.driver,
              part,
              band,
              mouth: spot.mouth,
              at: inRoom({ x: q.x, y: q.y, z: 0 }),
              yaw: frame.yaw,
              pitch,
            });
        }
    });
    return { placement, stack, boxes, drivers };
  });
}
