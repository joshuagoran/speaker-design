import * as THREE from "three";
import { HORN_LIFT_IN, ROUNDOVER_IN, hornAxisUp } from "./stackHeights";
import { MM_IN } from "./geometry";
import { BRACKET } from "./buildBracket";
import {
  MOUNT_FIT,
  WASHER_R_IN,
  driverBolts,
  driverRadius,
  lidStop,
  throatOf,
  type TwoBoltTurn,
  type XY,
} from "./throatFit";
import type { SceneContext } from "./sceneContext";
import type { HornAxis } from "./buildHorn";
import type { CompressionDriver, Horn } from "../../types";

/** The aluminum plate's meshes, by part. */
export const PLATE_MESH_NAMES = {
  /** the flat plate in front of the throat flange */
  plate: "cdPlate",
  /** its bend and the foot on the lid */
  foot: "cdPlateFoot",
  /** the flanged button heads on its front */
  bolt: "cdPlateBolt",
} as const;

/**
 * The aluminum front plate (the owner's design), in: one `BRACKET.thickness` plate in front of the throat flange, a
 * U-slot open at the top for the neck, bolted through the flange to the driver, bent back at the bottom into a foot on
 * the lid under the driver. The bolts' holes and washers and the clearances on the lid are the mounts' shared ones
 * (`MOUNT_FIT`).
 */
export const PLATE = {
  ...MOUNT_FIT,
  /** the slot's clearance round the neck, across and under it */
  slotGap: 1.5 * MM_IN,
  /** the top edge stands this far above the highest bolt's washer, and at least `minTop` above the axis */
  aboveWasher: 3 * MM_IN,
  minTop: 20 * MM_IN,
  /** a flangeless drawing's plate: this far past the bolts' washers on each side */
  sideMargin: 3 * MM_IN,
  /** the bend's inside radius, and the foot's length back from the plate's back face (bend included) */
  bendR: 4 * MM_IN,
  foot: 80 * MM_IN,
  /** a flanged button head: its dome's radius at the flange and at the top, and its height; the flange is the washer */
  head: { r: 0.22, rTop: 0.12, h: 0.1, flange: 0.04 },
} as const;

/**
 * How the plate fits one horn and driver, in the horn axis' frame (x across, y up from the axis, z forward from the
 * throat plane), or null when no driver bolt can pass through it.
 */
export interface PlateFit {
  /** the plate's thickness */
  t: number;
  /** its back face (the flange's front face) */
  zBack: number;
  /** its half width, its top edge, and where it starts to bend at the bottom */
  w: number;
  top: number;
  bottom: number;
  /** the slot: its half width, and the depth of its half-elliptical bottom under the axis */
  slotW: number;
  slotD: number;
  /** how a two-bolt driver's pair stands on it */
  twoBolt: TwoBoltTurn;
  /** the driver's bolts through it: each one's washer clears the slot and the plate's edges */
  through: XY[];
  /** whether the driver's lowest point clears the foot's top by `driverGap` */
  footClearsDriver: boolean;
}

/** Each horn's fits, by driver body and (for the full-width concept) mouth width: worked out once. */
const FITS = new WeakMap<object, Map<string, PlateFit | null>>();

/** Points round the slot's half-elliptical bottom, for the washers' clearance. */
const SLOT_SAMPLES = 180;

/**
 * How the plate fits a horn the driver bolts straight to, with the driver `cd`, read off the horn as drawn (`mouthW`:
 * the box's width for the full-width concept; see `throatOf`). See `buildPlate` for the parts.
 *
 * The slot's half width is the neck's widest half width over the plate's depth, and its bottom's depth under the axis
 * the neck's lowest point there, each plus `slotGap` (both scaled up together if a neck point falls outside the
 * half-ellipse they make). Every driver bolt whose washer clears the slot and the plate's edges goes through. A
 * two-bolt pair stands across the throat, both through the plate's arms, unless the neck leaves no room; then upright,
 * the bottom one through the plate. With no bolt through, the plate can't hold the driver.
 */
