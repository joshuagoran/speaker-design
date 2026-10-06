// The sub as the exact PA search models it: the planner's own vented-box circuit and box geometry, rearranged so the
// expensive part is shared. Pure; tests/pa-exact.test.ts checks every function here against the planner's.
//
// With the duct length solved for the tuning, the vented-box circuit depends on the net volume and the tuning only:
// the port's acoustic mass is ρc²/((2πFb)²·Vb) whatever its area, and the air speed in it is the flow over the area.
// So one curve per sub, net volume, tuning and highpass serves every box shape, plywood, vent style and vent size that
// gives that net volume and tuning; a design adds only its vent area (its port limit) and its geometry.
import {
  highpassGain,
  linkwitzRileyHighpass,
  linkwitzRileyLowpass,
  thermalVoltageLimit,
  rectangleEndCorrection,
  isRoundPort,
  maxStraightSlotIn,
  slotFolds,
  foldedRearWallIn,
  foldedShelfIn,
  slotInnerEndCorrection,
  boxInternalLiters,
  logGridCount,
  LOWPASS_SKIRT_SPAN,
  sideDuctEndCorrection,
  ductDividerIn,
  STUFFING_VOLUME_GAIN,
  midBoxBracing,
  midNetLiters,
  subBoxBracing,
} from "./calc";
import type {
  BraceStyleId,
  MidSystemConfig,
  CrossoverOrder,
  Dims3,
  HighpassType,
  MidDriver,
  PortStyle,
  SubLimits,
  SubTS,
  VentSpec,
} from "../../types";
import { subTubeEndCorrection, subTubeSpan, type TubeDriver } from "./tubes";
import { ELBOW_COUNTS, MAX_ELBOWS, ownSpans, type ElbowCount } from "../tubeFold";
import { SHARP_BEND_CORRECTION } from "../../data/acoustics/slot-inner-end";

const RHO = 1.18,
  C = 343,
  IN3_TO_L = 16.387 / 1000;

// the frequency grid boxModel runs on when the planner evaluates a design (no run-on past 300 Hz)
const N = 420,
  F_MIN = 12,
  F_MAX = 300;
const GRID = Float64Array.from(
  { length: N },
  (_, i) => F_MIN * Math.pow(F_MAX / F_MIN, i / (N - 1)),
);
/** The grid index `nearestPoint` picks for a frequency (the first of two equally near). */
export const gridIndexNear = (f: number) => {
  let b = 0;
  for (let i = 1; i < N; i++) if (Math.abs(GRID[i] - f) < Math.abs(GRID[b] - f)) b = i;
  return b;
};
/** The grid's frequency at an index. */
export const gridFrequency = (i: number) => GRID[i];
// the band the clean output is read over (bandOutputDb's 40-90 Hz)
const bandIndices = (band: readonly number[]) => {
  const at: number[] = [];
  GRID.forEach((f, i) => f >= band[0] && f <= band[1] && at.push(i));
  return at;
};

/** A highpass on the grid: its gain at each point, and that in dB. */
export interface HighpassTable {
  gain: Float64Array;
  db: Float64Array;
}
const HP_TABLES = new Map<string, HighpassTable>();
export function highpassTable(hpf: number, type: HighpassType): HighpassTable {
  const key = `${hpf}|${type}`;
  let t = HP_TABLES.get(key);
  if (!t) {
    const gain = GRID.map((f) => highpassGain(f, hpf, type));
    t = { gain, db: gain.map((g) => 20 * Math.log10(g)) };
    HP_TABLES.set(key, t);
  }
  return t;
}

/** A sub driver at an amp voltage: the circuit's constants, as boxModel computes them, and the grid's driver terms. */
export interface SubCircuit {
  ts: SubTS;
  volts: number;
  Sd: number;
  Mas: number;
  Cas: number;
  dRe: number;
  Pg: number;
  /** the mass-line reference, dB */
  ref: number;
  dIm: Float64Array;
  band: number[];
}
export function subCircuit(ts: SubTS, volts: number, band: readonly number[]): SubCircuit {
  const Sd = ts.Sd / 10000,
    Mms = ts.Mms / 1000;
  const Cms = 1 / (Math.pow(2 * Math.PI * ts.Fs, 2) * Mms);
  const Mas = Mms / (Sd * Sd);
  const Cas = Cms * Sd * Sd;
  const Ras = (2 * Math.PI * ts.Fs * Mms) / ts.Qms / (Sd * Sd);
  const Rae = (ts.Bl * ts.Bl) / ts.Re / (Sd * Sd);
  return {
    ts,
    volts,
    Sd,
    Mas,
    Cas,
    dRe: Ras + Rae,
    Pg: (volts * ts.Bl) / (ts.Re * Sd),
    ref: 20 * Math.log10((RHO * volts * ts.Bl * Sd) / (2 * Math.PI * ts.Re * Mms) / 2e-5),
    dIm: GRID.map((f) => {
      const w = 2 * Math.PI * f;
      return w * Mas - 1 / (w * Cas);
    }),
    band: bandIndices(band),
  };
}

