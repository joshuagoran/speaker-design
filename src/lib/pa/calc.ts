// Calculation functions for the planner. Pure TS, no React, window or THREE.
import type {
  BoxAxis,
  BoxBracing,
  BoxKeepOut,
  BoxModelTS,
  BoxRegion,
  BackJointId,
  BraceStyleId,
  CompressionHf,
  CornerJoint,
  CrossoverOrder,
  CutBoxId,
  CutPart,
  CutPartId,
  CutPartsConfig,
  BoxHandles,
  BoxHardwarePlan,
  CogMass,
  Dims3,
  FillDriver,
  FillSystem,
  FillSystemConfig,
  FrequencyPoint,
  HighpassType,
  HornHf,
  HornResponse,
  MidDriver,
  PlateHole,
  MidSystem,
  MidSystemConfig,
  PaLayout,
  PaMaxPoint,
  PlateStock,
  PhasedPoint,
  PortStyle,
  SealedBoxModel,
  SealedPoint,
  SubDriver,
  SubGeometry,
  SubGeometryConfig,
  SubLimits,
  SubSystem,
  SubSystemConfig,
  ThieleSmall,
  VentedBoxModel,
  VentedPoint,
  VentGeometry,
  VentSpec,
} from "../../types";
import {
  DRIVER_CUTOUT_IN,
  DRIVER_MOTOR_DIA_IN,
  MID_DEPTH_FALLBACK_IN,
} from "../../data/catalog/driver-cutouts";
import { defaultPanelIn, panelLbPerSqFt } from "../panel";
import { DUCT_DIVIDER_DEFAULT, PLYWOOD_MATERIAL } from "../../constants/panelSizes";
import { crossoverSlopeName } from "../../constants/crossovers";
import { SHARP_BEND_CORRECTION, SLOT_INNER_END } from "../../data/acoustics/slot-inner-end";
import {
  modelTubeElbows,
  subDriverDepthIn,
  subTubeEndCorrection,
  subTubeKit,
  tubeDriverOnBaffle,
  tubeLayout,
  type TubeDriver,
} from "./tubes";
import { TUBE_FLARE_RADIUS_IN } from "../../data/acoustics/tube-ends";
import { ELBOW_WORDS } from "../../constants/portStyles";
import {
  BOX_AXIS_NAMES,
  BRACE_PANEL_NAMES,
  DEFAULT_BACK_JOINT,
  RIB_HALF_LAP_NOTE,
} from "../../constants/bracing";
import {
  BIRCH_PLY_STIFFNESS,
  BOX_AXES,
  braceBox,
  defaultBraceStyleNear,
  ribRunAxis,
  WINDOW_RAIL_IN,
  windowWoodIn3,
} from "../bracing";
import {
  BASKET_RING_SHARE,
  BASKET_TAPER_STEPS,
  BRACE_ESTIMATE,
  DRIVER_CLEARANCE_IN,
  MOTOR_START_SHARE,
  DUCT_SUPPORT_MIN_SHARE,
  NO_SUPPORTS,
  PA_PANEL_TARGET_HZ,
  paBoxPanels,
  type PaBoxSupports,
} from "./bracing";
import { hardwareKeepOut, hardwareLiters, mountedCutout, planBoxHardware } from "./hardware";
import { INPUT_JACK } from "../../data/catalog/cabinet-hardware";
import { HARDWARE_KIND_NAMES, hardwarePlaceWords } from "../../constants/hardware";

// Which sub vent layouts are round tubes; a record over every `PortStyle`, so a new layout must say which it is.
const ROUND_PORT: Record<PortStyle, boolean> = {
  slots: false,
  vslots: false,
  vslot1: false,
  round1: true,
  round2: true,
  round4: true,
};
/**
 * The longest straight bottom slot, in inches from the baffle front: the floor run to the back wall (`t` the wall ply),
 * leaving the slot's own height open behind its mouth.
 */
export const maxStraightSlotIn = (box: Pick<Dims3, "d">, slotH: number, t: number) =>
  box.d - t - slotH;
/**
 * Whether a bottom slot (`slots`) folds up the back wall: only when it is longer than the straight run holds. A slot
 * that fits straight is built, and modeled, straight.
 */
export const slotFolds = (box: Pick<Dims3, "d">, v: Pick<VentSpec, "slotH" | "len">, t: number) =>
  v.len > maxStraightSlotIn(box, v.slotH, t);
/**
 * A folded bottom slot's floor shelf (the floor leg's roof), from the baffle front as a straight slot's shelf is: the
 * longest straight run less the rear channel's wall (`t`), which the shelf runs up to.
 */
export const foldedShelfIn = (box: Pick<Dims3, "d">, slotH: number, t: number) =>
  maxStraightSlotIn(box, slotH, t) - t;
// The least the rear channel's wall rises from the floor leg's roof's underside, so the folded duct has a mouth to open
// into.
const FOLD_MIN_WALL_IN = 1;
/**
 * The most a folded bottom slot's rear channel wall rises from the floor leg's roof's underside: up to one slot height
 * under the lid's inside face, so the channel's mouth has the same gap to the lid as a straight slot's has to the back wall. The
 * floor (`t`) and the slot sit under the roof's underside, the lid (`t`) over the gap.
 */
export const maxFoldedRearWallIn = (box: Pick<Dims3, "h">, slotH: number, t: number) =>
  box.h - 2 * t - 2 * slotH;
/**
 * A folded bottom slot's rear channel wall, in inches up from the underside of the floor leg's roof (`t + slotH` above
 * the box's bottom, where the wall starts: the floor leg runs on under it into the channel). The duct's length is its
 * centerline:
 * the floor run from the baffle front to the middle of the rear channel (`d - t - slotH / 2`), then up the channel to
 * the wall's top (`slotH / 2` + the wall), so the wall is `len - (d - t)`, never under the least rise nor over the most
 * (the model, the 3D view and the cutlist all take this one wall).
 */
export const foldedRearWallIn = (
  box: Pick<Dims3, "d" | "h">,
  v: Pick<VentSpec, "slotH" | "len">,
  t: number,
) =>
  Math.max(FOLD_MIN_WALL_IN, Math.min(maxFoldedRearWallIn(box, v.slotH, t), v.len - (box.d - t)));
/**
 * The shortest folded bottom slot that can be built (its rear wall at the least rise). A slot longer than the straight
 * run holds but shorter than this fits neither way.
 */
export const minFoldedSlotIn = (box: Pick<Dims3, "d">, t: number) => box.d - t + FOLD_MIN_WALL_IN;
/** The longest folded bottom slot: its rear wall at the most rise, one slot height under the lid. */
export const maxFoldedSlotIn = (box: Pick<Dims3, "d" | "h">, slotH: number, t: number) =>
  box.d - t + maxFoldedRearWallIn(box, slotH, t);
/** The gap from a folded bottom slot's mouth (the rear channel's top) up to the inside of the lid, in inches. */
export const foldedLidGapIn = (
  box: Pick<Dims3, "d" | "h">,
  v: Pick<VentSpec, "slotH" | "len">,
  t: number,
) => box.h - 2 * t - v.slotH - foldedRearWallIn(box, v, t);

/**
 * A flared tube's air-speed limit over a sharp-edged vent's: flaring the ends delays the flow's separation at the mouth,
 * where the jet and its vortices make the noise and compression that set the limit (Roozen, Bockholts, van Eck &
 * Hirschberg, "Vortex sound in bass-reflex ports of loudspeakers", J. Acoust. Soc. Am. 104 (1998) 1914–1924; Salvatti,
 * Devantier & Button, "Maximizing performance from loudspeaker ports", J. Audio Eng. Soc. 50 (2002) 19–45, whose flared
 * ports stay clean to well above a straight port's onset). About 30 m/s against the 23.5 m/s sine peak the planner
 * allows a sharp-edged slot, whose cut ends the cutlist doesn't round over.
 */
export const FLARED_PORT_SPEED_RATIO = 30 / 23.5;
/**
 * The air-speed limit for a vent, m/s: `portMax` (the planner's setting, a sharp-edged vent's) for the slots and side
 * ducts, FLARED_PORT_SPEED_RATIO times it for flared round tubes.
 */
export const ventSpeedLimit = (style: PortStyle, portMax: number) =>
  ROUND_PORT[style] ? portMax * FLARED_PORT_SPEED_RATIO : portMax;

/** Whether the sub's vents are round tubes (`round1`, `round2`, `round4`) rather than rectangular ducts. */
export const isRoundPort = (style: PortStyle): style is Extract<PortStyle, `round${string}`> =>
  ROUND_PORT[style];

// ---------------------------------------------------------------
// Vented-box model. Same lumped-element circuit used to check this
// design offline; see the provenance note under the table.
// Complex helpers kept local and minimal.
// ---------------------------------------------------------------
interface Complex {
  re: number;
  im: number;
}
export const complex = (re: number, im = 0): Complex => ({ re, im });
export const addComplex = (a: Complex, b: Complex): Complex => ({
  re: a.re + b.re,
  im: a.im + b.im,
});
export const multiplyComplex = (a: Complex, b: Complex): Complex => ({
  re: a.re * b.re - a.im * b.im,
  im: a.re * b.im + a.im * b.re,
});
export const divideComplex = (a: Complex, b: Complex): Complex => {
  const d = b.re * b.re + b.im * b.im;
  return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
};
export const invertComplex = (a: Complex) => divideComplex(complex(1), a);
export const complexMagnitude = (a: Complex) => Math.hypot(a.re, a.im);

// Filter magnitudes. Butterworth order n: x^n / sqrt(1 + x^2n). Linkwitz-Riley 2m: a
// Butterworth m squared, x^2m / (1 + x^2m). LR24 is -6 dB at the corner, BW24 -3 dB.
export const HIGHPASS_ALIGNMENTS: Record<
  HighpassType,
  readonly [kind: "bw" | "lr", order: number]
> = {
  BW24: ["bw", 4],
  LR24: ["lr", 4],
  BW48: ["bw", 8],
  LR48: ["lr", 8],
};
export const highpassGain = (f: number, fc: number, type: HighpassType = "BW24") => {
  const [kind, n] = HIGHPASS_ALIGNMENTS[type] || HIGHPASS_ALIGNMENTS.BW24,
    x = f / fc;
  const xn = Math.pow(x, n);
  return kind === "bw" ? xn / Math.sqrt(1 + xn * xn) : xn / (1 + xn);
};
// The normalized Butterworth sections of even order n, s² + b·s + 1: each b = 2 sin((2k − 1)π / 2n), k = 1 … n/2.
// Kept per order: the hi-fi crossover calls for them at every frequency of every design the optimizer tries.
const SECTIONS = new Map<number, number[]>();
function butterworthSections(n: number) {
  let b = SECTIONS.get(n);
  if (!b) {
    b = Array.from({ length: n / 2 }, (_, k) => 2 * Math.sin(((2 * k + 1) * Math.PI) / (2 * n)));
    SECTIONS.set(n, b);
  }
  return b;
}
// Normalized Butterworth denominator of even order n: the product of its sections, in plain real arithmetic
export function butterworth(s: Complex, n: number): Complex {
  const s2re = s.re * s.re - s.im * s.im,
    s2im = 2 * s.re * s.im;
  let re = 1,
    im = 0;
  for (const b of butterworthSections(n)) {
    const qre = s2re + b * s.re + 1,
      qim = s2im + b * s.im,
      t = re * qre - im * qim;
    im = re * qim + im * qre;
    re = t;
  }
  return { re, im };
}
// The highpass's phase, radians, continuous in f: each section s² / (s² + b·s + 1) leads by π less its denominator's
// angle, π far below the corner to 0 far above. A Butterworth n, or a Linkwitz-Riley as two of n/2; highpassGain is
// its magnitude.
export function highpassPhase(f: number, fc: number, type: HighpassType = "BW24") {
  const [kind, n] = HIGHPASS_ALIGNMENTS[type] || HIGHPASS_ALIGNMENTS.BW24,
    x = f / fc;
  const bw = (m: number) =>
    butterworthSections(m).reduce((p, b) => p + Math.PI - Math.atan2(b * x, 1 - x * x), 0);
  return kind === "bw" ? bw(n) : 2 * bw(n / 2);
}
// A model curve's box phase made continuous: each point moved by whole turns to within half a turn of the next one
// up, from the top of the curve down (the top keeps its own value: there a box's phase is near 0).
function unwrapRawPhase(curve: Pick<VentedPoint | SealedPoint, "rawPhase">[]) {
  for (let i = curve.length - 2; i >= 0; i--) {
    const p = curve[i].rawPhase ?? 0,
      up = curve[i + 1].rawPhase ?? 0;
    curve[i].rawPhase = p - 2 * Math.PI * Math.round((p - up) / (2 * Math.PI));
  }
}
// A model run with its phase option, as the type that says so: every point has the box's phase. Throws for one run
// without it, which only a bug in the caller's own call can give.
export function phasedCurve<P extends VentedPoint | SealedPoint>(
  curve: readonly P[],
): PhasedPoint<P>[] {
  const out = curve.filter((o): o is PhasedPoint<P> => o.rawPhase != null);
  if (out.length !== curve.length) throw new Error("the box model was run without its phase");
  return out;
}
// Linkwitz-Riley crossover magnitudes of either order (4 = LR24, 8 = LR48), both -6 dB at fc
export const linkwitzRileyLowpass = (f: number, fc: number, order: CrossoverOrder) =>
  1 / (1 + Math.pow(f / fc, order));
