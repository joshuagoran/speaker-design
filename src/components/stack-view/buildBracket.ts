import * as THREE from "three";
import { ROUNDOVER_IN } from "./stackHeights";
import type { SceneContext } from "./sceneContext";
import type { HornAxis } from "./buildHorn";
import type { CompressionDriver, HornAdapter } from "../../types";

/** The bracket's plate (upright and foot). */
export const BRACKET_MESH_NAME = "cdBracket";
/** The bracket's bolts, washers and screws. */
export const BRACKET_BOLT_MESH_NAME = "cdBracketBolt";

/**
 * The L-bracket under the compression driver: one bent 1/8 in aluminum plate, 3.5 in wide. The upright is notched round
 * the adapter's neck and bolts with two M6 bolts to the back of the adapter's front flange (its two lower holes on the
 * body's bolt circle). The foot runs 2 in back on the mid box's lid with two screws. 3D view only; no parts list yet.
 */
export const BRACKET = {
  width: 3.5,
  thickness: 0.125,
  foot: 2,
  /** how far the upright reaches above the bolt holes */
  aboveBolts: 0.55,
  /** clearance round the adapter's neck */
  notchGap: 0.05,
  /** where the foot's screws sit: across from the center, and back from the upright as a share of the foot */
  screwX: 1.1,
  screwAt: 0.6,
  /** clamped between the throat and the driver: the upright's margin past the driver's bolts */
  clampEdge: 0.35,
} as const;

/** Whether a horn's adapter has a front flange and a neck behind it for the bracket to bolt to. */
export const takesBracket = (adapter: Pick<HornAdapter, "steps"> | undefined) =>
  !!adapter && adapter.steps.length >= 2 && adapter.steps[1][0] < adapter.steps[0][0];

/**
 * The bracket for one horn with a flanged adapter: `at` is the horn's axis and throat, `lidY` the top of the box under
 * it (the frame's roundover stands `ROUNDOVER_IN` above that, and the foot sits on it).
 */
export function buildBracket(
  ctx: SceneContext,
  adapter: Pick<HornAdapter, "steps" | "bodyBoltCircle">,
  at: HornAxis,
  lidY: number,
) {
  const [[, flangeLen], [neckDia]] = adapter.steps;
  const bcR = adapter.bodyBoltCircle / 2;
  // the two lower holes, at 225° and 315°, relative to the axis
  const bolt = { x: bcR * Math.SQRT1_2, y: -bcR * Math.SQRT1_2 };
  addBracket(
    ctx,
    at,
    {
      zFace: at.throatZ - flangeLen, // the front flange's back face
      bolt,
      top: bolt.y + BRACKET.aboveBolts,
      notchR: neckDia / 2 + BRACKET.notchGap,
    },
    lidY,
  );
}

/**
 * For a horn the driver bolts straight to (no adapter): the brackets are custom, so the upright itself is clamped
 * between the horn's throat flange and the driver by the driver's bolts, with a hole for the throat. It is as wide as
 * the bolt circle needs and reaches just past the upper bolts. The driver moves back by the bracket's thickness. 3D
 * only: the planner's model and parts list leave it out. Returns the z of the upright's back face, where the driver's
 * front face sits.
 */
export function buildClampedBracket(
  ctx: SceneContext,
  cd: Pick<CompressionDriver, "body" | "exit">,
  at: HornAxis,
  lidY: number,
): number {
  const boltOff = (cd.body.bolts.circle / 2) * Math.SQRT1_2; // the bolts at 45°, 135°, 225° and 315°
  addBracket(
    ctx,
    at,
    {
      zFace: at.throatZ, // against the throat flange
      bolt: null, // the driver's own bolts clamp it
      top: boltOff + BRACKET.aboveBolts,
      notchR: null,
      holeR: cd.exit / 2,
      width: Math.max(BRACKET.width, 2 * (boltOff + BRACKET.clampEdge)),
    },
    lidY,
  );
  return at.throatZ - BRACKET.thickness;
}

