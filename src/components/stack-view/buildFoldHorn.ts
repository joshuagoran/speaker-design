// A folded (drawn) horn's parts in its chamber: each board of its side section as a panel the clear width, the drivers'
// cutouts in the board they mount on and, in the cutaway, the drivers' baskets and motors behind them. The mouth and the
// vent are holes in their wall, cut in that panel by the chamber's builder (buildSpeakerScene).
// The side section's coordinates (`SidePoint`) map to the chamber group's: `zIn` back from the baffle's inside face,
// `yIn` up from the clear face's bottom, across from the clear face's center.
import * as THREE from "three";
import type { SceneContext } from "./sceneContext";
import { circlePath } from "./geometry";
import { drawnSeg, len, left, sub, unit } from "../../lib/speaker/foldGeometry";
import { foldAcross } from "../../lib/speaker/foldTrace";
import { FOLD_DRIVER_GAP_IN, FOLD_BASKET_FLARE, FOLD_BASKET_SHARE } from "../../constants/foldHorn";
import type { FoldDrawing } from "../../lib/speaker/foldHorn";
import type { FaceRect } from "../../lib/speaker/speakerLayout";
import type { SidePoint } from "../../types";

/** The mesh names a folded horn's parts take (`SPEAKER_MESH_NAMES`). */
export interface FoldMeshNames {
  board: string;
  driver: string;
}

/** How many sides a driver's round body has. */
const DRIVER_SIDES = 32;

/**
 * Builds a chamber's folded horn into `ctx.group` (the chamber's own: its center line at x = 0, its bottom at y = 0).
 * `innerZ` is the baffle's inside face in that group, `clear` the chamber's clear face and `origin` the chamber's center
 * line (x) and bottom (y), in the same coordinates as the face.
 */
export function buildFoldHorn(
  ctx: SceneContext,
  {
    drawing,
    innerZ,
    clear,
    origin,
    names,
  }: {
    drawing: FoldDrawing;
    innerZ: number;
    clear: FaceRect;
    origin: { x: number; y: number };
    names: FoldMeshNames;
  },
) {
  const { fold, parts, room } = drawing;
  const T = ctx.wall;
  const centerX = clear.x + clear.w / 2 - origin.x;
  const floorY = clear.y - origin.y;
  /** a side-section point in the group's coordinates, and a direction (no offset) in them */
  const world = (p: SidePoint) => new THREE.Vector3(centerX, floorY + p.yIn, innerZ - p.zIn);
  const dir = (v: SidePoint) => new THREE.Vector3(0, v.yIn, -v.zIn);

  // the drivers' cutouts in their board: each row's drivers side by side across the width
  const driver = room.driver;
  const across = driver ? foldAcross(clear.w, driver.cutoutIn) : 1;
  const pitch = driver ? driver.cutoutIn + FOLD_DRIVER_GAP_IN : 0;
  /** each part's drivers' centers across the board's width, from its center line (x), with the part */
  const rows = parts.map((part, row) => {
    const n = driver ? Math.min(across, driver.count - row * across) : 0;
    return {
      part,
      xs: Array.from({ length: Math.max(0, n) }, (_, k) => (k - (n - 1) / 2) * pitch),
    };
  });

  fold.boards.forEach((board, i) => {
    const seg = drawnSeg(fold.boards, i, T);
    const length = len(sub(seg.b, seg.a));
    if (!(length > 0)) return;
    const along = unit(sub(seg.b, seg.a));
    const normal = left(along);
    // the panel in its own plane: across the width (x) and along the board from its drawn end `a` (y), then thickness (z)
    const shape = new THREE.Shape([
      new THREE.Vector2(-clear.w / 2, 0),
      new THREE.Vector2(clear.w / 2, 0),
      new THREE.Vector2(clear.w / 2, length),
      new THREE.Vector2(-clear.w / 2, length),
    ]);
    if (fold.drivers?.board === i) {
      // the drawn end's start is `a` less what the join adds
      const lead = len(sub(board.a, seg.a));
      for (const { part, xs } of rows)
        for (const x of xs)
          shape.holes.push(circlePath(x, lead + part.alongIn, part.cutoutRadiusIn));
    }
    const mesh = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: false, curveSegments: 32 }),
      ctx.materials.inner,
    );
    // x across, y along the board, z its thickness (to the board's left); the extrusion starts T/2 right of the center line
    const [alongW, normalW] = [dir(along), dir(normal)];
    const basis = new THREE.Matrix4().makeBasis(new THREE.Vector3(1, 0, 0), alongW, normalW);
    mesh.quaternion.setFromRotationMatrix(basis);
    mesh.position.copy(world(seg.a)).addScaledVector(normalW, -T / 2);
    mesh.name = names.board;
    ctx.group.add(mesh);
  });

  // the drivers' baskets and motors behind the board, as the other horn drivers are drawn (the cutaway)
  if (ctx.cutaway && driver) {
    const profile = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(driver.cutoutIn / 2, 0),
      new THREE.Vector2(
        (driver.motorIn / 2) * FOLD_BASKET_FLARE,
        driver.depthIn * FOLD_BASKET_SHARE,
      ),
      new THREE.Vector2(driver.motorIn / 2, driver.depthIn),
      new THREE.Vector2(0, driver.depthIn),
    ];
    const geometry = new THREE.LatheGeometry(profile, DRIVER_SIDES);
    // the revolved outline's winding is not fixed: draw both sides
    const material = ctx.materials.black.clone();
    material.side = THREE.DoubleSide;
    for (const { part, xs } of rows) {
      // the body's axis (the lathe's +y) runs back from the board's far face
      const axis = dir(part.back).normalize();
      for (const x of xs) {
        const body = new THREE.Mesh(geometry, material);
        body.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis);
        body.position.copy(world(part.backFace)).add(new THREE.Vector3(x, 0, 0));
        body.name = names.driver;
        ctx.group.add(body);
      }
    }
  }
}
