// The stack model: speakers in a fixed relationship, summed at a listening point. Each member is its speaker through
// the speaker model (lib/speaker/speakerResponse) with the member's crossover as its input range; then the member's
// level, polarity and delay, and each band's path to the listening point; the members summed with their phase. Its
// limits take each member's own (lib/speaker/speakerLimits) on one input. Pure.
//
// The sum point is STACK_SUM_POINT_M in front of the stack's front, on its center line, level with the
// highest band's center (on the horn's or tweeter's axis). A band's path there sets its delay and its level against the
// distance (1/r); the levels are moved back to 1 m, so a stack reads on the same axes as a speaker.
//
// An auto delay puts the member in phase with the member it crosses (one's lowpass and the other's highpass within an
// octave) at their crossover, at the listening point: the crossovers' share wrapped to a turn, each crossing band's own phase unwrapped
// from its loudest point, and the paths. It leaves out the members' polarity, so it never undoes an inverted one. It
// solves for the relative delay; where the auto member would have to play early, the others wait instead (every delay
// moves up together), so no delay is below 0.
//
// Not modeled here (the Space page's): the room, the baffle step and diffraction, directivity off axis.
import type {
  BoxLoading,
  Complex,
  FrequencyPoint,
  SpeakerBand,
  SpeakerBandResponse,
  SpeakerResponse,
  SpeakerSpec,
  StackLimits,
  StackMember,
  StackMemberResponse,
  StackResponse,
  StackSpec,
} from "../../types";
import { abs, add, complex, divide, levelDb } from "../acoustics/complex";
import { arrival } from "../acoustics/coverage";
import { filtersTransfer } from "./bandFilter";
import { SPEAKER_RESPONSE_FREQUENCIES, passbandDb, speakerResponse } from "./speakerResponse";
import { speakerLimits } from "./speakerLimits";
import { stackLayout, type StackPoint } from "./stackLayout";
import { SPEED_OF_SOUND } from "../../constants/acoustics";
import { METERS_PER_INCH, MS_PER_S } from "../../constants/units";
import { AUTO_DELAY, STACK_SUM_POINT_M } from "../../constants/speakerSpec";

/** A level, dB, from a pressure. */

/** A feed's sign: −1 where its polarity is inverted (a save from before it has none: 1). */
export const polaritySign = (feed: Pick<StackMember, "invertPolarity">) =>
  feed.invertPolarity ? -1 : 1;

/** A member's gain on its feed: its level as a ratio, with its polarity's sign. */
export const memberGain = (member: Pick<StackMember, "levelDb" | "invertPolarity">) =>
  polaritySign(member) * Math.pow(10, member.levelDb / 20);

/** The speaker as a stack member feeds it: its input range is the member's crossover. */
export const memberSpeaker = (member: Pick<StackMember, "crossover">, speaker: SpeakerSpec) => ({
  ...speaker,
  input: member.crossover,
});

/** How far apart one member's lowpass and another's highpass can be, octaves, and still be a crossover between them. */
const CROSSOVER_OCTAVES = 1;

/** An angle wrapped to ±π. */
const wrapAngle = (a: number) => a - 2 * Math.PI * Math.round(a / (2 * Math.PI));

/** A complex number's angle, radians. */
const angleOf = (p: Complex) => Math.atan2(p.im, p.re);

/**
 * Where two members cross, Hz: one's lowpass and the other's highpass within CROSSOVER_OCTAVES, at the middle of the
 * two corners; null where they don't.
 */
export function crossoverHz(
  a: Pick<StackMember, "crossover">,
  b: Pick<StackMember, "crossover">,
): number | null {
  const pair = (
    lp: StackMember["crossover"]["lowpass"],
    hp: StackMember["crossover"]["highpass"],
  ) =>
    lp && hp && Math.abs(Math.log2(lp.hz / hp.hz)) <= CROSSOVER_OCTAVES
      ? Math.sqrt(lp.hz * hp.hz)
      : null;
  return (
    pair(a.crossover.lowpass, b.crossover.highpass) ??
    pair(b.crossover.lowpass, a.crossover.highpass)
  );
}

