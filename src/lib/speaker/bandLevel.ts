// A band's level as every model reads it: an active band's Gain, or a passive band's Pad, which only cuts. Pure.
import type { SpeakerBand } from "../../types";
import { HIFI_DRIVE } from "../../constants/hifiEngine";

/** The highest Pad, dB: a passive network cannot add gain. */
export const PAD_MAX_DB = 0;

/** Whether a band is a passive band: its level is a Pad. */
export const isPassive = (band: Pick<SpeakerBand, "drive">) => band.drive === HIFI_DRIVE.passive;

/** A band's level, dB: its Gain (active), or its Pad, never above `PAD_MAX_DB` (passive). */
export const bandLevelDb = (band: Pick<SpeakerBand, "drive" | "levelDb">) =>
  isPassive(band) ? Math.min(PAD_MAX_DB, band.levelDb) : band.levelDb;

/** The band with its level as the models read it: a passive band's Pad never above `PAD_MAX_DB`. */
export const withPadCapped = <B extends Pick<SpeakerBand, "drive" | "levelDb">>(band: B): B =>
  isPassive(band) && band.levelDb > PAD_MAX_DB ? { ...band, levelDb: PAD_MAX_DB } : band;