/**
 * The bracket's upright and foot, in the horn axis' frame: the upright's front face against `zFace`, reaching up to
 * `top`, `width` wide (default `BRACKET.width`). It is bolted with M6 at ±`bolt` (none drawn when the driver's own bolts
 * clamp it), notched round the adapter's neck when `notchR` is given, and pierced for the throat when `holeR` is.
 */
function addBracket(
  ctx: SceneContext,
  at: HornAxis,
  {
    zFace: zUp,
    bolt,
    top,
    notchR,
    holeR = null,
    width = BRACKET.width,
  }: {
    zFace: number;
    bolt: { x: number; y: number } | null;
    top: number;
    notchR: number | null;
    holeR?: number | null;
    width?: number;
  },
  lidY: number,
) {
  const { aluminum, hardware } = ctx.materials;
  const t = BRACKET.thickness;
  const w = width / 2;
  const footY = lidY + ROUNDOVER_IN;
  const bottom = footY - at.y;
  const shape = new THREE.Shape();
  shape.moveTo(-w, bottom);
  shape.lineTo(w, bottom);
  shape.lineTo(w, top);
  if (notchR !== null && notchR > -top) {
    // a round notch in the top edge for the neck (none when the neck clears the top edge)
    const xn = Math.sqrt(Math.max(0, notchR * notchR - top * top));
    shape.lineTo(xn, top);
    shape.absarc(0, 0, notchR, Math.atan2(top, xn), Math.atan2(top, -xn), true);
  }
  shape.lineTo(-w, top);
  shape.lineTo(-w, bottom);
  if (holeR !== null) shape.holes.push(new THREE.Path().absarc(0, 0, holeR, 0, Math.PI * 2, true));
  const upright = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false, curveSegments: 24 }),
    aluminum,
  );
  upright.position.set(at.x, at.y, zUp - t);
  upright.name = BRACKET_MESH_NAME;
  ctx.group.add(upright);
  const foot = new THREE.Mesh(new THREE.BoxGeometry(width, t, BRACKET.foot), aluminum);
  foot.position.set(at.x, footY + t / 2, zUp - BRACKET.foot / 2);
  foot.name = BRACKET_MESH_NAME;
  ctx.group.add(foot);
  for (const sx of [-1, 1]) {
    // M6 hex head and washer behind the upright (when bolted), and a wood screw in the foot
    if (bolt)
      addBoltHead(ctx, at.x + sx * bolt.x, at.y + bolt.y, zUp - t, -1, BRACKET_BOLT_MESH_NAME);
    const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.07, 20), hardware);
    screw.position.set(
      at.x + sx * BRACKET.screwX,
      footY + t + 0.035,
      zUp - BRACKET.foot * BRACKET.screwAt,
    );
    screw.name = BRACKET_BOLT_MESH_NAME;
    ctx.group.add(screw);
  }
}

/** A bolt's hex head and washer (M6 or 1/4-20), in: the head's corner radius and length, the washer's radius and thickness. */
export const BOLT_HEAD = { r: 0.19, len: 0.16, washerR: 0.26, washer: 0.03 } as const;

/**
 * A bolt's hex head and washer on a face square to the z axis at `zFace`, centered on (x, y): the washer against the
 * face and the head beyond it, toward `dir` (+1 forward, −1 back).
 */
export function addBoltHead(
  ctx: SceneContext,
  x: number,
  y: number,
  zFace: number,
  dir: 1 | -1,
  name: string,
) {
  const add = (geometry: THREE.BufferGeometry, z: number) => {
    const m = new THREE.Mesh(geometry, ctx.materials.hardware);
    m.rotation.x = Math.PI / 2;
    m.position.set(x, y, z);
    m.name = name;
    ctx.group.add(m);
  };
  add(
    new THREE.CylinderGeometry(BOLT_HEAD.r, BOLT_HEAD.r, BOLT_HEAD.len, 6),
    zFace + dir * BOLT_HEAD.washer + (dir * BOLT_HEAD.len) / 2,
  );
  add(
    new THREE.CylinderGeometry(BOLT_HEAD.washerR, BOLT_HEAD.washerR, BOLT_HEAD.washer, 24),
    zFace + (dir * BOLT_HEAD.washer) / 2,
  );
}
