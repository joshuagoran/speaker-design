// What the driver mounts in front of a horn's throat flange (the aluminum plate, the plywood mount) share: the horn's
// throat as drawn, the driver's bolt pattern, the bolts' holes and washers, and where a foot or base on the lid stops.
import * as THREE from "three";
import { MM_IN } from "./geometry";
import { ROUNDOVER_IN } from "./stackHeights";
import { HARDWARE_MESH_NAME } from "./buildHardware";
import { hornBody } from "./hornBody";
import type { SceneContext } from "./sceneContext";
import type { HornAxis } from "./buildHorn";
import { cdBodySteps, stepsDia } from "../../lib/data";
import type { CompressionDriver, Horn } from "../../types";

/** The mounts' hardware and clearances, in. */
export const MOUNT_FIT = {
  /** the clearance hole for the driver's bolts (M6 or 1/4-20): 9/32 in */
  boltHole: 9 / 32,
  /** how far a bolt's washer (or a button head's flange) reaches past its hole: the room a hole needs round it */
  washerPast: 6 * MM_IN,
  /** a foot or base on the lid stays this far under the driver, else it stops in front of the driver */
  driverGap: 1 / 16,
  /** how far a foot or base stops short of a part on the lid behind it (the horn's binding posts) */
  lidGap: 0.125,
} as const;

/** A bolt's washer radius round its center: the hole plus `washerPast`. */
export const WASHER_R_IN = MOUNT_FIT.boltHole / 2 + MOUNT_FIT.washerPast;

/** How close to the throat plane a vertex counts as on it, and how far off the flange's rim one counts as at it, in. */
const ON_PLANE_IN = 1e-4;
const RIM_TOL_IN = 1 * MM_IN;
/** A drawn horn whose back face reaches this much past its throat has a flange there, in. */
const FLANGE_MIN_IN = 0.25;

/** A point across the throat, in the axis' frame (x across, y up from the axis). */
export interface XY {
  x: number;
  y: number;
}

/** A horn's throat as drawn: the flange's rim radius (0 when none) and front face, and its surface over a span of z. */
export interface Throat {
  rim: number;
  front: number;
  /**
   * The surface's points between `z0` and `z1`, leaving out what lies on `z0` itself (the flange's front face, which a
   * mount only touches): the vertices in that span and the edges' crossings of its two planes (a triangle's farthest
   * point from the axis in any direction is one of them).
   */
  slab: (z0: number, z1: number) => XY[];
}

/** Each horn's throat, by mouth width (the full-width concept's): read once. */
const THROATS = new WeakMap<object, Map<number, Throat>>();

/**
 * A horn's throat as drawn, in the axis' frame (z forward from the throat plane): the flange's rim and front face (none
 * when the drawing has no flange: the generic flare starts at the throat), and its surface over a span of z, for a
 * mount's slot or saddle. For a horn with a CAD mesh that is the real neck; any other horn's drawing has no modeled
 * neck, so it is the drawn flare, which starts at the catalog's throat (`exit`, the best throat size the catalog has).
 */
