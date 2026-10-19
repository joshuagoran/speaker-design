import * as THREE from "three";
import { roundedRectShape, roundedRectPath, circlePath } from "./geometry";
import { addElbow, addPipe, type TubeStyle } from "./tubeParts";
import { modelTubeElbows, subTubeLegs } from "../../lib/build/tubes";
import { TUBE_FLARE_RADIUS_IN } from "../../data/acoustics/tube-ends";
import {
  ductDividerIn,
  foldedRearWallIn,
  foldedShelfIn,
  slotFinIn,
  maxStraightSlotIn,
  slotFolds,
} from "../../lib/acoustics/boxModels";
import type { SceneContext } from "./sceneContext";
import { subVentOpenings, type SubVentPlan } from "../../lib/build/ventPlan";
import type { Dims3, SubDriver } from "../../types";
import { VENT_MESH_NAME } from "./buildBraces";
/**
 * The sub vent's openings in the baffle: the round tubes' mouths, or the side ducts' full-height mouths against the side
 * walls; in the baffle's coordinates, the box's center line at `x`, its bottom at `plinth` and the baffle's center at
 * `baffleCy`. (The bottom slot leaves the baffle's bottom edge open instead: `bandH`.)
 */
export function subVentHoles(
  plan: SubVentPlan,
  s: Dims3,
  T: number,
  { x, plinth: pl, baffleCy }: { x: number; plinth: number; baffleCy: number },
): THREE.Path[] {
  return subVentOpenings(plan, s, T).map((o) =>
    o.shape === "circle"
      ? circlePath(x + o.x, pl + o.y - baffleCy, o.r)
      : roundedRectPath(x + o.x, pl + o.y - baffleCy, o.w, o.h, o.corner),
  );
}

/**
 * The sub vent's parts behind the baffle (`plan`, for the box `box` whose bottom is at `plinth` and baffle face at
 * `baffleZ`): the side ducts' walls and dividers, the nose round the slot's mouths, or the flared tubes, folded as the
 * model folds them.
 */
