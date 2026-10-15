// Presets for the acoustic network engine (lib/acoustics/network/solve): small builders that wire the parts of a
// known box or horn into a network. Front-loaded, offset-driver and tapped horns are one horn path with the driver's
// sides at different points; the sealed and vented boxes are the box models' circuits (lib/pa/calc).
//
// A horn path runs from segment boundary 0 to boundary n (n segments). Every boundary a driver side taps gets a node,
// and so do boundary 0 (a closed end, unless a side taps it) and the mouth (boundary n). Ducts join the nodes in order.
// So a front-loaded horn is the path tapped at 0, an offset-driver horn the path tapped further along (the stub before
// the tap is closed at its start), and a tapped horn the path tapped at two points.
//
// Words used below: "flow" is volume velocity (m³/s); "impedance" is acoustic impedance (Pa·s/m³). Units of the
// designs are Hornresp's (cm², cm, L), as the horn engine's.
import type {
  AcousticNetwork,
  BoxModelTS,
  HornDesign,
  HornLayoutDesign,
  HornModel,
  HornPoint,
  HornRearChamber,
  NetworkPart,
  OffsetDriverHornDesign,
  PresetNetwork,
  TappedHornDesign,
} from "../../../types";
import { AIR_DENSITY, BOX_LEAK_Q, BOX_PORT_Q } from "../../../constants/acoustics";
import {
  HORN_LAYOUT,
  NETWORK_PART,
  OPENING_LOAD,
  REAR_SIDE,
} from "../../../constants/acousticNetwork";
import { CM_PER_M, LITERS_PER_CUBIC_M, SQ_CM_PER_SQ_M } from "../../../constants/units";
import { ventResistances } from "../driverCircuit";
import { AIR_STIFFNESS, ventDuct, ventOf, type HornModelOptions } from "../hornModel";
import { ventTuning, type BoxModelOptions } from "../../pa/calc";
import { networkResponse } from "./solve";

/** Square meters per square inch. */
const SQ_M_PER_SQ_IN = 0.00064516;

/** The horn presets' options: the horn engine's, and whether a leak's flow radiates. */
export interface HornNetworkOptions extends HornModelOptions {
  /**
   * Whether the rear chamber's leak radiates its flow, as the box models and the horn engine take it (true, the
   * default), or is a pure loss, as Hornresp takes it (false).
   */
  leakRadiates?: boolean;
}

/** One side's air load on a piston of one cone's area Sd (cm²): 8/3·ρa³, kg, a the cone's radius. */
const oneSideAirMass = (coneAreaCm2: number) =>
  (8 / 3) * AIR_DENSITY * Math.pow(coneAreaCm2 / SQ_CM_PER_SQ_M / Math.PI, 1.5);

/** What the driver's rear drives: a sealed or vented chamber of its own, or a tap on the path. */
type RearSide =
  | { kind: typeof REAR_SIDE.chamber; rear: HornRearChamber; portOffset: number }
  | { kind: typeof REAR_SIDE.tap; tap: number; liters: number };

/** One horn path with the driver's sides on it: the general builder behind the three horn presets. */
interface HornPathSpec extends Pick<
  HornDesign,
  "driver" | "drivers" | "count" | "angle" | "segments" | "throatChamber"
> {
  /** the segment boundary the fronts tap: 0 the closed end, `segments.length` the mouth */
  frontTap: number;
  rear: RearSide;
}

/** Whether a tap is a whole segment boundary on the path, from 0 to the segment count. */
const isBoundary = (tap: number, segments: readonly unknown[]) =>
  Number.isInteger(tap) && tap >= 0 && tap <= segments.length;

/**
 * Builds the network of one horn path (see the header), or null when a tap is not a segment boundary. The parts come
 * in a fixed order: the driver, the front side's chamber, the path's ducts, the mouth, then the rear side.
 */
