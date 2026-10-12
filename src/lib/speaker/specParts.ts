// Small parts the read adapters share (lib/speaker paSpec, hifiSpec, fillSpec).
import type {
  BandFilter,
  BandId,
  ChamberLoad,
  CrossoverOrder,
  SpaceAmp,
  SpaceChannel,
  SpeakerCabinet,
  SpeakerPart,
  SpeakerSpec,
  SpecIdentity,
  StackMember,
  StackPose,
} from "../../types";
import { crossoverSlopeName } from "../../constants/crossovers";
import {
  CABINET_CONSTRUCTION,
  CABINET_TOP,
  CHAMBER_LOAD,
  SPEAKER_PART_NAMES,
} from "../../constants/speakerSpec";

/** A Linkwitz-Riley filter of `order` at `hz` (the PA and Hi-fi crossovers). */
export const lrFilter = (hz: number, order: CrossoverOrder): BandFilter => ({
  hz,
  type: crossoverSlopeName(order),
});

/** A box model's stuffing gain (its effective air over its net) as a chamber's `stuffingPct`. */
export const stuffingPctOf = (gain: number) => Math.round((gain - 1) * 100);

/** A chamber whose drivers radiate straight out. */
export const DIRECT_LOAD: ChamberLoad = { kind: CHAMBER_LOAD.direct };

/** A flush box with a flat top (the Hi-fi box, the fill's, the Designer's empty speaker): its baffle is its front. */
export const FLUSH_BOX: Pick<SpeakerCabinet, "construction" | "top" | "insetIn"> = {
  construction: CABINET_CONSTRUCTION.flushBox,
  top: CABINET_TOP.flat,
  insetIn: 0,
};

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
export const BASE_POSE: StackPose = { xIn: 0, yIn: 0, zIn: 0, on: null };

/** A stack member at `pose` on `crossover`, with no level, delay or mirror of its own. */
export const stackMember = (
  speakerId: StackMember["speakerId"],
  crossover: StackMember["crossover"],
  pose: StackPose = BASE_POSE,
): StackMember => ({ speakerId, pose, mirror: false, crossover, levelDb: 0, delayMs: 0 });
