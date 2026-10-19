// The horn engine: a front-loaded horn box as Hornresp models one, and the app's one model of a plain sealed or vented
// box (no segments: the cones radiate straight, lib/speaker/speakerResponse).
//
// The driver is Thiele and Small's acoustic circuit (lib/acoustics/driverCircuit, shared with the radiator box model):
// a pressure source Pg behind the driver's own impedance, with the voice coil's inductance when the driver lists one
// (Re + jωLe, as Hornresp). Its front drives a throat chamber and the horn's segments into the mouth's radiation
// impedance; its rear drives a sealed or vented chamber. The vent is a straight duct ended in its exit's radiation
// impedance, as in Hornresp. With no radiation load (`radiationLoad: false`) it is the lumped circuit of Small's
// closed-form equations (tests/sealed.test.ts and tests/vented.test.ts check them).
//
// Words used below:
// - "flow" is volume velocity, m³/s: air speed times area.
// - "impedance" is acoustic impedance, Pa·s/m³: pressure over flow. Every impedance here is complex.
// - "compliance" is an air volume's springiness, m³/Pa; "acoustic mass" is a column of air's (or the cone's) inertia,
//   kg/m⁴.
//
// Symbols kept short are the established ones, from Thiele and Small's papers; each is defined
// where it is made or in its type (DriverCircuit, VentResistances). ω is the angular frequency 2πf (rad/s), and
// k = ω/c the wave number (rad/m).
import type { BoxModelTS, Complex, HornDesign, HornModel, HornPoint, HornPort } from "../../types";
import {
  AIR_DENSITY,
  BOX_LEAK_Q,
  BOX_PORT_Q,
  SPEED_OF_SOUND,
  SPL_REFERENCE_PA,
} from "../../constants/acoustics";
import { HORN_PROFILE } from "../../constants/hornEngine";
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
import { coilFactor, coilImpedance, driverCircuit, ventResistances } from "./driverCircuit";
import { FLANGED_CIRCLE_END_RATIO, mouthImpedance, rectangleEndCorrection } from "./radiation";
import {
  chainMatrix,
  inputImpedance,
  isSizedSegment,
  outputFlowRatio,
  segmentMatrix,
} from "./hornSegments";

/** ρc²: an air volume V has compliance V/(ρc²). */
export const AIR_STIFFNESS = AIR_DENSITY * SPEED_OF_SOUND * SPEED_OF_SOUND;
/** Millimeters per meter, and milliseconds per second. */
export const MILLI = 1000;

/** One side's air load on a piston of one cone's area Sd (cm²): 8/3·ρa³, kg, a the cone's radius. */
export const oneSideAirMass = (coneAreaCm2: number) =>
  (8 / 3) * AIR_DENSITY * Math.pow(coneAreaCm2 / SQ_CM_PER_SQ_M / Math.PI, 1.5);
/**
 * The vent's tuning search (duct vent): up in steps of `step` (a ratio) to `ceiling`, Hz, from `start` times the lumped
 * vent's tuning, or from `from`, Hz, when the tuning is already past that start.
 */
const TUNING_SEARCH = { from: 1, start: 0.5, step: 1.01, ceiling: 20000 } as const;

export interface HornModelOptions {
  /**
   * Load the mouth (or the cone, with no segments) with its radiation impedance. On by default; off is the lumped
   * circuit of Small's equations, which leaves it out. With it on, the driver's moving mass drops by one side's air load (8/3·ρa³, a the
   * cone's radius), which the datasheet's moving mass includes and the radiation impedance now carries. It also makes
   * the vent a duct with its exit's radiation load (off: a lumped mass).
   */
  radiationLoad?: boolean;
  /**
   * Small's vented-box quality factors at the tuning: QL for the box's leakage, Qp for the vent's own losses. A lower
   * Q means more loss; Infinity means none. 7 and 50 by default (BOX_LEAK_Q, BOX_PORT_Q). Hornresp's horn rear chamber is
   * lossless; its direct-radiator vented box takes QL = 7 and no Qp.
   */
  QL?: number;
  Qp?: number;
}

/**
 * Unwraps a phase sequence (radians) in place, as the radiator box model does (lib/acoustics/boxModels unwrapRawPhase):
 * from the top frequency down, so a phase is fixed by its top, not only to a whole turn.
 */
function unwrapFromTop(phases: number[]) {
  for (let i = phases.length - 2; i >= 0; i--)
    phases[i] -= 2 * Math.PI * Math.round((phases[i] - phases[i + 1]) / (2 * Math.PI));
}

