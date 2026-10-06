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

// The same for the Hi-fi woofers and round passive radiators, by nominal size in inches. A size missing here gets a
// "use the datasheet's" note with no number (the part is never dropped); an oval radiator's cutout is always the
// datasheet's.
export const HIFI_DRIVER_CUTOUT_IN: Partial<Record<number, number>> = {
  5: 4.4,
  5.25: 4.6,
  6: 5.1,
  6.5: 5.6,
  7: 6.1,
  8: 7.1,
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

/**
 * A mid-bass driver's mounting depth (baffle front to the back of its magnet) per size class, inches, where its entry
 * gives none: about the deepest of the class's published depths (PA mid-bass datasheets run about 4.5″ for a 10″,
 * 5.5″ for a 12″ and 6.5″ for a 15″), rounded up, so the braces kept clear of it clear the real one.
 */
export const MID_DEPTH_FALLBACK_IN: Record<MidSize, number> = {
  15: 7,
  12: 6,
  10: 5,
};

/**
 * A PA driver's motor (magnet and plates) diameter per size class, inches: about the largest ferrite motor of the
 * class (an 18″ sub's runs to 250 mm, a 15″'s to 220 mm, a 12″'s to 180 mm, a 10″'s to 150 mm); neodymium motors are
 * smaller. The braces keep clear of the basket narrowing to it.
 */
export const DRIVER_MOTOR_DIA_IN: Record<SubSize | MidSize, number> = {
  18: 10,
  15: 8.75,
  12: 7.25,
  10: 6,
};
