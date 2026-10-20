// Where a space's placements put their boxes and drivers in the room: each placement's stack laid out (lib/speaker/
// stackLayout), then turned by the one aim model and set on the floor. The coverage model (lib/speaker/spaceCoverage)
// reads the drivers; the Space page's plan and side views read the boxes. Pure.
//
// The aim model: a member tilts about its bottom front edge by its cabinet's kick-back (`SpeakerCabinet.tiltDeg`) and
// its tilt in the stack (`StackPose.pitchDeg`); the placement tilts the whole stack about its base's front center by its
// pitch, lifts it, turns it by its yaw and sets that point on its spot. Upside down, the stack first turns over about
// its front center line (`placementFrame`). A driver's axis points along its member's front: the placement's yaw, and
// the three tilts added. What stands on a tilted member doesn't follow its tilt.
//
// Room coordinates are feet: x across from the center line (+ to the right, seen from the audience), y down the room
// from the front wall, z up from the floor. A stack's own coordinates are inches (lib/speaker/stackLayout).
import type {
  BandId,
  DriverPart,
  FloorPoint,
  PlacedSource,
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
import { DRIVER_PART, PAIR_SIDE, SPACE_YAW_DEG } from "../../constants/space";

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
 * The boxes the model places, in the placements' order: a placement on its own stands once; a mirrored one stands twice,
 * as set and then as its mirror image across the center line (x and rotation turned over, the box flipped left and
 * right). The two share its item, lift, level, delay, and whether it is upside down. Each carries its placement's
 * index (`source`) and, in a pair, its side of the center line seen from the listener (the one at the smaller x is the
 * left).
 */
export function expandPlacements(placements: readonly SpacePlacement[]): PlacedSource[] {
  return placements.flatMap((p, source): PlacedSource[] => {
    if (!p.mirrored) return [{ ...p, source, image: false, side: null }];
    const asSetIsLeft = p.x <= 0;
    return [
      { ...p, source, image: false, side: asSetIsLeft ? PAIR_SIDE.left : PAIR_SIDE.right },
      {
        ...p,
        // 0 - x, not -x: a box on the center line keeps x = 0, not -0
        x: 0 - p.x,
        aim: { yawDeg: wrapYawDeg(-p.aim.yawDeg), pitchDeg: p.aim.pitchDeg },
        source,
        image: true,
        side: asSetIsLeft ? PAIR_SIDE.right : PAIR_SIDE.left,
      },
    ];
  });
}

/**
 * The placement after a drag moved one of its boxes to `to` (ft): the box as set moves it there; the mirror image moves
 * it to the spot's mirror image, so the image stands where it was dragged.
 */
export function movedPlacement(p: SpacePlacement, image: boolean, to: FloorPoint): SpacePlacement {
  return { ...p, x: image ? 0 - to.x : to.x, y: to.y };
}

/**
 * The placement after a drag turned one of its boxes (as `PlacedSource` stands, at `box`) to face `toward` (ft): the
 * image's yaw is the placement's, turned over. With `stepDeg` (Shift held), the yaw rounds to a multiple of it.
 */
export function aimedPlacement(
  p: SpacePlacement,
  box: Pick<PlacedSource, "x" | "y" | "image">,
  toward: FloorPoint,
  stepDeg?: number,
): SpacePlacement {
  const exact = yawToward(box, toward);
  const yawDeg = stepDeg ? wrapYawDeg(Math.round(exact / stepDeg) * stepDeg) : exact;
  return { ...p, aim: { ...p.aim, yawDeg: box.image ? wrapYawDeg(-yawDeg) : yawDeg } };
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

/**
 * A box's frame (`expandPlacements`): a point in its stack (in) to the room (ft), its yaw and pitch, radians, and the
 * pitch of a member tilted `memberTilt` radians in it. A pair's image is flipped left and right; the box as set stands
 * as designed. Upside down, the stack first turns over about its front center line at `rollAxisIn` up (the middle of
 * its height, so it keeps its height span), before the tilt, the lift and the yaw: a member's tilt then aims the other
 * way.
 */
export function placementFrame(
  p: Pick<PlacedSource, "x" | "y" | "liftIn" | "aim" | "image" | "upsideDown">,
  rollAxisIn: number,
) {
  const yaw = p.aim.yawDeg * RAD,
    pitch = p.aim.pitchDeg * RAD;
  const cy = Math.cos(yaw),
    sy = Math.sin(yaw);
  const side = p.image ? -1 : 1;
  const roll = p.upsideDown ? -1 : 1;
  return {
    yaw,
    pitch,
    memberPitch: (memberTilt: number) => pitch + roll * memberTilt,
    toRoom: (q: StackPoint): RoomPoint => {
      const t = tilt(
        {
          x: roll * side * q.x,
          y: p.upsideDown ? 2 * rollAxisIn - q.y : q.y,
          z: q.z,
        },
        pitch,
      );
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

/** One box of a placement laid out: as it stands (`expandPlacements`), its stack, its boxes and drivers; null stack: missing. */
export interface PlacedItem {
  placement: PlacedSource;
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
 * Each placement laid out in the room, a mirrored pair as two (`expandPlacements`). `bandOf` names the band each driver part feeds (lib/speaker/spaceCoverage
 * passes the speaker model's rule); a part on no band is left out.
 */
export function spaceLayout(
  design: Pick<SpaceDesign, "space" | "stacks" | "speakers">,
  bandOf: BandOfPart,
): PlacedItem[] {
  return expandPlacements(design.space.placements).map((placement) => {
    const stack = placementStack(design, placement.item);
    if (!stack) return { placement, stack, boxes: [], drivers: [] };
    return { placement, stack, ...layStack(stack, placement, bandOf) };
  });
}

/**
 * A stack's boxes and driver spots in the room, as `pose` places it (`placementFrame`): each member laid out
 * (lib/speaker/stackLayout), tilted by the aim model. `bandOf` names the band each driver part feeds.
 */
export function layStack(
  stack: NonNullable<ReturnType<typeof placementStack>>,
  pose: Parameters<typeof placementFrame>[0],
  bandOf: BandOfPart,
): Pick<PlacedItem, "boxes" | "drivers"> {
  const members = stackLayout(stack.stack, stack.speakers).flatMap((m, k2) => {
    const { speaker } = m;
    if (!speaker) return [];
    const member: StackMember = stack.stack.members[k2];
    const memberTilt = memberPitch(speaker, member);
    /** a point of the member (in: across its center line, up from its bottom, back from its front) in the stack */
    const inStack = memberPoint(m, member.mirror, memberTilt);
    return [{ k2, speaker, memberTilt, inStack, corners: boxCorners(ORIGIN, m.size).map(inStack) }];
  });
  // the stack turns over about the middle of its height, so it keeps its height span
  const heights = members.flatMap((m) => m.corners.map((c) => c.y));
  const frame = placementFrame(
    pose,
    heights.length ? (Math.min(...heights) + Math.max(...heights)) / 2 : 0,
  );
  const boxes: PlacedBox[] = [];
  const drivers: PlacedDriver[] = [];
  for (const { k2, speaker, memberTilt, inStack, corners } of members) {
    const pitch = frame.memberPitch(memberTilt);
    boxes.push({ member: k2, speaker, pitch, corners: corners.map(frame.toRoom) });
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
            at: frame.toRoom(inStack({ x: q.x, y: q.y, z: 0 })),
            yaw: frame.yaw,
            pitch,
          });
      }
  }
  return { boxes, drivers };
}
