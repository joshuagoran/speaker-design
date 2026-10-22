// The DSP sheet: what a space asks of the processing ahead of its amps, one row per DSP output (an amp channel). An
// active band is one row; a box's passive bands on their shared amp are one row, with their Pads in the box. Each row
// has its filters, its total Gain (System gain, the placement's, the box's and an active band's) and its delay. Read
// from the model, so the Gain is the one the model plays. A mirrored pair is one entry: its two boxes share the
// settings. Pure.
import type { BandFilter, BandId, SpeakerBand } from "../../types";
import type { SpaceModel } from "./spaceCoverage";
import { channelGroups } from "./spaceHardware";
import { bandLevelDb } from "./bandLevel";
import { HIFI_DRIVE } from "../../constants/hifiEngine";
import { SPEED_OF_SOUND } from "../../constants/acoustics";
import { NO_DELAY_MS, SPACE_TEXT } from "../../constants/space";
import { METERS_PER_INCH, MS_PER_S } from "../../constants/units";

/** How far a sound travels in `ms` milliseconds, in: the distance a delay equals (move the box back by it). */
export const delayDistanceIn = (ms: number) => ((ms / MS_PER_S) * SPEED_OF_SOUND) / METERS_PER_INCH;

/** A delay in words: as a time and as the distance it equals; none under `NO_DELAY_MS`. */
export const delayText = (ms: number) =>
  ms < NO_DELAY_MS
    ? SPACE_TEXT.noDelay
    : SPACE_TEXT.delayIs(ms.toFixed(1), String(Math.round(delayDistanceIn(ms))));

/** One DSP output (an active band, or a box's passive bands on their shared amp): what to set for it. */
export interface AlignmentRow {
  /** the placement that plays it (its index in the space; a mirrored pair is one placement) */
  placement: number;
  /** the member's number in its stack (0 for a speaker alone) and its speaker's name */
  member: number;
  box: string;
  /** the band or bands, by id and name: one active band, or a passive network's bands */
  bands: readonly Pick<SpeakerBand, "id" | "name">[];
  highpass: BandFilter | null;
  lowpass: BandFilter | null;
  /** the total Gain, dB: System gain, the placement's, the member's and the band's (active only) */
  gainDb: number;
  /** a passive row's bands and their Pads in the box, dB; empty for an active band */
  pads: readonly { name: SpeakerBand["name"]; padDb: number }[];
  /** the delay, ms: the crossover delay and the placement's */
  delayMs: number;
  /** of that delay, the member's: the stack's alignment at the crossovers (or typed) */
  crossoverDelayMs: number;
}

/** The corner of two filters that cuts more: the higher high-pass corner, the lower low-pass corner. */
function stricter(
  a: BandFilter | null,
  b: BandFilter | null,
  pick: (x: number, y: number) => number,
): BandFilter | null {
  return a && b ? (pick(a.hz, b.hz) === a.hz ? a : b) : (a ?? b);
}

/**
 * The DSP sheet: each placed box's DSP outputs in turn, in the placements' order. A mirrored pair's boxes share their
 * settings, so a pair is one entry per output.
 */
export function spaceAlignment(model: Pick<SpaceModel, "placements" | "systemDb">): AlignmentRow[] {
  return model.placements.flatMap((placed): AlignmentRow[] => {
    /** the placement's own delay and level, as set */
    const { image, source, delayMs: placementDelayMs, levelDb } = placed.item.placement;
    const response = placed.response;
    // the image box plays what the box as set plays
    if (image || !placed.item.stack || !response) return [];
    const { stack } = placed.item.stack;
    return stack.members.flatMap((member, k) => {
      const fed = response.members[k];
      if (!fed) return [];
      const { speaker, delayMs } = fed;
      const base = model.systemDb + levelDb + member.levelDb;
      return channelGroups(speaker).map((ids: BandId[]): AlignmentRow => {
        const bands = ids.flatMap((id) => speaker.bands.filter((b) => b.id === id));
        const active = bands.length === 1 && bands[0].drive === HIFI_DRIVE.active ? bands[0] : null;
        return {
          placement: source,
          member: k,
          box: speaker.name,
          bands: bands.map(({ id, name }) => ({ id, name })),
          // an active band's own filters run ahead of its amp; a passive network's are in the box
          highpass: stricter(member.crossover.highpass, active?.highpass ?? null, Math.max),
          lowpass: stricter(member.crossover.lowpass, active?.lowpass ?? null, Math.min),
          gainDb: base + (active?.levelDb ?? 0),
          pads: active ? [] : bands.map((b) => ({ name: b.name, padDb: bandLevelDb(b) })),
          delayMs: delayMs + placementDelayMs,
          crossoverDelayMs: delayMs,
        };
      });
    });
  });
}
