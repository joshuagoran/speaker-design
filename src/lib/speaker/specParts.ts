// Small parts the read adapters share (lib/speaker paSpec, hifiSpec, fillSpec).
import type {
  BandFilter,
  BandId,
  ChamberLoad,
  CrossoverOrder,
  SourceChannel,
  SpeakerPart,
  SpecIdentity,
  SystemAmp,
  SystemSource,
} from "../../types";
import { crossoverSlopeName } from "../../constants/crossovers";
import { CHAMBER_LOAD, SPEAKER_PART_NAMES } from "../../constants/speakerSpec";

/** A Linkwitz-Riley filter of `order` at `hz` (the PA and Hi-fi crossovers). */
export const lrFilter = (hz: number, order: CrossoverOrder): BandFilter => ({
  hz,
  type: crossoverSlopeName(order),
});

/** A chamber whose drivers radiate straight out. */
export const DIRECT_LOAD: ChamberLoad = { kind: CHAMBER_LOAD.direct };

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
