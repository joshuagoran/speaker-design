// A Hornresp record read onto a chamber's horn (lib/acoustics/network/hornrespRecord): its sections, its drive (front,
// offset or tapped), its rear chamber as the chamber's net air, and its vent. The record's driver is not read: the
// chamber keeps its own drivers. Pure.
import type { ChamberVent, SpeakerHorn } from "../../types";
import { readHornrespRecord } from "../../lib/acoustics/network/hornrespRecord";
import { hifiRoundEndCorrection } from "../../lib/hifi/hifi";
import { BOTH_ENDS_CORRECTION_RATIO } from "../../lib/acoustics/radiation";
import { MIN_NET_L } from "../../lib/speaker/speakerBuild";
import { HORN_LAYOUT } from "../../constants/acousticNetwork";
import { HORN_DRIVE, HORN_PATH, PORT_SHAPE, VENT_KIND } from "../../constants/speakerSpec";
import { HIFI_PORT_MAX_MS } from "../../constants/hifiEngine";
import { CM_PER_IN } from "../../constants/units";
import { SPEAKER_TEXT } from "../../constants/speakerPage";
import { shownIn, shownTenth } from "./speakerFields";

/** A record read onto the horn: the horn, the chamber's net air and vent; or why it cannot be read. */
export type HornImport =
  | {
      ok: true;
      horn: SpeakerHorn;
      netLiters: number;
      vent: ChamberVent;
      /** the record had a front chamber the import does not use: the cones and the walls set it */
      frontChamberDropped: boolean;
    }
  | { ok: false; reason: string };

/**
 * A record's vent (its area Ap, cm², and length Lpt, cm) as one round tube with the same area. The record's length is
 * the vent's whole length less the outer end (Hornresp's end correction off); the tube's own length is that less its
 * inner end's correction, as the horn engine adds it back (lib/speaker/hornDesign rearPort).
 */
export function roundVent(port: { area: number; length: number }): ChamberVent {
  const dia = (2 * Math.sqrt(port.area / Math.PI)) / CM_PER_IN;
  const inner = hifiRoundEndCorrection({ dia }, 0) * (1 - 1 / BOTH_ENDS_CORRECTION_RATIO);
  return {
    kind: VENT_KIND.vented,
    port: {
      shape: PORT_SHAPE.round,
      n: 1,
      dia: shownIn(dia),
      len: shownIn(Math.max(0, port.length / CM_PER_IN - inner)),
    },
    maxSpeedMs: HIFI_PORT_MAX_MS,
  };
}

/**
 * The record's horn on `base` (the chamber's horn, whose other settings it keeps; null for a direct chamber): its path
 * folded when longer than `depthIn`, the chamber's clear depth. A tapped horn's rear chamber is the net air (at least
 * the build's floor) and has no vent. A record with no horn, or one the reader cannot map, gives the reason.
 */
export function hornFromRecord(
  text: string,
  base: SpeakerHorn | null,
  depthIn: number,
): HornImport {
  const reading = readHornrespRecord(text);
  if (!reading.ok) return { ok: false, reason: reading.reason };
  const { design } = reading;
  if (design.segments.length === 0) return { ok: false, reason: SPEAKER_TEXT.hornImportNoHorn };
  const pathCm = design.segments.reduce((sum, s) => sum + s.length, 0);
  const horn: SpeakerHorn = {
    portOffset: 0,
    ...base,
    segments: design.segments,
    drive:
      design.layout === HORN_LAYOUT.tapped
        ? { kind: HORN_DRIVE.tapped, frontTap: design.frontTap, rearTap: design.rearTap }
        : design.layout === HORN_LAYOUT.offsetDriver
          ? { kind: HORN_DRIVE.offset, tap: design.tap }
          : { kind: HORN_DRIVE.front },
    path: pathCm > depthIn * CM_PER_IN ? HORN_PATH.folded : HORN_PATH.straight,
  };
  if (design.layout === HORN_LAYOUT.tapped)
    return {
      ok: true,
      horn,
      netLiters: Math.max(MIN_NET_L, shownTenth(design.rearChamber?.liters ?? 0)),
      vent: { kind: VENT_KIND.sealed },
      frontChamberDropped: design.frontChamber !== null,
    };
  return {
    ok: true,
    horn,
    netLiters: Math.max(MIN_NET_L, shownTenth(design.rear.liters)),
    vent: design.rear.port ? roundVent(design.rear.port) : { kind: VENT_KIND.sealed },
    frontChamberDropped: design.throatChamber > 0,
  };
}