function hornPath(spec: HornPathSpec, opts: HornNetworkOptions): PresetNetwork | null {
  const { radiationLoad = true, QL = BOX_LEAK_Q, Qp = BOX_PORT_Q, leakRadiates = true } = opts;
  const { segments, driver, drivers } = spec;
  const rearTap = spec.rear.kind === REAR_SIDE.tap ? spec.rear.tap : null;
  if (!isBoundary(spec.frontTap, segments) || (rearTap !== null && !isBoundary(rearTap, segments)))
    return null;
  /** the boundaries that get a node, in order along the path: the closed end, the taps, the mouth */
  const boundaries = [
    ...new Set([0, spec.frontTap, ...(rearTap === null ? [] : [rearTap]), segments.length]),
  ].sort((a, b) => a - b);
  // boundary 0 is the closed end, or the front tap itself when it is 0 (a front-loaded horn has no stub)
  /** the node at each boundary that has one */
  const nodeAt = new Map(boundaries.map((boundary, index) => [boundary, index]));
  let nodeCount = boundaries.length;
  const frontNode = nodeAt.get(spec.frontTap) ?? 0;
  const mouthNode = nodeAt.get(segments.length) ?? 0;
  /** the rear side's node: a chamber of its own, or the rear tap's */
  const rearNode = rearTap === null ? nodeCount++ : (nodeAt.get(rearTap) ?? 0);
  const parts: NetworkPart[] = [
    {
      kind: NETWORK_PART.driver,
      front: frontNode,
      rear: rearNode,
      ts: driver,
      drivers,
      airMassOff: radiationLoad ? oneSideAirMass(driver.Sd) : 0,
    },
  ];
  if (spec.throatChamber > 0)
    parts.push({ kind: NETWORK_PART.chamber, node: frontNode, liters: spec.throatChamber });
  /** the part whose flow in is the throat's (see PresetNetwork) */
  let throat = -1;
  for (let i = 0; i + 1 < boundaries.length; i++) {
    const start = boundaries[i],
      end = boundaries[i + 1];
    if (start === spec.frontTap && end > start) throat = parts.length;
    parts.push({
      kind: NETWORK_PART.duct,
      from: nodeAt.get(start) ?? 0,
      to: nodeAt.get(end) ?? 0,
      segments: segments.slice(start, end),
      loss: 0,
    });
  }
  /** the mouth's area, m²: the last segment's end, or the cones themselves with no segments */
  const mouthArea =
    (segments.length ? segments[segments.length - 1].s2 : driver.Sd * drivers) / SQ_CM_PER_SQ_M;
  if (throat < 0) throat = parts.length;
  parts.push({
    kind: NETWORK_PART.opening,
    node: mouthNode,
    load: radiationLoad
      ? { kind: OPENING_LOAD.piston, area: mouthArea, reactanceRatio: 1 }
      : { kind: OPENING_LOAD.open },
    radiates: true,
    setback: 0,
  });
  /** the throat's area, m²: the duct's start, or the mouth when the fronts are at the mouth */
  const throatArea =
    spec.frontTap < segments.length ? segments[spec.frontTap].s1 / SQ_CM_PER_SQ_M : mouthArea;
  let vent: number | null = null,
    ventArea = 0,
    fb: number | null = null;
  if (spec.rear.kind === REAR_SIDE.tap) {
    if (spec.rear.liters > 0)
      parts.push({ kind: NETWORK_PART.chamber, node: rearNode, liters: spec.rear.liters });
  } else {
    const { rear, portOffset } = spec.rear;
    parts.push({ kind: NETWORK_PART.chamber, node: rearNode, liters: rear.liters });
    /** the rear chamber's compliance, m³/Pa (Small's Cab) */
    const Cab = rear.liters / LITERS_PER_CUBIC_M / AIR_STIFFNESS;
    const tuned = ventOf(
      { rear, angle: spec.angle, count: spec.count },
      Cab,
      radiationLoad,
      QL,
      Qp,
    );
    if (tuned && rear.port) {
      const exitNode = nodeCount++;
      vent = parts.length;
      ventArea = tuned.Sp;
      fb = tuned.Fb;
      parts.push(
        radiationLoad
          ? {
              kind: NETWORK_PART.duct,
              from: rearNode,
              to: exitNode,
              segments: [ventDuct(rear.port.area, rear.port.length)],
              loss: tuned.Rap,
            }
          : {
              kind: NETWORK_PART.mass,
              from: rearNode,
              to: exitNode,
              mass: (AIR_DENSITY * (rear.port.length / CM_PER_M)) / tuned.Sp,
              resistance: tuned.Rap,
            },
        {
          kind: NETWORK_PART.opening,
          node: exitNode,
          load: radiationLoad
            ? {
                kind: OPENING_LOAD.piston,
                area: tuned.Sp,
                reactanceRatio: tuned.exitReactanceRatio,
              }
            : { kind: OPENING_LOAD.open },
          radiates: true,
          setback: portOffset,
        },
      );
      if (Number.isFinite(tuned.Ral))
        parts.push({
          kind: NETWORK_PART.opening,
          node: rearNode,
          load: { kind: OPENING_LOAD.resistance, resistance: tuned.Ral },
          radiates: leakRadiates,
          setback: portOffset,
        });
    }
  }
  const network: AcousticNetwork = { nodeCount, parts, angle: spec.angle, count: spec.count };
  return { network, driver: 0, throat, throatArea, vent, ventArea, fb };
}

