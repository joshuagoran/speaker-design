// A chamber's clear face inside its walls, with the partition rule of `SpeakerChamber.dims`: two chambers that touch
// share one wall, the lower (or left) chamber's; and its air and vent as the box models take them. Pure.
//
// Symbols kept short are the established ones: t is the wall's thickness, in (as lib/pa/calc and lib/hifi name it).
import type { Dims2, PortStyle, SpeakerCabinet, SpeakerChamber } from "../../types";
import { HIFI_NET_SHARE, hifiRoundEndCorrection, hifiSlotEndCorrection } from "../hifi/hifi";
import { ductDividerIn, sideDuctEndCorrection, slotInnerEndCorrection } from "../pa/calc";
import { rectangleEndCorrection } from "../acoustics/radiation";
import { subTubeEndCorrection, type TubeDriver } from "../pa/tubes";
import { ELBOW_COUNTS, type ElbowCount } from "../tubeFold";
import { SUB_OPTIONS } from "../data";
import { byId } from "../tables";
import { LITERS_PER_CUBIC_IN } from "../../constants/units";
import { DRIVER_KIND, PORT_SHAPE, VENT_KIND } from "../../constants/speakerSpec";

/** How close two edges count as touching, in. */
export const TOUCH_IN = 1e-9;

/** Whether the spans [a0, a1] and [b0, b1] overlap by more than a point. */
const overlaps = (a0: number, a1: number, b0: number, b1: number) => a0 < b1 && b0 < a1;

/**
 * Which of the chamber's walls another chamber of the cabinet gives it: `below`, one stands right under it (its top
 * wall is this one's floor); `left`, one stands right left of it (its right wall is this one's left side). Any overlap
 * along the touching edge counts as a shared wall, a partial one too (a narrower box stacked in the same shell).
 */
export function sharedWalls(
  cabinet: Pick<SpeakerCabinet, "chambers">,
  chamber: SpeakerChamber,
): { below: boolean; left: boolean } {
  const { at, dims } = chamber;
  /** the cabinet's other chambers */
  const others = cabinet.chambers.filter((c) => c !== chamber);
  /** a chamber right under this one: its top wall is this one's floor */
  const below = others.some(
    (c) =>
      Math.abs(c.at.yIn + c.dims.h - at.yIn) < TOUCH_IN &&
      overlaps(c.at.xIn, c.at.xIn + c.dims.w, at.xIn, at.xIn + dims.w),
  );
  /** a chamber right left of this one: its right wall is this one's left side */
  const left = others.some(
    (c) =>
      Math.abs(c.at.xIn + c.dims.w - at.xIn) < TOUCH_IN &&
      overlaps(c.at.yIn, c.at.yIn + c.dims.h, at.yIn, at.yIn + dims.h),
  );
  return { below, left };
}

/**
 * The chamber's clear width and height, in: its size less a wall on each side, except where another chamber of the
 * cabinet gives it one (`sharedWalls`: that chamber's top or right wall is the partition).
 */
export function chamberClearFace(
  cabinet: Pick<SpeakerCabinet, "chambers" | "panel">,
  chamber: SpeakerChamber,
): Dims2 {
  const t = cabinet.panel.thicknessIn;
  const { below, left } = sharedWalls(cabinet, chamber);
  const { dims } = chamber;
  return { w: dims.w - (left ? 1 : 2) * t, h: dims.h - (below ? 1 : 2) * t };
}

/** The PA port styles the tube rule reads: tubes in the baffle's corners, or in a row along the bottom. */
const PA_CORNER_TUBES = "round4" satisfies PortStyle;
const PA_ROW_TUBES = "round2" satisfies PortStyle;

/** The chamber's PA sub, as the tube rule reads it (its size and depth); null when its cone isn't a PA sub. */
function tubeDriverOf(chamber: SpeakerChamber): TubeDriver | null {
  const driver = chamber.drivers.find((d) => d.kind === DRIVER_KIND.sub);
  return (driver && byId(SUB_OPTIONS, driver.driverId)) ?? null;
}

/** A stored elbow count as the tube rule takes it: the nearest it knows. */
const elbowCountOf = (elbows: number): ElbowCount =>
  ELBOW_COUNTS.reduce((best, e) => (Math.abs(e - elbows) < Math.abs(best - elbows) ? e : best));

/** The parts of a cabinet the air and vent rules read. */
type CabinetAir = Pick<SpeakerCabinet, "chambers" | "panel" | "insetIn">;

/** A vented chamber's vent as the vented box model takes it (lib/pa/calc boxModel). */
export interface ChamberVentModel {
  /** the open area of all the openings together, in² */
  areaIn2: number;
  /** the path length, in */
  lenIn: number;
  /** how many separate openings share the area */
  openings: number;
  /** each opening's end corrections, both ends and any bends, in */
  endCorrectionIn: number;
  /** what the vent and its walls take out of the chamber's air, L */
  volumeL: number;
}

