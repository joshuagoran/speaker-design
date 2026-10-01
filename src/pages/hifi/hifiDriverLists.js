import { HIFI_WOOFERS, HIFI_TWEETERS, HIFI_PASSIVES } from "../../lib/data.js";

/** Woofers listed smallest first, grouped by size in the picker, A–Z within a size. */
export const HIFI_WOOFERS_BY_SIZE = HIFI_WOOFERS.slice().sort((a, b) => a.size - b.size || a.name.localeCompare(b.name));

/** Passive radiators by size, A–Z within a size. */
export const HIFI_PASSIVES_BY_SIZE = HIFI_PASSIVES.slice().sort((a, b) => a.size - b.size || a.name.localeCompare(b.name));

/** The passive radiator driver and count of a saved Hi-fi config, or null for a config without one. */
export const passiveRadiatorOf = (c) => (c && c.box === "radiator" && c.pr ? { drv: HIFI_PASSIVES.find((o) => o.id === c.pr.id), n: c.pr.n, addG: c.pr.addG } : null);

/** Whether a tweeter is a compression driver (or needs a waveguide) rather than a dome. */
export const isCompressionDriver = (o) => o.type === "compression" || o.needsWaveguide;

/** Tweeters split into domes and compression drivers (which need a waveguide), domes first, A–Z within each. */
export const HIFI_TWEETERS_BY_TYPE = HIFI_TWEETERS.slice().sort((a, b) => isCompressionDriver(a) - isCompressionDriver(b) || a.name.localeCompare(b.name));
