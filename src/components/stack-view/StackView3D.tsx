import * as THREE from "three";
import { cabinetFinishOf } from "../../lib/data";
import {
  roundedRectShape,
  roundedRectPath,
  circlePath,
  archOutlinePath,
  rectangularHornGeometry,
  createScaleFigure,
} from "./geometry";
import { useEffect, useRef, useState } from "react";
import type {
  Dims3,
  Horn,
  MidDriver,
  PaLayout,
  PaPortGeometry,
  PortStyle,
  SubDriver,
} from "../../types";

export interface Props {
  sub: SubDriver & { box: Dims3 };
  mid: MidDriver & { box: Dims3 };
  horn: Horn;
  plinth: number;
  cutaway: boolean;
  portStyle: PortStyle;
  layout: PaLayout;
  baffleColor: string;
  /** explicit vent geometry when the cabinet is custom */
  portGeom?: Partial<PaPortGeometry>;
  wall?: number;
  inset?: number;
  /** a `FinishId` or a paint colour (hex) */
  cabFinish?: string;
  spacerH?: number;
}

/** Builds the PA stack as a Group (no DOM or WebGL needed); the units are the props' inches. */
export function buildStackScene({
  sub,
  mid,
  horn,
  plinth,
  cutaway,
  portStyle,
  layout,
  baffleColor,
  portGeom,
  wall = 0.75,
  inset = 0.75,
  cabFinish = "birch",
  spacerH = 20,
}: Props): THREE.Group {
  // cabinet finish: clear birch, walnut veneer, or paint (a hex colour)
  const finish = cabinetFinishOf(cabFinish);
  const birch = new THREE.MeshStandardMaterial({
    color: finish ? finish.color : new THREE.Color(cabFinish),
    roughness: finish ? finish.rough : 0.8,
  });
  const black = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.9 });
  const cream = new THREE.MeshStandardMaterial({ color: 0xece4c8, roughness: 0.55 });
  const painted = new THREE.MeshStandardMaterial({
    color: new THREE.Color(baffleColor),
    roughness: 0.9,
  });
  const ghost = new THREE.MeshStandardMaterial({
    color: 0xd7b98a,
    roughness: 0.9,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const shellMat = cutaway ? ghost : birch;
  // duct fins, shelves and cut edges follow the cabinet finish, a shade darker
  const plyIn = new THREE.MeshStandardMaterial({
    color: finish ? finish.inner : new THREE.Color(cabFinish).multiplyScalar(0.88),
    roughness: 0.9,
  });
  const portMat = new THREE.MeshStandardMaterial({
    color: 0x8a7458,
    roughness: 0.95,
    side: THREE.DoubleSide,
  });
  const baffleMat = cutaway
    ? new THREE.MeshStandardMaterial({
        color: new THREE.Color(baffleColor),
        roughness: 0.9,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    : painted;

  const group = new THREE.Group();

  // cabinet: four perimeter panels (wall ply) with 1/4" roundovers front and back,
  // 3/4" baffle set back by the inset on cleats, painted. Returns the z of the baffle face.
  const T = wall,
    BT = 0.75,
    REVEAL = inset,
    RO = 0.25;
  const cabinet = (
    w: number,
    h: number,
    d: number,
    y: number,
    holes: THREE.Path[] | undefined,
    baffleBottom = 0,
    x = 0,
    parent = group,
  ) => {
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
    const frame = new THREE.Mesh(geo, shellMat);
    frame.position.set(x, y + h / 2, -d / 2 + RO);
    parent.add(frame);
    const bshape = roundedRectShape(iw, ih, 0.12);
    (holes || []).forEach((hp) => bshape.holes.push(hp));
    const baffle = new THREE.Mesh(
      new THREE.ExtrudeGeometry(bshape, { depth: BT, bevelEnabled: false }),
      [baffleMat, cutaway ? baffleMat : plyIn], // caps painted, cut edges left as bare ply
    );
    baffle.position.set(x, y + T + baffleBottom + ih / 2, d / 2 - REVEAL - BT);
    parent.add(baffle);
    const back = new THREE.Mesh(new THREE.BoxGeometry(iw, h - 2 * T, T), shellMat);
    back.position.set(x, y + h / 2, -d / 2 + T / 2);
    parent.add(back);
    return d / 2 - REVEAL;
  };
  // Same construction with a semicircular top the full width of the cabinet.
  // Holes use the same baffle-centered coordinates as cabinet().
  const archCabinet = (
    w: number,
    h: number,
    d: number,
    y: number,
    holes: THREE.Path[] | undefined,
    baffleBottom = 0,
    x = 0,
    parent = group,
  ) => {
    const R = w / 2,
      acy = h / 2 - R; // arch center, frame-centered coords
    const shape = archOutlinePath(new THREE.Shape(), R, -h / 2, acy, R);
    shape.holes.push(
      archOutlinePath(
        // geometry.ts types the argument as a Shape, but only calls Path methods on it; the hole is a Path
        new THREE.Path() as THREE.Shape,
        R - T + RO,
        -h / 2 + T - RO,
        acy,
        R - T + RO,
      ),
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
      shellMat,
    );
    frame.position.set(x, y + h / 2, -d / 2 + RO);
    parent.add(frame);
    const ih = h - 2 * T - baffleBottom,
      bcy = y + T + baffleBottom + ih / 2;
    const bshape = archOutlinePath(new THREE.Shape(), R - T, -ih / 2, y + h - R - bcy, R - T);
    (holes || []).forEach((hp) => bshape.holes.push(hp));
    const baffle = new THREE.Mesh(
      new THREE.ExtrudeGeometry(bshape, { depth: BT, bevelEnabled: false, curveSegments: 48 }),
      [baffleMat, cutaway ? baffleMat : plyIn],
    );
    baffle.position.set(x, bcy, d / 2 - REVEAL - BT);
    parent.add(baffle);
    const bk = archOutlinePath(new THREE.Shape(), R - T, -h / 2 + T, acy, R - T);
    const back = new THREE.Mesh(
      new THREE.ExtrudeGeometry(bk, { depth: T, bevelEnabled: false, curveSegments: 48 }),
      shellMat,
    );
    back.position.set(x, y + h / 2, -d / 2);
    parent.add(back);
    return d / 2 - REVEAL;
  };
  const cone = (r: number, y: number, z: number, x = 0, parent = group) => {
    if (cutaway) return;
    // membrane: a filled disc just behind the baffle face
    const disc = new THREE.Mesh(new THREE.CircleGeometry(r * 0.99, 48), black);
    disc.position.set(x, y, z - 0.3);
    parent.add(disc);
    // shallow cone from the surround down to the dust cap
    const c = new THREE.Mesh(new THREE.ConeGeometry(r * 0.9, r * 0.22, 48, 1, true), black);
    c.rotation.x = -Math.PI / 2;
    c.position.set(x, y, z - 0.3 - r * 0.11);
    parent.add(c);
    const surround = new THREE.Mesh(new THREE.TorusGeometry(r * 0.93, r * 0.055, 12, 48), black);
    surround.position.set(x, y, z - 0.18);
    parent.add(surround);
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(r * 0.26, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      black,
    );
    cap.scale.set(1, 0.45, 1);
    cap.rotation.x = Math.PI / 2;
    cap.position.set(x, y, z - 0.42);
    parent.add(cap);
  };

  const subGroup = new THREE.Group();
  group.add(subGroup);
  // plinth / toe-kick, inset so the column appears to float
  const vSlot = portStyle === "vslots" || portStyle === "vslot1";
  const sides = portStyle === "vslot1" ? [1] : [-1, 1]; // side ducts: one wall or both
  const s = sub.box;
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
  const round = !["slots", "folded", "vslots", "vslot1"].includes(portStyle); // round-tube ports only
  const corners = portStyle === "round4";
  const nPorts = pg.nPorts != null ? pg.nPorts : portStyle === "round1" ? 1 : corners ? 4 : 2;
  const portR =
    pg.portR != null
      ? pg.portR
      : (portStyle === "round1" ? 8 : corners ? (sub.size >= 18 ? 4 : 3.5) : 5) / 2;
  const bandH = round || vSlot ? 0 : ductH + T; // slots: baffle starts above the duct shelf
  // Tower: one shell and one continuous baffle; sections are divided internally.
  const towerMode = layout === "tower";
  const TW_MID = 15.5;
  const archTop = towerMode && !!horn.profile && !horn.scaleX && s.w / 2 - T > horn.size.w / 2;
  // arched: horn centered on the arch, equal margin below and around it
  const twHsH = archTop ? s.w / 2 - T + s.w / 2 : horn.size.h + 2;
  const extH = towerMode ? TW_MID + twHsH : 0;
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
  if (towerMode) {
    holes.push(circlePath(0, pl + s.h + TW_MID / 2 - baffleCy, mid.size / 2 - 0.9));
    const hy =
      (archTop ? pl + s.h + TW_MID + (s.w / 2 - T) : pl + s.h + TW_MID + twHsH / 2) - baffleCy;
    holes.push(
      horn.rect
        ? roundedRectPath(0, hy, innerW - 1, horn.size.h, 1.2)
        : horn.profile
          ? circlePath(0, hy, Math.min(horn.size.w, horn.size.h) / 2 - 0.2)
          : roundedRectPath(0, hy, horn.size.w, horn.size.h, 1),
    );
  }
  const subZ = (archTop ? archCabinet : cabinet)(
    s.w,
    s.h + extH,
    s.d,
    pl,
    holes,
    bandH,
    0,
    subGroup,
  );
  if (towerMode) {
    // internal partitions: sub/mid floor, mid/horn floor, and the mid chamber's back wall
    const zF = s.d / 2 - REVEAL - BT,
      zB = -s.d / 2 + T,
      dep = zF - zB;
    [pl + s.h - T / 2, pl + s.h + TW_MID - T / 2].forEach((py) => {
      const pp = new THREE.Mesh(new THREE.BoxGeometry(innerW, T, dep), plyIn);
      pp.position.set(0, py, (zF + zB) / 2);
      subGroup.add(pp);
    });
  }
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
  cone(drvR, drvAbsY, subZ, drvX, subGroup);
  // duct structure inside: top shelf, two fins (slot version only)
  const wantLen = pg.tubeLen != null ? pg.tubeLen : s.d - T - 3;
  const ductLen = Math.max(2, Math.min(wantLen, s.d - T - ductH)); // from the frame face back, open gap behind
  if (portStyle === "folded") {
    // floor leg to a rear channel, then up the back wall; open at the top of the rear channel
    const bz = -s.d / 2 + T; // inside face of the back panel
    const wallZ = bz + ductH + T / 2; // rear channel's front wall
    const roofLen = s.d / 2 - (wallZ + T / 2);
    const roofZ = s.d / 2 - roofLen / 2;
    const roof = new THREE.Mesh(new THREE.BoxGeometry(innerW, T, roofLen), plyIn);
    roof.position.set(0, pl + T + ductH + T / 2, roofZ);
    subGroup.add(roof);
    [-1, 1].forEach((k) => {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(T, ductH, roofLen), plyIn);
      fin.position.set((k * (ductW + T)) / 2, pl + T + ductH / 2, roofZ);
      subGroup.add(fin);
    });
    // the rear channel rises until the centerline adds up to the set duct length
    // The wall starts at the floor leg's roof, so the floor leg runs on under it into the
    // rear channel, turns, and rises between this wall and the back panel.
    const floorRun = roofLen + T + ductH / 2;
    const wallBot = pl + T + ductH;
    const wallTop = Math.min(
      pl + s.h - T - 1,
      Math.max(wallBot + 1, pl + T + ductH / 2 + (wantLen - floorRun)),
    );
    const wallH = wallTop - wallBot;
    const rw = new THREE.Mesh(new THREE.BoxGeometry(innerW, wallH, T), plyIn);
    rw.position.set(0, wallBot + wallH / 2, wallZ);
    subGroup.add(rw);
  }
  if (portStyle === "slots") {
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
  // mid cube: on the sub, or on round columns either side of it
  const tower = layout === "tower";
  // Tower: one enclosure per side. The mid chamber and horn section share the
  // sub's footprint and sit directly on it, so the three read as one cabinet.
  const m = tower ? { w: s.w, h: 15.5, d: s.d } : mid.box;
  const gap = 0.4;
  const sat = layout === "satellite";
  const pole = layout === "pole";
  const COL_D = 8,
    COL_H = 34; // column diameter and height
  const satX = s.w / 2 + COL_D / 2 + 6; // columns clear of the sub
  const subTop = pl + s.h;
  const POLE_RISE = spacerH; // exposed spacer above the sub top
  const midBaseY = sat ? COL_H : pole ? subTop + POLE_RISE : tower ? subTop : subTop + gap;
  const midXs = sat ? [-satX, satX] : [0];
  if (pole) {
    // Three-post spacer: 6 in discs top and bottom, three 1.25 in posts on a
    // 4 in circle, 35 mm spigots into the cabinets at each end.
    const DR = 3,
      DT = 1,
      PR = 0.625,
      PCIRC = 2,
      SPIG = 0.69;
    const yBot = subTop,
      yTop = subTop + POLE_RISE;
    [yBot + DT / 2, yTop - DT / 2].forEach((y) => {
      const d = new THREE.Mesh(new THREE.CylinderGeometry(DR, DR, DT, 44), birch); // cabinet finish
      d.position.set(0, y, 0);
      subGroup.add(d);
    });
    const postLen = POLE_RISE - 2 * DT;
    for (let i = 0; i < 3; i++) {
      const a = (i * 2 * Math.PI) / 3 + Math.PI / 6;
      const p = new THREE.Mesh(new THREE.CylinderGeometry(PR, PR, postLen, 28), birch);
      p.position.set(PCIRC * Math.cos(a), yBot + DT + postLen / 2, PCIRC * Math.sin(a));
      subGroup.add(p);
      // threaded rod up the middle of each post, visible in cutaway
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, POLE_RISE, 12), black);
      rod.position.set(PCIRC * Math.cos(a), yBot + POLE_RISE / 2, PCIRC * Math.sin(a));
      subGroup.add(rod);
    }
    // spigots buried in each cabinet
    [
      [yBot - 1.25, 2.5],
      [yTop + 1.25, 2.5],
    ].forEach(([y, len]) => {
      const sp = new THREE.Mesh(new THREE.CylinderGeometry(SPIG, SPIG, len, 20), black);
      sp.position.set(0, y, 0);
      subGroup.add(sp);
    });
  }
  if (sat) {
    midXs.forEach((x) => {
      const col = new THREE.Mesh(
        new THREE.CylinderGeometry(COL_D / 2, COL_D / 2, COL_H, 40),
        birch,
      );
      col.position.set(x, COL_H / 2, 0);
      group.add(col);
      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(COL_D / 2 + 1, COL_D / 2 + 1, 1, 40),
        birch,
      );
      cap.position.set(x, COL_H + 0.5, 0);
      group.add(cap);
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(COL_D / 2 + 2.5, COL_D / 2 + 2.5, 1.5, 40),
        birch,
      );
      base.position.set(x, 0.75, 0);
      group.add(base);
    });
  }
  let midZ = 0;
  midXs.forEach((x) => {
    midZ = tower
      ? subZ
      : cabinet(m.w, m.h, m.d, midBaseY, [circlePath(0, 0, mid.size / 2 - 0.9)], 0, x);
    cone(mid.size / 2 - 0.9, midBaseY + m.h / 2, midZ, x);
  });

  // horn
  const hz = horn.size;
  const hornY = midBaseY + m.h;
  // in the tower the horn sits on the sub's footprint: centre height, and the mouth flush with the shared baffle face
  const towerHorn = tower
    ? { cy: archTop ? hornY + (s.w / 2 - T) : hornY + (hz.h + 2) / 2, z: subZ - hz.d + 0.2 }
    : null;
  if (!horn.profile && !horn.rect && !tower) {
    const stand = new THREE.Mesh(new THREE.BoxGeometry(hz.w * 0.5, 1.2, hz.d * 0.5), black);
    stand.position.set(midXs[0], hornY + 0.6, 0);
    group.add(stand);
  }
  midXs.forEach((hx) => {
    if (horn.rect) {
      const mw = tower ? innerW - 1 : m.w;
      const rm = new THREE.Mesh(
        rectangularHornGeometry(mw, hz.h, hz.d),
        new THREE.MeshStandardMaterial({
          color: 0xece4c8,
          roughness: 0.55,
          side: THREE.DoubleSide,
        }),
      );
      rm.position.set(
        hx,
        towerHorn ? towerHorn.cy : hornY + hz.h / 2 + 0.3,
        towerHorn ? towerHorn.z : m.d / 2 - hz.d + 1,
      );
      group.add(rm);
      const th = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.6, 4, 32), black);
      th.rotation.x = Math.PI / 2;
      th.position.set(hx, rm.position.y, rm.position.z - 2);
      group.add(th);
    } else if (horn.profile) {
      const sc = horn.scale || 1;
      const pts = horn.profile.map(([r, x]) => new THREE.Vector2(r * sc, x * sc));
      const lathe = new THREE.LatheGeometry(pts, 96);
      const lm = new THREE.Mesh(
        lathe,
        new THREE.MeshStandardMaterial({
          color: 0xece4c8,
          roughness: 0.55,
          side: THREE.DoubleSide,
        }),
      );
      lm.rotation.x = Math.PI / 2; // lathe axis (y) -> z, mouth toward +z
      if (horn.scaleX || horn.scaleY || horn.scaleZ)
        lm.scale.set(horn.scaleX || 1, horn.scaleZ || 1, horn.scaleY || 1); // local x=width, y=depth, z=height
      lm.position.set(
        hx,
        towerHorn ? towerHorn.cy : hornY + hz.h / 2 + 0.3,
        towerHorn ? towerHorn.z : m.d / 2 - hz.d + 1,
      );
      group.add(lm);
      const th = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.6, 4, 32), black);
      th.rotation.x = Math.PI / 2;
      th.position.set(hx, lm.position.y, towerHorn ? towerHorn.z - 2 : -2.2);
      group.add(th);
    } else {
      const hornShape = new THREE.Shape();
      const rw = hz.w / 2,
        rh = hz.h / 2,
        r = Math.min(rw, rh) * 0.5;
      hornShape.moveTo(-rw + r, -rh);
      hornShape.lineTo(rw - r, -rh);
      hornShape.quadraticCurveTo(rw, -rh, rw, -rh + r);
      hornShape.lineTo(rw, rh - r);
      hornShape.quadraticCurveTo(rw, rh, rw - r, rh);
      hornShape.lineTo(-rw + r, rh);
      hornShape.quadraticCurveTo(-rw, rh, -rw, rh - r);
      hornShape.lineTo(-rw, -rh + r);
      hornShape.quadraticCurveTo(-rw, -rh, -rw + r, -rh);
      const hornGeo = new THREE.ExtrudeGeometry(hornShape, {
        depth: hz.d,
        bevelEnabled: true,
        bevelSize: 1.6,
        bevelThickness: 1.2,
        bevelSegments: 6,
      });
      const hornMesh = new THREE.Mesh(hornGeo, cream);
      hornMesh.position.set(
        hx,
        towerHorn ? towerHorn.cy : hornY + 1.2 + rh + 1,
        towerHorn ? towerHorn.z : -hz.d / 2 + 2,
      );
      group.add(hornMesh);
      const throat = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.6, 4, 32), black);
      throat.rotation.x = Math.PI / 2;
      throat.position.set(hx, hornMesh.position.y, towerHorn ? towerHorn.z - 2.5 : -hz.d / 2 - 0.5);
      group.add(throat);
    }
  });

  // 5 ft 9 in scale figure, billboarded
  const figure = createScaleFigure(69);
  figure.name = "scale-figure";
  figure.position.set(-s.w * 1.4, 0, 3);
  group.add(figure);
  return group;
}

