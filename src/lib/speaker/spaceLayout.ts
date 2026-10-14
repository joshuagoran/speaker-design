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
  BandId,
  DriverPart,
  FloorPoint,
  SpaceDesign,
  SpacePlacement,
  SpeakerChamber,
  SpeakerDriver,
  SpeakerSpec,
  StackMember,
  StackSpec,
} from "../../types";
import {
  stackLayout,
  driverSpotsIn,
  boxCorners,
  memberPitch,
  memberPoint,
  ORIGIN,
  tilt,
  type StackPoint,
} from "./stackLayout";
import { stackMember } from "./specParts";
import { SPACE_ITEM } from "../../constants/speakerSpec";
import { INCHES_PER_FOOT, RAD } from "../../constants/units";
import { DRIVER_PART, SPACE_YAW_DEG } from "../../constants/space";

/** A point in the room, ft: across, down the room, up. */
export interface RoomPoint {
  x: number;
  y: number;
  z: number;
}

/** A yaw wrapped into -180..180 (the half turn either way): 190 is -170, and a turn past 180 carries on smoothly. */
export function wrapYawDeg(deg: number): number {
  return deg - 360 * Math.ceil((deg - SPACE_YAW_DEG) / 360) + 0;
}

/** The yaw that faces point `to` from point `from` on the floor (ft), whole degrees in -180..180; 0 is straight down the room. */
export function yawToward(from: FloorPoint, to: FloorPoint): number {
  return wrapYawDeg(Math.round(Math.atan2(to.x - from.x, to.y - from.y) / RAD));
}

/**
 * The placement that placement `k` follows: an earlier one that stands on its own. Null for one on its own, and for one
 * that names anything else (a later placement, or one that follows too: a mirror of a mirror is not a copy, so no chain
 * stands), which then stands on its own.
 */
export function followedLead(
  placements: readonly Pick<SpacePlacement, "follows">[],
  k: number,
): number | null {
  const j = placements[k]?.follows;
  if (j === null || j === undefined || !Number.isInteger(j) || j < 0 || j >= k) return null;
  return placements[j].follows === null ? j : null;
}

/**
 * The placement as it stands: one that follows an earlier one (a mirrored copy) takes that one's item, spot, lift, aim,
 * level and delay, x and yaw turned over and the image mirrored. It has no settings of its own.
 */
export function resolvedPlacement(
  placements: readonly SpacePlacement[],
  k: number,
): SpacePlacement {
  const p = placements[k];
  const j = followedLead(placements, k);
  if (j === null) return p;
  const lead = placements[j];
  return {
    ...p,
    item: lead.item,
    x: -lead.x,
    y: lead.y,
    liftIn: lead.liftIn,
    aim: { yawDeg: wrapYawDeg(-lead.aim.yawDeg), pitchDeg: lead.aim.pitchDeg },
    mirror: !lead.mirror,
    levelDb: lead.levelDb,
    delayMs: lead.delayMs,
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

/** A placement's frame: a point in its stack (in) to the room (ft), and its yaw and pitch, radians. */
export function placementFrame(p: Pick<SpacePlacement, "x" | "y" | "liftIn" | "aim" | "mirror">) {
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
  band: BandId;
  /** a horn-loaded chamber's mouth, in, where the spot is its mouth */
  mouth: { w: number; h: number } | null;
  at: RoomPoint;
  /** its axis, radians: the placement's yaw, and every tilt added */
  yaw: number;
  pitch: number;
}

/** One member's box placed in the room: its eight corners, ft (front bottom left first, as `boxCorners`). */
export interface PlacedBox {
  member: number;
  speaker: SpeakerSpec;
  corners: RoomPoint[];
  /** its pitch, radians: the placement's, its tilt in the stack and its kick-back */
  pitch: number;
}

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
) => BandId | null;

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
    return { placement, stack, ...layStack(stack, placementFrame(placement), bandOf) };
  });
}

/**
 * A stack's boxes and driver spots in the room, through a placement's frame (`placementFrame`): each member laid out
 * (lib/speaker/stackLayout), tilted by the aim model. `bandOf` names the band each driver part feeds.
 */
export function layStack(
  stack: NonNullable<ReturnType<typeof placementStack>>,
  frame: ReturnType<typeof placementFrame>,
  bandOf: BandOfPart,
): Pick<PlacedItem, "boxes" | "drivers"> {
  const placed = stackLayout(stack.stack, stack.speakers);
  const boxes: PlacedBox[] = [];
  const drivers: PlacedDriver[] = [];
  placed.forEach((m, k2) => {
    const { speaker } = m;
    if (!speaker) return;
    const member: StackMember = stack.stack.members[k2];
    const memberTilt = memberPitch(speaker, member);
    const inStack = memberPoint(m, member.mirror, memberTilt);
    /** a point of the member (in: across its center line, up from its bottom, back from its front) in the room */
    const inRoom = (q: StackPoint) => frame.toRoom(inStack(q));
    const pitch = frame.pitch + memberTilt;
    boxes.push({
      member: k2,
      speaker,
      pitch,
      corners: boxCorners(ORIGIN, m.size).map(inRoom),
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
  return { boxes, drivers };
}
