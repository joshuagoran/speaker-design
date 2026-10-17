import * as THREE from "three";
import { roundedRectShape, archOutlinePath } from "./geometry";
import { ROUNDOVER_IN } from "./stackHeights";
import type { SceneContext } from "./sceneContext";
import { NO_WALL_OPENINGS, openingRect, panelPieces, type WallOpenings } from "./wallCuts";
import type { Dims3 } from "../../types";

/** The baffle's thickness, in: ¾″ ply, whatever the walls are. */
export const BAFFLE_THICKNESS_IN = 0.75;

/** The radius of the frame's baffle's corners, in: an opening that reaches a corner has at least this one. */
export const BAFFLE_CORNER_IN = 0.12;

/**
 * A cabinet: four perimeter panels (wall ply) with 1/4" roundovers front and back, a 3/4" baffle set back by the inset on
 * cleats, painted, and a back panel. With `archTop` the top is a semicircle the full width of the cabinet. `baffleHoles`
 * are in the baffle's centered coordinates; `baffleBottom` leaves that much of the baffle's lower edge open. `backHoles`
 * (a passive radiator's or a port's cutout) are in the box's centered front-view coordinates, on either top.
 * `wallOpenings` are clear openings in the top and the bottom (a drawn horn's mouth or vent), in x across from the
 * cabinet's center line and in back from the baffle's inside face; with any, the perimeter is built as plain panels
 * (no roundover on the front and back edges) so the openings are real holes; an arched top takes none.
 * Returns the z of the baffle face and the y of the top.
 */
export function buildCabinet(
  ctx: SceneContext,
  {
    dims: { w, h, d },
    baffleHoles,
    y,
    archTop = false,
    baffleBottom = 0,
    backHoles = [],
    wallOpenings = NO_WALL_OPENINGS,
    x = 0,
    parent = ctx.group,
  }: {
    dims: Dims3;
    baffleHoles: THREE.Path[];
    y: number;
    archTop?: boolean;
    baffleBottom?: number;
    backHoles?: THREE.Path[];
    wallOpenings?: WallOpenings;
    x?: number;
    parent?: THREE.Object3D;
  },
): { baffleZ: number; top: number } {
  const { shell, baffle: baffleMat, inner } = ctx.materials;
  const { wall: T, inset: REVEAL, cutaway } = ctx;
  const BT = BAFFLE_THICKNESS_IN,
    RO = ROUNDOVER_IN;
  if (archTop) {
    const R = w / 2,
      acy = h / 2 - R; // arch center, frame-centered coords
    const shape = archOutlinePath(new THREE.Shape(), R, -h / 2, acy, R);
    shape.holes.push(
      archOutlinePath(new THREE.Path(), R - T + RO, -h / 2 + T - RO, acy, R - T + RO),
    );
    const frame = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape, {
        depth: d - 2 * RO,
        bevelEnabled: true,
        bevelSize: RO,
        bevelThickness: RO,
        bevelSegments: 4,
        curveSegments: 48,
      }),
      shell,
    );
    frame.position.set(x, y + h / 2, -d / 2 + RO);
    parent.add(frame);
    const ih = h - 2 * T - baffleBottom,
      bcy = y + T + baffleBottom + ih / 2;
    const bshape = archOutlinePath(new THREE.Shape(), R - T, -ih / 2, y + h - R - bcy, R - T);
    baffleHoles.forEach((hp) => bshape.holes.push(hp));
    const baffle = new THREE.Mesh(
      new THREE.ExtrudeGeometry(bshape, { depth: BT, bevelEnabled: false, curveSegments: 48 }),
      [baffleMat, cutaway ? baffleMat : inner], // caps painted, cut edges left as bare ply
    );
    baffle.position.set(x, bcy, d / 2 - REVEAL - BT);
    parent.add(baffle);
    const bk = archOutlinePath(new THREE.Shape(), R - T, -h / 2 + T, acy, R - T);
    backHoles.forEach((hp) => bk.holes.push(hp));
    const back = new THREE.Mesh(
      new THREE.ExtrudeGeometry(bk, { depth: T, bevelEnabled: false, curveSegments: 48 }),
      shell,
    );
    back.position.set(x, y + h / 2, -d / 2);
    parent.add(back);
  } else {
    const iw = w - 2 * T,
      ih = h - 2 * T - baffleBottom;
    if (wallOpenings.top.length + wallOpenings.bottom.length > 0) {
      // the sides as plain panels, and the top and bottom each as the pieces round their openings
      const innerZ = d / 2 - REVEAL - BT;
      for (const side of [-1, 1]) {
        const panel = new THREE.Mesh(new THREE.BoxGeometry(T, h, d), shell);
        panel.position.set(x + side * (w / 2 - T / 2), y + h / 2, 0);
        parent.add(panel);
      }
      for (const [openings, cy] of [
        [wallOpenings.bottom, y + T / 2],
        [wallOpenings.top, y + h - T / 2],
      ] as const)
        for (const piece of panelPieces(
          { x0: x - iw / 2, x1: x + iw / 2, z0: -d / 2, z1: d / 2 },
          openings.map((o) => openingRect(innerZ, o)),
        )) {
          const panel = new THREE.Mesh(
            new THREE.BoxGeometry(piece.x1 - piece.x0, T, piece.z1 - piece.z0),
            shell,
          );
          panel.position.set((piece.x0 + piece.x1) / 2, cy, (piece.z0 + piece.z1) / 2);
          parent.add(panel);
        }
    } else {
      const shape = roundedRectShape(w, h, RO * 1.5);
      shape.holes.push(roundedRectShape(iw + 2 * RO, h - 2 * T + 2 * RO, 0.12));
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: d - 2 * RO,
        bevelEnabled: true,
        bevelSize: RO,
        bevelThickness: RO,
        bevelSegments: 4,
      });
      const frame = new THREE.Mesh(geo, shell);
      frame.position.set(x, y + h / 2, -d / 2 + RO);
      parent.add(frame);
    }
    const bshape = roundedRectShape(iw, ih, BAFFLE_CORNER_IN);
    baffleHoles.forEach((hp) => bshape.holes.push(hp));
    const baffle = new THREE.Mesh(
      new THREE.ExtrudeGeometry(bshape, { depth: BT, bevelEnabled: false }),
      [baffleMat, cutaway ? baffleMat : inner],
    );
    baffle.position.set(x, y + T + baffleBottom + ih / 2, d / 2 - REVEAL - BT);
    parent.add(baffle);
    if (backHoles.length) {
      const bh = (h - 2 * T) / 2;
      const bk = new THREE.Shape([
        new THREE.Vector2(-iw / 2, -bh),
        new THREE.Vector2(iw / 2, -bh),
        new THREE.Vector2(iw / 2, bh),
        new THREE.Vector2(-iw / 2, bh),
      ]);
      backHoles.forEach((hp) => bk.holes.push(hp));
      const back = new THREE.Mesh(
        new THREE.ExtrudeGeometry(bk, { depth: T, bevelEnabled: false, curveSegments: 48 }),
        shell,
      );
      back.position.set(x, y + h / 2, -d / 2);
      parent.add(back);
    } else {
      const back = new THREE.Mesh(new THREE.BoxGeometry(iw, h - 2 * T, T), shell);
      back.position.set(x, y + h / 2, -d / 2 + T / 2);
      parent.add(back);
    }
  }
  return { baffleZ: d / 2 - REVEAL, top: y + h };
}
