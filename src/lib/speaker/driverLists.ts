import type { HifiTweeter } from "../../types";
import { HIFI_WOOFERS, HIFI_TWEETERS, HIFI_PASSIVES } from "../data";
import { isAmt, isRibbon, needsWaveguide } from "./twoWay";
/** Woofers listed smallest first, grouped by size in the picker, A–Z within a size. */
export const HIFI_WOOFERS_BY_SIZE = HIFI_WOOFERS.slice().sort(
  (a, b) => a.size - b.size || a.name.localeCompare(b.name),
);

/** Passive radiators by size, A–Z within a size. */
export const HIFI_PASSIVES_BY_SIZE = HIFI_PASSIVES.slice().sort(
  (a, b) => a.size - b.size || a.name.localeCompare(b.name),
);

/**
 * Tweeter family for grouping: 0 domes, 1 planar ribbons (with their own waveguide), 2 AMTs (on their plate),
 * 3 compression drivers.
 */
export const tweeterKind = (o: HifiTweeter) =>
  needsWaveguide(o) ? 3 : isAmt(o) ? 2 : isRibbon(o) ? 1 : 0;

/** Tweeters grouped by family (domes, ribbons, AMTs, compression drivers), A–Z within each. */
export const HIFI_TWEETERS_BY_TYPE = HIFI_TWEETERS.slice().sort(
  (a, b) => tweeterKind(a) - tweeterKind(b) || a.name.localeCompare(b.name),
);