export function plateFit(
  horn: Horn,
  cd: Pick<CompressionDriver, "body">,
  mouthW: number,
): PlateFit | null {
  const byKey = FITS.get(horn) ?? new Map<string, PlateFit | null>();
  FITS.set(horn, byKey);
  const key = `${JSON.stringify(cd.body)} ${horn.rect ? mouthW : ""}`;
  const known = byKey.get(key);
  if (known !== undefined) return known;
  const throat = throatOf(horn, mouthW);
  const t = BRACKET.thickness;
  const zBack = throat.front;
  const neck = throat.slab(zBack, zBack + t);
  const under = neck.filter((p) => p.y < 0);
  const w0 = Math.max(0, ...neck.map((p) => Math.abs(p.x)));
  const d0 = Math.max(0, ...under.map((p) => -p.y));
  const k = Math.max(1, ...under.map((p) => Math.hypot(w0 ? p.x / w0 : 0, d0 ? p.y / d0 : 0)));
  const slotW = k * w0 + PLATE.slotGap;
  const slotD = k * d0 + PLATE.slotGap;
  const bottom = ROUNDOVER_IN - HORN_LIFT_IN - hornAxisUp(horn) + t + PLATE.bendR;
  const boltR = cd.body.bolts.circle / 2;
  const w = throat.rim || Math.max(boltR + WASHER_R_IN + PLATE.sideMargin, slotW + 2 * WASHER_R_IN);
  // the slot's half-elliptical bottom, and how far a point is from the slot
  const rim = Array.from({ length: SLOT_SAMPLES + 1 }, (_, i) => {
    const a = Math.PI + (Math.PI * i) / SLOT_SAMPLES;
    return { x: slotW * Math.cos(a), y: slotD * Math.sin(a) };
  });
  const fromSlot = (b: XY) => {
    if (b.y >= 0) return Math.abs(b.x) - slotW;
    if ((b.x / slotW) ** 2 + (b.y / slotD) ** 2 <= 1) return 0;
    return Math.min(
      Math.hypot(Math.max(0, Math.abs(b.x) - slotW), b.y),
      ...rim.map((p) => Math.hypot(b.x - p.x, b.y - p.y)),
    );
  };
  const clears = (b: XY) =>
    fromSlot(b) >= WASHER_R_IN && Math.abs(b.x) + WASHER_R_IN <= w && b.y - WASHER_R_IN >= bottom;
  const tryTurn = (twoBolt: TwoBoltTurn) => {
    const bolts = driverBolts(cd, twoBolt);
    const through = bolts.filter(clears);
    // a pair across the throat needs both through the arms
    if (twoBolt === "across" && through.length < bolts.length) return null;
    return through.length ? { twoBolt, through } : null;
  };
  const pick =
    cd.body.bolts.n === 2 ? (tryTurn("across") ?? tryTurn("upright")) : tryTurn("diagonal");
  const fit = pick
    ? {
        t,
        zBack,
        w,
        top: Math.max(
          PLATE.minTop,
          ...pick.through.map((b) => b.y + WASHER_R_IN + PLATE.aboveWasher),
        ),
        bottom,
        slotW,
        slotD,
        twoBolt: pick.twoBolt,
        through: pick.through,
        footClearsDriver:
          -driverRadius(cd) - (ROUNDOVER_IN - HORN_LIFT_IN - hornAxisUp(horn) + t) >=
          PLATE.driverGap,
      }
    : null;
  byKey.set(key, fit);
  return fit;
}

/** A flanged button head on a face square to z at `zFace`, centered on (x, y), facing forward. */
function addButtonHead(ctx: SceneContext, x: number, y: number, zFace: number) {
  const { r, rTop, h, flange } = PLATE.head;
  const add = (geometry: THREE.BufferGeometry, z: number) => {
    const m = new THREE.Mesh(geometry, ctx.materials.hardware);
    m.rotation.x = -Math.PI / 2; // the cylinder's +y toward +z, so its top (the dome's) faces forward
    m.position.set(x, y, z);
    m.name = PLATE_MESH_NAMES.bolt;
    ctx.group.add(m);
  };
  add(new THREE.CylinderGeometry(WASHER_R_IN, WASHER_R_IN, flange, 32), zFace + flange / 2);
  add(new THREE.CylinderGeometry(rTop, r, h, 32), zFace + flange + h / 2);
}