export function throatOf(horn: Horn, mouthW: number): Throat {
  const byW = THROATS.get(horn) ?? new Map<number, Throat>();
  THROATS.set(horn, byW);
  const w = horn.rect ? mouthW : horn.size.w;
  const known = byW.get(w);
  if (known) return known;
  const { body, shared } = hornBody(horn, w, new THREE.MeshBasicMaterial());
  body.updateMatrix();
  const pos = body.geometry.getAttribute("position");
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < pos.count; i++)
    pts.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(body.matrix));
  const index = body.geometry.getIndex();
  const corners = index ? Array.from({ length: index.count }, (_, i) => index.getX(i)) : null;
  if (!shared) body.geometry.dispose();
  const corner = (i: number) => pts[corners ? corners[i] : i];
  const n = corners ? corners.length : pts.length;
  const r = (p: THREE.Vector3) => Math.hypot(p.x, p.y);
  const back = pts.filter((p) => Math.abs(p.z) < ON_PLANE_IN).map(r);
  const rim = Math.max(...back);
  const flanged = rim - Math.min(...back) > FLANGE_MIN_IN;
  // the flange's front face: the nearest vertex in front of the throat plane on the rim's radius
  const front = flanged
    ? Math.min(...pts.filter((p) => p.z > ON_PLANE_IN && r(p) >= rim - RIM_TOL_IN).map((p) => p.z))
    : 0;
  const slab = (z0: number, z1: number) => {
    const lo = z0 + ON_PLANE_IN;
    const out: XY[] = [];
    for (const p of pts) if (p.z > lo && p.z <= z1) out.push({ x: p.x, y: p.y });
    for (let t = 0; t + 2 < n; t += 3)
      for (let e = 0; e < 3; e++) {
        const a = corner(t + e);
        const b = corner(t + ((e + 1) % 3));
        for (const z of [lo, z1])
          if ((a.z - z) * (b.z - z) < 0) {
            const k = (z - a.z) / (b.z - a.z);
            out.push({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
          }
      }
    return out;
  };
  const throat = { rim: flanged ? rim : 0, front, slab };
  byW.set(w, throat);
  return throat;
}

/** How a two-bolt driver's pair stands: across (0° and 180°), upright (90° and 270°) or at 45° like four bolts. */
export type TwoBoltTurn = "across" | "upright" | "diagonal";

/**
 * The driver's front-face bolts round its axis: `n` evenly spaced from 45° (the N314T's four at 45°, 135°, 225°, 315°,
 * as the horns' flanges are drilled); a two-bolt pair turned as `twoBolt` says.
 */
export const driverBolts = (
  cd: Pick<CompressionDriver, "body">,
  twoBolt: TwoBoltTurn = "diagonal",
) =>
  Array.from({ length: cd.body.bolts.n }, (_, i): XY => {
    const from =
      cd.body.bolts.n !== 2 || twoBolt === "diagonal"
        ? Math.PI / 4
        : twoBolt === "upright"
          ? Math.PI / 2
          : 0;
    const a = from + (2 * Math.PI * i) / cd.body.bolts.n;
    const r = cd.body.bolts.circle / 2;
    return { x: r * Math.cos(a), y: r * Math.sin(a) };
  });

/** The driver's body radius (its widest step), in: how far it hangs under the axis. */
export const driverRadius = (cd: Pick<CompressionDriver, "body">) =>
  stepsDia(cdBodySteps(cd.body)) / 2;

/**
 * Where a foot or base on the lid ends behind its front (`front`, z): `depth` back, but short of the lid's back edge
 * (`lidBackZ`), of the driver (whose front face is the throat plane) when `underDriver` is false, and of a part already
 * on the lid behind it (the horn's binding posts, drawn with the mid box before the horn), within `w` of the axis and up
 * to `topY`. Returns the z of its back end.
 */
export function lidStop(
  ctx: SceneContext,
  {
    at,
    front,
    depth,
    w,
    footY,
    topY,
    lidBackZ,
    underDriver,
  }: {
    at: HornAxis;
    front: number;
    depth: number;
    w: number;
    footY: number;
    topY: number;
    lidBackZ: number;
    underDriver: boolean;
  },
) {
  let back = Math.max(front - depth, lidBackZ);
  if (!underDriver) back = Math.max(back, at.throatZ + MOUNT_FIT.driverGap);
  const footprint = new THREE.Box3(
    new THREE.Vector3(at.x - w, footY - ROUNDOVER_IN, back),
    new THREE.Vector3(at.x + w, topY, front),
  );
  ctx.group.updateMatrixWorld(true);
  ctx.group.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || o.name !== HARDWARE_MESH_NAME) return;
    const part = new THREE.Box3().setFromObject(o);
    if (part.intersectsBox(footprint)) back = Math.max(back, part.max.z + MOUNT_FIT.lidGap);
  });
  return back;
}
