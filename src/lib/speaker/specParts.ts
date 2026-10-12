// Small parts the read adapters share (lib/speaker paSpec, hifiSpec, fillSpec).
import type {
  BandFilter,
  BandId,
  ChamberLoad,
  CrossoverOrder,
  FloorPoint,
  SpaceAmp,
  SpaceChannel,
  SpaceAim,
  SpacePlacement,
  SpaceVenue,
  SpeakerCabinet,
  SpeakerPart,
  SpeakerSpec,
  SpecIdentity,
  StackMember,
  StackPose,
} from "../../types";
import { crossoverSlopeName } from "../../constants/crossovers";
import { GLUED_BACK } from "../../constants/bracing";
import { defaultBraceStyleNear } from "../bracing";
import { PA_PANEL_TARGET_HZ } from "../pa/bracing";
import {
  CABINET_CONSTRUCTION,
  CABINET_TOP,
  CHAMBER_LOAD,
  SPEAKER_PART_NAMES,
} from "../../constants/speakerSpec";
import {
  SPACE_HOME_MARGIN_FT,
  SPACE_HOME_ROOM,
  SPACE_HOME_TARGET_DB,
  SPACE_SEAT_AREA,
} from "../../constants/space";

/** A Linkwitz-Riley filter of `order` at `hz` (the PA and Hi-fi crossovers). */
export const lrFilter = (hz: number, order: CrossoverOrder): BandFilter => ({
  hz,
  type: crossoverSlopeName(order),
});

/** A box model's stuffing gain (its effective air over its net) as a chamber's `stuffingPct`. */
export const stuffingPctOf = (gain: number) => Math.round((gain - 1) * 100);

/** A chamber whose drivers radiate straight out. */
export const DIRECT_LOAD: ChamberLoad = { kind: CHAMBER_LOAD.direct };

/** A flush box with a flat top (the Hi-fi box, the fill's, the Speaker page's empty speaker): its baffle is its front. */
export const FLUSH_BOX: Pick<SpeakerCabinet, "construction" | "top" | "insetIn"> = {
  construction: CABINET_CONSTRUCTION.flushBox,
  top: CABINET_TOP.flat,
  insetIn: 0,
};

/**
 * A flush box's bracing at walls `t` thick: the plywood's style for that thickness, a glued back (the Hi-fi box's and
 * the fill's backs are glued on), and the PA boxes' panel target.
 */
export const flushBracing = (
  t: number,
): Pick<SpeakerCabinet, "braceStyle" | "backJoint" | "braceTargetHz"> => ({
  braceStyle: defaultBraceStyleNear(t),
  backJoint: GLUED_BACK,
  braceTargetHz: PA_PANEL_TARGET_HZ,
});

/** A feed with no filters: the full range (no input range, no crossover between boxes). */
export const NO_FILTERS: SpeakerSpec["input"] = { highpass: null, lowpass: null };

/** A speaker's identity inside a design read in: the design's id and name, and the speaker's part. */
export const speakerIdentity = (design: SpecIdentity, part: SpeakerPart): SpecIdentity => ({
  id: `${design.id}/${part}`,
  name: `${design.name} · ${SPEAKER_PART_NAMES[part]}`,
});

/** Hands out each amp's channels in order: the next free channel on `amp`, feeding `bands` of stack member `member`. */
export function channelCounter() {
  const used = new Map<SpaceAmp["id"], number>();
  return (amp: SpaceAmp["id"], bands: readonly BandId[], member = 0): SpaceChannel => {
    const channel = used.get(amp) ?? 0;
    used.set(amp, channel + 1);
    return { amp, channel, member, bands };
  };
}

/** A member's place on the stack's base, at its origin. */
export const BASE_POSE: StackPose = { xIn: 0, yIn: 0, zIn: 0, on: null, pitchDeg: 0 };

/** A stack member at `pose` on `crossover`, with no level, delay or mirror of its own. */
export const stackMember = (
  speakerId: StackMember["speakerId"],
  crossover: StackMember["crossover"],
  pose: StackPose = BASE_POSE,
): StackMember => ({ speakerId, pose, mirror: false, crossover, levelDb: 0, delayMs: 0 });

/**
 * A placement at `spot`, `liftIn` up, turned `yawDeg` on the floor: no tilt, level or delay of its own; a mirror image
 * of placement `follows` where one is named (a left and right pair).
 */
export const spacePlacement = (
  spot: FloorPoint,
  item: SpacePlacement["item"],
  liftIn: SpacePlacement["liftIn"],
  channels: SpacePlacement["channels"],
  {
    yawDeg = 0,
    mirror = false,
    follows = null,
  }: Partial<Pick<SpaceAim, "yawDeg">> & Partial<Pick<SpacePlacement, "mirror" | "follows">> = {},
): SpacePlacement => ({
  x: spot.x,
  y: spot.y,
  item,
  liftIn,
  aim: { yawDeg, pitchDeg: 0 },
  mirror,
  follows,
  levelDb: 0,
  delayMs: 0,
  channels,
});

/**
 * A living room for a design that names none (the Hi-fi pair, a fill): SPACE_HOME_ROOM, grown to hold the boxes'
 * spread and the seat with SPACE_HOME_MARGIN_FT to spare; the listener at the seat, a seat-sized listening area round
 * them, and the room's target.
 */
export function homeVenue(
  spreadFt: number,
  listener: FloorPoint,
  earFt: SpaceVenue["earFt"],
): SpaceVenue {
  const room = {
    ...SPACE_HOME_ROOM,
    widthFt: Math.max(SPACE_HOME_ROOM.widthFt, spreadFt + 2 * SPACE_HOME_MARGIN_FT),
    lengthFt: Math.max(SPACE_HOME_ROOM.lengthFt, listener.y + 2 * SPACE_HOME_MARGIN_FT),
  };
  return {
    room,
    listener,
    earFt,
    area: { ...listener, ...SPACE_SEAT_AREA },
    targetDb: SPACE_HOME_TARGET_DB,
  };
}
