// The horn engine: a front-loaded horn box as Hornresp models one.
//
// The driver is the box models' acoustic circuit (lib/pa/calc boxModel, closedBox): a pressure source behind the
// driver's own impedance. Its front drives a throat chamber and the horn's segments into the mouth's radiation
// impedance; its rear drives a sealed or vented chamber. With no segments, no throat chamber and no radiation load it
// is exactly those box models (tests/horn-engine.test.ts checks this).
//
// Words used below:
// - "flow" is volume velocity, m³/s: air speed times area.
// - "impedance" is acoustic impedance, Pa·s/m³: pressure over flow. Every impedance here is complex.
// - "compliance" is an air volume's springiness, m³/Pa; "acoustic mass" is a column of air's (or the cone's) inertia,
//   kg/m⁴. Both are the driver's or the box's mechanical values seen through the cone's area.
//
// Symbols kept short are the established ones, from Thiele and Small's papers and the box models; each is defined
// where it is made. ω is the angular frequency 2πf (rad/s), and k = ω/c the wave number (rad/m).
import type { Complex, HornDesign, HornModel, HornPoint } from "../../types";
import { AIR_DENSITY, HORN_LEAK_Q, HORN_PORT_Q, SOUND_SPEED } from "../../constants/hornEngine";
import { abs, add, arg, cx, div, exp, inv, jx, mul, scale, sub } from "./complex";
import { mouthImpedance } from "./radiation";
import { chainMatrix, inputImpedance, outputFlowRatio } from "./hornSegments";

const CM2_TO_M2 = 1e-4,
  CM_TO_M = 1e-2,
  LITERS_TO_M3 = 1e-3,
  GRAMS_TO_KG = 1e-3;
/** ρc²: an air volume V has compliance V/(ρc²). */
const AIR_STIFFNESS = AIR_DENSITY * SOUND_SPEED * SOUND_SPEED;
/** The reference pressure for SPL, Pa (0 dB SPL). */
const SPL_REFERENCE_PA = 2e-5;

export interface HornModelOptions {
  /**
   * Load the mouth (or the cone, with no segments) with its radiation impedance. On by default; off reproduces the box
   * models, which leave it out. With it on, the driver's moving mass drops by one side's air load (8/3·ρa³, a the
   * cone's radius), which the datasheet's moving mass includes and the radiation impedance now carries.
   */
  radiationLoad?: boolean;
}

/**
 * `count` log-spaced frequencies from `fmin` to `fmax`, Hz: the horn engine's grid (10 Hz–2 kHz reaches a mid horn's
 * crossover).
 */
export const hornGrid = (fmin = 10, fmax = 2000, count = 500) =>
  Array.from({ length: count }, (_, i) => fmin * Math.pow(fmax / fmin, i / (count - 1)));

/** Unwraps a phase sequence (radians) in place, so no step between neighbors exceeds π. */
function unwrap(phases: number[]) {
  for (let i = 1; i < phases.length; i++) {
    let step = phases[i] - phases[i - 1];
    while (step > Math.PI) step -= 2 * Math.PI;
    while (step < -Math.PI) step += 2 * Math.PI;
    phases[i] = phases[i - 1] + step;
  }
}

/** The area (m²) the front radiates from: the last segment's mouth, or the cone itself with no segments. */
const mouthAreaOf = (design: HornDesign) =>
  design.segments.length
    ? design.segments[design.segments.length - 1].s2 * CM2_TO_M2
    : design.driver.Sd * CM2_TO_M2;

/**
 * Everything in front of the cone at frequency `f` (Hz).
 *
 * - `chain`: the horn's transfer matrix, throat to mouth.
 * - `mouthLoad`: the mouth's radiation impedance (zero with the load off).
 * - `hornInput`: what the horn shows at its throat with that load on its mouth.
 * - `throatSplit`: 1 + jωC·hornInput, C the throat chamber's compliance. The chamber sits in parallel with the horn's
 *   input, so the cone's flow divides by this on its way into the throat.
 * - `frontImpedance`: the load the cone's front sees: hornInput / throatSplit.
 */
function frontLoad(design: HornDesign, f: number, radiationLoad: boolean) {
  const omega = 2 * Math.PI * f;
  const chain = chainMatrix(design.segments, f);
  const mouthLoad = radiationLoad
    ? mouthImpedance(mouthAreaOf(design), f, design.angle, design.count)
    : cx(0);
  const hornInput = design.segments.length ? inputImpedance(chain, mouthLoad) : mouthLoad;
  const throatCompliance = (design.throatChamber * LITERS_TO_M3) / AIR_STIFFNESS;
  const throatSplit = add(cx(1), mul(jx(omega * throatCompliance), hornInput));
  return { chain, mouthLoad, hornInput, throatSplit, frontImpedance: div(hornInput, throatSplit) };
}

