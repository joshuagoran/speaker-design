// Presets for the acoustic network engine (lib/acoustics/network/solve): small builders that wire the parts of a
// known box or horn into a network. Front-loaded, offset-driver and tapped horns are one horn path with the driver's
// sides at different points; the sealed and vented boxes are the box models' circuits (lib/acoustics/boxModels).
//
// A horn path runs from segment boundary 0 to boundary n (n segments). Every boundary a driver side taps gets a node,
// and so do boundary 0 (a closed end, unless a side taps it) and the mouth (boundary n). Ducts join the nodes in order.
// So a front-loaded horn is the path tapped at 0, an offset-driver horn the path tapped further along (the stub before
// the tap is closed at its start), and a tapped horn the path tapped at two points.
//
// The chambers follow Hornresp: a front-loaded or offset-driver horn's throat and rear chambers are lumped volumes at
// their node (its masked chamber resonances); a tapped horn's chambers are straight passages from the cones to their
// taps (its TH model), so the cones' sides get nodes of their own at the passages' cone ends.
//
// Words used below: "flow" is volume velocity (m³/s); "impedance" is acoustic impedance (Pa·s/m³). Units of the
// designs are Hornresp's (cm², cm, L), as the horn engine's.
import type {
  AcousticNetwork,
  HornDesign,
  HornLayoutDesign,
  HornModel,
  HornPoint,
  HornRearChamber,
  NetworkPart,
  OffsetDriverHornDesign,
  PresetNetwork,
  TapChamber,
  TappedHornDesign,
} from "../../../types";
import { AIR_DENSITY, BOX_LEAK_Q, BOX_PORT_Q } from "../../../constants/acoustics";
import {
  HORN_LAYOUT,
  NETWORK_PART,
  OPENING_LOAD,
  REAR_SIDE,
} from "../../../constants/acousticNetwork";
import {
  CM3_PER_LITER,
  CM_PER_M,
  LITERS_PER_CUBIC_M,
  SQ_CM_PER_SQ_M,
} from "../../../constants/units";
import {
  AIR_STIFFNESS,
  oneSideAirMass,
  ventDuct,
  ventOf,
  type HornModelOptions,
} from "../hornModel";
import { networkResponse } from "./solve";

/** The horn presets' options: the horn engine's, and whether a leak's flow radiates. */
export interface HornNetworkOptions extends HornModelOptions {
  /**
   * Whether the rear chamber's leak radiates its flow, as the box models and the horn engine take it (true, the
   * default), or is a pure loss, as Hornresp takes it (false).
   */
  leakRadiates?: boolean;
  /** the amplifier's output resistance in series with each coil, ohms (Hornresp's Rg); absent: none */
  sourceResistance?: number;
}

/** What the driver's rear drives: a sealed or vented chamber of its own, or a tap on the path (through a passage). */
type RearSide =
  | { kind: typeof REAR_SIDE.chamber; rear: HornRearChamber; portOffset: number }
  | { kind: typeof REAR_SIDE.tap; tap: number; passage: TapChamber | null };

/** One horn path with the driver's sides on it: the general builder behind the three horn presets. */
interface HornPathSpec extends Pick<
  HornDesign,
  "driver" | "drivers" | "count" | "angle" | "segments" | "throatChamber"
> {
  /** the segment boundary the fronts tap: 0 the closed end, `segments.length` the mouth */
  frontTap: number;
  /** a passage between the fronts and their tap (a tapped horn's), in place of the lumped `throatChamber`; or null */
  frontPassage: TapChamber | null;
  rear: RearSide;
}

/** A tap chamber's passage as a straight duct: its area, cm², and its length, its volume over its area, cm. */
const passageDuct = (passage: TapChamber) =>
  ventDuct(passage.area, (passage.liters * CM3_PER_LITER) / passage.area);

/** The duct of a tap chamber's passage, from the cones' side `from` to its tap's node `to`. */
const passageOf = (from: number, to: number, passage: TapChamber): NetworkPart => ({
  kind: NETWORK_PART.duct,
  from,
  to,
  segments: [passageDuct(passage)],
  loss: 0,
});

/** Whether a tap is a whole segment boundary on the path, from 0 to the segment count. */
const isBoundary = (tap: number, segments: readonly unknown[]) =>
  Number.isInteger(tap) && tap >= 0 && tap <= segments.length;

/**
 * Builds the network of one horn path (see the header), or null when a tap is not a segment boundary or a passage has
 * no size. The parts come in a fixed order: the driver, the front side's chamber, the path's ducts, the mouth, then the
 * rear side.
 */
function hornPath(spec: HornPathSpec, opts: HornNetworkOptions): PresetNetwork | null {
  const { radiationLoad = true, QL = BOX_LEAK_Q, Qp = BOX_PORT_Q, leakRadiates = true } = opts;
  const { segments, driver, drivers } = spec;
  const rearTap = spec.rear.kind === REAR_SIDE.tap ? spec.rear.tap : null;
  if (!isBoundary(spec.frontTap, segments) || (rearTap !== null && !isBoundary(rearTap, segments)))
    return null;
  /** a passage with no area or no air cannot be modeled */
  const unsized = (passage: TapChamber | null) =>
    passage !== null && !(passage.area > 0 && passage.liters > 0);
  if (
    unsized(spec.frontPassage) ||
    (spec.rear.kind === REAR_SIDE.tap && unsized(spec.rear.passage))
  )
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
  /** the rear tap's passage, if any */
  const rearPassage = spec.rear.kind === REAR_SIDE.tap ? spec.rear.passage : null;
  /** the cones' own sides: their tap's node, or a node of their own at a passage's cone end */
  const coneFront = spec.frontPassage ? nodeCount++ : frontNode;
  const coneRear = rearPassage ? nodeCount++ : rearNode;
  const parts: NetworkPart[] = [
    {
      kind: NETWORK_PART.driver,
      front: coneFront,
      rear: coneRear,
      ts: driver,
      drivers,
      airMassOff: radiationLoad ? oneSideAirMass(driver.Sd) : 0,
      ...(opts.sourceResistance ? { sourceResistance: opts.sourceResistance } : {}),
    },
  ];
  if (spec.frontPassage) parts.push(passageOf(coneFront, frontNode, spec.frontPassage));
  else if (spec.throatChamber > 0)
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
    if (rearPassage) parts.push(passageOf(coneRear, rearNode, rearPassage));
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
      frontPassage: null,
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
      frontPassage: null,
      rear: { kind: REAR_SIDE.chamber, rear: design.rear, portOffset: design.portOffset },
    },
    opts,
  );

/**
 * A tapped horn (Hornresp's TH) as a network: one path closed at its start; the fronts tap it at `frontTap` and the
 * rears at `rearTap`, each through its chamber's passage when it has one; only the mouth radiates. Null when a tap is
 * not a segment boundary or a passage has no size.
 */
export const tappedHorn = (design: TappedHornDesign, opts: HornNetworkOptions = {}) =>
  hornPath(
    {
      ...design,
      throatChamber: 0,
      frontPassage: design.frontChamber,
      rear: { kind: REAR_SIDE.tap, tap: design.rearTap, passage: design.rearChamber },
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