/**
 * What a sub design reads off its curve (one sub, net volume, tuning and highpass): F3, the lowest level over the
 * output band, the peak excursion as a share of Xmax, the peak port air speed times the vent area (m/s · m²), and the
 * level at the grid points nearest each lower crossover — all at the circuit's voltage, before any limit.
 */
export interface CurveSummary {
  f3: number;
  bandMin: number;
  xmaxPct: number;
  velArea: number;
  xoSpl: number[];
}

// scratch arrays for one curve (raw level, excursion and port flow before the highpass)
const RAW = new Float64Array(N),
  XA = new Float64Array(N),
  KA = new Float64Array(N);
/**
 * The vented box's curve for a net volume (L) and tuning (Hz), summarised per highpass: the same circuit, in the same
 * arithmetic, as boxModel. `xoIdx` are the grid points nearest the lower crossovers.
 */
export function ventedCurves(
  c: SubCircuit,
  VbL: number,
  Fb: number,
  hps: readonly HighpassTable[],
  xoIdx: readonly number[],
): CurveSummary[] {
  const Vb = VbL / 1000;
  const Cab = Vb / (RHO * C * C);
  // the port's acoustic mass for this tuning: ρ·Leff/Sp with Leff/Sp = c²/((2πFb)²·Vb)
  const Map = (RHO * C * C) / ((2 * Math.PI * Fb) ** 2 * Vb);
  const Ral = 7 / (2 * Math.PI * Fb * Cab);
  const Rap = (2 * Math.PI * Fb * Map) / 50;
  const { dRe, Pg, Sd } = c;
  for (let i = 0; i < N; i++) {
    const f = GRID[i],
      w = 2 * Math.PI * f;
    const dIm = c.dIm[i];
    const pIm = w * Map,
      pM = Rap * Rap + pIm * pIm,
      ypRe = Rap / pM,
      ypIm = -pIm / pM;
    const yRe = ypRe + 1 / Ral,
      yIm = ypIm + w * Cab,
      yM = yRe * yRe + yIm * yIm;
    const bRe = yRe / yM,
      bIm = -yIm / yM;
    const tRe = dRe + bRe,
      tIm = dIm + bIm,
      tM = tRe * tRe + tIm * tIm;
    const uRe = (Pg * tRe) / tM,
      uIm = (-Pg * tIm) / tM;
    const vRe = uRe * bRe - uIm * bIm,
      vIm = uRe * bIm + uIm * bRe;
    const pv = Math.sqrt(vRe * vRe + vIm * vIm),
      Ud = Math.sqrt(uRe * uRe + uIm * uIm);
    const Up = pv / Math.sqrt(pM);
    const Ut = pv * w * Cab;
    const p = (RHO * w * Ut) / (2 * Math.PI);
    RAW[i] = 20 * Math.log10(p / 2e-5);
    XA[i] = Math.SQRT2 * (Ud / (w * Sd));
    KA[i] = Math.SQRT2 * Up;
  }
  const at3 = c.ref - 3;
  return hps.map(({ gain, db }) => {
    // F3: the first point at or above the reference less 3 dB, else the last (boxModel's find)
    let f3i = -1,
      peakX = -Infinity,
      peakK = -Infinity;
    for (let i = 0; i < N; i++) {
      if (f3i < 0 && RAW[i] + db[i] >= at3) f3i = i;
      const x = XA[i] * gain[i] * 1000,
        k = KA[i] * gain[i];
      if (x > peakX) peakX = x;
      if (k > peakK) peakK = k;
    }
    let bandMin = Infinity;
    for (const i of c.band) if (RAW[i] + db[i] < bandMin) bandMin = RAW[i] + db[i];
    return {
      f3: GRID[f3i < 0 ? N - 1 : f3i],
      bandMin,
      xmaxPct: (peakX / c.ts.Xmax) * 100,
      velArea: peakK,
      xoSpl: xoIdx.map((i) => RAW[i] + db[i]),
    };
  });
}

