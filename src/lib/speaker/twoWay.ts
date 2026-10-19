// The two-way speaker's tweeter: whether it needs a waveguide, where the drivers sit, its clean level and the power it
// gets (active, or through a passive network), and the weights of the parts. Pure functions, no DOM.
import { HIFI_BOX_LAYOUT } from "../../constants/hifiLayout";
import type {
  NominalImpedance,
  Dims3,
  DriverLayout,
  HifiConfig,
  HifiWaveguide,
  LimitId,
  WaveguideSpec,
  HifiTweeter,
  HifiWoofer,
  PassiveRadiatorChoice,
} from "../../types";
import { ownGuideCfg, waveguideSpecOf } from "../data";
import { HIFI_DRIVE, RIBBON_TWEETER_TYPE, AMT_TWEETER_TYPE } from "../../constants/hifiEngine";
import { SENSITIVITY_REFERENCE_OHMS, ohmsOf, voltsToWatts, wattsToVolts } from "../power";
/** Whether a tweeter is a planar ribbon on its own waveguide (a square plate with a slot). */
export const isRibbon = (t: Pick<HifiTweeter, "type">): boolean => t.type === RIBBON_TWEETER_TYPE;

/** Whether a tweeter is an AMT: a folded diaphragm behind a flat plate with a tall opening. */
export const isAmt = (t: Pick<HifiTweeter, "type">): boolean => t.type === AMT_TWEETER_TYPE;

/** Whether a tweeter has to be mounted on a waveguide or horn (a compression driver, or a dome made for one) rather than sit on the baffle. */
export const needsWaveguide = (t: Pick<HifiTweeter, "type" | "needsWaveguide">): boolean =>
  t.type === "compression" || !!t.needsWaveguide;

/**
 * The waveguide a tweeter plays through: its own (a ribbon's or an AMT's plate, a coaxial's cone), the picked one for a tweeter
 * that needs one, else none.
 */
export const waveguideFor = (tweeter: HifiTweeter, picked: HifiWaveguide): WaveguideSpec | null =>
  tweeter.ownGuide
    ? ownGuideCfg(tweeter)
    : needsWaveguide(tweeter)
      ? waveguideSpecOf(picked)
      : null;

/** The tweeter as the baffle takes it: on a waveguide, its cut-out is the waveguide's mouth. */
export const tweeterOnGuide = (
  tweeter: HifiTweeter,
  guide: Pick<WaveguideSpec, "w" | "h"> | null,
): HifiTweeter => (guide ? { ...tweeter, faceplate: { w: guide.w, h: guide.h } } : tweeter);

/**
 * Whether the woofer and tweeter are one coaxial (lib/data coaxParts): both parts carry the coaxial's id. A design
 * names a coaxial by giving it as both its woofer and its tweeter.
 */
export const isCoax = (w: Pick<HifiWoofer, "id">, t: Pick<HifiTweeter, "id">) => w.id === t.id;
// where the drivers sit (inches from the box bottom): tweeter near the top, woofer just below it;
// a freestanding waveguide sits on the box top, so the woofer moves up to the top of the baffle;
// a coaxial's HF is at its woofer's center, the woofer at the top of the baffle
export function driverLayout(
  w: HifiWoofer,
  t: HifiTweeter,
  d: Dims3,
  onTop: boolean,
): DriverLayout {
  const face = t.faceplate;
  const { topMarginIn, driverGapIn } = HIFI_BOX_LAYOUT;
  if (isCoax(w, t)) {
    const wh = d.h - topMarginIn - w.size / 2;
    return { tweeterIn: wh, wooferIn: wh, spacingIn: 0, coax: true };
  }
  if (onTop) {
    const th = d.h + face.h / 2,
      wh = d.h - topMarginIn - w.size / 2;
    return { tweeterIn: th, wooferIn: wh, spacingIn: th - wh, onTop: true };
  }
  const th = d.h - topMarginIn - face.h / 2;
  const wh = th - face.h / 2 - driverGapIn - w.size / 2;
  return { tweeterIn: th, wooferIn: wh, spacingIn: th - wh };
}

/**
 * A tweeter's clean maximum level at 1 m: its sensitivity and power, derated below the frequency its rating assumes,
 * and what sets the power (the amp, or the program rating: "thermal").
 */
