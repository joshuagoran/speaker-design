import * as THREE from "three";
import { roundedRectShape, roundedRectPath, circlePath } from "./geometry";
import { buildCabinet } from "./buildCabinet";
import { buildCone } from "./buildCone";
import { towerBaffleHoles, buildTowerPartitions } from "./towerParts";
import { towerSpec } from "./stackHeights";
import { modelTubeElbows, subTubeLegs, tubeLayout } from "../../lib/pa/tubes";
import { TUBE_FLARE_RADIUS_IN } from "../../data/acoustics/tube-ends";
import {
  ductDividerIn,
  foldedRearWallIn,
  foldedShelfIn,
  slotFinIn,
  isRoundPort,
  maxStraightSlotIn,
  slotFolds,
} from "../../lib/pa/calc";
import type { SceneContext } from "./sceneContext";
import type { Props } from "./buildStackScene";
import type {
  BoxBracing,
  BoxHardwarePlan,
  BoxKeepOut,
  Dims3,
  Horn,
  MidDriver,
  PortStyle,
  SubDriver,
} from "../../types";
import { buildBraces, buildDriverBody, VENT_MESH_NAME } from "./buildBraces";
import { buildHardware } from "./buildHardware";
import { DRIVER_CLEARANCE_IN } from "../../lib/pa/bracing";

/**
 * The sub column: the plinth, the cabinet with its driver and vent cutouts, and the ducts or port tubes behind the baffle.
 * With `tower` the cabinet carries the mid and horn sections above the sub, on one shell and one baffle.
 * Returns the y of the sub's top, the z of the baffle face and the group everything went into.
 */
