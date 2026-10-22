// Where a stack's members stand, inches: each member's box (its bottom center at its front, and its size) from its
// pose, and the center of each of its bands in the front view. The stack model (lib/speaker/stackResponse) reads the
// band centers for the paths to the listening point; the Stack page's front drawing reads the boxes. x is across from
// the stack's center line (+ to the right seen from the front), y up from its base, z back from its front. A member
// tilts about its bottom front edge (`memberPoint`), as the aim model in lib/speaker/spaceLayout says. Pure.
import type {
  BandId,
  Dims3,
  FoldWall,
  SpeakerChamber,
  SpeakerDriver,
  SpeakerSpec,
  StackMember,
  StackSpec,
} from "../../types";
import { RAD } from "../../constants/units";
import { driverHorn, driverSpots, onTop, speakerLayout } from "./speakerLayout";
import { hornMouth, type HornMouth } from "./hornMouth";
import { FOLD_WALL } from "../../constants/speakerSpec";

/** A point in the stack, in: across, up and back. */
export interface StackPoint {
  x: number;
  y: number;
  z: number;
}

/** One member placed: its speaker (null when the speakers given lack it), its box, and its bands' centers. */
export interface PlacedMember {
  speaker: SpeakerSpec | null;
  /** its bottom center at its front */
  at: StackPoint;
  /** its cabinet's size (0 without a speaker) */
  size: Dims3;
  /** the center of each band its drivers feed, in the stack (mirrored with the member) */
  bands: { id: BandId; center: StackPoint }[];
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

/** The stack's origin (a member's own: its bottom center at its front). */
export const ORIGIN: StackPoint = { x: 0, y: 0, z: 0 };

/** A box's eight corners, in, from its bottom center at its front (`at`) and its size: front bottom left first. */
export const boxCorners = (at: StackPoint, size: Dims3): StackPoint[] =>
  BOX_CORNERS.map(([w, h, d]) => ({
    x: at.x + w * size.w,
    y: at.y + h * size.h,
    z: at.z + d * size.d,
  }));

/** Turns a point (in, across / up / back) about the origin by `pitch` radians, + up: the front rises. */
export function tilt(p: StackPoint, pitch: number): StackPoint {
  const c = Math.cos(pitch),
    s = Math.sin(pitch);
  const forward = -p.z,
    up = p.y;
  return { x: p.x, y: forward * s + up * c, z: -(forward * c - up * s) };
}

/** A member's tilt, radians, + up (the front rises): its cabinet's kick-back and its tilt in the stack. */
export const memberPitch = (
  speaker: Pick<SpeakerSpec, "cabinet">,
  member: { pose: Pick<StackMember["pose"], "pitchDeg"> },
) => (speaker.cabinet.tiltDeg + member.pose.pitchDeg) * RAD;

/**
 * A member's points in its stack, in: a point of the member (across its center line, up from its bottom, back from its
 * front) mirrored with it, tilted by `pitch` radians (`memberPitch`) about its bottom front edge and set at its place.
 */
export const memberPoint =
  (m: Pick<PlacedMember, "at">, mirror: StackMember["mirror"], pitch: number) =>
  (q: StackPoint): StackPoint => {
    const t = tilt({ ...q, x: (mirror ? -1 : 1) * q.x }, pitch);
    return { x: m.at.x + t.x, y: m.at.y + t.y, z: m.at.z + t.z };
  };

/** A driver entry's spots in its speaker (`driverSpotsIn`). */
interface DriverSpots {
  chamber: SpeakerChamber;
  driver: SpeakerDriver;
  points: StackPoint[];
  facing: FoldWall;
  mouth: Pick<HornMouth, "w" | "h" | "wallDeg"> | null;
}

/**
 * Each driver entry's spots in its speaker, in (x from the cabinet's center line, y up from its bottom, z back from its
 * front), and the way they face: where its drivers are on the baffle (a horn on the top at its mouth's middle, half
 * its height above the lid). A horn whose drivers stand inside it radiates from its mouth alone (lib/speaker/hornMouth):
 * each driver inside it gives one spot, at the mouth's middle and facing out of its wall (`mouth`, its size and walls;
 * null for a spot on the baffle), so every band that plays through the horn plays from its mouth. A band's spots each
 * play its share (one over their count), so drivers of one band at one mouth add up to the band once. A folded horn
 * with no drawing yet has no mouth: its cones stand in for it on the baffle.
 */
export function driverSpotsIn(spec: Pick<SpeakerSpec, "cabinet">): DriverSpots[] {
  const layout = speakerLayout(spec.cabinet);
  return layout.chambers.flatMap((placed) => {
    const mouth = hornMouth(spec.cabinet, placed);
    return placed.chamber.drivers.flatMap((driver): DriverSpots[] => {
      const horn = driverHorn(driver);
      if (!mouth || onTop(driver))
        return [
          {
            chamber: placed.chamber,
            driver,
            points: driverSpots(placed, driver).map((s) => ({
              x: s.xIn,
              y: s.yIn + (horn && onTop(driver) ? horn.size.h / 2 : 0),
              z: 0,
            })),
            facing: FOLD_WALL.baffle,
            mouth: null,
          },
        ];
      return [
        {
          chamber: placed.chamber,
          driver,
          points: [mouth.at],
          facing: mouth.facing,
          mouth: { w: mouth.w, h: mouth.h, wallDeg: mouth.wallDeg },
        },
      ];
    });
  });
}

/**
 * Each band's center in its speaker's front view, in (x from the cabinet's center line, y up from its bottom): the mean
 * of its drivers' spots (`driverSpotsIn`). A coaxial feeds both its bands from its center.
 */
export function bandCenters(spec: Pick<SpeakerSpec, "cabinet">) {
  const spots = new Map<BandId, { x: number; y: number }[]>();
  for (const { driver, points } of driverSpotsIn(spec))
    for (const band of driver.bands) spots.set(band, [...(spots.get(band) ?? []), ...points]);
  return [...spots].map(([id, list]) => ({
    id,
    x: list.reduce((sum, p) => sum + p.x, 0) / list.length,
    y: list.reduce((sum, p) => sum + p.y, 0) / list.length,
  }));
}

/**
 * The stack's members placed: each on the base at its pose, or on the earlier member it stands on (from that one's
 * center line, top and front). A member that names itself or a later one stands on the base.
 */
export function stackLayout(
  stack: Pick<StackSpec, "members">,
  speakers: readonly SpeakerSpec[],
): PlacedMember[] {
  const placed: PlacedMember[] = [];
  stack.members.forEach((member, k) => {
    const speaker = speakers.find((s) => s.id === member.speakerId) ?? null;
    const size = speaker ? speakerLayout(speaker.cabinet).size : { w: 0, h: 0, d: 0 };
    const { pose } = member;
    const under = pose.on !== null && pose.on >= 0 && pose.on < k ? placed[pose.on] : null;
    const at = under
      ? {
          x: under.at.x + pose.xIn,
          y: under.at.y + under.size.h + pose.yIn,
          z: under.at.z + pose.zIn,
        }
      : { x: pose.xIn, y: pose.yIn, z: pose.zIn };
    const side = member.mirror ? -1 : 1;
    placed.push({
      speaker,
      at,
      size,
      bands: speaker
        ? bandCenters(speaker).map((b) => ({
            id: b.id,
            center: { x: at.x + side * b.x, y: at.y + b.y, z: at.z },
          }))
        : [],
    });
  });
  return placed;
}