/**
 * The driver as an acoustic circuit, from its Thiele/Small parameters (Fs, Qms, Mms, Bl, Re), in the box models'
 * terms. Every value is seen through the cone's area Sd: a mechanical mass or resistance divides by Sd², a mechanical
 * compliance multiplies by it.
 *
 * - `Sd`: the cone's effective area, m².
 * - `Mas`: the cone's moving mass as acoustic mass, kg/m⁴. Without the radiation load it is Mms/Sd², as in the box
 *   models; with it, Mmd/Sd², Mmd (Hornresp's name) being Mms less the front air load the radiation load now carries.
 * - `Cas`: the suspension's compliance (Cms) as acoustic compliance, m³/Pa.
 * - `Ras`: the suspension's mechanical loss (from Qms) as acoustic resistance, Pa·s/m³.
 * - `Rae`: the voice coil's electrical damping as acoustic resistance, Bl²/(Re·Sd²), Pa·s/m³.
 * - `Pg`: the amplifier's drive as a pressure source behind them all, V·Bl/(Re·Sd), Pa.
 */
function driverCircuit(design: HornDesign, volts: number, radiationLoad: boolean) {
  const { driver } = design;
  /** the cone's area, m² */
  const Sd = driver.Sd * CM2_TO_M2;
  /** the moving mass with its air load, kg (the datasheet's) */
  const Mms = driver.Mms * GRAMS_TO_KG;
  /** one side's air load on a piston of the cone's radius a: 8/3·ρa³, kg */
  const frontAirMass = radiationLoad ? (8 / 3) * AIR_DENSITY * Math.pow(Sd / Math.PI, 1.5) : 0;
  /** the moving mass without the front air load, kg */
  const Mmd = Mms - frontAirMass;
  /** the suspension's mechanical compliance, m/N, from Fs = 1/(2π·√(Mms·Cms)) */
  const Cms = 1 / (Math.pow(2 * Math.PI * driver.Fs, 2) * Mms);
  return {
    Sd,
    Mas: Mmd / (Sd * Sd),
    Cas: Cms * Sd * Sd,
    Ras: (2 * Math.PI * driver.Fs * Mms) / driver.Qms / (Sd * Sd),
    Rae: (driver.Bl * driver.Bl) / driver.Re / (Sd * Sd),
    Pg: (volts * driver.Bl) / (driver.Re * Sd),
  };
}

/**
 * The rear chamber's vent, when it has one, with the box model's losses, in Small's vented-box symbols. `Cab` is the
 * chamber's compliance, m³/Pa.
 *
 * - `Sp`: the vent's open area, m².
 * - `Map`: the air in the vent as acoustic mass, ρ·(effective length)/Sp, kg/m⁴.
 * - `Fb`: the chamber and vent's tuning, 1/(2π·√(Map·Cab)), Hz.
 * - `Ral`: the chamber's leakage, a resistance in parallel with it, set by a Q of HORN_LEAK_Q at Fb, Pa·s/m³.
 * - `Rap`: the vent's friction and turbulence, a resistance in series with Map, set by a Q of HORN_PORT_Q at Fb,
 *   Pa·s/m³.
 */
function ventOf(design: HornDesign, Cab: number) {
  const { port } = design.rear;
  if (!port) return null;
  const Sp = port.area * CM2_TO_M2;
  const Map = (AIR_DENSITY * port.effLength * CM_TO_M) / Sp;
  const Fb = 1 / (2 * Math.PI * Math.sqrt(Map * Cab));
  return {
    Sp,
    Map,
    Fb,
    Ral: HORN_LEAK_Q / (2 * Math.PI * Fb * Cab),
    Rap: (2 * Math.PI * Fb * Map) / HORN_PORT_Q,
  };
}

