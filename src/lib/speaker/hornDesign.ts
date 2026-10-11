// A speaker spec's chamber as the horn engine (lib/acoustics/hornModel) takes it: a front-loaded horn, or a direct
// radiator (no segments), with the chamber's own net air and vent as the rear chamber. Pure.
import type {
  BoxModelTS,
  ChamberVent,
  HornDesign,
  HornDesignResult,
  HornEngineGap,
  HornPort,
  SpeakerChamber,
  SpeakerDriver,
} from "../../types";
import { FILL_OPTIONS, MID_OPTIONS, SUB_OPTIONS, hifiDriverById } from "../data";
import { byId } from "../tables";
import { hifiRoundEndCorrection, portArea } from "../hifi/hifi";
import { CM_PER_M, METERS_PER_INCH } from "../../constants/units";
import {
  CHAMBER_LOAD,
  DRIVER_KIND,
  HORN_DRIVE,
  HORN_ENGINE_GAP,
  PORT_SHAPE,
  VENT_KIND,
} from "../../constants/speakerSpec";

/** Centimeters in one inch: the spec's ports are in inches, the engine's in Hornresp's cm. */
const CM_PER_IN = METERS_PER_INCH * CM_PER_M;

/** A driver's Thiele/Small parameters from its catalog table; null for a kind with none (compression, tweeter). */
function driverTs(driver: SpeakerDriver): BoxModelTS | null {
  switch (driver.kind) {
    case DRIVER_KIND.sub:
      return byId(SUB_OPTIONS, driver.driverId)?.ts ?? null;
    case DRIVER_KIND.mid:
      return byId(MID_OPTIONS, driver.driverId)?.ts ?? null;
    case DRIVER_KIND.woofer:
      return hifiDriverById("woofer", driver.driverId)?.ts ?? null;
    case DRIVER_KIND.coaxial:
      return byId(FILL_OPTIONS, driver.driverId)?.ts ?? null;
    case DRIVER_KIND.compression:
    case DRIVER_KIND.tweeter:
      return null;
  }
}

/**
 * The rear chamber's vent as the engine's port: none when sealed; round tubes as their open area and their length
 * with both ends' corrections (lib/hifi `hifiRoundEndCorrection`). Null: a vent the engine doesn't take yet.
 */
function rearPort(vent: ChamberVent): { port: HornPort | null } | null {
  if (vent.kind === VENT_KIND.sealed) return { port: null };
  if (vent.kind === VENT_KIND.radiator) return null;
  const { port } = vent;
  if (port.shape === PORT_SHAPE.slot || port.shape === PORT_SHAPE.duct) return null;
  return {
    port: {
      area: portArea(port) * CM_PER_IN * CM_PER_IN,
      effectiveLength: (port.len + hifiRoundEndCorrection(port, port.elbows ?? 0)) * CM_PER_IN,
    },
  };
}

/** A result that names the gap. */
const gap = (why: HornEngineGap): HornDesignResult => ({ ok: false, gap: why });

/**
 * The chamber as a horn design, `at.count` boxes side by side radiating into `at.angle`, or the first gap that stops
 * it: a tapped horn; not exactly one driver (count 1) with Thiele/Small parameters; no net air set; a slot, side ducts
 * or radiators. A direct chamber is a design with no segments.
 */
export function hornDesignOf(
  chamber: SpeakerChamber,
  at: Pick<HornDesign, "count" | "angle">,
): HornDesignResult {
  const horn = chamber.load.kind === CHAMBER_LOAD.horn ? chamber.load.horn : null;
  if (horn?.drive.kind === HORN_DRIVE.tapped) return gap(HORN_ENGINE_GAP.tapped);
  const { drivers, netLiters } = chamber;
  const ts = drivers.length === 1 && drivers[0].count === 1 ? driverTs(drivers[0]) : null;
  if (!ts) return gap(HORN_ENGINE_GAP.driver);
  if (netLiters === null) return gap(HORN_ENGINE_GAP.netLiters);
  const rear = rearPort(chamber.vent);
  if (!rear) return gap(HORN_ENGINE_GAP.vent);
  return {
    ok: true,
    design: {
      driver: ts,
      count: at.count,
      throatChamber: horn?.throatChamber ?? 0,
      segments: horn?.segments ?? [],
      rear: { liters: netLiters, port: rear.port },
      angle: at.angle,
      portOffset: horn?.portOffset ?? 0,
    },
  };
}
