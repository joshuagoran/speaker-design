// The PA boxes' panels for the bracing rule (lib/bracing): their spans, stock and the supports the vent's own parts give.
import type { BracePanel, PlateStock } from "../../types";

/** The sub-to-mid crossover the PA boxes are braced for, Hz: the top of the optimizers' range (XO_LO_OPTIONS, tested). */
export const PA_BRACING_CROSSOVER_HZ = 140;
/** How far over the sub-to-mid crossover every panel's first resonance should sit. */
export const PANEL_TARGET_CROSSOVER_MULTIPLE = 2;
/**
 * The PA boxes' panel target, Hz: twice the highest sub-to-mid crossover the optimizers pick, so the sub's panels ring
 * an octave past its lowpass whatever the crossover. A fixed number rather than the design's own crossover, so a box's
 * braces (and so its volume and tuning) don't move with the crossover the optimizers try.
 */
export const PA_PANEL_TARGET_HZ = PANEL_TARGET_CROSSOVER_MULTIPLE * PA_BRACING_CROSSOVER_HZ;
/**
 * A duct part holds a panel in a line only when it runs along at least this share of the panel (the vent shelf on the
 * sides, the side-duct walls and their dividers); a shorter one is left out, on the safe side.
 */
export const DUCT_SUPPORT_MIN_SHARE = 2 / 3;

/** A PA box's inside: width, height and depth behind the baffle (in), and the band a bottom slot takes under the baffle. */
export interface PaBoxInside {
  iw: number;
  ih: number;
  inD: number;
  band: number;
}
/** The lines the vent's parts already hold the panels on, in from each panel's own edge (lib/pa/calc works them out). */
export interface PaBoxSupports {
  /** up the left and right sides (y): the vent shelf, the side-duct dividers */
  sideL: number[];
  sideR: number[];
  /** across the top and bottom (x): the side-duct walls, the slot's fins */
  top: number[];
  bottom: number[];
}
export const NO_SUPPORTS: PaBoxSupports = { sideL: [], sideR: [], top: [], bottom: [] };

/**
 * A PA box's six panels on the box axes (x across from the left, y up from the bottom, z back from the baffle): the
 * sides, top, bottom and back at the wall stock, the baffle at its own (it starts above a bottom slot's band).
 */
export function paBoxPanels(
  { iw, ih, inD, band }: PaBoxInside,
  wall: PlateStock,
  baffle: PlateStock,
  sup: PaBoxSupports,
): BracePanel[] {
  const base = { offU: 0, offV: 0, fixedU: [], fixedV: [] };
  return [
    {
      ...base,
      id: "sideL",
      u: "z",
      v: "y",
      spanU: inD,
      spanV: ih,
      stock: wall,
      ribs: true,
      fixedV: sup.sideL,
    },
    {
      ...base,
      id: "sideR",
      u: "z",
      v: "y",
      spanU: inD,
      spanV: ih,
      stock: wall,
      ribs: true,
      fixedV: sup.sideR,
    },
    {
      ...base,
      id: "top",
      u: "x",
      v: "z",
      spanU: iw,
      spanV: inD,
      stock: wall,
      ribs: true,
      fixedU: sup.top,
    },
    {
      ...base,
      id: "bottom",
      u: "x",
      v: "z",
      spanU: iw,
      spanV: inD,
      stock: wall,
      ribs: true,
      fixedU: sup.bottom,
    },
    { ...base, id: "back", u: "x", v: "y", spanU: iw, spanV: ih, stock: wall, ribs: true },
    {
      ...base,
      id: "baffle",
      u: "x",
      v: "y",
      spanU: iw,
      spanV: ih - band,
      offV: band,
      stock: baffle,
      ribs: false,
    },
  ];
}