export function tweeterMaxLevel(
  t: Pick<HifiTweeter, "hf">,
  cfg: Pick<HifiConfig, "xo" | "tAmpW" | "guideGain">,
) {
  const hf: Partial<HifiTweeter["hf"]> = t.hf || {};
  const imp = ohmsOf(hf);
  // the amp power is the watts into the tweeter's impedance (lib/power)
  const pAmp = cfg.tAmpW || 50;
  const derate = hf.aesXo && cfg.xo < hf.aesXo ? Math.pow(cfg.xo / hf.aesXo, 2) : 1;
  const pProg = hf.aes ? 2 * hf.aes * derate : Infinity;
  const pMax = Math.min(pAmp, pProg);
  const tSens = hf.sens != null ? hf.sens + (cfg.guideGain || 0) : 90;
  const who: Extract<LimitId, "amp" | "thermal"> = pMax === pAmp ? "amp" : "thermal";
  return { imp, derate, pMax, pProg, who, tSens, tLevel: tSens + 10 * Math.log10(pMax) };
}
/**
 * The power the tweeter gets, W into its impedance (as `tAmpW`): its own amp's when active; when passive, the one amp
 * channel's, `wAmpW` into the woofer's impedance, as a voltage through the network's pad, the level match `trim` dB
 * (lib/power). A tweeter quieter than the woofer (trim > 0) takes the full amp: a passive network can't add gain, so
 * the woofer would be padded instead, and the tweeter's level then caps the speaker's, as `maxLevel` reads it. The
 * Fills page's `hfLimW` (lib/acoustics/boxModels fillSystem) is this relation solved for the amp power that brings the HF to its
 * program rating.
 */
export const tweeterAmpWatts = (
  cfg: Pick<HifiConfig, "drive" | "wAmpW" | "tAmpW">,
  trim: number,
  woofer: NominalImpedance,
  tweeter: NominalImpedance,
): HifiConfig["tAmpW"] =>
  cfg.drive === HIFI_DRIVE.passive
    ? voltsToWatts(wattsToVolts(cfg.wAmpW, woofer) * Math.pow(10, Math.min(0, trim) / 20), tweeter)
    : cfg.tAmpW;
/**
 * The tweeter in a box whose woofer's passband sensitivity is `refW` (dB at 2.83 V, `HifiSystem.refW`): its own
 * figures (`tweeterMaxLevel`), its sensitivity at 2.83 V, the level match `trim` (dB applied to the tweeter in the DSP,
 * or the passive network's pad; usually negative), and its clean level from its own amp, or, passive, from the woofer
 * amp through that pad. `hifiSystemFromBox` and the optimizer's passive search both read it.
 */
export function tweeterLevelInBox(
  t: HifiTweeter,
  cfg: Pick<HifiConfig, "xo" | "tAmpW" | "guideGain" | "drive" | "wAmpW">,
  refW: number,
  woofer: NominalImpedance,
) {
  const own = tweeterMaxLevel(t, cfg);
  const tSens283 = own.tSens + 10 * Math.log10(SENSITIVITY_REFERENCE_OHMS / own.imp);
  const trim = refW - tSens283;
  const level =
    cfg.drive === HIFI_DRIVE.passive
      ? tweeterMaxLevel(t, { ...cfg, tAmpW: tweeterAmpWatts(cfg, trim, woofer, t.hf) })
      : own;
  return { ...level, tSens283, trim };
}
/** What the Hi-fi weights take for a part with no listed weight, lb: a woofer, a tweeter, a passive radiator. */
export const HIFI_FALLBACK_LB = { woofer: 5, tweeter: 1.5, radiator: 0.75 } as const;
/** A Hi-fi speaker's hardware besides its drivers, lb: the screws, the terminals and the damping. */
export const HIFI_FIXINGS_LB = 1;
/** Grams in a pound, as the radiators' added mass is weighed. */
const GRAMS_PER_LB = 454;
/** The radiators' weight, lb: each one's listed weight (or the fallback) and its added mass. */
export const radiatorsLb = (pr: Pick<PassiveRadiatorChoice, "drv" | "n" | "addG">) =>
  pr.n * ((pr.drv.lb || HIFI_FALLBACK_LB.radiator) + (pr.addG || 0) / GRAMS_PER_LB);
