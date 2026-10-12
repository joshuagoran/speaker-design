// The hardware a space assigns (docs/speaker-designer-plan.md, L4b): which amp channel feeds each member's bands, and
// what that asks of the amps and the front end. Pure.
import type {
  BandId,
  SpaceAmp,
  SpaceChannel,
  SpaceDesign,
  SpacePlacement,
  SpeakerSpec,
} from "../../types";
import { ampById } from "../data";
import { HIFI_DRIVE } from "../../constants/hifiEngine";
import { AUTO_DELAY, FRONT_END_KIND } from "../../constants/speakerSpec";
import { placementStack, resolvedPlacement } from "./spaceLayout";

/**
 * The channels a speaker's bands need: each active band one of its own, and its passive bands one between them (their
 * network in the box splits it).
 */
export function channelGroups(speaker: Pick<SpeakerSpec, "bands">): BandId[][] {
  const active = speaker.bands.filter((b) => b.drive === HIFI_DRIVE.active).map((b) => [b.id]);
  const passive = speaker.bands.filter((b) => b.drive !== HIFI_DRIVE.active).map((b) => b.id);
  return passive.length ? [...active, passive] : active;
}

/** Each placement's channels numbered on their amps, in order through the space: the first free channel of each. */
export function numberChannels(placements: readonly SpacePlacement[]): SpacePlacement[] {
  const used = new Map<SpaceAmp["id"], number>();
  return placements.map((p) => ({
    ...p,
    channels: p.channels.map((c) => {
      const channel = used.get(c.amp) ?? 0;
      used.set(c.amp, channel + 1);
      return { ...c, channel };
    }),
  }));
}

/**
 * A placement's channels with one band group (`bands`, of member `member`) on `amp`, or on none: its old channel for
 * that group goes. Numbered afterwards (`numberChannels`).
 */
export function assignChannel(
  channels: readonly SpaceChannel[],
  member: number,
  bands: readonly BandId[],
  amp: SpaceAmp["id"] | null,
): SpaceChannel[] {
  const rest = channels.filter(
    (c) => !(c.member === member && c.bands.some((b) => bands.includes(b))),
  );
  return amp === null ? rest : [...rest, { amp, channel: 0, member, bands }];
}

/** What a space's hardware falls short of: amps with more channels used than they have, and delays an analog front end can't make. */
export function hardwareGaps(design: SpaceDesign) {
  const { amps, placements, frontEnd } = design.space;
  const over = amps.flatMap((amp, i) => {
    const used = placements.reduce(
      (sum, p) => sum + p.channels.filter((c) => c.amp === amp.id).length,
      0,
    );
    const has = amp.model ? ampById(amp.model).model.channels : null;
    return has !== null && used > has ? [{ amp: i, used, has }] : [];
  });
  const delays = placements.some((p, k) => {
    if (p.delayMs) return true;
    const stack = placementStack(design, resolvedPlacement(placements, k).item);
    return !!stack && stack.stack.members.some((m) => m.delayMs === AUTO_DELAY || m.delayMs > 0);
  });
  return { over, analogDelay: frontEnd?.kind === FRONT_END_KIND.analog && delays };
}
