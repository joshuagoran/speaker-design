// Where each placed box's horn mouth and vent exit radiate on the Space page: its solid angle and the identical boxes
// beside it (the horn engine's `angle` and `count`, as lib/acoustics/radiation `mouthImpedance` reads them), from what
// the box is coupled with (lib/speaker/spaceCoupling). Pure.
//
// At bass wavelengths a few cm (a box's wall) acts as touching: so the box's coupling stands in for its mouth's.
// - angle: half space from the box's front baffle; each coupled surface at right angles to its front (the floor, a side
//   wall) halves it, to a quarter of space at most. A wall behind the box or in front of it does not change it.
// - count: the identical boxes (the same Speaker, in this item or another) coupled with it in a chain, facing the same
//   way with their fronts in one plane. A coupled box of another design adds nothing.
import type { BoxLoading, CoupledSurface } from "../../types";
import type { BoxCoupling } from "./spaceCoupling";
import type { PlacedItem, RoomPoint } from "./spaceLayout";
import { COUPLED_FLOOR, COUPLING_GAP_M } from "../../constants/space";
import { CHAMBER_LOAD } from "../../constants/speakerSpec";
import { ONE_BOX_HALF_SPACE, RADIATION_ANGLES } from "../../constants/hornEngine";
import { METERS_PER_FOOT } from "../../constants/units";

/** The room axis each coupled surface stands across. */
const SURFACE_AXIS: Record<CoupledSurface, keyof RoomPoint> = {
  [COUPLED_FLOOR]: "z",
  front: "y",
  back: "y",
  left: "x",
  right: "x",
};

/** A front within this of a surface's axis (its cosine) faces it or away from it; less is at right angles. */
const FACING_COS = 0.5;

/** Two fronts this near (their cosine) face the same way. */
const SAME_WAY_COS = 1 - 1e-6;

/** The coupling gap, ft: two fronts this near are in one plane. */
const GAP_FT = COUPLING_GAP_M / METERS_PER_FOOT;

/** The mean of the corners (`boxCorners`' order) at `idx`. */
const meanOf = (corners: readonly RoomPoint[], idx: readonly number[]): RoomPoint => ({
  x: idx.reduce((s, i) => s + corners[i].x, 0) / idx.length,
  y: idx.reduce((s, i) => s + corners[i].y, 0) / idx.length,
  z: idx.reduce((s, i) => s + corners[i].z, 0) / idx.length,
});

/** A box's front face: its center, and its unit normal out of the box (front corners 0–3, back 4–7). */
function frontOf(corners: readonly RoomPoint[]) {
  const center = meanOf(corners, [0, 1, 2, 3]),
    back = meanOf(corners, [4, 5, 6, 7]);
  const out = { x: center.x - back.x, y: center.y - back.y, z: center.z - back.z };
  const n = Math.hypot(out.x, out.y, out.z) || 1;
  return { center, normal: { x: out.x / n, y: out.y / n, z: out.z / n } };
}

const dot = (a: RoomPoint, b: RoomPoint) => a.x * b.x + a.y * b.y + a.z * b.z;

/**
 * Each item's loading per stack member (by the member's index; none for a member with no horn-loaded chamber, which
 * keeps half space), in `items`' order, from `coupling` (`spaceCoupling` on the same items).
 */
export function boxLoadings(
  items: readonly Pick<PlacedItem, "boxes">[],
  coupling: readonly BoxCoupling[],
): (BoxLoading | undefined)[][] {
  const fronts = items.map((it) => it.boxes.map((b) => frontOf(b.corners)));
  /** a box's design: its Speaker */
  const designOf = (item: number, box: number) => items[item].boxes[box].speaker.id;
  /** whether two boxes are identical and stand with their fronts in one plane, facing the same way */
  const alike = (a: { item: number; box: number }, b: { item: number; box: number }) => {
    const fa = fronts[a.item][a.box],
      fb = fronts[b.item][b.box];
    const apart = {
      x: fb.center.x - fa.center.x,
      y: fb.center.y - fa.center.y,
      z: fb.center.z - fa.center.z,
    };
    return (
      designOf(a.item, a.box) === designOf(b.item, b.box) &&
      dot(fa.normal, fb.normal) >= SAME_WAY_COS &&
      Math.abs(dot(apart, fa.normal)) <= GAP_FT
    );
  };
  /** how many boxes are in the chain of alike coupled boxes `start` belongs to, itself too */
  const chainOf = (start: { item: number; box: number }) => {
    const seen = new Set([`${start.item}/${start.box}`]);
    const queue = [start];
    for (let at = queue.shift(); at; at = queue.shift())
      for (const next of coupling[at.item]?.members[at.box]?.boxes ?? []) {
        const key = `${next.item}/${next.box}`;
        if (seen.has(key) || !alike(at, next)) continue;
        seen.add(key);
        queue.push(next);
      }
    return seen.size;
  };
  return items.map((it, item) => {
    const out: (BoxLoading | undefined)[] = [];
    it.boxes.forEach((b, box) => {
      if (!b.speaker.cabinet.chambers.some((c) => c.load.kind === CHAMBER_LOAD.horn)) return;
      const { normal } = fronts[item][box];
      const across = (coupling[item]?.members[box]?.surfaces ?? []).filter(
        (s) => Math.abs(normal[SURFACE_AXIS[s]]) < FACING_COS,
      ).length;
      out[b.member] = {
        angle:
          RADIATION_ANGLES[Math.min(across, RADIATION_ANGLES.length - 1)] ??
          ONE_BOX_HALF_SPACE.angle,
        count: chainOf({ item, box }),
      };
    });
    return out;
  });
}