/**
 * The aluminum plate (`fit`, from `plateFit`) on the horn's axis `at`, on a lid (`lidY`; its roundover stands
 * `ROUNDOVER_IN` above it, and its flat top ends at `lidBackZ`): the driver's front face stays on the throat flange.
 *
 * - The plate stands against the flange's front face (between the flange and the flare), as wide as the flange, from
 *   the bend up to its top edge, with the U-slot open at the top for the neck.
 * - The driver's bolts that clear the slot pass through it and the flange into the driver, flanged button heads on its
 *   front; the others hold the flange alone.
 * - At the bottom it bends back (inside radius `bendR`) into a foot on the lid under the driver, `foot` long. The foot
 *   stops short of the lid's back edge, of the horn's binding posts, and of the driver itself when the driver hangs
 *   within `driverGap` of its top.
 */
export function buildPlate(
  ctx: SceneContext,
  fit: PlateFit,
  { at, lidY, lidBackZ }: { at: HornAxis; lidY: number; lidBackZ: number },
) {
  const { aluminum } = ctx.materials;
  const { t, zBack, w, top, bottom, slotW, slotD, through } = fit;
  const holeR = PLATE.boltHole / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-w, bottom);
  shape.lineTo(w, bottom);
  shape.lineTo(w, top);
  shape.lineTo(slotW, top);
  shape.lineTo(slotW, 0);
  shape.absellipse(0, 0, slotW, slotD, 0, Math.PI, true, 0);
  shape.lineTo(-slotW, top);
  shape.lineTo(-w, top);
  shape.lineTo(-w, bottom);
  for (const b of through)
    shape.holes.push(new THREE.Path().absarc(b.x, b.y, holeR, 0, Math.PI * 2, true));
  const plate = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false, curveSegments: 48 }),
    aluminum,
  );
  plate.position.set(at.x, at.y, at.throatZ + zBack);
  plate.name = PLATE_MESH_NAMES.plate;
  ctx.group.add(plate);
  for (const b of through) addButtonHead(ctx, at.x + b.x, at.y + b.y, at.throatZ + zBack + t);

  // the bend and the foot, in the (z, y) plane: the bend's center behind the plate's back face and over the foot
  const footY = lidY + ROUNDOVER_IN;
  const z0 = at.throatZ + zBack;
  const ri = PLATE.bendR;
  const zc = z0 - ri;
  const yc = at.y + bottom;
  const back = lidStop(ctx, {
    at,
    front: z0,
    depth: PLATE.foot,
    w,
    footY,
    topY: footY + t,
    lidBackZ,
    underDriver: fit.footClearsDriver,
  });
  const end = Math.min(back, zc); // the bend stays whatever room the foot has
  const profile = new THREE.Shape();
  profile.moveTo(z0 + t, yc);
  profile.absarc(zc, yc, ri + t, 0, -Math.PI / 2, true);
  profile.lineTo(end, footY);
  profile.lineTo(end, footY + t);
  profile.lineTo(zc, footY + t);
  profile.absarc(zc, yc, ri, -Math.PI / 2, 0, false);
  profile.lineTo(z0 + t, yc);
  const foot = new THREE.Mesh(
    new THREE.ExtrudeGeometry(profile, { depth: 2 * w, bevelEnabled: false, curveSegments: 12 }),
    aluminum,
  );
  // the profile's x is z and its y is y; it is extruded across x, from +w to −w
  foot.rotation.y = -Math.PI / 2;
  foot.position.set(at.x + w, 0, 0);
  foot.name = PLATE_MESH_NAMES.foot;
  ctx.group.add(foot);
}
