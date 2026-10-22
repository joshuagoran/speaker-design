import type { DispersionPlane } from "../types";

/** The dispersion-map planes the app offers, with their names, in display order. */
export const DISPERSION_PLANES = [
  ["h", "Horizontal"],
  ["v", "Vertical"],
] as const satisfies readonly (readonly [DispersionPlane, string])[];

/** A dispersion plane's name, as the toggle spells it. */
export type DispersionPlaneName = (typeof DISPERSION_PLANES)[number][1];

/** What a map's 0° is: the horn axis, or the Speaker and Stack pages' listening axis (the highest band's). */
export const DISPERSION_AXIS_NAMES = {
  horn: "horn",
  listening: "listening",
} as const;

/** A dispersion map's title: its plane, its distance, m, and the axis its 0° is on. */
export const dispersionMapTitle = (
  plane: DispersionPlane,
  distM: number,
  axis: keyof typeof DISPERSION_AXIS_NAMES,
) =>
  plane === "v"
    ? `${dispersionPlaneName("v")} dispersion at ${distM} m: below (−) to above (+) the ${DISPERSION_AXIS_NAMES[axis]} axis`
    : `${dispersionPlaneName("h")} dispersion at ${distM} m, at ${DISPERSION_AXIS_NAMES[axis]} height (0° is on axis)`;

/** The plane the Speaker and Stack pages' maps show first. */
export const DISPERSION_START_PLANE: DispersionPlane = "h";

/** The section heading over the Speaker and Stack pages' maps. */
export const DISPERSION_HEADING = "Dispersion";
/**
 * In place of the map for a speaker with a horn the map does not model yet: a back-loaded horn, or a folded horn with
 * no mouth drawn (lib/speaker/stackDispersion `dispersionModeled`).
 */
export const DISPERSION_HORN_NOTE =
  "Dispersion isn’t shown for back-loaded horns or folded horns with no mouth drawn yet.";

/** A dispersion plane's name: "Horizontal" or "Vertical". */
export function dispersionPlaneName(plane: DispersionPlane): DispersionPlaneName {
  for (const [p, name] of DISPERSION_PLANES) if (p === plane) return name;
  throw new Error(`No dispersion plane named for ${plane}`);
}
