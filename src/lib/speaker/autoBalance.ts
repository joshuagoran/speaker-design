// Auto balance: band Levels for any speaker or stack, flat or with the PA music tilt (docs/speaker-designer-plan.md, L3f
// "Auto balance").
// By default the bands meet flat; the PA music tilt option is the PA music balance (lib/speaker/paBalance), made general for any
// number and order of bands:
//
// - The bands go in order of their passband (the middle of where each is within 3 dB of its highest point).
// - Each pair of bands next to each other meets at their crossover: the lower band's lowpass and the upper band's
//   highpass. A band's own filters count; a feed's filter (the input range, in a stack the member's crossover) counts
//   only where it cuts into the band next to it, so a protective filter on the input is not a crossover. Each band is
//   read at its own corner (at the other band's corner when it has none), so a gapped crossover reads each band where it
//   still plays, not deep in both skirts between the corners. There the upper band is set the tilt below the lower one.
//   Flat (the default): 0 dB, the same level. PA music tilt: `tilt` dB at a crossover (the geometric mean of the
//   corners) up to the PA's highest sub crossover (the mid below the sub), `hfTilt` dB above it (the horn below the
//   mid). Two bands with no filter between them (they overlap) meet at equal level, at the middle of their passbands.
// - The Levels are then moved together so that the highest is 0 dB.
//
// Each band is read on its own response at 2.83 V with its Level taken out (lib/speaker/speakerResponse; in a stack,
// each member's speaker through its crossover, lib/speaker/stackResponse). One input drives every band, so a band's
// limit sets only how loud the whole design can play, not where its bands sit against each other: with the PA music tilt,
// the PA music balance at the bands' limits comes to the same Levels (tests/auto-balance.test.ts checks it on the PA
// presets).
// Pure.
import type {
  BandFilter,
  BandId,
  FrequencyPoint,
  MusicBalance,
  SpeakerBand,
  SpeakerResponse,
  SpeakerSpec,
  StackDesign,
  StackMember,
  StackResponse,
} from "../../types";
import { curveLevelAt } from "../acoustics/coverage";
import { passbandCenterHz, passbandEdgesHz } from "./speakerResponse";
import { DEFAULT_PA } from "../defaults";
import { PA_SLIDERS } from "../../constants/paSliders";
import {
  AUTO_BALANCE_MODE,
  AUTO_BALANCE_STATUS,
  AUTO_BALANCE_TEXT,
  type AutoBalanceMode,
} from "../../constants/autoBalance";

/** The tilt: how far a band sits below the band under it at their crossover, dB (the PA design's saved keys). */
export type MusicTilt = Pick<MusicBalance, "tilt" | "hfTilt">;

/** Flat (the default): every band at the same level at each crossover. */
export const FLAT_TILT: MusicTilt = { tilt: 0, hfTilt: 0 };

/** The PA music tilt, the default PA design's music balance: the mid 6 dB below the sub, the horn 3 dB below the mid. */
export const PA_MUSIC_TILT: MusicTilt = { tilt: DEFAULT_PA.tilt, hfTilt: DEFAULT_PA.hfTilt };

/** The tilt each auto balance option sets. */
export const AUTO_BALANCE_TILT: Record<AutoBalanceMode, MusicTilt> = {
  [AUTO_BALANCE_MODE.flat]: FLAT_TILT,
  [AUTO_BALANCE_MODE.moreBass]: PA_MUSIC_TILT,
};

/** The highest crossover that takes `tilt` (a crossover to a sub), Hz: the PA designs' highest sub-to-mid crossover. */
export const SUB_CROSSOVER_MAX_HZ = PA_SLIDERS.xoLo.max;

/** The Band balance tooltip: what each option does, with the numbers of the PA music tilt. */
export const BAND_BALANCE_TIP = AUTO_BALANCE_TEXT.tip(
  PA_MUSIC_TILT.tilt,
  PA_MUSIC_TILT.hfTilt,
  SUB_CROSSOVER_MAX_HZ,
);

/** How far the band above a crossover at `hz` sits below the band under it, dB. */
export const tiltAt = (hz: number, tilt: MusicTilt) =>
  hz <= SUB_CROSSOVER_MAX_HZ ? tilt.tilt : tilt.hfTilt;

