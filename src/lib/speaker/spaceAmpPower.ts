// The Space page's amp power table (the PA Coverage page's, lib/pa/ampPower): each amp channel of each placement at the
// space's level. Pure.
//
// A band's drive at its music limit is one drive for the whole band (lib/speaker/speakerLimits `musicDb`): the amp's
// output there is the band's input at that limit, raised by an active band's Level (its DSP gain, ahead of the amp; a
// passive band's pad is after it). The space plays every placement from one input: at its music limit the placement
// with the least headroom sets it (lib/speaker/spaceCoverage `headroomDb`), then the space's gain turns it down. A band's
// headroom at the space's level is its own music headroom less the levels ahead of it (its member's and its
// placement's), the space's headroom and the gain. A channel that feeds more than one band shows the band that takes
// the most power.
import type { BandId, SpaceAmp } from "../../types";
import type { SpaceModel } from "./spaceCoverage";
import { channelPower, type ChannelPower } from "../pa/ampPower";
import { SPEAKER_RESPONSE_VOLTS } from "../../constants/speakerSpec";
import { HIFI_DRIVE } from "../../constants/hifiEngine";

/** The impedance an amp's power is rated into, Ω (as both engines take the amp). */
const RATED_OHMS = 8;

/** One channel's row: its placement, its member and band, its amp, and its power at the space's level. */
export interface SpaceChannelPower {
  placement: number;
  member: number;
  band: BandId;
  amp: SpaceAmp["id"];
  channel: number;
  power: ChannelPower<string>;
}

/** Each channel of each placement at the space's level (`gain` dB under its music limit). */
export function spaceAmpPower(
  model: Pick<SpaceModel, "placements" | "headroomDb">,
  amps: readonly SpaceAmp[],
  gain: number,
): SpaceChannelPower[] {
  return model.placements.flatMap(({ item, response, limits }, k) => {
    const { placement, stack } = item;
    if (!response || !limits || !stack) return [];
    return placement.channels.flatMap((c) => {
      const amp = amps.find((a) => a.id === c.amp);
      const member = response.members[c.member];
      const own = limits.members[c.member]?.limits;
      const memberLevel = stack.stack.members[c.member]?.levelDb ?? 0;
      if (!amp || !member || !own) return [];
      const rows = c.bands.flatMap((id) => {
        const lim = own.bands.find((b) => b.id === id);
        const band = member.response.bands.find((b) => b.id === id);
        const spec = member.speaker.bands.find((b) => b.id === id);
        if (!lim || !band || !spec) return [];
        /** the band's input headroom at its music limit, dB */
        const room = lim.musicDb - band.passbandDb;
        const ahead = spec.drive === HIFI_DRIVE.active ? spec.levelDb : 0;
        const volts = SPEAKER_RESPONSE_VOLTS * Math.pow(10, (room + ahead) / 20);
        const headroom = Math.max(
          0,
          room - (memberLevel + placement.levelDb + model.headroomDb + gain),
        );
        const power: ChannelPower<string> = channelPower(
          `${k}/${c.amp}/${c.channel}`,
          { wAtMax: (volts * volts) / RATED_OHMS, ampW: amp.watts, who: lim.who },
          headroom,
        );
        return [{ band: id, power }];
      });
      const top = rows.reduce<(typeof rows)[number] | null>(
        (a, b) => (!a || b.power.avgW > a.power.avgW ? b : a),
        null,
      );
      return top
        ? [{ placement: k, member: c.member, amp: c.amp, channel: c.channel, ...top }]
        : [];
    });
  });
}