/**
 * A front-loaded horn (or, with no segments, a direct radiator) as a network: the cones' fronts at the throat through
 * the throat chamber, the horn's segments to the mouth, their rears in a sealed or vented rear chamber. The same parts
 * as the horn engine (lib/acoustics/hornModel), so the same results.
 */
export const frontLoadedHorn = (design: HornDesign, opts: HornNetworkOptions = {}) =>
  hornPath(
    {
      ...design,
      frontTap: 0,
      rear: { kind: REAR_SIDE.chamber, rear: design.rear, portOffset: design.portOffset },
    },
    opts,
  );

/**
 * An offset-driver horn (Hornresp's OD) as a network: the path starts at a closed end and the fronts tap it at segment
 * boundary `tap`, through the throat chamber; the rears drive a sealed or vented rear chamber. Tap 0 is the
 * front-loaded horn. Null when the tap is not a segment boundary.
 */
export const offsetDriverHorn = (design: OffsetDriverHornDesign, opts: HornNetworkOptions = {}) =>
  hornPath(
    {
      ...design,
      frontTap: design.tap,
      rear: { kind: REAR_SIDE.chamber, rear: design.rear, portOffset: design.portOffset },
    },
    opts,
  );

/**
 * A tapped horn (Hornresp's TH) as a network: one path closed at its start; the fronts tap it at `frontTap` (through
 * the throat chamber) and the rears at `rearTap` (through the rear chamber); only the mouth radiates. Null when a tap
 * is not a segment boundary.
 */
export const tappedHorn = (design: TappedHornDesign, opts: HornNetworkOptions = {}) =>
  hornPath(
    {
      ...design,
      frontTap: design.frontTap,
      rear: { kind: REAR_SIDE.tap, tap: design.rearTap, liters: design.rearChamber },
    },
    opts,
  );

/** The network of a horn path design, by its layout (`HORN_LAYOUT`). */
export function hornLayoutNetwork(design: HornLayoutDesign, opts: HornNetworkOptions = {}) {
  switch (design.layout) {
    case HORN_LAYOUT.frontLoaded:
      return frontLoadedHorn(design, opts);
    case HORN_LAYOUT.offsetDriver:
      return offsetDriverHorn(design, opts);
    case HORN_LAYOUT.tapped:
      return tappedHorn(design, opts);
  }
}

/**
 * A preset's response as the horn engine gives one (`HornModel`): its SPLs, phase, delay, the driver's excursion and
 * impedance, and the vent's and throat's air speeds (peak, m/s). Null when the network cannot be modeled.
 */