/** A sub design's music limit from its curve and vent area (in²), as subwooferLimits computes it. */
export type SubLimit = Pick<SubLimits, "who" | "V" | "W">;
export function subLimitOf(
  s: CurveSummary,
  areaIn2: number,
  ts: SubTS,
  volts: number,
  portMax: number,
): SubLimit {
  const peakVel = s.velArea / (areaIn2 * 0.00064516);
  const vp = (volts * portMax) / peakVel,
    vx = (volts * 100) / s.xmaxPct,
    vt = thermalVoltageLimit(ts.aes);
  const L = Math.min(vp, vx, vt, volts);
  return {
    who: L === vp ? "port" : L === vx ? "Xmax" : L === vt ? "thermal" : "amp",
    V: L,
    W: (L * L) / 8,
  };
}
/** The vent area (in²) at and above which the port no longer sets a curve's music limit (it is the same above it). */
export function portFreeArea(s: CurveSummary, ts: SubTS, volts: number, portMax: number) {
  const other = Math.min((volts * 100) / s.xmaxPct, thermalVoltageLimit(ts.aes), volts);
  return (s.velArea * other) / (volts * portMax) / 0.00064516;
}
/** The clean output (bandOutputDb) at a music limit. */
export const outputAt = (s: CurveSummary, lim: Pick<SubLimit, "V">, volts: number) =>
  s.bandMin + 20 * Math.log10(lim.V / volts);
/** The sub at its music limit through the lowpass at a crossover (subMusicOutputAt), from the curve's level there. */
export const musicAt = (
  splAtXo: number,
  fAtXo: number,
  xoLo: number,
  order: CrossoverOrder,
  lim: Pick<SubLimit, "V">,
  volts: number,
) =>
  splAtXo +
  20 * Math.log10(linkwitzRileyLowpass(fAtXo, xoLo, order)) +
  20 * Math.log10(lim.V / volts);

/** What the mid's bracing reads beyond the box (midBoxBracing): the layout and the style. */
export type MidBrace = Pick<MidSystemConfig, "layout" | "braceStyle">;
/** The mid in a sealed box, as midSystem and closedBox set it up: the driver's and the box's acoustic parts, and the system's resonance. */
function sealedBox(mid: MidDriver, box: Dims3, t: number, inset: number, brace: MidBrace) {
  const ts = mid.ts;
  const disp = ts.disp != null ? ts.disp : mid.size === 15 ? 4 : 2.5;
  const effL =
    midNetLiters(
      boxInternalLiters(box.w, box.h, box.d, t, inset),
      disp,
      midBoxBracing(box, t, inset, brace.layout, brace.braceStyle),
    ) * STUFFING_VOLUME_GAIN;
  const Sd = ts.Sd / 10000,
    Mms = ts.Mms / 1000,
    Vb = effL / 1000;
  const Cms = 1 / (Math.pow(2 * Math.PI * ts.Fs, 2) * Mms);
  const Mas = Mms / (Sd * Sd),
    Cas = Cms * Sd * Sd;
  const Cab = Vb / (RHO * C * C);
  const Ctot = (Cas * Cab) / (Cas + Cab);
  const Fc = 1 / (2 * Math.PI * Math.sqrt(Mas * Ctot));
  const Qes = (2 * Math.PI * ts.Fs * Mms * ts.Re) / (ts.Bl * ts.Bl);
  const Qts = (Qes * ts.Qms) / (Qes + ts.Qms);
  return { Sd, Mms, Mas, Cas, Cab, Fc, Qts };
}

/**
 * The mid's Qtc in a box, as midSystem and closedBox compute it (the same arithmetic). It falls as the box grows: the
 * box's compliance rises with its volume, so the resonance and with it the Qtc come down.
 */
export function sealedQtc(mid: MidDriver, box: Dims3, t: number, inset: number, brace: MidBrace) {
  const { Fc, Qts } = sealedBox(mid, box, t, inset, brace);
  return Qts * (Fc / mid.ts.Fs);
}

