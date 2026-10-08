import * as THREE from "three";
import { ROUNDOVER_IN } from "./stackHeights";
import { MM_IN } from "./geometry";
import { BRACKET, addBoltHead } from "./buildBracket";
import { HARDWARE_MESH_NAME } from "./buildHardware";
import type { SceneContext } from "./sceneContext";
import type { HornAxis } from "./buildHorn";
import { HORN_MOUNT_PANEL } from "../../constants/hornMount";
import { PLYWOOD_MATERIAL } from "../../constants/panelSizes";
import { defaultPanelIn } from "../../lib/panel";
import { cdBodySteps, stepsDia } from "../../lib/data";
import type { CompressionDriver } from "../../types";

/** The plywood mount's meshes, by part. */
export const PLY_MOUNT_MESH_NAMES = {
  upright: "cdPlyUpright",
  base: "cdPlyBase",
  gusset: "cdPlyGusset",
  bolt: "cdPlyBolt",
} as const;

/**
 * The plywood horn mount (the owner's design, sized for the DIY horns' ⌀130 × 12 mm throat flange), in: an upright in
 * front of the throat flange, saddled under the neck; a base on the lid behind it; a 45° gusset between them. All three
 * are cut from `HORN_MOUNT_PANEL` ply.
 */
export const PLY_MOUNT = {
  /** the upright's top edge below the horn's axis */
  belowAxis: 4 * MM_IN,
  /** the saddle's clearance round the neck */
  saddleGap: 1.5 * MM_IN,
  /** the base's depth behind the upright (about 102 mm) */
  baseDepth: 4,
  /** how far the base stops short of a part on the lid behind it (the horn's binding posts) */
  lidGap: 0.125,
  /** the gusset's legs, along the upright and along the base */
  gussetLeg: 90 * MM_IN,
  /** the gusset's top, cut flat, stays this far under the throat flange and the driver */
  gussetGap: 1.5 * MM_IN,
  /** the clearance hole for the driver's bolts (M6 or 1/4-20): 9/32 in */
  boltHole: 9 / 32,
} as const;

/** How close to the throat plane a vertex counts as on it, and how far off the flange's rim one counts as at it, in. */
const ON_PLANE_IN = 1e-4;
const RIM_TOL_IN = 1 * MM_IN;
/** A drawn horn whose back face reaches this much past its throat has a flange there, in. */
const FLANGE_MIN_IN = 0.25;

/**
 * The drawn horn body's surface round its throat, in the axis' frame (x across, y up from the axis, z forward from the
 * throat plane): the throat flange's rim radius and front face (none when the drawing has no flange: the generic flare
 * starts at the throat), and the neck's outer radius over a span of z.
 */
function throatOf(body: THREE.Mesh, at: HornAxis) {
  body.updateMatrix();
  const pos = body.geometry.getAttribute("position");
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < pos.count; i++)
    pts.push(
      new THREE.Vector3()
        .fromBufferAttribute(pos, i)
        .applyMatrix4(body.matrix)
        .sub(new THREE.Vector3(at.x, at.y, at.throatZ)),
    );
  const index = body.geometry.getIndex();
  const corner = (i: number) => pts[index ? index.getX(i) : i];
  const corners = index ? index.count : pts.length;
  const r = (p: THREE.Vector3) => Math.hypot(p.x, p.y);
  const back = pts.filter((p) => Math.abs(p.z) < ON_PLANE_IN).map(r);
  const rim = Math.max(...back);
  const flanged = rim - Math.min(...back) > FLANGE_MIN_IN;
  // the flange's front face: the nearest vertex in front of the throat plane on the rim's radius
  const front = flanged
    ? Math.min(...pts.filter((p) => p.z > ON_PLANE_IN && r(p) >= rim - RIM_TOL_IN).map((p) => p.z))
    : 0;
  /**
   * The largest radius the surface reaches between `z0` and `z1` below `yMax`, leaving out what lies on `z0` itself (the
   * flange's front face, which the upright only touches): the vertices in that span and the edges' crossings of its two
   * planes (a triangle's farthest point from the axis in the span is one of them).
   */
  const neckR = (z0: number, z1: number, yMax: number) => {
    const lo = z0 + ON_PLANE_IN;
    let out = 0;
    const take = (x: number, y: number) => {
      if (y < yMax) out = Math.max(out, Math.hypot(x, y));
    };
    for (const p of pts) if (p.z > lo && p.z <= z1) take(p.x, p.y);
    for (let t = 0; t + 2 < corners; t += 3)
      for (let e = 0; e < 3; e++) {
        const a = corner(t + e);
        const b = corner(t + ((e + 1) % 3));
        for (const z of [lo, z1])
          if ((a.z - z) * (b.z - z) < 0) {
            const k = (z - a.z) / (b.z - a.z);
            take(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k);
          }
      }
    return out;
  };
  return { rim: flanged ? rim : 0, front, neckR };
}

/** The driver's front-face bolts round its axis: `n` evenly spaced from 45° (the N314T's four at 45°, 135°, 225°, 315°). */
export const driverBolts = (cd: Pick<CompressionDriver, "body">) =>
  Array.from({ length: cd.body.bolts.n }, (_, i) => {
    const a = Math.PI / 4 + (2 * Math.PI * i) / cd.body.bolts.n;
    const r = cd.body.bolts.circle / 2;
    return { x: r * Math.cos(a), y: r * Math.sin(a) };
  });

