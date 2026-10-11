import type { HifiBoxKind, HifiTweeter, RadiatorSelection } from "../../types";
import { HIFI_WOOFERS, HIFI_TWEETERS, HIFI_PASSIVES } from "../../lib/data";
import { byIdOrThrow } from "../../lib/tables";
import { isAmt, isRibbon, needsWaveguide } from "../../lib/hifi/hifi";
import { CATALOG_TABLE_NAMES } from "../../constants/catalogTables";

/** Woofers listed smallest first, grouped by size in the picker, A–Z within a size. */
export const HIFI_WOOFERS_BY_SIZE = HIFI_WOOFERS.slice().sort(
  (a, b) => a.size - b.size || a.name.localeCompare(b.name),
);

/** Passive radiators by size, A–Z within a size. */
export const HIFI_PASSIVES_BY_SIZE = HIFI_PASSIVES.slice().sort(
  (a, b) => a.size - b.size || a.name.localeCompare(b.name),
);

/**
 * The passive radiator driver and count of a saved Hi-fi config, or null for a config without one.
 * The id comes from `HIFI_PASSIVES` (the page's picker, or the optimizer's search of it), so a miss throws.
 */
export const passiveRadiatorOf = (
  c: { box?: HifiBoxKind; pr?: RadiatorSelection } | null | undefined,
) =>
  c && c.box === "radiator" && c.pr
    ? {
        drv: byIdOrThrow(HIFI_PASSIVES, c.pr.id, CATALOG_TABLE_NAMES.passiveRadiators),
        n: c.pr.n,
        addG: c.pr.addG,
      }
    : null;

/**
 * Tweeter family for grouping: 0 domes, 1 planar ribbons (with their own waveguide), 2 AMTs (on their plate),
 * 3 compression drivers.
 */
export const tweeterKind = (o: HifiTweeter) =>
  needsWaveguide(o) ? 3 : isAmt(o) ? 2 : isRibbon(o) ? 1 : 0;

/** Group headings in the tweeter picker, indexed by tweeterKind. */
export const TWEETER_GROUP_LABELS = [
  "Dome tweeters",
  "Planar ribbons (with their waveguide)",
  "AMTs (air motion transformers)",
  "Compression drivers (on a waveguide)",
];

/** Short name of each tweeter family, indexed by tweeterKind. */
export const TWEETER_KIND_LABELS = ["dome", "planar ribbon", "AMT", "compression driver"];

/** Tweeters grouped by family (domes, ribbons, AMTs, compression drivers), A–Z within each. */
export const HIFI_TWEETERS_BY_TYPE = HIFI_TWEETERS.slice().sort(
  (a, b) => tweeterKind(a) - tweeterKind(b) || a.name.localeCompare(b.name),
);
