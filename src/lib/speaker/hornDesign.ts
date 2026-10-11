// A speaker spec's chamber as the horn engine (lib/acoustics/hornModel) takes it: a front-loaded horn, or a direct
// radiator (no segments), with the chamber's own net air and vent as the rear chamber. Pure.
import type {
  ChamberVent,
  HornDesign,
  HornDesignResult,
  HornEngineGap,
  HornPort,
  SpeakerChamber,
  SpeakerDriver,
} from "../../types";
import { coneParts } from "./driverParts";
import { hifiRoundEndCorrection, portArea } from "../hifi/hifi";
import { BOTH_ENDS_CORRECTION_RATIO, rectangleEndCorrection } from "../pa/calc";
import { CM_PER_M, METERS_PER_INCH } from "../../constants/units";
import {
  CHAMBER_LOAD,
  HORN_DRIVE,
  HORN_ENGINE_GAP,
  PORT_SHAPE,
  VENT_KIND,
} from "../../constants/speakerSpec";

/** Centimeters in one inch: the spec's ports are in inches, the engine's in Hornresp's cm. */
const CM_PER_IN = METERS_PER_INCH * CM_PER_M;

/**
 * The chamber's drivers as the engine takes them: one driver's Thiele/Small parameters and how many share the throat
 * (Hornresp's Nd; the engine wires them in parallel, each on the full voltage, as the PA plans wire two 8 Ω subs to
 * one 4 Ω channel). Null: no driver, drivers of more than one kind or id, or no Thiele/Small parameters.
 */
function throatDrivers(
  drivers: readonly SpeakerDriver[],
): Pick<HornDesign, "driver" | "drivers"> | null {
  if (drivers.length === 0) return null;
  const [first] = drivers;
  if (drivers.some((d) => d.kind !== first.kind || d.driverId !== first.driverId)) return null;
  const ts = coneParts(first)?.ts;
  return ts ? { driver: ts, drivers: drivers.reduce((sum, d) => sum + d.count, 0) } : null;
}

/** A free (inner) end's correction over a flanged (outer) one's: 0.61 r over 0.85 r. */
const INNER_END_RATIO = BOTH_ENDS_CORRECTION_RATIO - 1;

/**
 * The rear chamber's vent as the engine's port: none when sealed; round tubes or slots of a set width as their open
 * area and their path length plus the inner end's correction (the engine's radiation load adds the outer end's). Null:
 * a vent the engine doesn't take yet (side ducts, radiators, a slot whose width the box sets). The end corrections
 * are horn engine phase 2's to settle; the Hi-fi round-tube rule and the PA's flanged rectangle stand in.
 */
function rearPort(vent: ChamberVent): { port: HornPort | null } | null {
  if (vent.kind === VENT_KIND.sealed) return { port: null };
  if (vent.kind === VENT_KIND.radiator) return null;
  const { port } = vent;
  if (port.shape === PORT_SHAPE.duct) return null;
  if (port.shape === PORT_SHAPE.slot) {
    if (port.w === undefined) return null;
    return {
      port: {
        area: port.n * port.h * port.w * CM_PER_IN * CM_PER_IN,
        length: (port.len + INNER_END_RATIO * rectangleEndCorrection(port.h, port.w)) * CM_PER_IN,
      },
    };
  }
  return {
    port: {
      area: portArea(port) * CM_PER_IN * CM_PER_IN,
      // both ends and the elbows, less the flanged outer end (1.46 r / BOTH_ENDS_CORRECTION_RATIO = 0.85 r); absent
      // elbows: a straight tube (the read adapters store the elbows their models work out)
      length:
        (port.len +
          hifiRoundEndCorrection(port, port.elbows ?? 0) -
          hifiRoundEndCorrection(port, 0) / BOTH_ENDS_CORRECTION_RATIO) *
        CM_PER_IN,
    },
  };
}

/** A result that names the gap. */
const gap = (why: HornEngineGap): HornDesignResult => ({ ok: false, gap: why });

/**
 * The chamber as a horn design, `at.count` boxes side by side radiating into `at.angle`, or the first gap that stops
 * it: a tapped or back-loaded horn; drivers of more than one kind, or none with Thiele/Small parameters; no net air
 * set; a vent the engine doesn't take. Several alike drivers share the throat (`throatDrivers`). A direct chamber is
 * a design with no segments.
 */
export function hornDesignOf(
  chamber: SpeakerChamber,
  at: Pick<HornDesign, "count" | "angle">,
): HornDesignResult {
  const horn = chamber.load.kind === CHAMBER_LOAD.horn ? chamber.load.horn : null;
  if (horn?.drive.kind === HORN_DRIVE.tapped) return gap(HORN_ENGINE_GAP.tapped);
  if (horn?.drive.kind === HORN_DRIVE.back) return gap(HORN_ENGINE_GAP.backLoaded);
  /** the drivers on the throat */
  const throat = throatDrivers(chamber.drivers);
  if (!throat) return gap(HORN_ENGINE_GAP.driver);
  const { netLiters } = chamber;
  if (netLiters === null) return gap(HORN_ENGINE_GAP.netLiters);
  /** the rear chamber's vent as the engine's port */
  const rear = rearPort(chamber.vent);
  if (!rear) return gap(HORN_ENGINE_GAP.vent);
  return {
    ok: true,
    design: {
      ...throat,
      count: at.count,
      throatChamber: horn?.throatChamber ?? 0,
      segments: horn?.segments ?? [],
      rear: { liters: netLiters, port: rear.port },
      angle: at.angle,
      portOffset: horn?.portOffset ?? 0,
    },
  };
}