// the grid closedBox runs the mid on: 420 points from 20 Hz to 2 kHz, run on at the same spacing past the lowpass
const MID_N = 420,
  MID_F_MIN = 20,
  MID_F_MAX = 2000;
const midGridFrequency = (i: number) =>
  MID_F_MIN * Math.pow(MID_F_MAX / MID_F_MIN, i / (MID_N - 1));
/** The mid grid's index nearestPoint picks for a frequency, with the lowpass at `xoHi` (the first of two equally near). */
export const midGridIndexNear = (f: number, xoHi: number) => {
  const key = `${f}|${xoHi}`;
  let b = MID_NEAR.get(key);
  if (b === undefined) {
    const n = logGridCount(MID_N, MID_F_MIN, MID_F_MAX, LOWPASS_SKIRT_SPAN * xoHi);
    b = 0;
    for (let i = 1; i < n; i++)
      if (Math.abs(midGridFrequency(i) - f) < Math.abs(midGridFrequency(b) - f)) b = i;
    if (MID_NEAR.size > 1000) MID_NEAR.clear();
    MID_NEAR.set(key, b);
  }
  return b;
};
const MID_NEAR = new Map<string, number>();

/**
 * The mid in a sealed box as midSystem models it, read only where the search looks: its Qtc, its F3 when that is at or
 * under `f3Top` (else Infinity: above every crossover the search checks it against), and its signal and its
 * Xmax/thermal/amp-limited level at single grid points through the crossovers. The same arithmetic as closedBox and
 * maxOutputCurve, point by point (tests/pa-exact.test.ts checks it against midSystem).
 */
export interface SealedMid {
  Qtc: number;
  f3: number;
  /** the level at grid point `i` through the crossovers at `xoLo`/`xoHi`: the signal, and at the drive limit */
  at: (
    i: number,
    xoLo: number,
    xoHi: number,
    hpOrder: CrossoverOrder,
    lpOrder: CrossoverOrder,
  ) => { sig: number; max: number };
}
export function sealedMid(
  mid: MidDriver,
  box: Dims3,
  t: number,
  inset: number,
  mAmpW: number,
  f3Top: number,
  brace: MidBrace,
): SealedMid {
  const ts = mid.ts;
  const volts = Math.sqrt(mAmpW * 8);
  const { Sd, Mms, Mas, Cas, Cab, Fc, Qts } = sealedBox(mid, box, t, inset, brace);
  const Ras = (2 * Math.PI * ts.Fs * Mms) / ts.Qms / (Sd * Sd);
  const Rae = (ts.Bl * ts.Bl) / ts.Re / (Sd * Sd);
  const Pg = (volts * ts.Bl) / (ts.Re * Sd);
  const ref = 20 * Math.log10((RHO * volts * ts.Bl * Sd) / (2 * Math.PI * ts.Re * Mms) / 2e-5);
  // the cone's flow at a grid point
  const flow = (f: number) => {
    const w = 2 * Math.PI * f,
      zRe = Ras + Rae,
      zIm = w * Mas - 1 / (w * Cas) - 1 / (w * Cab),
      zM = zRe * zRe + zIm * zIm;
    return { w, U: Pg / Math.sqrt(zM) };
  };
  let f3 = Infinity;
  for (let i = 0; i < MID_N && midGridFrequency(i) <= f3Top; i++) {
    const f = midGridFrequency(i);
    const { w, U } = flow(f);
    if (20 * Math.log10((RHO * w * U) / (2 * Math.PI) / 2e-5) >= ref - 3) {
      f3 = f;
      break;
    }
  }
  const vt = thermalVoltageLimit(ts.aes);
  return {
    Qtc: Qts * (Fc / ts.Fs),
    f3,
    at: (i, xoLo, xoHi, hpOrder, lpOrder) => {
      const f = midGridFrequency(i);
      const { w, U } = flow(f);
      const g = linkwitzRileyHighpass(f, xoLo, hpOrder) * linkwitzRileyLowpass(f, xoHi, lpOrder);
      const raw = 20 * Math.log10((RHO * w * U) / (2 * Math.PI) / 2e-5);
      const sig = raw + 20 * Math.log10(g);
      const xmm = Math.SQRT2 * (U / (w * Sd)) * g * 1000;
      const V = Math.min(Infinity, (volts * ts.Xmax) / xmm, vt, volts);
      return { sig, max: sig + 20 * Math.log10(V / volts) };
    },
  };
}

