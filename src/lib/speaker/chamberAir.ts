// A chamber's clear face inside its walls, with the partition rule of `SpeakerChamber.dims`: two chambers that touch
// share one wall, the lower (or left) chamber's; and its vent as the box models take it (its net air: lib/speaker
// speakerBuild). Pure.
//
// Symbols kept short are the established ones: t is the wall's thickness, in (as lib/pa/calc and lib/hifi name it).
import type { Dims2, PortStyle, SpeakerCabinet, SpeakerChamber } from "../../types";
import { hifiRoundEndCorrection, hifiSlotEndCorrection } from "../hifi/hifi";
import {
  ductDividerIn,
  sideDuctEndCorrection,
  slotFinsOf,
  slotFolds,
  slotInnerEndCorrection,
} from "../pa/calc";
import { rectangleEndCorrection } from "../acoustics/radiation";
import { subTubeEndCorrection, type TubeDriver } from "../pa/tubes";
import { elbowCountOf } from "../tubeFold";
import { SUB_OPTIONS } from "../data";
import { byId } from "../tables";
import {
  CABINET_CONSTRUCTION,
  DRIVER_KIND,
  PORT_SHAPE,
  SLOT_PLACE,
  VENT_KIND,
} from "../../constants/speakerSpec";

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

/** How far the baffle sits behind the cabinet's front, in: the frame's inset; a flush box's baffle is its front. */
export const baffleInsetIn = (cabinet: Pick<SpeakerCabinet, "construction" | "insetIn">) =>
  cabinet.construction === CABINET_CONSTRUCTION.frameInset ? cabinet.insetIn : 0;

/**
 * The chamber's clear depth behind the baffle, in, as the horn engine's path takes it: its depth less the back, the
 * baffle and the baffle's inset (lib/speaker/speakerLayout `hornFlare`).
 */
export const clearDepthIn = (
  cabinet: Pick<SpeakerCabinet, "panel" | "construction" | "insetIn">,
  dims: Pick<SpeakerChamber["dims"], "d">,
) => dims.d - 2 * cabinet.panel.thicknessIn - baffleInsetIn(cabinet);

/** The PA port styles the tube rule reads: tubes in the baffle's corners, or in a row along the bottom. */
const PA_CORNER_TUBES = "round4" satisfies PortStyle;
const PA_ROW_TUBES = "round2" satisfies PortStyle;

/** The chamber's PA sub, as the tube rule reads it (its size and depth); null when its cone isn't a PA sub. */
function tubeDriverOf(chamber: SpeakerChamber): TubeDriver | null {
  const driver = chamber.drivers.find((d) => d.kind === DRIVER_KIND.sub);
  return (driver && byId(SUB_OPTIONS, driver.driverId)) ?? null;
}

/** The parts of a cabinet the air and vent rules read. */
type CabinetAir = Pick<SpeakerCabinet, "chambers" | "panel" | "construction" | "insetIn">;

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
}

/**
 * A vented chamber's vent, null for any other: each port by the rule of the engine it comes from.
 * - Round tubes: the Hi-fi rule (1.46 r and a sharp bend's correction per elbow; absent elbows: straight), or the PA
 *   tube rule for `flared` tubes in a PA sub's chamber (lib/pa/tubes subTubeEndCorrection).
 * - A slot: `n` openings (the PA letterbox one), each as wide as the chamber's clear face unless the slot sets its own
 *   width (their shelves' wood: lib/speaker/speakerBuild). The Hi-fi rule, or the PA letterbox's where it has `fins`.
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
      // an open slot up the front sides: each opening is as tall as the slot's long side, at most the clear face (the
      // layout cuts it so); a divided slot is always on the floor
      const w =
        port.fins === undefined && port.place === SLOT_PLACE.sides
          ? Math.min(port.w ?? face.h, face.h)
          : (port.w ?? face.w);
      if (port.fins !== undefined) {
        // the PA letterbox (lib/pa/calc ventGeometry): its fins take their thickness off the width; its mouth on the
        // floor (which mirrors it), its inner end as the PA slot's, folded up the back wall when too long to run
        // straight (as the PA rule, the cutlist and the 3D view fold it)
        const open = w - slotFinsOf({ fins: port.fins, slotH: port.h }, w, t) * t;
        const slot = { slotH: port.h, len: port.len };
        return {
          areaIn2: port.h * open,
          lenIn: port.len,
          openings: 1,
          endCorrectionIn:
            rectangleEndCorrection(2 * port.h, open) +
            slotInnerEndCorrection(dims, slot, t, baffleInsetIn(cabinet), slotFolds(dims, slot, t)),
        };
      }
      // the Hi-fi page's slot is one (n 1); the Speaker page's can be more, alike
      return {
        areaIn2: port.n * port.h * w,
        lenIn: port.len,
        openings: port.n,
        endCorrectionIn: hifiSlotEndCorrection(dims, t, { h: port.h, w, len: port.len }),
      };
    }
    case PORT_SHAPE.duct: {
      /** each duct's open height: the clear face less its two dividers */
      const open = face.h - 2 * ductDividerIn(port);
      return {
        areaIn2: port.n * port.throat * open,
        lenIn: port.len,
        openings: port.n,
        endCorrectionIn: sideDuctEndCorrection(dims, port, t, baffleInsetIn(cabinet), port.n),
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
              baffleInsetIn(cabinet),
              sub,
              elbowCountOf(port.elbows ?? 0),
            )
          : hifiRoundEndCorrection(port, port.elbows ?? 0),
      };
    }
  }
}

/** The air the box models take for a chamber of `netLiters`: its stuffing makes it act `stuffingPct` % bigger. */
export const stuffedLiters = (chamber: Pick<SpeakerChamber, "stuffingPct">, netLiters: number) =>
  netLiters * (1 + chamber.stuffingPct / 100);