/**
 * Gives each point of a curve its phase and group delay, from the summed pressure's raw phases (radians, one per point,
 * unwrapped here in place): the horn engine's and the acoustic network's (lib/acoustics/network).
 */
export function setPhaseAndDelay(
  curve: { f: number; phase: number; delay: number }[],
  phases: number[],
) {
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
}

/** The area (m²) the front radiates from: the last segment's mouth, or the cones themselves with no segments. */
export const mouthAreaOf = (design: HornDesign) =>
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

/** The vent as a straight duct of its area and length (a segment of equal areas). */
export const ventDuct = (area: number, length: number) => ({
  profile: HORN_PROFILE.conical,
  s1: area,
  s2: area,
  length,
});

/**
 * The rear chamber's vent, when it has one, in Small's vented-box symbols.
 *
 * With the radiation load on, the vent is a straight duct (a transmission line, as in Hornresp) ended in its exit's
 * radiation impedance, which adds the outer end's correction. With it off (the lumped mode) it is a lumped acoustic
 * mass. Losses come from QL and Qp at the tuning, as in Small's vented-box model.
 *
 * A slot's exit is a round exit of the same total area with its reactance scaled to the rectangle's end correction
 * (each opening's): exact at low frequency, where a vent works, for openings apart from each other in half space with
 * one box. Its resistance does not depend on the shape there. With images (quarter or eighth space) or boxes side by
 * side, the scaling applies to the merged round exit: an approximation, as the images' geometry depends on how the
 * slot faces the walls.
 *
 * - `Sp`: the vent's open area, m².
 * - `Fb`: the tuning, Hz: where the vent's reactance cancels the chamber's, 1/(ωCab). Lumped: 1/(2π·√(Map·Cab)).
 * - `Ral`, `Rap`: the leakage and the vent's losses (see VentResistances).
 * - `exitReactanceRatio`: the exit's reactance over a round exit's of the vent's area (1 for a round vent).
 * - `at(f)`: at frequency f (Hz), the vent's impedance from the chamber (`impedance`, Pa·s/m³), the flow out of its
 *   exit per unit of flow in (`flowOut`), and the exit's radiation impedance (`exitLoad`; zero when lumped).
 */
export function ventOf(
  design: Pick<HornDesign, "rear" | "angle" | "count">,
  Cab: number,
  radiationLoad: boolean,
  QL: number,
  Qp: number,
) {
  const { port } = design.rear;
  if (!port) return null;
  const Sp = port.area / SQ_CM_PER_SQ_M;
  /**
   * The exit's reactance over a round exit's: a slot opening's end correction over a circle's of the vent's whole area
   * (cm over cm). n openings side by side each carry their own correction, so their mass is the opening's correction
   * over the total area. 1 for a round vent.
   */
  const exitReactanceRatio = port.slot
    ? rectangleEndCorrection(port.slot.width, port.slot.height) /
      (FLANGED_CIRCLE_END_RATIO * Math.sqrt(port.area / Math.PI))
    : 1;
  /** the lossless vent at frequency f: impedance from the chamber, exit flow per flow in, and the exit's load */
  const lossless = (f: number) => {
    if (!radiationLoad) {
      /** Map: the vent's air as a lumped acoustic mass, ρ·length/Sp, kg/m⁴ */
      const Map = (AIR_DENSITY * (port.length / CM_PER_M)) / Sp;
      return {
        impedance: complex(0, 2 * Math.PI * f * Map),
        flowOut: complex(1),
        exitLoad: complex(0),
      };
    }
    const duct = segmentMatrix(ventDuct(port.area, port.length), f);
    /** the exit's load as a round piston of the vent's area, with its images and the other boxes' exits */
    const roundExit = mouthImpedance(Sp, f, design.angle, design.count);
    const exitLoad = complex(roundExit.re, roundExit.im * exitReactanceRatio);
    return {
      impedance: inputImpedance(duct, exitLoad),
      flowOut: outputFlowRatio(duct, exitLoad),
      exitLoad,
    };
  };
  /** the vent's reactance less the chamber's (Pa·s/m³): negative below the tuning, positive just above it */
  const detuning = (f: number) => lossless(f).impedance.im - 1 / (2 * Math.PI * f * Cab);
  /** the lumped vent's tuning, Hz: its air as one mass, ρ·length/Sp, with the chamber's compliance */
  const lumpedFb =
    1 / (2 * Math.PI * Math.sqrt(((AIR_DENSITY * (port.length / CM_PER_M)) / Sp) * Cab));
  let Fb: number;
  if (!radiationLoad) {
    Fb = lumpedFb;
  } else {
    // step up to the first sign change, then halve the bracket: the duct's reactance has poles above the tuning, so a
    // plain bisection over a wide range could land on one. The exit's load adds mass, so the tuning falls below the
    // lumped one: the steps start at a fraction of it, or at the bottom if the tuning is lower still
    /** the search's first frequency, Hz */
    const start = Math.max(TUNING_SEARCH.from, TUNING_SEARCH.start * lumpedFb);
    let below: number = detuning(start) < 0 ? start : TUNING_SEARCH.from;
    while (
      below * TUNING_SEARCH.step < TUNING_SEARCH.ceiling &&
      detuning(below * TUNING_SEARCH.step) < 0
    )
      below *= TUNING_SEARCH.step;
    let above = below * TUNING_SEARCH.step;
    for (let i = 0; i < 60; i++) {
      const middle = Math.sqrt(below * above);
      if (detuning(middle) < 0) below = middle;
      else above = middle;
    }
    Fb = Math.sqrt(below * above);
  }
  /** the vent's acoustic mass that tunes Cab to Fb, kg/m⁴: ρ·length/Sp when lumped */
  const Map = 1 / (Math.pow(2 * Math.PI * Fb, 2) * Cab);
  const { Ral, Rap } = ventResistances(Fb, Cab, Map, QL, Qp);
  return {
    Sp,
    Fb,
    Ral,
    Rap,
    exitReactanceRatio,
    at: (f: number) => {
      const vent = lossless(f);
      return { ...vent, impedance: add(vent.impedance, complex(Rap)) };
    },
  };
}

