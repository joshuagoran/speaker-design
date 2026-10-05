// Typical front-mount baffle cutout per driver size class, inches; the cutlist notes quote it with "check the
// datasheet". Keyed by every PA sub and mid size (SubSize | MidSize in src/types.ts), so a new size class fails the
// type check until its cutout is added here.
import type { MidSize, SubSize } from "../../types";

export const DRIVER_CUTOUT_IN: Record<SubSize | MidSize, number> = {
  18: 16.6,
  15: 13.9,
  12: 11.1,
  10: 9.2,
};

/**
 * A sub driver's mounting depth (baffle front to the back of its magnet) per size class, inches, where its datasheet
 * gives none: about the deepest of the class's published depths, so a tube routed behind the driver clears it.
 */
export const SUB_DEPTH_FALLBACK_IN: Record<SubSize, number> = {
  18: 9.5,
  15: 8,
};

/**
 * A sub driver's frame diameter per size class, inches: the round flange that sits on the baffle, about half an inch
 * over the nominal size. The port tubes' layout keeps their flares off it.
 */
export const SUB_FRAME_DIA_IN: Record<SubSize, number> = {
  18: 18.5,
  15: 15.5,
};