export function presetModel(
  preset: PresetNetwork,
  freqs: readonly number[],
  volts: number,
): HornModel | null {
  const response = networkResponse(preset.network, freqs, volts);
  if (!response) return null;
  // the network's driver is the preset's first, and only, driver part: its readouts are each point's first
  const curve: HornPoint[] = response.curve.map((point) => ({
    f: point.f,
    spl: point.spl,
    powerSpl: point.powerSpl,
    phase: point.phase,
    delay: point.delay,
    xmm: point.xmm[0],
    portSpeed: preset.vent === null ? 0 : point.flows[preset.vent] / preset.ventArea,
    throatSpeed: point.flows[preset.throat] / preset.throatArea,
    ze: point.ze[0],
  }));
  return { curve, fb: preset.fb };
}

/**
 * The sealed box model (lib/pa/calc closedBox) as a network: the cone's front open to the air, its rear on the box's
 * air. No radiation load, as the box model.
 */
export function sealedBox(ts: BoxModelTS, liters: number): PresetNetwork {
  const front = 0,
    rear = 1;
  return {
    network: {
      nodeCount: 2,
      parts: [
        { kind: NETWORK_PART.driver, front, rear, ts, drivers: 1, airMassOff: 0 },
        {
          kind: NETWORK_PART.opening,
          node: front,
          load: { kind: OPENING_LOAD.open },
          radiates: true,
          setback: 0,
        },
        { kind: NETWORK_PART.chamber, node: rear, liters },
      ],
      angle: 2,
      count: 1,
    },
    driver: 0,
    throat: 1,
    throatArea: ts.Sd / SQ_CM_PER_SQ_M,
    vent: null,
    ventArea: 0,
    fb: null,
  };
}

/**
 * The vented box model (lib/pa/calc boxModel) as a network, from the same inputs: net liters, the vent's total area
 * (in²) and physical length (in), and its options (openings, QL, Qp, end correction). The vent is a lumped mass of its
 * effective length (`ventTuning`) with its loss; the leak radiates, as in the box model. No radiation load.
 */
export function ventedBox(
  ts: BoxModelTS,
  liters: number,
  ventSquareInches: number,
  ventInches: number,
  opts: Pick<BoxModelOptions, "nPorts" | "QL" | "Qp" | "ecIn"> = {},
): PresetNetwork {
  const { nPorts = 1, QL = BOX_LEAK_Q, Qp = BOX_PORT_Q, ecIn } = opts;
  /** the vent's effective length (m) and the tuning (Hz) */
  const { Leff, Fb } = ventTuning(liters, ventSquareInches, ventInches, nPorts, ecIn);
  /** the vent's area, m²; the box's compliance, m³/Pa; the vent's acoustic mass, kg/m⁴ */
  const Sp = ventSquareInches * SQ_M_PER_SQ_IN,
    Cab = liters / LITERS_PER_CUBIC_M / AIR_STIFFNESS,
    Map = (AIR_DENSITY * Leff) / Sp;
  const { Ral, Rap } = ventResistances(Fb, Cab, Map, QL, Qp);
  const front = 0,
    box = 1,
    exit = 2;
  const parts: NetworkPart[] = [
    { kind: NETWORK_PART.driver, front, rear: box, ts, drivers: 1, airMassOff: 0 },
    {
      kind: NETWORK_PART.opening,
      node: front,
      load: { kind: OPENING_LOAD.open },
      radiates: true,
      setback: 0,
    },
    { kind: NETWORK_PART.chamber, node: box, liters },
    { kind: NETWORK_PART.mass, from: box, to: exit, mass: Map, resistance: Rap },
    {
      kind: NETWORK_PART.opening,
      node: exit,
      load: { kind: OPENING_LOAD.open },
      radiates: true,
      setback: 0,
    },
  ];
  if (Number.isFinite(Ral))
    parts.push({
      kind: NETWORK_PART.opening,
      node: box,
      load: { kind: OPENING_LOAD.resistance, resistance: Ral },
      radiates: true,
      setback: 0,
    });
  return {
    network: { nodeCount: 3, parts, angle: 2, count: 1 },
    driver: 0,
    throat: 1,
    throatArea: ts.Sd / SQ_CM_PER_SQ_M,
    vent: 3,
    ventArea: Sp,
    fb: Fb,
  };
}
