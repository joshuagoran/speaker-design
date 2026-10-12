// Auto balance: band Levels for music, for any speaker or stack (docs/speaker-designer-plan.md, L3f "Auto balance").
// It is the PA page's music balance (lib/pa/musicBalance), made general for any number and order of bands:
//
// - The bands go in order of their passband (the middle of where each is within 3 dB of its highest point).
// - Each pair of bands next to each other meets at their crossover: the lower band's lowpass and the upper band's
//   highpass (the geometric mean of the corners that are there). There the upper band is set the music tilt below the
//   lower one: `tilt` dB at a crossover up to the PA's highest sub crossover (the mid below the sub), `hfTilt` dB above
//   it (the horn below the mid). Two bands with no filter between them (they overlap) meet at equal level, at the middle
//   of their passbands.
// - The Levels are then moved together so that the highest is 0 dB.
//
// Each band is read on its own response at 2.83 V with its Level taken out (lib/speaker/speakerResponse; in a stack,
// each member's speaker through its crossover, lib/speaker/stackResponse). One input drives every band, so a band's
// limit sets only how loud the whole design can play, not where its bands sit against each other: the PA page's
// balance at the bands' limits comes to the same Levels (tests/auto-balance.test.ts checks it on the PA presets).
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
  StackResponse,
} from "../../types";
import { curveLevelAt } from "../pa/coverage";
import { passbandCenterHz } from "./speakerResponse";
import { DEFAULT_PA } from "../defaults";
import { PA_SLIDERS } from "../../constants/paSliders";
import { AUTO_BALANCE_STATUS } from "../../constants/autoBalance";

/** The music tilt: how far a band sits below the band under it at their crossover, dB (the PA page's saved keys). */
export type MusicTilt = Pick<MusicBalance, "tilt" | "hfTilt">;

/** The PA page's starting music balance: the mid 6 dB below the sub, the horn 3 dB below the mid. */
export const DEFAULT_MUSIC_TILT: MusicTilt = { tilt: DEFAULT_PA.tilt, hfTilt: DEFAULT_PA.hfTilt };

/** The highest crossover that takes `tilt` (a crossover to a sub), Hz: the PA page's highest sub-to-mid crossover. */
export const SUB_CROSSOVER_MAX_HZ = PA_SLIDERS.xoLo.max;

/** How far the band above a crossover at `hz` sits below the band under it, dB. */
export const tiltAt = (hz: number, tilt: MusicTilt = DEFAULT_MUSIC_TILT) =>
  hz <= SUB_CROSSOVER_MAX_HZ ? tilt.tilt : tilt.hfTilt;

/** One band as the balance reads it: its response with its Level taken out, and the corners it plays between. */
export interface BalanceBand<K> {
  key: K;
  curve: readonly FrequencyPoint[];
  /** its lowest lowpass corner and its highest highpass corner, Hz (its own filters, and a feed's); null: none */
  lowpassHz: number | null;
  highpassHz: number | null;
}

/** Where two bands next to each other meet, Hz, and whether a filter is there (then the tilt applies). */
function meetingPoint<K>(lower: BalanceBand<K>, upper: BalanceBand<K>) {
  const corners = [lower.lowpassHz, upper.highpassHz].filter((f) => f !== null);
  if (corners.length)
    return { hz: corners.reduce((a, b) => a * b, 1) ** (1 / corners.length), filtered: true };
  return {
    hz: Math.sqrt(passbandCenterHz(lower.curve) * passbandCenterHz(upper.curve)),
    filtered: false,
  };
}

/**
 * Each band's Level, dB, the highest 0, by the chain at the crossovers (see the file's head); null for fewer than two
 * bands, or where a band's curve has no level at its crossover.
 */
export function chainLevels<K>(
  bands: readonly BalanceBand<K>[],
  tilt: MusicTilt = DEFAULT_MUSIC_TILT,
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
    const { hz, filtered } = meetingPoint(lower, upper);
    const lo = curveLevelAt(lower.curve, hz),
      hi = curveLevelAt(upper.curve, hz);
    if (lo === null || hi === null) return null;
    // the upper band's level at the crossover: the lower one's, less the tilt
    raw.push(raw[i - 1] + lo - hi - (filtered ? tiltAt(hz, tilt) : 0));
  }
  const top = Math.max(...raw);
  return ordered.map((b, i) => ({ key: b.key, levelDb: raw[i] - top }));
}

/** The lowest of some lowpass corners, Hz; null with none. */
const lowestHz = (filters: readonly (BandFilter | null)[]) => {
  const hz = filters.flatMap((f) => (f ? [f.hz] : []));
  return hz.length ? Math.min(...hz) : null;
};
/** The highest of some highpass corners, Hz; null with none. */
const highestHz = (filters: readonly (BandFilter | null)[]) => {
  const hz = filters.flatMap((f) => (f ? [f.hz] : []));
  return hz.length ? Math.max(...hz) : null;
};