/**
 * A round exit's own end correction, cm, for an exit of `areaCm2` in half space with one box: what its radiation load
 * adds to the vent's length at low frequency (a flanged piston's 8/(3π)·r, r the exit's radius).
 */
const roundExitCorrection = (areaCm2: number) =>
  FLANGED_CIRCLE_END_RATIO * Math.sqrt(areaCm2 / Math.PI);

/**
 * A vent as the engine's port from its effective length, cm: its physical length plus both ends' corrections, as a
 * vent rule works them out. The duct is that length less the round exit's own correction, which the exit's radiation
 * load adds back (half space, one box). So the vent keeps the rule's effective length at low frequency; only the duct's
 * wave behavior and the exit's load are new. `areaCm2` is all the openings together.
 */
export const portOfEffectiveLength = (areaCm2: number, effectiveLengthCm: number): HornPort => ({
  area: areaCm2,
  length: effectiveLengthCm - roundExitCorrection(areaCm2),
});

/**
 * The tuning Fb, Hz, of a chamber of `liters` with this vent, as `hornModel` finds it (the duct with its exit's load,
 * half space, one box); null for no vent.
 */
export function ventTuningHz(liters: number, port: HornPort | null): number | null {
  const positive = (x: number) => Number.isFinite(x) && x > 0;
  if (!port || !positive(liters) || !positive(port.area) || !positive(port.length)) return null;
  /** the chamber's compliance, m³/Pa */
  const Cab = liters / LITERS_PER_CUBIC_M / AIR_STIFFNESS;
  const vent = ventOf(
    { rear: { liters, port }, angle: 2, count: 1 },
    Cab,
    true,
    BOX_LEAK_Q,
    BOX_PORT_Q,
  );
  return vent ? vent.Fb : null;
}

/**
 * Small's closed-box Qtc for a sealed chamber of `liters`: the driver's Qts times Fc/Fs, Fc the cone's moving mass
 * against its suspension and the box's air in series.
 */
export function closedBoxQtc(driver: BoxModelTS, liters: number) {
  const { Mms, Cas } = driverCircuit(driver, 1);
  /** the box's compliance, m³/Pa */
  const Cab = liters / LITERS_PER_CUBIC_M / AIR_STIFFNESS;
  /** the electrical Q, Qes: 2π·Fs·Mms·Re/Bl² */
  const Qes = (2 * Math.PI * driver.Fs * Mms * driver.Re) / (driver.Bl * driver.Bl);
  const Qts = (Qes * driver.Qms) / (Qes + driver.Qms);
  return Qts * Math.sqrt(1 + Cas / Cab);
}

/**
 * How much a source's on-axis pressure scales to give its power-based pressure (Hornresp's SPL): √(c·Ω·R/(ρ·n))/ω for
 * a source of radiation resistance R (Pa·s/m³) at angular frequency ω, n boxes side by side, in a solid angle Ω.
 */