export const linkwitzRileyHighpass = (f: number, fc: number, order: CrossoverOrder) =>
  highpassGain(f, fc, crossoverSlopeName(order));

// Vent tuning: effective length (m) and Fb for net volume VbL, total vent area SpIn2 over nPorts equal
// openings, physical length LpIn, and total end correction ecIn in inches (default 1.46 r per opening).
export function ventTuning(
  VbL: number,
  SpIn2: number,
  LpIn: number,
  nPorts = 1,
  ecIn?: number,
): { Leff: number; Fb: number } {
  const c = 343,
    Sp = SpIn2 * 0.00064516,
    Vb = VbL / 1000;
  const reff = Math.sqrt(Sp / nPorts / Math.PI); // radius of each opening
  const Leff = LpIn * 0.0254 + (ecIn != null ? ecIn * 0.0254 : 1.46 * reff); // one flanged + one free end per opening
  return { Leff, Fb: (c / (2 * Math.PI)) * Math.sqrt(Sp / (Vb * Leff)) };
}

// opts: nPorts (separate openings sharing the area), QL (box leakage, default 7), Qp (port losses, default 50),
// ecIn (total end correction in inches, both ends; default 1.46 r per opening), N (frequency points, default 420;
// fewer only for the optimizer's screening), fTop (run the curve on past fmax to here; see logGridCount), phase (give
// each point the box's phase, `rawPhase`: the coverage map's; the optimizers leave it off).
export interface BoxModelOptions {
  phase?: boolean;
  nPorts?: number;
  QL?: number;
  Qp?: number;
  ecIn?: number;
  N?: number;
  fmin?: number;
  fmax?: number;
  fTop?: number;
}
// How far past a lowpass corner a curve runs so its skirt shows: at 2.5x the corner an LR24 is 32 dB down.
export const LOWPASS_SKIRT_SPAN = 2.5;
// Points on the log grid fmin..fmax (N points), carried on at the same spacing until it reaches fTop. The points up
// to fmax stay exactly where they were, so running a curve on never moves a reading inside the usual range.
export function logGridCount(N: number, fmin: number, fmax: number, fTop: number | undefined) {
  if (!fTop || fTop <= fmax) return N;
  return N + Math.ceil(((N - 1) * Math.log(fTop / fmax)) / Math.log(fmax / fmin));
}
export function boxModel(
  ts: BoxModelTS,
  VbL: number,
  SpIn2: number,
  LpIn: number,
  hpf: number,
  volts: number,
  hpType: HighpassType = "BW24",
  opts: BoxModelOptions = {},
): VentedBoxModel | null {
  if (!ts || !VbL || !SpIn2 || LpIn <= 0) return null;
  const { nPorts = 1, QL = 7, Qp = 50, ecIn, N = 420, fmin = 12, fmax = 300, fTop, phase } = opts;
  const rho = 1.18,
    c = 343;
  const Sd = ts.Sd / 10000; // cm^2 -> m^2
  const Mms = ts.Mms / 1000; // g -> kg
  const Vb = VbL / 1000;
  const Cms = 1 / (Math.pow(2 * Math.PI * ts.Fs, 2) * Mms);
  const Mas = Mms / (Sd * Sd);
  const Cas = Cms * Sd * Sd;
  const Ras = (2 * Math.PI * ts.Fs * Mms) / ts.Qms / (Sd * Sd);
  const Rae = (ts.Bl * ts.Bl) / ts.Re / (Sd * Sd);
  const Cab = Vb / (rho * c * c);
  const Sp = SpIn2 * 0.00064516;
  const { Leff, Fb } = ventTuning(VbL, SpIn2, LpIn, nPorts, ecIn);
  const Map = (rho * Leff) / Sp;
  const Ral = QL / (2 * Math.PI * Fb * Cab);
  const Rap = Number.isFinite(Qp) ? (2 * Math.PI * Fb * Map) / Qp : 0; // port friction and turbulence
  const Pg = (volts * ts.Bl) / (ts.Re * Sd);

  const out: VentedPoint[] = [];
  const count = logGridCount(N, fmin, fmax, fTop);
  for (let i = 0; i < count; i++) {
    const f = fmin * Math.pow(fmax / fmin, i / (N - 1));
    // the same circuit in plain real arithmetic (no complex objects: this loop runs millions of times in the optimizers)
    const w = 2 * Math.PI * f;
    // Zd = Ras + Rae + j(w Mas - 1/(w Cas)); 1/Zc = j w Cab; 1/Zp = 1/(Rap + j w Map); 1/Ral
    const dRe = Ras + Rae,
      dIm = w * Mas - 1 / (w * Cas);
    const pIm = w * Map,
      pM = Rap * Rap + pIm * pIm,
      ypRe = Rap / pM,
      ypIm = -pIm / pM;
    const yRe = ypRe + 1 / Ral,
      yIm = ypIm + w * Cab,
      yM = yRe * yRe + yIm * yIm;
    const bRe = yRe / yM,
      bIm = -yIm / yM; // Zbox = 1 / Y
    const tRe = dRe + bRe,
      tIm = dIm + bIm,
      tM = tRe * tRe + tIm * tIm;
    const uRe = (Pg * tRe) / tM,
      uIm = (-Pg * tIm) / tM; // Ud = Pg / (Zd + Zbox)
    const vRe = uRe * bRe - uIm * bIm,
      vIm = uRe * bIm + uIm * bRe; // Ud Zbox: box pressure
    const pv = Math.sqrt(vRe * vRe + vIm * vIm),
      Ud = Math.sqrt(uRe * uRe + uIm * uIm);
    const Up = pv / Math.sqrt(pM); // |Ud Zbox / Zp|
    // radiated = cone - port - leak = the flow into the box air: |Ud Zbox / Zc| = |Ud Zbox| w Cab
    const Ut = pv * w * Cab;
    const hp = highpassGain(f, hpf, hpType);
    const p = (rho * w * Ut) / (2 * Math.PI);
    const raw = 20 * Math.log10(p / 2e-5);
    // volts is RMS; x1.414 turns RMS travel and air speed into sine peaks, which Xmax and the 17 m/s limit mean
    const pt: VentedPoint = {
      f,
      raw,
      spl: raw + 20 * Math.log10(hp),
      xmm: Math.SQRT2 * (Ud / (w * Sd)) * hp * 1000,
      vel: Math.SQRT2 * (Up / Sp) * hp,
    };
    // the radiated pressure is jω × the flow into the box air, jω Cab·Ud Zbox: −ω² Cab·Ud Zbox, in phase with −Ud Zbox
    if (phase) pt.rawPhase = Math.atan2(-vIm, -vRe);
    out.push(pt);
  }
  if (phase) unwrapRawPhase(out);
  // midband reference: the mass-controlled asymptote (see closedBox)
  const ref = 20 * Math.log10((rho * volts * ts.Bl * Sd) / (2 * Math.PI * ts.Re * Mms) / 2e-5);
  const f3 = (out.find((o) => o.spl >= ref - 3) || out[out.length - 1]).f; // system, with the highpass
  const f3Box = (out.find((o) => o.raw >= ref - 3) || out[out.length - 1]).f; // box alone
  const at = (t: number) => out.reduce((b, o) => (Math.abs(o.f - t) < Math.abs(b.f - t) ? o : b));
  const lo = out; // limits are searched over the whole curve (12-300 Hz, and any run-on, where both only fall)
  return {
    curve: out,
    Fb,
    f3,
    f3Box,
    ref,
    spl30: at(30).spl,
    spl35: at(35).spl,
    spl45: at(45).spl,
    peakVel: Math.max(...lo.map((o) => o.vel)),
    peakVelF: lo.reduce((b, o) => (o.vel > b.vel ? o : b)).f,
    peakX: Math.max(...lo.map((o) => o.xmm)),
    peakXF: lo.reduce((b, o) => (o.xmm > b.xmm ? o : b)).f,
    xmaxPct: (Math.max(...lo.map((o) => o.xmm)) / ts.Xmax) * 100,
  };
}

// ---------------------------------------------------------------
// Sealed-box model for the mid-bass: the same driver circuit with the box
// compliance in series and no port. hp and lp are the crossover corners,
// Linkwitz-Riley of the orders opts gives (hpOrder, lpOrder). Voice-coil inductance is not
// modeled, so the top octave reads a little high. Excursion is the sine peak, as in boxModel; opts.phase gives each
// point the box's phase (without the crossover's), as boxModel does.
// ---------------------------------------------------------------
export function closedBox(
  ts: BoxModelTS,
  VbL: number,
  hp: number | null,
  lp: number | null,
  volts: number,
  opts: Pick<BoxModelOptions, "N" | "fmin" | "fmax" | "fTop" | "phase"> & {
    hpOrder: CrossoverOrder;
    lpOrder: CrossoverOrder;
  },
): SealedBoxModel | null {
  const { N = 420, fmin = 20, fmax = 2000, fTop, phase, hpOrder, lpOrder } = opts;
  if (!ts || !VbL || VbL <= 0) return null;
  const rho = 1.18,
    c = 343;
  const Sd = ts.Sd / 10000,
    Mms = ts.Mms / 1000,
    Vb = VbL / 1000;
  const Cms = 1 / (Math.pow(2 * Math.PI * ts.Fs, 2) * Mms);
  const Mas = Mms / (Sd * Sd),
    Cas = Cms * Sd * Sd;
  const Ras = (2 * Math.PI * ts.Fs * Mms) / ts.Qms / (Sd * Sd);
  const Rae = (ts.Bl * ts.Bl) / ts.Re / (Sd * Sd);
  const Cab = Vb / (rho * c * c);
  const Pg = (volts * ts.Bl) / (ts.Re * Sd);
  const Ctot = (Cas * Cab) / (Cas + Cab);
  const Fc = 1 / (2 * Math.PI * Math.sqrt(Mas * Ctot));
  const Qes = (2 * Math.PI * ts.Fs * Mms * ts.Re) / (ts.Bl * ts.Bl);
  const Qts = (Qes * ts.Qms) / (Qes + ts.Qms);
  const Qtc = Qts * (Fc / ts.Fs);
  const out: SealedPoint[] = [];
  const count = logGridCount(N, fmin, fmax, fTop);
  for (let i = 0; i < count; i++) {
    const f = fmin * Math.pow(fmax / fmin, i / (N - 1));
    // Z = Ras + Rae + j(w Mas - 1/(w Cas) - 1/(w Cab)), in plain real arithmetic (the optimizers run this loop millions
    // of times); Uc = Pg / Z
    const w = 2 * Math.PI * f,
      zRe = Ras + Rae,
      zIm = w * Mas - 1 / (w * Cas) - 1 / (w * Cab),
      zM = zRe * zRe + zIm * zIm;
    const U = Pg / Math.sqrt(zM);
    const g =
      (hp ? linkwitzRileyHighpass(f, hp, hpOrder) : 1) *
      (lp ? linkwitzRileyLowpass(f, lp, lpOrder) : 1);
    const raw = 20 * Math.log10((rho * w * U) / (2 * Math.PI) / 2e-5);
    const pt: SealedPoint = {
      f,
      raw,
      spl: raw + 20 * Math.log10(g),
      xmm: Math.SQRT2 * (U / (w * Sd)) * g * 1000,
    };
    // the radiated pressure is jω × the cone's flow: in phase with jU
    if (phase) pt.rawPhase = Math.atan2((Pg * zRe) / zM, (Pg * zIm) / zM);
    out.push(pt);
  }
  if (phase) unwrapRawPhase(out);
  // Midband reference: the mass-controlled asymptote p = rho*V*Bl*Sd/(2*pi*Re*Mms) (half space, 1 m).
  // Averaging a band (the old 200-500 Hz) reads low when a well-damped box is still rising there.
  const ref = 20 * Math.log10((rho * volts * ts.Bl * Sd) / (2 * Math.PI * ts.Re * Mms) / 2e-5);
  const f3 = (out.find((o) => o.raw >= ref - 3) || out[out.length - 1]).f;
  return { curve: out, Fc, Qtc, f3, ref, peakX: Math.max(...out.map((o) => o.xmm)) };
}