/** Where one part's lowpass meets another's: the parts by index (the lowpass's is the lower one), and where, Hz. */
export interface CrossingPair {
  lower: number;
  upper: number;
  hz: number;
}

/**
 * Each pair of parts that crosses, one way round: the part whose lowpass meets the other's highpass (`crossoverHz`) is
 * the lower one (lib/speaker/keepUp's checks, and the crossovers below).
 */
export function crossingPairs(filters: readonly Pick<StackMember, "crossover">[]): CrossingPair[] {
  return filters.flatMap((a, i) =>
    filters.flatMap((b, j) => {
      const lowpass = a.crossover.lowpass,
        highpass = b.crossover.highpass;
      if (i === j || !lowpass || !highpass) return [];
      const hz = crossoverHz(
        { crossover: { lowpass, highpass: null } },
        { crossover: { lowpass: null, highpass } },
      );
      return hz === null ? [] : [{ lower: i, upper: j, hz }];
    }),
  );
}

/**
 * A stack's crossovers, Hz, low to high: every pair of bands in a member's speaker, or of members, whose lowpass and
 * highpass meet (`crossoverHz`), once each (rounded to 1 Hz). The dispersion maps mark them; the Space's Band balance
 * steps at them.
 */
export function stackCrossoversHz(
  stack: Pick<StackSpec, "members">,
  speakers: readonly Pick<SpeakerSpec, "id" | "bands">[],
): number[] {
  const asFilter = (b: Pick<SpeakerBand, "highpass" | "lowpass">) => ({
    crossover: { highpass: b.highpass, lowpass: b.lowpass },
  });
  const lists = [
    stack.members,
    ...[...new Set(stack.members.map((m) => m.speakerId))].map(
      (id) => speakers.find((s) => s.id === id)?.bands.map(asFilter) ?? [],
    ),
  ];
  const out = new Set(lists.flatMap((list) => crossingPairs(list).map((c) => Math.round(c.hz))));
  return [...out].sort((x, y) => x - y);
}

/** A value of `ys` (one per grid frequency) read at `f` between grid points on a log-frequency axis. */
function atFrequency(ys: readonly number[], f: number) {
  const freqs = SPEAKER_RESPONSE_FREQUENCIES;
  const i = Math.min(
    freqs.length - 1,
    Math.max(
      1,
      freqs.findIndex((x) => x >= f),
    ),
  );
  const k = Math.log(f / freqs[i - 1]) / Math.log(freqs[i] / freqs[i - 1]);
  return ys[i - 1] + k * (ys[i] - ys[i - 1]);
}

/**
 * A band's own phase at each grid frequency, radians: its box and its own filters (the member's crossover taken out),
 * unwrapped along the grid from its loudest point, where it is taken within ±π.
 */
function ownPhase(band: SpeakerBandResponse, crossover: StackMember["crossover"]) {
  const freqs = SPEAKER_RESPONSE_FREQUENCIES;
  const own = band.pressure.map((p, i) => divide(p, filtersTransfer(freqs[i], crossover)));
  let top = 0;
  for (let i = 1; i < own.length; i++) if (abs(own[i]) > abs(own[top])) top = i;
  const out = own.map(() => 0);
  out[top] = angleOf(own[top]);
  for (let i = top + 1; i < own.length; i++)
    out[i] = out[i - 1] + wrapAngle(angleOf(own[i]) - angleOf(own[i - 1]));
  for (let i = top - 1; i >= 0; i--)
    out[i] = out[i + 1] + wrapAngle(angleOf(own[i]) - angleOf(own[i + 1]));
  return out;
}

/** One member as the alignment reads it: its response through its crossover, and each band's path, m. */
interface MemberModel {
  response: SpeakerResponse;
  paths: Map<SpeakerBandResponse["id"], number>;
}

/**
 * How much later member `a` must play than member `b` to be in phase with it at their crossover `f0` at the listening
 * point, ms (negative: `b` waits): from the band of each that carries the most there (the mid at the sub crossover),
 * the crossovers' share wrapped to a turn, the bands' own phases and their paths. Null where either is silent there.
 */
