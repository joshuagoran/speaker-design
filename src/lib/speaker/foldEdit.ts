// Hand edits to a folded horn's boards (docs/folded-horn-plan.md, "The UI"): a corner, a whole board or the drivers
// dragged in the side view, and the boards kept on a box wall that moves. Every place snaps to `SPEAKER_STEPS.sizeIn`.
// Pure.
import type { FoldWall, HornBoards } from "../../types";
import type { FoldPoint, FoldRoom } from "./hornBoards";
import { FOLD_WALL } from "../../constants/hornBoards";
import { SPEAKER_STEPS } from "../../constants/speakerSteps";

/** `v` to the nearest step of the page's sizes. */
const snap = (v: number) => Math.round(v / SPEAKER_STEPS.sizeIn) * SPEAKER_STEPS.sizeIn;

/** `v` kept from `lo` to `hi`. */
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * A corner at `to` (snapped, unless `snapped` is false), kept in the side section: one on a wall slides along it (the
 * baffle and the back up and down, the top and the bottom back and forth), a free one goes anywhere inside.
 */
function placed(
  corner: HornBoards["corners"][number],
  to: FoldPoint,
  room: Pick<FoldRoom, "depthIn" | "heightIn">,
  snapped = true,
): HornBoards["corners"][number] {
  const at = (v: number) => (snapped ? snap(v) : v);
  const z = clamp(at(to.z), 0, room.depthIn),
    y = clamp(at(to.y), 0, room.heightIn);
  const along: Partial<Record<FoldWall, FoldPoint>> = {
    [FOLD_WALL.baffle]: { z: 0, y },
    [FOLD_WALL.back]: { z: room.depthIn, y },
    [FOLD_WALL.bottom]: { z, y: 0 },
    [FOLD_WALL.top]: { z, y: room.heightIn },
  };
  return { ...corner, ...(corner.wall === null ? { z, y } : along[corner.wall]) };
}

/** The plan with corner `i` dragged to `to` (`placed`). */
export const withCornerAt = (
  plan: HornBoards,
  i: number,
  to: FoldPoint,
  room: Pick<FoldRoom, "depthIn" | "heightIn">,
): HornBoards => ({
  ...plan,
  corners: plan.corners.map((c, k) => (k === i ? placed(c, to, room) : c)),
});

/**
 * The plan with board `i` dragged by `by` (snapped) from where it was in `start`: both its corners move together, the
 * board keeping its shape, each held to its wall as a dragged corner is.
 */
export function withBoardMoved(
  start: HornBoards,
  i: number,
  by: FoldPoint,
  room: Pick<FoldRoom, "depthIn" | "heightIn">,
): HornBoards {
  const board = start.boards[i];
  if (!board) return start;
  const dz = snap(by.z),
    dy = snap(by.y);
  return {
    ...start,
    corners: start.corners.map((c, k) =>
      k === board.a || k === board.b ? placed(c, { z: c.z + dz, y: c.y + dy }, room, false) : c,
    ),
  };
}

/** The plan with its drivers slid along their board to where `to` falls on it, kept on the board. */
export function withDriversAt(plan: HornBoards, to: FoldPoint): HornBoards {
  const drivers = plan.drivers;
  if (!drivers) return plan;
  const board = plan.boards[drivers.board];
  const a = plan.corners[board.a],
    b = plan.corners[board.b];
  const dz = b.z - a.z,
    dy = b.y - a.y;
  const lengthIn = Math.hypot(dz, dy);
  if (lengthIn <= 0) return plan;
  const alongIn = ((to.z - a.z) * dz + (to.y - a.y) * dy) / lengthIn;
  return { ...plan, drivers: { ...drivers, alongIn: clamp(snap(alongIn), 0, lengthIn) } };
}

/** The plan with the corners on the back wall moved `byIn` back, or those on the top `byIn` up: the wall moved. */
export const withWallMoved = (
  plan: HornBoards,
  wall: typeof FOLD_WALL.back | typeof FOLD_WALL.top,
  byIn: number,
): HornBoards => ({
  ...plan,
  corners: plan.corners.map((c) =>
    c.wall !== wall
      ? c
      : wall === FOLD_WALL.back
        ? { ...c, z: c.z + byIn }
        : { ...c, y: c.y + byIn },
  ),
});