// Internal liters with walls of thickness t and a 3/4″ baffle recessed `inset` into the frame.
export const boxInternalLiters = (w: number, h: number, d: number, t: number, inset = 0.75) =>
  ((w - 2 * t) * (h - 2 * t) * (d - inset - 0.75 - t) * 16.387) / 1000;
// Plywood weight, lb/ft², at the wall's exact thickness (lib/panel).
export const plywoodLbPerSqFt = (t: number) => panelLbPerSqFt(t, PLYWOOD_MATERIAL);

// ---------------------------------------------------------------
// Bracing by rule (lib/bracing): each panel's first plate resonance, and the window braces or ribs that lift every
// panel over PA_PANEL_TARGET_HZ. The cutlist, the volumes, the weights and the 3D view all read these.
// ---------------------------------------------------------------
/** The baffle's ply, in: 3/4″ whatever the walls. */
const BAFFLE_PLY_IN = 0.75;
/** A side duct's flared ends stand this much proud of its throat, in (a strip set at 20°, as the 3D view and the fit check draw it). */
const SIDE_DUCT_FLARE_IN = 0.43;
/** A side duct's width off its side wall, in: the throat, the wall, and the flare its ends stand out by. */
const sideDuctWidthIn = (v: Pick<VentSpec, "throat">, t: number) =>
  v.throat + t + SIDE_DUCT_FLARE_IN;
/**
 * A PA panel's stock for the plate model, from its exact thickness: the one place bracing reads the panel thickness and
 * its weight (lib/panel, plywood), with birch ply's moduli.
 */
export const paPanelStock = (t: number): PlateStock => ({
  t,
  lbPerSqFt: panelLbPerSqFt(t, PLYWOOD_MATERIAL),
  ...BIRCH_PLY_STIFFNESS,
});
/** A PA box's inside as boxParts cuts it: behind a 3/4″ baffle set `inset` back, `band` of a bottom slot under it. */
const paInside = (box: Dims3, t: number, inset: number, band = 0) => ({
  iw: box.w - 2 * t,
  ih: box.h - 2 * t,
  inD: box.d - inset - BAFFLE_PLY_IN - t,
  band,
});
/** A PA box's inside spans on the bracing's axes. */
export const paInner = (box: Dims3, t: number, inset: number): Record<BoxAxis, number> => {
  const { iw, ih, inD } = paInside(box, t, inset);
  return { x: iw, y: ih, z: inD };
};
/** The sub's vent as the bracing reads it: its sizes, and its divider and tubes where it has them. */
export type BraceVent = Pick<VentSpec, "slotH" | "len" | "throat" | "div" | "nt" | "dia">;
/**
 * Where the duct's length changes the sub's bracing: whether the duct runs far enough back to hold the panels it runs
 * along (ductHolds: then its parts' lines, subVentLines, are supports: a bottom slot's shelf across both sides and its
 * two fins along the bottom, a side duct's wall along the top and bottom and its dividers across its side), whether a
 * bottom slot folds up the back (and whether its rear channel wall rises far enough, DUCT_SUPPORT_MIN_SHARE of the
 * inside height, to hold the sides: `wallHolds`) and whether the tubes take elbows (subKeepOut).
 */
export interface DuctFlags {
  holds: boolean;
  folds: boolean;
  wallHolds: boolean;
  elbows: boolean;
}
/** The sub's duct's flags (DuctFlags) at its length in this box. */
export const ductFlagsOf = (
  box: Dims3,
  t: number,
  inset: number,
  style: PortStyle,
  v: BraceVent,
  drv: TubeDriver,
): DuctFlags => ({
  holds: ductHolds(box, t, inset, style, v),
  folds: style === "slots" && slotFolds(box, v, t),
  wallHolds:
    style === "slots" &&
    slotFolds(box, v, t) &&
    foldedRearWallIn(box, v, t) >= DUCT_SUPPORT_MIN_SHARE * paInside(box, t, inset).ih,
  elbows:
    isRoundPort(style) &&
    modelTubeElbows(box, style, { nt: v.nt, dia: v.dia, len: v.len }, t, drv) > 0,
});
/** Whether the sub's duct runs far enough back (DUCT_SUPPORT_MIN_SHARE of the depth) to hold the panels it runs along. */
const ductHolds = (
  box: Dims3,
  t: number,
  inset: number,
  style: PortStyle,
  v: Pick<VentSpec, "slotH" | "len">,
) => {
  const { inD } = paInside(box, t, inset);
  const len = style === "slots" && slotFolds(box, v, t) ? foldedShelfIn(box, v.slotH, t) : v.len;
  return len - inset - BAFFLE_PLY_IN >= DUCT_SUPPORT_MIN_SHARE * inD;
};
/**
 * The lines the sub's vent parts run along on its panels, however short the vent (subBoxBracing takes them as
 * supports only past DUCT_SUPPORT_MIN_SHARE, its duct flags' `holds`): a rib may always stop on them to clear the vent.
 */
export function subVentLines(
  box: Dims3,
  t: number,
  style: PortStyle,
  v: Pick<VentSpec, "slotH" | "throat" | "div">,
): PaBoxSupports {
  const { iw, ih } = paInside(box, t, 0);
  if (style === "slots") {
    const shelf = v.slotH + t / 2,
      fin = ((iw - 2 * t) / 3 + t) / 2; // the fins' centers either side of the middle (the 3D view's)
    return { sideL: [shelf], sideR: [shelf], top: [], bottom: [iw / 2 - fin, iw / 2 + fin] };
  }
  if (style === "vslots" || style === "vslot1") {
    // the dividers' centers, splitting the duct's open height in three (ventGeometry)
    const div = ductDividerIn(v),
      seg = (ih - 2 * div) / 3;
    const dividers = [seg + div / 2, 2 * seg + (3 * div) / 2],
      wall = v.throat + t / 2,
      both = style === "vslots"; // a single duct goes on the right side
    const across = [...(both ? [wall] : []), iw - wall];
    return { sideL: both ? dividers : [], sideR: dividers, top: across, bottom: across };
  }
  return NO_SUPPORTS;
}
/**
 * Where a rib may stop to clear the sub's vent: on its parts' lines (subVentLines), but clear of a side duct's flared
 * ends on the top and bottom (subKeepOut keeps the duct to them).
 */
export function subVentStops(
  box: Dims3,
  t: number,
  style: PortStyle,
  v: Pick<VentSpec, "slotH" | "throat" | "div">,
): PaBoxSupports {
  const lines = subVentLines(box, t, style, v);
  if (style !== "vslots" && style !== "vslot1") return lines;
  const { iw } = paInside(box, t, 0);
  const w = sideDuctWidthIn(v, t) - t / 2;
  const across = [...(style === "vslots" ? [w] : []), iw - w];
  return { ...lines, top: across, bottom: across };
}
/**
 * A driver's room behind the baffle, which no brace or rib may enter, as boxes round its axis: the cutout's square at
 * the baffle (the basket comes through it), stepping in along the basket to the motor's (DRIVER_MOTOR_DIA_IN) and back
 * to the back of the magnet (lib/pa/bracing's shares), each with DRIVER_CLEARANCE_IN to spare. `depthIn` is the
 * mounting depth from the baffle's front.
 */
export function driverKeepOut(
  center: { x: number; y: number },
  size: SubDriver["size"] | MidDriver["size"],
  depthIn: number,
): BoxRegion[] {
  const c = DRIVER_CLEARANCE_IN;
  const depth = Math.max(0, depthIn - BAFFLE_PLY_IN),
    rCut = DRIVER_CUTOUT_IN[size] / 2,
    rMotor = Math.min(rCut, DRIVER_MOTOR_DIA_IN[size] / 2);
  const zRing = BASKET_RING_SHARE * depth,
    zMotor = MOTOR_START_SHARE * depth;
  const box = (r: number, z0: number, z1: number): BoxRegion => ({
    x: [center.x - r - c, center.x + r + c],
    y: [center.y - r - c, center.y + r + c],
    z: [z0, z1],
  });
  const step = (zMotor - zRing) / BASKET_TAPER_STEPS;
  return [
    box(rCut, 0, zRing),
    ...Array.from({ length: BASKET_TAPER_STEPS }, (_, i) =>
      box(
        rCut - ((rCut - rMotor) * i) / BASKET_TAPER_STEPS,
        zRing + i * step,
        zRing + (i + 1) * step,
      ),
    ),
    box(rMotor, zMotor, depth + c),
  ];
}
/** Where the sub driver's center sits on the inside of the baffle, in from the box's inside corner (the 3D view's). */
export function subDriverCenter(
  box: Dims3,
  t: number,
  style: PortStyle,
  v: Pick<VentSpec, "slotH" | "throat">,
  size: SubDriver["size"],
) {
  const { iw, ih } = paInside(box, t, 0);
  if (isRoundPort(style)) {
    const d = tubeDriverOnBaffle(box, style, t, size);
    return { x: iw / 2 + d.x, y: d.y };
  }
  if (style === "vslots") return { x: iw / 2, y: ih / 2 };
  // a single side duct (on the right) pushes the driver into the middle of the baffle left
  if (style === "vslot1") return { x: iw / 2 - (v.throat + SIDE_DUCT_FLARE_IN + t) / 2, y: ih / 2 };
  const band = v.slotH + t;
  return { x: iw / 2, y: band + (ih - band) / 2 };
}
/** The clear floor behind a bottom slot's inner end, in slot heights: room for the air to leave the duct. */
const SLOT_CLEAR_HEIGHTS = 2;
/**
 * How far back a bottom slot's room runs, in from the baffle: the duct and SLOT_CLEAR_HEIGHTS slot heights more, up to
 * the next whole inch (so duct lengths a hair apart share their bracing), or the whole depth when it folds.
 */
const slotRoomIn = (
  inD: number,
  inset: number,
  v: Pick<VentSpec, "len" | "slotH">,
  folds: boolean,
) =>
  folds
    ? inD
    : Math.min(
        inD,
        Math.ceil(Math.max(0, v.len - inset - BAFFLE_PLY_IN) + SLOT_CLEAR_HEIGHTS * v.slotH),
      );
/**
 * What no brace or rib in the sub may enter: its driver (driverKeepOut), and its vent's parts and the air they hold: a
 * bottom slot under its shelf as far back as the duct runs and two slot heights more (room for the air at its inner end;
 * folded, the whole floor and the rear channel up the back to the lid as well), a side duct between its wall and the
 * side (its flared ends a flare wider) and each round tube's run along the floor (up to the lid where it takes
 * elbows), these two over the whole depth. The optimizers' searches don't run the rule (braceWoodEstimate), so the
 * slot's room may follow its length; the planner's volume moves with the ribs it lets in behind a short slot.
 */
