// The stack model: speakers in a fixed relationship, summed at a listening point. Each member is its speaker through
// the speaker model (lib/speaker/speakerResponse) with the member's crossover as its input range; then the member's
// level and delay, and each band's path to the listening point; the members summed with their phase. Its limits take
// each member's own (lib/speaker/speakerLimits) on one input. Pure.
//
// The listening point is STACK_LISTEN_DISTANCE_M in front of the stack's front, on its center line, level with the
// highest band's center (on the horn's or tweeter's axis). A band's path there sets its delay and its level against the
// distance (1/r); the levels are moved back to 1 m, so a stack reads on the same axes as a speaker. An auto delay lines
// a member's path up with the latest member that has a delay set (all auto: the farthest); it never goes below 0.
//
// Not modeled here (the Space page's): the room, the baffle step and diffraction, directivity off axis.
import type {
  Complex,
  FrequencyPoint,
  SpeakerSpec,
  StackLimits,
  StackMember,
  StackMemberResponse,
  StackResponse,
  StackSpec,
} from "../../types";
import { abs, add, complex, multiply, phasor, scale } from "../acoustics/complex";
import { SPEAKER_RESPONSE_FREQUENCIES, passbandDb, speakerResponse } from "./speakerResponse";
import { speakerLimits } from "./speakerLimits";
import { stackLayout, type StackPoint } from "./stackLayout";
import { SPEED_OF_SOUND } from "../../constants/acoustics";
import { METERS_PER_INCH } from "../../constants/units";
import { AUTO_DELAY, STACK_LISTEN_DISTANCE_M } from "../../constants/speakerSpec";

/** A level, dB, from a pressure. */
const levelOf = (p: Complex) => 20 * Math.log10(Math.max(1e-9, abs(p)));

/** Milliseconds in a second. */
const MS_PER_S = 1000;

/** The speaker as a stack member feeds it: its input range is the member's crossover. */
export const memberSpeaker = (member: Pick<StackMember, "crossover">, speaker: SpeakerSpec) => ({
  ...speaker,
  input: member.crossover,
});

/** A point's path to the listening point, m. */
const pathM = (p: StackPoint, listenHeightIn: number) => {
  const d = STACK_LISTEN_DISTANCE_M / METERS_PER_INCH;
  return Math.hypot(p.x, p.y - listenHeightIn, d + p.z) * METERS_PER_INCH;
};

/**
 * The stack at its listening point, moved to 1 m: each member's speaker through its crossover, level, delay and its
 * bands' paths, summed with their phase. A member whose speaker isn't in `speakers` is left out (null).
 */
export function stackResponse(
  stack: Pick<StackSpec, "members">,
  speakers: readonly SpeakerSpec[],
): StackResponse {
  const freqs = SPEAKER_RESPONSE_FREQUENCIES;
  const placed = stackLayout(stack, speakers);
  const centers = placed.flatMap((m) => m.bands.map((b) => b.center.y));
  const listenHeightIn = centers.length ? Math.max(...centers) : 0;
  const models = placed.map((m, k) => {
    if (!m.speaker) return null;
    const speaker = memberSpeaker(stack.members[k], m.speaker);
    const response = speakerResponse(speaker, { feed: speaker.input });
    const paths = new Map(m.bands.map((b) => [b.id, pathM(b.center, listenHeightIn)]));
    const modeled = response.bands.flatMap((b) => paths.get(b.id) ?? []);
    const mean = modeled.length
      ? modeled.reduce((sum, p) => sum + p, 0) / modeled.length
      : STACK_LISTEN_DISTANCE_M;
    return { speaker, response, paths, pathM: mean };
  });
  // the auto delays: each such member's path lined up with the latest set one's (all auto: the farthest)
  const arrivalMs = (pathM: number) => (pathM / SPEED_OF_SOUND) * MS_PER_S;
  const set = models.flatMap((m, k) => {
    const delay = stack.members[k].delayMs;
    return m && delay !== AUTO_DELAY ? [arrivalMs(m.pathM) + delay] : [];
  });
  const target = set.length
    ? Math.max(...set)
    : Math.max(0, ...models.flatMap((m) => (m ? [arrivalMs(m.pathM)] : [])));
  let total = freqs.map(() => complex(0));
  const members = models.map((m, k): StackMemberResponse | null => {
    if (!m) return null;
    const { levelDb, delayMs: delay } = stack.members[k];
    const delayMs = delay === AUTO_DELAY ? Math.max(0, target - arrivalMs(m.pathM)) : delay;
    const gain = Math.pow(10, levelDb / 20);
    let pressure = freqs.map(() => complex(0));
    for (const band of m.response.bands) {
      const path = m.paths.get(band.id) ?? STACK_LISTEN_DISTANCE_M;
      // the spreading against the listening distance, and the time: the path's and the delay's
      const k1 = (gain * STACK_LISTEN_DISTANCE_M) / path;
      const seconds = (path - STACK_LISTEN_DISTANCE_M) / SPEED_OF_SOUND + delayMs / MS_PER_S;
      pressure = pressure.map((p, i) =>
        add(p, multiply(scale(band.pressure[i], k1), phasor(-2 * Math.PI * freqs[i] * seconds))),
      );
    }
    total = total.map((p, i) => add(p, pressure[i]));
    return {
      ...m,
      delayMs,
      curve: pressure.map((p, i) => ({ f: freqs[i], spl: levelOf(p) })),
      pressure,
    };
  });
  return {
    sum: total.map((p, i) => ({ f: freqs[i], spl: levelOf(p) })),
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
  const sum: StackLimits["sum"] = [];
  for (const [i, o] of response.sum.entries()) {
    const first = live.reduce<Run | null>(
      (a, b) => (a && roomOf(a, i) <= roomOf(b, i) ? a : b),
      null,
    );
    const point = first?.limits.sum[i];
    if (!first || !point) continue;
    sum.push({
      f: o.f,
      spl: o.spl + roomOf(first, i),
      who: point.who,
      member: first.k,
      band: point.band,
    });
  }
  /** the stack's headroom at point `i`, dB */
  const stackRoom = (i: number) => (sum[i]?.spl ?? 0) - (response.sum[i]?.spl ?? 0);
  // for music: each member's bands, their music limit over their passband, less the member's level
  const music = live.flatMap((r) =>
    r.limits.bands.map((b) => ({
      member: r.k,
      band: b.id,
      room:
        b.musicDb - (r.m.response.bands.find((rb) => rb.id === b.id)?.passbandDb ?? 0) - r.levelDb,
    })),
  );
  const first = music.length ? music.reduce((a, b) => (b.room < a.room ? b : a)) : null;
  return {
    sum,
    members: runs.map((r) =>
      r
        ? {
            limits: r.limits,
            atLimit: sum.length
              ? r.m.curve.map((o, i): FrequencyPoint => ({ f: o.f, spl: o.spl + stackRoom(i) }))
              : [],
          }
        : null,
    ),
    musicDb: first ? passbandDb(response.sum) + first.room : null,
    member: first ? first.member : null,
    band: first ? first.band : null,
  };
}
