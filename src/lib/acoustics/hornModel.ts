// The horn engine: a front-loaded horn box as Hornresp models one.
//
// The driver is the box models' acoustic circuit (lib/acoustics/driverCircuit, shared with lib/pa/calc boxModel and
// closedBox): a pressure source Pg behind the driver's own impedance. Its front drives a throat chamber and the horn's
// segments into the mouth's radiation impedance; its rear drives a sealed or vented chamber. With no segments, no
// throat chamber and no radiation load it is exactly those box models (tests/horn-engine.test.ts checks this).
//
// Words used below:
// - "flow" is volume velocity, m³/s: air speed times area.
// - "impedance" is acoustic impedance, Pa·s/m³: pressure over flow. Every impedance here is complex.
// - "compliance" is an air volume's springiness, m³/Pa; "acoustic mass" is a column of air's (or the cone's) inertia,
//   kg/m⁴.
//
// Symbols kept short are the established ones, from Thiele and Small's papers and the box models; each is defined
// where it is made or in its type (DriverCircuit, VentResistances). ω is the angular frequency 2πf (rad/s), and
// k = ω/c the wave number (rad/m).
import type { Complex, HornDesign, HornModel, HornPoint } from "../../types";
import { AIR_DENSITY, BOX_LEAK_Q, BOX_PORT_Q, SPEED_OF_SOUND } from "../../constants/acoustics";
import { CM_PER_M, LITERS_PER_CUBIC_M, SQ_CM_PER_SQ_M } from "../../constants/units";
import {
  abs,
  add,
  arg,
  complex,
  divide,
  exp,
  imaginary,
  multiply,
  reciprocal,
  scale,
  subtract,
} from "./complex";
import { driverCircuit, ventResistances } from "./driverCircuit";
import { mouthImpedance } from "./radiation";
import { chainMatrix, inputImpedance, outputFlowRatio } from "./hornSegments";

/** ρc²: an air volume V has compliance V/(ρc²). */
const AIR_STIFFNESS = AIR_DENSITY * SPEED_OF_SOUND * SPEED_OF_SOUND;
/** The reference pressure for SPL, Pa (0 dB SPL). */
const SPL_REFERENCE_PA = 2e-5;
/** Millimeters per meter, and milliseconds per second. */
const MILLI = 1000;

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

/**
 * Unwraps a phase sequence (radians) in place, as the box models do (lib/pa/calc unwrapRawPhase): from the top
 * frequency down, so the phases of the same design match theirs exactly, not only to a whole turn.
 */
function unwrapFromTop(phases: number[]) {
  for (let i = phases.length - 2; i >= 0; i--)
    phases[i] -= 2 * Math.PI * Math.round((phases[i] - phases[i + 1]) / (2 * Math.PI));
}

/** The area (m²) the front radiates from: the last segment's mouth, or the cones themselves with no segments. */
const mouthAreaOf = (design: HornDesign) =>
  (design.segments.length
    ? design.segments[design.segments.length - 1].s2
    : design.driver.Sd * design.drivers) / SQ_CM_PER_SQ_M;

/**
 * Everything in front of the cone at frequency `f` (Hz). With no segments the chain is the identity: the horn's input
 * is then the mouth's load itself, and all the flow comes out.
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
    : complex(0);
  const hornInput = inputImpedance(chain, mouthLoad);
  /** the throat chamber's compliance, m³/Pa */
  const throatCompliance = design.throatChamber / LITERS_PER_CUBIC_M / AIR_STIFFNESS;
  const throatSplit = add(complex(1), multiply(imaginary(omega * throatCompliance), hornInput));
  return {
    chain,
    mouthLoad,
    hornInput,
    throatSplit,
    frontImpedance: divide(hornInput, throatSplit),
  };
}

/**
 * The rear chamber's vent, when it has one, in Small's vented-box symbols, with the box models' losses.
 *
 * - `Sp`: the vent's open area, m².
 * - `Map`: the air in the vent as acoustic mass, ρ·(effective length)/Sp, kg/m⁴.
 * - `Fb`: the chamber and vent's tuning, 1/(2π·√(Map·Cab)), Hz.
 * - `Ral`, `Rap`: the leakage and the vent's losses (see VentResistances).
 * - `impedanceAt(ω)`: the vent's impedance, Rap + jωMap.
 */
