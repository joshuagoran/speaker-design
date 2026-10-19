// The acoustic network engine: any set of drivers, chambers, ducts (horn sections), lumped masses and openings, joined
// at nodes (types: AcousticNetwork). Per frequency it solves the whole network at once by modified nodal analysis:
//
// - the unknowns are every node's pressure, plus the flows the parts need for their own equations (a driver's, an
//   opening's and a mass's one flow; a duct's flow in and flow out);
// - one row per node says that the flows out of it add to zero (conservation of volume velocity);
// - one row per part flow gives that part's own law (the driver's source and impedance, a duct's transfer matrix, an
//   opening's load).
//
// A duct keeps its transfer matrix [[A, B], [C, D]] in its two rows, never its inverse, so a duct at a frequency where
// B is zero (a straight duct half a wavelength long) or of zero length stays solvable. Gaussian elimination with
// partial pivoting, on rows scaled to their largest entry, solves the system: a horn box has 10 to 20 unknowns, so a
// 500-point curve takes a few milliseconds. The engine is pure (no DOM, no globals), so it runs in a web worker.
//
// The driver is the horn engine's and the box models' circuit (lib/acoustics/driverCircuit): with the same parts it
// gives lib/acoustics/hornModel's and lib/pa/calc's results to rounding (tests/acoustic-network.test.ts).
//
// Words used below: "flow" is volume velocity (m³/s); "impedance" is acoustic impedance (Pa·s/m³); "admittance" its
// reciprocal. ω is the angular frequency 2πf (rad/s) and k = ω/c the wave number (rad/m). Pressures and flows are
// complex RMS values.
import type {
  AcousticNetwork,
  Complex,
  NetworkDriver,
  NetworkPart,
  NetworkPoint,
  NetworkResponse,
  NetworkState,
  OpeningLoad,
} from "../../../types";
import { AIR_DENSITY, SPEED_OF_SOUND } from "../../../constants/acoustics";
import { NETWORK_PART, OPENING_LOAD } from "../../../constants/acousticNetwork";
import { CM_PER_M, GRAMS_PER_KG, LITERS_PER_CUBIC_M } from "../../../constants/units";
import {
  abs,
  add,
  arg,
  complex,
  exp,
  imaginary,
  multiply,
  scale,
  subtract,
  divide,
} from "../complex";
import { coilFactor, coilImpedance, driverCircuit } from "../driverCircuit";
import { chainMatrix, isSizedSegment } from "../hornSegments";
import { mouthImpedance } from "../radiation";
import { AIR_STIFFNESS, MILLI, SPL_REFERENCE_PA, powerScale, setPhaseAndDelay } from "../hornModel";

/**
 * The smallest pivot the elimination takes, against rows scaled to 1: below it the system is singular to rounding (a
 * node with almost nothing to set its pressure), and its result would be noise.
 */
const SINGULAR_PIVOT = 1e-12;

/** How many flow unknowns each kind of part adds to the system. */
const FLOW_UNKNOWNS: Record<NetworkPart["kind"], number> = {
  [NETWORK_PART.driver]: 1,
  [NETWORK_PART.chamber]: 0,
  [NETWORK_PART.duct]: 2,
  [NETWORK_PART.mass]: 1,
  [NETWORK_PART.opening]: 1,
};

/**
 * A driver part's circuit at the drive voltage, for its whole bank of `drivers` cones in parallel (their areas add,
 * their impedances divide; each cone keeps the full voltage).
 * - `Sd`: the bank's cone area, m²; `Mas`, `Cas`, `Ras`: its moving mass, suspension and losses as acoustic elements
 *   (kg/m⁴, m³/Pa, Pa·s/m³); `Rae`: its electrical damping with the coil's Re alone, Pa·s/m³; `Pg`: one cone's source,
 *   Pa (the bank's is the same).
 * - `forcePerArea`: Bl/Sd for one cone, N/(m²·A).
 */
function bankOf(part: NetworkDriver, volts: number) {
  const cone = driverCircuit(motorOf(part), volts, part.airMassOff);
  return {
    Sd: cone.Sd * part.drivers,
    Mas: cone.Mas / part.drivers,
    Cas: cone.Cas * part.drivers,
    Ras: cone.Ras / part.drivers,
    Rae: cone.Rae / part.drivers,
    Pg: cone.Pg,
    forcePerArea: part.ts.Bl / cone.Sd,
  };
}

