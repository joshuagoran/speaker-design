// A driver entry dragged on the front drawing (drawings/SpeakerFront): where its group's center goes, as the spec's
// `position` keeps it (across from the chamber's center line, up from its bottom), kept on the chamber's clear face and
// rounded to the drag's step.
import type { FacePoint } from "../../types";
import type { PlacedChamber } from "./speakerLayout";

/** The step a dragged position is rounded to, in. */
export const DRAG_STEP_IN = 0.125;

/** A span, low to high, in. */
type Span = readonly [lo: number, hi: number];

/** Where a dragged group's center may go, in the spec's position terms: across and up, in. */
export interface DragBounds {
  x: Span;
  y: Span;
}

/**
 * A driver entry's group as the layout placed it: its center in the spec's position terms, and the range its center
 * may move in so every driver of the group stays on the chamber's clear face. `spots` are the layout's (`driverSpots`),
 * `acrossIn` one driver's width (`driverAcrossIn`).
 */
export function dragStart(
  placed: Pick<PlacedChamber, "cx" | "y0" | "clear">,
  spots: readonly FacePoint[],
  acrossIn: number,
): { center: FacePoint; bounds: DragBounds } {
  const xs = spots.map((s) => s.xIn - placed.cx);
  const ys = spots.map((s) => s.yIn - placed.y0);
  const mid = (v: number[]) => (v.length ? (Math.min(...v) + Math.max(...v)) / 2 : 0);
  const center = { xIn: mid(xs), yIn: mid(ys) };
  /** how far the group reaches from its center, across and up */
  const reachX = (xs.length ? (Math.max(...xs) - Math.min(...xs)) / 2 : 0) + acrossIn / 2;
  const reachY = (ys.length ? (Math.max(...ys) - Math.min(...ys)) / 2 : 0) + acrossIn / 2;
  const { clear } = placed;
  const lo = { x: clear.x - placed.cx, y: clear.y - placed.y0 };
  /** a span that keeps the reach inside, or the face's middle where the group is wider than the face */
  const span = (from: number, size: number, reach: number): Span =>
    size >= 2 * reach ? [from + reach, from + size - reach] : [from + size / 2, from + size / 2];
  return {
    center,
    bounds: { x: span(lo.x, clear.w, reachX), y: span(lo.y, clear.h, reachY) },
  };
}

/** A value kept in a span. */
const clamp = (v: number, [lo, hi]: Span) => Math.min(hi, Math.max(lo, v));
/** A value rounded to the step. */
const snap = (v: number, step: number) => Math.round(v / step) * step;

/**
 * Where a group dragged by `delta` (in, up positive) from `start` goes: kept inside `bounds`, rounded to `step`, and
 * kept inside again (the rounding can step past an edge).
 */
export function draggedPosition(
  start: FacePoint,
  delta: FacePoint,
  bounds: DragBounds,
  step = DRAG_STEP_IN,
): FacePoint {
  const at = (v: number, span: Span) => {
    const snapped = snap(clamp(v, span), step);
    return snapped < span[0] - 1e-9 || snapped > span[1] + 1e-9 ? clamp(v, span) : snapped;
  };
  return { xIn: at(start.xIn + delta.xIn, bounds.x), yIn: at(start.yIn + delta.yIn, bounds.y) };
}
