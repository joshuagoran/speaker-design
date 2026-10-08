import * as THREE from "three";
import { HORN_LIFT_IN, ROUNDOVER_IN, hornAxisUp } from "./stackHeights";
import { MM_IN } from "./geometry";
import { BRACKET, addBoltHead } from "./buildBracket";
import {
  MOUNT_FIT,
  WASHER_R_IN,
  driverBolts,
  driverRadius,
  lidStop,
  throatOf,
  type XY,
} from "./throatFit";
import type { SceneContext } from "./sceneContext";
import type { HornAxis } from "./buildHorn";
import { HORN_MOUNT_PANEL } from "../../constants/hornMount";
import { PLYWOOD_MATERIAL } from "../../constants/panelSizes";
import { defaultPanelIn } from "../../lib/panel";
import type { CompressionDriver, Horn } from "../../types";

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
 * are cut from `HORN_MOUNT_PANEL` ply. The bolts' holes and washers and the clearances on the lid are the mounts'
 * shared ones (`MOUNT_FIT`).
 */
export const PLY_MOUNT = {
  ...MOUNT_FIT,
  /** the upright's top edge below the horn's axis */
  belowAxis: 4 * MM_IN,
  /** the saddle's clearance round the neck */
  saddleGap: 1.5 * MM_IN,
  /** the base's depth behind the upright (about 102 mm) */
  baseDepth: 4,
  /** the gusset's legs, along the upright and along the base */
  gussetLeg: 90 * MM_IN,
  /** the gusset's top, cut flat, stays this far under the throat flange and the driver */
  gussetGap: 1.5 * MM_IN,
} as const;

/**
 * How the plywood mount fits one horn and driver, in the horn axis' frame (x across, y up from the axis, z forward
 * from the throat plane), or null when it can't: no driver bolt below the upright's top edge has room for its washer on
 * the ply (clear of the saddle and the ply's edges).
 */
export interface PlyMountFit {
  /** the ply's thickness */
  t: number;
  /** the upright's back face (the flange's front face) */
  zBack: number;
  /** the upright's half width, top edge and bottom edge (on the lid's roundover) */
  w: number;
  top: number;
  bottom: number;
  /** the saddle's radius; one no larger than −`top` leaves the top edge straight */
  saddleR: number;
  /** the throat flange's rim radius, 0 when the drawing has none */
  rim: number;
  /** the driver's bolts through the upright (holes and heads); at least one has room for its washer */
  through: XY[];
  /** whether the driver's lowest point clears the base's top by `driverGap` */
  baseClearsDriver: boolean;
}

/** Each horn's fits, by driver body and (for the full-width concept) mouth width: worked out once. */
const FITS = new WeakMap<object, Map<string, PlyMountFit | null>>();

/**
 * How the plywood mount fits a horn the driver bolts straight to, with the driver `cd`, read off the horn as drawn
 * (`mouthW`: the box's width for the full-width concept; see `throatOf`). See `buildPlyMount` for the parts. A
 * two-bolt driver stands its pair upright, so the bottom bolt goes through the ply and the top one holds the flange
 * alone, and the saddle keeps the pair from turning. A drawing without a flange (the generic flare) puts the upright on
 * the throat plane, as wide as the driver's bolts need.
 */
