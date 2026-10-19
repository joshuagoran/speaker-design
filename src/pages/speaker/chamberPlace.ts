// A chamber's position as its Advanced fold shows it: its center left (−) or right (+) of the cabinet's center, seen
// from the front, and its bottom up from the cabinet's bottom, in. The spec keeps `SpeakerChamber.at`, the chamber's
// lower-left corner; the cabinet is the span of all its chambers (lib/speaker/speakerLayout).
import type { SpeakerChamber } from "../../types";

/** A chamber's place and size, as the position reads it. */
type Placed = Pick<SpeakerChamber, "at" | "dims">;

/** Within this, in, two edges are the same (rounding in the fields). */
const EPS_IN = 1e-6;

/** The left and right edges of `chambers` across the front, in; null for none. */
function spanX(chambers: readonly Placed[]): { a: number; b: number } | null {
  if (!chambers.length) return null;
  return {
    a: Math.min(...chambers.map((c) => c.at.xIn)),
    b: Math.max(...chambers.map((c) => c.at.xIn + c.dims.w)),
  };
}

/** Chamber `i`'s position: its center from the cabinet's center line, and its bottom from the cabinet's bottom, in. */
export function chamberOffset(chambers: readonly Placed[], i: number): { x: number; y: number } {
  const c = chambers[i];
  const span = spanX(chambers);
  if (!c || !span) return { x: 0, y: 0 };
  const bottom = Math.min(...chambers.map((k) => k.at.yIn));
  return { x: c.at.xIn + c.dims.w / 2 - (span.a + span.b) / 2, y: c.at.yIn - bottom };
}

/**
 * Chamber `i`'s left edge (`at.xIn`) that puts its center `x` from the cabinet's center line, the other chambers held:
 * the cabinet's span moves with a chamber that sticks out, so each case of how it sits against the others is solved.
 * With no other chamber the chamber is the cabinet: its edge is kept.
 */
export function atXForOffset(chambers: readonly Placed[], i: number, x: number): number {
  const c = chambers[i];
  const span = spanX(chambers.filter((_, k) => k !== i));
  if (!c) return 0;
  if (!span) return c.at.xIn;
  const { a, b } = span;
  const w = c.dims.w;
  const fits = (center: number, left: boolean, right: boolean) =>
    (left ? center - w / 2 < a - EPS_IN : center - w / 2 >= a - EPS_IN) &&
    (right ? center + w / 2 > b + EPS_IN : center + w / 2 <= b + EPS_IN);
  const candidates: { center: number; left: boolean; right: boolean }[] = [
    // inside the others' span: the cabinet's center is theirs
    { center: (a + b) / 2 + x, left: false, right: false },
    // out past the left edge only: the cabinet runs from its left edge to theirs on the right
    { center: 2 * x - w / 2 + b, left: true, right: false },
    // out past the right edge only
    { center: 2 * x + a + w / 2, left: false, right: true },
  ];
  const found = candidates.find((k) => fits(k.center, k.left, k.right));
  // wider than the others on both sides: it is the cabinet's span, so its center is the cabinet's (x is 0)
  const center = found ? found.center : (a + b) / 2;
  return center - w / 2;
}

/**
 * Chamber `i`'s bottom (`at.yIn`) that puts it `y` up from the cabinet's bottom (at least 0), the other chambers held.
 * With no other chamber its bottom is kept.
 */
export function atYForOffset(chambers: readonly Placed[], i: number, y: number): number {
  const c = chambers[i];
  const others = chambers.filter((_, k) => k !== i);
  if (!c) return 0;
  if (!others.length) return c.at.yIn;
  return Math.min(...others.map((k) => k.at.yIn)) + Math.max(0, y);
}
