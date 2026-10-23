import type { DriverKind, HifiTweeter, SpeakerDriver } from "../../types";
import {
  CD_OPTIONS,
  FILL_OPTIONS,
  HIFI_PASSIVES,
  HIFI_TWEETERS,
  HIFI_WOOFERS,
  MID_OPTIONS,
  SPEAKER_SUB_OPTIONS,
} from "../data";
import { byId } from "../tables";
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

/** Each driver kind's catalog, as its picker lists it: each entry's id and name. */
export const DRIVER_OPTIONS: Record<DriverKind, readonly Pick<HifiTweeter, "id" | "name">[]> = {
  sub: SPEAKER_SUB_OPTIONS,
  mid: MID_OPTIONS,
  compression: CD_OPTIONS,
  woofer: HIFI_WOOFERS_BY_SIZE,
  tweeter: HIFI_TWEETERS_BY_TYPE,
  coaxial: FILL_OPTIONS,
};

/** A driver's catalog name; its id where its table doesn't have it. */
export const driverName = (driver: Pick<SpeakerDriver, "kind" | "driverId">) =>
  byId(DRIVER_OPTIONS[driver.kind], driver.driverId)?.name ?? driver.driverId;
