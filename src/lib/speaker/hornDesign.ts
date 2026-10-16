// A speaker spec's chamber as the horn engines take it: a front-loaded horn or a direct radiator (no segments) for the
// horn engine (lib/acoustics/hornModel), an offset or tapped horn for the acoustic network's presets
// (lib/acoustics/network/presets). A horn's front chamber comes from its walls (lib/speaker/hornThroat). Pure.
import type {
  ChamberVent,
  Dims2,
  HornDesign,
  HornDesignResult,
  HornEngineGap,
  HornPort,
  SpeakerChamber,
} from "../../types";
import { frontChamber, throatCones } from "./hornThroat";
import { isSizedSegment } from "../acoustics/hornSegments";
import { slotRunIn, stuffedLiters } from "./chamberAir";
import { hifiRoundEndCorrection, portArea } from "../hifi/hifi";
import { BOTH_ENDS_CORRECTION_RATIO, rectangleEndCorrection } from "../acoustics/radiation";
import { CM_PER_IN, CM2_PER_IN2 } from "../../constants/units";
import { HORN_LAYOUT } from "../../constants/acousticNetwork";
import {
  CHAMBER_LOAD,
  HORN_DRIVE,
  HORN_ENGINE_GAP,
  PORT_SHAPE,
  VENT_KIND,
} from "../../constants/speakerSpec";

/** A free (inner) end's correction over a flanged (outer) one's: 0.61 r over 0.85 r. */
const INNER_END_RATIO = BOTH_ENDS_CORRECTION_RATIO - 1;

/**
 * The rear chamber's vent as the engine's port: none when sealed; round tubes or slots (each running the chamber's
 * clear `face`, `slotRunIn`) as their open area and their path length plus the inner end's correction (the engine's
 * radiation load adds the outer end's, a slot's from its opening's rectangle). Null: a vent the engine doesn't take yet
 * (side ducts, radiators). The inner ends follow the Hi-fi round-tube rule and the PA's flanged rectangle.
 */
function rearPort(vent: ChamberVent, face: Dims2): { port: HornPort | null } | null {
  if (vent.kind === VENT_KIND.sealed) return { port: null };
  if (vent.kind === VENT_KIND.radiator) return null;
  const { port } = vent;
  if (port.shape === PORT_SHAPE.duct) return null;
  if (port.shape === PORT_SHAPE.slot) {
    /** each opening's long side: the whole clear face */
    const run = slotRunIn(face, port);
    return {
      port: {
        area: port.n * port.h * run * CM2_PER_IN2,
        length: (port.len + INNER_END_RATIO * rectangleEndCorrection(port.h, run)) * CM_PER_IN,
        // the exit's end correction is the opening's rectangle's
        slot: { width: run * CM_PER_IN, height: port.h * CM_PER_IN },
      },
    };
  }
  return {
    port: {
      area: portArea(port) * CM2_PER_IN2,
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

/** Whether `tap` is a boundary between two of `n` sections: from 1 to n − 1. */
const isInnerBoundary = (tap: number, n: number) => Number.isInteger(tap) && tap >= 1 && tap < n;

/**
 * What the horn engine reads of the chamber's place in its box: its air as the box models take it (the set net air, or
 * the Auto one: lib/speaker/speakerBuild `chamberNetLiters`), before the stuffing, its clear face (a slot runs it) and
 * the cones' setback on a doubled driver board.
 */
export interface HornDesignRoom {
  netLiters: number;
  face: Dims2;
  /** how far the horn's driver board stands the cones behind the bay's end, in (`chamberSetbackIn`): front chamber air */
  setbackIn: number;
}

/**
 * The chamber as a horn design, `at.count` boxes side by side radiating into `at.angle`, or the first gap that stops
 * it: a back-loaded horn; drivers of more than one kind, or none with Thiele/Small parameters; a section with a size
 * that is not positive; a tap that is not between two sections; a vent the engine doesn't take (any vent on a tapped
 * horn). Several alike drivers share the throat (`throatCones`), and the front chamber is their air under the walls'
 * back edges (`frontChamber`). A direct chamber is a front-loaded design with no segments.
 *
 * - Front-loaded and offset: the chamber's air with its stuffing and its vent are the rear chamber; the front chamber
 *   is lumped at the fronts' node (Hornresp's Vtc).
 * - Tapped: the front chamber and the chamber's air with its stuffing are the two tap passages (Hornresp's Vtc and
 *   Vrc), each as wide as the cones' area (their length is their air over that area).
 */
export function hornDesignOf(
  chamber: SpeakerChamber,
  at: Pick<HornDesign, "count" | "angle">,
  room: HornDesignRoom,
): HornDesignResult {
  const horn = chamber.load.kind === CHAMBER_LOAD.horn ? chamber.load.horn : null;
  if (horn?.drive.kind === HORN_DRIVE.back) return gap(HORN_ENGINE_GAP.backLoaded);
  /**
   * the drivers on the throat: one driver's Thiele/Small parameters and how many share it (Hornresp's Nd; the engine
   * wires them in parallel, each on the full voltage, as the PA plans wire two 8 Ω subs to one 4 Ω channel)
   */
  const throat = throatCones(chamber.drivers);
  if (!throat) return gap(HORN_ENGINE_GAP.driver);
  if (horn && !horn.segments.every(isSizedSegment)) return gap(HORN_ENGINE_GAP.segment);
  const n = horn?.segments.length ?? 0;
  const drive = horn?.drive;
  if (drive?.kind === HORN_DRIVE.offset && !isInnerBoundary(drive.tap, n))
    return gap(HORN_ENGINE_GAP.taps);
  if (
    drive?.kind === HORN_DRIVE.tapped &&
    !(
      isInnerBoundary(drive.frontTap, n) &&
      isInnerBoundary(drive.rearTap, n) &&
      drive.frontTap < drive.rearTap
    )
  )
    return gap(HORN_ENGINE_GAP.taps);
  /** the air between the cones and the walls' back edges; a direct radiator has none */
  const frontLiters = horn ? frontChamber(throat.cone, throat.count, room.setbackIn).liters : 0;
  /** the chamber's air with its stuffing, as a direct chamber's */
  const airLiters = stuffedLiters(chamber, room.netLiters);
  const common = {
    driver: throat.parts.ts,
    drivers: throat.count,
    count: at.count,
    segments: horn?.segments ?? [],
    angle: at.angle,
  };
  if (drive?.kind === HORN_DRIVE.tapped) {
    if (chamber.vent.kind !== VENT_KIND.sealed) return gap(HORN_ENGINE_GAP.tappedVent);
    /** each passage's cross-section: the cones' area */
    const area = throat.cone.Sd * throat.count;
    return {
      ok: true,
      design: {
        layout: HORN_LAYOUT.tapped,
        ...common,
        frontTap: drive.frontTap,
        rearTap: drive.rearTap,
        frontChamber: frontLiters > 0 ? { liters: frontLiters, area } : null,
        rearChamber: airLiters > 0 ? { liters: airLiters, area } : null,
      },
    };
  }
  /** the rear chamber's vent as the engine's port */
  const rear = rearPort(chamber.vent, room.face);
  if (!rear) return gap(HORN_ENGINE_GAP.vent);
  const front = {
    ...common,
    throatChamber: frontLiters,
    rear: { liters: airLiters, port: rear.port },
    portOffset: horn?.portOffset ?? 0,
  };
  return {
    ok: true,
    design:
      drive?.kind === HORN_DRIVE.offset
        ? { layout: HORN_LAYOUT.offsetDriver, ...front, tap: drive.tap }
        : { layout: HORN_LAYOUT.frontLoaded, ...front },
  };
}
