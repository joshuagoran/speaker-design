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
  BOLT_TURNS,
  boltTurns,
  type XY,
} from "./throatFit";
import type { SceneContext } from "./sceneContext";
import type { HornAxis } from "./buildHorn";
import { PLATE_BOLT_HEADS, type PlateBoltHead } from "../../constants/boltHeads";
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
 * the lid under the driver. The bolts' holes and the clearances on the lid are the mounts' shared ones (`MOUNT_FIT`);
 * the heads are each thread's (`PLATE_BOLT_HEADS`).
 */
export const PLATE = {
  ...MOUNT_FIT,
  /** the slot's clearance round the neck, across and under it */
  slotGap: 1.5 * MM_IN,
  /**
   * the top edge stands this far above the highest bolt's head, and at least `minTop` above the axis (lower only to
   * clear a bolt left out of the plate)
   */
  aboveWasher: 3 * MM_IN,
  minTop: 20 * MM_IN,
  /** a flangeless drawing's plate: this far past the bolts' washers on each side */
  sideMargin: 3 * MM_IN,
  /** the bend's inside radius, and the foot's length back from the plate's back face (bend included) */
  bendR: 4 * MM_IN,
  foot: 80 * MM_IN,
  /** a thread without a head in `PLATE_BOLT_HEADS`: the mounts' generic washer, and a 1/4 in button head on it */
  head: { flangeR: WASHER_R_IN, flange: 0.065, domeR: 0.437 / 2, dome: 0.132 },
} as const;

/** The head a driver's bolts take on the plate: its thread's, else the generic washer and button head. */
export const plateHead = (cd: Pick<CompressionDriver, "body">): PlateBoltHead =>
  PLATE_BOLT_HEADS[cd.body.bolts.thread] ?? PLATE.head;

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
  /** how the driver's bolt pattern is turned (`BOLT_TURNS`: its first bolt's angle) */
  turn: number;
  /** the driver's bolts through it: each one's head clears the slot and the plate's edges */
  through: XY[];
  /** the bolts' heads (`plateHead`) */
  head: PlateBoltHead;
  /** whether the driver's lowest point clears the bend's top by `driverGap` */
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
 * half-ellipse they make). The driver's bolts only stand where the flange is drilled (`boltTurns`; a drawing without
 * holes takes any turn). Every bolt whose washer clears the slot and the plate's edges goes through. A two-bolt pair
 * stands across the throat, both through the plate's arms, unless the neck or the holes leave no room; then upright
 * (or as the holes stand), at least one through the plate. With no bolt through, the plate can't hold the driver.
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
  const head = plateHead(cd);
  const R = head.flangeR;
  const boltR = cd.body.bolts.circle / 2;
  const w = throat.rim || Math.max(boltR + R + PLATE.sideMargin, slotW + 2 * R);
  // the slot's half-elliptical bottom, and how far a point is from the slot (0 inside it)
  const rim = Array.from({ length: SLOT_SAMPLES + 1 }, (_, i) => {
    const a = Math.PI + (Math.PI * i) / SLOT_SAMPLES;
    return { x: slotW * Math.cos(a), y: slotD * Math.sin(a) };
  });
  const fromSlot = (b: XY) => {
    if (b.y >= 0) return Math.max(0, Math.abs(b.x) - slotW);
    if ((b.x / slotW) ** 2 + (b.y / slotD) ** 2 <= 1) return 0;
    return Math.min(
      Math.hypot(Math.max(0, Math.abs(b.x) - slotW), b.y),
      ...rim.map((p) => Math.hypot(b.x - p.x, b.y - p.y)),
    );
  };
  const clears = (b: XY) => fromSlot(b) >= R && Math.abs(b.x) + R <= w && b.y - R >= bottom;
  // whether any of a head's disk lies on the plate's metal under a top edge at `top`
  const inMetal = (p: XY, top: number) =>
    Math.abs(p.x) < w && p.y > bottom && p.y < top && fromSlot(p) > 0;
  // the head's disk: its center and two rings of points, at its rim and halfway in
  const disk: XY[] = [
    { x: 0, y: 0 },
    ...[R, R / 2].flatMap((r) =>
      Array.from({ length: 16 }, (_, i) => ({
        x: r * Math.cos((Math.PI * i) / 8),
        y: r * Math.sin((Math.PI * i) / 8),
      })),
    ),
  ];
  const headOnMetal = (b: XY, top: number) =>
    disk.some((d) => inMetal({ x: b.x + d.x, y: b.y + d.y }, top));
  const tryTurn = (turn: number) => {
    const bolts = driverBolts(cd, turn);
    const through = bolts.filter(clears);
    // a pair level across the throat needs both through the arms
    const level = bolts.length === 2 && bolts.every((b) => Math.abs(b.y) < 1e-9);
    if (!through.length || (level && through.length < bolts.length)) return null;
    // the top edge over the through bolts' heads; then, as the ply's does, dropped under any bolt left out whose head
    // would sit on the metal, as long as the through bolts still clear (else the plate can't take this turn)
    const floor = Math.max(...through.map((b) => b.y + R + PLATE.aboveWasher));
    let top = Math.max(PLATE.minTop, floor);
    const left = bolts.filter((b) => !through.includes(b)).sort((a, b) => b.y - a.y);
    for (const b of left)
      if (headOnMetal(b, top)) {
        top = b.y - R;
        if (top < floor || top <= 0) return null;
      }
    return { turn, through, top };
  };
  // the turns the flange's drilled holes take, a pair across the throat first, then upright
  const preferred =
    cd.body.bolts.n === 2 ? [BOLT_TURNS.across, BOLT_TURNS.upright] : [BOLT_TURNS.diagonal];
  let pick: ReturnType<typeof tryTurn> = null;
  for (const turn of boltTurns(cd, throat.holes, preferred)) pick ??= tryTurn(turn);
  const fit = pick
    ? {
        t,
        zBack,
        w,
        top: pick.top,
        bottom,
        slotW,
        slotD,
        turn: pick.turn,
        through: pick.through,
        head,
        footClearsDriver: -driverRadius(cd) - bottom >= PLATE.driverGap,
      }
    : null;
  byKey.set(key, fit);
  return fit;
}