export function subKeepOut(
  box: Dims3,
  t: number,
  inset: number,
  style: PortStyle,
  v: BraceVent,
  drv: TubeDriver,
  /** whether the slot folds and the tubes take elbows; absent: at the vent's length in this box */
  bends: Pick<DuctFlags, "folds" | "elbows"> = ductFlagsOf(box, t, inset, style, v, drv),
  /** a bottom slot's room over the whole floor, whatever its length (the hardware's placement keeps to that) */
  wholeFloor = false,
): BoxKeepOut {
  const { iw, ih, inD } = paInside(box, t, inset);
  const driver = driverKeepOut(
    subDriverCenter(box, t, style, v, drv.size),
    drv.size,
    subDriverDepthIn(drv),
  );
  const vent: BoxRegion[] = [];
  const z: readonly [number, number] = [0, inD];
  if (style === "slots") {
    const band = v.slotH + t;
    const slotEnd = wholeFloor ? inD : slotRoomIn(inD, inset, v, bends.folds);
    vent.push({ x: [0, iw], y: [0, band], z: [0, slotEnd] });
    if (bends.folds) vent.push({ x: [0, iw], y: [0, ih], z: [inD - band, inD] });
  } else if (style === "vslots" || style === "vslot1") {
    // the duct to its flared ends' outer face
    const w = sideDuctWidthIn(v, t);
    if (style === "vslots") vent.push({ x: [0, w], y: [0, ih], z });
    vent.push({ x: [iw - w, iw], y: [0, ih], z });
  } else if (isRoundPort(style)) {
    const { elbows } = bends;
    const rr = v.dia / 2 + TUBE_FLARE_RADIUS_IN;
    for (const p of tubeLayout(box, style, v, t, drv.size).tubes)
      vent.push({
        x: [iw / 2 + p.x - rr, iw / 2 + p.x + rr],
        y: [p.y - rr, elbows ? ih : p.y + rr],
        z,
      });
  }
  return { driver, vent };
}
/** What no brace or rib in the mid box may enter: its driver, in the middle of the baffle. */
export function midKeepOut(
  box: Dims3,
  t: number,
  mid: Pick<MidDriver, "size" | "depthIn">,
): BoxKeepOut {
  const { iw, ih } = paInside(box, t, 0);
  return {
    driver: driverKeepOut(
      { x: iw / 2, y: ih / 2 },
      mid.size,
      mid.depthIn ?? MID_DEPTH_FALLBACK_IN[mid.size],
    ),
    vent: [],
  };
}
// boxes repeat thousands of times in the optimizers' searches: the rule runs once per box and its surroundings (the
// supports, the stops and the keep-out, which the duct lengths a hair apart share), and once per exact set of inputs
const BRACING_MEMO = new Map<string, BoxBracing>();
const INPUT_MEMO = new Map<string, BoxBracing>();
const BRACING_MEMO_MAX = 20000;
const linesKey = (s: PaBoxSupports) =>
  `${s.sideL.join()};${s.sideR.join()};${s.top.join()};${s.bottom.join()};${s.sideZ?.join() ?? ""};${s.bottomZ?.join() ?? ""}`;
/**
 * A folded slot's rear channel wall as a line on both sides, back from the baffle (inside): the channel's front wall,
 * a slot height and a wall in from the back, `t` thick, glued between the sides. Where it rises DUCT_SUPPORT_MIN_SHARE
 * of the inside height (DuctFlags `wallHolds`) it holds both sides there and a side rib may stop on it.
 */
function foldWallLine(box: Dims3, t: number, inset: number, v: Pick<VentSpec, "slotH">) {
  const { inD } = paInside(box, t, inset);
  return inD - (v.slotH + t) + t / 2;
}
const remember = (memo: Map<string, BoxBracing>, key: string, b: BoxBracing) => {
  if (memo.size >= BRACING_MEMO_MAX) memo.clear();
  memo.set(key, b);
  return b;
};
/** A driver's cutout on the baffle: its center (in from the box's inside corner) less a slot's band below it. */
const baffleCutout = (
  center: { x: number; y: number },
  band: number,
  size: SubDriver["size"] | MidDriver["size"],
): PlateHole => ({ cx: center.x, cy: center.y - band, r: DRIVER_CUTOUT_IN[size] / 2 });
function paBracing(
  box: Dims3,
  t: number,
  inset: number,
  band: number,
  sup: PaBoxSupports,
  stops: PaBoxSupports,
  keepOut: BoxKeepOut,
  /** what sets the keep-out besides the box and the plywood (the caller's inputs to it and its spans) */
  keepKey: string,
  style: BraceStyleId,
  back: BackJointId,
  /** the driver's cutout on the baffle, in from the baffle's corner */
  hole: PlateHole,
): BoxBracing {
  const key = `${style}|${back}|${box.w}|${box.h}|${box.d}|${t}|${inset}|${band}|${linesKey(sup)}|${linesKey(stops)}|${keepKey}|${hole.cx},${hole.cy},${hole.r}`;
  const hit = BRACING_MEMO.get(key);
  if (hit) return hit;
  const inside = paInside(box, t, inset, band);
  const wall = paPanelStock(t);
  return remember(
    BRACING_MEMO,
    key,
    braceBox({
      inner: { x: inside.iw, y: inside.ih, z: inside.inD },
      panels: paBoxPanels(inside, wall, paPanelStock(BAFFLE_PLY_IN), sup, stops, back, hole),
      targetHz: PA_PANEL_TARGET_HZ,
      style,
      braceStock: wall,
      keepOut,
    }),
  );
}
/** The hardware's recesses as a keep-out key (the bracing memo's). */
const regionsKey = (rs: readonly BoxRegion[]) =>
  rs.map((r) => `${r.x.join()},${r.y.join()},${r.z.join()}`).join(";");
/**
 * The sub box's braces and ribs by rule, and its panels' resonances: its vent's parts as supports, and its driver and
 * vent kept clear (subKeepOut), and with `handles` (the planner's: the box has its hardware) the recesses of its handles
 * and input dish as well, placed first (subHardwarePlacement). The planner's and the cards' (the optimizers leave the
 * hardware out, and their searches estimate the bracing: braceWoodEstimate).
 */
export function subBoxBracing(
  box: Dims3,
  t: number,
  inset: number,
  style: PortStyle,
  v: BraceVent,
  drv: TubeDriver & Partial<Pick<SubDriver, "lb">>,
  braceStyle: BraceStyleId | undefined,
  handles?: BoxHandles,
  back: BackJointId = DEFAULT_BACK_JOINT,
): BoxBracing {
  const bs = braceStyle ?? defaultBraceStyleNear(t);
  // the duct's length counts only where it changes the bracing (its flags)
  const flags = ductFlagsOf(box, t, inset, style, v, drv);
  const recesses = handles
    ? hardwareKeepOut(subHardwarePlacement(box, t, inset, style, v, drv, handles))
    : [];
  const hwKey = regionsKey(recesses);
  const key = `${bs}|${back}|${box.w}|${box.h}|${box.d}|${t}|${inset}|${style}|${style === "slots" ? slotRoomIn(paInside(box, t, inset).inD, inset, v, flags.folds) : ""}|${v.slotH}|${flags.holds}|${flags.folds}|${flags.wallHolds}|${flags.elbows}|${v.throat}|${v.div}|${v.nt}|${v.dia}|${drv.size}|${drv.depthIn}|${hwKey}`;
  const hit = INPUT_MEMO.get(key);
  if (hit) return hit;
  const keepOut = { ...subKeepOut(box, t, inset, style, v, drv, flags), hardware: recesses };
  // the keep-out from its inputs other than the length, and the spans the length sets
  const keepKey = `${style}|${v.slotH}|${v.throat}|${v.div}|${v.nt}|${v.dia}|${drv.size}|${drv.depthIn}|${keepOut.vent.map((r) => `${r.y.join()},${r.z.join()}`).join(";")}|${hwKey}`;
  return remember(
    INPUT_MEMO,
    key,
    paBracing(
      box,
      t,
      inset,
      style === "slots" ? v.slotH + t : 0,
      {
        ...(flags.holds ? subVentLines(box, t, style, v) : NO_SUPPORTS),
        // a folded slot's rear channel wall holds both sides where it rises far enough
        sideZ: flags.wallHolds ? [foldWallLine(box, t, inset, v)] : [],
      },
      // and a side rib running back may stop on it there; on a lower wall it would end in the air over the channel; a
      // floor rib behind a short slot starts where its clear floor ends
      {
        ...subVentStops(box, t, style, v),
        sideZ: flags.wallHolds ? [foldWallLine(box, t, inset, v)] : [],
        bottomZ:
          style === "slots" && !flags.folds
            ? [slotRoomIn(paInside(box, t, inset).inD, inset, v, false)]
            : [],
      },
      keepOut,
      keepKey,
      bs,
      back,
      baffleCutout(
        subDriverCenter(box, t, style, v, drv.size),
        style === "slots" ? v.slotH + t : 0,
        drv.size,
      ),
    ),
  );
}
/**
 * The mid box's braces and ribs by rule, its driver kept clear (midKeepOut), and with `handles` its hardware's recesses
 * as well (midHardwarePlacement); null in the tower, whose mid chamber is part of the sub's cabinet.
 */
export function midBoxBracing(
  box: Dims3,
  t: number,
  inset: number,
  mid: Pick<MidDriver, "size" | "depthIn"> & Partial<Pick<MidDriver, "lb">>,
  layout: PaLayout | undefined,
  braceStyle: BraceStyleId | undefined,
  handles?: BoxHandles,
  back: BackJointId = DEFAULT_BACK_JOINT,
): BoxBracing | null {
  if (layout === "tower") return null;
  const placed = handles && midHardwarePlacement(box, t, inset, mid, layout, handles);
  const recesses = placed ? hardwareKeepOut(placed) : [];
  const { iw, ih } = paInside(box, t, 0);
  return paBracing(
    box,
    t,
    inset,
    0,
    NO_SUPPORTS,
    NO_SUPPORTS,
    { ...midKeepOut(box, t, mid), hardware: recesses },
    `${mid.size}|${mid.depthIn}|${regionsKey(recesses)}`,
    braceStyle ?? defaultBraceStyleNear(t),
    back,
    baffleCutout({ x: iw / 2, y: ih / 2 }, 0, mid.size),
  );
}
/**
 * The optimizers' cursory estimate of a PA box's braces' and ribs' wood (their searches run no rule): a window brace's
 * frame (windowWoodIn3) for each BRACE_ESTIMATE span of each inside span past the first, scaled, as window brace wood.
 * Fitted to the rule over the golden boxes in ¾″ ply, the optimizers' plywood (tests/bracing.test.ts holds its error).
 */
export function braceWoodEstimate(
  box: Dims3,
  t: number,
  inset: number,
  style: BraceStyleId,
): Pick<BoxBracing, "windowIn3" | "ribIn3"> {
  const inner = paInner(box, t, inset),
    { span, scale } = BRACE_ESTIMATE[style];
  const frames = (ax: BoxAxis) => Math.max(0, inner[ax] / span - 1) * windowWoodIn3(inner, ax, t);
  return { windowIn3: scale * (frames("x") + frames("y") + frames("z")), ribIn3: 0 };
}
/** braceWoodEstimate for the mid box: none in the tower (midBoxBracing). */
export const midBraceEstimate = (
  box: Dims3,
  t: number,
  inset: number,
  layout: PaLayout | undefined,
  style: BraceStyleId,
) => (layout === "tower" ? null : braceWoodEstimate(box, t, inset, style));
/** A box's braces' and ribs' wood, in³. */
export const braceWoodIn3 = (b: Pick<BoxBracing, "windowIn3" | "ribIn3"> | null | undefined) =>
  b ? b.windowIn3 + b.ribIn3 : 0;
