// A fill's delay and level against the mains (docs/speaker-designer-plan.md P5, the Space page): a placement turned and
// timed so that, at the listener, it arrives just after the mains and plays at their level. Pure.
//
// The mains are every other placement but the fill's mirror partner. Delay: the mains' first arrival at the listener
// (each driver's path at the speed of sound, with its member's and its placement's delay) less the fill's own first
// arrival (with its members' delays), plus FILL_PRECEDENCE_MS so the sound still seems to come from the mains (the
// precedence effect); never below 0. Level: the fill's level moved by the mains' level at the listener less the fill's
// own, in FILL_ALIGN_BAND (the voice range a fill is there for), at the space's input.
import type { SpacePlacement, SpaceVenue } from "../../types";
import { spaceGridRequest, spaceLevelAt, type SpaceModel } from "./spaceCoverage";
import { SPEED_OF_SOUND } from "../../constants/acoustics";
import { METERS_PER_FOOT } from "../../constants/units";
import { FILL_ALIGN_BAND, FILL_PRECEDENCE_MS } from "../../constants/space";

/** Milliseconds in a second. */
const MS_PER_S = 1000;

/** The placements a placement plays with as one: itself and its mirror partner (the one it follows, or follows it). */
const pairOf = (placements: readonly Pick<SpacePlacement, "follows">[], k: number) =>
  new Set(
    placements.flatMap((p, i) =>
      i === k || p.follows === k || placements[k]?.follows === i ? [i] : [],
    ),
  );

/**
 * Placement `k`'s delay and level to play with the mains at the listener; null when it has no mains or no sound there
 * (nothing else placed, or a placement with no modeled drivers).
 */
export function fillAlignment(
  model: SpaceModel,
  venue: Pick<SpaceVenue, "room" | "earFt" | "listener">,
  placements: readonly Pick<SpacePlacement, "follows" | "levelDb" | "delayMs">[],
  k: number,
): Pick<SpacePlacement, "levelDb" | "delayMs"> | null {
  const pair = pairOf(placements, k);
  const at = { x: venue.listener.x, y: venue.listener.y, z: venue.earFt };
  /** each placement's first arrival at the listener, s, with its members' delays (and its own, `withOwn`) */
  const arrival = (i: number, withOwn: boolean) => {
    const p = model.placements[i];
    if (!p?.response) return null;
    const own = withOwn ? p.item.placement.delayMs : 0;
    const times = p.item.drivers.flatMap((d) => {
      const member = p.response?.members[d.member];
      if (!member) return [];
      const r = Math.hypot(d.at.x - at.x, d.at.y - at.y, d.at.z - at.z) * METERS_PER_FOOT;
      return [r / SPEED_OF_SOUND + (member.delayMs + own) / MS_PER_S];
    });
    return times.length ? Math.min(...times) : null;
  };
  const mains = model.placements.flatMap((_, i) => {
    if (pair.has(i)) return [];
    const t = arrival(i, true);
    return t === null ? [] : [t];
  });
  const fill = arrival(k, false);
  if (!mains.length || fill === null) return null;
  const delayMs = Math.max(0, (Math.min(...mains) - fill) * MS_PER_S + FILL_PRECEDENCE_MS);
  // each side's level at the listener: the other side's voices silent
  const req = spaceGridRequest(model, venue, FILL_ALIGN_BAND, 0, 1);
  const levelOf = (keep: (placement: number) => boolean) =>
    spaceLevelAt(
      {
        ...req,
        outputs: req.outputs.map((out) =>
          Object.fromEntries(
            model.feeds.flatMap((f) => (keep(f.placement) && out[f.id] ? [[f.id, out[f.id]]] : [])),
          ),
        ),
      },
      venue.listener,
    );
  const mainsDb = levelOf((i) => !pair.has(i));
  const fillDb = levelOf((i) => i === k);
  if (!Number.isFinite(mainsDb) || !Number.isFinite(fillDb)) return null;
  return { delayMs, levelDb: (placements[k]?.levelDb ?? 0) + mainsDb - fillDb };
}
