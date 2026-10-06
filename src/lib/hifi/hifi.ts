// Hi-fi 2-way model: woofer (sealed or vented) + tweeter, active crossover, baffle step, placement, and the
// response at a listening position (off-axis, crossover lobing). Pure functions, no DOM.
import {
  boxModel,
  butterworth,
  closedBox,
  ventTuning,
  ampVoltage,
  thermalVoltageLimit,
  keeleFrequency,
  highpassGain,
  rectangleEndCorrection,
  slotMouthCorrection,
  logGridCount,
} from "../pa/calc";
import { MAX_ELBOWS, tubeElbows, tubeMaxLength, type TubeRoom } from "../tubeFold";
import { SHARP_BEND_CORRECTION } from "../../data/acoustics/slot-inner-end";
import { panelLbPerSqFt } from "../panel";
import { PLYWOOD_MATERIAL } from "../../constants/panelSizes";
import { BIRCH_PLY_STIFFNESS, MDF_STIFFNESS, plateFirstModeHz } from "../bracing";
import type {
  BracePanelId,
  PanelResonance,
  BoxModelTS,
  CrossoverOrder,
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
  RadiatorPanel,
  SealedBoxModel,
  VentedBoxModel,
  WooferMaxPoint,
  WooferPoint,
} from "../../types";
import { METERS_PER_FOOT } from "../../constants/units";
import { WOOFER_LIMITED_BY } from "../../constants/limits";
import {
  DISPERSION_ANGLE_MAX_DEG,
  DISPERSION_ANGLE_STEP_DEG,
  DISPERSION_FREQ_POINTS,
  DISPERSION_FREQ_MAX_HZ,
  DISPERSION_FREQ_MIN_HZ,
} from "../../constants/chartScales";
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
export function linkwitzRileyFilter(
  f: number,
  fc: number,
  order = 4,
  kind: "lp" | "hp" = "lp",
): Complex {
  const s = cm(0, f / fc),
    n = order / 2,
    d = butterworth(s, n),
    d2 = cmul(d, d);
  if (kind === "lp") return cdiv(cm(1), d2);
  let sn = cm(1);
  for (let i = 0; i < order; i++) sn = cmul(sn, s);
  return cdiv(sn, d2);
}