/** Their weight at the wall ply, lb. */
const braceLb = (b: Pick<BoxBracing, "windowIn3" | "ribIn3"> | null | undefined, wall: number) =>
  (braceWoodIn3(b) * plywoodLbPerSqFt(wall)) / 144 / wall;

// ---------------------------------------------------------------
// Cutlist: panels for the sub and mid boxes from the planner's current
// dimensions (cutlist.ts lays them out on 4x8 or 5x5 sheets).
// ---------------------------------------------------------------
export { DRIVER_CUTOUT_IN };
export { PLYWOOD_SHEETS } from "../../data/catalog/plywood";
export const formatInches = (x: number) => {
  // inches to the nearest 1/16, as 12 5/8
  const n = Math.round(x * 16),
    whole = Math.floor(n / 16),
    r = n % 16;
  if (!r) return `${whole}`;
  let a = r,
    b = 16;
  while (a % 2 === 0) {
    a /= 2;
    b /= 2;
  }
  return whole ? `${whole} ${a}/${b}` : `${a}/${b}`;
};
export { formatThickness } from "../panel";

export function boxParts(
  label: CutBoxId,
  W: number,
  H: number,
  D: number,
  t: number,
  inset: number,
  joint: CornerJoint,
  extra: {
    band?: number;
    cutNote?: string;
    bracing?: BoxBracing | null;
    /** the hardware's cutout notes, by panel (hardwareCutNotes) */
    hardware?: HardwareCutNotes;
  } = {},
) {
  const BT = 0.75,
    P: CutPart[] = [];
  const topW = joint === "butt" ? W - 2 * t : joint === "rabbet" ? W - t : W;
  const rearNote = `rabbet ${formatInches(t)} × ${formatInches(t / 2)} on rear edge for the back`;
  const sideNote =
    joint === "rabbet"
      ? `rabbet ${formatInches(t)} × ${formatInches(t / 2)} top and bottom edges; ${rearNote}`
      : joint === "miter"
        ? `45° on top and bottom edges; ${rearNote}`
        : rearNote;
  const topNote = joint === "miter" ? `45° on both ends; ${rearNote}` : rearNote;
  const hw = extra.hardware ?? {};
  const withNote = (note: string, more: string | undefined) => (more ? `${note}; ${more}` : note);
  P.push({ box: label, part: "side", qty: 2, a: D, b: H, t, note: withNote(sideNote, hw.side) });
  P.push({
    box: label,
    part: "topBottom",
    qty: 2,
    a: D,
    b: topW,
    t,
    note: withNote(topNote, hw.top),
  });
  P.push({
    box: label,
    part: "back",
    qty: 1,
    a: W - t,
    b: H - t,
    t,
    note: withNote("sits in the rear rabbet", hw.back),
  });
  const iw = W - 2 * t,
    ih = H - 2 * t,
    band = extra.band || 0;
  P.push({
    box: label,
    part: "baffle",
    qty: 1,
    a: iw,
    b: ih - band,
    t: BT,
    note: `set ${formatInches(inset)}″ back on cleats; ${extra.cutNote || ""}`.replace(/; $/, ""),
  });
  P.push({
    box: label,
    part: "baffleCleat",
    qty: 2,
    a: 0.75,
    b: iw,
    t: BT,
    note: "glue and screw behind the baffle",
  });
  P.push({
    box: label,
    part: "baffleCleat",
    qty: 2,
    a: 0.75,
    b: ih - band - 1.5,
    t: BT,
    note: "",
  });
  const inD = D - inset - BT - t;
  if (extra.bracing) P.push(...braceParts(label, extra.bracing, { x: iw, y: ih, z: inD }, t));
  return { P, iw, ih, inD };
}

// where a window brace across each axis lies, and where positions along each axis are measured from
const WINDOW_PLANE: Record<BoxAxis, string> = {
  x: "upright, front to back",
  y: "level",
  z: "upright, parallel to the baffle",
};
const AXIS_FROM: Record<BoxAxis, string> = {
  x: "from the left side",
  y: "up from the bottom",
  z: "back from the baffle",
};
const atList = (at: number[]) => at.map((x) => `${formatInches(x)}″`).join(", ");
/** A box's window braces and ribs as cutlist rows: each axis' window braces, then each panel's ribs. */
export function braceParts(
  box: CutBoxId,
  b: BoxBracing,
  inner: Record<BoxAxis, number>,
  t: number,
): CutPart[] {
  const out: CutPart[] = [];
  const rails = `cut out the center, leave ${formatInches(WINDOW_RAIL_IN)}″ rails`;
  for (const axis of ["y", "x", "z"] as const) {
    // across x, the braces that cross the driver open their frame to the baffle round it
    const open = axis === "x" && b.notch ? b.notch.at : [];
    const closed = b.windows[axis].filter((x) => !open.includes(x));
    const [pa, pb] = BOX_AXES.filter((o) => o !== axis).map((o) => inner[o]);
    const row = (at: number[], note: string) => {
      if (at.length) out.push({ box, part: "windowBrace", qty: at.length, a: pa, b: pb, t, note });
    };
    row(closed, `${WINDOW_PLANE[axis]}, ${atList(closed)} ${AXIS_FROM[axis]}; ${rails}`);
    if (b.notch)
      row(
        open,
        `${WINDOW_PLANE[axis]}, ${atList(open)} ${AXIS_FROM[axis]}; ${rails}, and leave the front rail out from ${formatInches(b.notch.y[0])}″ to ${formatInches(b.notch.y[1])}″ ${AXIS_FROM.y}, clear of the driver`,
      );
  }
  for (const r of b.ribs) {
    const run = ribRunAxis(r.panel, r.across);
    // a rib crosses the window braces across the axis it runs along, where they stand within its length (Ribs has none)
    const lap = b.windows[run].some((w) => w > r.from + 1e-6 && w < r.from + r.len - 1e-6)
      ? RIB_HALF_LAP_NOTE
      : "";
    const from = r.from > 1e-6 ? `, starting ${formatInches(r.from)}″ ${AXIS_FROM[run]}` : "";
    out.push({
      box,
      part: "rib",
      qty: r.at.length,
      a: r.depth,
      b: r.len,
      t,
      note: `${BRACE_PANEL_NAMES[r.panel]}, on edge, running ${BOX_AXIS_NAMES[run]}, ${atList(r.at)} ${AXIS_FROM[r.across]}${from}${lap}`,
    });
  }
  return out;
}

/** A baffle row's cutout note: the cutout is a typical size, and the driver's datasheet has the real one. */
export const cutoutNote = (inches: number) =>
  `${formatInches(inches)}″ driver cutout (typical; use the datasheet's)`;

/** A box's hardware cutout notes, by the cutlist row they go on: the sides (both), the top, the back. */
export type HardwareCutNotes = Partial<Record<"side" | "top" | "back", string>>;
/**
 * A part's cutout note, as cutoutNote words a driver's: its size as mounted (across the panel by up it, or front to back
 * on the lid), the part, and where it goes (`where`).
 */
export const hardwareCutoutNote = (
  part: Pick<BoxHardwarePlan["parts"][number], "part" | "kind" | "panel">,
  where: string,
) => {
  const c = mountedCutout(part.part) ?? { across: 0, up: 0 };
  const up = part.panel === "top" ? "front to back" : "high";
  return `${formatInches(c.across)}″ wide × ${formatInches(c.up)}″ ${up} cutout for the ${part.part.name} ${HARDWARE_KIND_NAMES[part.kind]}, ${where}`;
};
/**
 * Where a placed part's cutout center sits, from named edges of its panel (hardwarePlaceWords): the handles on both
 * sides from the front and bottom edges, the dish on the back from its bottom edge (which sits in the rabbet, t/2 up),
 * the horn's posts on the top from its rear edge. The cutlist and Details both say it this way.
 */
export function hardwarePlace(
  p: Pick<BoxHardwarePlan["parts"][number], "kind" | "u" | "v">,
  box: Pick<Dims3, "d">,
  t: number,
) {
  const at = (x: number) => formatInches(x);
  if (p.kind === "handle")
    return hardwarePlaceWords("handle", [
      [at(p.u), "front"],
      [at(p.v), "bottom"],
    ]);
  if (p.kind === "plate") return hardwarePlaceWords("plate", [[at(p.v - t / 2), "bottom"]]);
  return hardwarePlaceWords("posts", [[at(box.d - p.v), "rear"]]);
}
/**
 * A box's hardware as cutout notes on its panels (hardwarePlace): the handles on both sides, the dish on the back with
 * its jacks, the horn's posts on the top only.
 */
export function hardwareCutNotes(plan: BoxHardwarePlan, box: Dims3, t: number): HardwareCutNotes {
  const out: HardwareCutNotes = {};
  for (const p of plan.parts) {
    const note = hardwareCutoutNote(p, hardwarePlace(p, box, t));
    if (p.kind === "handle" && p.panel === "sideL") out.side = note;
    else if (p.kind === "plate") out.back = `${note}; 2 × ${INPUT_JACK.name} in it (in, link)`;
    else if (p.kind === "posts") out.top = note;
  }
  return out;
}

/**
 * The sub's vent panels as weights for its center of gravity (lib/pa/hardware boxCenterOfGravity), each at its middle
 * (`y` up from the box's bottom, `z` back from its front), cut and placed as the cutlist and the 3D view take them: a
 * bottom slot's shelf and two fins from the front, and a folded slot's rear channel wall; a side duct's wall and its two
 * dividers from the front, at the design's divider thickness. Round tubes count none.
 */
export function subVentMasses(box: Dims3, t: number, style: PortStyle, v: BraceVent): CogMass[] {
  const { iw, ih } = paInside(box, t, 0);
  const ply = (a: number, b: number, th: number) => (a * b * plywoodLbPerSqFt(th)) / 144;
  if (style === "slots") {
    const folded = slotFolds(box, v, t);
    const len = folded
      ? foldedShelfIn(box, v.slotH, t)
      : Math.min(v.len, maxStraightSlotIn(box, v.slotH, t));
    const out: CogMass[] = [
      { lb: ply(iw, len, t), y: t + v.slotH + t / 2, z: len / 2 },
      { lb: 2 * ply(v.slotH, len, t), y: t + v.slotH / 2, z: len / 2 },
    ];
    if (folded) {
      const wallH = foldedRearWallIn(box, v, t);
      out.push({
        lb: ply(iw, wallH, t),
        y: t + v.slotH + wallH / 2,
        z: box.d - t - v.slotH - t / 2,
      });
    }
    return out;
  }
  if (style === "vslots" || style === "vslot1") {
    const n = style === "vslot1" ? 1 : 2;
    // the duct runs back from the mouth, leaving at least a throat's gap to the back panel
    const len = Math.min(v.len, box.d - t - v.throat);
    return [
      { lb: n * ply(ih, len, t), y: box.h / 2, z: len / 2 },
      { lb: 2 * n * ply(v.throat, len, ductDividerIn(v)), y: box.h / 2, z: len / 2 },
    ];
  }
  return [];
}

/**
 * The sub box's hardware from its presets (lib/pa/hardware planBoxHardware), placed before the braces: its driver where
 * the 3D view puts it, its keep-out, and its vent's panels in the center of gravity. `bracing` (absent: none) only
 * checks the parts; it doesn't move them.
 */
function subHardwarePlacement(
  box: Dims3,
  t: number,
  inset: number,
  style: PortStyle,
  v: BraceVent,
  drv: TubeDriver & Partial<Pick<SubDriver, "lb">>,
  handles: BoxHandles,
  bracing: BoxBracing | null = null,
): BoxHardwarePlan {
  return planBoxHardware({
    box: "sub",
    dims: box,
    t,
    inset,
    handles,
    driver: {
      center: subDriverCenter(box, t, style, v, drv.size),
      lb: drv.lb || 0,
      depthIn: subDriverDepthIn(drv),
    },
    bracing,
    keepOut: subKeepOut(box, t, inset, style, v, drv, undefined, true),
    ventMasses: subVentMasses(box, t, style, v),
  });
}
/**
 * The sub box's hardware (subHardwarePlacement), checked against its braces and ribs by rule, which were planned round
 * its recesses (subBoxBracing with the handles).
 */
