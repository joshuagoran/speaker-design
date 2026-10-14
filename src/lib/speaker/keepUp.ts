// Keep-up at a crossover (the PA page's "Mid limits first" and "Horn limits first" checks, lib/pa/chips midChips and
// hornChips), for any two parts that cross: two bands of a speaker, or two members of a stack. One input drives both.
// At the input where the lower part reaches its music limit, the upper part must still have headroom at the crossover;
// the band Levels (and a member's level) already hold the music balance, so the PA page's "less the music balance" is
// in the curves. The gap is the upper part's headroom at the crossover less the lower part's headroom for music: below
// −KEEP_UP_SLACK_DB, the upper part limits first. Pure.
import type {
  FrequencyPoint,
  SpeakerBand,
  SpeakerLimits,
  SpeakerResponse,
  StackLimits,
  StackResponse,
  StackSpec,
} from "../../types";
import { curveLevelAt } from "../pa/coverage";
import { KEEP_UP_SLACK_DB, type ChipBody } from "../pa/chips";
import { formatHz } from "../format";
import { KEEP_UP_TEXT } from "../../constants/keepUp";
import { crossingPairs, type CrossingPair } from "./stackResponse";

/** One part's headroom: for music over its passband, and at a frequency, dB, both against the one input. */
interface Side {
  /** null: no music limit known */
  musicRoomDb: number | null;
  /** null where its curves don't reach `f` */
  roomAt: (f: number) => number | null;
}

/** Two parts that cross: the lower and upper part's indexes, where they cross, Hz, and the gap, dB. */
export interface KeepUp extends CrossingPair {
  gapDb: number;
}

/** A part's headroom at `f`: its maximum output less its level there, dB; null where either curve misses `f`. */
const roomOf =
  (max: readonly FrequencyPoint[], level: readonly FrequencyPoint[], offsetDb = 0) =>
  (f: number) => {
    const a = curveLevelAt(max, f),
      b = curveLevelAt(level, f);
    return a === null || b === null ? null : a - b - offsetDb;
  };

/** The gap at `hz` between a lower and an upper part (see the file's note); null where one isn't known. */
function gapAt(lower: Side, upper: Side, hz: number): number | null {
  const room = upper.roomAt(hz);
  return lower.musicRoomDb === null || room === null ? null : room - lower.musicRoomDb;
}

/** Each pair that crosses (`crossingPairs`) with both parts' sides known, and its gap. */
function crossings(
  filters: readonly Parameters<typeof crossingPairs>[0][number][],
  sides: readonly (Side | null)[],
): KeepUp[] {
  return crossingPairs(filters).flatMap((c) => {
    const sa = sides[c.lower],
      sb = sides[c.upper];
    const gapDb = sa && sb ? gapAt(sa, sb, c.hz) : null;
    return gapDb === null ? [] : [{ ...c, gapDb }];
  });
}

/**
 * A speaker's bands that cross inside the box (one band's lowpass and the next one's highpass), each at the band's music
 * limit and maximum output (lib/speaker/speakerLimits). Indexes are into `response.bands`.
 */
export function speakerKeepUps(
  bands: readonly Pick<SpeakerBand, "id" | "highpass" | "lowpass">[],
  response: Pick<SpeakerResponse, "bands">,
  limits: Pick<SpeakerLimits, "bands">,
): KeepUp[] {
  const filters = response.bands.map((r) => {
    const band = bands.find((b) => b.id === r.id);
    return { crossover: { highpass: band?.highpass ?? null, lowpass: band?.lowpass ?? null } };
  });
  const sides = response.bands.map((r): Side | null => {
    const lim = limits.bands.find((b) => b.id === r.id);
    return lim
      ? { musicRoomDb: lim.musicDb - r.passbandDb, roomAt: roomOf(lim.max, r.curve) }
      : null;
  });
  return crossings(filters, sides);
}

/**
 * A stack's members that cross (lib/speaker/stackResponse crossoverHz), each at its own music limit and maximum output
 * on its crossover, less its level (as lib/speaker/stackLimits reads them). Indexes are the members'.
 */
export function stackKeepUps(
  stack: Pick<StackSpec, "members">,
  response: Pick<StackResponse, "members">,
  limits: Pick<StackLimits, "members">,
): KeepUp[] {
  const sides = stack.members.map((member, k): Side | null => {
    const m = response.members[k],
      lim = limits.members[k];
    if (!m || !lim || !lim.limits.sum.length) return null;
    const music = lim.limits.bands.map(
      (b) => b.musicDb - (m.response.bands.find((rb) => rb.id === b.id)?.passbandDb ?? 0),
    );
    return {
      musicRoomDb: music.length ? Math.min(...music) - member.levelDb : null,
      roomAt: roomOf(lim.limits.sum, m.response.sum, member.levelDb),
    };
  });
  return crossings(stack.members, sides);
}

/** The check for one crossing, its parts named `lower` and `upper`: the upper part limits first, or keeps up. */
export function keepUpChip(
  k: Pick<KeepUp, "hz" | "gapDb">,
  lower: string,
  upper: string,
): ChipBody {
  const hz = formatHz(k.hz);
  return k.gapDb < -KEEP_UP_SLACK_DB
    ? [
        "warn",
        KEEP_UP_TEXT.shortTitle(upper),
        KEEP_UP_TEXT.shortDetail((-k.gapDb).toFixed(1), hz, upper, lower),
      ]
    : ["ok", KEEP_UP_TEXT.okTitle(lower), KEEP_UP_TEXT.okDetail(k.gapDb.toFixed(1), hz, lower)];
}