function ventOf(design: HornDesign, Cab: number) {
  const { port } = design.rear;
  if (!port) return null;
  const Sp = port.area / SQ_CM_PER_SQ_M;
  const Map = (AIR_DENSITY * (port.effectiveLength / CM_PER_M)) / Sp;
  const Fb = 1 / (2 * Math.PI * Math.sqrt(Map * Cab));
  const { Ral, Rap } = ventResistances(Fb, Cab, Map, BOX_LEAK_Q, BOX_PORT_Q);
  return { Sp, Map, Fb, Ral, Rap, impedanceAt: (omega: number) => complex(Rap, omega * Map) };
}

/** Whether every size the model divides by is positive: the driver, the chambers, the vent and every segment. */
function isModelable(design: HornDesign, freqs: readonly number[]) {
  const { driver, rear, segments } = design;
  const positive = (...values: number[]) => values.every((v) => Number.isFinite(v) && v > 0);
  return (
    positive(driver.Sd, driver.Mms, driver.Fs, driver.Qms, driver.Bl, driver.Re) &&
    positive(rear.liters, design.count) &&
    Number.isInteger(design.drivers) &&
    design.drivers >= 1 &&
    design.throatChamber >= 0 &&
    (!rear.port || positive(rear.port.area, rear.port.effectiveLength)) &&
    segments.every((s) => positive(s.s1, s.s2) && s.length >= 0) &&
    freqs.every((f) => positive(f))
  );
}

/**
 * The design's response at each frequency (Hz) with `volts` RMS on each driver; null when a size it divides by is zero
 * or negative (as the box models return null).
 */