export function subHardwarePlan(
  box: Dims3,
  t: number,
  inset: number,
  style: PortStyle,
  v: BraceVent,
  drv: TubeDriver & Pick<SubDriver, "lb">,
  braceStyle: BraceStyleId | undefined,
  handles: BoxHandles,
  back: BackJointId = DEFAULT_BACK_JOINT,
): BoxHardwarePlan {
  const bracing = subBoxBracing(box, t, inset, style, v, drv, braceStyle, handles, back);
  return subHardwarePlacement(box, t, inset, style, v, drv, handles, bracing);
}
/** The mid box's hardware placed before its braces (as subHardwarePlacement); null in the tower. */
function midHardwarePlacement(
  box: Dims3,
  t: number,
  inset: number,
  mid: Pick<MidDriver, "size" | "depthIn"> & Partial<Pick<MidDriver, "lb">>,
  layout: PaLayout | undefined,
  handles: BoxHandles,
  bracing: BoxBracing | null = null,
): BoxHardwarePlan | null {
  if (layout === "tower") return null;
  const { iw, ih } = paInside(box, t, 0);
  return planBoxHardware({
    box: "mid",
    dims: box,
    t,
    inset,
    handles,
    driver: {
      center: { x: iw / 2, y: ih / 2 },
      lb: mid.lb || 0,
      depthIn: mid.depthIn ?? MID_DEPTH_FALLBACK_IN[mid.size],
    },
    bracing,
    keepOut: midKeepOut(box, t, mid),
  });
}
/**
 * The mid box's hardware from its presets, checked against its braces and ribs (planned around its recesses); null in
 * the tower, whose mid chamber is part of the sub's cabinet.
 */
export function midHardwarePlan(
  box: Dims3,
  t: number,
  inset: number,
  mid: Pick<MidDriver, "size" | "depthIn" | "lb">,
  layout: PaLayout | undefined,
  braceStyle: BraceStyleId | undefined,
  handles: BoxHandles,
  back: BackJointId = DEFAULT_BACK_JOINT,
): BoxHardwarePlan | null {
  const bracing = midBoxBracing(box, t, inset, mid, layout, braceStyle, handles, back);
  return midHardwarePlacement(box, t, inset, mid, layout, handles, bracing);
}

export function cutParts({
  sub,
  mid,
  subBox,
  midDims,
  wall,
  inset,
  joint,
  portStyle,
  cVent,
  layout,
  braceStyle,
  backJoint,
  subOnly,
  noBraces,
  hardware,
}: CutPartsConfig): { parts: CutPart[]; vent: string[] } {
  const t = wall,
    all: CutPart[] = [];
  const vent: string[] = [];
  // round tubes: the stock pipe, its holes in the baffle and the elbows each takes (lib/pa/tubes)
  const kit = isRoundPort(portStyle) ? subTubeKit(subBox, portStyle, cVent, t, sub) : null;
  const s = boxParts("sub", subBox.w, subBox.h, subBox.d, t, inset, joint, {
    bracing: noBraces
      ? null
      : subBoxBracing(
          subBox,
          t,
          inset,
          portStyle,
          cVent,
          sub,
          braceStyle,
          hardware?.sub,
          backJoint,
        ),
    hardware: hardware
      ? hardwareCutNotes(
          subHardwarePlan(
            subBox,
            t,
            inset,
            portStyle,
            cVent,
            sub,
            braceStyle,
            hardware.sub,
            backJoint,
          ),
          subBox,
          t,
        )
      : undefined,
    band: portStyle === "slots" ? cVent.slotH + t : 0,
    cutNote:
      cutoutNote(DRIVER_CUTOUT_IN[sub.size]) +
      (kit
        ? `; ${cVent.nt} × ${formatInches(kit.pipe?.odIn ?? cVent.dia)}″ tube holes, rounded over ${formatInches(TUBE_FLARE_RADIUS_IN)}″`
        : ""),
  });
  all.push(...s.P);
  if (portStyle === "slots") {
    const folded = slotFolds(subBox, cVent, t);
    const len = folded ? foldedShelfIn(subBox, cVent.slotH, t) : cVent.len;
    all.push({
      box: "sub",
      part: "ductShelf",
      qty: 1,
      a: s.iw,
      b: len,
      t,
      note: "roof of the bottom slot",
    });
    all.push({
      box: "sub",
      part: "ductFin",
      qty: 2,
      a: cVent.slotH,
      b: len,
      t,
      note: "splits the slot in three",
    });
    if (folded)
      all.push({
        box: "sub",
        part: "ductRearWall",
        qty: 1,
        a: s.iw,
        b: foldedRearWallIn(subBox, cVent, t),
        t,
        note: "rear channel, rises up the back",
      });
  } else if (portStyle === "vslots" || portStyle === "vslot1") {
    const n = portStyle === "vslot1" ? 1 : 2;
    all.push({
      box: "sub",
      part: "sideDuctWall",
      qty: n,
      a: s.ih,
      b: cVent.len,
      t,
      note: `${formatInches(cVent.throat)}″ throat; 20° chamfer both ends`,
    });
    all.push({
      box: "sub",
      part: "ductDivider",
      qty: 2 * n,
      a: cVent.throat,
      b: cVent.len,
      t: ductDividerIn(cVent),
      note: "",
    });
  } else if (kit) {
    vent.push(
      `${cVent.nt} × ${formatInches(cVent.dia)}″ port tube, ${formatInches(cVent.len)}″ long on its centerline` +
        (kit.elbows
          ? ` with ${ELBOW_WORDS[kit.elbows]} (${cVent.nt * kit.elbows} × 90° elbow)`
          : "") +
        (kit.pipe
          ? `, cut from ${kit.sticks} × ${kit.pipe.stickFt} ft Sch 40 PVC; flare each inner mouth ${formatInches(TUBE_FLARE_RADIUS_IN)}″`
          : `; no stock pipe in the catalog for ${formatInches(cVent.dia)}″`),
    );
  }
  if (layout !== "tower" && !subOnly) {
    const midPlan =
      hardware &&
      midHardwarePlan(midDims, t, inset, mid, layout, braceStyle, hardware.mid, backJoint);
    const m = boxParts("mid", midDims.w, midDims.h, midDims.d, t, inset, joint, {
      bracing: midBoxBracing(midDims, t, inset, mid, layout, braceStyle, hardware?.mid, backJoint),
      hardware: midPlan ? hardwareCutNotes(midPlan, midDims, t) : undefined,
      cutNote: cutoutNote(DRIVER_CUTOUT_IN[mid.size]),
    });
    all.push(...m.P);
  }
  return { parts: all, vent };
}

// ---- end correction of a rectangular opening ----
// Low-frequency radiation mass of a uniform rectangular piston a x b in an infinite baffle is
// rho*I/(2*pi*S^2), I = the double area integral of 1/distance (closed form below). As a length:
// end correction = I/(2*pi*a*b). A circle gives the familiar 0.85 r.
export function rectangleEndCorrectionIntegral(a: number, b: number) {
  const d = Math.hypot(a, b);
  return (
    (2 / 3) * (a ** 3 + b ** 3 - d ** 3) +
    2 * a * b * (a * Math.log((b + d) / a) + b * Math.log((a + d) / b))
  );
}
export const rectangleEndCorrection = (a: number, b: number) =>
  rectangleEndCorrectionIntegral(a, b) / (2 * Math.PI * a * b);
// Flanged + free end, as the 1.46 r (0.85 r + 0.61 r) used for round tubes.
export const BOTH_ENDS_CORRECTION_RATIO = 1 + 0.61 / 0.85;
// Where `x` falls on an ascending axis: the cell's lower index and the fraction across it, clamped to the axis' ends.
function axisCell(axis: readonly number[], x: number) {
  const last = axis.length - 1;
  if (!(x > axis[0])) return { i: 0, f: 0 };
  if (x >= axis[last]) return { i: last - 1, f: 1 };
  let i = 0;
  while (axis[i + 1] < x) i++;
  return { i, f: (x - axis[i]) / (axis[i + 1] - axis[i]) };
}
// the run axis doubles at each step, so it is read on a log scale
const RUN_LOG2 = SLOT_INNER_END.run.map(Math.log2);
/**
 * The inner end correction (in) of a slot `h` high that runs along a wall and opens into the box: the shelf forming it
 * `t` thick with the box open beyond it, running `run` from the box's front to the mouth, a facing wall `gap` from the
 * mouth, the box spanning `span` across the mouth (SLOT_INNER_END, interpolated in its axes; outside them, its nearest
 * edge).
 */
export function slotMouthCorrection(h: number, span: number, gap: number, t: number, run: number) {
  const T = SLOT_INNER_END;
  const a = axisCell(T.gap, gap > 0 ? h / gap : Infinity),
    b = axisCell(T.span, h / span),
    c = axisCell(T.wall, t / h),
    d = axisCell(RUN_LOG2, run > 0 ? Math.log2(run / h) : -Infinity);
  let v = 0;
  for (let da = 0; da < 2; da++)
    for (let db = 0; db < 2; db++)
      for (let dc = 0; dc < 2; dc++)
        for (let dd = 0; dd < 2; dd++) {
          const k =
            (da ? a.f : 1 - a.f) *
            (db ? b.f : 1 - b.f) *
            (dc ? c.f : 1 - c.f) *
            (dd ? d.f : 1 - d.f);
          if (k) v += k * T.ecOverH[a.i + da][b.i + db][c.i + dc][d.i + dd];
        }
  return v * h;
}
/**
 * The most slotMouthCorrection can be for a mouth `h` high across `span`, its shelf `t` thick, whatever the gap and the
 * run (in): at the nearest gap (the table rises toward the facing wall), at the run there that gives the most (a short
 * run's narrow room behind the mouth can give more than a long one's). A bound for a search that hasn't cut the duct.
 */
export function slotMouthCorrectionMost(h: number, span: number, t: number) {
  let most = 0;
  for (const r of SLOT_INNER_END.run)
    most = Math.max(most, slotMouthCorrection(h, span, 0, t, r * h));
  return most;
}
/**
 * A side duct's dividers' thickness, in: two per duct, bracing its inner wall to the side wall across the throat. The
 * vent carries the design's (its divider size at the measured thickness); a vent without one, as in older saves, is ½″.
 */
export const ductDividerIn = (v: Pick<VentSpec, "div">) =>
  v.div ?? defaultPanelIn(DUCT_DIVIDER_DEFAULT, PLYWOOD_MATERIAL);
// A sub's baffle, in: the box's air starts behind it, so a duct from the frame front runs this much less beside it (the
// reveal's fraction of an inch more is left out: it moves the correction well under 1 %).
const SUB_BAFFLE_IN = 0.75;
/**
 * A bottom slot's inner end correction (in). Straight: its mouth on the floor, the back wall behind it, the box's inside
 * height across it. Folded up the back wall: the floor leg turns a sharp 90° into the rear channel (SHARP_BEND_CORRECTION
 * against the centerline the length is measured on), and the channel's mouth, under the lid, is the same kind of mouth
 * turned on its side: along the back panel, the rear wall its shelf (rising from the floor leg's roof), the lid the
 * facing wall, the box's inside depth across it. `most`: the most it can be in this box, straight or folded, whatever
 * the length (slotMouthCorrectionMost).
 */
