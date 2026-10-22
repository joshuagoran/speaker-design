// Calculate gains: a speaker's band Gains and Pads, or a stack's box Gains, always flat:
//
// - The bands (or, in a stack, the boxes) go in order of their passband (the middle of where each is within 3 dB of its
//   highest point).
// - Each pair next to each other meets at their crossover: the lower one's lowpass and the upper one's highpass. A
//   band's own filters count; a feed's filter (the input range) counts only where it cuts into the band next to it, so a
//   protective filter on the input is not a crossover. Each is read at its own corner (at the other one's corner when it
//   has none), so a gapped crossover reads each where it still plays, not deep in both skirts between the corners. There
//   both play at the same level. Two with no filter between them (they overlap) meet at equal level, at the middle of
//   their passbands.
// - The levels are then moved together so that the highest is 0 dB: every Pad is 0 dB or less.
//
// A speaker's band is read on its own response at 2.83 V with its level taken out (lib/speaker/speakerResponse), so
// its driver's sensitivity sets it. A stack's box is read on its speaker's whole response through the box's crossover
// (lib/speaker/stackResponse), its band levels as they are: the stack sets only the boxes' Gains, never the bands'.
// Pure.
import type {
  BandId,
  FrequencyPoint,
  SpeakerBand,
  SpeakerResponse,
  SpeakerSpec,
  StackDesign,
  StackMember,
  StackResponse,
} from "../../types";
import { curveLevelAt } from "../acoustics/coverage";
import { bandLevelDb, withPadCapped } from "./bandLevel";
import { passbandCenterHz, passbandEdgesHz, speakerResponse } from "./speakerResponse";
import { AUTO_BALANCE_STATUS } from "../../constants/autoBalance";

/** One band (or box) as the balance reads it: its response with its level taken out, and the corners it plays between. */
export interface BalanceBand<K> {
  key: K;
  curve: readonly FrequencyPoint[];
  /** its own lowpass and highpass corners, Hz; null: none */
  lowpassHz: number | null;
  highpassHz: number | null;
  /**
   * its feed's lowpass and highpass corners, Hz (the input range; in a stack, the member's crossover): a band's crossover
   * only against a band next to it that plays across the corner (`crossoverCorners`); absent or null: none
   */
  feedLowpassHz?: number | null;
  feedHighpassHz?: number | null;
}

/** The lowest of some lowpass corners, Hz; null with none. */
const lowestHz = (hz: readonly (number | null)[]) => {
  const at = hz.filter((f) => f !== null);
  return at.length ? Math.min(...at) : null;
};
/** The highest of some highpass corners, Hz; null with none. */
const highestHz = (hz: readonly (number | null)[]) => {
  const at = hz.filter((f) => f !== null);
  return at.length ? Math.max(...at) : null;
};

/**
 * The corners two bands next to each other cross over at, Hz: the lower band's lowpass and the upper band's highpass;
 * null: none. A band's own filter always counts. A feed's filter counts only where it cuts into the other band: the upper
 * band's feed highpass above the bottom of the lower band's passband, the lower band's feed lowpass below the top of the
 * upper band's. A feed filter both bands take (a speaker's input range on all its bands, a member's crossover on its
 * speaker's bands) is outside both passbands: it protects the drivers, it is not a crossover between them.
 */
function crossoverCorners<K>(lower: BalanceBand<K>, upper: BalanceBand<K>) {
  const lowerPass = passbandEdgesHz(lower.curve),
    upperPass = passbandEdgesHz(upper.curve);
  const feedLowpass = lower.feedLowpassHz ?? null,
    feedHighpass = upper.feedHighpassHz ?? null;
  return {
    lowpassHz: lowestHz([
      lower.lowpassHz,
      feedLowpass !== null && upperPass && feedLowpass < upperPass.highHz ? feedLowpass : null,
    ]),
    highpassHz: highestHz([
      upper.highpassHz,
      feedHighpass !== null && lowerPass && feedHighpass > lowerPass.lowHz ? feedHighpass : null,
    ]),
  };
}

