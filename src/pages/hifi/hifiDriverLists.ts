import type { HifiBoxKind, HifiTweeter, RadiatorSelection } from "../../types.ts";
import { HIFI_WOOFERS, HIFI_TWEETERS, HIFI_PASSIVES } from "../../lib/data.ts";

/** Woofers listed smallest first, grouped by size in the picker, A–Z within a size. */
export const HIFI_WOOFERS_BY_SIZE = HIFI_WOOFERS.slice().sort(
  (a, b) => a.size - b.size || a.name.localeCompare(b.name),
);

/** Passive radiators by size, A–Z within a size. */
export const HIFI_PASSIVES_BY_SIZE = HIFI_PASSIVES.slice().sort(
  (a, b) => a.size - b.size || a.name.localeCompare(b.name),
);

/** The passive radiator driver and count of a saved Hi-fi config, or null for a config without one. */
export const passiveRadiatorOf = (
  c: { box?: HifiBoxKind; pr?: RadiatorSelection } | null | undefined,
) =>
  c && c.box === "radiator" && c.pr
    ? { drv: HIFI_PASSIVES.find((o) => o.id === c.pr!.id), n: c.pr.n, addG: c.pr.addG }
    : null;

/** Whether a tweeter is a compression driver (or needs a waveguide) rather than a dome. */
export const isCompressionDriver = (o: HifiTweeter) => o.type === "compression" || o.needsWaveguide;

/** Tweeter family for grouping: 0 domes, 1 planar ribbons (with their own waveguide), 2 compression drivers. */
export const tweeterKind = (o: HifiTweeter) =>
  isCompressionDriver(o) ? 2 : o.type === "ribbon" ? 1 : 0;

/** Group headings in the tweeter picker, indexed by tweeterKind. */
export const TWEETER_GROUP_LABELS = [
  "Dome tweeters",
  "Planar ribbons (with their waveguide)",
  "Compression drivers (on a waveguide)",
];

/** Short name of each tweeter family, indexed by tweeterKind. */
export const TWEETER_KIND_LABELS = ["dome", "planar ribbon", "compression driver"];

/** Tweeters grouped by family (domes, ribbons, compression drivers), A–Z within each. */
export const HIFI_TWEETERS_BY_TYPE = HIFI_TWEETERS.slice().sort(
  (a, b) => tweeterKind(a) - tweeterKind(b) || a.name.localeCompare(b.name),
);
