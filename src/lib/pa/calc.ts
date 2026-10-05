// Calculation functions for the planner. Pure TS, no React, window or THREE.
import type {
  BoxModelTS,
  CompressionHf,
  CornerJoint,
  CrossoverOrder,
  CutBoxId,
  CutPart,
  CutPartId,
  CutPartsConfig,
  Dims3,
  FillDriver,
  FillSystem,
  FillSystemConfig,
  FrequencyPoint,
  HighpassType,
  HornHf,
  HornResponse,
  MidDriver,
  MidSystem,
  MidSystemConfig,
  PaMaxPoint,
  PanelThickness,
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
import { DRIVER_CUTOUT_IN } from "../../data/catalog/driver-cutouts";
import { PLYWOOD_LB_PER_SQ_FT } from "../../data/catalog/plywood";
import { crossoverSlopeName } from "../../constants/crossovers";
import { SHARP_BEND_CORRECTION, SLOT_INNER_END } from "../../data/acoustics/slot-inner-end";

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
 * that fits straight is built, and modelled, straight.
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
 * centreline:
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
// The normalised Butterworth sections of even order n, s² + b·s + 1: each b = 2 sin((2k − 1)π / 2n), k = 1 … n/2.
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
// Normalised Butterworth denominator of even order n: the product of its sections, in plain real arithmetic
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
// modelled, so the top octave reads a little high. Excursion is the sine peak, as in boxModel; opts.phase gives each
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

// Internal litres with walls of thickness t and a 3/4″ baffle recessed `inset` into the frame.
export const boxInternalLiters = (w: number, h: number, d: number, t: number, inset = 0.75) =>
  ((w - 2 * t) * (h - 2 * t) * (d - inset - 0.75 - t) * 16.387) / 1000;
export { PLYWOOD_LB_PER_SQ_FT };
/** Whether a wall thickness is one the catalogue lists panel weights for. */
export const isPanelThickness = (t: number): t is PanelThickness =>
  Object.hasOwn(PLYWOOD_LB_PER_SQ_FT, t);
// Plywood weight, lb/ft². The wall comes from user input or a saved config, so it can be any number: a thickness the
// catalogue doesn't list is weighed as 3/4″ (deliberate fallback, not a missing entry).
export const plywoodLbPerSqFt = (t: number) => PLYWOOD_LB_PER_SQ_FT[isPanelThickness(t) ? t : 0.75];

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
export const formatThickness = (t: number) => (t === 0.75 ? "3/4″" : t === 0.5 ? "1/2″" : `${t}″`);

export function boxParts(
  label: CutBoxId,
  W: number,
  H: number,
  D: number,
  t: number,
  inset: number,
  joint: CornerJoint,
  extra: { band?: number; cutNote?: string; braces?: number } = {},
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
  P.push({ box: label, part: "side", qty: 2, a: D, b: H, t, note: sideNote });
  P.push({ box: label, part: "topBottom", qty: 2, a: D, b: topW, t, note: topNote });
  P.push({
    box: label,
    part: "back",
    qty: 1,
    a: W - t,
    b: H - t,
    t,
    note: "sits in the rear rabbet",
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
  if (extra.braces)
    P.push({
      box: label,
      part: "windowBrace",
      qty: extra.braces,
      a: iw,
      b: inD,
      t,
      note: "cut out the center, leave ~2″ rails",
    });
  return { P, iw, ih, inD };
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
}: CutPartsConfig): { parts: CutPart[]; vent: string[] } {
  const t = wall,
    all: CutPart[] = [];
  const vent: string[] = [];
  const s = boxParts("sub", subBox.w, subBox.h, subBox.d, t, inset, joint, {
    braces: wall === 0.5 ? 3 : 2,
    band: portStyle === "slots" ? cVent.slotH + t : 0,
    cutNote: `${formatInches(DRIVER_CUTOUT_IN[sub.size])}″ driver cutout (check the datasheet)`,
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
      t: 0.5,
      note: "",
    });
  } else {
    vent.push(
      `${cVent.nt} × ${formatInches(cVent.dia)}″ port tube, ${formatInches(cVent.len)}″ long (buy, flared)`,
    );
  }
  if (layout !== "tower") {
    const m = boxParts("mid", midDims.w, midDims.h, midDims.d, t, inset, joint, {
      braces: wall === 0.5 ? 2 : 1,
      cutNote: `${formatInches(DRIVER_CUTOUT_IN[mid.size])}″ driver cutout (check the datasheet)`,
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
// Rectangular duct of throat a x height b along a panel: a wall at an end mirrors the mouth, so that end
// acts as one twice as wide in a (image method). Outer end flanged (baffle), inner end free (0.61/0.85).
export const ductEndCorrection = (
  a: number,
  b: number,
  { inner = true, outer = true }: { inner?: boolean; outer?: boolean } = {},
) =>
  rectangleEndCorrection(outer ? 2 * a : a, b) +
  (0.61 / 0.85) * rectangleEndCorrection(inner ? 2 * a : a, b);
// Inner end, inside the box: the vent mouth (height h against one wall, spanning the box from wall to wall)
// opens into the box interior, a duct of height X that ends at the back wall a distance L away. Low-frequency
// modal sum for a piston in a rigid 2D duct (the evanescent cross-modes carry the added mass):
//   end correction = 2 X^2 / (pi^3 h) * sum sin^2(m pi h / X) coth(m pi L / X) / m^3
// It includes the wall the vent sits on and the opposite wall, and tends to the free-space strip as X grows.
// It walls off the box over the duct (the plane of the mouth is rigid out to X), so it is kept for the side ducts only;
// a bottom slot's inner end is slotInnerEndCorrection's. The gap to the back wall is taken as at least h: closer than
// that the flow turns through the gap and the model no longer holds.
const d2Cache = new Map<string, number>();
export function ductEndCorrection2D(h: number, X: number, L = Infinity) {
  if (h >= X) return 0;
  L = Math.max(L, h);
  const key = h + "|" + X + "|" + L,
    hit = d2Cache.get(key);
  if (hit !== undefined) return hit;
  if (d2Cache.size > 20000) d2Cache.clear();
  let sum = 0;
  for (let m = 1; m <= 2000; m++) {
    const k = (m * Math.PI) / X,
      sn = Math.sin(k * h);
    sum += ((sn * sn) / (m * m * m)) * (Number.isFinite(L) ? 1 / Math.tanh(k * L) : 1);
  }
  const v = ((2 * X * X) / (Math.PI ** 3 * h)) * sum;
  d2Cache.set(key, v);
  return v;
}
export const FREE_END = 0.61 / 0.85; // an unflanged (free) end relative to a flanged one, as in 1.46 r
// Where `x` falls on an ascending axis: the cell's lower index and the fraction across it, clamped to the axis' ends.
function axisCell(axis: readonly number[], x: number) {
  const last = axis.length - 1;
  if (!(x > axis[0])) return { i: 0, f: 0 };
  if (x >= axis[last]) return { i: last - 1, f: 1 };
  let i = 0;
  while (axis[i + 1] < x) i++;
  return { i, f: (x - axis[i]) / (axis[i + 1] - axis[i]) };
}
/**
 * The inner end correction (in) of a slot `h` high that runs along a wall and opens into the box: the shelf forming it
 * `t` thick with the box open beyond it, a facing wall `gap` from the mouth, the box spanning `span` across the mouth
 * (SLOT_INNER_END, interpolated in its axes; outside them, its nearest edge).
 */
export function slotMouthCorrection(h: number, span: number, gap: number, t: number) {
  const T = SLOT_INNER_END;
  const a = axisCell(T.gap, gap > 0 ? h / gap : Infinity),
    b = axisCell(T.span, h / span),
    c = axisCell(T.wall, t / h);
  let v = 0;
  for (let da = 0; da < 2; da++)
    for (let db = 0; db < 2; db++)
      for (let dc = 0; dc < 2; dc++) {
        const k = (da ? a.f : 1 - a.f) * (db ? b.f : 1 - b.f) * (dc ? c.f : 1 - c.f);
        if (k) v += k * T.ecOverH[a.i + da][b.i + db][c.i + dc];
      }
  return v * h;
}
/**
 * A bottom slot's inner end correction (in). Straight: its mouth on the floor, the back wall behind it, the box's inside
 * height across it. Folded up the back wall: the floor leg turns a sharp 90° into the rear channel (SHARP_BEND_CORRECTION
 * against the centreline the length is measured on), and the channel's mouth, under the lid, is the same kind of mouth
 * turned on its side: along the back panel, the rear wall its shelf, the lid the facing wall, the box's inside depth
 * across it.
 */
export function slotInnerEndCorrection(
  box: Dims3,
  v: Pick<VentSpec, "slotH" | "len">,
  t: number,
  folded: boolean,
) {
  const h = v.slotH,
    depth = box.d - 0.75 - t; // baffle to back panel, as the gap behind a straight slot is measured
  if (!folded) return slotMouthCorrection(h, box.h - 2 * t, depth - v.len, t);
  return SHARP_BEND_CORRECTION * h + slotMouthCorrection(h, depth, foldedLidGapIn(box, v, t), t);
}
// Side duct (throat th, open height H) against a side wall: outside, the ground mirrors the bottom of the
// mouth; inside, the box interior across its width X (for a pair of ducts, half the width: symmetry).
export const sideDuctEndCorrection = (th: number, H: number, X?: number, L?: number) =>
  X
    ? rectangleEndCorrection(th, 2 * H) + FREE_END * ductEndCorrection2D(th, X, L)
    : ductEndCorrection(th, H, { outer: false });

// Vent geometry for the sub. t is the wall (and fin) ply. n is the number of separate openings,
// which sets the end correction in boxModel.
export function ventGeometry(
  portStyle: PortStyle,
  box: Dims3,
  cVent: VentSpec,
  t: number,
): VentGeometry {
  const iw = box.w - 2 * t,
    ih = box.h - 2 * t;
  if (portStyle === "vslots" || portStyle === "vslot1") {
    const n = portStyle === "vslot1" ? 1 : 2;
    const th = cVent.throat,
      area = n * th * (ih - 2 * 0.5),
      seg = (ih - 2 * 0.5) / 3; // two 1/2\u2033 dividers per duct
    const L = box.d - 0.75 - t - cVent.len; // mouth to back wall (duct measured from the baffle front, 3/4" inset)
    return {
      n,
      area,
      len: cVent.len,
      ec: sideDuctEndCorrection(th, ih - 2 * 0.5, n === 2 ? iw / 2 : iw, L),
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
  const r = cVent.dia / 2;
  return {
    n: cVent.nt,
    area: cVent.nt * Math.PI * r * r,
    len: cVent.len,
    dh: cVent.dia,
    desc: `${cVent.nt} \u00d7 ${cVent.dia.toFixed(2)}\u2033 round, ${cVent.len.toFixed(1)}\u2033 long`,
  };
}

// Litres of wood inside a box: everything behind the baffle except the shell panels themselves.
// Window braces keep ~2 in rails, so only their rails count.
const SHELL: ReadonlySet<CutPartId> = new Set(["side", "topBottom", "back", "baffle"]);
export function internalWoodLiters(parts: CutPart[], box: CutBoxId) {
  let in3 = 0;
  for (const p of parts) {
    if (p.box !== box || SHELL.has(p.part)) continue;
    const a = Math.min(p.a, p.b),
      b = Math.max(p.a, p.b);
    const area = p.part === "windowBrace" ? Math.max(0, 2 * 2 * (a + b) - 4 * 2 * 2) : a * b;
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

// ---- weights (lb): 3/4″ baffle, other panels and full-size braces at the wall ply ----
// Brace counts match the Cutlist: sub 2 (3 with 1/2″ walls), mid 1 (2 with 1/2″ walls).
export const subWeightLb = (b: Dims3, wall: number, drvLb: number) =>
  (b.w * b.h * 2.3 +
    (b.w * b.h + 2 * b.w * b.d + 2 * b.h * b.d + (wall === 0.5 ? 3 : 2) * b.w * b.d) *
      plywoodLbPerSqFt(wall)) /
    144 +
  (drvLb || 0) +
  6;
export const midWeightLb = (b: Dims3, wall: number) =>
  (b.w * b.h * 2.3 +
    (b.w * b.h + 2 * b.w * b.d + 2 * b.h * b.d + (wall === 0.5 ? 2 : 1) * b.w * b.d) *
      plywoodLbPerSqFt(wall)) /
    144 +
  2;

// ---- the sub as the planner computes it ----
// cfg: { subBox, midDims, wall, inset, portStyle, cVent, hpf, hpType, ampW, portMax, layout }
// Vent and volumes only (no model): what the optimizer's vent solver iterates on.
export function subGeometry(sub: SubDriver, mid: MidDriver, cfg: SubGeometryConfig): SubGeometry {
  const port = ventGeometry(cfg.portStyle, cfg.subBox, cfg.cVent, cfg.wall);
  const grossL = boxInternalLiters(cfg.subBox.w, cfg.subBox.h, cfg.subBox.d, cfg.wall, cfg.inset);
  const ductL = (port.area * port.len * 16.387) / 1000;
  const woodL = internalWoodLiters(
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
    }).parts,
    "sub",
  );
  const netL = Math.max(20, grossL - (sub.ts ? sub.ts.disp : 10.5) - ductL - woodL);
  return {
    port,
    grossL,
    ductL,
    woodL,
    netL,
    Fb: ventTuning(netL, port.area, port.len, port.n, port.ec).Fb,
  };
}
export function subSystem(sub: SubDriver, mid: MidDriver, cfg: SubSystemConfig): SubSystem {
  const { port, grossL, ductL, woodL, netL } = subGeometry(sub, mid, cfg);
  const AMP_V = ampVoltage(cfg.ampW);
  const mdl = sub.ts
    ? boxModel(sub.ts, netL, port.area, port.len, cfg.hpf, AMP_V, cfg.hpType, {
        nPorts: port.n,
        ecIn: port.ec,
        fTop: cfg.xoLo && LOWPASS_SKIRT_SPAN * cfg.xoLo, // past 300 Hz only above a 120 Hz crossover
        phase: cfg.phase,
      })
    : null;
  if (!sub.ts || !mdl) return { port, grossL, ductL, woodL, netL, AMP_V, mdl: null, lim: null };
  return {
    port,
    grossL,
    ductL,
    woodL,
    netL,
    AMP_V,
    mdl,
    lim: subwooferLimits(mdl, sub.ts, AMP_V, cfg.portMax),
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
  const netL = Math.max(5, grossL - disp);
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
  if (!mid.ts || !mdl) return { V, grossL, disp, netL, effL, vTherm, useV, mdl: null, max: null };
  const max = maxOutputCurve(mdl.curve, mid.ts, V, Infinity); // no port: Xmax, thermal, amp
  return { V, grossL, disp, netL, effL, vTherm, useV, mdl, max };
}

// ---- passive coaxial fills ----
// drv: FILL_OPTIONS entry. cfg: { boxType: "vented" | "sealed", dim {w,h,d} external in, port {n, dia, len},
// hp (LR24 highpass to the subs), ampW (per box, 8 ohm rating), portMax }. 1/2" walls throughout.
export function fillSystem(drv: FillDriver, cfg: FillSystemConfig): FillSystem | null {
  const { boxType, dim, port, hp, ampW, portMax } = cfg;
  const ts = drv.ts,
    V = ampVoltage(ampW),
    vented = boxType === "vented";
  const gross = ((dim.w - 1) * (dim.h - 1) * (dim.d - 1) * 16.387) / 1000;
  const pArea = vented ? port.n * Math.PI * Math.pow(port.dia / 2, 2) : 0;
  const pVol = (pArea * port.len * 16.387) / 1000;
  const disp = ts.disp != null ? ts.disp : drv.size >= 10 ? 1.5 : 1;
  const net = Math.max(3, gross - disp - (vented ? pVol : 0));
  const eff = vented ? net : net * STUFFING_VOLUME_GAIN; // sealed boxes are stuffed
  const vM = vented ? boxModel(ts, eff, pArea, port.len, hp, V, "LR24", { nPorts: port.n }) : null;
  // sealed: the same LR24 highpass to the subs, and no lowpass
  const sM = vented ? null : closedBox(ts, eff, hp, null, V, { hpOrder: 4, lpOrder: 4 });
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