export function slotInnerEndCorrection(
  box: Dims3,
  v: Pick<VentSpec, "slotH" | "len">,
  t: number,
  folded: boolean,
  most = false,
) {
  const h = v.slotH;
  if (most)
    return Math.max(
      slotMouthCorrectionMost(h, box.h - 2 * t, t),
      SHARP_BEND_CORRECTION * h + slotMouthCorrectionMost(h, box.d - SUB_BAFFLE_IN - t, t),
    );
  // the slot runs from the frame front under the baffle (as maxStraightSlotIn, the 3D view and the cutlist take it), so
  // its mouth is `d - t - len` from the back panel: a slot height at the longest straight run
  if (!folded)
    return slotMouthCorrection(h, box.h - 2 * t, box.d - t - v.len, t, v.len - SUB_BAFFLE_IN);
  const depth = box.d - SUB_BAFFLE_IN - t; // across the rear channel's mouth, the box's depth behind the baffle
  return (
    SHARP_BEND_CORRECTION * h +
    slotMouthCorrection(h, depth, foldedLidGapIn(box, v, t), t, foldedRearWallIn(box, v, t) - t)
  );
}
/**
 * A side duct's end corrections (in), each duct's (`n` of them, one against each side wall for a pair). Outside, the
 * ground mirrors the bottom of its mouth (throat × open height). Inside, the same mouth as a bottom slot's, turned on its
 * side: the side wall its floor, the duct's inner wall (`t`, from the frame front as the cutlist and the 3D view take it)
 * its shelf, the back wall `d - t - len` behind the mouth, and across it the box's inside width (half of it for a pair:
 * the center line is a plane of symmetry). `most`: the most it can be in this box, whatever the length
 * (slotMouthCorrectionMost).
 */
export function sideDuctEndCorrection(
  box: Dims3,
  v: Pick<VentSpec, "throat" | "len" | "div">,
  t: number,
  n: 1 | 2,
  most = false,
) {
  const th = v.throat,
    span = (box.w - 2 * t) / n,
    open = box.h - 2 * t - 2 * ductDividerIn(v);
  return (
    rectangleEndCorrection(th, 2 * open) +
    (most
      ? slotMouthCorrectionMost(th, span, t)
      : slotMouthCorrection(th, span, box.d - t - v.len, t, v.len - SUB_BAFFLE_IN))
  );
}

// Vent geometry for the sub. t is the wall (and fin) ply. n is the number of separate openings,
// which sets the end correction in boxModel.
export function ventGeometry(
  portStyle: PortStyle,
  box: Dims3,
  cVent: VentSpec,
  t: number,
  drv: TubeDriver,
): VentGeometry {
  const iw = box.w - 2 * t,
    ih = box.h - 2 * t;
  if (portStyle === "vslots" || portStyle === "vslot1") {
    const n = portStyle === "vslot1" ? 1 : 2;
    const th = cVent.throat,
      open = ih - 2 * ductDividerIn(cVent), // two dividers per duct
      area = n * th * open,
      seg = open / 3;
    return {
      n,
      area,
      len: cVent.len,
      ec: sideDuctEndCorrection(box, cVent, t, n),
      dh: (4 * (th * seg)) / (2 * (th + seg)),
      desc: `${n === 1 ? "one side duct" : "two side ducts"}, ${th.toFixed(2)}\u2033 throat \u00d7 ${ih.toFixed(1)}\u2033, ${cVent.len.toFixed(1)}\u2033 long`,
    };
  }
  if (portStyle === "slots") {
    // one letterbox split by two fins (wall ply); the fins run the full length but the mouths
    // sit together, so it is treated as a single opening on the floor (see slotInnerEndCorrection)
    const h = cVent.slotH,
      area = h * (iw - 2 * t),
      seg = (iw - 2 * t) / 3;
    // a slot too long to run straight folds up the back wall: its mouth faces the lid, and the turn takes its own length
    const folded = slotFolds(box, cVent, t);
    return {
      n: 1,
      area,
      len: cVent.len,
      ec: rectangleEndCorrection(2 * h, iw - 2 * t) + slotInnerEndCorrection(box, cVent, t, folded),
      dh: (4 * (h * seg)) / (2 * (h + seg)),
      desc:
        `letterbox, ${h.toFixed(2)}\u2033 \u00d7 ${iw.toFixed(1)}\u2033, ${cVent.len.toFixed(1)}\u2033 long` +
        (folded ? ", folded up the back wall" : ""),
    };
  }
  // round tubes: straight while they fit, then up the back wall and forward under the lid (lib/pa/tubes)
  const r = cVent.dia / 2;
  const elbows = modelTubeElbows(box, portStyle, cVent, t, drv);
  return {
    n: cVent.nt,
    area: cVent.nt * Math.PI * r * r,
    len: cVent.len,
    ec: subTubeEndCorrection(box, portStyle, cVent, t, drv, elbows),
    dh: cVent.dia,
    elbows,
    desc:
      `${cVent.nt} \u00d7 ${cVent.dia.toFixed(2)}\u2033 round, ${cVent.len.toFixed(1)}\u2033 long` +
      (elbows ? `, ${ELBOW_WORDS[elbows]} each` : ""),
  };
}

// Liters of wood inside a box: everything behind the baffle except the shell panels themselves.
// Window braces keep ~2 in rails, so only their rails count.
const SHELL: ReadonlySet<CutPartId> = new Set(["side", "topBottom", "back", "baffle"]);
export function internalWoodLiters(parts: CutPart[], box: CutBoxId) {
  let in3 = 0;
  for (const p of parts) {
    if (p.box !== box || SHELL.has(p.part)) continue;
    const a = Math.min(p.a, p.b),
      b = Math.max(p.a, p.b);
    const R = WINDOW_RAIL_IN;
    const area =
      p.part === "windowBrace" ? a * b - Math.max(0, a - 2 * R) * Math.max(0, b - 2 * R) : a * b;
    in3 += area * p.t * p.qty;
  }
  return (in3 * 16.387) / 1000;
}

// ---- limits ----
// Every limit is an amp output voltage for a sine at the amp's rated power into 8 ohm. Port and
// cone limits use the sine's peaks. Thermal is program power, 2 x AES: AES noise has a 6 dB crest,
// so a sine with the same peak voltage carries twice the AES power; music with at least that crest
// keeps the coil's average at or under AES.
export const thermalVoltageLimit = (aes: number) => Math.sqrt(2 * aes * 8);
export const ampVoltage = (W: number) => Math.sqrt(W * 8);
// Broadband ("music") limit: one drive level for the whole band.
export function subwooferLimits(
  mdl: VentedBoxModel,
  ts: Pick<ThieleSmall, "aes">,
  AMP_V: number,
  portMax: number,
): SubLimits {
  const vp = (AMP_V * portMax) / mdl.peakVel,
    vx = (AMP_V * 100) / mdl.xmaxPct,
    vt = thermalVoltageLimit(ts.aes);
  const L = Math.min(vp, vx, vt, AMP_V);
  const sc = 20 * Math.log10(L / AMP_V);
  return {
    who: L === vp ? "port" : L === vx ? "Xmax" : L === vt ? "thermal" : "amp",
    V: L,
    W: (L * L) / 8,
    vel: (mdl.peakVel * L) / AMP_V,
    xPct: (mdl.xmaxPct * L) / AMP_V,
    spl30: mdl.spl30 + sc,
    spl35: mdl.spl35 + sc,
    spl45: mdl.spl45 + sc,
  };
}
// Per-frequency sine limit: each frequency meets its own port and excursion limits.
export function maxOutputCurve(
  curve: { f: number; spl: number; xmm: number; vel?: number }[],
  ts: Pick<ThieleSmall, "aes" | "Xmax">,
  AMP_V: number,
  portMax: number,
): PaMaxPoint[] {
  const vt = thermalVoltageLimit(ts.aes);
  return curve.map((o): PaMaxPoint => {
    const vp = o.vel != null ? (AMP_V * portMax) / o.vel : Infinity,
      vx = (AMP_V * ts.Xmax) / o.xmm;
    const V = Math.min(vp, vx, vt, AMP_V);
    return {
      f: o.f,
      spl: o.spl + 20 * Math.log10(V / AMP_V),
      who: V === vp ? "port" : V === vx ? "Xmax" : V === vt ? "thermal" : "amp",
    };
  });
}
// The sub-bass band, Hz: the low end the sub's readout averages, an absolute level to compare designs by (F3 is relative
// to each driver's own passband).
export const SUB_BASS_BAND_HZ = [30, 50] as const;
// The mean level of a curve over the sub-bass band, dB: on maxOutputCurve, the sub-bass the design can play. The grid is
// log-spaced, so this is a mean over log frequency.
export function subBassLevel(curve: FrequencyPoint[]) {
  const [lo, hi] = SUB_BASS_BAND_HZ;
  const band = curve.filter((o) => o.f >= lo && o.f <= hi);
  return band.reduce((a, o) => a + o.spl, 0) / band.length;
}
export const nearestPoint = <P extends { f: number }>(curve: P[], f: number): P =>
  curve.reduce((b, o) => (Math.abs(o.f - f) < Math.abs(b.f - f) ? o : b));
// One point of the sub at its music limit (one drive level for the whole band) through the lowpass at xoLo
// (LR24, or LR48 with order 8).
const subMusicLevel = (
  o: Pick<VentedPoint, "f" | "spl">,
  lim: Pick<SubLimits, "V">,
  AMP_V: number,
  xoLo: number,
  order: CrossoverOrder,
) =>
  o.spl + 20 * Math.log10(linkwitzRileyLowpass(o.f, xoLo, order)) + 20 * Math.log10(lim.V / AMP_V);
// The whole curve of it,
export function subMusicThroughLowpass(
  mdl: VentedBoxModel,
  lim: Pick<SubLimits, "V">,
  AMP_V: number,
  xoLo: number,
  order: CrossoverOrder,
): FrequencyPoint[] {
  return mdl.curve.map((o) => ({ f: o.f, spl: subMusicLevel(o, lim, AMP_V, xoLo, order) }));
}
// ... and its level at the crossover: what the mid has to match (one point of that curve; the optimizer calls it often).
export function subMusicOutputAt(
  mdl: VentedBoxModel,
  lim: Pick<SubLimits, "V">,
  AMP_V: number,
  xoLo: number,
  order: CrossoverOrder,
) {
  return subMusicLevel(nearestPoint(mdl.curve, xoLo), lim, AMP_V, xoLo, order);
}

// ---- horn ----
// Datasheet model, not T/S: on-horn sensitivity + 10 log P, shaped by the LR24 (or, order 8, LR48)
// highpass at the crossover and 12 dB/oct below the horn's loading limit. Power: amp voltage into
// the driver's impedance, capped at program (2 x AES), derated 6 dB/oct below the frequency AES
// was rated at.
export function hornResponse(
  hf: CompressionHf | undefined,
  hz: Partial<HornHf>,
  xoHi: number,
  hfAmpW: number,
  order: CrossoverOrder,
): HornResponse | null {
  if (!hf || hf.sens == null || !hf.aes) return null;
  const imp = hf.imp || 8;
  const pAmp = (hfAmpW * 8) / imp;
  const derate = hf.aesXo && xoHi < hf.aesXo ? Math.pow(xoHi / hf.aesXo, 2) : 1;
  const pProg = 2 * hf.aes * derate;
  const P = Math.min(pAmp, pProg);
  const low = (hz && hz.lowHz) || 0;
  const curve: FrequencyPoint[] = [];
  for (let i = 0; i < 300; i++) {
    const f = 300 * Math.pow(20000 / 300, i / 299);
    const g = linkwitzRileyHighpass(f, xoHi, order) * (low ? Math.min(1, Math.pow(f / low, 2)) : 1);
    curve.push({ f, spl: hf.sens + 10 * Math.log10(P) + 20 * Math.log10(g) });
  }
  return {
    hf,
    curve,
    P,
    pAmp,
    pProg,
    derate,
    imp,
    who: P === pAmp ? "amp" : "thermal",
    flat: hf.sens + 10 * Math.log10(P),
  };
}

// ---- directivity ----
// Rigid piston: -6 dB where ka sin(theta) = 2.2 (2 J1(x)/x = 0.5 at x = 2.215).
export function pistonBeamWidthDeg(SdCm2: number, f: number) {
  const ka = ((2 * Math.PI * f) / 343) * Math.sqrt(SdCm2 / 10000 / Math.PI);
  return ka <= 2.2 ? 180 : (2 * Math.asin(2.2 / ka) * 180) / Math.PI;
}
// Keele: a horn holds its angle down to f = 25 400 / (mouth width m x angle deg) (1e6 in-deg-Hz).
export const keeleFrequency = (covDeg: number, mouthIn: number) =>
  25400 / (mouthIn * 0.0254 * covDeg);
