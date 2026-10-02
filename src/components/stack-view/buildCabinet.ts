import * as THREE from "three";
import { roundedRectShape, archOutlinePath } from "./geometry";
import { ROUNDOVER_IN } from "./stackHeights";
import type { SceneContext } from "./sceneContext";
import type { Dims3 } from "../../types";

const BAFFLE_THICKNESS_IN = 0.75;

/**
 * A cabinet: four perimeter panels (wall ply) with 1/4" roundovers front and back, a 3/4" baffle set back by the inset on
 * cleats, painted, and a back panel. With `archTop` the top is a semicircle the full width of the cabinet. `baffleHoles`
 * are in the baffle's centred coordinates; `baffleBottom` leaves that much of the baffle's lower edge open.
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
    x = 0,
    parent = ctx.group,
  }: {
    dims: Dims3;
    baffleHoles: THREE.Path[];
    y: number;
    archTop?: boolean;
    baffleBottom?: number;
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
    const back = new THREE.Mesh(
      new THREE.ExtrudeGeometry(bk, { depth: T, bevelEnabled: false, curveSegments: 48 }),
      shell,
    );
    back.position.set(x, y + h / 2, -d / 2);
    parent.add(back);
  } else {
    const iw = w - 2 * T,
      ih = h - 2 * T - baffleBottom;
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
    const bshape = roundedRectShape(iw, ih, 0.12);
    baffleHoles.forEach((hp) => bshape.holes.push(hp));
    const baffle = new THREE.Mesh(
      new THREE.ExtrudeGeometry(bshape, { depth: BT, bevelEnabled: false }),
      [baffleMat, cutaway ? baffleMat : inner],
    );
    baffle.position.set(x, y + T + baffleBottom + ih / 2, d / 2 - REVEAL - BT);
    parent.add(baffle);
    const back = new THREE.Mesh(new THREE.BoxGeometry(iw, h - 2 * T, T), shell);
    back.position.set(x, y + h / 2, -d / 2 + T / 2);
    parent.add(back);
  }
  return { baffleZ: d / 2 - REVEAL, top: y + h };
}
