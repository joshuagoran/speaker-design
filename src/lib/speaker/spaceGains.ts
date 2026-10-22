// Calculate gains (the Space page), keeping the balance. Pure.
//
// 1. Each main's Gain: the bands it plays most at the reference (where its share of the level is largest) are found,
//    and its Gain is set so the first of them meets its target and none goes past it. The mains add together (by
//    power), so it runs again until no Gain moves. A box with several bands gets one Gain: its other bands may stay short.
// 2. System gain: where a driver band of any box would go past its limit, System gain comes down until none does, so
//    every band drops together.
// Fills are set between the two, against the nearest main (lib/speaker/solveFeeds).
import type { BandId, CoverageBand } from "../../types";
import type { SpaceModel } from "./spaceCoverage";
import { COVERAGE_BANDS } from "../acoustics/coverage";
import { keysOf } from "../records";

/** A band the reference is read in: the four coverage bands, not one frequency. */
export type LevelBand = Exclude<CoverageBand, "one">;

/** A level in each band, dB; a band left out has none (nothing reaches the reference there). */
export type BandLevels = Partial<Record<LevelBand, number>>;

/** The bands, from the lowest. */
const LEVEL_BANDS = keysOf(COVERAGE_BANDS);

/** One main as the gains read it: its Gain now, and its level alone at the reference in each band at that Gain, dB. */
export interface MainAtReference {
  gainDb: number;
  levels: BandLevels;
}

/** A band whose share is within this of a main's largest share is one it plays most, dB. */
const PLAYS_MOST_DB = 1;
/** The passes stop once no Gain moves more than this, dB. */
const SETTLED_DB = 0.01;
/** At most this many passes. */
const MAX_PASSES = 100;

/** Levels in dB added by power. */
const powerSum = (levels: readonly number[]) =>
  10 * Math.log10(levels.reduce((sum, db) => sum + Math.pow(10, db / 10), 0));

/** Each band's level alone at the reference of a main at Gain `gainDb`, dB. */
function levelsAt(main: MainAtReference, gainDb: number): BandLevels {
  const out: BandLevels = {};
  for (const band of LEVEL_BANDS) {
    const db = main.levels[band];
    if (db !== undefined && Number.isFinite(db)) out[band] = db + gainDb - main.gainDb;
  }
  return out;
}

/** Each band's level at the reference with every main at its Gain, dB. */
export function bandTotals(
  mains: readonly MainAtReference[],
  gains: readonly number[],
): BandLevels {
  const each = mains.map((m, k) => levelsAt(m, gains[k] ?? m.gainDb));
  const out: BandLevels = {};
  for (const band of LEVEL_BANDS) {
    const levels = each.flatMap((l) => (l[band] === undefined ? [] : [l[band]]));
    if (levels.length) out[band] = powerSum(levels);
  }
  return out;
}

/** The bands a main plays most: where its share of the band's level is within PLAYS_MOST_DB of its largest share. */
function bandsPlayedMost(own: BandLevels, totals: BandLevels): LevelBand[] {
  const shares = LEVEL_BANDS.flatMap((band) => {
    const db = own[band],
      total = totals[band];
    return db === undefined || total === undefined ? [] : [{ band, share: db - total }];
  });
  const most = Math.max(...shares.map((s) => s.share));
  return shares.flatMap((s) => (s.share >= most - PLAYS_MOST_DB ? [s.band] : []));
}

/**
 * Each main's Gain, dB (see the file's note): the first of the bands it plays most meets its target, and none goes past
 * it. A main with no band it plays keeps its Gain.
 */
export function mainGains(
  mains: readonly MainAtReference[],
  targets: Readonly<Record<LevelBand, number>>,
): number[] {
  const gains = mains.map((m) => m.gainDb);
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    // every main steps from the same totals: mains that share a band move together, so they land on it together
    const totals = bandTotals(mains, gains);
    const steps = mains.map((main, k) => {
      const bands = bandsPlayedMost(levelsAt(main, gains[k] ?? main.gainDb), totals);
      const own = bands.flatMap((b) => {
        const total = totals[b];
        return total === undefined ? [] : [targets[b] - total];
      });
      return own.length ? Math.min(...own) : 0;
    });
    steps.forEach((step, k) => {
      gains[k] = (gains[k] ?? 0) + step;
    });
    if (Math.max(0, ...steps.map(Math.abs)) < SETTLED_DB) break;
  }
  return gains;
}

/** One driver band's headroom: its placement, its box's member and band, and dB to its music limit (below 0: past it). */
export interface BandHeadroom {
  placement: number;
  /** the box it plays in (an index into the model's boxes) */
  box: number;
  member: number;
  band: BandId;
  headroomDb: number;
}

/** Every driver band's headroom in the space at the model's System gain; a box with no limit known has none. */
export function bandHeadrooms(model: Pick<SpaceModel, "placements" | "systemDb">): BandHeadroom[] {
  return model.placements.flatMap((p, box) =>
    p.limits && p.headroomDb !== null
      ? p.limits.bands.map((b) => ({
          placement: p.item.placement.source,
          box,
          member: b.member,
          band: b.band,
          // its room over the box's own limit (the box's first band: 0), less the gains
          headroomDb: b.roomDb - p.fullDb - p.item.placement.levelDb - model.systemDb,
        }))
      : [],
  );
}

/** The band with the least headroom; null when none is known. */
export const leastHeadroom = (bands: readonly BandHeadroom[]): BandHeadroom | null =>
  bands.length ? bands.reduce((a, b) => (b.headroomDb < a.headroomDb ? b : a)) : null;

/** The System gain that keeps every band at or under its limit, from their headrooms at System gain 0, dB: 0 or less. */
export function systemGainFor(bands: readonly BandHeadroom[]): number {
  const least = leastHeadroom(bands);
  return least ? Math.min(0, least.headroomDb) : 0;
}
