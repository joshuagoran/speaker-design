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
