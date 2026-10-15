// The path of a horn built into a chamber, as the views draw it: one geometry from the horn engine's own figures (each
// segment's start and end area, length and flare law: lib/acoustics/hornSegments), which the 3D view, the side drawing,
// the front drawing and the bracing's keep-out all read. Pure.
//
// What it keeps of the model: the area at the throat, at the mouth and at each segment's ends, every segment's length
// along the path, and its flare law (`segmentAreaAt`). A section is a rectangle that holds the horn's area there. On a
// straight path its shape comes from the mouth back, segment by segment, each from its shape at its mouth end and the
// way its law is built:
// - parabolic (the area grows linearly): a parallel top and bottom, as high as at its mouth end (the mouth's height for
//   the last segment), and flat, straight side walls that angle out: the width grows linearly;
// - exponential: the same parallel top and bottom (the 1-D horn: flat top and bottom, two curved side walls), its side
//   walls curving out as the area grows;
// - conical (the radius grows linearly): both sides grow together, in proportion, as a pyramid's: four flat walls
//   that meet at one apex, never a constant height (that would curve the side walls).
// Each segment starts with the shape the one before it ends with, so the walls meet at a joint (a kink, never a step).
// A section is never wider than the face: past it, the face's width and the height the area needs. A folded path's
// legs are as wide as the mouth instead, so that they stack: their top and bottom take the area's law (flat for a
// parabolic segment, curved for the others). The path's axis is straight through the mouth's center.
//
// The walls start at the throat, just in front of the cones: the throat is the opening between the side walls' back
// edges (lib/speaker/hornThroat), narrower than the cones where the horn loads them, so the edges cover the cones'
// outer parts. The drivers' bay behind it is the front chamber: as deep as the walls' clearance (`frontIn`), the box
// round the cones and the throat across (never smaller than the throat), its sides closing it off from the wedges
// beside the flare, each wall's back edge returning to them along the throat's plane as a strip (`HornBay.strips`):
// the bay's face less the throat. The strips are the only wood in that plane; the throat's opening stays clear from the
// cones' faces to the mouth. The drivers' bodies stand behind the bay, as deep as the deepest driver's catalog depth,
// and the path fits only with them inside the box.
//
// A folded path runs in legs along the box's depth, one more than it has folds, stacked up the box; each leg is as long
// along the depth as it is along the path, so the legs' lengths add up to the path. A turn joins two legs through a gap
// as high as the duct there, so the air meets the same area; the path length does not count a turn's own bend (the
// model does not either).
//
// Coordinates are inches in the front view's (across from the cabinet's center line, up from its bottom) with `z` the
// distance back from the baffle's inside face, where the mouth is.
import type { Dims2, HornSegment } from "../../types";
import type { FaceRect } from "./speakerLayout";
import { isStraightSegment, segmentAreaAt } from "../acoustics/hornSegments";
import { CM_PER_IN, CM2_PER_IN2 } from "../../constants/units";
import { HORN_PROFILE } from "../../constants/hornEngine";
import { HORN_FIT_TOLERANCE_IN, HORN_MAX_FOLDS, HORN_PATH_STEPS } from "../../constants/hornPath";

/** A section across the path: where it is along it and in the box, and its rectangle. */
export interface HornSection {
  /** the distance along the path from the throat, in */
  s: number;
  /** the distance back from the baffle's inside face, in */
  z: number;
  /** the rectangle's center in the front view, in */
  cx: number;
  cy: number;
  /** its size, in; `w * h` is the horn's area there (the settings', in²) */
  w: number;
  h: number;
  /** the section is an end of a segment (or of a leg), not a step along a flaring one */
  joint: boolean;
}

/** A straight run of the path along the box's depth, its sections from the throat side to the mouth side. */
export interface HornLeg {
  sections: HornSection[];
}

/** A turn between two legs: the box of air at a wall where one leg's air passes to the next, from `z0` to `z1`. */
export interface HornTurn {
  z0: number;
  z1: number;
  cx: number;
  w: number;
  y0: number;
  y1: number;
}

/**
 * The bay the drivers stand in behind the throat: the front chamber, the box round the cones and the throat from `z0` to
 * `z1` (the walls' back edges at one end, the cones' faces at the other), and the drivers' bodies behind it.
 */
