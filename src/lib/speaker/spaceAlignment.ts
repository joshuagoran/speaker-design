// What a space asks of the processing ahead of its amps (docs/speaker-designer-plan.md, L4b): for each box and band, the
// crossover filters, the level and the delay to set. Read from the model (the stack's crossovers, levels and worked-out
// delays, and each placement's own level and delay). A mirror pair is one entry while its placements' levels and delays
// match; a follower with its own level or delay has its own. Pure.
import type { BandFilter, BandId, SpaceDesign, SpeakerBand } from "../../types";
import type { SpaceModel } from "./spaceCoverage";
import { channelGroups } from "./spaceHardware";
import { placementGroups } from "./fillAlign";
import { HIFI_DRIVE } from "../../constants/hifiEngine";
import { SPEED_OF_SOUND } from "../../constants/acoustics";
import { NO_DELAY_MS, SPACE_TEXT } from "../../constants/space";
import { METERS_PER_INCH } from "../../constants/units";

/** Milliseconds in a second. */
const MS_PER_S = 1000;

/** How far a sound travels in `ms` milliseconds, in: the distance a delay equals (move the box back by it). */
export const delayDistanceIn = (ms: number) => ((ms / MS_PER_S) * SPEED_OF_SOUND) / METERS_PER_INCH;

/** A delay in words: as a time and as the distance it equals; none under `NO_DELAY_MS`. */
export const delayText = (ms: number) =>
  ms < NO_DELAY_MS
    ? SPACE_TEXT.noDelay
    : SPACE_TEXT.delayIs(ms.toFixed(1), String(Math.round(delayDistanceIn(ms))));

/** Two levels or delays this close are the same setting, dB or ms. */
const SAME = 1e-9;

/** One box's band (or passive network) in the list: what to set for it. */
export interface AlignmentRow {
  /** the placements that play it: a mirror pair's (the lead first) while they match, else one */
  placements: readonly number[];
  /** the member's number in its stack (0 for a speaker alone) and its speaker's name */
  member: number;
  box: string;
  /** the band or bands, by id and name: one active band, or a passive network's bands */
  bands: readonly Pick<SpeakerBand, "id" | "name">[];
  highpass: BandFilter | null;
  lowpass: BandFilter | null;
  /** the level, dB: the band's gain ahead of the amp (active only), its member's and its placement's */
  levelDb: number;
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
 * The alignment list: each placed box's bands in turn, in the placements' order. A mirror pair is one entry while its
 * placements' levels and delays match (as the model uses them); a follower that differs has its own.
 */
export function spaceAlignment(
  design: Pick<SpaceDesign, "space">,
  model: Pick<SpaceModel, "placements">,
): AlignmentRow[] {
  /** the rows of placement `j` alone, as the model plays it */
  const rowsOf = (j: number): AlignmentRow[] => {
    const placed = model.placements[j];
    const response = placed?.response;
    if (!placed?.item.stack || !response) return [];
    const { stack } = placed.item.stack;
    const { levelDb, delayMs: placementDelayMs } = placed.item.placement;
    return stack.members.flatMap((member, k) => {
      const fed = response.members[k];
      if (!fed) return [];
      const { speaker, delayMs } = fed;
      const base = member.levelDb + levelDb;
      return channelGroups(speaker).map((ids: BandId[]): AlignmentRow => {
        const bands = ids.flatMap((id) => speaker.bands.filter((b) => b.id === id));
        const active = bands.length === 1 && bands[0].drive === HIFI_DRIVE.active ? bands[0] : null;
        return {
          placements: [j],
          member: k,
          box: speaker.name,
          bands: bands.map(({ id, name }) => ({ id, name })),
          // an active band's own filters run ahead of its amp; a passive network's are in the box
          highpass: stricter(member.crossover.highpass, active?.highpass ?? null, Math.max),
          lowpass: stricter(member.crossover.lowpass, active?.lowpass ?? null, Math.min),
          levelDb: base + (active?.levelDb ?? 0),
          delayMs: delayMs + placementDelayMs,
          crossoverDelayMs: delayMs,
        };
      });
    });
  };
  return placementGroups(design.space.placements).flatMap((group) => {
    const rows: AlignmentRow[] = [];
    for (const j of group)
      for (const row of rowsOf(j)) {
        // a placement that sets what an earlier one in its group sets for the same band joins that row
        const same = rows.find(
          (r) =>
            r.member === row.member &&
            r.bands.map((b) => b.id).join() === row.bands.map((b) => b.id).join() &&
            Math.abs(r.levelDb - row.levelDb) < SAME &&
            Math.abs(r.delayMs - row.delayMs) < SAME,
        );
        if (same) same.placements = [...same.placements, j];
        else rows.push(row);
      }
    return rows;
  });
}