export function plyMountFit(
  horn: Horn,
  cd: Pick<CompressionDriver, "body">,
  mouthW: number,
): PlyMountFit | null {
  const byKey = FITS.get(horn) ?? new Map<string, PlyMountFit | null>();
  FITS.set(horn, byKey);
  const key = `${JSON.stringify(cd.body)} ${horn.rect ? mouthW : ""}`;
  const known = byKey.get(key);
  if (known !== undefined) return known;
  const throat = throatOf(horn, mouthW);
  const t = defaultPanelIn(HORN_MOUNT_PANEL, PLYWOOD_MATERIAL);
  const zBack = throat.front;
  const bolts = driverBolts(cd, "upright");
  const w = Math.max(throat.rim, cd.body.bolts.circle / 2 + BRACKET.clampEdge);
  const bottom = ROUNDOVER_IN - HORN_LIFT_IN - hornAxisUp(horn);
  // the top edge: under the axis, and lowered past any bolt whose washer it would cut (that bolt then holds the flange
  // alone, above the ply)
  let top = -PLY_MOUNT.belowAxis;
  for (let straddled = true; straddled;) {
    const b = bolts.find((p) => p.y - WASHER_R_IN < top && p.y + WASHER_R_IN > top);
    straddled = !!b;
    if (b) top = b.y - WASHER_R_IN;
  }
  const below = throat.slab(zBack, zBack + t).filter((p) => p.y < top);
  const saddleR = Math.max(0, ...below.map((p) => Math.hypot(p.x, p.y))) + PLY_MOUNT.saddleGap;
  const holeR = PLY_MOUNT.boltHole / 2;
  // the bolts through the upright: below its top edge and clear of the saddle (one inside the saddle passes free)
  const through = bolts.filter((b) => b.y + holeR < top && Math.hypot(b.x, b.y) - holeR > saddleR);
  const washerFits = (b: XY) =>
    b.y + WASHER_R_IN <= top &&
    b.y - WASHER_R_IN >= bottom &&
    Math.abs(b.x) + WASHER_R_IN <= w &&
    Math.hypot(b.x, b.y) - WASHER_R_IN >= saddleR;
  const fit = through.some(washerFits)
    ? {
        t,
        zBack,
        w,
        top,
        bottom,
        saddleR,
        rim: throat.rim,
        through,
        baseClearsDriver: -driverRadius(cd) - (bottom + t) >= PLY_MOUNT.driverGap,
      }
    : null;
  byKey.set(key, fit);
  return fit;
}

/**
 * The plywood mount (`fit`, from `plyMountFit`) on the horn's axis `at`, on a lid (`lidY`; its roundover stands
 * `ROUNDOVER_IN` above it, and its flat top ends at `lidBackZ`): the driver's front face stays on the throat flange.
 *
 * - The upright stands on the lid against the flange's front face (between the flange and the flare), as wide as the
 *   flange, its top edge `PLY_MOUNT.belowAxis` under the axis (lower when a bolt's washer would straddle it), with a
 *   half-round saddle under the neck.
 * - The driver's bolts below the top edge pass through the upright and the flange into the driver (hex heads on the
 *   upright's front); the ones above it hold the flange alone, as without the mount.
 * - The base lies on the lid behind the upright, under the driver. It stops short of the lid's back edge, of the horn's
 *   binding posts when a deep horn's throat sits far enough back to reach them, and of the driver itself when the
 *   driver hangs within `driverGap` of the base's top (a small horn); with no room left it is left out. The gusset
 *   stands on the base at the center, its top cut flat under the flange and the driver.
 */
export function buildPlyMount(
  ctx: SceneContext,
  fit: PlyMountFit,
  {
    cd,
    at,
    lidY,
    lidBackZ,
  }: { cd: Pick<CompressionDriver, "body">; at: HornAxis; lidY: number; lidBackZ: number },
) {
  const { plywood } = ctx.materials;
  const { t, zBack, w, top, bottom, saddleR, through } = fit;
  const footY = lidY + ROUNDOVER_IN;
  const holeR = PLY_MOUNT.boltHole / 2;

  const shape = new THREE.Shape();
  shape.moveTo(-w, bottom);
  shape.lineTo(w, bottom);
  shape.lineTo(w, top);
  if (saddleR > -top) {
    const xs = Math.sqrt(saddleR * saddleR - top * top);
    shape.lineTo(xs, top);
    shape.absarc(0, 0, saddleR, Math.atan2(top, xs), Math.atan2(top, -xs), true);
  }
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

  // the base: back from the upright, as far as the lid, the driver and the lid's parts leave room
  const baseFront = at.throatZ + zBack;
  const baseBack = lidStop(ctx, {
    at,
    front: baseFront,
    depth: PLY_MOUNT.baseDepth,
    w,
    footY,
    topY: footY + t,
    lidBackZ,
    underDriver: fit.baseClearsDriver,
  });
  const depth = baseFront - baseBack;
  if (depth < t) return; // no room on the lid for a base
  const base = new THREE.Mesh(new THREE.BoxGeometry(2 * w, t, depth), plywood);
  base.position.set(at.x, footY + t / 2, baseFront - depth / 2);
  base.name = PLY_MOUNT_MESH_NAMES.base;
  ctx.group.add(base);

  // the gusset's profile: u back from the upright, v up from the base; its top cut flat under the flange and driver
  const baseTop = bottom + t;
  const leg = Math.min(PLY_MOUNT.gussetLeg, depth);
  const h = Math.min(leg, -Math.max(fit.rim, driverRadius(cd)) - PLY_MOUNT.gussetGap - baseTop);
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