export function buildSubVent(
  ctx: SceneContext,
  plan: SubVentPlan,
  {
    sub,
    box: s,
    plinth: pl,
    baffleZ: subZ,
    parent: subGroup,
  }: {
    sub: Pick<SubDriver, "size" | "depthIn">;
    box: Dims3;
    plinth: number;
    baffleZ: number;
    parent: THREE.Object3D;
  },
) {
  const { inner: plyIn, port: portMat, shell: shellMat } = ctx.materials;
  const T = ctx.wall,
    REVEAL = ctx.inset;
  const {
    portStyle,
    pg,
    vSlot,
    sides,
    ductH,
    innerW,
    fins,
    round,
    portR,
    tubeVent,
    tubes,
    bandH,
    vThroat,
  } = plan;
  if (vSlot) {
    // Full-height duct against each side wall. The inner wall is a constant
    // thickness panel chamfered 20 deg at both ends, so the duct runs a
    // straight throat with a flared mouth front and rear.
    const slotH = s.h - 2 * T;
    const throat = vThroat;
    const mouth = throat + 0.43;
    const FL = 0.43 / Math.tan((20 * Math.PI) / 180); // 1.18 in along the duct
    const yc = pl + s.h / 2;
    const zf = s.d / 2; // duct mouth, flush with the frame face
    const zb = -s.d / 2 + T; // inside face of the back panel
    // rear end of the duct: the set duct length back from the mouth, leaving at least a
    // throat-width gap to the back panel
    const zr = Math.max(zb + throat, zf - (pg.tubeLen != null ? pg.tubeLen : zf - zb));
    const sideLen = zf - zr;
    const divT = ductDividerIn({ div: pg.divider });

    sides.forEach((k) => {
      const xo = k * (innerW / 2); // inside face of the side wall
      const xT = xo - k * throat; // duct face at the throat
      const xM = xo - k * mouth; // duct face at a flared end
      // profile in world XZ; shape coords are (x, -z) so the extrusion runs along +Y
      const sh = new THREE.Shape();
      sh.moveTo(xM, -zf);
      sh.lineTo(xT, -(zf - FL));
      sh.lineTo(xT, -(zr + FL));
      sh.lineTo(xM, -zr);
      sh.lineTo(xM - k * T, -zr);
      sh.lineTo(xT - k * T, -(zr + FL));
      sh.lineTo(xT - k * T, -(zf - FL));
      sh.lineTo(xM - k * T, -zf);
      sh.closePath();
      const wall = new THREE.Mesh(
        new THREE.ExtrudeGeometry(sh, { depth: slotH, bevelEnabled: false }),
        plyIn,
      );
      wall.rotation.x = -Math.PI / 2;
      wall.position.set(0, yc - slotH / 2, 0);
      wall.name = VENT_MESH_NAME;
      subGroup.add(wall);

      // two dividers per duct, bracing the inner wall to the side wall, at the design's divider thickness
      [-1, 1].forEach((f) => {
        const div = new THREE.Mesh(new THREE.BoxGeometry(throat, divT, sideLen), plyIn);
        div.position.set(k * (innerW / 2 - throat / 2), yc + (f * slotH) / 6, zr + sideLen / 2);
        div.name = VENT_MESH_NAME;
        subGroup.add(div);
      });
    });
  } else if (!round) {
    // duct mouths sit flush with the frame face; the box bottom is the duct floor
    const band = roundedRectShape(innerW, bandH, 0.12);
    for (const x of fins.openings)
      band.holes.push(roundedRectPath(x, -T / 2, fins.open, ductH, 0.25));
    if (REVEAL > 0) {
      const nose = new THREE.Mesh(
        new THREE.ExtrudeGeometry(band, { depth: REVEAL, bevelEnabled: false }),
        shellMat,
      );
      nose.position.set(0, pl + T + bandH / 2, s.d / 2 - REVEAL);
      subGroup.add(nose);
    }
  } else if (tubes) {
    // flared tubes behind the baffle: bell, straight run back, then (as the model folds them) an elbow up the back
    // wall and a second forward under the lid, and the inner bell at the mouth
    const e = modelTubeElbows(s, portStyle, tubeVent, T, REVEAL, sub);
    const legs = subTubeLegs(s, portStyle, tubeVent, T, REVEAL, sub, e);
    const RB = TUBE_FLARE_RADIUS_IN,
      seg = 10,
      bend = Math.min(portR * 1.5, legs.run / 2, legs.rise / 2); // the elbows' centerline radius
    const prof: THREE.Vector2[] = [];
    for (let i = 0; i <= seg; i++) {
      const t = (i / seg) * (Math.PI / 2);
      prof.push(new THREE.Vector2(portR + RB * (1 - Math.cos(t)), RB * Math.sin(t)));
    }
    const tube: TubeStyle = { r: portR, material: portMat, name: VENT_MESH_NAME, parent: subGroup };
    const pipe = (a: THREE.Vector3, b: THREE.Vector3) => addPipe(tube, a, b);
    const elbow = (c: THREE.Vector3, ax: THREE.Vector3, ay: THREE.Vector3) =>
      addElbow(tube, bend, c, ax, ay);
    // a quarter-round flare whose lip is the mouth `at`, opening along `dir`: inside the tube's length, as the model
    // counts it (its run is part of the centerline, lib/build/tubes flareShortfall)
    const bell = (at: THREE.Vector3, dir: THREE.Vector3) => {
      const m = new THREE.Mesh(new THREE.LatheGeometry(prof, 32), portMat);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      m.position.copy(at).addScaledVector(dir, -RB);
      m.name = VENT_MESH_NAME;
      subGroup.add(m);
    };
    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    tubes.tubes.forEach((p) => {
      const x = p.x,
        y = pl + T + p.y,
        zc = subZ - legs.run; // the first corner, behind the baffle face
      bell(V(x, y, subZ), V(0, 0, 1)); // its lip flush with the baffle front
      if (e === 0) {
        pipe(V(x, y, subZ - RB), V(x, y, zc + RB));
        bell(V(x, y, zc), V(0, 0, -1));
        return;
      }
      pipe(V(x, y, subZ - RB), V(x, y, zc + bend));
      elbow(V(x, y + bend, zc + bend), V(0, -1, 0), V(0, 0, -1));
      const top = y + legs.rise;
      if (e === 1) {
        pipe(V(x, y + bend, zc), V(x, top - RB, zc));
        bell(V(x, top, zc), V(0, 1, 0));
        return;
      }
      pipe(V(x, y + bend, zc), V(x, top - bend, zc));
      elbow(V(x, top - bend, zc + bend), V(0, 0, -1), V(0, 1, 0));
      pipe(V(x, top, zc + bend), V(x, top, zc + legs.back - RB));
      bell(V(x, top, zc + legs.back), V(0, 0, 1));
    });
  }
}