// ---- baffle step, placement, compensation (magnitude shelves; the baffle step also with its phase) ----
export const baffleStepF3 = (baffleWIn: number) => 115 / (baffleWIn * IN); // −3 dB point, Hz
// 0 dB well above f3, −6 dB well below (radiation from half space to full space)
export function baffleStepGain(f: number, baffleWIn: number) {
  const x = (0.707 * f) / baffleStepF3(baffleWIn);
  return 0.5 * Math.sqrt((1 + 4 * x * x) / (1 + x * x));
}
// the same step with its phase: the first-order shelf 0.5 (1 + 2jx) / (1 + jx), whose magnitude is baffleStepGain
export function baffleStepShelf(f: number, baffleWIn: number): Complex {
  const x = (0.707 * f) / baffleStepF3(baffleWIn);
  return cdiv(cm(0.5, x), cm(1, x));
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
/**
 * The room a round port has (the PA sub's fold rule, lib/tubeFold): from the baffle front to the back wall, and up the
 * back wall half the inner height, so the riser and the leg the second elbow turns forward stay clear of the woofer;
 * that leg's mouth keeps its diameter of air from the baffle's inside face (the stop, a wall behind the front).
 */
export const hifiTubeRoom = (dim: Dims3, wall: number): TubeRoom => ({
  run: dim.d - wall,
  rise: (dim.h - 2 * wall) / 2,
  stop: wall,
});
// longest port (centerline, inches) that fits with up to `elbows` elbows (none when absent): straight front to back,
// a diameter short of the back wall; one elbow turns it up the back wall; two turn it forward again (lib/tubeFold)
export function portMaxLength(dim: Dims3, wall: number, port: PortGeometry) {
  if (port.shape === "slot") return slotMaxLength(dim, wall, port);
  return tubeMaxLength(
    hifiTubeRoom(dim, wall),
    port.dia,
    (port.elbows || 0) > 1 ? 2 : port.elbows ? 1 : 0,
  );
}
/**
 * A round port's end correction, inches per opening: the flanged and free ends' 1.46 r, and the sharp bend's
 * correction (SHARP_BEND_CORRECTION diameters) for each elbow it takes.
 */
export const hifiRoundEndCorrection = (port: Pick<RoundPort, "dia">, elbows: number) =>
  1.46 * (port.dia / 2) + elbows * SHARP_BEND_CORRECTION * port.dia;
export const grossVolumeLiters = (d: Dims3, t: number) =>
  (Math.max(0, (d.w - 2 * t) * (d.h - 2 * t) * (d.d - 2 * t)) * 16.387) / 1e3;
export const portArea = (p: RoundPort | SizedSlotPort) =>
  p.shape === "slot" ? p.h * p.w : p.n * Math.PI * Math.pow(p.dia / 2, 2);
// Slot vent: a full-width letterbox along the bottom of the baffle, formed by a shelf (wall ply), running straight back.
// Outer end flanged by the baffle; inner end opens into the box (its inside height across the mouth, the back wall
// behind it, the box open over the shelf), as the PA sub's bottom slot (slotMouthCorrection).
export const slotWidth = (dim: Dims3, wall: number) => dim.w - 2 * wall;
export function hifiSlotEndCorrection(
  dim: Dims3,
  wall: number,
  port: Pick<SizedSlotPort, "h" | "w" | "len">,
) {
  const X = dim.h - 2 * wall,
    L = dim.d - 2 * wall - port.len;
  return rectangleEndCorrection(port.h, port.w) + slotMouthCorrection(port.h, X, L, wall, port.len);
}
export const slotMaxLength = (dim: Dims3, wall: number, port: Pick<SlotPort, "h">) =>
  dim.d - 2 * wall - Math.max(port.h, 1); // leave the mouth's height behind it
// lb/ft² at the wall's exact thickness (lib/panel); plywood when the material is absent
export const panelWeightLb = (t: number, mat: PanelMaterial | undefined) =>
  panelLbPerSqFt(t, mat ?? PLYWOOD_MATERIAL);
/**
 * The box's panels' first plate resonances (lib/bracing, the PA boxes' plate model), at the material's stiffness and
 * weight, unbraced. The Hi-fi box has no bracing rule: its woofer plays through every panel mode up to the tweeter
 * crossover, so no target like the PA's twice the sub-to-mid crossover exists, and the volume keeps its allowance for
 * bracing and damping (hifiBox). `hz` is the same as `bareHz`.
 */
export function hifiPanelResonances(
  dim: Dims3,
  t: number,
  mat: PanelMaterial | undefined,
): PanelResonance[] {
  const stock = {
    t,
    lbPerSqFt: panelWeightLb(t, mat),
    ...(mat === "mdf" ? MDF_STIFFNESS : BIRCH_PLY_STIFFNESS),
  };
  const w = dim.w - 2 * t,
    h = dim.h - 2 * t,
    d = dim.d - 2 * t;
  const spans: [BracePanelId, number, number][] = [
    ["sideL", d, h],
    ["sideR", d, h],
    ["top", w, d],
    ["bottom", w, d],
    ["back", w, h],
    ["baffle", w, h],
  ];
  return spans.map(([id, a, b]) => {
    const hz = plateFirstModeHz(a, b, stock);
    return { id, bareHz: hz, hz };
  });
}
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
/**
 * The panel the radiators go on: the back, stacked, each needing its size plus a little frame margin. The fit check
 * below sizes them against it, the front view draws them dashed (behind), and the cutlist puts their cutouts on it.
 */
export const RADIATOR_PANEL: RadiatorPanel = "back";
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
  opts: { QL?: number; N?: number; fmin?: number; fmax?: number; fTop?: number } = {},
) {
  const { QL = 7, N = 420, fmin = 12, fmax = 300, fTop } = opts;
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
  const count = logGridCount(N, fmin, fmax, fTop);
  for (let i = 0; i < count; i++) {
    const f = fmin * Math.pow(fmax / fmin, i / (N - 1));
    // the same circuit in plain real arithmetic (the optimizer runs this loop for every radiator box it tries):
    // Zd = Ras + Rae + j(w Mas - 1/(w Cas)); 1/Zc = j w Cab; Zp = Rap + j(w Map - 1/(w Cap)); Zbox = 1 / (1/Zc + 1/Zp + 1/Ral)
    const w = 2 * Math.PI * f;
    const dRe = Ras + Rae,
      dIm = w * Mas - 1 / (w * Cas);
    const pRe = Rap,
      pIm = w * Map - 1 / (w * Cap),
      pM = pRe * pRe + pIm * pIm;
    const yRe = pRe / pM + 1 / Ral,
      yIm = -pIm / pM + w * Cab,
      yM = yRe * yRe + yIm * yIm;
    const bRe = yRe / yM,
      bIm = -yIm / yM;
    const tRe = dRe + bRe,
      tIm = dIm + bIm,
      tM = tRe * tRe + tIm * tIm;
    const uRe = (Pg * tRe) / tM,
      uIm = (-Pg * tIm) / tM; // Ud = Pg / (Zd + Zbox)
    const vRe = uRe * bRe - uIm * bIm,
      vIm = uRe * bIm + uIm * bRe; // Ud Zbox
    const pv = Math.sqrt(vRe * vRe + vIm * vIm);
    const Ud = Math.sqrt(uRe * uRe + uIm * uIm),
      Up = pv / Math.sqrt(pM), // |Ud Zbox / Zp|
      Ut = pv * w * Cab; // radiated = cone - radiators - leak: |Ud Zbox / Zc|
    const hp = highpassGain(f, hpf, hpType);
    const raw = 20 * Math.log10((rho * w * Ut) / (2 * Math.PI) / 2e-5);
    out.push({
      f,
      raw,
      spl: raw + 20 * Math.log10(hp),
      xmm: Math.SQRT2 * (Ud / (w * Sd)) * hp * 1000,
      prx: Math.SQRT2 * (Up / (w * Sp * n)) * hp * 1000,
    });
  }
  const ref = 20 * Math.log10((rho * volts * ts.Bl * Sd) / (2 * Math.PI * ts.Re * Mms) / 2e-5);
  const f3 = (out.find((o) => o.raw >= ref - 3) || out[out.length - 1]).f;
  return { curve: out, Fb, Fp, f3, ref };
}