// ---- geometry: the planner's vent geometry, duct volume and internal wood in closed form ----

/** A vent as the box model takes it: openings, area (in²), and its end correction in inches. */
export interface VentShape {
  n: number;
  area: number;
  ec: number;
}
/**
 * ventGeometry's openings, area and end correction. `folded` says whether a bottom slot folds up the back wall, and
 * `elbows` how many elbows round tubes take (by default, as the planner builds them: a slot folds when it is too long to
 * run straight, a tube takes the fewest elbows that fit); a solver that looks for one way's length passes it. `most`
 * takes the end correction at the most it can be in this box, whatever the duct's length (a bound for a search that
 * hasn't cut the duct yet).
 */
export function ventShape(
  style: PortStyle,
  box: Dims3,
  v: VentSpec,
  t: number,
  drv: TubeDriver,
  {
    folded = style === "slots" && slotFolds(box, v, t),
    elbows,
    most = false,
  }: { folded?: boolean; elbows?: ElbowCount; most?: boolean } = {},
): VentShape {
  const iw = box.w - 2 * t,
    ih = box.h - 2 * t;
  if (style === "vslots" || style === "vslot1") {
    const n = style === "vslot1" ? 1 : 2;
    return {
      n,
      area: n * v.throat * (ih - 2 * ductDividerIn(v)),
      ec: sideDuctEndCorrection(box, v, t, n, most),
    };
  }
  if (style === "slots")
    return {
      n: 1,
      area: v.slotH * (iw - 2 * t),
      ec:
        rectangleEndCorrection(2 * v.slotH, iw - 2 * t) +
        slotInnerEndCorrection(box, v, t, folded, most),
    };
  const r = v.dia / 2;
  return {
    n: v.nt,
    area: v.nt * Math.PI * r * r,
    // the most a tube's correction can be: straight, its mouth as close to the back wall as the correction reads
    ec: most
      ? subTubeEndCorrection(box, style, { ...v, len: 1e9 }, t, drv, 0)
      : subTubeEndCorrection(box, style, v, t, drv, elbows),
  };
}
/** The effective length (m) a vent needs for a tuning in a net volume (ventTuning solved for Leff). */
export const effectiveLengthFor = (areaIn2: number, VbL: number, Fb: number) =>
  ((areaIn2 * 0.00064516) / (VbL / 1000)) * (C / (2 * Math.PI * Fb)) ** 2;
/** The duct length (in) that gives an effective length (m): ventTuning's Leff less the end correction. */
export const ductLengthFor = (vs: VentShape, Leff: number) => Leff / 0.0254 - vs.ec;

/**
 * The sub box's internal wood (internalWoodLiters of cutParts' sub panels), in³: baffle cleats, window braces and ribs
 * (subBoxBracing) and the duct's own panels, in the same order.
 */
export function subWoodIn3(
  style: PortStyle,
  box: Dims3,
  t: number,
  inset: number,
  v: VentSpec,
  braceStyle: BraceStyleId | undefined,
): number {
  const iw = box.w - 2 * t,
    ih = box.h - 2 * t;
  const band = style === "slots" ? v.slotH + t : 0;
  let in3 = 0.75 * iw * 0.75 * 2 + 0.75 * (ih - band - 1.5) * 0.75 * 2;
  const b = subBoxBracing(box, t, inset, style, v, braceStyle);
  in3 += b.windowIn3 + b.ribIn3;
  if (style === "slots") {
    const folded = slotFolds(box, v, t);
    const len = folded ? foldedShelfIn(box, v.slotH, t) : v.len;
    in3 += iw * len * t + v.slotH * len * t * 2;
    if (folded) in3 += iw * foldedRearWallIn(box, v, t) * t;
  } else if (style === "vslots" || style === "vslot1") {
    const n = style === "vslot1" ? 1 : 2;
    in3 += ih * v.len * t * n + v.throat * v.len * ductDividerIn(v) * 2 * n;
  }
  return in3;
}
/** subGeometry's net volume (L) for a box and vent, with the vent's area. */
export const subNetLiters = (
  style: PortStyle,
  box: Dims3,
  t: number,
  inset: number,
  v: VentSpec,
  areaIn2: number,
  disp: number,
  braceStyle: BraceStyleId | undefined,
) =>
  Math.max(
    20,
    ((box.w - 2 * t) * (box.h - 2 * t) * (box.d - inset - 0.75 - t) * 16.387) / 1000 -
      disp -
      (areaIn2 * v.len * 16.387) / 1000 -
      (subWoodIn3(style, box, t, inset, v, braceStyle) * 16.387) / 1000,
  );