export interface HornBay extends FaceRect {
  z0: number;
  z1: number;
  /**
   * the walls' back edges at the throat's plane: the bay's face less the throat's opening, as up to four rectangles in
   * the front view (the sides, full height; the top and bottom, over the throat's width), each `stripIn` deep from the
   * throat's plane toward the cones
   */
  strips: FaceRect[];
  stripIn: number;
  /** where the cones' faces (their frames' fronts) stand, in: the bay's end away from the throat */
  coneZ: number;
  /** where the drivers' bodies end behind the cones, in */
  bodyZ: number;
}

/** A horn's path, throat to mouth. */
export interface HornPath {
  /** the legs in path order; one for a straight path */
  legs: HornLeg[];
  /** the turns, one fewer than the legs */
  turns: HornTurn[];
  /** how many times the path folds back */
  folds: number;
  /** the whole path's length, in: the segments' lengths added */
  pathIn: number;
  /** the drivers' bay at the throat; null when the chamber has no cone to size it */
  bay: HornBay | null;
  /** what the path takes of the box: its depth along z and its height, in (the stack of legs, or the tallest section) */
  needs: { depthIn: number; heightIn: number };
  /** what the box gives it: its clear depth, and its clear height */
  room: { depthIn: number; heightIn: number };
  /** every section, turn and the bay inside the box's clear room */
  fits: boolean;
}

/** What `hornPath` reads. */
export interface HornPathInput {
  segments: readonly HornSegment[];
  /** every area as a share of the settings' (1 unless the mouth is cut to the clear face: the sections shrink alike) */
  areaScale: number;
  /** the mouth on the baffle, in the front view */
  mouth: FaceRect;
  /** the box round the drivers (the bay's size, at least the throat's); null for none */
  drivers: Dims2 | null;
  /** the room the horn has: the chamber's clear face less the vents beside the mouth, and its clear depth */
  clear: FaceRect;
  depthIn: number;
  /** the wall between two legs, in */
  wallIn: number;
  /** how far the walls' back edges stand in front of the cones, in: the front chamber's depth (0 with no cone) */
  frontIn: number;
  /** how deep the drivers' bodies reach behind the cones' faces, in: the deepest driver's catalog depth */
  bodyIn: number;
  /** the path is folded (a bass bin): at least one fold, as many as it needs to fit */
  folded: boolean;
}

/** One leg of the plan: where it starts and which way it runs. */
interface LegPlan {
  /** path distances at its two ends, in */
  s0: number;
  s1: number;
  /** the depth at its start, in */
  z0: number;
  /** it runs toward the baffle (z falls as the path goes on) */
  toFront: boolean;
}

/** How a path of `n` folds lays out along the depth. */
interface FoldPlan {
  legs: LegPlan[];
  /** the depth where every leg's back end stops, in (the back turns open past it) */
  backZ: number;
  /** the depth the front turns take, in (the legs stop this far from the baffle) */
  frontGap: number;
  /** the depth the back turns take, in */
  backGap: number;
}

/**
 * The horn's path in the chamber, or null when there are no segments. A straight path (the default) is one leg, as long
 * as the segments; a folded one is as few folds as fit (at least one, at most `HORN_MAX_FOLDS`), else the one that
 * overflows the box least. `fits` is false where the path does not fit: the sections are then drawn where they are, and
 * `needs` and `room` say by how much.
 */
export function hornPath(input: HornPathInput): HornPath | null {
  const { segments, folded } = input;
  if (segments.length === 0) return null;
  const lengths = segments.map((s) => s.length / CM_PER_IN);
  const starts = lengths.map((_, i) => lengths.slice(0, i).reduce((a, b) => a + b, 0));
  const total = lengths.reduce((a, b) => a + b, 0);
  const counts = folded ? Array.from({ length: HORN_MAX_FOLDS }, (_, i) => i + 1) : [0];
  let best: HornPath | null = null;
  for (const n of counts) {
    const path = hornPathWithFolds(input, starts, total, n);
    if (!path) continue;
    if (path.fits) return path;
    if (!best || overflow(path) < overflow(best)) best = path;
  }
  return best;
}

/**
 * The section where a segment holds `area` on a straight path, from its shape at the segment's mouth end (`end`), by how
 * its law is built (see the header): a conical segment scales both sides alike, as a pyramid; a parabolic or an
 * exponential one keeps its end's height and takes the width the area needs. A straight duct keeps its end's shape.
 */