/** The driver's parameters as its motor sees them: the amplifier's output resistance, if any, added to Re. */
const motorOf = (part: NetworkDriver) =>
  part.sourceResistance ? { ...part.ts, Re: part.ts.Re + part.sourceResistance } : part.ts;

/** Whether a number is finite and positive. */
const isPositive = (value: number) => Number.isFinite(value) && value > 0;

/** Whether an opening's load can be modeled: a positive area or resistance. */
const isModelableLoad = (load: OpeningLoad) =>
  load.kind === OPENING_LOAD.piston
    ? isPositive(load.area) && isPositive(load.reactanceRatio)
    : load.kind === OPENING_LOAD.resistance
      ? isPositive(load.resistance)
      : true;

/**
 * Whether every part's nodes exist and every size it divides by is positive and finite (as the horn engine's
 * `isModelable`), and the network has at least one driver.
 */
function isModelable(network: AcousticNetwork) {
  const isNode = (node: number) => Number.isInteger(node) && node >= 0 && node < network.nodeCount;
  const partOk = (part: NetworkPart) => {
    switch (part.kind) {
      case NETWORK_PART.driver: {
        const { ts } = part;
        return (
          isNode(part.front) &&
          isNode(part.rear) &&
          [ts.Sd, ts.Mms, ts.Fs, ts.Qms, ts.Bl, ts.Re].every(isPositive) &&
          (ts.Le === undefined || (Number.isFinite(ts.Le) && ts.Le >= 0)) &&
          Number.isInteger(part.drivers) &&
          part.drivers >= 1 &&
          Number.isFinite(part.airMassOff) &&
          part.airMassOff >= 0 &&
          (part.sourceResistance === undefined ||
            (Number.isFinite(part.sourceResistance) && part.sourceResistance >= 0)) &&
          ts.Mms / GRAMS_PER_KG > part.airMassOff
        );
      }
      case NETWORK_PART.chamber:
        return (
          isNode(part.node) && isPositive(part.liters) && (part.loss === undefined || part.loss > 0)
        );
      case NETWORK_PART.duct:
        return (
          isNode(part.from) &&
          isNode(part.to) &&
          part.segments.every(isSizedSegment) &&
          Number.isFinite(part.loss) &&
          part.loss >= 0
        );
      case NETWORK_PART.mass:
        return (
          isNode(part.from) &&
          isNode(part.to) &&
          Number.isFinite(part.mass) &&
          part.mass >= 0 &&
          Number.isFinite(part.resistance) &&
          part.resistance >= 0
        );
      case NETWORK_PART.opening:
        return isNode(part.node) && isModelableLoad(part.load) && Number.isFinite(part.setback);
    }
  };
  return (
    Number.isInteger(network.nodeCount) &&
    network.nodeCount >= 1 &&
    isPositive(network.count) &&
    network.parts.some((part) => part.kind === NETWORK_PART.driver) &&
    network.parts.every(partOk)
  );
}

/** An opening's load impedance at frequency `f` (Hz), Pa·s/m³, in the network's solid angle beside its other boxes. */
function openingImpedance(load: OpeningLoad, network: AcousticNetwork, f: number): Complex {
  switch (load.kind) {
    case OPENING_LOAD.piston: {
      const round = mouthImpedance(load.area, f, network.angle, network.count);
      return complex(round.re, round.im * load.reactanceRatio);
    }
    case OPENING_LOAD.resistance:
      return complex(load.resistance);
    case OPENING_LOAD.open:
      return complex(0);
  }
}

/**
 * The network made ready to solve at one drive voltage: where each part's flow unknowns sit (`flowIndex`, after the
 * node pressures), the system's size, each driver part's bank (null for other parts), each opening's load impedance
 * at the last frequency solved (null for other parts), and the work arrays.
 */
function prepare(network: AcousticNetwork, volts: number) {
  const flowIndex: number[] = [];
  let size = network.nodeCount;
  for (const part of network.parts) {
    flowIndex.push(size);
    size += FLOW_UNKNOWNS[part.kind];
  }
  return {
    network,
    flowIndex,
    size,
    banks: network.parts.map((part) =>
      part.kind === NETWORK_PART.driver ? bankOf(part, volts) : null,
    ),
    loads: network.parts.map((): Complex | null => null),
    /** the system's matrix, row by row, real and imaginary parts apart; and its right-hand side */
    matrixRe: new Float64Array(size * size),
    matrixIm: new Float64Array(size * size),
    rhsRe: new Float64Array(size),
    rhsIm: new Float64Array(size),
  };
}
type Prepared = ReturnType<typeof prepare>;