/** A bolt's head (flange or washer, and dome) on a face square to z at `zFace`, centered on (x, y), facing forward. */
function addButtonHead(
  ctx: SceneContext,
  head: PlateBoltHead,
  x: number,
  y: number,
  zFace: number,
) {
  const { flangeR, flange, domeR, dome } = head;
  const add = (geometry: THREE.BufferGeometry, z: number) => {
    const m = new THREE.Mesh(geometry, ctx.materials.hardware);
    m.rotation.x = -Math.PI / 2; // the cylinder's +y toward +z, so its top (the dome's) faces forward
    m.position.set(x, y, z);
    m.name = PLATE_MESH_NAMES.bolt;
    ctx.group.add(m);
  };
  add(new THREE.CylinderGeometry(flangeR, flangeR, flange, 32), zFace + flange / 2);
  // the dome, drawn as a frustum narrowing to about half its radius
  add(new THREE.CylinderGeometry(domeR * 0.55, domeR, dome, 32), zFace + flange + dome / 2);
}

/**
 * The aluminum plate (`fit`, from `plateFit`) on the horn's axis `at`, on a lid (`lidY`; its roundover stands
 * `ROUNDOVER_IN` above it, and its flat top ends at `lidBackZ`): the driver's front face stays on the throat flange.
 *
 * - The plate stands against the flange's front face (between the flange and the flare), as wide as the flange, from
 *   the bend up to its top edge, with the U-slot open at the top for the neck.
 * - The driver's bolts that clear the slot pass through it and the flange into the driver, each thread's head on its
 *   front; the others hold the flange alone.
 * - At the bottom it bends back (inside radius `bendR`) into a foot on the lid under the driver, `foot` long. The foot
 *   stops short of the lid's back edge, of the horn's binding posts, and of the driver itself when the driver hangs
 *   within `driverGap` of the bend's top. When the room left doesn't reach past the bend, the bend and foot are left
 *   out.
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
  for (const b of through)
    addButtonHead(ctx, fit.head, at.x + b.x, at.y + b.y, at.throatZ + zBack + t);

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
  if (back > zc) return; // something on the lid (or the driver) where the bend would be
  const end = back;
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
