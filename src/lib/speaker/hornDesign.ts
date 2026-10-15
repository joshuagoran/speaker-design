// A speaker spec's chamber as the horn engine (lib/acoustics/hornModel) takes it: a front-loaded horn, or a direct
// radiator (no segments), with the chamber's own net air and vent as the rear chamber. A horn's front chamber comes
// from its walls (lib/speaker/hornThroat). Pure.
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

/**
 * What the horn engine reads of the chamber's place in its box: its air as the box models take it (the set net air, or
 * the Auto one: lib/speaker/speakerBuild `chamberNetLiters`), before the stuffing, and its clear face (a slot runs it).
 */
export interface HornDesignRoom {
  netLiters: number;
  face: Dims2;
}

/**
 * The chamber as a horn design, `at.count` boxes side by side radiating into `at.angle`, or the first gap that stops
 * it: a tapped or back-loaded horn; drivers of more than one kind, or none with Thiele/Small parameters; a section
 * with a size that is not positive; a vent the engine doesn't take. Several alike drivers share the throat
 * (`throatCones`), and the front chamber is their air under the walls' back edges (`frontChamber`). A direct chamber
 * is a design with no segments.
 */
export function hornDesignOf(
  chamber: SpeakerChamber,
  at: Pick<HornDesign, "count" | "angle">,
  room: HornDesignRoom,
): HornDesignResult {
  const horn = chamber.load.kind === CHAMBER_LOAD.horn ? chamber.load.horn : null;
  if (horn?.drive.kind === HORN_DRIVE.tapped) return gap(HORN_ENGINE_GAP.tapped);
  if (horn?.drive.kind === HORN_DRIVE.back) return gap(HORN_ENGINE_GAP.backLoaded);
  /**
   * the drivers on the throat: one driver's Thiele/Small parameters and how many share it (Hornresp's Nd; the engine
   * wires them in parallel, each on the full voltage, as the PA plans wire two 8 Ω subs to one 4 Ω channel)
   */
  const throat = throatCones(chamber.drivers);
  if (!throat) return gap(HORN_ENGINE_GAP.driver);
  if (horn && !horn.segments.every(isSizedSegment)) return gap(HORN_ENGINE_GAP.segment);
  /** the rear chamber's vent as the engine's port */
  const rear = rearPort(chamber.vent, room.face);
  if (!rear) return gap(HORN_ENGINE_GAP.vent);
  return {
    ok: true,
    design: {
      driver: throat.parts.ts,
      drivers: throat.count,
      count: at.count,
      // the air between the cones and the walls' back edges; a direct radiator has none
      throatChamber: horn ? frontChamber(throat.cone, throat.count).liters : 0,
      segments: horn?.segments ?? [],
      // the rear chamber's air with its stuffing, as a direct chamber's
      rear: { liters: stuffedLiters(chamber, room.netLiters), port: rear.port },
      angle: at.angle,
      portOffset: horn?.portOffset ?? 0,
    },
  };
}
