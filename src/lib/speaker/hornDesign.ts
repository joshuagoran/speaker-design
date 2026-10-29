// A speaker spec's chamber as the horn engines take it: a front-loaded horn or a direct radiator (no segments) for the
// horn engine (lib/acoustics/hornModel), an offset or tapped horn for the acoustic network's presets
// (lib/acoustics/network/presets). A horn's front chamber comes from its walls (lib/speaker/hornThroat). Pure.
import type {
  ChamberVent,
  Dims2,
  HornDesign,
  HornDrive,
  HornDesignResult,
  HornEngineGap,
  HornPort,
  HornSegment,
  SpeakerChamber,
  SideDuctPort,
  SpeakerPort,
} from "../../types";
import { frontChamber, throatCones } from "./hornThroat";
import { isSizedSegment } from "../acoustics/hornSegments";
import { slotRunIn, stuffedLiters } from "./chamberAir";
import { slotFinsOf } from "../acoustics/boxModels";
import { hifiRoundEndCorrection, portArea } from "../acoustics/wooferBox";
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
 * A slot as the engine's port: `n` openings `heightIn` high and `runIn` long, a duct `lengthIn` long. Its length adds
 * the inner end's correction (the engine's radiation load adds the outer end's, from the opening's rectangle).
 */
function slotPort(slot: {
  n: number;
  heightIn: number;
  runIn: number;
  lengthIn: number;
}): HornPort {
  const { n, heightIn, runIn, lengthIn } = slot;
  return {
    area: n * heightIn * runIn * CM2_PER_IN2,
    length: (lengthIn + INNER_END_RATIO * rectangleEndCorrection(heightIn, runIn)) * CM_PER_IN,
    // the exit's end correction is the opening's rectangle's
    slot: { width: runIn * CM_PER_IN, height: heightIn * CM_PER_IN },
  };
}

/**
 * The vents the horn engine models in an undrawn horn's rear chamber, by drive: none in a tapped horn's (its rear
 * chamber is a closed passage to its tap); a round port or slots in a front-loaded or offset horn's. Side ducts and
 * passive radiators are not modeled yet. The Speaker page offers only these.
 */
export const hornVentKinds = (drive: HornDrive["kind"]): readonly ChamberVent["kind"][] =>
  drive === HORN_DRIVE.tapped ? [VENT_KIND.sealed] : [VENT_KIND.sealed, VENT_KIND.vented];

/** The port shapes a horn's rear chamber takes (`hornVentKinds`): a round port (no shape set) or slots. */
export const HORN_PORT_SHAPES: readonly NonNullable<SpeakerPort["shape"]>[] = [
  PORT_SHAPE.round,
  PORT_SHAPE.slot,
];

/** Whether a horn's rear chamber takes a port of this shape: a round port or slots, not side ducts. */
const hornTakesShape = (port: SpeakerPort): port is Exclude<SpeakerPort, SideDuctPort> =>
  HORN_PORT_SHAPES.includes(port.shape ?? PORT_SHAPE.round);

/**
 * The rear chamber's vent as the engine's port: none when sealed; round tubes or slots (each running the chamber's
 * clear `face`, `slotRunIn`) as their open area and their path length plus the inner end's correction (the engine's
 * radiation load adds the outer end's, a slot's from its opening's rectangle). Null: a vent the engine doesn't take yet
 * (side ducts, radiators). The inner ends follow the Hi-fi round-tube rule and the PA's flanged rectangle.
 */
function rearPort(
  vent: ChamberVent,
  face: Dims2,
  wallIn: number,
): { port: HornPort | null } | null {
  if (vent.kind === VENT_KIND.sealed) return { port: null };
  if (vent.kind !== VENT_KIND.vented || !hornTakesShape(vent.port)) return null;
  const { port } = vent;
  if (port.shape === PORT_SHAPE.slot) {
    /** each opening's long side: the whole clear face, less its fins (as the box model takes them) */
    const faceRun = slotRunIn(face, port);
    const run =
      port.fins === undefined
        ? faceRun
        : faceRun - slotFinsOf({ fins: port.fins, slotH: port.h }, faceRun, wallIn) * wallIn;
    return { port: slotPort({ n: port.n, heightIn: port.h, runIn: run, lengthIn: port.len }) };
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
  /** the walls' thickness, in: a slot's fins are as thick */
  wallIn: number;
  /** how far the horn's driver board stands the cones behind the bay's end, in (`chamberSetbackIn`): front chamber air */
  setbackIn: number;
  /**
   * a drawn horn's traced passage (lib/speaker/foldHorn `tracedHorn`): its sections, its taps and the sealed air behind
   * the cones, L. When given, these replace the horn's stored sections (its straight horn) and drive, the passage
   * holds the cones' front air, and the sealed air is the rear chamber, with the drawn vent as its port. A null drive:
   * the cones open into no passage.
   */
  traced?: TracedHornModel;
}

/** What the sound model reads of a drawn horn's trace (lib/speaker/foldHorn). */
export interface TracedHornModel {
  segments: readonly HornSegment[];
  drive: HornDrive | null;
  rearLiters: number | null;
  /**
   * the rear chamber's drawn vent, a slot: its open area, its length (the run and the wall), its height and its width
   * (the chamber's inside width), in. Null: the rear chamber is sealed. A drawn horn's vent is only this.
   */
  rearVent: { areaIn2: number; lengthIn: number; heightIn: number; widthIn: number } | null;
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
  const stored = chamber.load.kind === CHAMBER_LOAD.horn ? chamber.load.horn : null;
  const { traced } = room;
  if (stored && traced && !traced.drive) return gap(HORN_ENGINE_GAP.drawing);
  /** the horn as the engine reads it: a drawn horn's traced sections and drive, else the stored ones */
  const horn =
    stored && traced?.drive
      ? { ...stored, segments: traced.segments, drive: traced.drive }
      : stored;
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
  /** the air between the cones and the walls' back edges; a direct radiator, or a drawn horn's passage, has none */
  const frontLiters =
    horn && !traced ? frontChamber(throat.cone, throat.count, room.setbackIn).liters : 0;
  /** the chamber's air with its stuffing, as a direct chamber's; a drawn horn's sealed air behind the cones */
  const airLiters = stuffedLiters(chamber, traced ? (traced.rearLiters ?? 0) : room.netLiters);
  const common = {
    driver: throat.parts.ts,
    drivers: throat.count,
    count: at.count,
    segments: horn?.segments ?? [],
    angle: at.angle,
  };
  if (drive?.kind === HORN_DRIVE.tapped) {
    // a drawn horn has no vent here: the drawing sets the air; only a stored, undrawn horn reads the chamber's vent
    if (!traced && chamber.vent.kind !== VENT_KIND.sealed) return gap(HORN_ENGINE_GAP.tappedVent);
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
  /** the rear chamber's vent as the engine's port: a drawn horn's from its drawing, else the chamber's */
  const rear = traced
    ? {
        port: traced.rearVent
          ? slotPort({
              n: 1,
              heightIn: traced.rearVent.heightIn,
              runIn: traced.rearVent.widthIn,
              lengthIn: traced.rearVent.lengthIn,
            })
          : null,
      }
    : rearPort(chamber.vent, room.face, room.wallIn);
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