// ---- the whole speaker ----
/** What the box models return that `hifiSystem` reads: a response curve and its F3 and level reference. */
interface BoxModel {
  curve: { f: number; spl: number; raw: number; xmm: number; vel?: number; prx?: number }[];
  f3: number;
  ref: number;
}
/** The fields of a design the box model reads (the crossover, tweeter and room come after it). */
export type HifiBoxConfig = Pick<
  HifiConfig,
  "box" | "port" | "pr" | "dim" | "wall" | "wAmpW" | "hpf" | "N"
>;
/** The woofer in its box, before the crossover, tweeter and room: volumes, the vent or radiators and the box's response. */
export interface HifiBox {
  gross: number;
  net: number;
  disp: number;
  pVol: number;
  pA: number;
  ventPort: RoundPort | SizedSlotPort | null;
  pr: PassiveRadiatorChoice | null;
  V: number;
  hpf: number | null;
  /** points 15 Hz-2 kHz; the curve runs on at the same spacing to fTop */
  N: number;
  vM: VentedBoxModel | null;
  rM: ReturnType<typeof passiveRadiatorBox>;
  sM: SealedBoxModel | null;
  m: BoxModel;
}
// the woofer's frequency grid: N points 15 Hz-2 kHz (about 92 per decade), run on at the same spacing to 3 × the
// crossover, so a box modeled once to the highest crossover reads exactly as it does at a lower one
const GRID = { fmin: 15, fmax: 2000, N: 196 };
export const hifiGridTop = (xo: number) => Math.max(GRID.fmax, xo * 3);
/** The port a vented box's model uses (a slot is one opening across the whole baffle); null for any other box. */
export const hifiVentPort = (
  cfg: Pick<HifiConfig, "box" | "port" | "dim" | "wall">,
): RoundPort | SizedSlotPort | null =>
  cfg.box !== "vented"
    ? null
    : cfg.port.shape === "slot"
      ? { ...cfg.port, n: 1, w: slotWidth(cfg.dim, cfg.wall || 0.75) }
      : cfg.port;
/** The box alone, its curve run to fTop (Hz): xo-independent, so one box serves every crossover. */
export function hifiBox(w: HifiWoofer, cfg: HifiBoxConfig, fTop: number): HifiBox | null {
  const ts = w.ts,
    dim = cfg.dim,
    wall = cfg.wall || 0.75;
  const gross = grossVolumeLiters(dim, wall);
  // the port the model uses, and the radiators, each only for its box
  const ventPort = hifiVentPort(cfg);
  const pr = cfg.box === "radiator" && cfg.pr && cfg.pr.drv ? cfg.pr : null;
  const pA = ventPort ? portArea(ventPort) : 0;
  // a slot's inner end reads the box; a round port's elbows shorten it acoustically (the fewest that fit; a port too
  // long for any is modeled with the most)
  const ec = !ventPort
    ? undefined
    : ventPort.shape === "slot"
      ? hifiSlotEndCorrection(dim, wall, ventPort)
      : hifiRoundEndCorrection(ventPort, hifiPortElbows(dim, wall, ventPort) ?? MAX_ELBOWS);
  // the slot's shelf takes volume too
  const pVol = ventPort
    ? ((pA + (ventPort.shape === "slot" ? wall * ventPort.w : 0)) * ventPort.len * 16.387) / 1e3
    : 0;
  const disp = ts.disp != null ? ts.disp : Math.max(0.2, Math.pow(w.size / 6.5, 3) * 0.6);
  const net = Math.max(1, gross * 0.97 - disp - pVol); // 3% for bracing and damping
  const V = ampVoltage(cfg.wAmpW),
    N = cfg.N || GRID.N;
  const opts = { fmin: GRID.fmin, fmax: GRID.fmax, N, fTop };
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
  // lightly stuffed; an LR24 highpass, and no lowpass here (the crossover's is applied in hifiSystemFromBox)
  const sM =
    ventPort || pr
      ? null
      : closedBox(ts, net * 1.1, hpf || null, null, V, { ...opts, hpOrder: 4, lpOrder: 4 });
  const m: BoxModel | null = vM || rM || sM;
  if (!m) return null;
  return { gross, net, disp, pVol, pA, ventPort, pr, V, hpf, N, vM, rM, sM, m };
}

// cfg: { box: "sealed"|"vented"|"radiator", pr: { drv, n, addG } (radiator), dim: {w,h,d} (in), wall (in), mat, port: {n, dia, len} (in), xo (Hz), order (4|8),
//        wAmpW, tAmpW, bsc (dB), place, wallFt, portMax (m/s), hpf (Hz, optional subsonic for vented), guide (waveguide or null) }
export function hifiSystem(w: HifiWoofer, t: HifiTweeter, cfg: HifiConfig): HifiSystem | null {
  const b = hifiBox(w, cfg, hifiGridTop(cfg.xo));
  return b && hifiSystemFromBox(b, w, t, cfg);
}

