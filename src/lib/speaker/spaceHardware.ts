// The amp power a space's speakers have: one figure per band, or per passive network,
// kept in the space's own copy of each speaker (`SpeakerBand.ampW`), which the model reads. Pure.
import type { BandId, SpaceDesign, SpeakerSpec } from "../../types";
import { expandPlacements, placementStack } from "./spaceLayout";
import { HIFI_DRIVE } from "../../constants/hifiEngine";

/**
 * The amp power figures a speaker has: each active band one of its own, and its passive bands one between them (their
 * network in the box splits it).
 */
export function channelGroups(speaker: Pick<SpeakerSpec, "bands">): BandId[][] {
  const active = speaker.bands.filter((b) => b.drive === HIFI_DRIVE.active).map((b) => [b.id]);
  const passive = speaker.bands.filter((b) => b.drive !== HIFI_DRIVE.active).map((b) => b.id);
  return passive.length ? [...active, passive] : active;
}

/** The speaker with every band in `bands` on an amp of `watts` W per channel. */
export const withAmpPower = (
  speaker: SpeakerSpec,
  bands: readonly BandId[],
  watts: number,
): SpeakerSpec => ({
  ...speaker,
  bands: speaker.bands.map((b) => (bands.includes(b.id) ? { ...b, ampW: watts } : b)),
});

/** One placed speaker's amp power figures: its bands (or a passive network's bands) and their power, W. */
export interface AmpPowerGroup {
  speaker: SpeakerSpec;
  groups: { bands: readonly BandId[]; watts: number }[];
}

/**
 * The amp power figures to set, for each speaker the space places (a stack's members, or a speaker alone), in the order
 * the placements first use them. A mirrored pair and a speaker placed twice share the speaker, so share its figures.
 */
export function ampPowerGroups(design: Pick<SpaceDesign, "space" | "stacks" | "speakers">) {
  const seen = new Set<SpeakerSpec["id"]>();
  return expandPlacements(design.space.placements).flatMap((p) => {
    const placed = placementStack(design, p.item);
    return (placed?.stack.members ?? []).flatMap((m): AmpPowerGroup[] => {
      const speaker = placed?.speakers.find((s) => s.id === m.speakerId);
      if (!speaker || seen.has(speaker.id)) return [];
      seen.add(speaker.id);
      return [
        {
          speaker,
          groups: channelGroups(speaker).map((bands) => ({
            bands,
            watts: speaker.bands.find((b) => b.id === bands[0])?.ampW ?? 0,
          })),
        },
      ];
    });
  });
}