/** Rotatable 3D view of the PA stack. */
export function StackView3D({
  sub,
  mid,
  horn,
  plinth,
  cutaway,
  portStyle,
  layout,
  baffleColor,
  portGeom,
  wall = 0.75,
  inset = 0.75,
  cabFinish = "birch",
  spacerH = 20,
}: Props) {
  const mount = useRef<HTMLDivElement>(null);
  const state = useRef<{
    rotY: number;
    rotX: number;
    drag: boolean;
    lx: number;
    ly: number;
    zoom: number;
  }>({ rotY: 0.6, rotX: 0.35, drag: false, lx: 0, ly: 0, zoom: 1 });
  // Rebuild the scene only when the geometry actually changes (the parent recreates these objects every
  // render), and at most every 120 ms while a slider is dragged, so the controls stay responsive.
  const geoKey = JSON.stringify([
    sub,
    mid,
    horn,
    plinth,
    cutaway,
    portStyle,
    layout,
    baffleColor,
    portGeom,
    wall,
    inset,
    cabFinish,
    spacerH,
  ]);
  const [builtKey, setBuiltKey] = useState(geoKey);
  const lastBuild = useRef(0);
  useEffect(() => {
    if (geoKey === builtKey) return;
    const wait = Math.max(0, 120 - (performance.now() - lastBuild.current));
    const pending = setTimeout(() => {
      lastBuild.current = performance.now();
      setBuiltKey(geoKey);
    }, wait);
    return () => clearTimeout(pending);
  }, [geoKey, builtKey]);

  useEffect(() => {
    const el = mount.current;
    if (!el) return;
    const W = el.clientWidth || 640,
      H = el.clientHeight || 560;
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(32, W / H, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    el.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x777766, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 0.6);
    key.position.set(40, 80, 30);
    scene.add(key);

    const group = buildStackScene({
      sub,
      mid,
      horn,
      plinth,
      cutaway,
      portStyle,
      layout,
      baffleColor,
      portGeom,
      wall,
      inset,
      cabFinish,
      spacerH,
    });
    scene.add(group);

    // floor
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 1 }),
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);
    scene.add(new THREE.GridHelper(120, 10, 0xdddddd, 0xeaeaea));

    group.position.y = 0;

    // Frame from the real bounding box so nothing is cropped at any aspect
    // ratio. The horizontal radius is taken as the diagonal of the footprint
    // so the fit holds through a full rotation rather than only head-on.
    const bbox = new THREE.Box3().setFromObject(group);
    const bc = bbox.getCenter(new THREE.Vector3());
    const bs = bbox.getSize(new THREE.Vector3());
    const target = new THREE.Vector3(bc.x, bc.y, bc.z);
    const halfH = bs.y / 2;
    const halfW = Math.sqrt(bs.x * bs.x + bs.z * bs.z) / 2;
    const tanV = Math.tan((cam.fov * Math.PI) / 360);
    let baseDist = halfH / tanV;
    const fit = (aspect: number) => {
      baseDist = Math.max(halfH / tanV, halfW / (aspect * tanV)) * 1.18;
    };
    fit(W / H);

    const st = state.current;

    // Pointer handling. touch-action on the canvas is pan-y, so a mostly
    // vertical swipe scrolls the page and anything else reaches us here.
    const pts = new Map<number, { x: number; y: number }>();
    let pinch0 = 0,
      zoom0 = 1;

    const onDown = (e: PointerEvent) => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try {
        el.setPointerCapture(e.pointerId);
      } catch (err) {
        /* not capturable */
      }
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinch0 = Math.hypot(a.x - b.x, a.y - b.y);
        zoom0 = st.zoom;
      }
      st.drag = true;
      st.lx = e.clientX;
      st.ly = e.clientY;
    };

    const onMove = (e: PointerEvent) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size >= 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch0 > 0) st.zoom = Math.max(0.45, Math.min(2.2, zoom0 * (pinch0 / d)));
        return; // pinching, not rotating
      }
      if (!st.drag) return;
      st.rotY += (e.clientX - st.lx) * 0.01;
      st.rotX = Math.max(0.05, Math.min(1.2, st.rotX + (e.clientY - st.ly) * 0.006));
      st.lx = e.clientX;
      st.ly = e.clientY;
    };

    const onUp = (e: PointerEvent) => {
      pts.delete(e.pointerId);
      try {
        el.releasePointerCapture(e.pointerId);
      } catch (err) {
        /* already gone */
      }
      if (pts.size < 2) pinch0 = 0;
      if (pts.size === 0) st.drag = false;
      else {
        const p = [...pts.values()][0];
        st.lx = p.x;
        st.ly = p.y;
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      st.zoom = Math.max(0.45, Math.min(2.2, st.zoom * (1 + e.deltaY * 0.0012)));
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("wheel", onWheel, { passive: false });

    // Keep the canvas and the framing correct through rotation and resize.
    const resize = () => {
      const w = el.clientWidth || W,
        h = el.clientHeight || H;
      if (!w || !h) return;
      renderer.setSize(w, h);
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
      fit(w / h);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    window.addEventListener("orientationchange", resize);

    const figure = group.getObjectByName("scale-figure");
    let raf: number;
    const tick = () => {
      const dist = baseDist * st.zoom;
      cam.position.set(
        target.x + dist * Math.sin(st.rotY) * Math.cos(st.rotX),
        target.y + dist * Math.sin(st.rotX),
        target.z + dist * Math.cos(st.rotY) * Math.cos(st.rotX),
      );
      cam.lookAt(target);
      if (figure) figure.quaternion.copy(cam.quaternion);
      renderer.render(scene, cam);
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("orientationchange", resize);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("wheel", onWheel);
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, [builtKey]);

  return <div ref={mount} className="w-full h-full cursor-grab" />;
}