export function buildSubwoofer(
  ctx: SceneContext,
  {
    sub,
    box,
    portStyle,
    portGeom,
    plinth,
    tower,
    bracing,
    keepOut,
    hardware,
  }: {
    sub: Pick<SubDriver, "size" | "depthIn">;
    /** the box's handles and input dish (lib/pa/hardware), on its faces */
    hardware?: BoxHardwarePlan;
    box: Dims3;
    /** the sub box's braces and ribs (lib/bracing), drawn inside it */
    bracing?: BoxBracing;
    /** what the braces keep clear of (lib/pa/calc subKeepOut): its driver is drawn in the cutaway */
    keepOut?: BoxKeepOut;
    portStyle: PortStyle;
    portGeom?: Props["portGeom"];
    plinth: number;
    tower?: { mid: Pick<MidDriver, "size">; horn: Horn };
  },
): { top: number; baffleZ: number; group: THREE.Group } {
  const { wood: birch, inner: plyIn, port: portMat, shell: shellMat } = ctx.materials;
  const T = ctx.wall,
    REVEAL = ctx.inset;
  const subGroup = new THREE.Group();
  ctx.group.add(subGroup);
  // plinth / toe-kick, inset so the column appears to float
  const vSlot = portStyle === "vslots" || portStyle === "vslot1";
  const sides = portStyle === "vslot1" ? [1] : [-1, 1]; // side ducts: one wall or both
  const s = box;
  const pg = portGeom || {}; // explicit vent geometry when the cabinet is custom
  const pl = plinth || 0;
  if (pl > 0) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(s.w - 3, pl, s.d - 3), birch);
    p.position.set(0, pl / 2, 0);
    subGroup.add(p);
  }
  // sub column: driver cutout high on the baffle, three duct cutouts across the bottom
  const ductH = pg.ductH != null ? pg.ductH : 3,
    innerW = s.w - 2 * T,
    ductW = (innerW - 2 * T) / 3;
  const drvR = sub.size / 2 - 0.9;
  const round = isRoundPort(portStyle); // round-tube ports only
  const corners = portStyle === "round4";
  const nPorts = pg.nPorts != null ? pg.nPorts : portStyle === "round1" ? 1 : corners ? 4 : 2;
  const portR =
    pg.portR != null
      ? pg.portR
      : (portStyle === "round1" ? 8 : corners ? (sub.size >= 18 ? 4 : 3.5) : 5) / 2;
  // round tubes: where they sit on the baffle and how they fold, as the model and the cutlist take them (lib/pa/tubes)
  const tubeVent = {
    nt: nPorts,
    dia: 2 * portR,
    len: pg.tubeLen != null ? pg.tubeLen : portStyle === "round1" ? 11 : corners ? 11.5 : 9.8,
  };
  const tubes = round ? tubeLayout(s, portStyle, tubeVent, T, sub.size) : null;
  const bandH = round || vSlot ? 0 : ductH + T; // slots: baffle starts above the duct shelf
  // Tower: one shell and one continuous baffle; sections are divided internally.
  const { archTop, extH } = tower ? towerSpec(s, T, tower.horn) : { archTop: false, extH: 0 };
  const baffleH = s.h + extH - 2 * T - bandH;
  const baffleCy = pl + T + bandH + baffleH / 2; // absolute center of the baffle
  // centered when symmetric; bottom slots: centered in the baffle above the duct (sub section only in a tower)
  const drvAbsY = tubes
    ? pl + T + tubes.driver.y
    : vSlot
      ? pl + s.h / 2
      : pl + T + bandH + (s.h - 2 * T - bandH) / 2;
  const vThroat =
    pg.throat != null
      ? pg.throat
      : Math.round(((sub.size >= 18 ? 66 : 54) / (2 * (s.h - 2 * T))) * 100) / 100;
  // a single side duct pushes the driver into the middle of the remaining baffle
  const drvX = sides.length === 1 && vSlot ? (-sides[0] * (vThroat + 0.43 + T)) / 2 : 0;
  const holes = [circlePath(drvX, drvAbsY - baffleCy, drvR)];
  if (tubes)
    tubes.tubes.forEach((p) => holes.push(circlePath(p.x, pl + T + p.y - baffleCy, portR)));
  if (vSlot) {
    // full-height ducts using the side walls as their outer face
    const slotH = s.h - 2 * T;
    const throat = vThroat;
    const mouth = throat + 0.43; // flat strip set at 20 deg: 0.43 in rise
    const sx = innerW / 2 - mouth / 2;
    sides.forEach((k) =>
      holes.push(roundedRectPath(k * sx, pl + s.h / 2 - baffleCy, mouth, slotH, 0.12)),
    );
  }
  if (tower)
    holes.push(
      ...towerBaffleHoles(ctx, { box: s, plinth: pl, mid: tower.mid, horn: tower.horn, baffleCy }),
    );
  const subZ = buildCabinet(ctx, {
    dims: { w: s.w, h: s.h + extH, d: s.d },
    baffleHoles: holes,
    y: pl,
    archTop,
    baffleBottom: bandH,
    parent: subGroup,
  }).baffleZ;
  if (tower) buildTowerPartitions(ctx, { box: s, plinth: pl, parent: subGroup });
  if (bracing) buildBraces(ctx, { bracing, box: s, y: pl, parent: subGroup });
  if (hardware) buildHardware(ctx, { plan: hardware, box: s, y: pl, parent: subGroup });
  if (keepOut)
    buildDriverBody(ctx, {
      keepOut,
      box: s,
      y: pl,
      parent: subGroup,
      clearance: DRIVER_CLEARANCE_IN,
    });
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
    for (let k = -1; k <= 1; k++)
      band.holes.push(roundedRectPath(k * (ductW + T), -T / 2, ductW, ductH, 0.25));
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
    const e = modelTubeElbows(s, portStyle, tubeVent, T, sub);
    const legs = subTubeLegs(s, portStyle, tubeVent, T, sub, e);
    const RB = TUBE_FLARE_RADIUS_IN,
      seg = 10,
      bend = Math.min(portR * 1.5, legs.run / 2, legs.rise / 2); // the elbows' centerline radius
    const prof: THREE.Vector2[] = [];
    for (let i = 0; i <= seg; i++) {
      const t = (i / seg) * (Math.PI / 2);
      prof.push(new THREE.Vector2(portR + RB * (1 - Math.cos(t)), RB * Math.sin(t)));
    }
    // a straight length of tube from a to b (centerline points)
    const pipe = (a: THREE.Vector3, b: THREE.Vector3) => {
      const len = a.distanceTo(b);
      if (len < 1e-3) return;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(portR, portR, len, 32, 1, true), portMat);
      m.position.copy(a).add(b).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      m.name = VENT_MESH_NAME;
      subGroup.add(m);
    };
    // a quarter-torus elbow about `c`, its arc from local +X to +Y laid on the world axes `ax`, `ay`
    const elbow = (c: THREE.Vector3, ax: THREE.Vector3, ay: THREE.Vector3) => {
      const m = new THREE.Mesh(new THREE.TorusGeometry(bend, portR, 16, 12, Math.PI / 2), portMat);
      m.setRotationFromMatrix(new THREE.Matrix4().makeBasis(ax, ay, ax.clone().cross(ay)));
      m.position.copy(c);
      m.name = VENT_MESH_NAME;
      subGroup.add(m);
    };
    // a quarter-round flare at a mouth, opening along `dir`
    const bell = (at: THREE.Vector3, dir: THREE.Vector3) => {
      const m = new THREE.Mesh(new THREE.LatheGeometry(prof, 32), portMat);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      m.position.copy(at);
      m.name = VENT_MESH_NAME;
      subGroup.add(m);
    };
    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    tubes.tubes.forEach((p) => {
      const x = p.x,
        y = pl + T + p.y,
        zc = subZ - legs.run; // the first corner, behind the baffle face
      bell(V(x, y, subZ), V(0, 0, 1));
      if (e === 0) {
        pipe(V(x, y, subZ), V(x, y, zc));
        bell(V(x, y, zc), V(0, 0, -1));
        return;
      }
      pipe(V(x, y, subZ), V(x, y, zc + bend));
      elbow(V(x, y + bend, zc + bend), V(0, -1, 0), V(0, 0, -1));
      const top = y + legs.rise;
      if (e === 1) {
        pipe(V(x, y + bend, zc), V(x, top, zc));
        bell(V(x, top, zc), V(0, 1, 0));
        return;
      }
      pipe(V(x, y + bend, zc), V(x, top - bend, zc));
      elbow(V(x, top - bend, zc + bend), V(0, 0, -1), V(0, 1, 0));
      pipe(V(x, top, zc + bend), V(x, top, zc + legs.back));
      bell(V(x, top, zc + legs.back), V(0, 0, 1));
    });
  }
  buildCone(ctx, { r: drvR, y: drvAbsY, z: subZ, x: drvX, parent: subGroup });
  // duct structure inside: top shelf, two fins (slot version only)
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
    [-1, 1].forEach((k) => {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(T, ductH, roofLen), plyIn);
      fin.position.set((k * (ductW + T)) / 2, pl + T + ductH / 2, roofZ);
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
    [-1, 1].forEach((k) => {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(T, ductH, finLen), plyIn);
      fin.position.set((k * (ductW + T)) / 2, pl + T + ductH / 2, s.d / 2 - finLen / 2);
      fin.name = VENT_MESH_NAME;
      subGroup.add(fin);
    });
  }
  return { top: pl + s.h, baffleZ: subZ, group: subGroup };
}