function alignMs(
  a: { member: StackMember; model: MemberModel },
  b: { member: StackMember; model: MemberModel },
  f0: number,
): number | null {
  const freqs = SPEAKER_RESPONSE_FREQUENCIES;
  const near = freqs.reduce(
    (best, f, i) => (Math.abs(Math.log(f / f0)) < Math.abs(Math.log(freqs[best] / f0)) ? i : best),
    0,
  );
  const phase = ({ member, model }: typeof a) => {
    const band = model.response.bands.reduce<SpeakerBandResponse | null>(
      (best, x) => (!best || abs(x.pressure[near]) > abs(best.pressure[near]) ? x : best),
      null,
    );
    if (!band || abs(band.pressure[near]) === 0) return null;
    const path = model.paths.get(band.id) ?? STACK_SUM_POINT_M;
    return {
      crossover: angleOf(filtersTransfer(f0, member.crossover)),
      rest:
        atFrequency(ownPhase(band, member.crossover), f0) -
        (2 * Math.PI * f0 * (path - STACK_SUM_POINT_M)) / SPEED_OF_SOUND,
    };
  };
  const pa = phase(a),
    pb = phase(b);
  if (!pa || !pb) return null;
  const lead = wrapAngle(pa.crossover - pb.crossover) + pa.rest - pb.rest;
  return (lead / (2 * Math.PI * f0)) * MS_PER_S;
}

/**
 * Each member's delay, ms: its own, or an auto one in phase with a member it crosses whose delay is known (set, or
 * worked out first); an auto member that crosses none takes 0. Then every delay moves up together until none is below
 * 0 (the others wait for an auto member that has to play early). Null for a member that isn't modeled.
 */
function memberDelays(
  members: readonly StackMember[],
  models: readonly (MemberModel | null)[],
): (number | null)[] {
  const delays = members.map((m, k) => (models[k] && m.delayMs !== AUTO_DELAY ? m.delayMs : null));
  const pending = new Set(
    members.flatMap((m, k) => (models[k] && m.delayMs === AUTO_DELAY ? [k] : [])),
  );
  while (pending.size) {
    let done = false;
    for (const k of pending) {
      const model = models[k];
      if (!model) continue;
      for (const [j, other] of models.entries()) {
        const known = delays[j];
        const f0 = crossoverHz(members[k], members[j]);
        if (!other || known === null || j === k || f0 === null) continue;
        const ms = alignMs({ member: members[k], model }, { member: members[j], model: other }, f0);
        if (ms === null) continue;
        delays[k] = known + ms;
        pending.delete(k);
        done = true;
        break;
      }
    }
    // none crosses a member with a known delay: the first left starts at 0, and the rest align to it
    if (!done) {
      const [first] = pending;
      delays[first] = 0;
      pending.delete(first);
    }
  }
  const lowest = Math.min(0, ...delays.filter((d) => d !== null));
  return delays.map((d) => (d === null ? null : d - lowest));
}

/** A point's path to the listening point, m. */
const pathM = (p: StackPoint, listenHeightIn: number) => {
  const d = STACK_SUM_POINT_M / METERS_PER_INCH;
  return Math.hypot(p.x, p.y - listenHeightIn, d + p.z) * METERS_PER_INCH;
};

/** The listening point's height above the stack's base, in: the highest band's center (0 with none). */
const listenHeightOf = (placed: ReturnType<typeof stackLayout>) => {
  const centers = placed.flatMap((m) => m.bands.map((b) => b.center.y));
  return centers.length ? Math.max(...centers) : 0;
};

/**
 * The stack at its listening point, moved to 1 m: each member's speaker through its crossover, level, polarity, delay
 * and its bands' paths, summed with their phase. A member whose speaker isn't in `speakers` is left out (null).
 * `loading` is each member's horn load where it stands (the Space page's); a member without one is alone in half space.
 */
