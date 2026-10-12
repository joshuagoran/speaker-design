// Where a stack's members stand, inches: each member's box (its bottom center at its front, and its size) from its
// pose, and the center of each of its bands in the front view. The stack model (lib/speaker/stackResponse) reads the
// band centers for the paths to the listening point; the Stack page's front drawing reads the boxes. x is across from
// the stack's center line (+ to the right seen from the front), y up from its base, z back from its front. Pure.
import type { BandId, Dims3, SpeakerSpec, StackSpec } from "../../types";
import {
  driverHorn,
  driverSpots,
  driversOnBaffle,
  hornFlare,
  onTop,
  speakerLayout,
} from "./speakerLayout";

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

/**
 * Each band's center in its speaker's front view, in (x from the cabinet's center line, y up from its bottom): the mean
 * of its drivers' spots on the baffle (a horn on the top at its mouth's middle, half its height above the lid); a
 * horn-loaded chamber's drivers at the middle of its mouth. A coaxial feeds both its bands from its center.
 */
export function bandCenters(spec: Pick<SpeakerSpec, "cabinet">) {
  const layout = speakerLayout(spec.cabinet);
  const spots = new Map<BandId, { x: number; y: number }[]>();
  const add = (band: BandId, x: number, y: number) => {
    const list = spots.get(band);
    if (list) list.push({ x, y });
    else spots.set(band, [{ x, y }]);
  };
  for (const placed of layout.chambers) {
    const flare = hornFlare(spec.cabinet, placed);
    for (const driver of placed.chamber.drivers) {
      const horn = driverHorn(driver);
      const points =
        driversOnBaffle(placed.chamber) || onTop(driver) || !flare
          ? driverSpots(placed, driver).map((s) => ({
              x: s.xIn,
              y: s.yIn + (horn && onTop(driver) ? horn.size.h / 2 : 0),
            }))
          : [{ x: flare.mouth.x + flare.mouth.w / 2, y: flare.mouth.y + flare.mouth.h / 2 }];
      for (const band of driver.bands) for (const p of points) add(band, p.x, p.y);
    }
  }
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