/**
 * A network made ready to solve at one drive voltage (`prepareNetwork`), to solve at many frequencies with
 * `solvePreparedAt`. Callers only pass it back: this module alone reads it.
 */
export type PreparedNetwork = Prepared;

/**
 * The network made ready to solve with `volts` RMS on every driver, once for any number of frequencies; null when a
 * size it divides by is not positive (see `isModelable`).
 */
export const prepareNetwork = (network: AcousticNetwork, volts: number): PreparedNetwork | null =>
  isModelable(network) ? prepare(network, volts) : null;

/**
 * Solves the prepared network at frequency `f` (Hz): fills the system, then eliminates. Returns the unknowns (node
 * pressures, then part flows) as complex numbers, or null when the system is singular or nearly (a node with nothing to set
 * its pressure). It keeps each opening's load impedance at `f` in `prepared.loads`.
 *
 * Left for the optimizer phase: each call still allocates (a complex number per stamp, each duct's chain matrix, the
 * result array). A search over many designs should stamp into the work arrays directly and reuse the result.
 */
function solveAt(prepared: Prepared, f: number): Complex[] | null {
  const { network, flowIndex, size, banks, loads, matrixRe, matrixIm, rhsRe, rhsIm } = prepared;
  matrixRe.fill(0);
  matrixIm.fill(0);
  rhsRe.fill(0);
  rhsIm.fill(0);
  const omega = 2 * Math.PI * f;
  /** adds `value` to the matrix at (row, column) */
  const stamp = (row: number, column: number, value: Complex) => {
    matrixRe[row * size + column] += value.re;
    matrixIm[row * size + column] += value.im;
  };
  const one = complex(1),
    minusOne = complex(-1);
  network.parts.forEach((part, index) => {
    const flow = flowIndex[index];
    switch (part.kind) {
      case NETWORK_PART.driver: {
        const bank = banks[index];
        if (!bank) return;
        // the coil's inductance turns the source and the electrical damping (lib/acoustics/driverCircuit coilFactor)
        const motor = coilFactor(motorOf(part), omega);
        /** the bank's own impedance: losses, electrical damping, mass against suspension */
        const driverImpedance = add(
          complex(bank.Ras, omega * bank.Mas - 1 / (omega * bank.Cas)),
          scale(motor, bank.Rae),
        );
        // p_front − p_rear + Z·U = source; the flow U leaves the rear node and enters the front node
        stamp(flow, part.front, one);
        stamp(flow, part.rear, minusOne);
        stamp(flow, flow, driverImpedance);
        const source = scale(motor, bank.Pg);
        rhsRe[flow] += source.re;
        rhsIm[flow] += source.im;
        stamp(part.front, flow, minusOne);
        stamp(part.rear, flow, one);
        return;
      }
      case NETWORK_PART.chamber: {
        /** the air's compliance, m³/Pa */
        const compliance = part.liters / LITERS_PER_CUBIC_M / AIR_STIFFNESS;
        const lossAdmittance =
          part.loss !== undefined && Number.isFinite(part.loss) ? 1 / part.loss : 0;
        stamp(part.node, part.node, complex(lossAdmittance, omega * compliance));
        return;
      }
      case NETWORK_PART.duct: {
        // p_from − loss·U₁ = A·p_to + B·U₂ and U₁ = C·p_to + D·U₂: U₁ leaves `from`, U₂ enters `to`
        const [a, b, c, d] = chainMatrix(part.segments, f);
        const flowIn = flow,
          flowOut = flow + 1;
        stamp(flowIn, part.from, one);
        stamp(flowIn, flowIn, complex(-part.loss));
        stamp(flowIn, part.to, scale(a, -1));
        stamp(flowIn, flowOut, scale(b, -1));
        stamp(flowOut, flowIn, one);
        stamp(flowOut, part.to, scale(c, -1));
        stamp(flowOut, flowOut, scale(d, -1));
        stamp(part.from, flowIn, one);
        stamp(part.to, flowOut, minusOne);
        return;
      }
      case NETWORK_PART.mass: {
        // p_from − p_to = (R + jωM)·U, U from `from` to `to`
        stamp(flow, part.from, one);
        stamp(flow, part.to, minusOne);
        stamp(flow, flow, complex(-part.resistance, -omega * part.mass));
        stamp(part.from, flow, one);
        stamp(part.to, flow, minusOne);
        return;
      }
      case NETWORK_PART.opening: {
        // p = Z·U, U out to the air
        const load = openingImpedance(part.load, network, f);
        loads[index] = load;
        stamp(flow, part.node, one);
        stamp(flow, flow, scale(load, -1));
        stamp(part.node, flow, one);
        return;
      }
    }
  });
  return eliminate(prepared);
}