/**
 * One box to solve: the vent, plywood and baffle inset, the sub (its displacement, and its size and depth for round
 * tubes' layout and elbows), and the net volume and tuning it must give.
 */
export interface ShapeTarget {
  style: PortStyle;
  drv: TubeDriver;
  vent: VentSpec;
  t: number;
  inset: number;
  disp: number;
  VbL: number;
  Fb: number;
  /** absent: the plywood's default (`defaultBraceStyle`) */
  braceStyle?: BraceStyleId;
}
/** A solved box: its outside size, its duct length, and its vent's area (in²). */
export interface SolvedShape {
  box: Dims3;
  len: number;
  area: number;
}
/** The root of a rising `g` with g(a) <= 0 < g(b), by Illinois steps (regula falsi that halves a stale end). */
function illinoisRoot(g: (x: number) => number, a: number, b: number) {
  let ga = g(a),
    gb = g(b),
    side = 0;
  for (let j = 0; j < 100 && b - a > 1e-13 * Math.max(1, b); j++) {
    const x = (a * gb - b * ga) / (gb - ga);
    const gx = g(x);
    if (gx === 0) return x;
    if (gx > 0) {
      b = x;
      gb = gx;
      if (side === -1) ga /= 2;
      side = -1;
    } else {
      a = x;
      ga = gx;
      if (side === 1) gb /= 2;
      side = 1;
    }
  }
  return (a + b) / 2;
}
/**
 * The length round tubes need for an effective length `Leff` (m): the shortest root of len + ec(len) = Leff/0.0254 that
 * builds, trying the elbow counts fewest first, each inside its own span (the correction rises with the length there,
 * as the mouth nears the wall or lid it faces, and drops by the bend correction with each elbow, so a tuning can fall
 * between two counts' spans). With no count reaching it, the straight root (past the room), not `reached`, so a solver's
 * steps carry on.
 */
export function tubeLengthFor(
  style: PortStyle,
  box: Dims3,
  v: VentSpec,
  t: number,
  drv: TubeDriver,
  Leff: number,
): { len: number; reached: boolean } {
  const w = { ...v };
  const g = (e: ElbowCount) => (x: number) => {
    w.len = x;
    return x - ductLengthFor(ventShape(style, box, w, t, drv, { elbows: e }), Leff);
  };
  // each count over the lengths where the model takes it (ownSpans), fewest first
  for (const { e, span } of ownSpans(
    ELBOW_COUNTS.map((k) => subTubeSpan(box, style, w, t, drv, k)),
  )) {
    const ge = g(e),
      [a, b] = span;
    if (ge(b) < 0) continue; // even its longest tunes higher: more elbows
    if (ge(a) > 0) continue; // even its shortest tunes lower: the next count's bends may reach it
    return { len: illinoisRoot(ge, a, b), reached: true };
  }
  // the straight root: the correction is bounded (the wall's term by its value at a radius), so it lies under Leff plus
  // a diameter for each elbow's bend correction
  const g0 = g(0),
    hi = Leff / 0.0254 + MAX_ELBOWS * -SHARP_BEND_CORRECTION * v.dia + v.dia;
  return { len: g0(0) > 0 ? 0 : illinoisRoot(g0, 0, hi), reached: false };
}

/**
 * The box with two sides fixed whose third side (`free`) and duct length give exactly the target's net volume and
 * tuning: Newton steps on the free side, each with the duct length for the tuning at that size (the slot and side-duct
 * end corrections depend on the gap behind the duct, so the length is iterated with it). Null when it doesn't settle
 * (a box that can't hold the volume).
 */
