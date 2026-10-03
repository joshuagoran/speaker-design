// Hi-fi 2-way model: woofer (sealed or vented) + tweeter, active crossover, baffle step, placement, and the
// response at a listening position (off-axis, crossover lobing). Pure functions, no DOM.
import {
  boxModel,
  closedBox,
  ventTuning,
  ampVoltage,
  thermalVoltageLimit,
  keeleFrequency,
  plywoodLbPerSqFt,
  highpassGain,
  rectangleEndCorrection,
  ductEndCorrection2D,
} from "../pa/calc";
import type {
  BoxModelTS,
  Dims3,
  DispersionPlane,
  DriverLayout,
  FrequencyPoint,
  HifiChip,
  HifiConfig,
  HifiDesignState,
  HifiPort,
  HighpassType,
  HifiDispersionMap,
  HifiPlacement,
  RoundPort,
  SizedSlotPort,
  SlotPort,
  HifiSystem,
  HifiTweeter,
  HifiWoofer,
  ListenerGeometry,
  PanelMaterial,
  PassiveRadiator,
  PassiveRadiatorChoice,
  PortMemory,
  WooferMaxPoint,
  WooferPoint,
} from "../../types";
import { METERS_PER_FOOT } from "../../constants/units";
import { formatInches } from "../format";
import { edgeSegments, edgeRipple, type BafflePoint, type FieldPoint } from "./diffraction";
import { xmaxBandCurves } from "../xmax";

const C = 343,
  IN = 0.0254;

