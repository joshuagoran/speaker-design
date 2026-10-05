import type { DispersionPlane } from "../types";

/** The dispersion-map planes the PA stack and Hi-fi pages offer, with their names, in display order. */
export const DISPERSION_PLANES = [
  ["h", "Horizontal"],
  ["v", "Vertical"],
] as const satisfies readonly (readonly [DispersionPlane, string])[];

/** A dispersion plane's name, as the toggle spells it. */
export type DispersionPlaneName = (typeof DISPERSION_PLANES)[number][1];

/** A dispersion plane's name: "Horizontal" or "Vertical". */
export function dispersionPlaneName(plane: DispersionPlane): DispersionPlaneName {
  for (const [p, name] of DISPERSION_PLANES) if (p === plane) return name;
  throw new Error(`No dispersion plane named for ${plane}`);
}