/** One band as the balance reads it: its response with its Level taken out, and the corners it plays between. */
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
 * Where two bands next to each other are read, Hz, and the crossover the tilt goes by (null: no filter between them, no
 * tilt). With a filter, each band at its own corner, inside its own passband (at the other band's corner when it has
 * none), and the crossover is the geometric mean of the corners: corners far apart (a gapped crossover) read each band
 * where it still plays, not deep in both skirts at the mean. With none (they overlap), both at the middle of their
 * passbands.
 */
function meetingPoint<K>(lower: BalanceBand<K>, upper: BalanceBand<K>) {
  const { lowpassHz, highpassHz } = crossoverCorners(lower, upper);
  const lowerHz = lowpassHz ?? highpassHz,
    upperHz = highpassHz ?? lowpassHz;
  if (lowerHz === null || upperHz === null) {
    const hz = Math.sqrt(passbandCenterHz(lower.curve) * passbandCenterHz(upper.curve));
    return { lowerHz: hz, upperHz: hz, crossoverHz: null };
  }
  return { lowerHz, upperHz, crossoverHz: Math.sqrt(lowerHz * upperHz) };
}

/**
 * Each band's Level, dB, the highest 0, by the chain at the crossovers (see the file's head); null for fewer than two
 * bands, or where a band's curve has no level where it is read (a corner outside the model's frequency range).
 */
export function chainLevels<K>(
  bands: readonly BalanceBand<K>[],
  tilt: MusicTilt = FLAT_TILT,
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
    const { lowerHz, upperHz, crossoverHz } = meetingPoint(lower, upper);
    const lo = curveLevelAt(lower.curve, lowerHz),
      hi = curveLevelAt(upper.curve, upperHz);
    if (lo === null || hi === null) return null;
    // the upper band's level at the crossover: the lower one's, less the tilt
    raw.push(raw[i - 1] + lo - hi - (crossoverHz === null ? 0 : tiltAt(crossoverHz, tilt)));
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
      curve: modeled.curve.map((o) => ({ f: o.f, spl: o.spl - band.levelDb })),
      lowpassHz: band.lowpass?.hz ?? null,
      highpassHz: band.highpass?.hz ?? null,
      feedLowpassHz: spec.input.lowpass?.hz ?? null,
      feedHighpassHz: spec.input.highpass?.hz ?? null,
    });
  }
  return { bands, unmodeled };
}

/** One band's name and the Level the balance gives it, dB. */
export interface BandLevel {
  name: SpeakerBand["name"];
  levelDb: SpeakerBand["levelDb"];
}

/** What an auto balance gives: the Levels to set, or why the Levels stay. */
export type AutoBalance<L> =
  | {
      status: typeof AUTO_BALANCE_STATUS.balanced;
      levels: L;
      /** the same Levels by band name, from the lowest band up (what the page shows next to the button) */
      bands: BandLevel[];
    }
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
 * The speaker's bands balanced (flat unless a tilt is given), from its response (`speakerResponse` with its input range as the feed). The
 * Levels stay when it has fewer than two modeled bands, when a band a driver feeds has no model, or when a crossover is
 * outside the model's frequency range.
 */
export function autoBalanceSpeaker(
  spec: Pick<SpeakerSpec, "cabinet" | "bands" | "input">,
  response: Pick<SpeakerResponse, "bands">,
  tilt: MusicTilt = FLAT_TILT,
): AutoBalance<SpeakerLevels> {
  const { bands, unmodeled } = speakerBands(spec, response);
  if (unmodeled.length)
    return { status: AUTO_BALANCE_STATUS.unmodeled, names: unmodeled.map((b) => b.name) };
  if (bands.length < 2) return { status: AUTO_BALANCE_STATUS.oneBand };
  const chain = chainLevels(bands, tilt);
  if (!chain) return { status: AUTO_BALANCE_STATUS.outOfRange };
  return {
    status: AUTO_BALANCE_STATUS.balanced,
    levels: Object.fromEntries(chain.map((o) => [o.key, o.levelDb])),
    bands: chain.map((o) => ({
      name: spec.bands.find((b) => b.id === o.key)?.name ?? o.key,
      levelDb: o.levelDb,
    })),
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
    return db === undefined ? b : { ...b, levelDb: db };
  }),
});

/** A stack's balanced Levels: each speaker's, by speaker id and band id. */
export type StackLevels = Record<SpeakerSpec["id"], SpeakerLevels>;

/** A band of a stack, by its speaker and its id. */
interface StackBandKey {
  speakerId: SpeakerSpec["id"];
  band: BandId;
  /** the band's name, and its speaker's */
  name: SpeakerBand["name"];
  speakerName: SpeakerSpec["name"];
}

