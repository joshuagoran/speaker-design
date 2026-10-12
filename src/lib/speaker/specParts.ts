// Small parts the read adapters share (lib/speaker paSpec, hifiSpec, fillSpec).
import type {
  BandFilter,
  BandId,
  ChamberLoad,
  CrossoverOrder,
  SourceChannel,
  SpeakerCabinet,
  SpeakerPart,
  SpecIdentity,
  SystemAmp,
  SystemSource,
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

/** A source's feed with no filters of the system's own. */
export const NO_FILTERS: SystemSource["filters"] = { highpass: null, lowpass: null };

/** A speaker's identity inside a system read from one design: the system's id and name, and the speaker's part. */
export const speakerIdentity = (system: SpecIdentity, part: SpeakerPart): SpecIdentity => ({
  id: `${system.id}/${part}`,
  name: `${system.name} · ${SPEAKER_PART_NAMES[part]}`,
});

/** Hands out each amp's channels in order: the next free channel on `amp`, feeding `bands`. */
export function channelCounter() {
  const used = new Map<SystemAmp["id"], number>();
  return (amp: SystemAmp["id"], bands: readonly BandId[]): SourceChannel => {
    const channel = used.get(amp) ?? 0;
    used.set(amp, channel + 1);
    return { amp, channel, bands };
  };
}
