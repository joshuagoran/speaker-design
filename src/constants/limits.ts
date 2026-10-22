import type { LimitId, WooferLimit } from "../types";

/**
 * Every limit's id, and the word a chart label shows for it ("sine, Xmax-limited"). A result names what stops its
 * level by id (`SubLimits.who`, `HornResponse.who`, `WooferLimit`), so code decides on the id and
 * never on the words; pages look the words up here or in the longer maps below.
 */
export const LIMIT_NAMES = {
  port: "port",
  Xmax: "Xmax",
  radiator: "radiator",
  thermal: "thermal",
  amp: "amp",
  /** the air speed at a horn's throat (lib/speaker/speakerLimits) */
  throat: "throat",
} as const;

/**
 * What sets the speaker's sum outside its input range: the front end's filters ahead of the box (`SpeakerSpec.input`), not
 * a limit of the box (lib/speaker/speakerLimits).
 */
export const INPUT_RANGE_LIMIT = "input";

/**
 * The limits a cone or a vent meets at one frequency (the filters in the drive), as opposed to the program rating and
 * the amp, which hold on the whole drive.
 */
export const PER_FREQUENCY_LIMITS: ReadonlySet<LimitId> = new Set<LimitId>([
  LIMIT_NAMES.Xmax,
  LIMIT_NAMES.port,
  LIMIT_NAMES.radiator,
  LIMIT_NAMES.throat,
]);

/** What stops a level, in words: a Speaker-page band's limit (and, without the radiator, the sub's). */
export const DRIVER_LIMIT_NAMES: Record<LimitId, string> = {
  port: "vent air speed",
  Xmax: "cone travel (Xmax)",
  radiator: "radiator travel",
  thermal: "driver program rating",
  amp: "amp power",
  throat: "horn throat air speed",
};

/** What stops a Hi-fi woofer's level, as a Hi-fi optimizer card's "Limited by" line says it. */
export const WOOFER_LIMITED_BY: Record<WooferLimit, string> = {
  Xmax: "cone travel",
  port: "vent air speed",
  radiator: "radiator travel",
  thermal: "the woofer's power rating",
  amp: "the amp",
  throat: "air speed at the horn throat",
};
