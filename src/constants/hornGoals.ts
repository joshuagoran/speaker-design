// The horn goals' defaults, field ranges and the starting-layout search's settings (lib/speaker/hornGoals).
import type { HornGoals } from "../types";

/** A new horn's goals: a sub that plays flat from 40 to 100 Hz and reaches 120 dB at 1 m. */
export const HORN_GOALS_DEFAULT = {
  lowHz: 40,
  highHz: 100,
  targetDb: 120,
} as const satisfies HornGoals;

/** Each goal field's range and step. */
export const HORN_GOAL_FIELDS = {
  lowHz: { min: 15, max: 200, step: 1 },
  highHz: { min: 40, max: 500, step: 5 },
  targetDb: { min: 80, max: 150, step: 1 },
} as const satisfies Record<keyof HornGoals, { min: number; max: number; step: number }>;

/** What stops a horn's maximum output at a frequency, by id: the drivers' power rating or their Xmax. */
export const HORN_GOAL_LIMIT = {
  power: "power",
  excursion: "excursion",
} as const;

/**
 * The share of a chamber's clear air a folded horn path gets: the rest is the panels inside the fold. A first estimate
 * until the fold layout counts its panels.
 */
export const FOLD_AIR_SHARE = 0.85;

/**
 * A tapped horn's starting rear chamber (the air behind the cones, up to their tap), as a multiple of the drivers'
 * displacement: room for the motors.
 */
export const TAPPED_REAR_PER_DISPLACEMENT = 2;

/** The search's path lengths, as shares of a quarter wavelength at the low goal. */
export const SEARCH_PATH_SHARES = [0.5, 0.75, 1, 1.25, 1.5] as const;

/** The search's flares: the mouth's area over the closed end's (or the throat's). */
export const SEARCH_FLARES = [1, 2.5, 5] as const;

/** The search's tap places, as shares of the path from its closed end. */
export const SEARCH_TAP_SHARES = [0.1, 0.25, 0.4, 0.55, 0.7] as const;

/** The search's rear chamber sizes for a front-loaded or offset horn, as shares of the chamber's air. */
export const SEARCH_REAR_SHARES = [0.15, 0.35, 0.55] as const;

/** How many frequencies the search scores a design at, log-spaced over the goals' band. */
export const SEARCH_POINTS = 16;

/** How many times the search halves its steps around the best design of the first pass. */
export const SEARCH_REFINE_ROUNDS = 5;

/** A level at the low goal this far under the band's mean, dB, counts as flat: the usual −3 dB corner. */
export const LOW_EDGE_DB = 3;

/** The shortest section the search makes, as a share of the path. */
export const MIN_SECTION_SHARE = 0.05;