function lawShape(segment: HornSegment, end: Dims2, area: number): Dims2 {
  if (segment.profile === HORN_PROFILE.conical && !isStraightSegment(segment)) {
    /** each side's share of its end's: the square root of the areas' ratio */
    const ratio = Math.sqrt(area / (end.w * end.h));
    return { w: end.w * ratio, h: end.h * ratio };
  }
  return { w: area / end.h, h: end.h };
}

/** How far a path overflows its room, in (0 when it fits): its depth and its height over what the box gives. */
const overflow = (p: HornPath) =>
  Math.max(0, p.needs.depthIn - p.room.depthIn) + Math.max(0, p.needs.heightIn - p.room.heightIn);

/** The path with `n` folds laid out in the chamber, or null when it cannot be laid out (a leg of no length). */
function hornPathWithFolds(
  input: HornPathInput,
  starts: readonly number[],
  total: number,
  n: number,
): HornPath | null {
  const { segments, areaScale, mouth, drivers, clear, depthIn, wallIn, frontIn, bodyIn } = input;
  /** the area at path distance `s` along segment `i`, in² */
  const areaIn = (i: number, s: number) =>
    (segmentAreaAt(segments[i], (s - starts[i]) * CM_PER_IN) / CM2_PER_IN2) * areaScale;
  /** a shape kept inside the face's width: past it, the face's width and the height its area needs */
  const inFace = (size: Dims2): Dims2 =>
    size.w <= clear.w ? size : { w: clear.w, h: (size.w * size.h) / clear.w };
  /** each segment's section at its mouth end on a straight path, from the mouth back (see the header) */
  const ends: Dims2[] = [];
  let end: Dims2 = { w: areaIn(segments.length - 1, total) / mouth.h, h: mouth.h };
  for (let i = segments.length - 1; i >= 0; i--) {
    ends[i] = end;
    end = inFace(lawShape(segments[i], end, areaIn(i, starts[i])));
  }
  /**
   * the section at path distance `s` along segment `i`, in: on a straight path by its law from its mouth end's shape; a
   * folded path's as wide as the mouth, as high as the area needs
   */
  const sizeAt = (i: number, s: number): Dims2 =>
    n > 0
      ? { w: mouth.w, h: areaIn(i, s) / mouth.w }
      : inFace(lawShape(segments[i], ends[i], areaIn(i, s)));
  /** the height of the duct at path distance `s`, in: the taller side of a step */
  const heightAt = (s: number) =>
    Math.max(
      0,
      ...segments.flatMap((_, i) =>
        s >= starts[i] - 1e-9 && s <= (starts[i + 1] ?? total) + 1e-9 ? [sizeAt(i, s).h] : [],
      ),
    );

  const plan = foldPlan(n, total, drivers ? frontIn + bodyIn : 0, heightAt);
  if (!plan) return null;
  const { legs } = plan;
  const middle = { x: mouth.x + mouth.w / 2, y: mouth.y + mouth.h / 2 };
  /** each leg's sections without their place up the box */
  const cut = legs.map((leg) => {
    const out: Omit<HornSection, "cx" | "cy">[] = [];
    for (let i = 0; i < segments.length; i++) {
      const a = Math.max(leg.s0, starts[i]),
        b = Math.min(leg.s1, starts[i + 1] ?? total);
      if (b - a < 1e-9) continue;
      // a segment of equal areas is straight panels between its ends; any other flares, so it takes steps
      const steps = isStraightSegment(segments[i]) ? 1 : HORN_PATH_STEPS;
      for (let j = 0; j <= steps; j++) {
        const s = a + ((b - a) * j) / steps;
        const { w, h } = sizeAt(i, s);
        const last = out[out.length - 1];
        // a joint where two segments' areas meet is one section; a step is two
        if (last && Math.abs(last.s - s) < 1e-9 && Math.abs(last.w * last.h - w * h) < 1e-9)
          continue;
        out.push({
          s,
          w,
          h,
          joint: j === 0 || j === steps,
          z: leg.toFront ? leg.z0 - (s - leg.s0) : leg.z0 + (s - leg.s0),
        });
      }
    }
    return out;
  });
  /** the stack's slabs: each leg's is as tall as its tallest duct */
  const slabs = cut.map((sections) => Math.max(...sections.map((sec) => sec.h)));
  /** the stack grows down from the mouth's top when there is more room below it, else up from its bottom */
  const down = mouth.y + mouth.h - clear.y >= clear.y + clear.h - mouth.y;
  const sign = down ? -1 : 1;
  const anchor = down ? mouth.y + mouth.h : mouth.y;
  /** each leg's slab edge nearest the mouth's side of the stack, in the front view */
  const slabEdge: number[] = [];
  let edge = anchor;
  for (let k = legs.length - 1; k >= 0; k--) {
    slabEdge[k] = edge;
    edge += sign * (slabs[k] + wallIn);
  }
  /**
   * The center of leg `k`'s duct, up the box, where it is `h` high. The mouth's leg hugs its slab's mouth-side edge, so
   * its end on the baffle is the mouth itself; every other leg hugs the edge away from it, the plate it shares with
   * the leg before it, so a turn's gap and the duct it joins meet.
   */
  const ductY = (k: number, h: number) =>
    k === n ? slabEdge[k] + (sign * h) / 2 : slabEdge[k] + sign * (slabs[k] - h / 2);
  if (cut.some((sections) => sections.length === 0)) return null;
  const pathLegs: HornLeg[] = cut.map((sections, k) => ({
    sections: sections.map((sec) => ({
      ...sec,
      cx: middle.x,
      cy: n === 0 ? middle.y : ductY(k, sec.h),
    })),
  }));

  const turns: HornTurn[] = legs.slice(1).map((_, i) => {
    const before = pathLegs[i].sections[pathLegs[i].sections.length - 1],
      after = pathLegs[i + 1].sections[0];
    const atBack = !legs[i].toFront;
    const ys = [
      before.cy - before.h / 2,
      before.cy + before.h / 2,
      after.cy - after.h / 2,
      after.cy + after.h / 2,
    ];
    return {
      z0: atBack ? plan.backZ : 0,
      z1: atBack ? plan.backZ + plan.backGap : plan.frontGap,
      cx: middle.x,
      w: Math.max(before.w, after.w),
      y0: Math.min(...ys),
      y1: Math.max(...ys),
    };
  });

  const [throat] = pathLegs[0].sections;
  /** the bay's center along one axis: at the throat's, kept inside the face (centered where the bay is larger) */
  const within = (at: number, size: number, lo: number, span: number) =>
    size >= span ? lo + span / 2 : Math.min(lo + span - size / 2, Math.max(lo + size / 2, at));
  /** the bay holds the cones and the throat's opening: never smaller than it (its strips are the face less the throat) */
  const bayBox = drivers && { w: Math.max(drivers.w, throat.w), h: Math.max(drivers.h, throat.h) };
  const bayAt = bayBox && {
    x: within(throat.cx, bayBox.w, clear.x, clear.w),
    y: within(throat.cy, bayBox.h, clear.y, clear.h),
  };
  /** the drivers face the throat: behind it on an even path (its first leg starts at the back), ahead on an odd one */
  const way = n % 2 === 0 ? 1 : -1;
  const coneZ = throat.z + way * frontIn;
  const bay: HornBay | null = bayBox &&
    bayAt && {
      x: bayAt.x - bayBox.w / 2,
      y: bayAt.y - bayBox.h / 2,
      w: bayBox.w,
      h: bayBox.h,
      z0: Math.min(throat.z, coneZ),
      z1: Math.max(throat.z, coneZ),
      coneZ,
      bodyZ: coneZ + way * bodyIn,
      strips: throatStrips(
        { x: bayAt.x - bayBox.w / 2, y: bayAt.y - bayBox.h / 2, ...bayBox },
        { x: throat.cx - throat.w / 2, y: throat.cy - throat.h / 2, w: throat.w, h: throat.h },
      ),
      stripIn: Math.min(wallIn, frontIn),
    };
  const depthNeed = Math.max(plan.backZ + plan.backGap, bay ? Math.max(bay.z1, bay.bodyZ) : 0);
  const heightNeed =
    n > 0
      ? slabs.reduce((sum, h) => sum + h, 0) + n * wallIn
      : Math.max(...pathLegs.flatMap((l) => l.sections.map((sec) => sec.h)));
  const heightRoom = n > 0 ? (down ? anchor - clear.y : clear.y + clear.h - anchor) : clear.h;
  const tol = HORN_FIT_TOLERANCE_IN;
  const inside = (cx: number, cy: number, w: number, h: number) =>
    cx - w / 2 >= clear.x - tol &&
    cx + w / 2 <= clear.x + clear.w + tol &&
    cy - h / 2 >= clear.y - tol &&
    cy + h / 2 <= clear.y + clear.h + tol;
  const fits =
    depthNeed <= depthIn + tol &&
    heightNeed <= heightRoom + tol &&
    pathLegs.every((l) => l.sections.every((s) => inside(s.cx, s.cy, s.w, s.h))) &&
    turns.every((t) => inside(t.cx, (t.y0 + t.y1) / 2, t.w, t.y1 - t.y0)) &&
    (!bay || inside(bay.x + bay.w / 2, bay.y + bay.h / 2, bay.w, bay.h));
  return {
    legs: pathLegs,
    turns,
    folds: n,
    pathIn: total,
    bay,
    needs: { depthIn: depthNeed, heightIn: heightNeed },
    room: { depthIn, heightIn: heightRoom },
    fits,
  };
}

