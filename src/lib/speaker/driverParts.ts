// A speaker spec's driver as its catalog part: the figures the speaker model and the horn engine read. Each kind keeps
// the rules of the engine its table comes from (the PA's subs and mids, the Hi-fi's woofers, tweeters and coaxials).
// Pure.
import type {
  BoxModelTS,
  CompressionDriver,
  DriverKind,
  Horn,
  SpeakerDriver,
  ThieleSmall,
} from "../../types";
import {
  CD_OPTIONS,
  FILL_OPTIONS,
  MID_OPTIONS,
  SUB_OPTIONS,
  hifiDriverById,
  hornById,
} from "../data";
import { byId } from "../tables";
import { midDisplacementL } from "../pa/calc";
import { hifiWooferDisplacementL } from "../hifi/hifi";
import { DRIVER_KIND } from "../../constants/speakerSpec";

/**
 * A cone driver as the models take it: its Thiele/Small parameters (with the coil's inductance where published) and
 * its power rating, which the limits read (lib/speaker/speakerLimits), and its displacement, L.
 */
export interface ConeParts {
  ts: BoxModelTS & Pick<ThieleSmall, "aes">;
  dispL: number;
}

/** The kinds with a cone in the chamber's air (Thiele/Small parameters); the others are datasheet drivers. */
const CONE_KINDS: ReadonlySet<DriverKind> = new Set([
  DRIVER_KIND.sub,
  DRIVER_KIND.mid,
  DRIVER_KIND.woofer,
  DRIVER_KIND.coaxial,
]);

/** Whether a driver kind has a cone in the chamber's air. */
export const isConeKind = (kind: DriverKind) => CONE_KINDS.has(kind);

/**
 * A cone driver's parts; null for a datasheet kind (compression, tweeter) or an id its table doesn't have. A sub lists
 * its displacement; a mid and a woofer fall back to their engine's estimate; a coaxial takes the Hi-fi woofer's rule,
 * as the Hi-fi engine models it (lib/data coaxParts).
 */
export function coneParts(driver: SpeakerDriver): ConeParts | null {
  switch (driver.kind) {
    case DRIVER_KIND.sub: {
      const sub = byId(SUB_OPTIONS, driver.driverId);
      return sub ? { ts: sub.ts, dispL: sub.ts.disp } : null;
    }
    case DRIVER_KIND.mid: {
      const mid = byId(MID_OPTIONS, driver.driverId);
      return mid ? { ts: mid.ts, dispL: midDisplacementL(mid) } : null;
    }
    case DRIVER_KIND.woofer: {
      const woofer = hifiDriverById("woofer", driver.driverId);
      return woofer ? { ts: woofer.ts, dispL: hifiWooferDisplacementL(woofer) } : null;
    }
    case DRIVER_KIND.coaxial: {
      const coax = byId(FILL_OPTIONS, driver.driverId);
      return coax ? { ts: coax.ts, dispL: hifiWooferDisplacementL(coax) } : null;
    }
    case DRIVER_KIND.compression:
    case DRIVER_KIND.tweeter:
      return null;
  }
}

/** A driver's HF section on the datasheet: its 1 W sensitivity (dB at 1 m) and impedance, Ω. */
export interface HfParts {
  sens: number;
  imp: number;
}

/** The impedance a datasheet assumes where it gives none, Ω (as hornResponse and tweeterMaxLevel take it). */
const NOMINAL_OHMS = 8;

/**
 * A driver's HF section: a compression driver's or a tweeter's datasheet, or a coaxial's compression section; null for
 * a cone kind, an unknown id, or one with no published sensitivity.
 */
export function hfParts(driver: SpeakerDriver): HfParts | null {
  switch (driver.kind) {
    case DRIVER_KIND.compression: {
      const hf = byId(CD_OPTIONS, driver.driverId)?.hf;
      return hf ? { sens: hf.sens, imp: hf.imp || NOMINAL_OHMS } : null;
    }
    case DRIVER_KIND.tweeter: {
      const hf = hifiDriverById("tweeter", driver.driverId)?.hf;
      return hf ? { sens: hf.sens, imp: hf.imp || NOMINAL_OHMS } : null;
    }
    case DRIVER_KIND.coaxial: {
      const hf = byId(FILL_OPTIONS, driver.driverId)?.hf;
      return hf ? { sens: hf.sens, imp: hf.imp || NOMINAL_OHMS } : null;
    }
    case DRIVER_KIND.sub:
    case DRIVER_KIND.mid:
    case DRIVER_KIND.woofer:
      return null;
  }
}

/** Whether a horn's throat and a compression driver's exit differ in size (the PA page's and the Speaker page's check). */
export const hornExitsDiffer = (
  horn: Pick<Horn, "exit">,
  driver: Pick<CompressionDriver, "exit">,
): boolean => horn.exit !== driver.exit;

/**
 * A compression driver and its catalog horn when the horn's throat and the driver's exit differ; null for another
 * kind, no horn, an unknown id, or a matched pair.
 */
export function mismatchedHornExit(
  driver: SpeakerDriver,
): { horn: Horn; driver: CompressionDriver } | null {
  if (driver.kind !== DRIVER_KIND.compression || !driver.horn) return null;
  const cd = byId(CD_OPTIONS, driver.driverId);
  const horn = hornById(driver.horn.hornId);
  return cd && horn && hornExitsDiffer(horn, cd) ? { horn, driver: cd } : null;
}

/** A driver's catalog listing: its name (maker and model), US price (null where none is known) and price source. */
export function driverListing(
  driver: Pick<SpeakerDriver, "kind" | "driverId">,
): { name: string; price: number | null; src: string } | null {
  switch (driver.kind) {
    case DRIVER_KIND.sub:
      return byId(SUB_OPTIONS, driver.driverId) ?? null;
    case DRIVER_KIND.mid:
      return byId(MID_OPTIONS, driver.driverId) ?? null;
    case DRIVER_KIND.compression:
      return byId(CD_OPTIONS, driver.driverId) ?? null;
    case DRIVER_KIND.woofer:
      return hifiDriverById("woofer", driver.driverId) ?? null;
    case DRIVER_KIND.tweeter:
      return hifiDriverById("tweeter", driver.driverId) ?? null;
    case DRIVER_KIND.coaxial:
      return byId(FILL_OPTIONS, driver.driverId) ?? null;
  }
}

/**
 * A catalog price source as the purchased parts table's Source column shows it: a link as its site
 * ("pvcfittingsonline.com"), any other text as written. It is free text (a vendor, an estimate, a print service), not
 * always a vendor.
 */
export const sourceOf = (src: string): string => {
  if (!/^https?:\/\//.test(src)) return src;
  try {
    return new URL(src).hostname.replace(/^www\./, "");
  } catch {
    return src;
  }
};