export const hornBeamWidthDeg = (covDeg: number, fK: number, f: number) =>
  Math.min(180, f >= fK ? covDeg : (covDeg * fK) / f);

// ---- weights (lb): 3/4″ baffle, other panels at the wall ply, and the braces and ribs (subBoxBracing,
// midBoxBracing) by their wood. Without the bracing: the bare box, a floor for any bracing ----
/**
 * What each box weighs besides its panels, braces, driver and the catalog's hardware (lib/pa/hardware hardwareLb), lb:
 * the screws, glue, wiring and damping. The handles, the input dish and its jacks, and the horn posts are counted by
 * part, so these are only the remainder.
 */
export const SUB_FIXINGS_LB = 3.5;
export const MID_FIXINGS_LB = 0.5;
export const subWeightLb = (
  b: Dims3,
  wall: number,
  drvLb: number,
  bracing?: Pick<BoxBracing, "windowIn3" | "ribIn3"> | null,
  /** the handles, dish, jacks and posts (lib/pa/hardware hardwareLb) */
  hardwareLb = 0,
) =>
  (b.w * b.h * 2.3 + (b.w * b.h + 2 * b.w * b.d + 2 * b.h * b.d) * plywoodLbPerSqFt(wall)) / 144 +
  braceLb(bracing, wall) +
  (drvLb || 0) +
  hardwareLb +
  SUB_FIXINGS_LB;
export const midWeightLb = (
  b: Dims3,
  wall: number,
  bracing?: Pick<BoxBracing, "windowIn3" | "ribIn3"> | null,
  /** the handles, dish, jacks and posts (lib/pa/hardware hardwareLb) */
  hardwareLb = 0,
) =>
  (b.w * b.h * 2.3 + (b.w * b.h + 2 * b.w * b.d + 2 * b.h * b.d) * plywoodLbPerSqFt(wall)) / 144 +
  braceLb(bracing, wall) +
  hardwareLb +
  MID_FIXINGS_LB;

// ---- the sub as the planner computes it ----
// cfg: { subBox, midDims, wall, inset, portStyle, cVent, hpf, hpType, ampW, portMax, layout }
// Vent and volumes only (no model): what the optimizer's vent solver iterates on.
export function subGeometry(sub: SubDriver, mid: MidDriver, cfg: SubGeometryConfig): SubGeometry {
  const port = ventGeometry(cfg.portStyle, cfg.subBox, cfg.cVent, cfg.wall, sub);
  const grossL = boxInternalLiters(cfg.subBox.w, cfg.subBox.h, cfg.subBox.d, cfg.wall, cfg.inset);
  const ductL = (port.area * port.len * 16.387) / 1000;
  const partsL = internalWoodLiters(
    cutParts({
      sub,
      mid,
      subBox: cfg.subBox,
      midDims: cfg.midDims,
      wall: cfg.wall,
      inset: cfg.inset,
      joint: "butt",
      portStyle: cfg.portStyle,
      cVent: cfg.cVent,
      layout: cfg.layout,
      braceStyle: cfg.braceStyle,
      backJoint: cfg.backJoint,
      subOnly: true,
      noBraces: cfg.braceEstimate,
      // the ribs keep out of the recesses (subBoxBracing)
      hardware: cfg.hardware,
    }).parts,
    "sub",
  );
  // a search's braces: their estimated wood in place of the rule's parts
  const estL = cfg.braceEstimate
    ? (braceWoodIn3(
        braceWoodEstimate(
          cfg.subBox,
          cfg.wall,
          cfg.inset,
          cfg.braceStyle ?? defaultBraceStyleNear(cfg.wall),
        ),
      ) *
        16.387) /
      1000
    : 0;
  const woodL = partsL + estL;
  const recessL = hardwareLiters(cfg.hardware, "sub", cfg.wall, cfg.layout);
  const netL = Math.max(20, grossL - (sub.ts ? sub.ts.disp : 10.5) - ductL - woodL - recessL);
  return {
    port,
    grossL,
    ductL,
    woodL,
    recessL,
    netL,
    Fb: ventTuning(netL, port.area, port.len, port.n, port.ec).Fb,
  };
}
export function subSystem(sub: SubDriver, mid: MidDriver, cfg: SubSystemConfig): SubSystem {
  const { port, grossL, ductL, woodL, recessL, netL } = subGeometry(sub, mid, cfg);
  const AMP_V = ampVoltage(cfg.ampW);
  const mdl = sub.ts
    ? boxModel(sub.ts, netL, port.area, port.len, cfg.hpf, AMP_V, cfg.hpType, {
        nPorts: port.n,
        ecIn: port.ec,
        fTop: cfg.xoLo && LOWPASS_SKIRT_SPAN * cfg.xoLo, // past 300 Hz only above a 120 Hz crossover
        phase: cfg.phase,
      })
    : null;
  if (!sub.ts || !mdl)
    return { port, grossL, ductL, woodL, recessL, netL, AMP_V, mdl: null, lim: null };
  return {
    port,
    grossL,
    ductL,
    woodL,
    recessL,
    netL,
    AMP_V,
    mdl,
    lim: subwooferLimits(mdl, sub.ts, AMP_V, ventSpeedLimit(cfg.portStyle, cfg.portMax)),
  };
}

// Sub through the lowpass at the crossover (LR24, or LR48 with order 8), each frequency at its own
// sine limit (the filter scales excursion and port speed with the output).
export function subThroughLowpass(
  mdl: VentedBoxModel,
  ts: Pick<ThieleSmall, "aes" | "Xmax">,
  AMP_V: number,
  portMax: number,
  xoLo: number,
  order: CrossoverOrder,
): FrequencyPoint[] {
  const vt = thermalVoltageLimit(ts.aes);
  return mdl.curve.map((o) => {
    const g = linkwitzRileyLowpass(o.f, xoLo, order);
    const vp = (AMP_V * portMax) / (o.vel * g),
      vx = (AMP_V * ts.Xmax) / (o.xmm * g);
    const V = Math.min(vp, vx, vt, AMP_V);
    return { f: o.f, spl: o.spl + 20 * Math.log10(g) + 20 * Math.log10(V / AMP_V) };
  });
}

// ---- the mid-bass as the planner computes it: sealed, always lightly stuffed ----
// cfg: { midDims, wall, inset, xoLo, xoHi, xoLoOrder, xoHiOrder, mAmpW }
export const STUFFING_VOLUME_GAIN = 1.15; // ~15% more effective volume from light stuffing
/**
 * The mid's net volume, L: the gross less the driver, the braces' and ribs' wood (midBoxBracing) and the hardware's
 * recesses (lib/pa/hardware hardwareLiters).
 */
export const midNetLiters = (
  grossL: number,
  disp: number,
  bracing: Pick<BoxBracing, "windowIn3" | "ribIn3"> | null,
  recessL = 0,
) => Math.max(5, grossL - disp - (braceWoodIn3(bracing) * 16.387) / 1000 - recessL);
export function midSystem(mid: MidDriver, cfg: MidSystemConfig): MidSystem {
  const V = ampVoltage(cfg.mAmpW);
  const grossL = boxInternalLiters(
    cfg.midDims.w,
    cfg.midDims.h,
    cfg.midDims.d,
    cfg.wall,
    cfg.inset,
  );
  const disp = mid.ts && mid.ts.disp != null ? mid.ts.disp : mid.size === 15 ? 4 : 2.5; // assumed where not published
  const recessL = hardwareLiters(cfg.hardware, "mid", cfg.wall, cfg.layout);
  const netL = midNetLiters(
    grossL,
    disp,
    cfg.braceEstimate
      ? midBraceEstimate(
          cfg.midDims,
          cfg.wall,
          cfg.inset,
          cfg.layout,
          cfg.braceStyle ?? defaultBraceStyleNear(cfg.wall),
        )
      : midBoxBracing(
          cfg.midDims,
          cfg.wall,
          cfg.inset,
          mid,
          cfg.layout,
          cfg.braceStyle,
          cfg.hardware?.mid,
          cfg.backJoint,
        ),
    recessL,
  );
  const effL = netL * STUFFING_VOLUME_GAIN;
  // the curve runs on past 2 kHz when the lowpass sits above 800 Hz, so its skirt shows on the system chart
  const mdl = mid.ts
    ? closedBox(mid.ts, effL, cfg.xoLo, cfg.xoHi, V, {
        fTop: LOWPASS_SKIRT_SPAN * cfg.xoHi,
        hpOrder: cfg.xoLoOrder,
        lpOrder: cfg.xoHiOrder,
        phase: cfg.phase,
      })
    : null;
  const vTherm = mid.ts ? thermalVoltageLimit(mid.ts.aes) : 0;
  const useV = Math.min(vTherm, V);
  if (!mid.ts || !mdl)
    return { V, grossL, disp, recessL, netL, effL, vTherm, useV, mdl: null, max: null };
  const max = maxOutputCurve(mdl.curve, mid.ts, V, Infinity); // no port: Xmax, thermal, amp
  return { V, grossL, disp, recessL, netL, effL, vTherm, useV, mdl, max };
}

// ---- passive coaxial fills ----
// drv: FILL_OPTIONS entry. cfg: { boxType: "vented" | "sealed", dim {w,h,d} external in, port {n, dia, len},
// hp (highpass to the subs, Hz), hpOrder (its slope: 4 = LR24, 8 = LR48), ampW (per box, 8 ohm rating), portMax }. 1/2" walls throughout.
export function fillSystem(drv: FillDriver, cfg: FillSystemConfig): FillSystem | null {
  const { boxType, dim, port, hp, hpOrder, ampW, portMax } = cfg;
  const ts = drv.ts,
    V = ampVoltage(ampW),
    vented = boxType === "vented";
  const gross = ((dim.w - 1) * (dim.h - 1) * (dim.d - 1) * 16.387) / 1000;
  const pArea = vented ? port.n * Math.PI * Math.pow(port.dia / 2, 2) : 0;
  const pVol = (pArea * port.len * 16.387) / 1000;
  const disp = ts.disp != null ? ts.disp : drv.size >= 10 ? 1.5 : 1;
  const net = Math.max(3, gross - disp - (vented ? pVol : 0));
  const eff = vented ? net : net * STUFFING_VOLUME_GAIN; // sealed boxes are stuffed
  const vM = vented
    ? boxModel(ts, eff, pArea, port.len, hp, V, crossoverSlopeName(hpOrder), { nPorts: port.n })
    : null;
  // sealed: the same highpass to the subs, and no lowpass (lpOrder is unused without one)
  const sM = vented ? null : closedBox(ts, eff, hp, null, V, { hpOrder, lpOrder: hpOrder });
  const m = vM || sM;
  if (!m) return null; // a vented box with no port area or length has no model
  const max = maxOutputCurve(m.curve, ts, V, portMax).filter((o) => o.f <= 300);
  const sens = m.ref - 20 * Math.log10(V / 2.83);
  // system -3 dB, highpass included, for both box types
  const f3 = vM
    ? vM.f3
    : (m.curve.find((o) => o.spl >= m.ref - 3) || m.curve[m.curve.length - 1]).f;
  // HF through a passive network, padded down to the woofer: reaches its program rating (2 x AES)
  // only at an amp power well above what the woofer sees
  const hf = drv.hf;
  const pad = hf ? Math.max(0, hf.sens - (drv.lfSens || sens)) : 0;
  const hfLimW = hf ? ((2 * hf.aes * hf.imp) / 8) * Math.pow(10, pad / 10) : null; // amp watts (8 ohm rating)
  const lb = ((2 * (dim.w * dim.h + dim.w * dim.d + dim.h * dim.d)) / 144) * 1.6 + drv.lb + 1; // 1/2" birch ~1.6 lb/ft2
  const portLimited = vented && max.some((o) => o.who === "port");
  const common = { V, gross, pArea, disp, net, eff, max, sens, f3, pad, hfLimW, lb, portLimited };
  if (vM) return { ...common, boxType: "vented", vM, sM: null };
  if (sM) return { ...common, boxType: "sealed", vM: null, sM };
  return null;
}