export function solveShape(
  target: ShapeTarget,
  fixed: Dims3,
  free: keyof Dims3,
  start: number,
): SolvedShape | null {
  const { style, drv, t, inset, disp, VbL, Fb } = target;
  const box = { ...fixed, [free]: start };
  const v = { ...target.vent, len: 0 };
  const round = isRoundPort(style);
  let len = 0;
  let prev: { x: number; err: number } | null = null;
  for (let it = 0; it < 60; it++) {
    let unreached = false; // a bottom slot this size tunes neither straight nor folded
    // the duct length for the tuning at this size; where the end correction reads the gap behind the duct, the root of
    // len + ec(len) = Leff, which rises with the length (the correction can fall as the shelf's run grows, but never as
    // fast as the length: tests/pa-exact.test.ts). A bottom slot is solved straight first; only when that is longer
    // than the straight run holds does it fold.
    let vs = ventShape(style, box, v, t, drv, { folded: false, elbows: 0 });
    const Leff = effectiveLengthFor(vs.area, VbL, Fb);
    v.len = ductLengthFor(vs, Leff);
    if (round) {
      // round tubes: the shortest length that tunes it, over the elbow counts (tubeLengthFor)
      const tube = tubeLengthFor(style, box, v, t, drv, Leff);
      v.len = tube.len;
      unreached = !tube.reached;
      vs = ventShape(style, box, v, t, drv);
    } else {
      const g = (x: number) => {
        v.len = x;
        return x - ductLengthFor(ventShape(style, box, v, t, drv, { folded: false }), Leff);
      };
      // secant steps from the last length (the side moved a little, so the root did too), else from near Leff; the
      // bracketed steps below when they stray
      let warm = false;
      {
        let x0 = len > 0 ? len : (0.9 * Leff) / 0.0254,
          g0 = g(x0),
          x1 = x0 * (1 + 1e-4),
          g1 = g(x1);
        for (let j = 0; j < 20 && g1 !== g0; j++) {
          const x2 = x1 - (g1 * (x1 - x0)) / (g1 - g0);
          x0 = x1;
          g0 = g1;
          x1 = x2;
          g1 = g(x1);
          if (Math.abs(x1 - x0) <= 1e-13 * Math.max(1, Math.abs(x1))) {
            warm = x1 > 0 && x1 < Leff / 0.0254;
            break;
          }
        }
        if (warm) v.len = x1;
      }
      if (!warm) {
        // Illinois steps on [0, Leff]: the correction is never negative, so the root is under Leff
        if (g(0) > 0) return null; // too short a box behind the duct: no length tunes it
        v.len = illinoisRoot(g, 0, Leff / 0.0254);
      }
      const straightMax = maxStraightSlotIn(box, v.slotH, t);
      if (style === "slots" && v.len > straightMax) {
        // past the straight run it folds: the folded length's root (len + ec rises with the length here too). A fold
        // takes a different correction from the straight slot's at the back wall, so there can be tunings neither
        // reaches: none past the straight run. A size on the way there keeps the straight root so the steps carry on;
        // only a box that settles there has no duct for the target.
        const straightLen = v.len;
        const gf = (x: number) => {
          v.len = x;
          return x - ductLengthFor(ventShape(style, box, v, t, drv, { folded: true }), Leff);
        };
        unreached = gf(straightMax) >= 0;
        v.len = unreached ? straightLen : illinoisRoot(gf, straightMax, Leff / 0.0254);
      }
      vs = ventShape(style, box, v, t, drv);
    }
    len = v.len;
    const net =
      ((box.w - 2 * t) * (box.h - 2 * t) * (box.d - inset - 0.75 - t) * 16.387) / 1000 -
      disp -
      (vs.area * len * 16.387) / 1000 -
      subWoodIn3(style, box, t, inset, v, target.braceStyle) * IN3_TO_L;
    const err = VbL - net;
    if (Math.abs(err) <= 1e-11 * VbL)
      return unreached ? null : { box: { ...box }, len, area: vs.area };
    // the net volume's slope along the free side: the gross volume's at first (the wood and duct move far less), then
    // the secant through the last two sizes
    const secant = prev && (prev.err - err) / (box[free] - prev.x);
    const slope =
      secant && secant > 0
        ? secant
        : (free === "d"
            ? (box.w - 2 * t) * (box.h - 2 * t)
            : free === "h"
              ? (box.w - 2 * t) * (box.d - inset - 0.75 - t)
              : (box.h - 2 * t) * (box.d - inset - 0.75 - t)) * IN3_TO_L;
    if (!(slope > 0)) return null;
    prev = { x: box[free], err };
    box[free] += err / slope;
    if (!Number.isFinite(box[free]) || box[free] <= 2 * t + 1) return null;
  }
  return null;
}