/** The least a strip is wide or tall, in: a smaller one is no wood at all. */
const MIN_STRIP_IN = 1e-6;

/**
 * The bay's face less the throat's opening, as rectangles: the two sides over the bay's whole height, then the top and the
 * bottom over the throat's width. A throat as wide (or as tall) as the bay leaves no strip there.
 */
function throatStrips(bay: FaceRect, throat: FaceRect): FaceRect[] {
  const bayRight = bay.x + bay.w,
    bayTop = bay.y + bay.h,
    throatRight = throat.x + throat.w,
    throatTop = throat.y + throat.h;
  return [
    { x: bay.x, y: bay.y, w: throat.x - bay.x, h: bay.h },
    { x: throatRight, y: bay.y, w: bayRight - throatRight, h: bay.h },
    { x: throat.x, y: throatTop, w: throat.w, h: bayTop - throatTop },
    { x: throat.x, y: bay.y, w: throat.w, h: throat.y - bay.y },
  ].filter((strip) => strip.w > MIN_STRIP_IN && strip.h > MIN_STRIP_IN);
}

/**
 * How `n` folds lay out along the depth, or null when a leg would have no length. The legs run wall to wall; the path
 * ends at the baffle (the mouth), so the last leg runs toward it and the first runs toward it only when `n` is even.
 * Every turn at the front takes the tallest duct among them (`frontGap`), and every one at the back likewise: the gaps
 * depend on where the turns fall along the path, and the turns on the gaps, so they are settled by stepping (a longer gap
 * shortens the legs, which moves the turns toward the throat, where the duct is smaller, so the steps settle).
 */