/** A tweeter's clean maximum level at 1 m: its sensitivity and power, derated below the frequency its rating assumes. */
export function tweeterMaxLevel(
  t: HifiTweeter,
  cfg: Pick<HifiConfig, "xo" | "tAmpW" | "guideGain">,
) {
  const hf: Partial<HifiTweeter["hf"]> = t.hf || {};
  const imp = hf.imp || 8;
  const pAmp = ((cfg.tAmpW || 50) * 8) / imp;
  const derate = hf.aesXo && cfg.xo < hf.aesXo ? Math.pow(cfg.xo / hf.aesXo, 2) : 1;
  const pProg = hf.aes ? 2 * hf.aes * derate : Infinity;
  const pMax = Math.min(pAmp, pProg);
  const tSens = hf.sens != null ? hf.sens + (cfg.guideGain || 0) : 90;
  return { imp, derate, pMax, tSens, tLevel: tSens + 10 * Math.log10(pMax) };
}
/** One speaker's weight, lb: the box, the drivers, a pound of hardware and the radiators with their added mass. */
export const hifiWeightLb = (
  w: HifiWoofer,
  t: HifiTweeter,
  cfg: Pick<HifiConfig, "dim" | "wall" | "mat">,
  pr: PassiveRadiatorChoice | null,
) =>
  boxWeightLb(cfg.dim, cfg.wall || 0.75, cfg.mat) +
  (w.lb || 5) +
  (t.lb || 1.5) +
  1 +
  (pr ? pr.n * ((pr.drv.lb || 0.75) + (pr.addG || 0) / 454) : 0);
/** The woofer clears the bottom of the baffle (and a slot with its shelf along the bottom) by half an inch. */
export const driversFitBaffle = (
  lay: Pick<DriverLayout, "wooferIn">,
  w: HifiWoofer,
  cfg: Pick<HifiConfig, "box" | "port" | "wall">,
) =>
  lay.wooferIn - w.size / 2 >=
  0.5 + (cfg.box === "vented" && cfg.port.shape === "slot" ? cfg.port.h + (cfg.wall || 0.75) : 0);
/** The crossover sits below the tweeter's recommended minimum. */
export const belowTweeterMinXo = (t: HifiTweeter, xo: number) =>
  !!(t.hf && t.hf.minXo && xo < t.hf.minXo);
/** The crossover sits within an octave of the tweeter's resonance. */
export const nearTweeterResonance = (t: HifiTweeter, xo: number) =>
  !!(t.hf && t.hf.fs && xo < 2 * t.hf.fs);

/**
 * The fewest elbows that fit a port's length (0 with no port; null: too long even with two, in a gap between two
 * counts' lengths, or a slot past the back).
 */
export function hifiPortElbows(
  dim: Dims3,
  wall: number,
  ventPort: RoundPort | SizedSlotPort | null,
): number | null {
  if (!ventPort) return 0;
  if (ventPort.shape === "slot")
    return ventPort.len <= slotMaxLength(dim, wall, ventPort) + 1e-9 ? 0 : null;
  return tubeElbows(hifiTubeRoom(dim, wall), ventPort.dia, ventPort.len);
}
/** The woofer fits the baffle's width. */
export const wooferFitsBaffle = (w: HifiWoofer, dim: Dims3) => dim.w >= w.size + 0.8;
/** The crossover sits above the woofer's usable range. */
export const wooferPastRange = (w: HifiWoofer, xo: number) => !!(w.fmax && xo > w.fmax);
/** A sealed box's Qtc between overdamped and peaky. */
export const qtcInRange = (Qtc: number) => Qtc >= 0.5 && Qtc <= 0.8;

/**
 * What the woofer's response reads per point without the crossover: the baffle step, placement and EQ (e, and the
 * level it adds, g in dB) on the box's grid, cached per baffle width and room, since many boxes share them.
 */
