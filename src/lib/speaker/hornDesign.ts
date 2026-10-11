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
import { BOTH_ENDS_CORRECTION_RATIO, rectangleEndCorrection } from "../pa/calc";
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
 * The chamber's drivers as one equivalent driver, as Hornresp's Nd: `n` identical drivers wired in parallel, each on
 * the amp's full voltage (as the PA plans wire two 8 Ω subs to one 4 Ω channel, and as the engine's `volts` is "on
 * each driver"). The cone area and moving mass add (so the compliance divides), the coil resistance divides, and Bl,
 * Fs, Qms and Xmax stay. Null: no driver, drivers of more than one kind or id, or no Thiele/Small parameters.
 */
function equivalentDriver(drivers: readonly SpeakerDriver[]): BoxModelTS | null {
  if (drivers.length === 0) return null;
  const [first] = drivers;
  if (drivers.some((d) => d.kind !== first.kind || d.driverId !== first.driverId)) return null;
  const ts = driverTs(first);
  if (!ts) return null;
  const n = drivers.reduce((sum, d) => sum + d.count, 0);
  return {
    Fs: ts.Fs,
    Qms: ts.Qms,
    Xmax: ts.Xmax,
    Bl: ts.Bl,
    Sd: n * ts.Sd,
    Mms: n * ts.Mms,
    Re: ts.Re / n,
  };
}

/**
 * The rear chamber's vent as the engine's port: none when sealed; round tubes or slots of a set width as their open
 * area and their path length with both ends' corrections. Null: a vent the engine doesn't take yet (side ducts,
 * radiators, a slot whose width the box sets). The end corrections are horn engine phase 2's to settle; the Hi-fi
 * round-tube rule and the PA's flanged rectangle stand in.
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
        effectiveLength:
          (port.len + BOTH_ENDS_CORRECTION_RATIO * rectangleEndCorrection(port.h, port.w)) *
          CM_PER_IN,
      },
    };
  }
  return {
    port: {
      area: portArea(port) * CM_PER_IN * CM_PER_IN,
      // absent elbows: a straight tube (the read adapters store the elbows their models work out)
      effectiveLength: (port.len + hifiRoundEndCorrection(port, port.elbows ?? 0)) * CM_PER_IN,
    },
  };
}

/** A result that names the gap. */
const gap = (why: HornEngineGap): HornDesignResult => ({ ok: false, gap: why });

/**
 * The chamber as a horn design, `at.count` boxes side by side radiating into `at.angle`, or the first gap that stops
 * it: a tapped or back-loaded horn; drivers of more than one kind, or none with Thiele/Small parameters; no net air
 * set; a vent the engine doesn't take. Several alike drivers combine into one (`equivalentDriver`). A direct chamber
 * is a design with no segments.
 */
export function hornDesignOf(
  chamber: SpeakerChamber,
  at: Pick<HornDesign, "count" | "angle">,
): HornDesignResult {
  const horn = chamber.load.kind === CHAMBER_LOAD.horn ? chamber.load.horn : null;
  if (horn?.drive.kind === HORN_DRIVE.tapped) return gap(HORN_ENGINE_GAP.tapped);
  if (horn?.drive.kind === HORN_DRIVE.back) return gap(HORN_ENGINE_GAP.backLoaded);
  const driver = equivalentDriver(chamber.drivers);
  if (!driver) return gap(HORN_ENGINE_GAP.driver);
  const { netLiters } = chamber;
  if (netLiters === null) return gap(HORN_ENGINE_GAP.netLiters);
  const rear = rearPort(chamber.vent);
  if (!rear) return gap(HORN_ENGINE_GAP.vent);
  return {
    ok: true,
    design: {
      driver,
      count: at.count,
      throatChamber: horn?.throatChamber ?? 0,
      segments: horn?.segments ?? [],
      rear: { liters: netLiters, port: rear.port },
      angle: at.angle,
      portOffset: horn?.portOffset ?? 0,
    },
  };
}
