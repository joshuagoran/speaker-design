// A fill's delay and level against a reference (docs/speaker-designer-plan.md P5, the Space page): a placement timed and
// leveled so that, at the listener, it arrives just after the placement it is aligned to and plays at its level. Pure.
//
// A placement is one entry whatever its boxes (a mirrored pair is one placement, two boxes: `expandPlacements`): the
// fill is all of its boxes, and the reference is the placement the user picks, less the fill's own. Delay: the
// reference's first arrival at the listener (each driver's path at the speed of sound, with its member's and its
// placement's delay) less the fill's own first arrival (with its members' delays), plus FILL_PRECEDENCE_MS, so the sound
// still seems to come from the reference (the precedence effect); never below 0. Level: the fill moves by the
// reference's level at the listener less its own, in FILL_ALIGN_BAND (the voice range a fill is there for), at the
// space's input.
import type { SpacePlacement, SpaceVenue } from "../../types";
import { spaceGridRequest, spaceLevelAt, type SpaceModel } from "./spaceCoverage";
import { SPEED_OF_SOUND } from "../../constants/acoustics";
import { METERS_PER_FOOT } from "../../constants/units";
import { FILL_ALIGN_BAND, FILL_PRECEDENCE_MS } from "../../constants/space";

/** Milliseconds in a second. */
const MS_PER_S = 1000;

/** One placement's delay and level, as an alignment sets them. */
export type FillSetting = Pick<SpacePlacement, "levelDb" | "delayMs"> & { placement: number };

/**
 * The delay and level for placement `k` (both boxes of a pair) to play with placement `to` at the listener,
 * FILL_PRECEDENCE_MS after it; null when there is nothing to align to or no sound there (the same placement, or one
 * with no modeled drivers).
 */
export function fillAlignment(
  model: SpaceModel,
  venue: Pick<SpaceVenue, "room" | "earFt" | "listener">,
  placements: readonly Pick<SpacePlacement, "levelDb" | "delayMs">[],
  k: number,
  to: number,
): FillSetting | null {
  if (k === to) return null;
  /** the boxes (indexes into the model) of placement `source` */
  const boxesOf = (source: number) =>
    model.placements.flatMap((p, i) => (p.item.placement.source === source ? [i] : []));
  const fill = boxesOf(k);
  const ref = boxesOf(to);
  const at = { x: venue.listener.x, y: venue.listener.y, z: venue.earFt };
  /** each box's first arrival at the listener, s, with its members' delays (and its placement's, `withOwn`) */
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
  const refTimes = ref.flatMap((i) => arrival(i, true));
  const fillTimes = fill.flatMap((i) => arrival(i, false));
  if (!refTimes.length || !fillTimes.length) return null;
  const delayMs = Math.max(
    0,
    (Math.min(...refTimes) - Math.min(...fillTimes)) * MS_PER_S + FILL_PRECEDENCE_MS,
  );
  // each placement's level at the listener: every other voice silent
  const req = spaceGridRequest(model, venue, FILL_ALIGN_BAND, 0, 1);
  const levelOf = (source: number) =>
    spaceLevelAt(
      {
        ...req,
        outputs: req.outputs.map((out) =>
          Object.fromEntries(
            model.feeds.flatMap((f) =>
              f.placement === source && out[f.id] ? [[f.id, out[f.id]]] : [],
            ),
          ),
        ),
      },
      venue.listener,
    );
  const refDb = levelOf(to);
  const fillDb = levelOf(k);
  if (!Number.isFinite(refDb) || !Number.isFinite(fillDb)) return null;
  // the fill moves by the step that lands it, as a whole, on the reference's level
  return { placement: k, delayMs, levelDb: (placements[k]?.levelDb ?? 0) + refDb - fillDb };
}