/**
 * The plywood mount for a horn the driver bolts straight to (no adapter), on a lid (`lidY`; its roundover stands
 * `ROUNDOVER_IN` above it): the driver's front face stays on the throat flange.
 *
 * - The upright stands on the lid against the flange's front face (between the flange and the flare), as wide as the
 *   flange, its top edge `PLY_MOUNT.belowAxis` under the axis. A half-round saddle in that edge clears the neck by
 *   `saddleGap`: the neck's outer radius over the ply's depth, read off the horn's drawing. For a horn with a CAD mesh
 *   that is the real neck; any other horn's drawing has no modeled neck, so the saddle follows the drawn flare, which
 *   starts at the catalog's throat (`exit`, the best throat size the catalog has) and the real part needs fitting. A
 *   drawing without a flange (the generic flare) puts the upright on the throat plane, as wide as the driver's bolts
 *   need.
 * - The driver's bolts below the top edge pass through the upright and the flange into the driver (hex heads on the
 *   upright's front); the ones above it hold the flange alone, as without the mount.
 * - The base lies on the lid behind the upright, under the driver (stopping short of the horn's binding posts when a
 *   deep horn's throat sits far enough back to reach them), and the gusset stands on the base at the center, its top
 *   cut flat under the flange and the driver.
 */
export function buildPlyMount(
  ctx: SceneContext,
  {
    body,
    cd,
    at,
    lidY,
  }: { body: THREE.Mesh; cd: Pick<CompressionDriver, "body">; at: HornAxis; lidY: number },
) {
  const { plywood } = ctx.materials;
  const t = defaultPanelIn(HORN_MOUNT_PANEL, PLYWOOD_MATERIAL);
  const throat = throatOf(body, at);
  const zBack = throat.front;
  const top = -PLY_MOUNT.belowAxis;
  const saddleR = throat.neckR(zBack, zBack + t, top) + PLY_MOUNT.saddleGap;
  const bolts = driverBolts(cd);
  const boltR = cd.body.bolts.circle / 2;
  const w = Math.max(throat.rim, boltR + BRACKET.clampEdge);
  const footY = lidY + ROUNDOVER_IN;
  const bottom = footY - at.y;
  const holeR = PLY_MOUNT.boltHole / 2;
  // the bolts through the upright: below its top edge and clear of the saddle (one inside the saddle passes free)
  const through = bolts.filter((b) => b.y + holeR < top && Math.hypot(b.x, b.y) - holeR > saddleR);

  const shape = new THREE.Shape();
  shape.moveTo(-w, bottom);
  shape.lineTo(w, bottom);
  shape.lineTo(w, top);
  const xs = Math.sqrt(Math.max(0, saddleR * saddleR - top * top));
  shape.lineTo(xs, top);
  shape.absarc(0, 0, saddleR, Math.atan2(top, xs), Math.atan2(top, -xs), true);
  shape.lineTo(-w, top);
  shape.lineTo(-w, bottom);
  for (const b of through)
    shape.holes.push(new THREE.Path().absarc(b.x, b.y, holeR, 0, Math.PI * 2, true));
  const upright = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false, curveSegments: 48 }),
    plywood,
  );
  upright.position.set(at.x, at.y, at.throatZ + zBack);
  upright.name = PLY_MOUNT_MESH_NAMES.upright;
  ctx.group.add(upright);
  for (const b of through)
    addBoltHead(ctx, at.x + b.x, at.y + b.y, at.throatZ + zBack + t, 1, PLY_MOUNT_MESH_NAMES.bolt);

  // the base: back from the upright, stopping short of a part already on the lid behind it (the horn's binding posts,
  // drawn with the mid box before the horn; a deep horn's throat sits far enough back to reach them)
  const baseFront = at.throatZ + zBack;
  const footprint = new THREE.Box3(
    new THREE.Vector3(at.x - w, footY - ROUNDOVER_IN, baseFront - PLY_MOUNT.baseDepth),
    new THREE.Vector3(at.x + w, footY + t, baseFront),
  );
  ctx.group.updateMatrixWorld(true);
  let baseBack = footprint.min.z;
  ctx.group.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || o.name !== HARDWARE_MESH_NAME) return;
    const part = new THREE.Box3().setFromObject(o);
    if (part.intersectsBox(footprint)) baseBack = Math.max(baseBack, part.max.z + PLY_MOUNT.lidGap);
  });
  const depth = baseFront - baseBack;
  if (depth < t) return; // no room on the lid for a base
  const base = new THREE.Mesh(new THREE.BoxGeometry(2 * w, t, depth), plywood);
  base.position.set(at.x, footY + t / 2, baseFront - depth / 2);
  base.name = PLY_MOUNT_MESH_NAMES.base;
  ctx.group.add(base);

  // the gusset's profile: u back from the upright, v up from the base; its top cut flat under the flange and driver
  const baseTop = footY + t - at.y;
  const cdR = stepsDia(cdBodySteps(cd.body)) / 2;
  const leg = Math.min(PLY_MOUNT.gussetLeg, depth);
  const h = Math.min(leg, -Math.max(throat.rim, cdR) - PLY_MOUNT.gussetGap - baseTop);
  if (h < t) return; // no room for one under the driver (a horn this low has its driver just over the base)
  const profile = new THREE.Shape();
  profile.moveTo(0, 0);
  profile.lineTo(leg, 0);
  profile.lineTo(leg - h, h);
  if (h < leg) profile.lineTo(0, h);
  profile.lineTo(0, 0);
  const gusset = new THREE.Mesh(
    new THREE.ExtrudeGeometry(profile, { depth: t, bevelEnabled: false }),
    plywood,
  );
  // the profile's u toward −z (back), v up, and its thickness across x, centered on the axis
  gusset.rotation.y = Math.PI / 2;
  gusset.position.set(at.x - t / 2, footY + t, at.throatZ + zBack);
  gusset.name = PLY_MOUNT_MESH_NAMES.gusset;
  ctx.group.add(gusset);
}