/** The design's response at each frequency (Hz) with `volts` RMS on each driver. */
export function hornModel(
  design: HornDesign,
  freqs: readonly number[],
  volts: number,
  opts: HornModelOptions = {},
): HornModel {
  const { radiationLoad = true } = opts;
  const { driver, segments, count, angle } = design;
  const circuit = driverCircuit(design, volts, radiationLoad);
  const throatArea = segments.length ? segments[0].s1 * CM2_TO_M2 : circuit.Sd;
  /** the rear chamber's compliance, m³/Pa (Small's Cab: the box's air as acoustic compliance) */
  const Cab = (design.rear.liters * LITERS_TO_M3) / AIR_STIFFNESS;
  const vent = ventOf(design, Cab);
  const ventOffset = design.portOffset * CM_TO_M;

  const curve: HornPoint[] = [];
  const phases: number[] = [];
  for (const f of freqs) {
    const omega = 2 * Math.PI * f,
      k = omega / SOUND_SPEED;
    // the driver's own impedance: its losses, plus its mass against its suspension
    const driverImpedance = cx(
      circuit.Ras + circuit.Rae,
      omega * circuit.Mas - 1 / (omega * circuit.Cas),
    );
    const front = frontLoad(design, f, radiationLoad);
    // the rear: the chamber's air, with the vent and the leak beside it when vented
    const ventImpedance = vent ? cx(vent.Rap, omega * vent.Map) : null;
    const rearAdmittance =
      vent && ventImpedance
        ? add(cx(1 / vent.Ral, omega * Cab), inv(ventImpedance))
        : jx(omega * Cab);
    const rearImpedance = inv(rearAdmittance);
    // the cone's flow, and where it goes
    const totalImpedance = add(add(driverImpedance, front.frontImpedance), rearImpedance);
    const coneFlow = div(cx(circuit.Pg), totalImpedance);
    const throatFlow = div(coneFlow, front.throatSplit);
    const mouthFlow = segments.length
      ? mul(throatFlow, outputFlowRatio(front.chain, front.mouthLoad))
      : throatFlow;
    const chamberPressure = mul(coneFlow, rearImpedance);
    const ventFlow = vent && ventImpedance ? div(chamberPressure, ventImpedance) : cx(0);
    const leakFlow = vent ? scale(chamberPressure, 1 / vent.Ral) : cx(0);
    // the vent and leak radiate in antiphase to the cone's front, from `ventOffset` behind the mouth
    const rearOut = mul(add(ventFlow, leakFlow), exp(cx(0, -k * ventOffset)));
    const radiatedFlow = scale(sub(mouthFlow, rearOut), count);
    // a small source's pressure at r = 1 m in a solid angle Ω = angle·π: p = jωρ·flow/(Ω·r)
    const pressure = scale(mul(jx(omega * AIR_DENSITY), radiatedFlow), 1 / (angle * Math.PI));
    // the voice coil's impedance: Re plus the motional part, Bl²/Sd² over the acoustic load without Rae
    const motionalLoad = sub(totalImpedance, cx(circuit.Rae));
    const electrical = add(
      cx(driver.Re),
      div(cx((driver.Bl * driver.Bl) / (circuit.Sd * circuit.Sd)), motionalLoad),
    );
    phases.push(arg(pressure));
    // volts are RMS: √2 turns RMS travel and air speed into sine peaks, as the box models do
    curve.push({
      f,
      spl: 20 * Math.log10(abs(pressure) / SPL_REFERENCE_PA),
      phase: 0,
      delay: 0,
      xmm: Math.SQRT2 * (abs(coneFlow) / (omega * circuit.Sd)) * 1000,
      portVel: vent ? Math.SQRT2 * (abs(ventFlow) / vent.Sp) : 0,
      throatVel: Math.SQRT2 * (abs(throatFlow) / throatArea),
      ze: abs(electrical),
    });
  }
  unwrap(phases);
  for (let i = 0; i < curve.length; i++) {
    curve[i].phase = phases[i];
    // group delay −dφ/dω, by central differences (one-sided at the ends), ms
    const before = Math.max(0, i - 1),
      after = Math.min(curve.length - 1, i + 1);
    const omegaSpan = 2 * Math.PI * (curve[after].f - curve[before].f);
    curve[i].delay = omegaSpan > 0 ? (-(phases[after] - phases[before]) / omegaSpan) * 1000 : 0;
  }
  return { curve, fb: vent ? vent.Fb : null };
}

/**
 * The throat chamber's and the horn's load on the cone at frequency `f` (Hz), acoustic impedance (Pa·s/m³): for tests
 * and the planner's readouts.
 */
export const hornFrontImpedance = (design: HornDesign, f: number, radiationLoad = true): Complex =>
  frontLoad(design, f, radiationLoad).frontImpedance;
