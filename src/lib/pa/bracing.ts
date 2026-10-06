// The PA boxes' panels for the bracing rule (lib/bracing): their spans, stock and the supports the vent's own parts give.
import type { BracePanel, BraceStyleId, PlateStock } from "../../types";

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
/** How far every brace and rib stays from the driver's basket, magnet and cutout, inches. */
export const DRIVER_CLEARANCE_IN = 0.5;
/**
 * The optimizers' cursory brace estimate (lib/pa/calc braceWoodEstimate), by style: one window brace's wood for every
 * `span` inches of each inside span past the first, times `scale`. Least squares against the rule's wood over the
 * golden sub boxes in ¾″ ply (their mid boxes need none, and neither does the estimate under `span`).
 */
export const BRACE_ESTIMATE = {
  window: { span: 16.5, scale: 0.766 },
  ribs: { span: 18.5, scale: 2.703 },
  both: { span: 18.5, scale: 2.647 },
} as const satisfies Record<BraceStyleId, { span: number; scale: number }>;
/**
 * A driver's shape behind the baffle as the braces keep clear of it, as shares of its depth there: the cutout's full
 * width (the frame's ring, the surround and the basket's widest) for the first BASKET_RING_SHARE, the basket narrowing
 * straight to the motor's width by MOTOR_START_SHARE (taken in BASKET_TAPER_STEPS boxes, each as wide as the basket at
 * its front, so they hold it), and the motor's width to the back.
 */
export const BASKET_RING_SHARE = 0.2;
export const MOTOR_START_SHARE = 0.6;
export const BASKET_TAPER_STEPS = 3;

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
  /** back from the baffle on both sides (z): a folded slot's rear channel wall, glued between them */
  sideZ?: number[];
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
  stops: PaBoxSupports = sup,
): BracePanel[] {
  const base = { offU: 0, offV: 0, fixedU: [], fixedV: [], stopU: [], stopV: [] };
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
      fixedU: sup.sideZ ?? [],
      fixedV: sup.sideL,
      stopU: stops.sideZ ?? [],
      stopV: stops.sideL,
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
      fixedU: sup.sideZ ?? [],
      fixedV: sup.sideR,
      stopU: stops.sideZ ?? [],
      stopV: stops.sideR,
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
      stopU: stops.top,
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
      stopU: stops.bottom,
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
