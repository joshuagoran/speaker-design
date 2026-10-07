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
} as const;

/** Whether a horn's adapter has a front flange and a neck behind it for the bracket to bolt to. */
export const takesBracket = (adapter: HornAdapter | undefined): adapter is HornAdapter =>
  !!adapter && adapter.steps.length >= 2 && adapter.steps[1][0] < adapter.steps[0][0];

/**
 * The bracket for one horn with a flanged adapter: `at` is the horn's axis and throat, `lidY` the top of the box under
 * it (the frame's roundover stands `ROUNDOVER_IN` above that, and the foot sits on it).
 */
export function buildBracket(ctx: SceneContext, adapter: HornAdapter, at: HornAxis, lidY: number) {
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
 * For a horn the driver bolts straight to (no adapter), for illustration only: a 1/8 in aluminum plate between the
 * horn's throat and the driver, held by the driver's 4 bolts. It is a disc as wide as the driver with a tab below it,
 * and the bracket's upright bolts to the back of the tab, below the driver. 3D only: the planner's model and parts list
 * leave it out. Returns the z of the plate's back face, where the driver's front face sits.
 */
export function buildPlateBracket(
  ctx: SceneContext,
  cd: Pick<CompressionDriver, "body">,
  at: HornAxis,
  lidY: number,
): number {
  const t = BRACKET.thickness;
  const cdR = cd.body.dia / 2;
  const bolt = { x: CD_PLATE.boltX, y: -(cdR + CD_PLATE.boltsBelowCd) };
  const tabBottom = bolt.y - CD_PLATE.belowBolts;
  const add = (geometry: THREE.BufferGeometry, y: number) => {
    const m = new THREE.Mesh(geometry, ctx.materials.aluminum);
    m.position.set(at.x, at.y + y, at.throatZ - t / 2);
    m.name = CD_PLATE_MESH_NAME;
    ctx.group.add(m);
    return m;
  };
  add(new THREE.CylinderGeometry(cdR, cdR, t, 48), 0).rotation.x = Math.PI / 2;
  add(new THREE.BoxGeometry(BRACKET.width, -tabBottom, t), tabBottom / 2);
  addBracket(
    ctx,
    at,
    { zFace: at.throatZ - t, bolt, top: -(cdR + CD_PLATE.uprightBelowCd), notchR: null },
    lidY,
  );
  return at.throatZ - t;
}

/** The plate for a horn without an adapter (`buildPlateBracket`). */
export const CD_PLATE_MESH_NAME = "cdPlate";
export const CD_PLATE = {
  /** the upright's two bolts: across from the axis, and below the driver's edge */
  boltX: 1.1,
  boltsBelowCd: 0.65,
  /** how far the tab runs below the bolts */
  belowBolts: 0.4,
  /** how far the upright's top stays below the driver */
  uprightBelowCd: 0.2,
} as const;

/**
 * The bracket's upright and foot, in the horn axis' frame: the upright's front face against `zFace`, bolted at ±`bolt`,
 * reaching up to `top`, notched round the adapter's neck when `notchR` is given.
 */
function addBracket(
  ctx: SceneContext,
  at: HornAxis,
  {
    zFace: zUp,
    bolt,
    top,
    notchR,
  }: { zFace: number; bolt: { x: number; y: number }; top: number; notchR: number | null },
  lidY: number,
) {
  const { aluminum, hardware } = ctx.materials;
  const t = BRACKET.thickness;
  const w = BRACKET.width / 2;
  const footY = lidY + ROUNDOVER_IN;
  const bottom = footY - at.y;
  const shape = new THREE.Shape();
  shape.moveTo(-w, bottom);
  shape.lineTo(w, bottom);
  shape.lineTo(w, top);
  if (notchR !== null) {
    // a round notch in the top edge for the neck
    const xn = Math.sqrt(Math.max(0, notchR * notchR - top * top));
    shape.lineTo(xn, top);
    shape.absarc(0, 0, notchR, Math.atan2(top, xn), Math.atan2(top, -xn), true);
  }
  shape.lineTo(-w, top);
  shape.lineTo(-w, bottom);
  const upright = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false, curveSegments: 24 }),
    aluminum,
  );
  upright.position.set(at.x, at.y, zUp - t);
  upright.name = BRACKET_MESH_NAME;
  ctx.group.add(upright);
  const foot = new THREE.Mesh(new THREE.BoxGeometry(BRACKET.width, t, BRACKET.foot), aluminum);
  foot.position.set(at.x, footY + t / 2, zUp - BRACKET.foot / 2);
  foot.name = BRACKET_MESH_NAME;
  ctx.group.add(foot);
  const part = (
    geometry: THREE.BufferGeometry,
    x: number,
    y: number,
    z: number,
    alongZ: boolean,
  ) => {
    const m = new THREE.Mesh(geometry, hardware);
    if (alongZ) m.rotation.x = Math.PI / 2;
    m.position.set(x, y, z);
    m.name = BRACKET_BOLT_MESH_NAME;
    ctx.group.add(m);
  };
  for (const sx of [-1, 1]) {
    // M6 hex head and washer behind the upright, and a wood screw in the foot
    part(
      new THREE.CylinderGeometry(0.19, 0.19, 0.16, 6),
      at.x + sx * bolt.x,
      at.y + bolt.y,
      zUp - t - 0.03 - 0.08,
      true,
    );
    part(
      new THREE.CylinderGeometry(0.26, 0.26, 0.03, 24),
      at.x + sx * bolt.x,
      at.y + bolt.y,
      zUp - t - 0.015,
      true,
    );
    part(
      new THREE.CylinderGeometry(0.17, 0.17, 0.07, 20),
      at.x + sx * BRACKET.screwX,
      footY + t + 0.035,
      zUp - BRACKET.foot * BRACKET.screwAt,
      false,
    );
  }
}