/**
 * Where two bands next to each other are read, Hz. With a filter, each band at its own corner, inside its own passband
 * (at the other band's corner when it has none): corners far apart (a gapped crossover) read each band where it still
 * plays, not deep in both skirts between them. With none (they overlap), both at the middle of their passbands.
 */
function meetingPoint<K>(lower: BalanceBand<K>, upper: BalanceBand<K>) {
  const { lowpassHz, highpassHz } = crossoverCorners(lower, upper);
  const lowerHz = lowpassHz ?? highpassHz,
    upperHz = highpassHz ?? lowpassHz;
  if (lowerHz === null || upperHz === null) {
    const hz = Math.sqrt(passbandCenterHz(lower.curve) * passbandCenterHz(upper.curve));
    return { lowerHz: hz, upperHz: hz };
  }
  return { lowerHz, upperHz };
}

/**
 * Each band's level, dB, the highest 0, by the chain at the crossovers (see the file's head); null for fewer than two
 * bands, or where a band's curve has no level where it is read (a corner outside the model's frequency range).
 */
export function chainLevels<K>(
  bands: readonly BalanceBand<K>[],
): { key: K; levelDb: number }[] | null {
  if (bands.length < 2) return null;
  const ordered = bands
    .map((b) => ({ b, center: passbandCenterHz(b.curve) }))
    .sort((x, y) => x.center - y.center)
    .map((o) => o.b);
  const raw = [0];
  for (let i = 1; i < ordered.length; i++) {
    const lower = ordered[i - 1],
      upper = ordered[i];
    const { lowerHz, upperHz } = meetingPoint(lower, upper);
    const lo = curveLevelAt(lower.curve, lowerHz),
      hi = curveLevelAt(upper.curve, upperHz);
    if (lo === null || hi === null) return null;
    // the upper band at the lower one's level where they meet
    raw.push(raw[i - 1] + lo - hi);
  }
  const top = Math.max(...raw);
  return ordered.map((b, i) => ({ key: b.key, levelDb: raw[i] - top }));
}

/** The bands a driver feeds: a band no driver names plays nothing, so the balance leaves it as it is. */
const fedBands = (spec: Pick<SpeakerSpec, "cabinet">) =>
  new Set(spec.cabinet.chambers.flatMap((c) => c.drivers.flatMap((d) => d.bands)));

/**
 * A speaker's bands as the balance reads them, from its response; and the fed bands the response has no model for (a
 * driver with no data, a filter corner that is not a positive frequency).
 */
function speakerBands(
  spec: Pick<SpeakerSpec, "cabinet" | "bands" | "input">,
  response: Pick<SpeakerResponse, "bands">,
) {
  const fed = fedBands(spec);
  const bands: BalanceBand<BandId>[] = [];
  const unmodeled: SpeakerBand[] = [];
  for (const band of spec.bands) {
    if (!fed.has(band.id)) continue;
    const modeled = response.bands.find((b) => b.id === band.id);
    if (!modeled) {
      unmodeled.push(band);
      continue;
    }
    bands.push({
      key: band.id,
      curve: modeled.curve.map((o) => ({ f: o.f, spl: o.spl - bandLevelDb(band) })),
      lowpassHz: band.lowpass?.hz ?? null,
      highpassHz: band.highpass?.hz ?? null,
      feedLowpassHz: spec.input.lowpass?.hz ?? null,
      feedHighpassHz: spec.input.highpass?.hz ?? null,
    });
  }
  return { bands, unmodeled };
}

/** What Calculate gains gives: the levels to set, or why the levels stay. */
export type AutoBalance<L> =
  | { status: typeof AUTO_BALANCE_STATUS.balanced; levels: L }
  | { status: typeof AUTO_BALANCE_STATUS.oneBand }
  | { status: typeof AUTO_BALANCE_STATUS.outOfRange }
  | {
      status: typeof AUTO_BALANCE_STATUS.unmodeled;
      /** the bands the model leaves out, by name (in a stack, with their speaker's name) */
      names: string[];
    };

