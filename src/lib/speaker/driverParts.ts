// A speaker spec's driver as its catalog part: the figures the speaker model and the horn engine read. Each kind keeps
// the rules of the engine its table comes from (the PA's subs and mids, the Hi-fi's woofers, tweeters and coaxials).
// Pure.
import type { BoxModelTS, DriverKind, SpeakerDriver } from "../../types";
import { CD_OPTIONS, FILL_OPTIONS, MID_OPTIONS, SUB_OPTIONS, hifiDriverById } from "../data";
import { byId } from "../tables";
import { midDisplacementL } from "../pa/calc";
import { hifiWooferDisplacementL } from "../hifi/hifi";
import { DRIVER_KIND } from "../../constants/speakerSpec";

/** A cone driver as the box models take it: its Thiele/Small parameters and its displacement, L. */
export interface ConeParts {
  ts: BoxModelTS;
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