const shelfCache = new Map<string, { e: Float64Array; gDb: Float64Array }>();
function shelfOn(b: HifiBox, bw: number, bsc: number, place: HifiPlacement, wallM: number) {
  const c = b.m.curve,
    key = `${b.N}|${c.length}|${bw}|${bsc}|${place}|${wallM}`;
  let v = shelfCache.get(key);
  if (!v) {
    const e = new Float64Array(c.length),
      gDb = new Float64Array(c.length);
    for (let i = 0; i < c.length; i++) {
      const f = c[i].f;
      e[i] = baffleStepCompensation(f, bw, bsc);
      gDb[i] = 20 * Math.log10(baffleStepGain(f, bw) * boundaryGain(f, place, wallM) * e[i]);
    }
    if (shelfCache.size > 64) shelfCache.clear();
    shelfCache.set(key, (v = { e, gDb }));
  }
  return v;
}
// the crossover's low-pass gain on the shared grid, per crossover and slope
const lowpassCache = new Map<string, Float64Array>();
function lowpassOn(b: HifiBox, n: number, xo: number, order: CrossoverOrder) {
  const key = `${b.N}|${n}|${xo}|${order}`;
  let lp = lowpassCache.get(key);
  if (!lp) {
    lp = new Float64Array(n);
    for (let i = 0; i < n; i++) lp[i] = cabs(linkwitzRileyFilter(b.m.curve[i].f, xo, order, "lp"));
    if (lowpassCache.size > 64) lowpassCache.clear();
    lowpassCache.set(key, lp);
  }
  return lp;
}
/** The lowest of the driver's own limits at a point, and which it is (the cone's first, then port, radiators, coil). */
const driverLimit = (
  sTh: number,
  sX: number,
  sP: number,
  sR: number,
): { s: number; who: WooferMaxPoint["who"] } => {
  const s = Math.min(sTh, sX, sP, sR);
  return { s, who: s === sX ? "Xmax" : s === sP ? "port" : s === sR ? "radiator" : "thermal" };
};
/** The woofer on its baffle in the room, without the crossover: per point, its level and limits; and its in-room F3. */
export interface HifiWooferPrep {
  /** the small-signal level with baffle step, placement and EQ, dB */
  raw: Float64Array;
  /** the lowest of `raw` from 150 Hz up to each point (the passband level a crossover reads below its corner) */
  rawMin: Float64Array;
  /** the EQ's gain at each point, and the level the baffle step, placement and EQ add, dB */
  e: Float64Array;
  gDb: Float64Array;
  /** the scale the amp allows at each point (with the EQ in the signal) */
  sAmp: Float64Array;
  /**
   * the scales the driver's own limits allow before the low-pass: the coil rating, the cone per mm of Xmax, the port's
   * air speed and the radiators' travel (Infinity where there is none)
   */
  sTh: Float64Array;
  sX1: Float64Array;
  sP: Float64Array;
  sR: Float64Array;
  /** the lowest of those at the woofer's Xmax, and which it is */
  sDrv: Float64Array;
  who: WooferMaxPoint["who"][];
  /** the level at 200-500 Hz the in-room F3 is read against */
  ref: number;
  /** in-room F3, Hz (the crossover doesn't move it) */
  f3: number;
}
export function hifiWooferPrep(
  b: HifiBox,
  w: HifiWoofer,
  cfg: Pick<HifiConfig, "dim" | "bsc" | "place" | "wallFt" | "portMax">,
): HifiWooferPrep {
  const c = b.m.curve,
    n = c.length;
  const { e, gDb } = shelfOn(
    b,
    cfg.dim.w,
    cfg.bsc || 0,
    cfg.place || "free",
    (cfg.wallFt || 2) * 0.3048,
  );
  const V = b.V,
    vT = thermalVoltageLimit(w.ts.aes || 100),
    portMax = cfg.portMax || 17,
    pr = b.pr,
    xR = pr ? pr.drv.Xmax : 0;
  const raw = new Float64Array(n),
    rawMin = new Float64Array(n),
    sAmp = new Float64Array(n),
    sTh = new Float64Array(n),
    sX1 = new Float64Array(n),
    sP = new Float64Array(n),
    sR = new Float64Array(n),
    sDrv = new Float64Array(n),
    who: WooferMaxPoint["who"][] = [];
  let low = Infinity;
  for (let i = 0; i < n; i++) {
    const o = c[i],
      ei = e[i];
    raw[i] = o.spl + gDb[i];
    if (o.f >= 150 && raw[i] < low) low = raw[i];
    rawMin[i] = low;
    // per-frequency limits with the EQ in the signal (the boosted drive can't pass the amp or the coil rating); the
    // low-pass divides every one but the amp's
    sAmp[i] = V / Math.max(1e-9, V * ei);
    sTh[i] = vT / Math.max(1e-9, V * ei);
    sX1[i] = 1 / Math.max(1e-9, o.xmm * ei);
    sP[i] = o.vel ? portMax / (o.vel * ei) : Infinity;
    sR[i] = o.prx && pr ? xR / (o.prx * ei) : Infinity;
    const d = driverLimit(sTh[i], w.ts.Xmax * sX1[i], sP[i], sR[i]);
    sDrv[i] = d.s;
    who.push(d.who);
  }
  // in-room F3: small-signal response (baffle step, placement, EQ) against its own level at 200-500 Hz
  let sum = 0,
    cnt = 0;
  for (let i = 0; i < n; i++)
    if (c[i].f >= 200 && c[i].f <= 500) {
      sum += raw[i];
      cnt++;
    }
  const ref = cnt ? sum / cnt : b.m.ref;
  let f3 = c[n - 1].f;
  for (let i = n - 1; i >= 0; i--) {
    if (c[i].f > 500) continue;
    if (raw[i] < ref - 3) {
      f3 = c[Math.min(n - 1, i + 1)].f;
      break;
    }
    f3 = c[i].f;
  }
  return { e, gDb, raw, rawMin, sAmp, sTh, sX1, sP, sR, sDrv, who, ref, f3 };
}
/**
 * The woofer's clean music level at 1 m at one crossover: the worst-case scale across its band (30 Hz to 1.5 × the
 * crossover; the low-pass in the signal) on its passband level (the lowest from 150 Hz to the crossover / 1.4).
 */
export function hifiWooferLevel(
  b: HifiBox,
  p: HifiWooferPrep,
  cfg: Pick<HifiConfig, "xo" | "order">,
): {
  sMusic: number;
  whoW: WooferMaxPoint["who"];
  wLevel: number;
  /** the level the amp alone allows, and what cone, port, radiators and coil allow (the latter doesn't move with power) */
  ampDb: number;
  drvDb: number;
} {
  const c = b.m.curve,
    xo = cfg.xo,
    n = Math.min(c.length, logGridCount(b.N, GRID.fmin, GRID.fmax, hifiGridTop(xo)));
  const lp = lowpassOn(b, n, xo, cfg.order || 4);
  let sMusic = Infinity,
    whoW: WooferMaxPoint["who"] = "amp",
    minAmp = Infinity,
    minDrv = Infinity,
    pb = -1;
  for (let i = 0; i < n; i++) {
    const f = c[i].f;
    if (f <= xo / 1.4) pb = i;
    if (f < 30) continue;
    if (f > xo * 1.5) break;
    const d = p.sDrv[i] / Math.max(1e-9, lp[i]),
      a = p.sAmp[i];
    if (a < minAmp) minAmp = a;
    if (d < minDrv) minDrv = d;
    if (d <= a ? d < sMusic : a < sMusic) {
      sMusic = d <= a ? d : a;
      whoW = d <= a ? p.who[i] : "amp";
    }
  }
  const pass = pb >= 0 && p.rawMin[pb] < Infinity ? p.rawMin[pb] : b.m.ref;
  return {
    sMusic,
    whoW,
    wLevel: pass + 20 * Math.log10(sMusic),
    ampDb: pass + 20 * Math.log10(minAmp),
    drvDb: pass + 20 * Math.log10(minDrv),
  };
}

