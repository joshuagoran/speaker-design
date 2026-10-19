// A chamber's parts as a top section shows them (drawings/SpeakerTop): a straight horn's flare seen from above, and a
// slot's channels up the front sides. Pure geometry, from the horn geometry every view reads (lib/speaker/hornGeometry,
// by `hornFlare`) and the slot's openings (`slotOpeningsAt`).
import type { SpeakerDriver, SpeakerSlotPort } from "../../types";
import {
  driverAcrossIn,
  driverSpots,
  slotOpeningsAt,
  type HornFlare,
  type PlacedChamber,
} from "./speakerLayout";

/**
 * A point of a top section: `x` across (the layout's: from the cabinet's center line, seen from the front) and `z` back
 * from the baffle's inside face, in.
 */
export interface PlanPoint {
  x: number;
  z: number;
}

/** A box in a top section by its edges, in (`PlanPoint`'s terms). */
export interface PlanBox {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

/** A straight horn seen from above. */
export interface HornTopSection {
  /** each leg's outline: its side walls' flare along the depth (the sections' widths) */
  legs: PlanPoint[][];
  /** each turn of a folded path, at a wall */
  turns: PlanBox[];
  /** the front chamber: between the cones and the back edges of the walls; null with no bay */
  bay: PlanBox | null;
  /** the driver board behind the bay; null with no bay */
  board: PlanBox | null;
  /** each driver behind the throat, from the board to the back of its body, with its entry */
  drivers: { driver: SpeakerDriver; box: PlanBox }[];
}

/**
 * A straight horn's top section, cut through its center: its legs (the side walls' flare), the turns of a folded path,
 * the drivers' bay and board, and the drivers behind the throat. The board runs back from the bay's end on an even
 * path and toward the baffle on an odd one.
 */
export function hornTopSection(placed: PlacedChamber, { path }: HornFlare): HornTopSection {
  const legs = path.legs.map((leg) => [
    ...leg.sections.map((s) => ({ x: s.cx - s.w / 2, z: s.z })),
    ...[...leg.sections].reverse().map((s) => ({ x: s.cx + s.w / 2, z: s.z })),
  ]);
  const turns = path.turns.map((u) => ({
    x0: u.cx - u.w / 2,
    x1: u.cx + u.w / 2,
    z0: u.z0,
    z1: u.z1,
  }));
  const { bay } = path;
  if (!bay) return { legs, turns, bay: null, board: null, drivers: [] };
  const way = path.folds % 2 === 0 ? 1 : -1;
  const across = { x0: bay.x, x1: bay.x + bay.w };
  const drivers = placed.chamber.drivers
    .filter((d) => placed.spots.has(d))
    .flatMap((driver) => {
      const r = driverAcrossIn(driver) / 2;
      if (r <= 0) return [];
      return driverSpots(placed, driver).map((spot) => ({
        driver,
        box: { x0: spot.xIn - r, x1: spot.xIn + r, z0: bay.boardZ, z1: bay.bodyZ },
      }));
    });
  return {
    legs,
    turns,
    bay: { ...across, z0: bay.z0, z1: bay.z1 },
    board: { ...across, z0: bay.boardZ, z1: bay.boardZ + bay.boardIn * way },
    drivers,
  };
}

/** A slot's parts up the front sides, seen from above. */
export interface SideSlotTopSection {
  /** each channel along its side wall, from the baffle's front face back */
  channels: PlanBox[];
  /** each channel's plate, a wall thick, on its inner side */
  plates: PlanBox[];
  /** where a channel is longer than the clear depth: the rest folded along the back */
  folds: PlanBox[];
}

/**
 * A slot's channels up the front sides (`SLOT_PLACE.sides`), seen from above: each runs back along its side wall from
 * the baffle's front face, its plate on its inner side, and the length the clear depth leaves folds along the back
 * from that wall. Empty for a slot along the floor. `t` is the wall's thickness; `clearDepth` the depth from the
 * baffle's inside face to the back's.
 */
export function sideSlotTopSection(
  placed: Pick<PlacedChamber, "clear" | "cx" | "y0">,
  slot: Pick<SpeakerSlotPort, "n" | "h" | "place" | "len">,
  t: number,
  clearDepth: number,
): SideSlotTopSection {
  const run = Math.min(slot.len, clearDepth);
  const rest = slot.len - run;
  const out: SideSlotTopSection = { channels: [], plates: [], folds: [] };
  for (const o of slotOpeningsAt(placed, slot, t)) {
    if (!o.side) continue;
    const x = placed.cx + o.x;
    out.channels.push({ x0: x - o.w / 2, x1: x + o.w / 2, z0: -t, z1: run });
    const inner = x - o.side * (o.w / 2);
    out.plates.push({ x0: inner, x1: inner - o.side * t, z0: 0, z1: run });
    if (rest > 1e-9)
      out.folds.push(
        o.side < 0
          ? { x0: x - o.w / 2, x1: x - o.w / 2 + rest, z0: clearDepth - o.w, z1: clearDepth }
          : { x0: x + o.w / 2 - rest, x1: x + o.w / 2, z0: clearDepth - o.w, z1: clearDepth },
      );
  }
  return out;
}