/** The bands a driver feeds: a band no driver names plays nothing, so the balance leaves it as it is. */
const fedBands = (spec: Pick<SpeakerSpec, "cabinet">) =>
  new Set(spec.cabinet.chambers.flatMap((c) => c.drivers.flatMap((d) => d.bands)));

/** A speaker's bands as the balance reads them, from its response; and the fed bands the response has no model for. */
function speakerBands(
  spec: Pick<SpeakerSpec, "cabinet" | "bands" | "input">,
  response: Pick<SpeakerResponse, "bands">,
) {
  const fed = fedBands(spec);
  const bands: BalanceBand<BandId>[] = [];
  const unmodeled: BandId[] = [];
  for (const band of spec.bands) {
    if (!fed.has(band.id)) continue;
    const modeled = response.bands.find((b) => b.id === band.id);
    if (!modeled) {
      unmodeled.push(band.id);
      continue;
    }
    bands.push({
      key: band.id,
      curve: modeled.curve.map((o) => ({ f: o.f, spl: o.spl - band.levelDb })),
      lowpassHz: lowestHz([band.lowpass, spec.input.lowpass]),
      highpassHz: highestHz([band.highpass, spec.input.highpass]),
    });
  }
  return { bands, unmodeled };
}

/** What an auto balance gives: the Levels to set, or why the Levels stay. */
export type AutoBalance<L> =
  | { status: typeof AUTO_BALANCE_STATUS.balanced; levels: L }
  | { status: typeof AUTO_BALANCE_STATUS.oneBand }
  | { status: typeof AUTO_BALANCE_STATUS.unmodeled; bands: BandId[] };

/** A speaker's balanced Levels, by band id. */
export type SpeakerLevels = Record<BandId, SpeakerBand["levelDb"]>;

/**
 * The speaker's bands balanced for music, from its response (`speakerResponse` with its input range as the feed). The
 * Levels stay when it has fewer than two modeled bands, or when a band a driver feeds has no model.
 */
export function autoBalanceSpeaker(
  spec: Pick<SpeakerSpec, "cabinet" | "bands" | "input">,
  response: Pick<SpeakerResponse, "bands">,
  tilt: MusicTilt = DEFAULT_MUSIC_TILT,
): AutoBalance<SpeakerLevels> {
  const { bands, unmodeled } = speakerBands(spec, response);
  if (unmodeled.length) return { status: AUTO_BALANCE_STATUS.unmodeled, bands: unmodeled };
  const chain = chainLevels(bands, tilt);
  if (!chain) return { status: AUTO_BALANCE_STATUS.oneBand };
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
    return db === undefined ? b : { ...b, levelDb: db };
  }),
});

/** A stack's balanced Levels: each speaker's, by speaker id and band id. */
export type StackLevels = Record<SpeakerSpec["id"], SpeakerLevels>;

/** A band of a stack, by its speaker and its id. */
interface StackBandKey {
  speakerId: SpeakerSpec["id"];
  band: BandId;
}

/**
 * The stack's bands balanced for music across its members, from its response (`stackResponse`): every band of every
 * member in one chain, each read on its member's speaker through the member's crossover. The balance goes in the band
 * Levels (a member's level can't set its bands against each other), so every member's level goes to 0 dB
 * (`withStackLevels`). A speaker two members share takes the first member's crossover. The Levels stay when there are
 * fewer than two modeled bands, or when a band a driver feeds (or a member's speaker) has no model.
 */
export function autoBalanceStack(
  design: Pick<StackDesign, "speakers"> & { stack: Pick<StackDesign["stack"], "members"> },
  response: Pick<StackResponse, "members">,
  tilt: MusicTilt = DEFAULT_MUSIC_TILT,
): AutoBalance<StackLevels> {
  const bands: BalanceBand<StackBandKey>[] = [];
  const unmodeled: BandId[] = [];
  const seen = new Set<SpeakerSpec["id"]>();
  design.stack.members.forEach((member, k) => {
    if (seen.has(member.speakerId)) return;
    seen.add(member.speakerId);
    const run = response.members[k];
    const speaker = design.speakers.find((s) => s.id === member.speakerId);
    if (!run || !speaker) {
      unmodeled.push(member.speakerId);
      return;
    }
    const own = speakerBands({ ...speaker, input: member.crossover }, run.response);
    unmodeled.push(...own.unmodeled);
    for (const b of own.bands) bands.push({ ...b, key: { speakerId: speaker.id, band: b.key } });
  });
  if (unmodeled.length) return { status: AUTO_BALANCE_STATUS.unmodeled, bands: unmodeled };
  const chain = chainLevels(bands, tilt);
  if (!chain) return { status: AUTO_BALANCE_STATUS.oneBand };
  const levels: StackLevels = {};
  for (const { key, levelDb } of chain)
    levels[key.speakerId] = { ...levels[key.speakerId], [key.band]: levelDb };
  return { status: AUTO_BALANCE_STATUS.balanced, levels };
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
