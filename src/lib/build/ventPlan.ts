// The PA sub's vent as the views build it, from the port style and the design's vent geometry. Pure (the 3D scene's parts
// and the speaker layout both read it: lib/speaker/speakerLayout keeps drivers off the vent's openings).
import type { Dims3, PaPortGeometry, PortStyle, SubDriver } from "../../types";
import { slotFinLayout, slotFinsOf, isRoundPort } from "../acoustics/boxModels";
import { tubeLayout } from "./tubes";

/**
 * The sub's vent as the scene builds it, from the port style and the design's vent geometry (defaults where a custom
 * cabinet leaves one out): the side ducts, the round tubes where the model and the cutlist place them (lib/build/tubes), or
 * the bottom slot's band, and the duct sizes the parts behind the baffle read.
 */
export function subVentPlan(
  sub: Pick<SubDriver, "size">,
  box: Dims3,
  portStyle: PortStyle,
  portGeom: Partial<PaPortGeometry> | undefined,
  T: number,
) {
  const vSlot = portStyle === "vslots" || portStyle === "vslot1";
  const sides = portStyle === "vslot1" ? [1] : [-1, 1]; // side ducts: one wall or both
  const s = box;
  const pg = portGeom || {}; // explicit vent geometry when the cabinet is custom
  // sub column: driver cutout high on the baffle, three duct cutouts across the bottom
  const ductH = pg.ductH != null ? pg.ductH : 3,
    innerW = s.w - 2 * T;
  // the bottom slot's fins and the openings between them (the PA page's two fins: three openings)
  const fins = slotFinLayout(innerW, T, slotFinsOf({ fins: pg.fins, slotH: ductH }, innerW, T));
  const round = isRoundPort(portStyle); // round-tube ports only
  const corners = portStyle === "round4";
  const nPorts = pg.nPorts != null ? pg.nPorts : portStyle === "round1" ? 1 : corners ? 4 : 2;
  const portR =
    pg.portR != null
      ? pg.portR
      : (portStyle === "round1" ? 8 : corners ? (sub.size >= 18 ? 4 : 3.5) : 5) / 2;
  // round tubes: where they sit on the baffle and how they fold, as the model and the cutlist take them (lib/build/tubes)
  const tubeVent = {
    nt: nPorts,
    dia: 2 * portR,
    len: pg.tubeLen != null ? pg.tubeLen : portStyle === "round1" ? 11 : corners ? 11.5 : 9.8,
  };
  const tubes = round ? tubeLayout(s, portStyle, tubeVent, T, sub.size) : null;
  const bandH = round || vSlot ? 0 : ductH + T; // slots: baffle starts above the duct shelf
  const vThroat =
    pg.throat != null
      ? pg.throat
      : Math.round(((sub.size >= 18 ? 66 : 54) / (2 * (s.h - 2 * T))) * 100) / 100;
  return {
    portStyle,
    pg,
    vSlot,
    sides,
    ductH,
    innerW,
    fins,
    round,
    portR,
    tubeVent,
    tubes,
    bandH,
    vThroat,
  };
}

/** What `subVentPlan` returns. */
export type SubVentPlan = ReturnType<typeof subVentPlan>;

/** One of the sub vent's openings in the baffle: a round tube's mouth, or a side duct's full-height mouth. */
export type SubVentOpening =
  | { shape: "circle"; x: number; y: number; r: number }
  | { shape: "rect"; x: number; y: number; w: number; h: number; corner: number };

/**
 * The sub vent's openings in the baffle, each by its center: `x` across from the box's center line, `y` up from the
 * box's bottom. The round tubes' mouths, or the side ducts' full-height mouths against the side walls. (The bottom
 * slot leaves the baffle's bottom edge open instead: the plan's `bandH`.)
 */
export function subVentOpenings(
  { tubes, portR, vSlot, vThroat, innerW, sides }: SubVentPlan,
  box: Dims3,
  T: number,
): SubVentOpening[] {
  const openings: SubVentOpening[] = [];
  if (tubes)
    for (const p of tubes.tubes) openings.push({ shape: "circle", x: p.x, y: T + p.y, r: portR });
  if (vSlot) {
    // full-height ducts using the side walls as their outer face
    const mouth = vThroat + 0.43; // flat strip set at 20 deg: 0.43 in rise
    const sx = innerW / 2 - mouth / 2;
    for (const k of sides)
      openings.push({
        shape: "rect",
        x: k * sx,
        y: box.h / 2,
        w: mouth,
        h: box.h - 2 * T,
        corner: 0.12,
      });
  }
  return openings;
}
