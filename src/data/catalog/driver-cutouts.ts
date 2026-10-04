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
