// A woofer in its box: sealed, vented (a round port or a slot) or with passive radiators, the vent's end corrections
// and fold, the radiator box's response, and the Hi-fi box's subsonic and level. Pure functions, no DOM.
import { VENT_KIND } from "../../constants/speakerSpec";
import { ampVoltage, slotMouthCorrection, unwrapRawPhase } from "./boxModels";
import { highpassGain } from "../speaker/bandFilter";
import { rectangleEndCorrection } from "./radiation";
import { coilFactor, driverCircuit, midbandLevelDb } from "./driverCircuit";
import { portOfEffectiveLength, sourcePressureFactor, ventTuningHz } from "./hornModel";
import { CM2_PER_IN2, CM_PER_IN } from "../../constants/units";
import { AIR_DENSITY, SPEED_OF_SOUND, SPL_REFERENCE_PA } from "../../constants/acoustics";
import { MAX_ELBOWS, tubeElbows, type TubeRoom } from "../build/tubeFold";
import { SHARP_BEND_CORRECTION } from "../../data/acoustics/slot-inner-end";
import type {
  BoxModelTS,
  Dims3,
  HifiConfig,
  HighpassType,
  RoundPort,
  SizedSlotPort,
  SlotPort,
  HifiWoofer,
  PassiveRadiator,
  PassiveRadiatorChoice,
  RadiatorPanel,
} from "../../types";
/**
 * The room a round port has (the PA sub's fold rule, lib/build/tubeFold): from the baffle front to the back wall, and up the
 * back wall half the inner height, so the riser and the leg the second elbow turns forward stay clear of the woofer;
 * that leg's mouth keeps its diameter of air from the baffle's inside face (the stop, a wall behind the front).
 */
