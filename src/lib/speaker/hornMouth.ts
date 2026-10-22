// A horn-loaded chamber's mouth as it radiates: where it is, which way it faces, its size and its walls' angles in
// each plane. The coverage models (lib/acoustics/directivity `mouthPlane`) read it: a horn radiates only from its
// mouth, never from the cones inside it. Pure.
//
// A straight horn's mouth is its flare's (lib/speaker/speakerLayout `hornFlare`), on the baffle; its walls' angles are
// those of its last leg's last step to the mouth. A folded horn's is the mouth the user draws (`HornFold.mouth`): an
// opening in one wall, as wide as the chamber, with the boards that meet its two ends as its walls in the side section,
// and the chamber's side walls (parallel) across it. Source for radiating from the mouth alone: H. F. Olson,
// "Acoustical Engineering" (1957), horns: a horn's sound leaves through its mouth, and its directivity is set by the
// mouth's size and the flare.
//
// Shortcomings: a mouth's walls are the straight lines at its edges (a curved flare's angle is its last step's); a
// folded horn's sound leaves only through its mouth, with no path-length interference inside the fold; a board that
// only nears a mouth's end counts as its wall.
import type { FoldWall, SidePoint, SpeakerCabinet } from "../../types";
import { FOLD_WALL } from "../../constants/speakerSpec";
import { RAD } from "../../constants/units";
import { driversOnBaffle, hornFlare, type PlacedChamber } from "./speakerLayout";
import { foldDrawing } from "./foldHorn";
import { baffleInsetIn } from "./chamberAir";

/** Walls whose included angle is at most this, degrees, are parallel: they never hold the pattern. */
const PARALLEL_DEG = 1e-6;

/** A horn's mouth as it radiates. */
export interface HornMouth {
  /** its center in its speaker, in: across the center line, up from the bottom, back from the front */
  at: { x: number; y: number; z: number };
  /** the wall it opens in: the baffle for a straight horn */
  facing: FoldWall;
  /** its size seen along its axis, in: across the box (`w`) and the other way (`h`: up, or along the depth on the top or bottom) */
  w: number;
  h: number;
  /** its walls' included angle in each of those planes, degrees: null where they are parallel */
  wallDeg: { h: number | null; v: number | null };
}

/** An included angle, degrees, as a wall angle: null where it is parallel (or narrows toward the mouth). */
const wallAngle = (deg: number) => (deg > PARALLEL_DEG ? deg : null);

/**
 * A straight horn's mouth: its flare's mouth on the baffle, and each plane's included angle from the last two sections
 * of its last leg (the walls' angle at the mouth: 2·atan of the half growth over the step).
 */
function straightMouth(
  cabinet: Pick<SpeakerCabinet, "panel" | "construction" | "insetIn">,
  placed: PlacedChamber,
): HornMouth | null {
  const flare = hornFlare(cabinet, placed);
  if (!flare) return null;
  const { mouth } = flare;
  const sections = flare.path.legs[flare.path.legs.length - 1]?.sections ?? [];
  const last = sections[sections.length - 1];
  const before = last && sections.findLast((s) => Math.abs(s.z - last.z) > 1e-9);
  const angle = (grow: number, along: number) => (2 * Math.atan(grow / 2 / along)) / RAD;
  const along = last && before ? Math.abs(before.z - last.z) : 0;
  return {
    at: { x: mouth.x + mouth.w / 2, y: mouth.y + mouth.h / 2, z: 0 },
    facing: FOLD_WALL.baffle,
    w: mouth.w,
    h: mouth.h,
    wallDeg:
      last && before && along > 0
        ? {
            h: wallAngle(angle(last.w - before.w, along)),
            v: wallAngle(angle(last.h - before.h, along)),
          }
        : { h: null, v: null },
  };
}

/** A side-section vector's dot product, (z, y). */
const dot = (a: SidePoint, b: SidePoint) => a.zIn * b.zIn + a.yIn * b.yIn;

/**
 * A drawn horn's mouth: its opening on its wall (clipped to the wall), as wide as the chamber's clear face. In the
 * side section each end's wall is the board whose end is within a board's thickness of it: its angle off the mouth's
 * axis (+ where it opens out toward the mouth). An end at the chamber's corner has the next wall, square to the mouth's
 * (0°); an end with no board has the flat wall past it (90°). Across, the chamber's side walls are parallel. Null when
 * the horn is not folded or not drawn, or the opening is empty.
 */