/**
 * The whole speaker on a box from hifiBox (modeled to at least this crossover's grid top, with the same box fields).
 * `band: false` leaves out the woofer's Xmax-band curves (the chart's shading), which nothing scores.
 */
export function hifiSystemFromBox(
  b: HifiBox,
  w: HifiWoofer,
  t: HifiTweeter,
  cfg: HifiConfig,
  { band: withBand = true } = {},
): HifiSystem | null {
  const ts = w.ts,
    dim = cfg.dim,
    wall = cfg.wall || 0.75;
  const { gross, net, disp, pVol, pA, ventPort, pr, V, hpf, vM, rM, sM } = b;
  const order = cfg.order || 4,
    xo = cfg.xo;
  // the box's curve up to this crossover's grid top, and its F3 read on that (as the box model reads it)
  const count = logGridCount(b.N, GRID.fmin, GRID.fmax, hifiGridTop(xo));
  const curve = b.m.curve.length > count ? b.m.curve.slice(0, count) : b.m.curve;
  const m: BoxModel = {
    curve,
    ref: b.m.ref,
    f3:
      (vM ? curve.find((o) => o.spl >= b.m.ref - 3) : curve.find((o) => o.raw >= b.m.ref - 3))?.f ??
      curve[curve.length - 1].f,
  };
  const bw = dim.w;
  // the woofer's per-point EQ, levels and limits (shared with the optimizer), and the crossover's low-pass
  const prep = hifiWooferPrep(b, w, cfg);
  const lps = lowpassOn(b, curve.length, xo, order);

  // on-axis woofer response (small signal at the amp voltage) with baffle step, placement, EQ and the low-pass
  const woofer: WooferPoint[] = m.curve.map((o, i) => {
    const e = prep.e[i],
      lp = lps[i];
    return {
      f: o.f,
      spl: prep.raw[i] + 20 * Math.log10(lp),
      raw: prep.raw[i],
      xmm: o.xmm * e * lp,
      vel: o.vel != null ? o.vel * e * lp : null,
      prx: o.prx != null ? o.prx * e * lp : null,
      e,
      lp,
    };
  });
  // the clean level at each point at a woofer Xmax (its center, or the ends of an estimated band for the chart's
  // shading): the amp's limit, or the driver's own divided by the low-pass, as the optimizer reads them
  const wMaxAt = (xW: number): WooferMaxPoint[] =>
    woofer.map((o, i) => {
      const d = driverLimit(prep.sTh[i], xW * prep.sX1[i], prep.sP[i], prep.sR[i]),
        dl = d.s / Math.max(1e-9, o.lp),
        a = prep.sAmp[i];
      const s = dl <= a ? dl : a;
      return { f: o.f, spl: o.spl + 20 * Math.log10(s), who: dl <= a ? d.who : "amp", s };
    });
  const wMax = wMaxAt(ts.Xmax);
  const wMaxBand = withBand ? xmaxBandCurves(ts.xmax, wMaxAt) : null;
  // one scale for music (the worst case across the woofer's band), like the PA planner's music limit
  const { sMusic, whoW, wLevel } = hifiWooferLevel(b, prep, cfg);

  // tweeter: sensitivity and power, derated below the frequency its rating assumes, then the high-pass
  const { imp, derate, pMax, tSens, tLevel } = tweeterMaxLevel(t, cfg);
  // level match: the woofer's passband level at 2.83 V (on-axis, above the baffle step)
  const refW = m.ref - 20 * Math.log10(V / 2.83);
  const tSens283 = tSens + 10 * Math.log10(8 / imp);
  const trim = refW - tSens283; // dB applied to the tweeter in the DSP (usually negative)
  const tweeterAt = (f: number, volts: number) =>
    tSens283 +
    20 * Math.log10(volts / 2.83) +
    20 * Math.log10(cabs(linkwitzRileyFilter(f, xo, order, "hp")));
  // clean max level, flat target: the woofer's music level in its passband vs the tweeter's max (both at 1 m)
  const maxLevel = Math.min(wLevel, tLevel);

  // in-room F3 (the crossover doesn't move it)
  const { ref, f3 } = prep;

  const lb = hifiWeightLb(w, t, cfg, pr);
  const portElbows = hifiPortElbows(dim, wall, ventPort);
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
/** The furthest the tweeter can sit off the center line, inches: its faceplate (or waveguide) stays on the flat baffle, a quarter inch inside where the roundover starts. */
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
    align = geo.alignM ?? dist,
    dz = (h: number) => (geo.eyeIn - h) * IN;
  // the angle is measured on the tweeter's axis, which an offset moves off the woofer's (centered) one
  const xT = tweeterOffset(cfg, t, sys.lay) * IN,
    p = fieldPoint(geo, xT / IN),
    hW = Math.hypot(p.x * IN, p.z * IN), // woofer to listener, across the floor
    thW = Math.atan2(Math.abs(p.x * IN), p.z * IN);
  const rW = Math.hypot(hW, dz(sys.lay.wooferIn)),
    rT = Math.hypot(dist, dz(sys.lay.tweeterIn));
  const r0W = Math.hypot(Math.hypot(align, xT), (sys.lay.tweeterIn - sys.lay.wooferIn) * IN),
    r0T = align; // alignment point: tweeter axis
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

/** The grid every dispersion map (PA and Hi-fi, both planes) is sampled on: −90..90° at one step, the dispersion frequency axis (50 Hz-20 kHz). */
export const dispersionGrid = (): Pick<HifiDispersionMap, "angles" | "freqs"> => ({
  angles: Array.from(
    { length: (2 * DISPERSION_ANGLE_MAX_DEG) / DISPERSION_ANGLE_STEP_DEG + 1 },
    (_, i) => -DISPERSION_ANGLE_MAX_DEG + i * DISPERSION_ANGLE_STEP_DEG,
  ),
  freqs: logSpacedFrequencies(
    DISPERSION_FREQ_MIN_HZ,
    DISPERSION_FREQ_MAX_HZ,
    DISPERSION_FREQ_POINTS,
  ),
});

/**
 * The listener on a vertical map's arc: `deg` above (+) or below (−) the axis of a source at `axisIn`, `distM` from it,
 * with the drivers still time-aligned on that axis at `distM`.
 */
export const verticalArcPoint = (deg: number, axisIn: number, distM: number): ListenerGeometry => {
  const rad = (deg * Math.PI) / 180;
  // at ±90° the cosine is not exactly 0, which keeps the listener just in front of the baffle
  return {
    th: 0,
    eyeIn: axisIn + (Math.sin(rad) * distM) / IN,
    distM: Math.cos(rad) * distM,
    alignM: distM,
  };
};
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

// Dispersion map: level vs angle and frequency, normalized to on-axis, on the shared grid (−90..90°, 50 Hz-20 kHz).
// plane "h" (horizontal, at the tweeter height, from the outside (−) to the inside (+) of the pair, so an offset
// tweeter's two sides both show) or "v" (vertical, on an arc from below to above the tweeter axis).
// Returns { angles, freqs, rows: [[dB]] }.
export function hifiDispersionMap(
  sys: HifiSystem,
  w: HifiWoofer,
  t: HifiTweeter,
  cfg: HifiConfig,
  plane: DispersionPlane = "h",
  distM = 2,
): HifiDispersionMap {
  const { angles, freqs } = dispersionGrid();
  const on = hifiResponseAt(sys, w, t, cfg, { th: 0, eyeIn: sys.lay.tweeterIn, distM }, freqs);
  const rows = angles.map((deg) => {
    const rad = (deg * Math.PI) / 180;
    const geo: ListenerGeometry =
      plane === "h"
        ? { th: Math.abs(rad), eyeIn: sys.lay.tweeterIn, distM, side: deg < 0 ? -1 : 1 }
        : verticalArcPoint(deg, sys.lay.tweeterIn, distM);
    const r = hifiResponseAt(sys, w, t, cfg, geo, freqs);
    return r.map((o, i) => o.spl - on[i].spl);
  });
  return { angles, freqs, rows, crossovers: [cfg.xo] };
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
      `About ${Math.round(beam)}° against the tweeter's ${cfg.guide ? tCov + "°" : "wide dome"}. Off-axis sound dips below ${xo} Hz. Use a lower crossover or a smaller woofer.`,
      "hifiDispersion",
    ]);
  else
    F.push([
      "ok",
      "Dispersion matches at the crossover",
      `The woofer is about ${Math.round(beam)}° wide at ${xo} Hz.`,
      "hifiDispersion",
    ]);
  if (belowTweeterMinXo(t, xo))
    F.push([
      "warn",
      "Below the tweeter's minimum crossover",
      `${xo} Hz, below the ${hf.minXo} Hz minimum.`,
      "hifiTweeterMinXo",
    ]);
  if (nearTweeterResonance(t, xo))
    F.push([
      "warn",
      "Close to the tweeter's resonance",
      `${xo} Hz is within an octave of its ${hf.fs} Hz resonance. Distortion increases there.`,
      "hifiTweeterResonance",
    ]);
  if (wooferPastRange(w, xo))
    F.push([
      "warn",
      "Woofer past its usable range",
      `${w.name} is rated to about ${w.fmax} Hz. Use a lower crossover.`,
      "hifiWooferRange",
    ]);
  if (sys.kind === "sealed")
    F.push(
      qtcInRange(sys.Qtc)
        ? ["ok", `Qtc ${sys.Qtc.toFixed(2)}`, "Well damped.", "hifiQtc"]
        : sys.Qtc > 0.8
          ? [
              "warn",
              `Qtc ${sys.Qtc.toFixed(2)}`,
              "Peaky. The box is small for this woofer.",
              "hifiQtc",
            ]
          : [
              "warn",
              `Qtc ${sys.Qtc.toFixed(2)}`,
              "Overdamped. A smaller box also works.",
              "hifiQtc",
            ],
    );
  if (sys.kind === "vented" && sys.slotW != null && !sys.portFits) {
    F.push([
      "bad",
      "Slot too long",
      `${cfg.port.len.toFixed(1)}″ does not fit. This box holds about ${portMaxLength(cfg.dim, cfg.wall || 0.75, cfg.port).toFixed(1)}″, with the slot's height clear behind it. Use a shorter, lower slot or a deeper box.`,
      "hifiSlotFit",
    ]);
  } else if (sys.kind === "vented" && !sys.portFits) {
    const fits = portMaxLength(cfg.dim, cfg.wall || 0.75, { ...cfg.port, elbows: 2 });
    F.push([
      "bad",
      "Port too long",
      cfg.port.len < fits
        ? `${cfg.port.len.toFixed(1)}″ is between the lengths that one elbow and two elbows fit (up to about ${fits.toFixed(1)}″). Make it shorter or longer.`
        : `${cfg.port.len.toFixed(1)}″ does not fit. With two elbows, this box holds about ${fits.toFixed(1)}″. A narrower port gets the same tuning in less length, but with higher air speed. A deeper box also works.`,
      "hifiPortFit",
    ]);
  } else if (sys.kind === "vented" && sys.portElbows) {
    const e = sys.portElbows;
    F.push([
      "warn",
      `Port needs ${e === 1 ? "an elbow" : "two elbows"}`,
      `${cfg.port.len.toFixed(1)}″ is longer than a straight port fits (about ${portMaxLength(cfg.dim, cfg.wall || 0.75, { ...cfg.port, elbows: 0 }).toFixed(1)}″). ${e === 1 ? "One elbow turns it up the back wall" : "Two elbows turn it up the back wall and forward again"}. Each elbow tunes it a little higher, so it is longer than a straight port.`,
      "hifiPortElbows",
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
        "hifiRadiatorFit",
      ]);
    F.push(
      k < 1.5
        ? [
            "warn",
            "Radiators small for this woofer",
            `They can move ${k.toFixed(1)}× the woofer's air. Use 1.5–2× so they do not reach their limit first. Use a bigger radiator or add a second.`,
            "hifiRadiatorSize",
          ]
        : [
            "ok",
            "Radiators big enough",
            `They can move ${k.toFixed(1)}× the woofer's air.`,
            "hifiRadiatorSize",
          ],
    );
    if ((p.addG || 0) > 2 * p.drv.Mms)
      F.push([
        "warn",
        "Lots of added mass",
        `${p.addG} g on a ${p.drv.Mms} g cone. The cone can sag or rock. A bigger radiator or box needs less mass for the same tuning.`,
        "hifiRadiatorMass",
      ]);
  }
  const need = w.size + 0.8;
  if (!wooferFitsBaffle(w, cfg.dim))
    F.push([
      "bad",
      "Woofer won't fit",
      `A ${w.size}″ woofer needs about ${need.toFixed(1)}″ of baffle width.`,
      "hifiWooferFit",
    ]);
  const floor =
    sys.kind === "vented" && cfg.port.shape === "slot" ? cfg.port.h + (cfg.wall || 0.75) : 0; // the slot and its shelf along the bottom
  if (!driversFitBaffle(sys.lay, w, cfg))
    F.push([
      "bad",
      "Drivers won't fit the baffle",
      `The woofer and tweeter${floor ? " above the slot" : ""} need about ${(cfg.dim.h - sys.lay.wooferIn + w.size / 2 + 0.5 + floor).toFixed(1)}″ of height.`,
      "hifiBaffleFit",
    ]);
  const wall = cfg.wall || 0.75,
    round = cfg.roundoverIn || 0;
  if (round > wall + 1e-9)
    F.push([
      "warn",
      "Roundover deeper than the baffle",
      `A ${formatInches(round)} radius needs more than ${formatInches(wall)} stock. Double the baffle, or glue hardwood strips along its edges.`,
      "hifiRoundover",
    ]);
  const offAsked = cfg.tweeterOffsetIn || 0;
  if (offAsked && sys.lay.onTop)
    F.push([
      "warn",
      "Tweeter offset ignored",
      "The waveguide is centered on the box top. The offset applies only to a tweeter on the baffle.",
      "hifiTweeterOffsetIgnored",
    ]);
  else if (Math.abs(offAsked) > tweeterOffsetMax(cfg, t) + 1e-9)
    F.push([
      "warn",
      "Tweeter offset past the edge",
      `Its ${t.faceplate.w.toFixed(1)}″ faceplate fits at most ${tweeterOffsetMax(cfg, t).toFixed(2)}″ off center on this baffle. The model uses that value.`,
      "hifiTweeterOffsetEdge",
    ]);
  F.push(
    sys.who === "tweeter"
      ? [
          "warn",
          "Tweeter reaches its limit first",
          `The tweeter reaches its limit at ${sys.tLevel.toFixed(0)} dB, ${(sys.wLevel - sys.tLevel).toFixed(1)} dB below the woofer${sys.derate < 1 ? ` (derated for the ${xo} Hz crossover)` : ""}. Use a higher crossover or a more sensitive tweeter.`,
          "hifiTweeterLevel",
        ]
      : [
          "ok",
          "Woofer sets the level",
          `Tweeter has ${(sys.tLevel - sys.wLevel).toFixed(1)} dB to spare.`,
          "hifiTweeterLevel",
        ],
  );
  F.push([
    sys.whoW === "amp" ? "ok" : "warn",
    `Woofer limited by ${WOOFER_LIMITED_BY[sys.whoW]}`,
    `Clean up to ${sys.wLevel.toFixed(0)} dB at 1 m${cfg.bsc ? `, with ${cfg.bsc} dB of baffle-step boost` : ""}.`,
    "hifiWooferLimit",
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