function foldPlan(
  n: number,
  total: number,
  driverRoom: number,
  heightAt: (s: number) => number,
): FoldPlan | null {
  if (n === 0) {
    return {
      legs: [{ s0: 0, s1: total, z0: total, toFront: true }],
      backZ: total,
      frontGap: 0,
      backGap: 0,
    };
  }
  const toFront = (k: number) => (n - k) % 2 === 0;
  /**
   * where leg `k` stops at the front, in: the baffle for the mouth's leg; a path that starts there leaves the drivers
   * room (`driverRoom`: their front chamber and their bodies; 0 with no drivers)
   */
  const frontEnd = (k: number, gap: number) =>
    k === n ? 0 : k === 0 && n % 2 === 1 ? Math.max(gap, driverRoom) : gap;
  let frontGap = 0,
    backGap = 0,
    backZ = total;
  for (let step = 0; step < 24; step++) {
    const stops = Array.from({ length: n + 1 }, (_, k) => frontEnd(k, frontGap));
    backZ = (total + stops.reduce((a, b) => a + b, 0)) / (n + 1);
    let s = 0,
      front = 0,
      back = 0;
    for (let k = 0; k < n; k++) {
      s += backZ - stops[k];
      if (toFront(k)) front = Math.max(front, heightAt(s));
      else back = Math.max(back, heightAt(s));
    }
    backGap = back;
    const settled = Math.abs(front - frontGap) < 1e-9;
    frontGap = front;
    if (settled) break;
  }
  // the legs from the settled gaps: their lengths add up to the path
  const stops = Array.from({ length: n + 1 }, (_, k) => frontEnd(k, frontGap));
  backZ = (total + stops.reduce((a, b) => a + b, 0)) / (n + 1);
  const legs: LegPlan[] = [];
  let s = 0;
  for (let k = 0; k <= n; k++) {
    const stop = stops[k];
    const length = backZ - stop;
    if (length <= 1e-9) return null;
    legs.push({ s0: s, s1: s + length, z0: toFront(k) ? backZ : stop, toFront: toFront(k) });
    s += length;
  }
  return { legs, backZ, frontGap, backGap };
}
