// A speaker spec's chamber as the horn engine (lib/acoustics/hornModel) takes it: a front-loaded horn, or a direct
// radiator (no segments), with the chamber's own net air and vent as the rear chamber. A horn's front chamber comes
// from its walls (lib/speaker/hornThroat). Pure.
import type {
  ChamberVent,
  HornDesign,
  HornDesignResult,
  HornEngineGap,
  HornPort,
  SpeakerChamber,
} from "../../types";
import { frontChamber, throatCones } from "./hornThroat";
import { stuffedLiters } from "./chamberAir";
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
 * The rear chamber's vent as the engine's port: none when sealed; round tubes or slots of a set width as their open
 * area and their path length plus the inner end's correction (the engine's radiation load adds the outer end's, a
 * slot's from its opening's rectangle). Null: a vent the engine doesn't take yet (side ducts, radiators, a slot whose
 * width the box sets). The inner ends follow the Hi-fi round-tube rule and the PA's flanged rectangle.
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
        area: port.n * port.h * port.w * CM2_PER_IN2,
        length: (port.len + INNER_END_RATIO * rectangleEndCorrection(port.h, port.w)) * CM_PER_IN,
        // the exit's end correction is the opening's rectangle's
        slot: { width: port.w * CM_PER_IN, height: port.h * CM_PER_IN },
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
 * The chamber as a horn design, `at.count` boxes side by side radiating into `at.angle`, or the first gap that stops
 * it: a tapped or back-loaded horn; drivers of more than one kind, or none with Thiele/Small parameters; no net air
 * set; a vent the engine doesn't take. Several alike drivers share the throat (`throatCones`), and the front chamber is
 * their air under the walls' back edges (`frontChamber`). A direct chamber is a design with no segments.
 */
export function hornDesignOf(
  chamber: SpeakerChamber,
  at: Pick<HornDesign, "count" | "angle">,
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
  const { netLiters } = chamber;
  if (netLiters === null) return gap(HORN_ENGINE_GAP.netLiters);
  /** the rear chamber's vent as the engine's port */
  const rear = rearPort(chamber.vent);
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
      rear: { liters: stuffedLiters(chamber, netLiters), port: rear.port },
      angle: at.angle,
      portOffset: horn?.portOffset ?? 0,
    },
  };
}