// ---- small complex helpers (local: the crossover sum needs phase) ----
export interface Complex {
  re: number;
  im: number;
}
const cm = (re: number, im = 0): Complex => ({ re, im });
const cmul = (a: Complex, b: Complex) => cm(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
const cadd = (a: Complex, b: Complex) => cm(a.re + b.re, a.im + b.im);
const cdiv = (a: Complex, b: Complex) => {
  const d = b.re * b.re + b.im * b.im;
  return cm((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d);
};
export const cabs = (a: Complex) => Math.hypot(a.re, a.im);
const cexp = (ph: number) => cm(Math.cos(ph), Math.sin(ph));

// Linkwitz-Riley low/high pass as complex transfer functions: LR(2n) = Butterworth(n) squared.
// order 4 (24 dB/oct) or 8 (48 dB/oct). The pair sums flat in magnitude and in phase.
function butter(s: Complex, n: number) {
  // normalised Butterworth denominator for n = 2 or 4
  if (n === 2) return cadd(cadd(cmul(s, s), cmul(cm(Math.SQRT2), s)), cm(1));
  const q1 = 2 * Math.cos((3 * Math.PI) / 8),
    q2 = 2 * Math.cos(Math.PI / 8);
  const a = cadd(cadd(cmul(s, s), cmul(cm(q1), s)), cm(1)),
    b = cadd(cadd(cmul(s, s), cmul(cm(q2), s)), cm(1));
  return cmul(a, b);
}
export function linkwitzRileyFilter(
  f: number,
  fc: number,
  order = 4,
  kind: "lp" | "hp" = "lp",
): Complex {
  const s = cm(0, f / fc),
    n = order / 2,
    d = butter(s, n),
    d2 = cmul(d, d);
  if (kind === "lp") return cdiv(cm(1), d2);
  let sn = cm(1);
  for (let i = 0; i < order; i++) sn = cmul(sn, s);
  return cdiv(sn, d2);
}

// ---- baffle step, placement, compensation (all magnitude shelves) ----
export const baffleStepF3 = (baffleWIn: number) => 115 / (baffleWIn * IN); // −3 dB point, Hz
// 0 dB well above f3, −6 dB well below (radiation from half space to full space)
export function baffleStepGain(f: number, baffleWIn: number) {
  const x = (0.707 * f) / baffleStepF3(baffleWIn);
  return 0.5 * Math.sqrt((1 + 4 * x * x) / (1 + x * x));
}
// DSP compensation: a low shelf of `db` at the same corner (costs that much headroom at low frequencies)
export function baffleStepCompensation(f: number, baffleWIn: number, db: number) {
  if (!db) return 1;
  const B = Math.pow(10, db / 20),
    x = (0.707 * f) / baffleStepF3(baffleWIn);
  return Math.sqrt((B * B + x * x) / (1 + x * x));
}
export const SPEAKER_PLACEMENTS: Record<HifiPlacement, { name: string; db: number }> = {
  free: { name: "Free-standing", db: 0 },
  wall: { name: "Wall", db: 3 },
  corner: { name: "Corner", db: 6 },
};
// boundary reinforcement below ~ c / (4 · distance to the wall)
export function boundaryGain(f: number, place: HifiPlacement, wallM: number) {
  const db = (SPEAKER_PLACEMENTS[place] || SPEAKER_PLACEMENTS.free).db;
  if (!db) return 1;
  const G = Math.pow(10, db / 20),
    x = f / (C / (4 * Math.max(0.1, wallM)));
  return Math.sqrt((G * G + x * x) / (1 + x * x));
}

// ---- directivity ----
// Bessel J1 (Numerical Recipes rational approximation)
function j1(x: number) {
  const ax = Math.abs(x);
  if (ax < 8) {
    const y = x * x;
    const a =
      x *
      (72362614232 +
        y *
          (-7895059235 +
            y * (242396853.1 + y * (-2972611.439 + y * (15704.4826 + y * -30.16036606)))));
    const b =
      144725228442 +
      y * (2300535178 + y * (18583304.74 + y * (99447.43394 + y * (376.9991397 + y))));
    return a / b;
  }
  const z = 8 / ax,
    y = z * z,
    xx = ax - 2.356194491;
  const p =
    1 + y * (0.183105e-2 + y * (-0.3516396496e-4 + y * (0.2457520174e-5 + y * -0.240337019e-6)));
  const q =
    0.04687499995 +
    y * (-0.2002690873e-3 + y * (0.8449199096e-5 + y * (-0.88228987e-6 + y * 0.105787412e-6)));
  const v = Math.sqrt(0.636619772 / ax) * (Math.cos(xx) * p - z * Math.sin(xx) * q);
  return x < 0 ? -v : v;
}
/** A rigid piston's pattern, 2·J1(x)/x, at x = ka·sin θ. */
export const pistonPattern = (x: number) => (x < 1e-6 ? 1 : Math.abs((2 * j1(x)) / x));
// rigid piston of radius a (m) in a baffle, off-axis by theta (rad): 2·J1(x)/x, x = ka·sin θ
export function pistonDirectivity(f: number, a: number, theta: number) {
  return pistonPattern(
    ((2 * Math.PI * f) / C) * a * Math.sin(Math.min(Math.abs(theta), Math.PI / 2)),
  );
}
/**
 * A waveguide's half coverage angles at `f`, radians, horizontal and vertical: its rated coverage above the mouth's
 * control frequency, wider below it.
 */
export function waveguideHalfAngles(
  f: number,
  covH: number,
  covV: number,
  mouthWIn: number,
  mouthHIn: number,
): [h: number, v: number] {
  const fh = keeleFrequency(covH, mouthWIn),
    fv = covV && mouthHIn ? keeleFrequency(covV, mouthHIn) : fh;
  const bh = Math.min(180, f >= fh ? covH : (covH * fh) / f),
    bv = Math.min(180, f >= fv ? covV || covH : ((covV || covH) * fv) / f);
  return [((bh / 2) * Math.PI) / 180, ((bv / 2) * Math.PI) / 180];
}
/** A waveguide's level (pressure) at `th`, `tv` radians off axis, given its half angles: −6 dB at the edges, −40 dB at most. */
export function waveguideGain(th: number, tv: number, [h, v]: [h: number, v: number]) {
  const db = -6 * ((th / h) ** 2 + (tv / v) ** 2);
  return Math.pow(10, Math.max(-40, db) / 20);
}
// waveguide: constant coverage (−6 dB at the edges) above the mouth's control frequency, wider below it
export function waveguideDirectivity(
  f: number,
  covH: number,
  covV: number,
  mouthWIn: number,
  mouthHIn: number,
  th: number,
  tv: number,
) {
  return waveguideGain(th, tv, waveguideHalfAngles(f, covH, covV, mouthWIn, mouthHIn));
}

/** Whether a tweeter has to be mounted on a waveguide or horn (a compression driver, or a dome made for one) rather than sit on the baffle. */
export const needsWaveguide = (t: Pick<HifiTweeter, "type" | "needsWaveguide">): boolean =>
  t.type === "compression" || !!t.needsWaveguide;

// ---- box ----
/** The fields the port length reads: a round port's `dia` and `elbows`, or a slot's `h`. */
export type PortGeometry =
  | Pick<RoundPort, "shape" | "dia" | "elbows">
  | (Pick<SlotPort, "shape" | "h"> & Pick<RoundPort, "elbows">);
// longest port (centerline, inches) that fits: straight front to back; one elbow turns it up (or down) the back wall,
// using at most half the inner height so it stays clear of the woofer; two elbows fold it back along the bottom or top
export function portMaxLength(dim: Dims3, wall: number, port: PortGeometry) {
  if (port.shape === "slot") return slotMaxLength(dim, wall, port);
  const D = dim.d - 2 * wall,
    H = dim.h - 2 * wall,
    dia = port.dia,
    e = port.elbows || 0;
  const straight = D - dia / 2 - 1;
  if (e === 0) return straight;
  const up = H / 2 - dia;
  return e === 1 ? D - dia - 1 + Math.max(0, up) : 2 * (D - dia - 1) + Math.max(0, up);
}
export const grossVolumeLiters = (d: Dims3, t: number) =>
  (Math.max(0, (d.w - 2 * t) * (d.h - 2 * t) * (d.d - 2 * t)) * 16.387) / 1e3;
export const portArea = (p: RoundPort | SizedSlotPort) =>
  p.shape === "slot" ? p.h * p.w : p.n * Math.PI * Math.pow(p.dia / 2, 2);
// Slot vent: a full-width letterbox along the bottom of the baffle, formed by a shelf, running straight back.
// Outer end flanged by the baffle; inner end opens into the box (height X, back wall L behind the mouth).
export const slotWidth = (dim: Dims3, wall: number) => dim.w - 2 * wall;
export function hifiSlotEndCorrection(
  dim: Dims3,
  wall: number,
  port: Pick<SizedSlotPort, "h" | "w" | "len">,
) {
  const X = dim.h - 2 * wall - wall,
    L = dim.d - 2 * wall - port.len;
  return rectangleEndCorrection(port.h, port.w) + (0.61 / 0.85) * ductEndCorrection2D(port.h, X, L);
}
export const slotMaxLength = (dim: Dims3, wall: number, port: Pick<SlotPort, "h">) =>
  dim.d - 2 * wall - Math.max(port.h, 1); // leave the mouth's height behind it
const MDF_LB: Partial<Record<number, number>> = { 0.75: 3.4, 0.5: 2.3 };
export const panelWeightLb = (t: number, mat: PanelMaterial | undefined) =>
  mat === "mdf" ? (MDF_LB[t] ?? 3.4) : plywoodLbPerSqFt(t);
export function boxWeightLb(d: Dims3, t: number, mat: PanelMaterial | undefined) {
  const ft2 = (2 * (d.w * d.h + d.w * d.d + d.h * d.d)) / 144;
  return ft2 * panelWeightLb(t, mat);
}
// where the drivers sit (inches from the box bottom): tweeter near the top, woofer just below it;
// a freestanding waveguide sits on the box top, so the woofer moves up to the top of the baffle
export function driverLayout(
  w: HifiWoofer,
  t: HifiTweeter,
  d: Dims3,
  onTop: boolean,
): DriverLayout {
  const face = t.faceplate;
  if (onTop) {
    const th = d.h + face.h / 2,
      wh = d.h - 1 - w.size / 2;
    return { tweeterIn: th, wooferIn: wh, spacingIn: th - wh, onTop: true };
  }
  const th = d.h - 1 - face.h / 2;
  const wh = th - face.h / 2 - 0.5 - w.size / 2;
  return { tweeterIn: th, wooferIn: wh, spacingIn: th - wh };
}

// ---- passive radiator box ----
// The vented circuit with the port's air mass replaced by the radiator: its moving mass (plus added mass), its
// suspension compliance and its losses, n radiators in parallel. Box tuning Fb (where the cone barely moves):
// the radiator mass against the box and suspension stiffness together; the radiator's own resonance Fp, below
// Fb, puts a notch in the output. pr: { drv, n, addG }.
export function passiveRadiatorTuning(drv: PassiveRadiator, n: number, addG: number, VbL: number) {
  const rho = 1.18,
    c = 343,
    Sp = drv.Sd / 1e4;
  const Map = (drv.Mms + (addG || 0)) / 1000 / (Sp * Sp) / n,
    Cap = (drv.Cms / 1000) * Sp * Sp * n,
    Cab = VbL / 1000 / (rho * c * c);
  return {
    Map,
    Cap,
    Cab,
    Fb: Math.sqrt((1 / Cap + 1 / Cab) / Map) / (2 * Math.PI),
    Fp: 1 / (2 * Math.PI * Math.sqrt(Map * Cap)),
  };
}
// radiators go on the back panel, stacked; each needs its size plus a little frame margin
export const passiveRadiatorShape = (drv: PassiveRadiator) =>
  drv.shape || { w: drv.size, h: drv.size };
export const passiveRadiatorFits = (
  dim: Dims3,
  wall: number,
  pr: Pick<PassiveRadiatorChoice, "drv" | "n">,
) => {
  const s = passiveRadiatorShape(pr.drv);
  return dim.w - 2 * wall >= s.w + 0.3 && dim.h - 2 * wall >= pr.n * (s.h + 0.5);
};
// added mass (g, 5 g steps, ≥ 0) that tunes the box to Fb; null if Fb is above the radiator's as-shipped tuning
export function passiveRadiatorMassFor(drv: PassiveRadiator, n: number, VbL: number, Fb: number) {
  const { Cap, Cab } = passiveRadiatorTuning(drv, n, 0, VbL),
    Sp = drv.Sd / 1e4;
  const Map = (1 / Cap + 1 / Cab) / Math.pow(2 * Math.PI * Fb, 2);
  const g = Map * n * Sp * Sp * 1000 - drv.Mms;
  return g < -2.5 ? null : Math.max(0, Math.round(g / 5) * 5);
}
export function passiveRadiatorBox(
  ts: BoxModelTS,
  VbL: number,
  pr: Pick<PassiveRadiatorChoice, "drv" | "n" | "addG">,
  hpf: number,
  volts: number,
  hpType: HighpassType = "BW24",
  opts: { QL?: number; N?: number; fmin?: number; fmax?: number } = {},
) {
  const { QL = 7, N = 420, fmin = 12, fmax = 300 } = opts;
  const { drv, n } = pr;
  if (!ts || !VbL || !drv || !n) return null;
  const rho = 1.18,
    Sd = ts.Sd / 1e4,
    Mms = ts.Mms / 1000;
  const Cms = 1 / (Math.pow(2 * Math.PI * ts.Fs, 2) * Mms);
  const Mas = Mms / (Sd * Sd),
    Cas = Cms * Sd * Sd;
  const Ras = (2 * Math.PI * ts.Fs * Mms) / ts.Qms / (Sd * Sd);
  const Rae = (ts.Bl * ts.Bl) / ts.Re / (Sd * Sd);
  const { Map, Cap, Cab, Fb, Fp } = passiveRadiatorTuning(drv, n, pr.addG, VbL);
  const Sp = drv.Sd / 1e4;
  const Rap = (2 * Math.PI * drv.Fs * (drv.Mms / 1000)) / (drv.Qms || 5) / (Sp * Sp) / n;
  const Ral = QL / (2 * Math.PI * Fb * Cab);
  const Pg = (volts * ts.Bl) / (ts.Re * Sd);
  const out = [];
  for (let i = 0; i < N; i++) {
    const f = fmin * Math.pow(fmax / fmin, i / (N - 1));
    const w = 2 * Math.PI * f,
      s = cm(0, w);
    const Zd = cadd(cm(Ras + Rae), cadd(cmul(s, cm(Mas)), cdiv(cm(1), cmul(s, cm(Cas)))));
    const Zc = cdiv(cm(1), cmul(s, cm(Cab)));
    const Zp = cadd(cadd(cmul(s, cm(Map)), cdiv(cm(1), cmul(s, cm(Cap)))), cm(Rap));
    const Zbox = cdiv(cm(1), cadd(cadd(cdiv(cm(1), Zc), cdiv(cm(1), Zp)), cm(1 / Ral)));
    const Ud = cdiv(cm(Pg), cadd(Zd, Zbox));
    const Up = cdiv(cmul(Ud, Zbox), Zp);
    const Ut = cdiv(cmul(Ud, Zbox), Zc); // radiated = cone - radiators - leak
    const hp = highpassGain(f, hpf, hpType);
    const raw = 20 * Math.log10((rho * w * cabs(Ut)) / (2 * Math.PI) / 2e-5);
    out.push({
      f,
      raw,
      spl: raw + 20 * Math.log10(hp),
      xmm: Math.SQRT2 * (cabs(Ud) / (w * Sd)) * hp * 1000,
      prx: Math.SQRT2 * (cabs(Up) / (w * Sp * n)) * hp * 1000,
    });
  }
  const ref = 20 * Math.log10((rho * volts * ts.Bl * Sd) / (2 * Math.PI * ts.Re * Mms) / 2e-5);
  const f3 = (out.find((o) => o.raw >= ref - 3) || out[out.length - 1]).f;
  return { curve: out, Fb, Fp, f3, ref };
}

// ---- the whole speaker ----
/** What the box models return that `hifiSystem` reads: a response curve and its F3 and level reference. */
interface BoxModel {
  curve: { f: number; spl: number; xmm: number; vel?: number; prx?: number }[];
  f3: number;
  ref: number;
}
// cfg: { box: "sealed"|"vented"|"radiator", pr: { drv, n, addG } (radiator), dim: {w,h,d} (in), wall (in), mat, port: {n, dia, len} (in), xo (Hz), order (4|8),
//        wAmpW, tAmpW, bsc (dB), place, wallFt, portMax (m/s), hpf (Hz, optional subsonic for vented), guide (waveguide or null) }
export function hifiSystem(w: HifiWoofer, t: HifiTweeter, cfg: HifiConfig): HifiSystem | null {
  const ts = w.ts,
    dim = cfg.dim,
    wall = cfg.wall || 0.75;
  const gross = grossVolumeLiters(dim, wall);
  // the port the model uses (a slot is one opening across the whole baffle), and the radiators, each only for its box
  const ventPort: RoundPort | SizedSlotPort | null =
    cfg.box !== "vented"
      ? null
      : cfg.port.shape === "slot"
        ? { ...cfg.port, n: 1, w: slotWidth(dim, wall) }
        : cfg.port;
  const pr = cfg.box === "radiator" && cfg.pr && cfg.pr.drv ? cfg.pr : null;
  const pA = ventPort ? portArea(ventPort) : 0;
  // the slot's shelf takes volume too
  const ec =
    ventPort && ventPort.shape === "slot" ? hifiSlotEndCorrection(dim, wall, ventPort) : undefined;
  const pVol = ventPort
    ? ((pA + (ventPort.shape === "slot" ? wall * ventPort.w : 0)) * ventPort.len * 16.387) / 1e3
    : 0;
  const disp = ts.disp != null ? ts.disp : Math.max(0.2, Math.pow(w.size / 6.5, 3) * 0.6);
  const net = Math.max(1, gross * 0.97 - disp - pVol); // 3% for bracing and damping
  const V = ampVoltage(cfg.wAmpW),
    order = cfg.order || 4,
    xo = cfg.xo;
  const opts = { fmin: 15, fmax: Math.max(2000, xo * 3), N: cfg.N || 240 };
  // a vented box unloads below its tuning; with DSP you'd highpass it there (default 0.75 × Fb, BW24)
  const hpf =
    cfg.hpf != null
      ? cfg.hpf
      : ventPort
        ? Math.round(0.75 * ventTuning(net, pA, ventPort.len, ventPort.n, ec).Fb)
        : pr
          ? Math.round(0.75 * passiveRadiatorTuning(pr.drv, pr.n, pr.addG, net).Fb)
          : null;
  const vM = ventPort
    ? boxModel(ts, net, pA, ventPort.len, hpf || 1, V, "BW24", {
        ...opts,
        nPorts: ventPort.n,
        ecIn: ec,
      })
    : null;
  const rM = pr ? passiveRadiatorBox(ts, net, pr, hpf || 1, V, "BW24", opts) : null;
  // lightly stuffed; an LR24 highpass, and no lowpass here (the crossover's is applied below)
  const sM =
    ventPort || pr
      ? null
      : closedBox(ts, net * 1.1, hpf || null, null, V, { ...opts, hpOrder: 4, lpOrder: order });
  const m: BoxModel | null = vM || rM || sM;
  if (!m) return null;
  const bw = dim.w,
    place = cfg.place || "free",
    wallM = (cfg.wallFt || 2) * 0.3048;
  const shelf = (f: number) => baffleStepGain(f, bw) * boundaryGain(f, place, wallM);
  const eq = (f: number) => baffleStepCompensation(f, bw, cfg.bsc || 0);

  // on-axis woofer response (small signal at the amp voltage) with baffle step, placement, EQ and the low-pass
  const woofer: WooferPoint[] = m.curve.map((o) => {
    const e = eq(o.f),
      g = shelf(o.f) * e,
      lp = cabs(linkwitzRileyFilter(o.f, xo, order, "lp"));
    return {
      f: o.f,
      spl: o.spl + 20 * Math.log10(g * lp),
      raw: o.spl + 20 * Math.log10(g),
      xmm: o.xmm * e * lp,
      vel: o.vel != null ? o.vel * e * lp : null,
      prx: o.prx != null ? o.prx * e * lp : null,
      e,
      lp,
    };
  });
  // per-frequency limits of the woofer with the EQ in the signal (the boosted drive can't pass the amp or the coil rating)
  const vT = thermalVoltageLimit(ts.aes || 100),
    portMax = cfg.portMax || 17;
  // at a woofer Xmax (its centre, or the ends of an estimated band for the chart's shading) and the radiator's limit
  const wMaxAt = (xW: number, xR: number): WooferMaxPoint[] =>
    woofer.map((o) => {
      const { e, lp } = o;
      const drive = V * e * lp; // volts at the terminals for full-scale input
      const sAmp = V / Math.max(1e-9, V * e),
        sTh = vT / Math.max(1e-9, drive),
        sX = xW / Math.max(1e-9, o.xmm);
      const sP = o.vel ? portMax / o.vel : Infinity,
        sR = o.prx && pr ? xR / o.prx : Infinity;
      const s = Math.min(sAmp, sTh, sX, sP, sR);
      return {
        f: o.f,
        spl: o.spl + 20 * Math.log10(s),
        who:
          s === sX
            ? "Xmax"
            : s === sP
              ? "port"
              : s === sR
                ? "radiator"
                : s === sTh
                  ? "thermal"
                  : "amp",
        s,
      };
    });
  const xR = pr ? pr.drv.Xmax : 0; // a radiator's limit is published, never a band
  const wMax = wMaxAt(ts.Xmax, xR);
  const wMaxBand = xmaxBandCurves(ts.xmax, (xW) => wMaxAt(xW, xR));
  // one scale for music (the worst case across the woofer's band), like the PA planner's music limit
  const band = wMax.filter((o) => o.f >= 30 && o.f <= xo * 1.5);
  const sMusic = Math.min(...band.map((o) => o.s)),
    whoW = band.reduce((a, o) => (o.s < a.s ? o : a)).who;

  // tweeter: sensitivity and power, derated below the frequency its rating assumes, then the high-pass
  const hf: Partial<HifiTweeter["hf"]> = t.hf || {};
  const imp = hf.imp || 8,
    tV = ampVoltage(cfg.tAmpW || 50);
  const pAmp = ((cfg.tAmpW || 50) * 8) / imp;
  const derate = hf.aesXo && xo < hf.aesXo ? Math.pow(xo / hf.aesXo, 2) : 1;
  const pProg = hf.aes ? 2 * hf.aes * derate : Infinity;
  const pMax = Math.min(pAmp, pProg);
  const tSens = hf.sens != null ? hf.sens + (cfg.guideGain || 0) : 90;
  // level match: the woofer's passband level at 2.83 V (on-axis, above the baffle step)
  const refW = m.ref - 20 * Math.log10(V / 2.83);
  const tSens283 = tSens + 10 * Math.log10(8 / imp);
  const trim = refW - tSens283; // dB applied to the tweeter in the DSP (usually negative)
  const tweeterAt = (f: number, volts: number) =>
    tSens283 +
    20 * Math.log10(volts / 2.83) +
    20 * Math.log10(cabs(linkwitzRileyFilter(f, xo, order, "hp")));
  // clean max level, flat target: the woofer's music level in its passband vs the tweeter's max (both at 1 m)
  const pb = woofer.filter((o) => o.f >= Math.max(150, bw * 0 + 150) && o.f <= xo / 1.4);
  const wLevel = (pb.length ? Math.min(...pb.map((o) => o.raw)) : m.ref) + 20 * Math.log10(sMusic);
  const tLevel = tSens + 10 * Math.log10(pMax);
  const maxLevel = Math.min(wLevel, tLevel);

  // in-room F3: small-signal response (baffle step, placement, EQ) against its own level at 200-500 Hz
  const refBand = woofer.filter((o) => o.f >= 200 && o.f <= 500);
  const ref = refBand.length ? refBand.reduce((a, o) => a + o.raw, 0) / refBand.length : m.ref;
  let f3 = woofer[woofer.length - 1].f;
  for (let i = woofer.length - 1; i >= 0; i--) {
    if (woofer[i].f > 500) continue;
    if (woofer[i].raw < ref - 3) {
      f3 = woofer[Math.min(woofer.length - 1, i + 1)].f;
      break;
    }
    f3 = woofer[i].f;
  }

  const lb =
    boxWeightLb(dim, wall, cfg.mat) +
    (w.lb || 5) +
    (t.lb || 1.5) +
    1 +
    (pr ? pr.n * ((pr.drv.lb || 0.75) + (pr.addG || 0) / 454) : 0);
  // the fewest elbows that fit the port's length (null: too long even with two)
  const portElbows = !ventPort
    ? 0
    : ventPort.shape === "slot"
      ? ventPort.len <= slotMaxLength(dim, wall, ventPort) + 1e-9
        ? 0
        : null
      : ([0, 1, 2].find(
          (e) => ventPort.len <= portMaxLength(dim, wall, { ...ventPort, elbows: e }) + 1e-9,
        ) ?? null);
  const portFits = !ventPort || portElbows != null;
  const lay = driverLayout(w, t, dim, !!(cfg.guide && cfg.guide.freestanding));
  const common = {
    gross,
    net,
    disp,
    pVol,
    pArea: pA,
    f3Box: m.f3,
    ref,
    refW,
    woofer,
    wMax,
    wMaxBand,
    sMusic,
    whoW,
    trim,
    tSens,
    tSens283,
    tLevel,
    wLevel,
    maxLevel,
    who: tLevel < wLevel ? ("tweeter" as const) : ("woofer" as const),
    pMax,
    derate,
    lb,
    portFits,
    portElbows,
    lay,
    f3,
    hpf,
    xo,
    order,
    bsF3: baffleStepF3(bw),
    tweeterAt,
    V,
  };
  if (vM && ventPort)
    return {
      ...common,
      kind: "vented",
      Fb: vM.Fb,
      slotW: ventPort.shape === "slot" ? ventPort.w : null,
      peakVel: Math.max(...woofer.map((o) => o.vel || 0)),
    };
  if (rM && pr)
    return {
      ...common,
      kind: "radiator",
      pr,
      prFits: passiveRadiatorFits(dim, wall, pr),
      Fb: rM.Fb,
      Fp: rM.Fp,
      peakVel: null,
    };
  if (sM) return { ...common, kind: "sealed", Qtc: sM.Qtc, peakVel: null };
  return null;
}

// ---- edge diffraction (see ./diffraction) ----
/** The furthest the tweeter can sit off the centre line, inches: its faceplate (or waveguide) stays on the flat baffle, a quarter inch inside where the roundover starts. */
export const tweeterOffsetMax = (
  cfg: Pick<HifiConfig, "dim" | "roundoverIn">,
  t: Pick<HifiTweeter, "faceplate">,
) => Math.max(0, (cfg.dim.w - t.faceplate.w) / 2 - (cfg.roundoverIn || 0) - 0.25);
/** The tweeter offset the model uses, inches (+ inward): the asked-for one, kept on the baffle; 0 for a waveguide on the box top. */
export function tweeterOffset(
  cfg: Pick<HifiConfig, "dim" | "roundoverIn" | "tweeterOffsetIn">,
  t: Pick<HifiTweeter, "faceplate">,
  lay: Pick<DriverLayout, "onTop">,
) {
  if (lay.onTop) return 0;
  const m = tweeterOffsetMax(cfg, t),
    x = cfg.tweeterOffsetIn || 0;
  return Math.max(-m, Math.min(m, x));
}
/** The listening point for `geo` in the baffle's inches (x across, + inward; y up from the box bottom; z out), on the axis of a driver at `x0` across. */
function fieldPoint(geo: ListenerGeometry, x0: number): FieldPoint {
  const d = geo.distM / IN,
    th = Math.min(Math.abs(geo.th), Math.PI / 2);
  return { x: x0 + (geo.side ?? 1) * d * Math.sin(th), y: geo.eyeIn, z: d * Math.cos(th) };
}
/**
 * Each driver's edge diffraction ripple for the listener at `geo`, as functions of frequency (a complex gain, 1 for
 * none). The tweeter's level toward the edges is its dome's (or waveguide's) at 90°, the woofer's its cone's; a
 * waveguide on the box top is off the baffle and gets none.
 */
function edgeRipples(
  sys: Pick<HifiSystem, "lay">,
  w: HifiWoofer,
  t: HifiTweeter,
  cfg: HifiConfig,
  geo: ListenerGeometry,
) {
  const r = cfg.roundoverIn || 0,
    a = Math.sqrt(w.ts.Sd / 1e4 / Math.PI),
    dome = (t.domeIn * IN) / 2,
    xT = tweeterOffset(cfg, t, sys.lay),
    guide = cfg.guide;
  const tSrc: BafflePoint = { x: xT, y: sys.lay.tweeterIn },
    wSrc: BafflePoint = { x: 0, y: sys.lay.wooferIn };
  const p = fieldPoint(geo, xT);
  const tSegs = sys.lay.onTop ? [] : edgeSegments(cfg.dim, tSrc, p),
    wSegs = edgeSegments(cfg.dim, wSrc, p);
  const kOf = (f: number) => (2 * Math.PI * f) / C;
  return {
    woofer: (f: number): Complex => {
      const g = pistonPattern(kOf(f) * a);
      const [re, im] = edgeRipple(wSegs, f, r, () => g);
      return cm(re, im);
    },
    tweeter: (f: number): Complex => {
      if (!tSegs.length) return cm(1);
      let toward: (ux: number, uy: number) => number;
      if (guide) {
        // the waveguide model puts −6 dB at its coverage edge; once that edge reaches 90° the baffle edge gets it all
        const half = waveguideHalfAngles(f, guide.covH, guide.covV, guide.w, guide.h);
        toward = (ux, uy) =>
          Math.min(
            1,
            2 * waveguideGain((Math.PI / 2) * Math.abs(ux), (Math.PI / 2) * Math.abs(uy), half),
          );
      } else {
        const g = pistonPattern(kOf(f) * dome);
        toward = () => g;
      }
      const [re, im] = edgeRipple(tSegs, f, r, toward);
      return cm(re, im);
    },
  };
}
/** The edge diffraction ripple alone, dB, for the listener at `geo` (on axis at 1 m by default): each driver's, summed through the crossover. */
export function hifiEdgeRipple(
  sys: Pick<HifiSystem, "lay">,
  w: HifiWoofer,
  t: HifiTweeter,
  cfg: HifiConfig,
  freqs: readonly number[],
  geo: ListenerGeometry = { th: 0, eyeIn: sys.lay.tweeterIn, distM: 1 },
): FrequencyPoint[] {
  const er = edgeRipples(sys, w, t, cfg, geo),
    order = cfg.order || 4;
  return freqs.map((f) => {
    const lp = linkwitzRileyFilter(f, cfg.xo, order, "lp"),
      hp = linkwitzRileyFilter(f, cfg.xo, order, "hp");
    const r = cdiv(cadd(cmul(lp, er.woofer(f)), cmul(hp, er.tweeter(f))), cadd(lp, hp));
    return { f, spl: 20 * Math.log10(cabs(r)) };
  });
}

// Response of one speaker at a point, relative to its on-axis response at 1 m; the DSP is time-aligned on the
// tweeter axis at the listening distance. Returns [{ f, spl }] at 2.83 V-equivalent level (1 m on-axis scale).
// Each driver's sound carries its baffle-edge diffraction at that point (roundover and tweeter offset from `cfg`).
// geo: { th (rad, horizontal off-axis), eyeIn (ear height above the box bottom, in), distM, side }
export function hifiResponseAt(
  sys: HifiSystem,
  w: HifiWoofer,
  t: HifiTweeter,
  cfg: HifiConfig,
  geo: ListenerGeometry,
  freqs = logSpacedFrequencies(60, 20000, 160),
): FrequencyPoint[] {
  const xo = cfg.xo,
    order = cfg.order || 4,
    a = Math.sqrt(w.ts.Sd / 1e4 / Math.PI);
  const dome = (t.domeIn * IN) / 2;
  const dist = geo.distM,
    dz = (h: number) => (geo.eyeIn - h) * IN;
  // the angle is measured on the tweeter's axis, which an offset moves off the woofer's (centred) one
  const xT = tweeterOffset(cfg, t, sys.lay) * IN,
    p = fieldPoint(geo, xT / IN),
    hW = Math.hypot(p.x * IN, p.z * IN), // woofer to listener, across the floor
    thW = Math.atan2(Math.abs(p.x * IN), p.z * IN);
  const rW = Math.hypot(hW, dz(sys.lay.wooferIn)),
    rT = Math.hypot(dist, dz(sys.lay.tweeterIn));
  const r0W = Math.hypot(Math.hypot(dist, xT), (sys.lay.tweeterIn - sys.lay.wooferIn) * IN),
    r0T = dist; // alignment point: tweeter axis
  const tvW = Math.atan2(dz(sys.lay.wooferIn), hW),
    tvT = Math.atan2(dz(sys.lay.tweeterIn), dist);
  const offW = Math.acos(Math.cos(thW) * Math.cos(tvW)),
    offT = Math.acos(Math.cos(geo.th) * Math.cos(tvT));
  const wAt = (f: number) => {
    const o = nearestF(sys.woofer, f);
    return Math.pow(10, (o.raw - 20 * Math.log10(sys.V / 2.83)) / 20);
  };
  const trimG = Math.pow(10, sys.trim / 20);
  const edges = edgeRipples(sys, w, t, cfg, geo);
  return freqs.map((f) => {
    const k = (2 * Math.PI * f) / C;
    const dW = pistonDirectivity(f, a, offW),
      dT = cfg.guide
        ? waveguideDirectivity(
            f,
            cfg.guide.covH,
            cfg.guide.covV,
            cfg.guide.w,
            cfg.guide.h,
            geo.th,
            tvT,
          )
        : pistonDirectivity(f, dome, offT);
    const pw = cmul(
      cmul(
        cmul(linkwitzRileyFilter(f, xo, order, "lp"), cm(wAt(f) * dW * (1 / rW))),
        cexp(-k * (rW - r0W)),
      ),
      edges.woofer(f),
    );
    const tOn = Math.pow(10, (sys.tSens283 + 20 * Math.log10(cabs(cm(1)))) / 20);
    const pt = cmul(
      cmul(
        cmul(linkwitzRileyFilter(f, xo, order, "hp"), cm(tOn * trimG * dT * (1 / rT))),
        cexp(-k * (rT - r0T)),
      ),
      edges.tweeter(f),
    );
    return { f, spl: 20 * Math.log10(Math.max(1e-9, cabs(cadd(pw, pt)))) };
  });
}
/** The seat relative to one speaker: the left one sits at -spacing/2 (`sign` -1), the right at +spacing/2 (1), each toed in toward the middle. */
export const listenerGeometry = (
  sign: -1 | 1,
  room: Pick<
    HifiDesignState,
    "speakerSpacingFt" | "listeningSeat" | "toeInDeg" | "earHeightIn" | "standHeightIn"
  >,
): ListenerGeometry => {
  const sx = (sign * room.speakerSpacingFt) / 2,
    vx = room.listeningSeat.x - sx,
    vy = room.listeningSeat.y,
    d = Math.hypot(vx, vy);
  const axis = (-sign * room.toeInDeg * Math.PI) / 180,
    ang = Math.atan2(vx, vy) - axis;
  return {
    th: Math.abs(ang),
    eyeIn: room.earHeightIn - room.standHeightIn,
    distM: d * METERS_PER_FOOT,
    // `ang` is + to the right of the axis; inward is right for the left speaker and left for the right one
    side: -sign * ang >= 0 ? 1 : -1,
  };
};

export const logSpacedFrequencies = (a: number, b: number, n: number) =>
  Array.from({ length: n }, (_, i) => a * Math.pow(b / a, i / (n - 1)));
const nearestF = (curve: WooferPoint[], f: number) => {
  let lo = 0,
    hi = curve.length - 1;
  if (f <= curve[0].f) return curve[0];
  if (f >= curve[hi].f) return curve[hi];
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (curve[mid].f < f) lo = mid;
    else hi = mid;
  }
  return f - curve[lo].f < curve[hi].f - f ? curve[lo] : curve[hi];
};

// Dispersion map: level vs angle and frequency, normalised to on-axis. plane "h" (horizontal, at the tweeter
// height, from the outside (−) to the inside (+) of the pair, so an offset tweeter's two sides both show) or "v"
// (vertical, from below to above the tweeter axis). Returns { angles, freqs, rows: [[dB]] }.
export function hifiDispersionMap(
  sys: HifiSystem,
  w: HifiWoofer,
  t: HifiTweeter,
  cfg: HifiConfig,
  plane: DispersionPlane = "h",
  distM = 2,
): HifiDispersionMap {
  const freqs = logSpacedFrequencies(100, 20000, 72);
  const angles =
    plane === "h"
      ? Array.from({ length: 37 }, (_, i) => -90 + i * 5)
      : Array.from({ length: 25 }, (_, i) => -60 + i * 5);
  const on = hifiResponseAt(sys, w, t, cfg, { th: 0, eyeIn: sys.lay.tweeterIn, distM }, freqs);
  const rows = angles.map((deg) => {
    const rad = (deg * Math.PI) / 180;
    const geo: ListenerGeometry =
      plane === "h"
        ? { th: Math.abs(rad), eyeIn: sys.lay.tweeterIn, distM, side: deg < 0 ? -1 : 1 }
        : { th: 0, eyeIn: sys.lay.tweeterIn + (Math.tan(rad) * distM) / IN, distM: distM };
    const r = hifiResponseAt(sys, w, t, cfg, geo, freqs);
    return r.map((o, i) => o.spl - on[i].spl);
  });
  return { angles, freqs, rows };
}

// ---- checks ----
export function hifiChips(
  sys: HifiSystem,
  w: HifiWoofer,
  t: HifiTweeter,
  cfg: HifiConfig,
): HifiChip[] {
  const F: HifiChip[] = [],
    xo = cfg.xo,
    hf: Partial<HifiTweeter["hf"]> = t.hf || {};
  const a = Math.sqrt(w.ts.Sd / 1e4 / Math.PI),
    ka = ((2 * Math.PI * xo) / C) * a;
  const beam = ka <= 2.2 ? 180 : (2 * Math.asin(2.2 / ka) * 180) / Math.PI;
  const tCov = cfg.guide ? cfg.guide.covH : 160;
  if (beam < Math.min(tCov, 180) * 0.75)
    F.push([
      "warn",
      "Woofer narrower than the tweeter at the crossover",
      `About ${Math.round(beam)}° against the tweeter's ${cfg.guide ? tCov + "°" : "wide dome"}: off-axis sound dips just below ${xo} Hz. A lower crossover or a smaller woofer meets it.`,
    ]);
  else
    F.push([
      "ok",
      "Dispersion matches at the crossover",
      `The woofer is about ${Math.round(beam)}° wide at ${xo} Hz.`,
    ]);
  if (hf.minXo && xo < hf.minXo)
    F.push([
      "warn",
      "Below the tweeter's minimum crossover",
      `${xo} Hz against ${hf.minXo} Hz recommended.`,
    ]);
  if (hf.fs && xo < 2 * hf.fs)
    F.push([
      "warn",
      "Close to the tweeter's resonance",
      `${xo} Hz is within an octave of its ${hf.fs} Hz resonance; distortion rises there.`,
    ]);
  if (w.fmax && xo > w.fmax)
    F.push([
      "warn",
      "Woofer past its usable range",
      `${w.name} is rated to about ${w.fmax} Hz; cross lower.`,
    ]);
  if (sys.kind === "sealed")
    F.push(
      sys.Qtc > 0.8
        ? ["warn", `Qtc ${sys.Qtc.toFixed(2)}`, "Peaky; the box is small for this woofer."]
        : sys.Qtc < 0.5
          ? ["warn", `Qtc ${sys.Qtc.toFixed(2)}`, "Overdamped; the box could be smaller."]
          : ["ok", `Qtc ${sys.Qtc.toFixed(2)}`, "Well damped."],
    );
  if (sys.kind === "vented" && sys.slotW != null && !sys.portFits) {
    F.push([
      "bad",
      "Slot too long",
      `${cfg.port.len.toFixed(1)}″ doesn't fit; this box holds about ${portMaxLength(cfg.dim, cfg.wall || 0.75, cfg.port).toFixed(1)}″, leaving the slot's height behind it. A shorter, lower slot tunes as low, or the box could be deeper.`,
    ]);
  } else if (sys.kind === "vented" && !sys.portFits) {
    const fits = portMaxLength(cfg.dim, cfg.wall || 0.75, { ...cfg.port, elbows: 2 });
    F.push([
      "bad",
      "Port too long",
      `${cfg.port.len.toFixed(1)}″ doesn't fit; even with two elbows this box holds about ${fits.toFixed(1)}″. A wider port tunes as low in less length, or the box could be deeper.`,
    ]);
  } else if (sys.kind === "vented" && sys.portElbows) {
    const e = sys.portElbows;
    F.push([
      "warn",
      `Port needs ${e === 1 ? "an elbow" : "two elbows"}`,
      `${cfg.port.len.toFixed(1)}″ is longer than a straight port fits (about ${portMaxLength(cfg.dim, cfg.wall || 0.75, { ...cfg.port, elbows: 0 }).toFixed(1)}″); ${e === 1 ? "one elbow turns it up the back wall" : "two elbows fold it along the back and the bottom"}.`,
    ]);
  }
  if (sys.kind === "radiator") {
    const p = sys.pr,
      vdW = w.ts.Sd * w.ts.Xmax,
      vdP = p.n * p.drv.Sd * p.drv.Xmax,
      k = vdP / vdW;
    if (!sys.prFits)
      F.push([
        "bad",
        "Radiators won't fit",
        `${p.n} on the back need about ${(passiveRadiatorShape(p.drv).w + 0.3 + 2 * (cfg.wall || 0.75)).toFixed(1)}″ of width and ${(p.n * (passiveRadiatorShape(p.drv).h + 0.5) + 2 * (cfg.wall || 0.75)).toFixed(1)}″ of height.`,
      ]);
    F.push(
      k < 1.5
        ? [
            "warn",
            "Radiators small for this woofer",
            `They can move ${k.toFixed(1)}× the woofer's air; 1.5–2× keeps them from running out first. Use a bigger or second radiator.`,
          ]
        : ["ok", "Radiators big enough", `They can move ${k.toFixed(1)}× the woofer's air.`],
    );
    if ((p.addG || 0) > 2 * p.drv.Mms)
      F.push([
        "warn",
        "Lots of added mass",
        `${p.addG} g on a ${p.drv.Mms} g cone; it may sag or rock. A bigger radiator or a bigger box tunes as low with less.`,
      ]);
  }
  const need = w.size + 0.8;
  if (cfg.dim.w < need)
    F.push([
      "bad",
      "Woofer won't fit",
      `A ${w.size}″ woofer needs about ${need.toFixed(1)}″ of baffle width.`,
    ]);
  const floor =
    sys.kind === "vented" && cfg.port.shape === "slot" ? cfg.port.h + (cfg.wall || 0.75) : 0; // the slot and its shelf along the bottom
  if (sys.lay.wooferIn - w.size / 2 < 0.5 + floor)
    F.push([
      "bad",
      "Drivers won't fit the baffle",
      `The woofer and tweeter${floor ? " above the slot" : ""} need about ${(cfg.dim.h - sys.lay.wooferIn + w.size / 2 + 0.5 + floor).toFixed(1)}″ of height.`,
    ]);
  const wall = cfg.wall || 0.75,
    round = cfg.roundoverIn || 0;
  if (round > wall + 1e-9)
    F.push([
      "warn",
      "Roundover deeper than the baffle",
      `A ${formatInches(round)} radius needs more than ${formatInches(wall)} stock: double the baffle up or glue hardwood strips along its edges to cut it in.`,
    ]);
  const offAsked = cfg.tweeterOffsetIn || 0;
  if (offAsked && sys.lay.onTop)
    F.push([
      "warn",
      "Tweeter offset ignored",
      "The waveguide sits on the box top, centred; the offset only applies to a tweeter on the baffle.",
    ]);
  else if (Math.abs(offAsked) > tweeterOffsetMax(cfg, t) + 1e-9)
    F.push([
      "warn",
      "Tweeter offset past the edge",
      `Its ${t.faceplate.w.toFixed(1)}″ faceplate fits at most ${tweeterOffsetMax(cfg, t).toFixed(2)}″ off centre on this baffle; the model uses that.`,
    ]);
  F.push(
    sys.who === "tweeter"
      ? [
          "warn",
          "Tweeter runs out first",
          `The tweeter tops out at ${sys.tLevel.toFixed(0)} dB, ${(sys.wLevel - sys.tLevel).toFixed(1)} dB below the woofer${sys.derate < 1 ? ` (derated for the ${xo} Hz crossover)` : ""}. A higher crossover or a more sensitive tweeter helps.`,
        ]
      : [
          "ok",
          "Woofer sets the level",
          `Tweeter has ${(sys.tLevel - sys.wLevel).toFixed(1)} dB to spare.`,
        ],
  );
  const whoText = {
    Xmax: "cone travel",
    port: "port air speed",
    radiator: "radiator travel",
    thermal: "the woofer's power rating",
    amp: "the amp",
  }[sys.whoW];
  F.push([
    sys.whoW === "amp" ? "ok" : "warn",
    `Woofer limited by ${whoText}`,
    `Clean up to ${sys.wLevel.toFixed(0)} dB at 1 m${cfg.bsc ? `, with ${cfg.bsc} dB of baffle-step boost` : ""}.`,
  ]);
  return F;
}

/**
 * The port after the "1 port / 2 ports / Slot" toggle: a new object with only the fields of the shape it switches to
 * (a round port has `dia` and `elbows`, a slot has `h`; both keep the length). The other shape's size comes from
 * `remembered`: the diameter the round port last had, the height the slot last had.
 */
export function portAfterToggle(
  p: HifiPort,
  to: number | "slot",
  remembered: PortMemory,
): HifiPort {
  if (to === "slot") {
    const slot: SlotPort = {
      shape: "slot",
      n: 1,
      h: p.shape === "slot" ? p.h : remembered.h,
      len: p.len,
    };
    return slot;
  }
  const round: RoundPort = {
    shape: "round",
    n: to,
    dia: p.shape === "slot" ? remembered.dia : p.dia,
    len: p.len,
  };
  if (p.shape !== "slot" && p.elbows !== undefined) round.elbows = p.elbows;
  return round;
}
