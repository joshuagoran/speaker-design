import type { SubLimitWho, WooferLimit } from "../types";

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

/** What stops the sub's music level, as the sub section's "First limit" row says it. */
export const SUB_LIMIT_NAMES: Record<SubLimitWho, string> = {
  port: "port air speed",
  Xmax: "cone travel (Xmax)",
  thermal: "driver program rating",
  amp: "amplifier power",
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