export function hornModel(
  design: HornDesign,
  freqs: readonly number[],
  volts: number,
  opts: HornModelOptions = {},
): HornModel | null {
  if (!isModelable(design, freqs)) return null;
  const { radiationLoad = true } = opts;
  const { driver, drivers, segments, count, angle } = design;
  /** one side's air load on a piston of one cone's radius a: 8/3·ρa³, kg */
  const frontAirMass = radiationLoad
    ? (8 / 3) * AIR_DENSITY * Math.pow(driver.Sd / SQ_CM_PER_SQ_M / Math.PI, 1.5)
    : 0;
  /** one cone's circuit, its own air load off its moving mass */
  const cone = driverCircuit(driver, volts, frontAirMass);
  // the `drivers` cones in parallel on one throat, as one: their areas add, their impedances divide, the source stays
  // (each driver has the full voltage). Sd, Mas, Cas, Ras and Rae are the bank's from here on.
  const Sd = cone.Sd * drivers,
    Mas = cone.Mas / drivers,
    Cas = cone.Cas * drivers,
    Ras = cone.Ras / drivers,
    Rae = cone.Rae / drivers,
    Pg = cone.Pg;
  /** the throat's area, m²: the first segment's start, or the cone with no segments */
  const throatArea = segments.length ? segments[0].s1 / SQ_CM_PER_SQ_M : Sd;
  /** the rear chamber's compliance, m³/Pa (Small's Cab: the box's air as acoustic compliance) */
  const Cab = design.rear.liters / LITERS_PER_CUBIC_M / AIR_STIFFNESS;
  const vent = ventOf(design, Cab);
  /** how far the vent's exit sits behind the mouth, m */
  const ventSetback = design.portOffset / CM_PER_M;

  /** the response, one point per frequency */
  const curve: HornPoint[] = [];
  /** the summed pressure's phase at each frequency, radians, before unwrapping */
  const phases: number[] = [];
  // Per frequency, the impedances (Pa·s/m³) the cone drives, then the flows (m³/s) they set:
  // - ventImpedance, rearAdmittance (its inverse's parts beside each other), rearImpedance: the rear chamber;
  // - totalImpedance: everything in series with the source Pg (driver, front, rear);
  // - coneFlow: the cone's; throatFlow: into the horn; mouthFlow: out of it; ventFlow, leakFlow: out of the rear
  //   chamber; rearOut: those two as they reach the mouth's plane; radiatedFlow: all boxes' net output.
  for (const f of freqs) {
    const omega = 2 * Math.PI * f,
      k = omega / SPEED_OF_SOUND;
    // the driver's own impedance: its losses, plus its mass against its suspension
    const driverImpedance = complex(Ras + Rae, omega * Mas - 1 / (omega * Cas));
    /** the load in front of the cone (see frontLoad) */
    const front = frontLoad(design, f, radiationLoad);
    // the rear: the chamber's air, with the vent and the leak beside it when vented
    const ventImpedance = vent ? vent.impedanceAt(omega) : null;
    /** the leak's admittance 1/Ral, (Pa·s/m³)⁻¹; 0 when sealed */
    const leakAdmittance = vent ? 1 / vent.Ral : 0;
    const rearAdmittance = add(
      complex(leakAdmittance, omega * Cab),
      ventImpedance ? reciprocal(ventImpedance) : complex(0),
    );
    const rearImpedance = reciprocal(rearAdmittance);
    // the cone's flow, and where it goes
    const totalImpedance = add(add(driverImpedance, front.frontImpedance), rearImpedance);
    const coneFlow = divide(complex(Pg), totalImpedance);
    const throatFlow = divide(coneFlow, front.throatSplit);
    const mouthFlow = multiply(throatFlow, outputFlowRatio(front.chain, front.mouthLoad));
    /** the rear chamber's pressure, Pa */
    const chamberPressure = multiply(coneFlow, rearImpedance);
    const ventFlow = ventImpedance ? divide(chamberPressure, ventImpedance) : complex(0);
    const leakFlow = scale(chamberPressure, leakAdmittance);
    // the vent and leak radiate in antiphase to the cone's front, from `ventSetback` behind the mouth
    const rearOut = multiply(add(ventFlow, leakFlow), exp(complex(0, -k * ventSetback)));
    const radiatedFlow = scale(subtract(mouthFlow, rearOut), count);
    // a small source's pressure at r = 1 m in a solid angle Ω = angle·π: p = jωρ·flow/(Ω·r)
    const pressure = scale(
      multiply(imaginary(omega * AIR_DENSITY), radiatedFlow),
      1 / (angle * Math.PI),
    );
    // one voice coil's impedance Ze: Re plus the motional part, Bl²/Sd² (one cone's) over one cone's acoustic load
    // without Rae: the bank's load times the number of cones, as each carries its share of the flow
    /** the acoustic load one cone's motor drives, without its own electrical damping */
    const motionalLoad = scale(subtract(totalImpedance, complex(Rae)), drivers);
    /** Ze, one voice coil's impedance, ohms */
    const electrical = add(
      complex(driver.Re),
      divide(complex((driver.Bl * driver.Bl) / (cone.Sd * cone.Sd)), motionalLoad),
    );
    phases.push(arg(pressure));
    // volts are RMS: √2 turns RMS travel and air speed into sine peaks, as the box models do
    curve.push({
      f,
      spl: 20 * Math.log10(abs(pressure) / SPL_REFERENCE_PA),
      phase: 0,
      delay: 0,
      xmm: Math.SQRT2 * (abs(coneFlow) / (omega * Sd)) * MILLI,
      portSpeed: vent ? Math.SQRT2 * (abs(ventFlow) / vent.Sp) : 0,
      throatSpeed: Math.SQRT2 * (abs(throatFlow) / throatArea),
      ze: abs(electrical),
    });
  }
  unwrapFromTop(phases);
  for (let i = 0; i < curve.length; i++) {
    curve[i].phase = phases[i];
    // group delay −dφ/dω, by central differences (one-sided at the ends), ms: the neighbors before and after, and
    // the angular-frequency span between them
    const before = Math.max(0, i - 1),
      after = Math.min(curve.length - 1, i + 1);
    const omegaSpan = 2 * Math.PI * (curve[after].f - curve[before].f);
    curve[i].delay = omegaSpan > 0 ? (-(phases[after] - phases[before]) / omegaSpan) * MILLI : 0;
  }
  return { curve, fb: vent ? vent.Fb : null };
}

/**
 * The throat chamber's and the horn's load on the cone at frequency `f` (Hz), acoustic impedance (Pa·s/m³): for the
 * planner's readouts.
 */
export const hornFrontImpedance = (design: HornDesign, f: number, radiationLoad = true): Complex =>
  frontLoad(design, f, radiationLoad).frontImpedance;