function drawnMouth(
  cabinet: Pick<SpeakerCabinet, "chambers" | "panel" | "construction" | "insetIn">,
  placed: PlacedChamber,
): HornMouth | null {
  const drawing = foldDrawing(cabinet, placed.chamber);
  if (!drawing) return null;
  const { fold, room } = drawing;
  const { wall } = fold.mouth;
  const upWall = wall === FOLD_WALL.baffle || wall === FOLD_WALL.back;
  const wallIn = upWall ? room.heightIn : room.depthIn;
  const from = Math.max(0, Math.min(fold.mouth.fromIn, fold.mouth.toIn));
  const to = Math.min(wallIn, Math.max(fold.mouth.fromIn, fold.mouth.toIn));
  if (!(to > from)) return null;
  /** a point `e` along the mouth's wall, in the side section */
  const onWall = (e: number): SidePoint =>
    wall === FOLD_WALL.baffle
      ? { zIn: 0, yIn: e }
      : wall === FOLD_WALL.back
        ? { zIn: room.depthIn, yIn: e }
        : wall === FOLD_WALL.bottom
          ? { zIn: e, yIn: 0 }
          : { zIn: e, yIn: room.heightIn };
  /** the mouth's axis into the box */
  const inward: SidePoint =
    wall === FOLD_WALL.baffle
      ? { zIn: 1, yIn: 0 }
      : wall === FOLD_WALL.back
        ? { zIn: -1, yIn: 0 }
        : wall === FOLD_WALL.bottom
          ? { zIn: 0, yIn: 1 }
          : { zIn: 0, yIn: -1 };
  const tolerance = room.boardIn;
  /** an end's wall angle off the axis, radians: `out` is +1 for the end farther along the wall, −1 for the nearer */
  const endAngle = (e: number, out: 1 | -1) => {
    const p = onWall(e);
    const outward: SidePoint = upWall ? { zIn: 0, yIn: out } : { zIn: out, yIn: 0 };
    let best: { gap: number; end: SidePoint; other: SidePoint } | null = null;
    for (const board of fold.boards)
      for (const [end, other] of [
        [board.a, board.b],
        [board.b, board.a],
      ]) {
        const gap = Math.hypot(end.zIn - p.zIn, end.yIn - p.yIn);
        if (gap <= tolerance && (!best || gap < best.gap)) best = { gap, end, other };
      }
    if (best) {
      const d = { zIn: best.other.zIn - best.end.zIn, yIn: best.other.yIn - best.end.yIn };
      return Math.min(Math.PI / 2, Math.max(0, Math.atan2(-dot(d, outward), dot(d, inward))));
    }
    return e <= tolerance || e >= wallIn - tolerance ? 0 : Math.PI / 2;
  };
  const mid = (from + to) / 2;
  const { clear } = placed;
  const front = baffleInsetIn(cabinet) + cabinet.panel.thicknessIn;
  const at = upWall
    ? {
        x: clear.x + clear.w / 2,
        y: clear.y + mid,
        z: wall === FOLD_WALL.baffle ? 0 : placed.dims.d,
      }
    : {
        x: clear.x + clear.w / 2,
        y: wall === FOLD_WALL.bottom ? clear.y : clear.y + clear.h,
        z: front + mid,
      };
  return {
    at,
    facing: wall,
    w: room.widthIn,
    h: to - from,
    wallDeg: { h: null, v: wallAngle((endAngle(from, -1) + endAngle(to, 1)) / RAD) },
  };
}

/**
 * A horn-loaded chamber's mouth, where the horn's own drivers stand inside it: a straight horn's flare, or a folded
 * horn's drawn mouth. Null for any other chamber, a back-loaded horn (its cones stand on the baffle and radiate there),
 * and a folded horn with no drawing yet (its cones stand in for it).
 */
export function hornMouth(
  cabinet: Pick<SpeakerCabinet, "chambers" | "panel" | "construction" | "insetIn">,
  placed: PlacedChamber,
): HornMouth | null {
  if (driversOnBaffle(placed.chamber)) return null;
  return straightMouth(cabinet, placed) ?? drawnMouth(cabinet, placed);
}