/** A speaker's balanced Levels, by band id. */
export type SpeakerLevels = Record<BandId, SpeakerBand["levelDb"]>;

/**
 * The speaker's bands balanced flat, from its response (`speakerResponse` with its input range as the feed): each active
 * band's Gain and each passive band's Pad. The levels stay when it has fewer than two modeled bands, when a band a driver feeds has no model, or when a crossover is
 * outside the model's frequency range.
 */
export function autoBalanceSpeaker(
  spec: Pick<SpeakerSpec, "cabinet" | "bands" | "input">,
  response: Pick<SpeakerResponse, "bands">,
): AutoBalance<SpeakerLevels> {
  const { bands, unmodeled } = speakerBands(spec, response);
  if (unmodeled.length)
    return { status: AUTO_BALANCE_STATUS.unmodeled, names: unmodeled.map((b) => b.name) };
  if (bands.length < 2) return { status: AUTO_BALANCE_STATUS.oneBand };
  const chain = chainLevels(bands);
  if (!chain) return { status: AUTO_BALANCE_STATUS.outOfRange };
  return {
    status: AUTO_BALANCE_STATUS.balanced,
    levels: Object.fromEntries(chain.map((o) => [o.key, o.levelDb])),
  };
}

/** The speaker with these Levels in its bands; a band without one keeps its own. */
export const withSpeakerLevels = <S extends Pick<SpeakerSpec, "bands">>(
  spec: S,
  levels: SpeakerLevels,
): S => ({
  ...spec,
  bands: spec.bands.map((b) => {
    const db = levels[b.id];
    return db === undefined ? b : withPadCapped({ ...b, levelDb: db });
  }),
});

/** The speaker with its bands at the Gains and Pads Calculate gains gives, flat; as it is when it can't balance. */
export function withCalculatedBandGains(spec: SpeakerSpec): SpeakerSpec {
  const balance = autoBalanceSpeaker(spec, speakerResponse(spec, { feed: spec.input }));
  return balance.status === AUTO_BALANCE_STATUS.balanced
    ? withSpeakerLevels(spec, balance.levels)
    : spec;
}

/** A stack's balanced Gains: each member's, dB, in the stack's order. */
export type StackLevels = StackMember["levelDb"][];

/**
 * The stack's boxes balanced flat against each other, from its response (`stackResponse`): each member's speaker, its
 * band levels as they are, through the member's crossover. Only the members' Gains change. The Gains stay when there
 * are fewer than two modeled members, or when a crossover is outside the model's frequency range.
 */
export function autoBalanceStack(
  design: { stack: Pick<StackDesign["stack"], "members"> },
  response: Pick<StackResponse, "members">,
): AutoBalance<StackLevels> {
  const boxes: BalanceBand<number>[] = [];
  design.stack.members.forEach((member, k) => {
    const run = response.members[k];
    if (!run || !run.response.sum.length) return;
    boxes.push({
      key: k,
      curve: run.response.sum,
      lowpassHz: member.crossover.lowpass?.hz ?? null,
      highpassHz: member.crossover.highpass?.hz ?? null,
    });
  });
  if (boxes.length < 2) return { status: AUTO_BALANCE_STATUS.oneBand };
  const chain = chainLevels(boxes);
  if (!chain) return { status: AUTO_BALANCE_STATUS.outOfRange };
  const levels: StackLevels = design.stack.members.map((m) => m.levelDb);
  for (const { key, levelDb } of chain) levels[key] = levelDb;
  return { status: AUTO_BALANCE_STATUS.balanced, levels };
}

/** The stack with these Gains on its members; the speakers' bands stay as they are. */
export function withStackLevels<D extends Pick<StackDesign, "stack">>(
  design: D,
  levels: StackLevels,
): D {
  return {
    ...design,
    stack: {
      ...design.stack,
      members: design.stack.members.map((m, k) => ({ ...m, levelDb: levels[k] ?? m.levelDb })),
    },
  };
}
