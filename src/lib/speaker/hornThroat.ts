// A front-loaded horn's throat as its walls build it. Pure.
//
// The horn has no throat plate: its side walls start narrower than the cones, so their back edges cover the outer
// parts of each cone. The throat is the opening between the walls' back edges, at the box's inside height (the box's
// top and bottom panels close it). The edges stand just in front of the cones, far enough to clear the cone's full
// travel (its Xmax with a margin) and its surround. The air between each cone and the edges is the front chamber
// (Hornresp's Vtc): the cone's area times that clearance, and the air in the cone's dish.
//
// The compression ratio is the cones' area over the throat's: 1 leaves the cones unloaded; a higher ratio loads them
// more. The throat's area is the horn's first section's start area (`HornSegment.s1`), the one figure both settings
// edit.
import type { HornSegment, SpeakerDriver, ThieleSmall } from "../../types";
import { coneDepthIn, coneParts, type ConeParts } from "./driverParts";
import { CM_PER_IN, MM_PER_IN } from "../../constants/units";
import {
  CONE_DISH_PER_DEPTH,
  CONE_SURROUND_RISE_SHARE,
  CONE_TRAVEL_MARGIN,
} from "../../constants/hornThroat";

/** What the front chamber reads of one cone: its area, cm², its Xmax, mm, and its depth behind the baffle's front, in. */
export interface FrontChamberCone extends Pick<ThieleSmall, "Sd" | "Xmax"> {
  depthIn: number;
}

/** The front chamber: how far the walls' back edges stand in front of the cones, in, and its air, L. */
export interface FrontChamber {
  clearanceIn: number;
  liters: number;
}

/**
 * The front chamber of `count` alike cones under the walls' back edges. The edges clear the cone's travel (its Xmax
 * times `CONE_TRAVEL_MARGIN`) and its surround (`CONE_SURROUND_RISE_SHARE` of the cone's radius, from its area). Each
 * cone holds its area times that clearance, and its dish: a cone `CONE_DISH_PER_DEPTH` of the driver's depth deep, a
 * third of its depth times its area.
 */
export function frontChamber(cone: FrontChamberCone, count: number): FrontChamber {
  const radiusCm = Math.sqrt(cone.Sd / Math.PI);
  const clearanceCm =
    CONE_SURROUND_RISE_SHARE * radiusCm + (cone.Xmax * CONE_TRAVEL_MARGIN * CM_PER_IN) / MM_PER_IN;
  const dishCm = cone.depthIn * CONE_DISH_PER_DEPTH * CM_PER_IN;
  /** cm³ per driver: the slab in front of the cone and its dish */
  const cc = cone.Sd * (clearanceCm + dishCm / 3);
  return { clearanceIn: clearanceCm / CM_PER_IN, liters: (count * cc) / 1000 };
}

/** One cone driver's figures for the front chamber; null for a datasheet kind or an id its table doesn't have. */
function frontCone(driver: SpeakerDriver): { cone: FrontChamberCone; parts: ConeParts } | null {
  const parts = coneParts(driver);
  const depthIn = coneDepthIn(driver);
  return parts && depthIn !== null
    ? { cone: { Sd: parts.ts.Sd, Xmax: parts.ts.Xmax, depthIn }, parts }
    : null;
}

/**
 * The cones on a horn's throat: one driver's parts and figures and how many share the throat. Null: no driver, drivers
 * of more than one kind or id, or none with Thiele/Small parameters.
 */
export function throatCones(
  drivers: readonly SpeakerDriver[],
): { parts: ConeParts; cone: FrontChamberCone; count: number } | null {
  if (drivers.length === 0) return null;
  const [first] = drivers;
  if (drivers.some((d) => d.kind !== first.kind || d.driverId !== first.driverId)) return null;
  const read = frontCone(first);
  return read ? { ...read, count: drivers.reduce((sum, d) => sum + d.count, 0) } : null;
}

/**
 * How far the walls' back edges stand in front of the cones, in: the largest clearance any of the chamber's cones
 * needs (each alone), so the edges clear every cone; 0 with no cone.
 */
export const wallClearanceIn = (drivers: readonly SpeakerDriver[]) =>
  Math.max(
    0,
    ...drivers.flatMap((d) => frontCone(d) ?? []).map((c) => frontChamber(c.cone, 1).clearanceIn),
  );

/** Every cone's area on the throat, cm² (each cone's Sd times its count); 0 with no cone. */
export const conesAreaCm2 = (drivers: readonly SpeakerDriver[]) =>
  drivers.reduce((sum, d) => sum + (coneParts(d)?.ts.Sd ?? 0) * d.count, 0);

/** The compression ratio: the cones' area over the throat's (the first section's start); null with no cone or throat. */
export function compressionRatio(
  conesCm2: number,
  segments: readonly Pick<HornSegment, "s1">[],
): number | null {
  const throat = segments[0]?.s1;
  return conesCm2 > 0 && throat !== undefined && throat > 0 ? conesCm2 / throat : null;
}

/** The throat's area, cm², that gives the cones' area `conesCm2` the compression `ratio`. */
export const throatAreaCm2 = (conesCm2: number, ratio: number) => conesCm2 / ratio;