export const powerScale = (resistance: number, omega: number, solidAngle: number, count: number) =>
  Math.sqrt((SPEED_OF_SOUND * solidAngle * resistance) / (AIR_DENSITY * count)) / omega;

/**
 * Whether every size the model divides by is positive and finite: the driver, the chambers, the vent and every segment
 * (each segment's length too: a zero-length segment is a gap, not a skipped one).
 */
function isModelable(design: HornDesign, freqs: readonly number[]) {
  const { driver, rear, segments } = design;
  const positive = (...values: number[]) => values.every((v) => Number.isFinite(v) && v > 0);
  return (
    positive(driver.Sd, driver.Mms, driver.Fs, driver.Qms, driver.Bl, driver.Re) &&
    (driver.Le === undefined || (Number.isFinite(driver.Le) && driver.Le >= 0)) &&
    positive(rear.liters, design.count) &&
    Number.isInteger(design.drivers) &&
    design.drivers >= 1 &&
    Number.isFinite(design.throatChamber) &&
    design.throatChamber >= 0 &&
    (!rear.port ||
      (positive(rear.port.area, rear.port.length) &&
        (!rear.port.slot || positive(rear.port.slot.width, rear.port.slot.height)))) &&
    segments.every(isSizedSegment) &&
    freqs.every((f) => positive(f))
  );
}

/**
 * The design's response at each frequency (Hz) with `volts` RMS on each driver; null when a size it divides by is zero
 * or negative.
 */