/**
 * The bottom slot's shelf and fins (`plan`, in the box `box` whose bottom is at `plinth`): straight from the frame face
 * back, or, too long to run straight, the floor leg's roof and fins and the rear channel's wall up the back.
 */
export function buildSubSlotShelf(
  ctx: SceneContext,
  plan: SubVentPlan,
  { box: s, plinth: pl, parent: subGroup }: { box: Dims3; plinth: number; parent: THREE.Object3D },
) {
  const plyIn = ctx.materials.inner;
  const T = ctx.wall;
  const { portStyle, pg, ductH, innerW, fins } = plan;
  // duct structure inside: top shelf and its fins (slot version only)
  const wantLen = pg.tubeLen != null ? pg.tubeLen : s.d - T - 3;
  const ductLen = Math.max(2, Math.min(wantLen, maxStraightSlotIn(s, ductH, T))); // from the frame face back, open gap behind
  // a slot longer than the straight run holds folds up the back wall, as the model and the cutlist take it
  const folded = portStyle === "slots" && slotFolds(s, { slotH: ductH, len: wantLen }, T);
  if (folded) {
    // floor leg to a rear channel, then up the back wall; open at the top of the rear channel
    const bz = -s.d / 2 + T; // inside face of the back panel
    const wallZ = bz + ductH + T / 2; // rear channel's front wall
    const roofLen = foldedShelfIn(s, ductH, T); // from the front to the rear channel's wall, as the cutlist's shelf
    const roofZ = s.d / 2 - roofLen / 2;
    const roof = new THREE.Mesh(new THREE.BoxGeometry(innerW, T, roofLen), plyIn);
    roof.position.set(0, pl + T + ductH + T / 2, roofZ);
    roof.name = VENT_MESH_NAME;
    subGroup.add(roof);
    fins.centers.forEach((x) => {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(T, ductH, roofLen), plyIn);
      fin.position.set(x, pl + T + ductH / 2, roofZ);
      fin.name = VENT_MESH_NAME;
      subGroup.add(fin);
    });
    // the rear channel rises until the centerline adds up to the set duct length (the cutlist's rear wall), never
    // closer than a slot height under the lid. The wall starts at the floor leg's roof, so the floor leg runs on under
    // it into the rear channel, turns, and rises between this wall and the back panel.
    const wallBot = pl + T + ductH;
    const wallH = foldedRearWallIn(s, { slotH: ductH, len: wantLen }, T);
    const rw = new THREE.Mesh(new THREE.BoxGeometry(innerW, wallH, T), plyIn);
    rw.position.set(0, wallBot + wallH / 2, wallZ);
    rw.name = VENT_MESH_NAME;
    subGroup.add(rw);
  } else if (portStyle === "slots") {
    const ductZ = s.d / 2 - ductLen / 2;
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(innerW, T, ductLen), plyIn);
    shelf.position.set(0, pl + T + ductH + T / 2, ductZ);
    shelf.name = VENT_MESH_NAME;
    subGroup.add(shelf);
    // the fins run on to the back panel past the shelf, as the cutlist's
    const finLen = slotFinIn(s, T);
    fins.centers.forEach((x) => {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(T, ductH, finLen), plyIn);
      fin.position.set(x, pl + T + ductH / 2, s.d / 2 - finLen / 2);
      fin.name = VENT_MESH_NAME;
      subGroup.add(fin);
    });
  }
}
