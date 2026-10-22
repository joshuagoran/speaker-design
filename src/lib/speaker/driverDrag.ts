// A driver entry dragged on the front drawing (drawings/SpeakerFront): where its group's center goes, as the spec's
// `position` keeps it (across from the chamber's center line, up from its bottom), kept on the chamber's clear face and
// rounded to the drag's step.
import { clamp } from "../clamp";
import type { FacePoint } from "../../types";
import {
  driverSpots,
  speakerLayout,
  type LayoutCabinet,
  type PlacedChamber,
} from "./speakerLayout";

/** The step a dragged position is rounded to, in. */
export const DRAG_STEP_IN = 0.25;

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
/** `v` held within `span` */
const clampToSpan = (v: number, [lo, hi]: Span) => clamp(v, lo, hi);
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
    const snapped = snap(clampToSpan(v, span), step);
    return snapped < span[0] - 1e-9 || snapped > span[1] + 1e-9 ? clampToSpan(v, span) : snapped;
  };
  return { xIn: at(start.xIn + delta.xIn, bounds.x), yIn: at(start.yIn + delta.yIn, bounds.y) };
}

/** The steps that find how far a blocked drag may go toward where it was aimed (halving the step each time). */
const BLOCKED_STEPS = 6;

/**
 * Where the other drivers of chamber `chamber` stand with entry `driver` at `position`, as one key (the layout keeps
 * drivers apart, so an entry moved onto another pushes that one aside).
 */
export function othersKey(
  cabinet: LayoutCabinet,
  chamber: number,
  driver: number,
  position: FacePoint,
): string {
  const chambers = cabinet.chambers.map((c, i) =>
    i === chamber
      ? { ...c, drivers: c.drivers.map((d, j) => (j === driver ? { ...d, position } : d)) }
      : c,
  );
  const placed = speakerLayout({ ...cabinet, chambers }).chambers[chamber];
  if (!placed) return "";
  return JSON.stringify(
    placed.chamber.drivers.flatMap((d, j) =>
      j === driver ? [] : driverSpots(placed, d).map((s) => [s.xIn.toFixed(2), s.yIn.toFixed(2)]),
    ),
  );
}

/**
 * The position a drag from `last` toward `next` takes without moving any other driver (`othersKey` stays `others`):
 * `next` when it moves none, else the farthest point toward it that moves none, rounded to `step`.
 */
export function unblockedPosition(
  cabinet: LayoutCabinet,
  chamber: number,
  driver: number,
  others: string,
  last: FacePoint,
  next: FacePoint,
  step = DRAG_STEP_IN,
): FacePoint {
  const clearAt = (p: FacePoint) => othersKey(cabinet, chamber, driver, p) === others;
  if (clearAt(next)) return next;
  /** the share of the way from `last` to `next` known clear */
  let clear = 0;
  for (let i = 1, span = 0.5; i <= BLOCKED_STEPS; i++, span /= 2) {
    const tryAt = clear + span;
    const p = {
      xIn: last.xIn + (next.xIn - last.xIn) * tryAt,
      yIn: last.yIn + (next.yIn - last.yIn) * tryAt,
    };
    if (clearAt(p)) clear = tryAt;
  }
  const p = {
    xIn: snap(last.xIn + (next.xIn - last.xIn) * clear, step),
    yIn: snap(last.yIn + (next.yIn - last.yIn) * clear, step),
  };
  return clearAt(p) ? p : last;
}