export function stackResponse(
  stack: Pick<StackSpec, "members">,
  speakers: readonly SpeakerSpec[],
  loading: readonly (BoxLoading | undefined)[] = [],
): StackResponse {
  const freqs = SPEAKER_RESPONSE_FREQUENCIES;
  const placed = stackLayout(stack, speakers);
  const listenHeightIn = listenHeightOf(placed);
  const models = placed.map((m, k) => {
    if (!m.speaker) return null;
    const speaker = memberSpeaker(stack.members[k], m.speaker);
    const response = speakerResponse(speaker, { feed: speaker.input, loading: loading[k] });
    const paths = new Map(m.bands.map((b) => [b.id, pathM(b.center, listenHeightIn)]));
    return { speaker, response, paths };
  });
  const delays = memberDelays(stack.members, models);
  let total = freqs.map(() => complex(0));
  const members = models.map((m, k): StackMemberResponse | null => {
    const delayMs = delays[k];
    if (!m || delayMs === null) return null;
    const gain = memberGain(stack.members[k]);
    let pressure = freqs.map(() => complex(0));
    for (const band of m.response.bands) {
      const path = m.paths.get(band.id) ?? STACK_SUM_POINT_M;
      // the spreading against the listening distance, and the time: the path's and the delay's
      pressure = pressure.map((p, i) =>
        add(
          p,
          arrival(band.pressure[i], freqs[i], gain, path, STACK_SUM_POINT_M, delayMs / MS_PER_S),
        ),
      );
    }
    total = total.map((p, i) => add(p, pressure[i]));
    return {
      ...m,
      delayMs,
      curve: pressure.map((p, i) => ({ f: freqs[i], spl: levelDb(p) })),
      pressure,
    };
  });
  return {
    sum: total.map((p, i) => ({ f: freqs[i], spl: levelDb(p) })),
    members,
    listenHeightIn,
  };
}

/**
 * The stack at its limits with one input: each member's limits on its crossover (lib/speaker/speakerLimits with
 * `stackCrossover`: the crossover is ahead of its amps), its level against the stack's input; at each frequency the
 * member with the least headroom sets the stack's level, and every member plays at that input (`atLimit`). For music,
 * the band of a member whose music limit leaves the least headroom over its passband sets the stack's level.
 */
export function stackLimits(
  stack: Pick<StackSpec, "members">,
  response: StackResponse,
): StackLimits {
  const runs = response.members.map((m, k) =>
    m
      ? {
          k,
          m,
          levelDb: stack.members[k].levelDb,
          limits: speakerLimits(m.speaker, m.response, {
            feed: m.speaker.input,
            stackCrossover: true,
          }),
        }
      : null,
  );
  type Run = NonNullable<(typeof runs)[number]>;
  const live = runs.filter((r): r is Run => r !== null && r.limits.sum.length > 0);
  /** a member's headroom over the stack's input at point `i`, dB: its own, less its level */
  const roomOf = (r: Run, i: number) =>
    (r.limits.sum[i]?.spl ?? Infinity) - (r.m.response.sum[i]?.spl ?? 0) - r.levelDb;
  /** at each of the response's points: the member with the least headroom, and the stack's headroom, dB */
  const points = live.length
    ? response.sum.map((o, i) => {
        const first = live.reduce((a, b) => (roomOf(b, i) < roomOf(a, i) ? b : a));
        return { o, first, room: roomOf(first, i), limit: first.limits.sum[i] };
      })
    : [];
  const sum: StackLimits["sum"] = points.flatMap(({ o, first, room, limit }) =>
    limit ? [{ f: o.f, spl: o.spl + room, who: limit.who, member: first.k, band: limit.band }] : [],
  );
  // for music: each member's bands, their music limit over their passband, less the member's level
  const music = live.flatMap((r) =>
    r.limits.bands.map((b) => ({
      member: r.k,
      band: b.id,
      roomDb:
        b.musicDb - (r.m.response.bands.find((rb) => rb.id === b.id)?.passbandDb ?? 0) - r.levelDb,
    })),
  );
  const first = music.length ? music.reduce((a, b) => (b.roomDb < a.roomDb ? b : a)) : null;
  return {
    sum,
    members: runs.map((r) =>
      r
        ? {
            limits: r.limits,
            // every member at the stack's input: its curve and the stack's headroom, point by point
            atLimit: points.map((p, i): FrequencyPoint => ({
              f: p.o.f,
              spl: (r.m.curve[i]?.spl ?? 0) + p.room,
            })),
          }
        : null,
    ),
    bands: music,
    musicDb: first ? passbandDb(response.sum) + first.roomDb : null,
    member: first ? first.member : null,
    band: first ? first.band : null,
  };
}
