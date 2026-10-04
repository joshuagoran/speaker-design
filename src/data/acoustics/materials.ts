// Absorption coefficients for the coverage map's room: the wall, ceiling and floor materials, in octave bands.
// Random-incidence coefficients, 125 Hz–4 kHz: typical published values for general building materials, as tabulated in
// Everest & Pohlmann, Master Handbook of Acoustics (and the many tables that reproduce them). To add a material, add its
// id to RoomMaterial (src/types.ts) and its row here; the compiler checks every band is there (OctaveRow).
import type { FloorCrowd, OctaveRow, RoomMaterial } from "../../types";

/** The octave bands the absorption tables give, Hz. */
export const OCTAVE_HZ = [125, 250, 500, 1000, 2000, 4000] as const;

/** Each wall and ceiling material: its name as the pickers show it, and its absorption in each octave band. */
export const ROOM_MATERIALS: Record<RoomMaterial, { name: string; alpha: OctaveRow }> = {
  // concrete block, painted
  concrete: { name: "Concrete block", alpha: [0.1, 0.05, 0.06, 0.07, 0.09, 0.08] },
  // 1/2 in gypsum board nailed to 2 × 4 studs, 16 in on center
  drywall: { name: "Drywall on studs", alpha: [0.29, 0.1, 0.05, 0.04, 0.07, 0.09] },
  // 3/8 in plywood paneling
  wood: { name: "Wood paneling", alpha: [0.28, 0.22, 0.17, 0.09, 0.1, 0.11] },
  // ordinary window glass
  glass: { name: "Glass", alpha: [0.35, 0.25, 0.18, 0.12, 0.07, 0.04] },
  // heavy velour, 18 oz/yd², draped to half its area
  curtain: { name: "Heavy curtains", alpha: [0.14, 0.35, 0.55, 0.72, 0.7, 0.65] },
  // nothing there: everything that reaches it leaves
  open: { name: "Open", alpha: [1, 1, 1, 1, 1, 1] },
};

/**
 * The floor, by the crowd on it: an empty concrete or terrazzo floor, or a full one, for which the table's audience
 * row (audience in upholstered seats, the same sources) stands in for a dense standing crowd.
 */
export const FLOOR_ALPHA: Record<FloorCrowd, OctaveRow> = {
  empty: [0.01, 0.01, 0.015, 0.02, 0.02, 0.02],
  full: [0.39, 0.57, 0.8, 0.94, 0.92, 0.87],
};
