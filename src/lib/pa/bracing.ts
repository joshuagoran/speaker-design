// The PA boxes' panels for the bracing rule (lib/bracing): their spans, stock and the supports the vent's own parts give.
import type {
  BackJointId,
  BracePanel,
  BraceStyleId,
  EdgeHold,
  PlateHole,
  PlateStock,
} from "../../types";
import { DEFAULT_BACK_JOINT, GLUED_BACK } from "../../constants/bracing";

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
  window: { span: 25.5, scale: 3.921 },
  ribs: { span: 20.5, scale: 3.074 },
  both: { span: 20.5, scale: 3.074 },
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
  /**
   * back from the baffle on the bottom (z), as stops only: where the clear floor behind a short bottom slot ends. A
   * floor rib there runs front to back from it, and none runs across the air leaving the duct.
   */
  bottomZ?: number[];
}
export const NO_SUPPORTS: PaBoxSupports = { sideL: [], sideR: [], top: [], bottom: [] };

/**
 * A PA box's six panels on the box axes (x across from the left, y up from the bottom, z back from the baffle): the
 * sides, top, bottom and back at the wall stock, the baffle at its own (it starts above a bottom slot's band). Each edge
 * is held by the panel glued to it there (EdgeHold: its stock and its span away from the joint), except where nothing
 * is: a screwed back's joints (`back`; the window braces don't hold it either: `loose`), the bottom's front edge over a
 * slot's mouth and the baffle's lower edge on the slot's shelf (left hinged, on the safe side).
 */
export function paBoxPanels(
  { iw, ih, inD, band }: PaBoxInside,
  wall: PlateStock,
  baffle: PlateStock,
  sup: PaBoxSupports,
  stops: PaBoxSupports = sup,
  back: BackJointId = DEFAULT_BACK_JOINT,
  /** the driver's cutout on the baffle, in from the baffle's own corner (above a slot's band) */
  hole?: PlateHole,
): BracePanel[] {
  const base = { offU: 0, offV: 0, fixedU: [], fixedV: [], stopU: [], stopV: [] };
  const held = (stock: PlateStock, span: number): EdgeHold => ({ stock, span });
  const glued = back === GLUED_BACK;
  const backHold = (span: number) => (glued ? held(wall, span) : null);
  const sideEdges = {
    u0: held(baffle, iw),
    u1: backHold(iw),
    v0: held(wall, iw),
    v1: held(wall, iw),
  };
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
      edges: sideEdges,
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
      edges: sideEdges,
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
      edges: {
        u0: held(wall, ih),
        u1: held(wall, ih),
        v0: held(baffle, ih - band),
        v1: backHold(ih),
      },
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
      stopV: stops.bottomZ ?? [],
      ...(stops.bottomZ?.length ? { ribAcross: ["x"] as const } : {}),
      edges: {
        u0: held(wall, ih),
        u1: held(wall, ih),
        v0: band > 0 ? null : held(baffle, ih),
        v1: backHold(ih),
      },
    },
    {
      ...base,
      id: "back",
      u: "x",
      v: "y",
      spanU: iw,
      spanV: ih,
      stock: wall,
      ribs: true,
      edges: { u0: backHold(inD), u1: backHold(inD), v0: backHold(inD), v1: backHold(inD) },
      ...(glued ? {} : { loose: true }),
    },
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
      ...(hole ? { hole } : {}),
      edges: {
        u0: held(wall, inD),
        u1: held(wall, inD),
        v0: band > 0 ? null : held(wall, inD),
        v1: held(wall, inD),
      },
    },
  ];
}