export function hornModel(
  design: HornDesign,
  freqs: readonly number[],
  volts: number,
  opts: HornModelOptions = {},
): HornModel | null {
  if (!isModelable(design, freqs)) return null;
  const { radiationLoad = true, QL = BOX_LEAK_Q, Qp = BOX_PORT_Q } = opts;
  const { driver, drivers, segments, count, angle } = design;
  /** one side's air load on one cone, kg */
  const frontAirMass = radiationLoad ? oneSideAirMass(driver.Sd) : 0;
  /** one cone's circuit, its own air load off its moving mass */
  const cone = driverCircuit(driver, volts, frontAirMass);
  // the `drivers` cones in parallel on one throat, as one: their areas add, their impedances divide, the source stays
  // (each driver has the full voltage). Sd, Mas, Cas and Ras are the bank's from here on.
  const Sd = cone.Sd * drivers,
    Mas = cone.Mas / drivers,
    Cas = cone.Cas * drivers,
    Ras = cone.Ras / drivers;
  /** Bl/Sd for one cone, N/(m²·A): turns the coil's current into pressure on the cone */
  const forcePerArea = driver.Bl / cone.Sd;
  /** the throat's area, m²: the first segment's start, or the cone with no segments */
  const throatArea = segments.length ? segments[0].s1 / SQ_CM_PER_SQ_M : Sd;
  /** the rear chamber's compliance, m³/Pa (Small's Cab: the box's air as acoustic compliance) */
  const Cab = design.rear.liters / LITERS_PER_CUBIC_M / AIR_STIFFNESS;
  const vent = ventOf(design, Cab, radiationLoad, QL, Qp);
  /** how far the vent's exit sits behind the mouth, m */
  const ventSetback = design.portOffset / CM_PER_M;
  /** Ω, the solid angle, sr */
  const solidAngle = angle * Math.PI;

  /** the response, one point per frequency */
  const curve: HornPoint[] = [];
  /** the summed pressure's phase at each frequency, radians, before unwrapping */
  const phases: number[] = [];
  // Per frequency, the impedances (Pa·s/m³) the cone drives, then the flows (m³/s) they set:
  // - ventAt (the vent's impedance, exit flow and exit load), rearAdmittance (the rear's parts beside each other),
  //   rearImpedance: the rear chamber;
  // - totalImpedance: everything in series with the motor's source (driver, front, rear);
  // - coneFlow: the cone's; throatFlow: into the horn; mouthFlow: out of it; ventFlow: into the vent; ventExitFlow:
  //   out of it; leakFlow: out of the leak.
  for (const f of freqs) {
    const omega = 2 * Math.PI * f,
      k = omega / SPEED_OF_SOUND;
    // The voice coil's blocked impedance, Re + jωLe (Hornresp's plain inductance). The motor is a source
    // volts·(Bl/Sd)/coil behind the electrical damping (Bl/Sd)²/coil: one cone's Pg and Rae times the coil's factor
    // Re/coil (lib/acoustics/driverCircuit coilFactor); the bank's damping divides by the
    // number of cones.
    const coil = coilImpedance(driver, omega);
    const motor = coilFactor(driver, omega);
    const source = scale(motor, cone.Pg);
    const electricalDamping = scale(motor, cone.Rae / drivers);
    // the driver's own impedance: its losses and electrical damping, plus its mass against its suspension
    const driverImpedance = add(complex(Ras, omega * Mas - 1 / (omega * Cas)), electricalDamping);
    /** the load in front of the cone (see frontLoad) */
    const front = frontLoad(design, f, radiationLoad);
    // the rear: the chamber's air, with the vent and the leak beside it when vented
    const ventAt = vent ? vent.at(f) : null;
    /** the leak's admittance 1/Ral, (Pa·s/m³)⁻¹; 0 when sealed or lossless */
    const leakAdmittance = vent ? 1 / vent.Ral : 0;
    const rearAdmittance = add(
      complex(leakAdmittance, omega * Cab),
      ventAt ? reciprocal(ventAt.impedance) : complex(0),
    );
    const rearImpedance = reciprocal(rearAdmittance);
    // the cone's flow, and where it goes
    const totalImpedance = add(add(driverImpedance, front.frontImpedance), rearImpedance);
    const coneFlow = divide(source, totalImpedance);
    const throatFlow = divide(coneFlow, front.throatSplit);
    const mouthFlow = multiply(throatFlow, outputFlowRatio(front.chain, front.mouthLoad));
    /** the rear chamber's pressure, Pa */
    const chamberPressure = multiply(coneFlow, rearImpedance);
    const ventFlow = ventAt ? divide(chamberPressure, ventAt.impedance) : complex(0);
    const ventExitFlow = ventAt ? multiply(ventFlow, ventAt.flowOut) : complex(0);
    const leakFlow = scale(chamberPressure, leakAdmittance);
    // a small source's pressure at r = 1 m in the solid angle Ω, all boxes together: p = jωρ·count·flow/(Ω·r)
    const pressureOf = (flow: Complex) =>
      scale(multiply(imaginary(omega * AIR_DENSITY), flow), count / solidAngle);
    // the vent and leak radiate in antiphase to the cone's front, from `ventSetback` behind the mouth
    const setback = exp(complex(0, -k * ventSetback));
    const mouthPressure = pressureOf(mouthFlow),
      ventPressure = pressureOf(scale(multiply(ventExitFlow, setback), -1)),
      leakPressure = pressureOf(scale(multiply(leakFlow, setback), -1));
    const pressure = add(add(mouthPressure, ventPressure), leakPressure);
    // Hornresp's SPL: each source's pressure from its radiated power instead (the leak has no radiation load)
    const powerPressure = radiationLoad
      ? add(
          add(
            scale(mouthPressure, powerScale(front.mouthLoad.re, omega, solidAngle, count)),
            ventAt
              ? scale(ventPressure, powerScale(ventAt.exitLoad.re, omega, solidAngle, count))
              : complex(0),
          ),
          leakPressure,
        )
      : pressure;
    // one voice coil's impedance Ze: the coil plus the motional part, (Bl/Sd)² (one cone's) over one cone's acoustic
    // load without its electrical damping: the bank's load times the number of cones, as each carries its share
    /** the acoustic load one cone's motor drives, without its own electrical damping */
    const motionalLoad = scale(subtract(totalImpedance, electricalDamping), drivers);
    /** Ze, one voice coil's impedance, ohms */
    const electrical = add(coil, divide(complex(forcePerArea * forcePerArea), motionalLoad));
    phases.push(arg(pressure));
    // volts are RMS: √2 turns RMS travel and air speed into sine peaks, which Xmax and the vent's speed limit mean
    curve.push({
      f,
      spl: 20 * Math.log10(abs(pressure) / SPL_REFERENCE_PA),
      powerSpl: 20 * Math.log10(abs(powerPressure) / SPL_REFERENCE_PA),
      phase: 0,
      delay: 0,
      xmm: Math.SQRT2 * (abs(coneFlow) / (omega * Sd)) * MILLI,
      portSpeed: vent ? Math.SQRT2 * (abs(ventFlow) / vent.Sp) : 0,
      throatSpeed: Math.SQRT2 * (abs(throatFlow) / throatArea),
      ze: abs(electrical),
    });
  }
  setPhaseAndDelay(curve, phases);
  return { curve, fb: vent ? vent.Fb : null };
}