/**
 * Gaussian elimination with partial pivoting on the prepared system, each row first scaled to its largest entry (the
 * node rows hold flows and admittances, the part rows impedances: many decades apart). Null when a pivot is zero or
 * below `SINGULAR_PIVOT` (singular to rounding).
 */
function eliminate({ size, matrixRe, matrixIm, rhsRe, rhsIm }: Prepared): Complex[] | null {
  for (let row = 0; row < size; row++) {
    let largest = 0;
    for (let column = 0; column < size; column++)
      largest = Math.max(
        largest,
        Math.hypot(matrixRe[row * size + column], matrixIm[row * size + column]),
      );
    if (largest === 0) return null;
    for (let column = 0; column < size; column++) {
      matrixRe[row * size + column] /= largest;
      matrixIm[row * size + column] /= largest;
    }
    rhsRe[row] /= largest;
    rhsIm[row] /= largest;
  }
  for (let pivot = 0; pivot < size; pivot++) {
    // the row with the largest entry in this column, from here down
    let best = pivot,
      bestSize = 0;
    for (let row = pivot; row < size; row++) {
      const entry = Math.hypot(matrixRe[row * size + pivot], matrixIm[row * size + pivot]);
      if (entry > bestSize) {
        best = row;
        bestSize = entry;
      }
    }
    if (bestSize < SINGULAR_PIVOT) return null;
    if (best !== pivot) {
      for (let column = 0; column < size; column++) {
        const i = pivot * size + column,
          j = best * size + column;
        [matrixRe[i], matrixRe[j]] = [matrixRe[j], matrixRe[i]];
        [matrixIm[i], matrixIm[j]] = [matrixIm[j], matrixIm[i]];
      }
      [rhsRe[pivot], rhsRe[best]] = [rhsRe[best], rhsRe[pivot]];
      [rhsIm[pivot], rhsIm[best]] = [rhsIm[best], rhsIm[pivot]];
    }
    /** the pivot's real and imaginary parts and its squared size */
    const pivotRe = matrixRe[pivot * size + pivot],
      pivotIm = matrixIm[pivot * size + pivot],
      pivotNorm = pivotRe * pivotRe + pivotIm * pivotIm;
    for (let row = pivot + 1; row < size; row++) {
      const entryRe = matrixRe[row * size + pivot],
        entryIm = matrixIm[row * size + pivot];
      if (entryRe === 0 && entryIm === 0) continue;
      // factor = entry / pivot
      const factorRe = (entryRe * pivotRe + entryIm * pivotIm) / pivotNorm,
        factorIm = (entryIm * pivotRe - entryRe * pivotIm) / pivotNorm;
      for (let column = pivot; column < size; column++) {
        const sourceRe = matrixRe[pivot * size + column],
          sourceIm = matrixIm[pivot * size + column];
        matrixRe[row * size + column] -= factorRe * sourceRe - factorIm * sourceIm;
        matrixIm[row * size + column] -= factorRe * sourceIm + factorIm * sourceRe;
      }
      rhsRe[row] -= factorRe * rhsRe[pivot] - factorIm * rhsIm[pivot];
      rhsIm[row] -= factorRe * rhsIm[pivot] + factorIm * rhsRe[pivot];
    }
  }
  // back substitution
  const result: Complex[] = Array.from({ length: size }, () => complex(0));
  for (let row = size - 1; row >= 0; row--) {
    let sumRe = rhsRe[row],
      sumIm = rhsIm[row];
    for (let column = row + 1; column < size; column++) {
      const entryRe = matrixRe[row * size + column],
        entryIm = matrixIm[row * size + column];
      sumRe -= entryRe * result[column].re - entryIm * result[column].im;
      sumIm -= entryRe * result[column].im + entryIm * result[column].re;
    }
    result[row] = divide(
      complex(sumRe, sumIm),
      complex(matrixRe[row * size + row], matrixIm[row * size + row]),
    );
  }
  return result;
}

