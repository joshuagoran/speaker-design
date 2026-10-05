import * as THREE from "three";
import { roundedRectShape, roundedRectPath, circlePath } from "./geometry";
import { buildCabinet } from "./buildCabinet";
import { buildCone } from "./buildCone";
import { towerBaffleHoles, buildTowerPartitions } from "./towerParts";
import { towerSpec } from "./stackHeights";
import {
  foldedRearWallIn,
  foldedShelfIn,
  isRoundPort,
  maxStraightSlotIn,
  slotFolds,
} from "../../lib/pa/calc";
import type { SceneContext } from "./sceneContext";
import type { Props } from "./buildStackScene";
import type { Dims3, Horn, MidDriver, PortStyle, SubDriver } from "../../types";

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
  }: {
    sub: Pick<SubDriver, "size">;
    box: Dims3;
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
  const bandH = round || vSlot ? 0 : ductH + T; // slots: baffle starts above the duct shelf
  // Tower: one shell and one continuous baffle; sections are divided internally.
  const { archTop, extH } = tower ? towerSpec(s, T, tower.horn) : { archTop: false, extH: 0 };
  const baffleH = s.h + extH - 2 * T - bandH;
  const baffleCy = pl + T + bandH + baffleH / 2; // absolute center of the baffle
  // centered when symmetric; bottom slots: centered in the baffle above the duct (sub section only in a tower)
  const drvAbsY =
    corners || vSlot
      ? pl + s.h / 2
      : !round
        ? pl + T + bandH + (s.h - 2 * T - bandH) / 2
        : pl + s.h - T - innerW / 2;
  const vThroat =
    pg.throat != null
      ? pg.throat
      : Math.round(((sub.size >= 18 ? 66 : 54) / (2 * (s.h - 2 * T))) * 100) / 100;
  // a single side duct pushes the driver into the middle of the remaining baffle
  const drvX = sides.length === 1 && vSlot ? (-sides[0] * (vThroat + 0.43 + T)) / 2 : 0;
  const holes = [circlePath(drvX, drvAbsY - baffleCy, drvR)];
  let portCy = 0;
  if (round) {
    // 8" sits low on the baffle; 5" pair centered 10" up
    portCy = corners
      ? 0
      : (portStyle === "round1" ? pl + T + portR + 0.75 + 1 : pl + 10) - baffleCy;
    if (corners) {
      const off = innerW / 2 - portR - 0.75 - 0.4;
      [-1, 1].forEach((kx) =>
        [-1, 1].forEach((ky) => holes.push(circlePath(kx * off, ky * off, portR))),
      );
    } else if (nPorts === 1) holes.push(circlePath(0, portCy, portR));
    else [-1, 1].forEach((k) => holes.push(circlePath(k * (portR + 2.6), portCy, portR)));
  }
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
      subGroup.add(wall);

      // two 1/2 in dividers per duct, bracing the inner wall to the side wall
      [-1, 1].forEach((f) => {
        const div = new THREE.Mesh(new THREE.BoxGeometry(throat, 0.5, sideLen), plyIn);
        div.position.set(k * (innerW / 2 - throat / 2), yc + (f * slotH) / 6, zr + sideLen / 2);
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
  } else {
    // flared tubes behind the baffle: bell, straight section, inner bell
    const tubeLen =
      pg.tubeLen != null ? pg.tubeLen : portStyle === "round1" ? 11 : corners ? 11.5 : 9.8;
    const off = innerW / 2 - portR - 0.75 - 0.4;
    const spots = corners
      ? [
          [-off, -off],
          [off, -off],
          [-off, off],
          [off, off],
        ].map(([a, b]) => [a, pl + s.h / 2 + b])
      : (nPorts === 1 ? [0] : [-(portR + 2.6), portR + 2.6]).map((a) => [a, baffleCy + portCy]);
    spots.forEach(([x, yy]) => {
      const tube = new THREE.Mesh(
        new THREE.CylinderGeometry(portR, portR, tubeLen, 32, 1, true),
        portMat,
      );
      tube.rotation.x = Math.PI / 2;
      tube.position.set(x, yy, subZ - tubeLen / 2); // starts at the baffle face, runs back
      subGroup.add(tube);
      // quarter-round flares, tangent to the tube at the throat
      const RB = 0.75,
        seg = 10;
      const prof: THREE.Vector2[] = [];
      for (let i = 0; i <= seg; i++) {
        const t = (i / seg) * (Math.PI / 2);
        prof.push(new THREE.Vector2(portR + RB * (1 - Math.cos(t)), RB * Math.sin(t)));
      }
      [
        [subZ, 1],
        [subZ - tubeLen, -1],
      ].forEach(([z, dir]) => {
        const bell = new THREE.Mesh(new THREE.LatheGeometry(prof, 32), portMat);
        bell.rotation.x = dir > 0 ? Math.PI / 2 : -Math.PI / 2; // opens away from the tube at each end
        bell.position.set(x, yy, z);
        subGroup.add(bell);
      });
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
    subGroup.add(roof);
    [-1, 1].forEach((k) => {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(T, ductH, roofLen), plyIn);
      fin.position.set((k * (ductW + T)) / 2, pl + T + ductH / 2, roofZ);
      subGroup.add(fin);
    });
    // the rear channel rises until the centerline adds up to the set duct length (the cutlist's rear wall), never
    // closer than a slot height under the lid. The wall starts at the floor leg's roof, so the floor leg runs on under
    // it into the rear channel, turns, and rises between this wall and the back panel.
    const wallBot = pl + T + ductH;
    const wallH = foldedRearWallIn(s, { slotH: ductH, len: wantLen }, T);
    const rw = new THREE.Mesh(new THREE.BoxGeometry(innerW, wallH, T), plyIn);
    rw.position.set(0, wallBot + wallH / 2, wallZ);
    subGroup.add(rw);
  } else if (portStyle === "slots") {
    const ductZ = s.d / 2 - ductLen / 2;
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(innerW, T, ductLen), plyIn);
    shelf.position.set(0, pl + T + ductH + T / 2, ductZ);
    subGroup.add(shelf);
    [-1, 1].forEach((k) => {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(T, ductH, ductLen), plyIn);
      fin.position.set((k * (ductW + T)) / 2, pl + T + ductH / 2, ductZ);
      subGroup.add(fin);
    });
  }
  return { top: pl + s.h, baffleZ: subZ, group: subGroup };
}
