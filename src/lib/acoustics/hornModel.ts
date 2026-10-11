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
 * The driver as an acoustic circuit, from its Thiele/Small parameters, in the box models' terms. All values are seen
 * through the cone's area: a mechanical value m becomes m/Sd² (masses, resistances) or m·Sd² (compliances).
 *
 * - `coneArea`: Sd, m².
 * - `acousticMass`: the cone's moving mass as acoustic mass (Mas), less the front air load when the radiation load
 *   carries it.
 * - `acousticCompliance`: the suspension's compliance as acoustic compliance (Cas).
 * - `suspensionLoss`: the suspension's mechanical loss as acoustic resistance (Ras), from Qms.
 * - `electricalDamping`: the voice coil's electrical damping as acoustic resistance (Rae = Bl²/(Re·Sd²)).
 * - `sourcePressure`: the amplifier's drive as a pressure source (Pg = V·Bl/(Re·Sd)).
 */
function driverCircuit(design: HornDesign, volts: number, radiationLoad: boolean) {
  const { driver } = design;
  const coneArea = driver.Sd * CM2_TO_M2;
  const movingMass = driver.Mms * GRAMS_TO_KG;
  const frontAirMass = radiationLoad
    ? (8 / 3) * AIR_DENSITY * Math.pow(coneArea / Math.PI, 1.5)
    : 0;
  const suspensionCompliance = 1 / (Math.pow(2 * Math.PI * driver.Fs, 2) * movingMass);
  return {
    coneArea,
    acousticMass: (movingMass - frontAirMass) / (coneArea * coneArea),
    acousticCompliance: suspensionCompliance * coneArea * coneArea,
    suspensionLoss: (2 * Math.PI * driver.Fs * movingMass) / driver.Qms / (coneArea * coneArea),
    electricalDamping: (driver.Bl * driver.Bl) / driver.Re / (coneArea * coneArea),
    sourcePressure: (volts * driver.Bl) / (driver.Re * coneArea),
  };
}

/**
 * The rear chamber's vent, when it has one, with the box model's losses.
 *
 * - `area`: the vent's open area, m².
 * - `mass`: the air in the vent as acoustic mass, ρ·length/area.
 * - `tuning`: the chamber and vent's resonance, Hz (Fb).
 * - `leakResistance`: the chamber's leakage, as a resistance in parallel (Q of HORN_LEAK_Q at the tuning).
 * - `lossResistance`: the vent's friction and turbulence, in series with its mass (Q of HORN_PORT_Q at the tuning).
 */
function ventOf(design: HornDesign, rearCompliance: number) {
  const { port } = design.rear;
  if (!port) return null;
  const area = port.area * CM2_TO_M2;
  const mass = (AIR_DENSITY * port.effLength * CM_TO_M) / area;
  const tuning = 1 / (2 * Math.PI * Math.sqrt(mass * rearCompliance));
  return {
    area,
    mass,
    tuning,
    leakResistance: HORN_LEAK_Q / (2 * Math.PI * tuning * rearCompliance),
    lossResistance: (2 * Math.PI * tuning * mass) / HORN_PORT_Q,
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
  const throatArea = segments.length ? segments[0].s1 * CM2_TO_M2 : circuit.coneArea;
  const rearCompliance = (design.rear.liters * LITERS_TO_M3) / AIR_STIFFNESS;
  const vent = ventOf(design, rearCompliance);
  const ventOffset = design.portOffset * CM_TO_M;

  const curve: HornPoint[] = [];
  const phases: number[] = [];
  for (const f of freqs) {
    const omega = 2 * Math.PI * f,
      waveNumber = omega / SOUND_SPEED;
    // the driver's own impedance: its losses, plus its mass against its suspension
    const driverImpedance = cx(
      circuit.suspensionLoss + circuit.electricalDamping,
      omega * circuit.acousticMass - 1 / (omega * circuit.acousticCompliance),
    );
    const front = frontLoad(design, f, radiationLoad);
    // the rear: the chamber's air, with the vent and the leak beside it when vented
    const ventImpedance = vent ? cx(vent.lossResistance, omega * vent.mass) : null;
    const rearAdmittance =
      vent && ventImpedance
        ? add(cx(1 / vent.leakResistance, omega * rearCompliance), inv(ventImpedance))
        : jx(omega * rearCompliance);
    const rearImpedance = inv(rearAdmittance);
    // the cone's flow, and where it goes
    const totalImpedance = add(add(driverImpedance, front.frontImpedance), rearImpedance);
    const coneFlow = div(cx(circuit.sourcePressure), totalImpedance);
    const throatFlow = div(coneFlow, front.throatSplit);
    const mouthFlow = segments.length
      ? mul(throatFlow, outputFlowRatio(front.chain, front.mouthLoad))
      : throatFlow;
    const chamberPressure = mul(coneFlow, rearImpedance);
    const ventFlow = vent && ventImpedance ? div(chamberPressure, ventImpedance) : cx(0);
    const leakFlow = vent ? scale(chamberPressure, 1 / vent.leakResistance) : cx(0);
    // the vent and leak radiate in antiphase to the cone's front, from `ventOffset` behind the mouth
    const rearOut = mul(add(ventFlow, leakFlow), exp(cx(0, -waveNumber * ventOffset)));
    const radiatedFlow = scale(sub(mouthFlow, rearOut), count);
    // a small source's pressure at r = 1 m in a solid angle Ω = angle·π: p = jωρ·flow/(Ω·r)
    const pressure = scale(mul(jx(omega * AIR_DENSITY), radiatedFlow), 1 / (angle * Math.PI));
    // the voice coil's impedance: Re plus the motional part, Bl²/Sd² over the acoustic load without Rae
    const motionalLoad = sub(totalImpedance, cx(circuit.electricalDamping));
    const electrical = add(
      cx(driver.Re),
      div(cx((driver.Bl * driver.Bl) / (circuit.coneArea * circuit.coneArea)), motionalLoad),
    );
    phases.push(arg(pressure));
    // volts are RMS: √2 turns RMS travel and air speed into sine peaks, as the box models do
    curve.push({
      f,
      spl: 20 * Math.log10(abs(pressure) / SPL_REFERENCE_PA),
      phase: 0,
      delay: 0,
      xmm: Math.SQRT2 * (abs(coneFlow) / (omega * circuit.coneArea)) * 1000,
      portVel: vent ? Math.SQRT2 * (abs(ventFlow) / vent.area) : 0,
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
  return { curve, fb: vent ? vent.tuning : null };
}

/**
 * The throat chamber's and the horn's load on the cone at frequency `f` (Hz), acoustic impedance (Pa·s/m³): for tests
 * and the planner's readouts.
 */
export const hornFrontImpedance = (design: HornDesign, f: number, radiationLoad = true): Complex =>
  frontLoad(design, f, radiationLoad).frontImpedance;