/** Each part's flows in and out (see `NetworkState`), from the solved unknowns. */
function flowsOf(prepared: Prepared, unknowns: Complex[], f: number): NetworkState["flows"] {
  const omega = 2 * Math.PI * f;
  return prepared.network.parts.map((part, index) => {
    const flow = prepared.flowIndex[index];
    switch (part.kind) {
      case NETWORK_PART.chamber: {
        const compliance = part.liters / LITERS_PER_CUBIC_M / AIR_STIFFNESS;
        const lossAdmittance =
          part.loss !== undefined && Number.isFinite(part.loss) ? 1 / part.loss : 0;
        const into = multiply(unknowns[part.node], complex(lossAdmittance, omega * compliance));
        return { in: into, out: into };
      }
      case NETWORK_PART.duct:
        return { in: unknowns[flow], out: unknowns[flow + 1] };
      default:
        return { in: unknowns[flow], out: unknowns[flow] };
    }
  });
}

/**
 * The network's response at each frequency (Hz) with `volts` RMS on every driver: the summed pressure at 1 m (on axis
 * and from radiated power), its phase and group delay, each driver's excursion and impedance, and each part's flow.
 * Null when a size it divides by is not positive or the network cannot be solved at some frequency (as the horn
 * engine and the box models return null).
 */
export function networkResponse(
  network: AcousticNetwork,
  freqs: readonly number[],
  volts: number,
): NetworkResponse | null {
  const prepared = prepareNetwork(network, volts);
  if (!prepared || !freqs.every(isPositive)) return null;
  /** Ω, the solid angle, sr */
  const solidAngle = network.angle * Math.PI;
  const curve: NetworkPoint[] = [];
  /** the summed pressure's phase at each frequency, radians, before unwrapping */
  const phases: number[] = [];
  for (const f of freqs) {
    const unknowns = solveAt(prepared, f);
    if (!unknowns) return null;
    const omega = 2 * Math.PI * f,
      k = omega / SPEED_OF_SOUND;
    const flows = flowsOf(prepared, unknowns, f);
    // a small source's pressure at r = 1 m in the solid angle Ω, all boxes together: p = jωρ·count·flow/(Ω·r)
    const pressureOf = (flow: Complex) =>
      scale(multiply(imaginary(omega * AIR_DENSITY), flow), network.count / solidAngle);
    let pressure = complex(0),
      powerPressure = complex(0);
    const xmm: number[] = [],
      ze: number[] = [];
    network.parts.forEach((part, index) => {
      /** the opening's load impedance at f, as the solve stamped it (null for other parts) */
      const load = prepared.loads[index];
      if (part.kind === NETWORK_PART.opening && part.radiates && load) {
        // the opening's flow, delayed by its setback behind the mouth
        const delayed = multiply(flows[index].out, exp(complex(0, (-k * part.setback) / CM_PER_M)));
        const own = pressureOf(delayed);
        pressure = add(pressure, own);
        // Hornresp's SPL: a piston's pressure from its radiated power; a leak or an open node has no radiation load
        powerPressure = add(
          powerPressure,
          part.load.kind === OPENING_LOAD.piston
            ? scale(own, powerScale(load.re, omega, solidAngle, network.count))
            : own,
        );
      }
      const bank = prepared.banks[index];
      if (part.kind === NETWORK_PART.driver && bank) {
        const coneFlow = flows[index].out;
        // volts are RMS: √2 turns RMS travel into a sine's peak, as the box models do
        xmm.push(Math.SQRT2 * (abs(coneFlow) / (omega * bank.Sd)) * MILLI);
        // one voice coil's Ze: the coil plus (Bl/Sd)² over one cone's acoustic load without its electrical damping,
        // the load the bank's source sees (source / flow) less that damping, times the number of cones
        const motor = coilFactor(motorOf(part), omega);
        const totalImpedance = divide(scale(motor, bank.Pg), coneFlow);
        const motionalLoad = scale(subtract(totalImpedance, scale(motor, bank.Rae)), part.drivers);
        const electrical = add(
          coilImpedance(part.ts, omega),
          divide(complex(bank.forcePerArea * bank.forcePerArea), motionalLoad),
        );
        ze.push(abs(electrical));
      }
    });
    phases.push(arg(pressure));
    curve.push({
      f,
      spl: 20 * Math.log10(abs(pressure) / SPL_REFERENCE_PA),
      powerSpl: 20 * Math.log10(abs(powerPressure) / SPL_REFERENCE_PA),
      phase: 0,
      delay: 0,
      xmm,
      ze,
      flows: flows.map((flow) => Math.SQRT2 * abs(flow.in)),
    });
  }
  setPhaseAndDelay(curve, phases);
  return { curve };
}
