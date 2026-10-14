// A fill's delay and level against a reference (docs/speaker-designer-plan.md P5, the Space page): a placement timed and
// leveled so that, at the listener, it arrives just after the placement it is aligned to and plays at its level. Pure.
//
// A placement and its mirrored copies play as one group (`placementGroup`): the fill is its whole group, and the
// reference is the group the user picks, less the fill's own. A copy follows its lead, so the setting goes to the lead
// (`placementLead`). Delay: the reference's first arrival at the listener (each driver's path at the speed of sound, with
// its member's and its placement's delay) less the fill group's own first arrival (with its members' delays), plus
// FILL_PRECEDENCE_MS, so the sound still seems to come from the reference (the precedence effect); never below 0. Level:
// the lead moves by the reference's level at the listener less the whole group's, in FILL_ALIGN_BAND (the voice range a
// fill is there for), at the space's input.
import type { SpacePlacement, SpaceVenue } from "../../types";
import { spaceGridRequest, spaceLevelAt, type SpaceModel } from "./spaceCoverage";
import { SPEED_OF_SOUND } from "../../constants/acoustics";
import { METERS_PER_FOOT } from "../../constants/units";
import { FILL_ALIGN_BAND, FILL_PRECEDENCE_MS } from "../../constants/space";

/** Milliseconds in a second. */
const MS_PER_S = 1000;

/** The placement that placement `k` follows at the end of its chain of mirror partners (itself when it is on its own). */
export function placementLead(
  placements: readonly Pick<SpacePlacement, "follows">[],
  k: number,
): number {
  const j = placements[k]?.follows;
  return j !== null && j !== undefined && j >= 0 && j < k ? placementLead(placements, j) : k;
}

/** The placements that play with placement `k` as one: itself and its mirrored copies (one lead and its followers). */
export function placementGroup(
  placements: readonly Pick<SpacePlacement, "follows">[],
  k: number,
): number[] {
  const lead = placementLead(placements, k);
  return placements.flatMap((_, i) => (placementLead(placements, i) === lead ? [i] : []));
}

/** The space's placement groups (a placement on its own, or a lead with its mirrored copy), in the order of their leads. */
export const placementGroups = (placements: readonly Pick<SpacePlacement, "follows">[]) =>
  placements.flatMap((_, i) =>
    placementLead(placements, i) === i ? [placementGroup(placements, i)] : [],
  );

/** One placement's delay and level, as an alignment sets them. */
export type FillSetting = Pick<SpacePlacement, "levelDb" | "delayMs"> & { placement: number };

/**
 * The delay and level for placement `k`'s group (it and its mirrored copies) to play with placement `to`'s group at the
 * listener, FILL_PRECEDENCE_MS after it, as a setting of the group's lead; null when there is nothing to align to or no
 * sound there (the same group, or a group with no modeled drivers).
 */
export function fillAlignment(
  model: SpaceModel,
  venue: Pick<SpaceVenue, "room" | "earFt" | "listener">,
  placements: readonly Pick<SpacePlacement, "follows" | "levelDb" | "delayMs">[],
  k: number,
  to: number,
): FillSetting | null {
  const fill = new Set(placementGroup(placements, k));
  const ref = new Set(placementGroup(placements, to).filter((i) => !fill.has(i)));
  const at = { x: venue.listener.x, y: venue.listener.y, z: venue.earFt };
  /** each placement's first arrival at the listener, s, with its members' delays (and its own, `withOwn`) */
  const arrival = (i: number, withOwn: boolean) => {
    const p = model.placements[i];
    if (!p?.response) return [];
    const own = withOwn ? p.item.placement.delayMs : 0;
    return p.item.drivers.flatMap((d) => {
      const member = p.response?.members[d.member];
      if (!member) return [];
      const r = Math.hypot(d.at.x - at.x, d.at.y - at.y, d.at.z - at.z) * METERS_PER_FOOT;
      return [r / SPEED_OF_SOUND + (member.delayMs + own) / MS_PER_S];
    });
  };
  const refTimes = [...ref].flatMap((i) => arrival(i, true));
  const fillTimes = [...fill].flatMap((i) => arrival(i, false));
  if (!refTimes.length || !fillTimes.length) return null;
  const delayMs = Math.max(
    0,
    (Math.min(...refTimes) - Math.min(...fillTimes)) * MS_PER_S + FILL_PRECEDENCE_MS,
  );
  // each group's level at the listener: every other voice silent
  const req = spaceGridRequest(model, venue, FILL_ALIGN_BAND, 0, 1);
  const levelOf = (group: ReadonlySet<number>) =>
    spaceLevelAt(
      {
        ...req,
        outputs: req.outputs.map((out) =>
          Object.fromEntries(
            model.feeds.flatMap((f) =>
              group.has(f.placement) && out[f.id] ? [[f.id, out[f.id]]] : [],
            ),
          ),
        ),
      },
      venue.listener,
    );
  const refDb = levelOf(ref);
  const fillDb = levelOf(fill);
  if (!Number.isFinite(refDb) || !Number.isFinite(fillDb)) return null;
  // the lead moves by the step that lands the group as a whole on the reference's level
  const lead = placementLead(placements, k);
  return { placement: lead, delayMs, levelDb: (placements[lead]?.levelDb ?? 0) + refDb - fillDb };
}
