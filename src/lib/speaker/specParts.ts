// Small parts the read adapters share (lib/speaker paSpec, hifiSpec, fillSpec).
import { AUTO_BALANCE_MODE } from "../../constants/autoBalance";
import { COVERAGE_LEVEL_REF } from "../../constants/coverageLevel";
import type {
  BandFilter,
  ChamberBracing,
  ChamberLoad,
  CrossoverOrder,
  FloorPoint,
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
import { defaultBraceStyleNear } from "../build/bracing";
import { PA_PANEL_TARGET_HZ } from "../build/boxBracing";
import {
  AUTO_DELAY,
  CABINET_CONSTRUCTION,
  CABINET_TOP,
  CHAMBER_LOAD,
  SPEAKER_PART_NAMES,
} from "../../constants/speakerSpec";
import { SPACE_HOME_MARGIN_FT, SPACE_HOME_ROOM, SPACE_HOME_TARGET_DB } from "../../constants/space";

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
export const flushBracing = (t: number): ChamberBracing => ({
  braceStyle: defaultBraceStyleNear(t),
  backJoint: GLUED_BACK,
  braceTargetHz: PA_PANEL_TARGET_HZ,
});

/** A cabinet with no handles and no input dish (the Hi-fi box, the fill's, the Speaker page's empty speaker). */
export const NO_HARDWARE: Pick<SpeakerCabinet, "handles" | "inputDish"> = {
  handles: null,
  inputDish: false,
};

/** A feed with no filters: the full range (no input range, no crossover between boxes). */
export const NO_FILTERS: SpeakerSpec["input"] = { highpass: null, lowpass: null };

/** A speaker's identity inside a design read in: the design's id and name, and the speaker's part. */
export const speakerIdentity = (design: SpecIdentity, part: SpeakerPart): SpecIdentity => ({
  id: `${design.id}/${part}`,
  name: `${design.name} · ${SPEAKER_PART_NAMES[part]}`,
});

/** A member's place on the stack's base, at its origin. */
export const BASE_POSE: StackPose = { xIn: 0, yIn: 0, zIn: 0, on: null, pitchDeg: 0 };

/** A stack member at `pose` on `crossover`, with no level, delay or mirror of its own. */
export const stackMember = (
  speakerId: StackMember["speakerId"],
  crossover: StackMember["crossover"],
  pose: StackPose = BASE_POSE,
): StackMember => ({ speakerId, pose, mirror: false, crossover, levelDb: 0, delayMs: 0 });

/**
 * A placement at `spot`, `liftIn` up, turned `yawDeg` on the floor: no tilt, level or delay of its own; `mirrored`
 * stands it twice, the second a mirror image across the center line (a left and right pair).
 */
export const spacePlacement = (
  spot: FloorPoint,
  item: SpacePlacement["item"],
  liftIn: SpacePlacement["liftIn"],
  {
    yawDeg = 0,
    mirror = false,
    mirrored = false,
  }: Partial<Pick<SpaceAim, "yawDeg">> & Partial<Pick<SpacePlacement, "mirror" | "mirrored">> = {},
): SpacePlacement => ({
  x: spot.x,
  y: spot.y,
  item,
  liftIn,
  aim: { yawDeg, pitchDeg: 0 },
  mirror,
  mirrored,
  levelDb: 0,
  delayMs: AUTO_DELAY,
  fill: false,
});

/** The middle of a room's floor, ft: where a new space's alignment point starts. */
export const roomCenter = (room: Pick<SpaceVenue["room"], "lengthFt">): FloorPoint => ({
  x: 0,
  y: room.lengthFt / 2,
});

/**
 * A living room for a design that names none (the Hi-fi pair, a fill): SPACE_HOME_ROOM, grown to hold the boxes'
 * spread and the seat with SPACE_HOME_MARGIN_FT to spare; the listener at the seat, and the room's target (flat, as the
 * audience average).
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
    alignAt: roomCenter(room),
    earFt,
    targetDb: SPACE_HOME_TARGET_DB,
    // measured as the audience average, the same target in every band
    levelRef: COVERAGE_LEVEL_REF.audience,
    balance: AUTO_BALANCE_MODE.flat,
  };
}
