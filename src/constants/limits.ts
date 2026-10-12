import type { LimitId, SubLimitWho, WooferLimit } from "../types";

/**
 * Every limit's id, and the word a chart label shows for it ("sine, Xmax-limited"). A result names what stops its
 * level by id (`SubLimits.who`, `PaMaxPoint.who`, `HornResponse.who`, `WooferLimit`), so code decides on the id and
 * never on the words; pages look the words up here or in the longer maps below.
 */
export const LIMIT_NAMES = {
  port: "port",
  Xmax: "Xmax",
  radiator: "radiator",
  thermal: "thermal",
  amp: "amp",
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
]);

/** What stops a level, in words: a Speaker-page band's limit (and, without the radiator, the sub's). */
export const DRIVER_LIMIT_NAMES: Record<LimitId, string> = {
  port: "port air speed",
  Xmax: "cone travel (Xmax)",
  radiator: "radiator travel",
  thermal: "driver program rating",
  amp: "amplifier power",
};

/** What stops the sub's music level, as the sub section's "First limit" row and the Coverage amp power table say it. */
export const SUB_LIMIT_NAMES: Record<SubLimitWho, string> = {
  port: DRIVER_LIMIT_NAMES.port,
  Xmax: DRIVER_LIMIT_NAMES.Xmax,
  thermal: DRIVER_LIMIT_NAMES.thermal,
  amp: DRIVER_LIMIT_NAMES.amp,
};

/** What stops the sub's music level, as a PA optimizer card's "Limited by" line says it. */
export const SUB_LIMITED_BY: Record<SubLimitWho, string> = {
  port: "port air speed",
  Xmax: "cone travel",
  thermal: "the driver's program rating",
  amp: "amplifier power",
};

/** What stops a Hi-fi woofer's level, as a Hi-fi optimizer card's "Limited by" line says it. */
export const WOOFER_LIMITED_BY: Record<WooferLimit, string> = {
  Xmax: "cone travel",
  port: "port air speed",
  radiator: "radiator travel",
  thermal: "the woofer's power rating",
  amp: "the amp",
};