/**
 * The stack's bands balanced across its members (flat unless a tilt is given), from its response (`stackResponse`): every band of every
 * member in one chain, each read on its member's speaker through the member's crossover. The balance goes in the band
 * Levels (a member's level can't set its bands against each other), so every member's level goes to 0 dB
 * (`withStackLevels`). A speaker two members share takes the first member's crossover. The Levels stay when there are
 * fewer than two modeled bands, when a band a driver feeds (or a member's speaker) has no model, or when a crossover
 * is outside the model's frequency range.
 */
export function autoBalanceStack(
  design: Pick<StackDesign, "speakers"> & { stack: Pick<StackDesign["stack"], "members"> },
  response: Pick<StackResponse, "members">,
  tilt: MusicTilt = FLAT_TILT,
): AutoBalance<StackLevels> {
  const bands: BalanceBand<StackBandKey>[] = [];
  const unmodeled: string[] = [];
  const seen = new Set<SpeakerSpec["id"]>();
  design.stack.members.forEach((member, k) => {
    if (seen.has(member.speakerId)) return;
    seen.add(member.speakerId);
    const run = response.members[k];
    const speaker = design.speakers.find((s) => s.id === member.speakerId);
    if (!run || !speaker) {
      unmodeled.push(speaker?.name ?? member.speakerId);
      return;
    }
    const own = speakerBands({ ...speaker, input: member.crossover }, run.response);
    for (const b of own.unmodeled)
      unmodeled.push(AUTO_BALANCE_TEXT.memberBand(speaker.name, b.name));
    for (const b of own.bands) {
      const name = speaker.bands.find((sb) => sb.id === b.key)?.name ?? b.key;
      bands.push({
        ...b,
        key: { speakerId: speaker.id, band: b.key, name, speakerName: speaker.name },
      });
    }
  });
  if (unmodeled.length) return { status: AUTO_BALANCE_STATUS.unmodeled, names: unmodeled };
  if (bands.length < 2) return { status: AUTO_BALANCE_STATUS.oneBand };
  const chain = chainLevels(bands, tilt);
  if (!chain) return { status: AUTO_BALANCE_STATUS.outOfRange };
  const levels: StackLevels = {};
  for (const { key, levelDb } of chain)
    levels[key.speakerId] = { ...levels[key.speakerId], [key.band]: levelDb };
  // a band name that two bands share (two "Mid" bands) goes with its speaker's name
  const count = (name: string) => chain.filter((o) => o.key.name === name).length;
  const named = chain.map(({ key, levelDb }) => ({
    name: count(key.name) > 1 ? AUTO_BALANCE_TEXT.memberBand(key.speakerName, key.name) : key.name,
    levelDb,
  }));
  return { status: AUTO_BALANCE_STATUS.balanced, levels, bands: named };
}

const sameFilter = (a: BandFilter | null, b: BandFilter | null) =>
  a?.hz === b?.hz && a?.type === b?.type;

/**
 * The speakers that two or more members share with different crossovers: for each, the members that use it, numbered
 * from 1. Auto balance takes the first member's crossover for a shared speaker (an owner decision), so the Stack page
 * says so when the crossovers differ.
 */
export function sharedCrossovers(
  members: readonly Pick<StackMember, "speakerId" | "crossover">[],
): number[][] {
  const bySpeaker = new Map<SpeakerSpec["id"], number[]>();
  members.forEach((m, k) => bySpeaker.set(m.speakerId, [...(bySpeaker.get(m.speakerId) ?? []), k]));
  return [...bySpeaker.values()]
    .filter((ks) => {
      const [first, ...rest] = ks.map((k) => members[k].crossover);
      return rest.some(
        (c) => !sameFilter(c.highpass, first.highpass) || !sameFilter(c.lowpass, first.lowpass),
      );
    })
    .map((ks) => ks.map((k) => k + 1));
}

/** The stack with these Levels in its speakers' bands, and every member's level 0 dB (the balance is in the bands). */
export function withStackLevels<D extends Pick<StackDesign, "speakers" | "stack">>(
  design: D,
  levels: StackLevels,
): D {
  return {
    ...design,
    speakers: design.speakers.map((s) => {
      const own = levels[s.id];
      return own ? withSpeakerLevels(s, own) : s;
    }),
    stack: { ...design.stack, members: design.stack.members.map((m) => ({ ...m, levelDb: 0 })) },
  };
}