/**
 * A vented chamber's vent, null for any other: each port by the rule of the engine it comes from.
 * - Round tubes: the Hi-fi rule (1.46 r and a sharp bend's correction per elbow; absent elbows: straight), or the PA
 *   tube rule for `flared` tubes in a PA sub's chamber (lib/pa/tubes subTubeEndCorrection).
 * - A slot: one opening along the bottom, as wide as the chamber's clear face unless it sets its own width; its shelf
 *   takes air too. The Hi-fi rule, or the PA letterbox's where it has `fins`.
 * - Side ducts (PA): `n` ducts up the front edges, the dividers' height off each; their inner walls take air too.
 */
export function chamberVentModel(
  cabinet: CabinetAir,
  chamber: SpeakerChamber,
): ChamberVentModel | null {
  const { vent, dims } = chamber;
  if (vent.kind !== VENT_KIND.vented) return null;
  const t = cabinet.panel.thicknessIn;
  const face = chamberClearFace(cabinet, chamber);
  const { port } = vent;
  switch (port.shape) {
    case PORT_SHAPE.slot: {
      const w = port.w ?? face.w;
      /** the shelf over it takes air too */
      const volumeL = (port.h + t) * w * port.len * LITERS_PER_CUBIC_IN;
      if (port.fins !== undefined) {
        // the PA letterbox (lib/pa/calc ventGeometry): its fins take their thickness off the width; its mouth on the
        // floor (which mirrors it), its inner end as the PA slot's, straight or folded
        const open = w - port.fins * t;
        return {
          areaIn2: port.h * open,
          lenIn: port.len,
          openings: 1,
          endCorrectionIn:
            rectangleEndCorrection(2 * port.h, open) +
            slotInnerEndCorrection(
              dims,
              { slotH: port.h, len: port.len },
              t,
              cabinet.insetIn,
              !!port.folded,
            ),
          volumeL,
        };
      }
      return {
        areaIn2: port.h * w,
        lenIn: port.len,
        openings: 1,
        endCorrectionIn: hifiSlotEndCorrection(dims, t, { h: port.h, w, len: port.len }),
        volumeL,
      };
    }
    case PORT_SHAPE.duct: {
      /** each duct's open height: the clear face less its two dividers */
      const open = face.h - 2 * ductDividerIn(port);
      return {
        areaIn2: port.n * port.throat * open,
        lenIn: port.len,
        openings: port.n,
        endCorrectionIn: sideDuctEndCorrection(dims, port, t, cabinet.insetIn, port.n),
        volumeL: port.n * (port.throat + t) * open * port.len * LITERS_PER_CUBIC_IN,
      };
    }
    default: {
      // no area for a diameter that is not positive (its square would hide it)
      const areaIn2 = port.dia > 0 ? port.n * Math.PI * Math.pow(port.dia / 2, 2) : 0;
      /** the sub whose depth stops a flared tube's run (the PA tube rule reads it) */
      const sub = port.flared ? tubeDriverOf(chamber) : null;
      return {
        areaIn2,
        lenIn: port.len,
        openings: port.n,
        endCorrectionIn: sub
          ? subTubeEndCorrection(
              dims,
              port.corners ? PA_CORNER_TUBES : PA_ROW_TUBES,
              { nt: port.n, dia: port.dia, len: port.len },
              t,
              cabinet.insetIn,
              sub,
              elbowCountOf(port.elbows ?? 0),
            )
          : hifiRoundEndCorrection(port, port.elbows ?? 0),
        volumeL: areaIn2 * port.len * LITERS_PER_CUBIC_IN,
      };
    }
  }
}

/**
 * The chamber's air as the box models take it, L: its `netLiters` where set; else, by the Hi-fi engine's rule (lib/hifi
 * hifiBox), its clear volume (the clear face, and its depth less the back, the baffle and the baffle's inset) with 3%
 * off for bracing and damping, less the cones' displacement and the vent's volume, and at least 1 L.
 */
export function chamberNetLiters(
  cabinet: CabinetAir,
  chamber: SpeakerChamber,
  displacementL: number,
): number {
  if (chamber.netLiters !== null) return chamber.netLiters;
  const t = cabinet.panel.thicknessIn;
  const face = chamberClearFace(cabinet, chamber);
  const depth = chamber.dims.d - 2 * t - cabinet.insetIn;
  const clearL = Math.max(0, face.w * face.h * depth) * LITERS_PER_CUBIC_IN;
  const ventL = chamberVentModel(cabinet, chamber)?.volumeL ?? 0;
  return Math.max(1, clearL * HIFI_NET_SHARE - displacementL - ventL);
}

/** The air the box models take for a chamber of `netLiters`: its stuffing makes it act `stuffingPct` % bigger. */
export const stuffedLiters = (chamber: Pick<SpeakerChamber, "stuffingPct">, netLiters: number) =>
  netLiters * (1 + chamber.stuffingPct / 100);