export const hifiTubeRoom = (dim: Dims3, wall: number): TubeRoom => ({
  run: dim.d - wall,
  rise: (dim.h - 2 * wall) / 2,
  stop: wall,
});
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
// ---- passive radiator box ----
// The vented circuit with the port's air mass replaced by the radiator: its moving mass (plus added mass), its
// suspension compliance and its losses, n radiators in parallel. Box tuning Fb (where the cone barely moves):
// the radiator mass against the box and suspension stiffness together; the radiator's own resonance Fp, below
// Fb, puts a notch in the output. pr: { drv, n, addG }.
export function passiveRadiatorTuning(drv: PassiveRadiator, n: number, addG: number, VbL: number) {
  const rho = AIR_DENSITY,
    c = SPEED_OF_SOUND,
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
 * below sizes them against it, the front view draws them dashed (behind), the 3D view on it (lib/build/boxLayout places
 * them for both), and the cutlist puts their cutouts on it.
 */
export const RADIATOR_PANEL: RadiatorPanel = "back";
export const passiveRadiatorShape = (drv: PassiveRadiator) =>
  drv.shape || { w: drv.size, h: drv.size };
export function passiveRadiatorBox(
  ts: BoxModelTS,
  VbL: number,
  pr: Pick<PassiveRadiatorChoice, "drv" | "n" | "addG">,
  hpf: number,
  volts: number,
  hpType: HighpassType = "BW24",
  opts: {
    QL?: number;
    N?: number;
    fmin?: number;
    fmax?: number;
    /** give each point the box's phase, `rawPhase` (the speaker model sums with it) */
    phase?: boolean;
  } = {},
) {
  const { QL = 7, N = 420, fmin = 12, fmax = 300, phase } = opts;
  const { drv, n } = pr;
  if (!ts || !VbL || !drv || !n) return null;
  // the driver's circuit (lib/acoustics/driverCircuit, shared with the horn engine)
  const { Sd, Mas, Cas, Ras, Rae, Pg } = driverCircuit(ts, volts);
  const { Map, Cap, Cab, Fb, Fp } = passiveRadiatorTuning(drv, n, pr.addG, VbL);
  const Sp = drv.Sd / 1e4;
  const Rap = (2 * Math.PI * drv.Fs * (drv.Mms / 1000)) / (drv.Qms || 5) / (Sp * Sp) / n;
  const Ral = QL / (2 * Math.PI * Fb * Cab);
  const out: {
    f: number;
    raw: number;
    spl: number;
    xmm: number;
    prx: number;
    rawPhase?: number;
  }[] = [];
  for (let i = 0; i < N; i++) {
    const f = fmin * Math.pow(fmax / fmin, i / (N - 1));
    // the same circuit in plain real arithmetic (the optimizer runs this loop for every radiator box it tries), the
    // coil's inductance on the motor as the horn engine takes it (k = Re/(Re + jωLe), exactly 1 without Le):
    // Zd = Ras + Rae·k + j(w Mas - 1/(w Cas)); 1/Zc = j w Cab; Zp = Rap + j(w Map - 1/(w Cap)); Zbox = 1 / (1/Zc + 1/Zp + 1/Ral)
    const w = 2 * Math.PI * f;
    const k = coilFactor(ts, w);
    const dRe = Ras + Rae * k.re,
      dIm = w * Mas - 1 / (w * Cas) + Rae * k.im;
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
    const gRe = Pg * k.re,
      gIm = Pg * k.im;
    const uRe = (gRe * tRe + gIm * tIm) / tM,
      uIm = (gIm * tRe - gRe * tIm) / tM; // Ud = Pg·k / (Zd + Zbox)
    const vRe = uRe * bRe - uIm * bIm,
      vIm = uRe * bIm + uIm * bRe; // Ud Zbox
    const pv = Math.sqrt(vRe * vRe + vIm * vIm);
    const Ud = Math.sqrt(uRe * uRe + uIm * uIm),
      Up = pv / Math.sqrt(pM), // |Ud Zbox / Zp|
      Ut = pv * w * Cab; // radiated = cone - radiators - leak: |Ud Zbox / Zc|
    const hp = highpassGain(f, hpf, hpType);
    // one box in half space (2π sr)
    const raw = 20 * Math.log10((sourcePressureFactor(w, 2 * Math.PI, 1) * Ut) / SPL_REFERENCE_PA);
    out.push({
      f,
      raw,
      spl: raw + 20 * Math.log10(hp),
      xmm: Math.SQRT2 * (Ud / (w * Sd)) * hp * 1000,
      prx: Math.SQRT2 * (Up / (w * Sp * n)) * hp * 1000,
      // the radiated pressure is jω × the flow into the box air, in phase with −Ud Zbox
      ...(phase && { rawPhase: Math.atan2(-vIm, -vRe) }),
    });
  }
  if (phase) unwrapRawPhase(out);
  const ref = midbandLevelDb(ts, volts);
  const f3 = (out.find((o) => o.raw >= ref - 3) || out[out.length - 1]).f;
  return { curve: out, Fb, Fp, f3, ref };
}

// ---- the whole speaker ----
/** The fields of a design the box reads (the crossover, tweeter and room come after it). */
export type HifiBoxConfig = Pick<
  HifiConfig,
  "box" | "port" | "pr" | "dim" | "wall" | "wAmpW" | "hpf" | "hp"
>;
/** The woofer in its box, before the crossover, tweeter and room: volumes, the vent or radiators and the filters. */
export interface HifiBox {
  gross: number;
  net: number;
  disp: number;
  pVol: number;
  pA: number;
  ventPort: RoundPort | SizedSlotPort | null;
  pr: PassiveRadiatorChoice | null;
  V: number;
  /** the subsonic high-pass, Hz (BW24); null for none, or when a high-pass to a sub at or above its corner takes its place */
  hpf: number | null;
  /** the high-pass to a sub in use (LR, `HifiConfig.hp`); null for none */
  hp: NonNullable<HifiConfig["hp"]> | null;
  /** the woofer's midband level at `V`, dB at 1 m in half space: its mass-controlled line (`midbandLevelDb`) */
  ref: number;
}
/** The port a vented box's model uses (a slot is one opening across the whole baffle); null for any other box. */
export const hifiVentPort = (
  cfg: Pick<HifiConfig, "box" | "port" | "dim" | "wall">,
): RoundPort | SizedSlotPort | null =>
  cfg.box !== VENT_KIND.vented
    ? null
    : cfg.port.shape === "slot"
      ? { ...cfg.port, n: 1, w: slotWidth(cfg.dim, cfg.wall || 0.75) }
      : cfg.port;
/** The share of a box's clear volume left as air: 3% goes to bracing and damping. */
export const HIFI_NET_SHARE = 0.97;
/** A woofer's displacement, L: its published one, else an estimate from its size (6.5″: 0.6 L, by volume). */
export const hifiWooferDisplacementL = (
  w: Pick<HifiWoofer, "size"> & { ts: Pick<HifiWoofer["ts"], "disp"> },
) => (w.ts.disp != null ? w.ts.disp : Math.max(0.2, Math.pow(w.size / 6.5, 3) * 0.6));
/** A sealed box's effective volume over its net: light stuffing. */
export const HIFI_STUFFING_GAIN = 1.1;
/** The box: its volumes, its vent or radiators, its subsonic and its midband level. */
export function hifiBox(w: HifiWoofer, cfg: HifiBoxConfig): HifiBox | null {
  const ts = w.ts,
    dim = cfg.dim,
    wall = cfg.wall || 0.75;
  const gross = grossVolumeLiters(dim, wall);
  // the port the model uses, and the radiators, each only for its box
  const ventPort = hifiVentPort(cfg);
  const pr = cfg.box === VENT_KIND.radiator && cfg.pr && cfg.pr.drv ? cfg.pr : null;
  const pA = ventPort ? portArea(ventPort) : 0;
  // a slot's inner end reads the box; a round port's elbows shorten it acoustically (the fewest that fit; a port too
  // long for any is modeled with the most)
  const ec = !ventPort
    ? 0
    : ventPort.shape === "slot"
      ? hifiSlotEndCorrection(dim, wall, ventPort)
      : hifiRoundEndCorrection(ventPort, hifiPortElbows(dim, wall, ventPort) ?? MAX_ELBOWS);
  // the slot's shelf takes volume too
  const pVol = ventPort
    ? ((pA + (ventPort.shape === "slot" ? wall * ventPort.w : 0)) * ventPort.len * 16.387) / 1e3
    : 0;
  const disp = hifiWooferDisplacementL(w);
  const net = Math.max(1, gross * HIFI_NET_SHARE - disp - pVol);
  const V = ampVoltage(cfg.wAmpW, w.ts);
  if (!ts || (ventPort && !(pA > 0 && ventPort.len > 0))) return null;
  const hp = cfg.hp ?? null;
  /** the vent's tuning, Hz, as the horn engine finds it (its effective length: the length and its end corrections) */
  const ventFb =
    ventPort &&
    ventTuningHz(net, portOfEffectiveLength(pA * CM2_PER_IN2, (ventPort.len + ec) * CM_PER_IN));
  // a vented box unloads below its tuning; with DSP you'd highpass it there (default 0.75 × Fb, BW24)
  const subsonic =
    cfg.hpf != null
      ? cfg.hpf
      : ventFb
        ? Math.round(0.75 * ventFb)
        : pr
          ? Math.round(0.75 * passiveRadiatorTuning(pr.drv, pr.n, pr.addG, net).Fb)
          : null;
  // A high-pass to a sub at or above the subsonic's corner takes its place: it is the woofer's half of the sub
  // crossover, an LR filter that has to sum with the sub's LR low-pass (a subsonic in series would skew that sum with
  // its phase), and it already unloads the cone below the tuning more than the subsonic did. One set below that corner
  // is no sub crossover, and the subsonic stays in series with it: the woofer's level is read from 30 Hz up, so it
  // couldn't see the protection gone.
  const hpf = hp && (subsonic == null || hp.hz >= subsonic) ? null : subsonic;
  return { gross, net, disp, pVol, pA, ventPort, pr, V, hpf, hp, ref: midbandLevelDb(ts, V) };
}

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
