const { useEffect, useRef, useState } = React;
import { subChips, midChips, hornChips, fillChips } from "./chips.js";
import { optimize, evaluate as evaluateConfig, roomNeed, ROOMS, GOALS, optFields } from "./optimize.js";
import { SUB_OPTIONS, MID_OPTIONS, MID_BOXES, CD_OPTIONS, HORN_OPTIONS, RACKS, SWATCHES, CAB_FINISHES, CABINETS, FORMATS, FILL_OPTIONS, HIFI_WOOFERS, HIFI_TWEETERS } from "./data.js";
import { hifiSystem, hifiChips, responseAt, dispersionMap, logFreqs, lr, PLACES as HIFI_PLACES } from "./hifi.js";
import { hifiOptimize, HIFI_GOALS, HIFI_LOCK_KEYS, HIFI_AMP_MAX } from "./hifi-optimize.js";
import { subSystem, maxCurve as maxCurveOf, hornResponse, pistonBeam, keeleF, hornBeam, subWeight, midWeight, HP_TYPES, lr24lp, SHEETS, f8, tName, cutParts, packSheets, midSystem, fillSystem, subThroughLp, nearest, subMusicAt } from "./calc.js";



// ---------------------------------------------------------------
// 3D view
// ---------------------------------------------------------------
function StackView({ sub, mid, horn, plinth, cutaway, portStyle, layout, baffleColor, portGeom, wall = 0.75, inset = 0.75, cabFinish = "birch", spacerH = 20 }) {
  const mount = useRef(null);
  const state = useRef({ rotY: 0.6, rotX: 0.35, drag: false, lx: 0, ly: 0 });
  // Rebuild the scene only when the geometry actually changes (the parent recreates these objects every
  // render), and at most every 120 ms while a slider is dragged, so the controls stay responsive.
  const geoKey = JSON.stringify([sub, mid, horn, plinth, cutaway, portStyle, layout, baffleColor, portGeom, wall, inset, cabFinish, spacerH]);
  const [builtKey, setBuiltKey] = useState(geoKey);
  const lastBuild = useRef(0), pending = useRef(null);
  useEffect(() => {
    if (geoKey === builtKey) return;
    const wait = Math.max(0, 120 - (performance.now() - lastBuild.current));
    pending.current = setTimeout(() => { lastBuild.current = performance.now(); setBuiltKey(geoKey); }, wait);
    return () => clearTimeout(pending.current);
  }, [geoKey, builtKey]);

  useEffect(() => {
    const el = mount.current;
    const W = el.clientWidth || 640, H = el.clientHeight || 560;
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

    // cabinet finish: clear birch, walnut veneer, or paint (a hex colour)
    const finish = CAB_FINISHES[cabFinish];
    const birch = new THREE.MeshStandardMaterial({ color: finish ? finish.color : new THREE.Color(cabFinish), roughness: finish ? finish.rough : 0.8 });
    const black = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.9 });
    const cream = new THREE.MeshStandardMaterial({ color: 0xece4c8, roughness: 0.55 });
    const painted = new THREE.MeshStandardMaterial({ color: new THREE.Color(baffleColor), roughness: 0.9 });
    const ghost = new THREE.MeshStandardMaterial({ color: 0xd7b98a, roughness: 0.9, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide });
    const shellMat = cutaway ? ghost : birch;
    // duct fins, shelves and cut edges follow the cabinet finish, a shade darker
    const plyIn = new THREE.MeshStandardMaterial({ color: finish ? finish.inner : new THREE.Color(cabFinish).multiplyScalar(0.88), roughness: 0.9 });
    const portMat = new THREE.MeshStandardMaterial({ color: 0x8a7458, roughness: 0.95, side: THREE.DoubleSide });
    const baffleMat = cutaway ? new THREE.MeshStandardMaterial({ color: new THREE.Color(baffleColor), roughness: 0.9, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }) : painted;

    const group = new THREE.Group();
    scene.add(group);

    // cabinet: four perimeter panels (wall ply) with 1/4" roundovers front and back,
    // 3/4" baffle set back by the inset on cleats, painted. Returns the z of the baffle face.
    const T = wall, BT = 0.75, REVEAL = inset, RO = 0.25;
    const rr = (w, h, r) => {
      const x = w / 2, y = h / 2, sh = new THREE.Shape();
      sh.moveTo(-x + r, -y);
      sh.lineTo(x - r, -y); sh.quadraticCurveTo(x, -y, x, -y + r);
      sh.lineTo(x, y - r); sh.quadraticCurveTo(x, y, x - r, y);
      sh.lineTo(-x + r, y); sh.quadraticCurveTo(-x, y, -x, y - r);
      sh.lineTo(-x, -y + r); sh.quadraticCurveTo(-x, -y, -x + r, -y);
      return sh;
    };
    const rectPath = (cx, cy, w, h, r) => {
      const x = w / 2, y = h / 2, p = new THREE.Path();
      p.moveTo(cx - x + r, cy - y);
      p.lineTo(cx + x - r, cy - y); p.quadraticCurveTo(cx + x, cy - y, cx + x, cy - y + r);
      p.lineTo(cx + x, cy + y - r); p.quadraticCurveTo(cx + x, cy + y, cx + x - r, cy + y);
      p.lineTo(cx - x + r, cy + y); p.quadraticCurveTo(cx - x, cy + y, cx - x, cy + y - r);
      p.lineTo(cx - x, cy - y + r); p.quadraticCurveTo(cx - x, cy - y, cx - x + r, cy - y);
      return p;
    };
    const circPath = (cx, cy, r) => { const p = new THREE.Path(); p.absarc(cx, cy, r, 0, Math.PI * 2, true); return p; };
    const cabinet = (w, h, d, y, holes, baffleBottom = 0, x = 0, parent = group) => {
      const iw = w - 2 * T, ih = h - 2 * T - baffleBottom;
      const shape = rr(w, h, RO * 1.5);
      shape.holes.push(rr(iw + 2 * RO, h - 2 * T + 2 * RO, 0.12));
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: d - 2 * RO, bevelEnabled: true, bevelSize: RO, bevelThickness: RO, bevelSegments: 4,
      });
      const frame = new THREE.Mesh(geo, shellMat);
      frame.position.set(x, y + h / 2, -d / 2 + RO);
      parent.add(frame);
      const bshape = rr(iw, ih, 0.12);
      (holes || []).forEach((hp) => bshape.holes.push(hp));
      const baffle = new THREE.Mesh(
        new THREE.ExtrudeGeometry(bshape, { depth: BT, bevelEnabled: false }),
        [baffleMat, cutaway ? baffleMat : plyIn] // caps painted, cut edges left as bare ply
      );
      baffle.position.set(x, y + T + baffleBottom + ih / 2, d / 2 - REVEAL - BT);
      parent.add(baffle);
      const back = new THREE.Mesh(new THREE.BoxGeometry(iw, h - 2 * T, T), shellMat);
      back.position.set(x, y + h / 2, -d / 2 + T / 2);
      parent.add(back);
      return d / 2 - REVEAL;
    };
    // Same construction with a semicircular top the full width of the cabinet.
    // Holes use the same baffle-centred coordinates as cabinet().
    const archOutline = (P, hw, yb, acy, r) => {
      P.moveTo(-hw, yb); P.lineTo(hw, yb); P.lineTo(hw, acy);
      P.absarc(0, acy, r, 0, Math.PI, false); P.lineTo(-hw, yb);
      return P;
    };
    const archCabinet = (w, h, d, y, holes, baffleBottom = 0, x = 0, parent = group) => {
      const R = w / 2, acy = h / 2 - R;                  // arch centre, frame-centred coords
      const shape = archOutline(new THREE.Shape(), R, -h / 2, acy, R);
      shape.holes.push(archOutline(new THREE.Path(), R - T + RO, -h / 2 + T - RO, acy, R - T + RO));
      const frame = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, {
        depth: d - 2 * RO, bevelEnabled: true, bevelSize: RO, bevelThickness: RO, bevelSegments: 4,
        curveSegments: 48 }), shellMat);
      frame.position.set(x, y + h / 2, -d / 2 + RO);
      parent.add(frame);
      const ih = h - 2 * T - baffleBottom, bcy = y + T + baffleBottom + ih / 2;
      const bshape = archOutline(new THREE.Shape(), R - T, -ih / 2, (y + h - R) - bcy, R - T);
      (holes || []).forEach((hp) => bshape.holes.push(hp));
      const baffle = new THREE.Mesh(
        new THREE.ExtrudeGeometry(bshape, { depth: BT, bevelEnabled: false, curveSegments: 48 }),
        [baffleMat, cutaway ? baffleMat : plyIn]);
      baffle.position.set(x, bcy, d / 2 - REVEAL - BT);
      parent.add(baffle);
      const bk = archOutline(new THREE.Shape(), R - T, -h / 2 + T, acy, R - T);
      const back = new THREE.Mesh(new THREE.ExtrudeGeometry(bk, { depth: T, bevelEnabled: false, curveSegments: 48 }), shellMat);
      back.position.set(x, y + h / 2, -d / 2);
      parent.add(back);
      return d / 2 - REVEAL;
    };
    const cone = (r, y, z, x = 0, parent = group) => {
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
      const cap = new THREE.Mesh(new THREE.SphereGeometry(r * 0.26, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), black);
      cap.scale.set(1, 0.45, 1);
      cap.rotation.x = Math.PI / 2;
      cap.position.set(x, y, z - 0.42);
      parent.add(cap);
    };

    const subGroup = new THREE.Group();
    group.add(subGroup);
    // plinth / toe-kick, inset so the column appears to float
    const vSlot = portStyle === "vslots" || portStyle === "vslot1";
    const sides = portStyle === "vslot1" ? [1] : [-1, 1];   // side ducts: one wall or both
    const s = sub.box;
    const pg = portGeom || {};   // explicit vent geometry when the cabinet is custom
    const pl = plinth || 0;
    if (pl > 0) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(s.w - 3, pl, s.d - 3), birch);
      p.position.set(0, pl / 2, 0);
      subGroup.add(p);
    }
    // sub column: driver cutout high on the baffle, three duct cutouts across the bottom
    const ductH = pg.ductH != null ? pg.ductH : 3, innerW = s.w - 2 * T, ductW = (innerW - 2 * T) / 3;
    const drvR = sub.size / 2 - 0.9;
    const round = !["slots", "folded", "vslots", "vslot1"].includes(portStyle); // round-tube ports only
    const corners = portStyle === "round4";
    const nPorts = pg.nPorts != null ? pg.nPorts : (portStyle === "round1" ? 1 : corners ? 4 : 2);
    const portR = pg.portR != null ? pg.portR : (portStyle === "round1" ? 8 : corners ? (sub.size >= 18 ? 4 : 3.5) : 5) / 2;
    const bandH = round || vSlot ? 0 : ductH + T;           // slots: baffle starts above the duct shelf
    // Tower: one shell and one continuous baffle; sections are divided internally.
    const towerMode = layout === "tower";
    const TW_MID = 15.5;
    const archTop = towerMode && !!horn.profile && !horn.scaleX && s.w / 2 - T > horn.size.w / 2;
    // arched: horn centred on the arch, equal margin below and around it
    const twHsH = archTop ? (s.w / 2 - T) + s.w / 2 : horn.size.h + 2;
    const extH = towerMode ? TW_MID + twHsH : 0;
    const baffleH = s.h + extH - 2 * T - bandH;
    const baffleCy = pl + T + bandH + baffleH / 2; // absolute centre of the baffle
    // centred when symmetric; bottom slots: centred in the baffle above the duct (sub section only in a tower)
    const drvAbsY = corners || vSlot ? pl + s.h / 2
      : !round ? pl + T + bandH + (s.h - 2 * T - bandH) / 2
      : pl + s.h - T - innerW / 2;
    const vThroat = pg.throat != null ? pg.throat : Math.round(((sub.size >= 18 ? 66 : 54) / (2 * (s.h - 2 * T))) * 100) / 100;
    // a single side duct pushes the driver into the middle of the remaining baffle
    const drvX = sides.length === 1 && vSlot ? -sides[0] * (vThroat + 0.43 + T) / 2 : 0;
    const holes = [circPath(drvX, drvAbsY - baffleCy, drvR)];
    let portCy = 0;
    if (round) {
      // 8" sits low on the baffle; 5" pair centred 10" up
      portCy = corners ? 0 : (portStyle === "round1" ? pl + T + portR + 0.75 + 1 : pl + 10) - baffleCy;
      if (corners) {
        const off = innerW / 2 - portR - 0.75 - 0.4;
        [-1, 1].forEach((kx) => [-1, 1].forEach((ky) => holes.push(circPath(kx * off, ky * off, portR))));
      } else if (nPorts === 1) holes.push(circPath(0, portCy, portR));
      else [-1, 1].forEach((k) => holes.push(circPath(k * (portR + 2.6), portCy, portR)));
    }
    if (vSlot) {
      // full-height ducts using the side walls as their outer face
      const slotH = s.h - 2 * T;
      const throat = vThroat;
      const mouth = throat + 0.43;                 // flat strip set at 20 deg: 0.43 in rise
      const sx = innerW / 2 - mouth / 2;
      sides.forEach((k) => holes.push(rectPath(k * sx, pl + s.h / 2 - baffleCy, mouth, slotH, 0.12)));
    }
    if (towerMode) {
      holes.push(circPath(0, pl + s.h + TW_MID / 2 - baffleCy, (mid.size || 12) / 2 - 0.9));
      const hy = (archTop ? pl + s.h + TW_MID + (s.w / 2 - T) : pl + s.h + TW_MID + twHsH / 2) - baffleCy;
      holes.push(horn.rect ? rectPath(0, hy, innerW - 1, horn.size.h, 1.2)
        : horn.profile ? circPath(0, hy, Math.min(horn.size.w, horn.size.h) / 2 - 0.2)
        : rectPath(0, hy, horn.size.w, horn.size.h, 1));
    }
    const subZ = (archTop ? archCabinet : cabinet)(s.w, s.h + extH, s.d, pl, holes, bandH, 0, subGroup);
    if (towerMode) {
      // internal partitions: sub/mid floor, mid/horn floor, and the mid chamber's back wall
      const zF = s.d / 2 - REVEAL - BT, zB = -s.d / 2 + T, dep = zF - zB;
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
      const FL = 0.43 / Math.tan((20 * Math.PI) / 180);   // 1.18 in along the duct
      const yc = pl + s.h / 2;
      const zf = s.d / 2;                                  // duct mouth, flush with the frame face
      const zb = -s.d / 2 + T;                             // inside face of the back panel
      // rear end of the duct: the set duct length back from the mouth, leaving at least a
      // throat-width gap to the back panel
      const zr = Math.max(zb + throat, zf - (pg.tubeLen != null ? pg.tubeLen : zf - zb));
      const sideLen = zf - zr;

      sides.forEach((k) => {
        const xo = k * (innerW / 2);                       // inside face of the side wall
        const xT = xo - k * throat;                        // duct face at the throat
        const xM = xo - k * mouth;                         // duct face at a flared end
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
          new THREE.ExtrudeGeometry(sh, { depth: slotH, bevelEnabled: false }), plyIn);
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
      const band = rr(innerW, bandH, 0.12);
      for (let k = -1; k <= 1; k++) band.holes.push(rectPath(k * (ductW + T), -T / 2, ductW, ductH, 0.25));
      if (REVEAL > 0) {
        const nose = new THREE.Mesh(new THREE.ExtrudeGeometry(band, { depth: REVEAL, bevelEnabled: false }), shellMat);
        nose.position.set(0, pl + T + bandH / 2, s.d / 2 - REVEAL);
        subGroup.add(nose);
      }
    } else {
      // flared tubes behind the baffle: bell, straight section, inner bell
      const tubeLen = pg.tubeLen != null ? pg.tubeLen : (portStyle === "round1" ? 11 : corners ? 11.5 : 9.8);
      const off = innerW / 2 - portR - 0.75 - 0.4;
      const spots = corners
        ? [[-off, -off], [off, -off], [-off, off], [off, off]].map(([a, b]) => [a, pl + s.h / 2 + b])
        : (nPorts === 1 ? [0] : [-(portR + 2.6), portR + 2.6]).map((a) => [a, baffleCy + portCy]);
      spots.forEach(([x, yy]) => {
        const tube = new THREE.Mesh(new THREE.CylinderGeometry(portR, portR, tubeLen, 32, 1, true), portMat);
        tube.rotation.x = Math.PI / 2;
        tube.position.set(x, yy, subZ - tubeLen / 2); // starts at the baffle face, runs back
        subGroup.add(tube);
        // quarter-round flares, tangent to the tube at the throat
        const RB = 0.75, seg = 10;
        const prof = [];
        for (let i = 0; i <= seg; i++) {
          const t = (i / seg) * (Math.PI / 2);
          prof.push(new THREE.Vector2(portR + RB * (1 - Math.cos(t)), RB * Math.sin(t)));
        }
        [[subZ, 1], [subZ - tubeLen, -1]].forEach(([z, dir]) => {
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
      const bz = -s.d / 2 + T;                          // inside face of the back panel
      const wallZ = bz + ductH + T / 2;                 // rear channel's front wall
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
      // the rear channel rises until the centreline adds up to the set duct length
      // The wall starts at the floor leg's roof, so the floor leg runs on under it into the
      // rear channel, turns, and rises between this wall and the back panel.
      const floorRun = roofLen + T + ductH / 2;
      const wallBot = pl + T + ductH;
      const wallTop = Math.min(pl + s.h - T - 1, Math.max(wallBot + 1, pl + T + ductH / 2 + (wantLen - floorRun)));
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
    const COL_D = 8, COL_H = 34;                       // column diameter and height
    const satX = s.w / 2 + COL_D / 2 + 6;              // columns clear of the sub
    const subTop = pl + s.h;
    const POLE_RISE = spacerH;                         // exposed spacer above the sub top
    const midBaseY = sat ? COL_H : pole ? subTop + POLE_RISE : tower ? subTop : subTop + gap;
    const midXs = sat ? [-satX, satX] : [0];
    if (pole) {
      // Three-post spacer: 6 in discs top and bottom, three 1.25 in posts on a
      // 4 in circle, 35 mm spigots into the cabinets at each end.
      const DR = 3, DT = 1, PR = 0.625, PCIRC = 2, SPIG = 0.69;
      const yBot = subTop, yTop = subTop + POLE_RISE;
      [yBot + DT / 2, yTop - DT / 2].forEach((y) => {
        const d = new THREE.Mesh(new THREE.CylinderGeometry(DR, DR, DT, 44), birch);   // cabinet finish
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
      [[yBot - 1.25, 2.5], [yTop + 1.25, 2.5]].forEach(([y, len]) => {
        const sp = new THREE.Mesh(new THREE.CylinderGeometry(SPIG, SPIG, len, 20), black);
        sp.position.set(0, y, 0);
        subGroup.add(sp);
      });
    }
    if (sat) {
      midXs.forEach((x) => {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(COL_D / 2, COL_D / 2, COL_H, 40), birch);
        col.position.set(x, COL_H / 2, 0);
        group.add(col);
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(COL_D / 2 + 1, COL_D / 2 + 1, 1, 40), birch);
        cap.position.set(x, COL_H + 0.5, 0);
        group.add(cap);
        const base = new THREE.Mesh(new THREE.CylinderGeometry(COL_D / 2 + 2.5, COL_D / 2 + 2.5, 1.5, 40), birch);
        base.position.set(x, 0.75, 0);
        group.add(base);
      });
    }
    let midZ = 0;
    midXs.forEach((x) => {
      midZ = tower ? subZ : cabinet(m.w, m.h, m.d, midBaseY, [circPath(0, 0, (mid.size || 12) / 2 - 0.9)], 0, x);
      cone((mid.size || 12) / 2 - 0.9, midBaseY + m.h / 2, midZ, x);
    });

    // horn
    const hz = horn.size;
    const hornY = midBaseY + m.h;
    let hornCY = null, hornZ = null;
    if (tower) {
      hornCY = archTop ? hornY + (s.w / 2 - T) : hornY + (hz.h + 2) / 2;
      hornZ = subZ - hz.d + 0.2;            // mouth flush with the shared baffle face
    }
    if (!horn.profile && !horn.rect && !tower) {
      const stand = new THREE.Mesh(new THREE.BoxGeometry(hz.w * 0.5, 1.2, hz.d * 0.5), black);
      stand.position.set(midXs[0], hornY + 0.6, 0);
      group.add(stand);
    }
    const rectHornGeo = (mw, mh, depth, tr = 0.5) => {
      const NS = 40, NP = 112, pos = [], idx = [];
      for (let i = 0; i <= NS; i++) {
        const t = i / NS, g = Math.pow(t, 1.7);
        const a = tr + (mw / 2 - tr) * g, b = tr + (mh / 2 - tr) * g;
        const n = 2 + 7 * Math.pow(t, 1.4);          // superellipse exponent: circle -> squarish
        for (let j = 0; j < NP; j++) {
          const th = (j / NP) * Math.PI * 2, c = Math.cos(th), sn = Math.sin(th);
          pos.push(a * Math.sign(c) * Math.pow(Math.abs(c), 2 / n),
                   b * Math.sign(sn) * Math.pow(Math.abs(sn), 2 / n), depth * t);
        }
      }
      for (let i = 0; i < NS; i++) for (let j = 0; j < NP; j++) {
        const a0 = i * NP + j, a1 = i * NP + ((j + 1) % NP);
        idx.push(a0, a0 + NP, a1, a1, a0 + NP, a1 + NP);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      geo.setIndex(idx); geo.computeVertexNormals();
      return geo;
    };
    midXs.forEach((hx) => {
    if (horn.rect) {
      const mw = tower ? innerW - 1 : m.w;
      const rm = new THREE.Mesh(rectHornGeo(mw, hz.h, hz.d),
        new THREE.MeshStandardMaterial({ color: 0xece4c8, roughness: 0.55, side: THREE.DoubleSide }));
      rm.position.set(hx, tower ? hornCY : hornY + hz.h / 2 + 0.3, tower ? hornZ : m.d / 2 - hz.d + 1);
      group.add(rm);
      const th = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.6, 4, 32), black);
      th.rotation.x = Math.PI / 2; th.position.set(hx, rm.position.y, rm.position.z - 2); group.add(th);
    } else if (horn.profile) {
      const sc = horn.scale || 1;
      const pts = horn.profile.map(([r, x]) => new THREE.Vector2(r * sc, x * sc));
      const lathe = new THREE.LatheGeometry(pts, 96);
      const lm = new THREE.Mesh(lathe, new THREE.MeshStandardMaterial({ color: 0xece4c8, roughness: 0.55, side: THREE.DoubleSide }));
      lm.rotation.x = Math.PI / 2; // lathe axis (y) -> z, mouth toward +z
      if (horn.scaleX || horn.scaleY || horn.scaleZ) lm.scale.set(horn.scaleX || 1, horn.scaleZ || 1, horn.scaleY || 1); // local x=width, y=depth, z=height
      lm.position.set(hx, tower ? hornCY : hornY + hz.h / 2 + 0.3, tower ? hornZ : m.d / 2 - hz.d + 1);
      group.add(lm);
      const th = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.6, 4, 32), black);
      th.rotation.x = Math.PI / 2; th.position.set(hx, lm.position.y, tower ? hornZ - 2 : -2.2); group.add(th);
    } else {
    const hornShape = new THREE.Shape();
    const rw = hz.w / 2, rh = hz.h / 2, r = Math.min(rw, rh) * 0.5;
    hornShape.moveTo(-rw + r, -rh);
    hornShape.lineTo(rw - r, -rh); hornShape.quadraticCurveTo(rw, -rh, rw, -rh + r);
    hornShape.lineTo(rw, rh - r); hornShape.quadraticCurveTo(rw, rh, rw - r, rh);
    hornShape.lineTo(-rw + r, rh); hornShape.quadraticCurveTo(-rw, rh, -rw, rh - r);
    hornShape.lineTo(-rw, -rh + r); hornShape.quadraticCurveTo(-rw, -rh, -rw + r, -rh);
    const hornGeo = new THREE.ExtrudeGeometry(hornShape, { depth: hz.d, bevelEnabled: true, bevelSize: 1.6, bevelThickness: 1.2, bevelSegments: 6 });
    const hornMesh = new THREE.Mesh(hornGeo, cream);
    hornMesh.position.set(hx, tower ? hornCY : hornY + 1.2 + rh + 1, tower ? hornZ : -hz.d / 2 + 2);
    group.add(hornMesh);
    const throat = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.6, 4, 32), black);
    throat.rotation.x = Math.PI / 2;
    throat.position.set(hx, hornMesh.position.y, tower ? hornZ - 2.5 : -hz.d / 2 - 0.5);
    group.add(throat);
    }
    });

    // 5 ft 9 in scale figure: standard pictogram silhouette, billboarded
    const figure = (() => {
      const H = 69, u = H / 100;
      const g = new THREE.Group();
      const mat = new THREE.MeshBasicMaterial({ color: 0x8b847d, transparent: true, opacity: 0.38, side: THREE.DoubleSide });
      const body = new THREE.Shape();
      const P = [
        [6.5, 85], [10.0, 82], [11.0, 70], [8.0, 50], [6.5, 30], [5.5, 1],
        [1.0, 1], [0, 40], [-1.0, 1], [-5.5, 1], [-6.5, 30], [-8.0, 50],
        [-11.0, 70], [-10.0, 82], [-6.5, 85],
      ];
      body.moveTo(P[0][0] * u, P[0][1] * u);
      P.slice(1).forEach(([x, y]) => body.lineTo(x * u, y * u));
      body.closePath();
      g.add(new THREE.Mesh(new THREE.ShapeGeometry(body), mat));
      const head = new THREE.Shape();
      head.absarc(0, 92.5 * u, 6 * u, 0, Math.PI * 2, false);
      g.add(new THREE.Mesh(new THREE.ShapeGeometry(head), mat));
      g.position.set(-s.w * 1.4, 0, 3);
      group.add(g);
      return g;
    })();

    // floor
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 1 }));
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
    const fit = (aspect) => {
      baseDist = Math.max(halfH / tanV, halfW / (aspect * tanV)) * 1.18;
    };
    fit(W / H);

    const st = state.current;
    if (st.zoom == null) st.zoom = 1;

    // Pointer handling. touch-action on the canvas is pan-y, so a mostly
    // vertical swipe scrolls the page and anything else reaches us here.
    const pts = new Map();
    let pinch0 = 0, zoom0 = 1;

    const onDown = (e) => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* not capturable */ }
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinch0 = Math.hypot(a.x - b.x, a.y - b.y);
        zoom0 = st.zoom;
      }
      st.drag = true; st.lx = e.clientX; st.ly = e.clientY;
    };

    const onMove = (e) => {
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
      st.lx = e.clientX; st.ly = e.clientY;
    };

    const onUp = (e) => {
      pts.delete(e.pointerId);
      try { el.releasePointerCapture(e.pointerId); } catch (err) { /* already gone */ }
      if (pts.size < 2) pinch0 = 0;
      if (pts.size === 0) st.drag = false;
      else { const p = [...pts.values()][0]; st.lx = p.x; st.ly = p.y; }
    };

    const onWheel = (e) => {
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
      const w = el.clientWidth || W, h = el.clientHeight || H;
      if (!w || !h) return;
      renderer.setSize(w, h);
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
      fit(w / h);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    window.addEventListener("orientationchange", resize);

    let raf;
    const tick = () => {
      const dist = baseDist * st.zoom;
      cam.position.set(
        target.x + dist * Math.sin(st.rotY) * Math.cos(st.rotX),
        target.y + dist * Math.sin(st.rotX),
        target.z + dist * Math.cos(st.rotY) * Math.cos(st.rotX)
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

function SignalPath() {
  const ink = "#111111", mute = "#707070", line = "#707070";
  const col = { pa2: "#707070", sub: "#0082c8", mid: "#e5007e", hf: "#e5007e", grey: "#707070" };
  const Box = ({ x, y, w, h, c, children }) => (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="6" fill="#ffffff" stroke={c} strokeWidth="1.5" />
      {children}
    </g>
  );
  const T = ({ x, y, s = 11, c = ink, a = "middle", b }) => (
    <text x={x} y={y} fontSize={s} fill={c} textAnchor={a} fontFamily="Inconsolata, monospace" fontWeight={b ? 600 : 400}>{b}</text>
  );
  const A = ({ d, c = line }) => <path d={d} fill="none" stroke={c} strokeWidth="1.3" markerEnd="url(#sp-ar)" />;
  return (
    <svg viewBox="0 0 860 400" width="100%" role="img" aria-label="Mains rack signal path">
      <defs><marker id="sp-ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke={line} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></marker></defs>

      <T x={60} y={22} c={mute} b="Source" /><T x={215} y={22} c={mute} b="Processor" /><T x={415} y={22} c={mute} b="Amps" /><T x={600} y={22} c={mute} b="Rear panel" /><T x={770} y={22} c={mute} b="Stacks" />

      <Box x={15} y={190} w={90} h={52} c={col.grey}><T x={60} y={212} b="DJ mixer" /><T x={60} y={230} s={10} c={mute} b="master L/R" /></Box>
      <A d="M105 216 L150 216" /><T x={127} y={208} s={10} c={mute} b="XLR" />

      <Box x={150} y={110} w={130} h={220} c={col.pa2}>
        <T x={215} y={132} b="dbx DriveRack PA2" /><T x={215} y={148} s={10} c={mute} b="2 in / 6 out" />
        <T x={215} y={176} s={10} c={mute} b="inputs: venue EQ" /><T x={215} y={190} s={10} c={mute} b="outputs: XO, EQ, delay, limit" />
        <T x={272} y={230} s={10} a="end" c={col.sub} b="Sub L / R" /><T x={272} y={270} s={10} a="end" c={col.mid} b="Mid L / R" /><T x={272} y={310} s={10} a="end" c={col.hf} b="Horn L / R" />
      </Box>

      <Box x={350} y={205} w={130} h={44} c={col.sub}><T x={415} y={223} b="QSC GXD8" /><T x={415} y={239} s={10} c={mute} b="800 W/ch @ 8 Ω" /></Box>
      <Box x={350} y={262} w={130} h={44} c={col.mid}><T x={415} y={280} b="QSC GXD4" /><T x={415} y={296} s={10} c={mute} b="400 W/ch @ 8 Ω" /></Box>
      <Box x={350} y={319} w={130} h={44} c={col.hf}><T x={415} y={337} b="QSC GXD4" /><T x={415} y={353} s={10} c={mute} b="gain trimmed · HPF 500 Hz" /></Box>
      <A d="M280 226 L350 226" c={col.sub} /><A d="M280 266 L350 283" c={col.mid} /><A d="M280 306 L350 340" c={col.hf} />

      <Box x={555} y={150} w={90} h={230} c={col.grey}><T x={600} y={170} b="Speakon" /><T x={600} y={184} s={10} c={mute} b="4× NL4MP" /></Box>
      <rect x={565} y={200} width={70} height={22} rx="4" fill="none" stroke={col.sub} /><T x={600} y={215} s={10} c={col.sub} b="SUB L · 1±" />
      <rect x={565} y={228} width={70} height={22} rx="4" fill="none" stroke={col.sub} /><T x={600} y={243} s={10} c={col.sub} b="SUB R · 1±" />
      <rect x={565} y={290} width={70} height={36} rx="4" fill="none" stroke={col.mid} /><T x={600} y={304} s={10} c={col.mid} b="TOP L" /><T x={600} y={318} s={9} c={mute} b="1± mid · 2± horn" />
      <rect x={565} y={332} width={70} height={36} rx="4" fill="none" stroke={col.mid} /><T x={600} y={346} s={10} c={col.mid} b="TOP R" /><T x={600} y={360} s={9} c={mute} b="1± mid · 2± horn" />
      <A d="M480 222 L565 211" c={col.sub} /><A d="M480 232 L565 239" c={col.sub} />
      <A d="M480 278 L565 300" c={col.mid} /><A d="M480 290 L565 342" c={col.mid} />
      <A d="M480 335 L565 318" c={col.hf} /><A d="M480 347 L565 360" c={col.hf} />
      <T x={518} y={196} s={9} c={mute} b="binding posts, 12 AWG" />

      <Box x={690} y={196} w={110} h={26} c={col.sub}><T x={745} y={213} s={10} b="Sub L" /></Box>
      <Box x={690} y={226} w={110} h={26} c={col.sub}><T x={745} y={243} s={10} b="Sub R" /></Box>
      <Box x={690} y={288} w={110} h={40} c={col.mid}><T x={745} y={304} s={10} b="Mid box L" /><T x={745} y={319} s={9} c={mute} b="posts → horn L" /></Box>
      <Box x={690} y={332} w={110} h={40} c={col.mid}><T x={745} y={348} s={10} b="Mid box R" /><T x={745} y={363} s={9} c={mute} b="posts → horn R" /></Box>
      <A d="M645 211 L690 209" /><A d="M645 239 L690 239" /><T x={667} y={202} s={9} c={mute} b="NL2" />
      <A d="M645 308 L690 308" /><A d="M645 352 L690 352" /><T x={667} y={300} s={9} c={mute} b="NL4" />

      <T x={15} y={394} s={10} a="start" c={mute} b="Crossovers in the PA2: sub HPF ~32 Hz BW24 · sub/mid 100–120 Hz LR4 · mid/horn ~1.1 kHz LR4. Amps run full-range; limiters set per driver in each amp." />
    </svg>
  );
}

// ---------------------------------------------------------------
// Page
// ---------------------------------------------------------------
// group: optional (option) => heading; options with the same heading are listed together under it, in order of first appearance
function Pick({ label, options, value, onChange, extra, group }) {
  const opt = (o) => <option key={o.id} value={o.id}>{o.name}{o.price ? ` — $${o.price}` : ""}</option>;
  const groups = group ? [...new Set(options.map(group))] : null;
  return (
    <div className="mb-4">
      <div className="text-sm text-stone-500 mb-1 flex items-center justify-between gap-2"><span>{label}</span>{extra}</div>
      <select
        value={value?.id ?? ""}
        onChange={(e) => onChange(options.find((o) => o.id === e.target.value))}
        className="w-full px-3 py-2 rounded border border-stone-300 bg-white text-sm hover:border-stone-500 focus:outline-none focus:border-stone-900"
      >
        {groups ? groups.map((g) => <optgroup key={g} label={g}>{options.filter((o) => group(o) === g).map(opt)}</optgroup>) : options.map(opt)}
      </select>
    </div>
  );
}

// Width of an element in CSS px, kept current with a ResizeObserver.
function useWidth(fallback) {
  const ref = useRef(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => { const cw = el.clientWidth; if (cw) setW(cw); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

// Max-SPL chart: one or more curves ({f, spl}), fixed 80-135 dB so setups compare directly.
function ResponseChart({ series, marks = [], fmax = 200, fmin = 15, top = 135, bot = 80, step = 5, yLabel = "max dB SPL @ 1 m", H = 300 }) {
  // drawn in real pixels so text stays 11 px at any width
  const [box, cw] = useWidth(760);
  const narrow = cw < 500;
  const W = Math.max(280, cw), L = narrow ? 44 : 52, R = narrow ? 8 : 14, TT = 16, B = 36;
  if (narrow && H >= 300) H = Math.round(H * 0.8);
  const x0 = L, x1 = W - R, y0 = TT, y1 = H - B;
  const TOP = top, BOT = bot;
  const px = (f) => x0 + (Math.log(f / fmin) / Math.log(fmax / fmin)) * (x1 - x0);
  const py = (v) => y1 - ((Math.max(BOT, Math.min(TOP, v)) - BOT) / (TOP - BOT)) * (y1 - y0);
  const paths = series.map((sr) => {
    const pts = sr.curve.filter((o) => o.f >= fmin && o.f <= fmax);
    const d = pts.map((p, i) => (i ? "L" : "M") + px(p.f).toFixed(1) + "," + py(p.spl).toFixed(1)).join("");
    return { ...sr, d, fill: pts.length ? d + `L${px(pts[pts.length - 1].f).toFixed(1)},${y1} L${px(pts[0].f).toFixed(1)},${y1} Z` : "" };
  });
  const ticks = (narrow ? [20, 50, 100, 200, 1000, 5000, 20000] : [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000]).filter((f) => f >= fmin && f <= fmax);
  const grid = [];
  ticks.forEach((f) => {
    const X = px(f);
    grid.push(<line key={"v" + f} x1={X} y1={y0} x2={X} y2={y1} stroke="#e6e6e6" strokeWidth="1" />);
    grid.push(<text key={"vt" + f} x={X} y={y1 + 18} textAnchor={X > x1 - 12 ? "end" : "middle"} fill="#707070" fontSize="11" fontFamily="Inconsolata, monospace">{f >= 1000 ? f / 1000 + "k" : f}</text>);
  });
  // hover / drag: a crosshair with each curve's value at that frequency
  const [hf, setHf] = useState(null);
  const move = (e) => {
    const r = e.currentTarget.getBoundingClientRect(), X = ((e.clientX - r.left) / r.width) * W;
    setHf(X >= x0 && X <= x1 ? fmin * Math.pow(fmax / fmin, (X - x0) / (x1 - x0)) : null);
  };
  const unit = yLabel.includes("°") ? "°" : " dB";
  const hits = hf ? paths.map((p) => {
    const pts = p.curve.filter((o) => o.f >= fmin && o.f <= fmax);
    const o = pts.length ? pts.reduce((b, q) => (Math.abs(Math.log(q.f / hf)) < Math.abs(Math.log(b.f / hf)) ? q : b)) : null;
    return o && Math.abs(Math.log(o.f / hf)) < 0.1 ? { ...p, o } : null;
  }).filter(Boolean) : [];
  const every = ((y1 - y0) * step) / (TOP - BOT) < 16 ? 2 : 1;   // thin the labels when rows get tight
  for (let v = BOT, k = 0; v <= TOP; v += step, k++) {
    const Y = py(v);
    grid.push(<line key={"h" + v} x1={x0} y1={Y} x2={x1} y2={Y} stroke="#e6e6e6" strokeWidth="1" />);
    if (k % every === 0) grid.push(<text key={"ht" + v} x={x0 - 8} y={Y + 3.5} textAnchor="end" fill="#707070" fontSize="11" fontFamily="Inconsolata, monospace">{v}</text>);
  }
  return (
    <div ref={box}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${yLabel} against frequency`} style={{ display: "block", width: "100%", height: "auto", touchAction: "pan-y" }}
        onPointerMove={move} onPointerDown={move} onPointerLeave={() => setHf(null)}>
        {grid}
        {marks.filter((m) => m.f > fmin && m.f < fmax).map((m, i, ms) => (
          <g key={m.label + i}>
            <line x1={px(m.f)} y1={y0} x2={px(m.f)} y2={y1} stroke="#707070" strokeWidth="1" strokeDasharray="3 4" />
            <text x={px(m.f) + 5} y={y0 + 13 + (ms.slice(0, i).some((o) => Math.abs(px(o.f) - px(m.f)) < 70) ? 14 : 0)} fill="#707070" fontSize="10.5" fontFamily="Inconsolata, monospace">{m.label}</text>
          </g>
        ))}
        {paths.map((p) => <path key={p.label + "f"} d={p.fill} fill={p.tint} />)}
        {paths.map((p) => <path key={p.label} d={p.d} fill="none" stroke={p.stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />)}
        {!narrow && paths.map((p, i) => (
          <g key={p.label + "k"}>
            <line x1={x0 + 10} y1={y0 + 8 + i * 16} x2={x0 + 30} y2={y0 + 8 + i * 16} stroke={p.stroke} strokeWidth="2" />
            <text x={x0 + 36} y={y0 + 12 + i * 16} fill="#707070" fontSize="11" fontFamily="Inconsolata, monospace">{p.label}</text>
          </g>
        ))}
        {hf && (<g pointerEvents="none">
          <line x1={px(hf)} x2={px(hf)} y1={y0} y2={y1} stroke="#707070" strokeWidth="1" />
          {hits.map((h) => <circle key={h.label} cx={px(h.o.f)} cy={py(h.o.spl)} r="3.5" fill={h.stroke} stroke="#fff" strokeWidth="1.5" />)}
          {(() => { const t = `${hf >= 1000 ? (hf / 1000).toFixed(hf >= 10000 ? 0 : 1) + "k" : hf.toFixed(0)} Hz`, w = t.length * 6.5 + 8, X = Math.max(x0 + w / 2, Math.min(x1 - w / 2, px(hf)));
            return <g><rect x={X - w / 2} y={y1 + 5} width={w} height={17} rx="3" fill="#111111" /><text x={X} y={y1 + 17.5} textAnchor="middle" fontSize="11" fontFamily="Inconsolata, monospace" fill="#ffffff">{t}</text></g>; })()}
          <text x={x1} y={y0 - 4} textAnchor="end" fontSize="11" fontFamily="Inconsolata, monospace" fill="#111111" stroke="#fff" strokeWidth="3" paintOrder="stroke">
            {hf >= 1000 ? (hf / 1000).toFixed(hf >= 10000 ? 0 : 1) + "k" : hf.toFixed(0)} Hz{hits.map((h) => ` · ${h.label} ${h.o.spl.toFixed(0)}${unit}`).join("")}
          </text>
        </g>)}
        <text x={W / 2} y={H - 4} textAnchor="middle" fill="#707070" fontSize="11" fontFamily="Inconsolata, monospace">frequency, Hz</text>
        <text transform={`translate(13,${(y0 + y1) / 2}) rotate(-90)`} textAnchor="middle" fill="#707070" fontSize="11" fontFamily="Inconsolata, monospace">{yLabel}</text>
      </svg>
      {narrow && paths.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-[11px] text-stone-600" style={{ fontFamily: "var(--font)" }}>
          {paths.map((p) => <span key={p.label} className="flex items-center gap-1.5"><span className="inline-block w-4 h-0.5" style={{ background: p.stroke }} />{p.label}</span>)}
        </div>
      )}
    </div>
  );
}

// Section heading that folds its section on phones (always open from md up).
function FoldHead({ id, title, folds, toggle, className = "" }) {
  return (
    <h2 className={`text-xl ${className} ${folds[id] ? "" : "max-md:mb-0"}`} style={{ fontFamily: "var(--font)", fontWeight: 700 }}>
      <button onClick={() => toggle(id)} aria-expanded={!!folds[id]} className="w-full flex justify-between items-center text-left md:pointer-events-none md:cursor-default">
        <span>{title}</span><span className="md:hidden text-stone-500 text-base" aria-hidden="true">{folds[id] ? "\u2212" : "+"}</span>
      </button>
    </h2>
  );
}

function Slider({ label, value, min, max, step, unit, onChange, extra }) {
  return (
    <div className="mb-3">
      <div className="flex justify-between items-center gap-3 mb-1">
        <span className="flex items-center gap-2"><span className="text-sm text-stone-600">{label}</span>{extra}</span>
        <span className="text-sm tabular-nums font-medium">{typeof value === "number" ? value.toFixed(step < 1 ? 2 : 0) : value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-stone-900" />
    </div>
  );
}

// ---------------------------------------------------------------
// Hi-fi page: 2-way home speakers with an active crossover
// ---------------------------------------------------------------
const FT = 0.3048;
// Level vs angle and frequency, normalised to on-axis (0 dB darkest). Hover or drag to read a cell.
function DispMap({ map, title }) {
  const [hover, setHover] = useState(null);
  const W = 560, H = 240, L = 40, R = 6, T = 6, B = 24;
  const nF = map.freqs.length, nA = map.angles.length;
  const cw = (W - L - R) / nF, ch = (H - T - B) / nA;
  const col = (db) => { const x = Math.max(0, Math.min(1, -db / 18)); const l = 28 + x * 66; return `hsl(201 ${Math.round(100 - x * 70)}% ${l.toFixed(0)}%)`; };
  const fx = (f) => L + (Math.log(f / map.freqs[0]) / Math.log(map.freqs[nF - 1] / map.freqs[0])) * (W - L - R);
  const move = (e) => {
    const r = e.currentTarget.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width) * W, y = ((e.clientY - r.top) / r.height) * H;
    const i = Math.floor((x - L) / cw), j = Math.floor((y - T) / ch);
    setHover(i >= 0 && i < nF && j >= 0 && j < nA ? { i, j } : null);
  };
  const ticksA = map.angles.filter((a) => a % 30 === 0);
  return (
    <div>
      <div className="flex justify-between items-baseline text-xs text-stone-500 mb-1"><span>{title}</span>
        <span className="tabular-nums text-stone-700">{hover ? `${map.angles[hover.j]}° · ${map.freqs[hover.i] >= 1000 ? (map.freqs[hover.i] / 1000).toFixed(1) + "k" : map.freqs[hover.i].toFixed(0)} Hz · ${map.rows[hover.j][hover.i].toFixed(1)} dB` : "dB vs on-axis"}</span></div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" style={{ touchAction: "pan-y" }} onPointerMove={move} onPointerDown={move} onPointerLeave={() => setHover(null)} role="img" aria-label={`${title}: level against angle and frequency`}>
        {map.rows.map((row, j) => row.map((db, i) => <rect key={j * nF + i} x={L + i * cw} y={T + j * ch} width={cw + 0.5} height={ch + 0.5} fill={col(db)} />))}
        {ticksA.map((a) => { const j = map.angles.indexOf(a); return <text key={a} x={L - 5} y={T + (j + 0.5) * ch + 3} fontSize="10" textAnchor="end" fill="#707070">{a}°</text>; })}
        {[200, 500, 1000, 2000, 5000, 10000, 20000].map((f) => <text key={f} x={fx(f)} y={H - 8} fontSize="10" textAnchor="middle" fill="#707070">{f >= 1000 ? f / 1000 + "k" : f}</text>)}
        {hover && <rect x={L + hover.i * cw} y={T + hover.j * ch} width={cw} height={ch} fill="none" stroke="#111111" strokeWidth="1.5" />}
      </svg>
      <div className="flex items-center gap-2 text-[11px] text-stone-500 mt-1">0 dB<span className="h-2 flex-1 max-w-[160px] rounded" style={{ background: `linear-gradient(to right, ${col(0)}, ${col(-9)}, ${col(-18)})` }} />−18 dB</div>
    </div>
  );
}

// Top-down room: the pair and a seat you can drag. Units: feet.
function RoomView({ spacing, toe, seat, setSeat, angles }) {
  const Wd = Math.max(12, spacing + 6), Dp = Math.max(10, seat.y + 3), W = 320, k = W / Wd, H = Dp * k;
  const px = (x) => W / 2 + x * k, py = (y) => 14 + y * k;
  const drag = (e) => {
    if (e.type === "pointermove" && !e.buttons) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W, y = ((e.clientY - r.top) / r.height) * (H + 20);
    setSeat({ x: Math.round(((x - W / 2) / k) * 4) / 4, y: Math.max(2, Math.round(((y - 14) / k) * 4) / 4) });
  };
  const spk = (sx, sign) => {
    return <g key={sign} transform={`translate(${px(sx)},${py(0)}) rotate(${-sign * toe})`}><rect x={-7} y={-6} width={14} height={10} rx="1.5" fill="#111111" /><line x1={0} y1={4} x2={0} y2={4 + 22} stroke="#707070" strokeDasharray="2 2" /></g>;
  };
  return (
    <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full h-auto rounded border border-stone-200 bg-white" style={{ touchAction: "none" }} onPointerDown={drag} onPointerMove={drag} role="img" aria-label="Room seen from above; drag the seat">
      {[-1, 1].map((sg) => <line key={sg} x1={px((sg * spacing) / 2)} y1={py(0)} x2={px(seat.x)} y2={py(seat.y)} stroke="#e6e6e6" />)}
      {spk(-spacing / 2, 1)}{spk(spacing / 2, -1)}
      <circle cx={px(seat.x)} cy={py(seat.y)} r="7" fill="#0082c8" stroke="#fff" strokeWidth="2" />
      <text x={px(-spacing / 2)} y={py(0) + 38} fontSize="10" textAnchor="middle" fill="#707070">{angles[0].toFixed(0)}° off</text>
      <text x={px(spacing / 2)} y={py(0) + 38} fontSize="10" textAnchor="middle" fill="#707070">{angles[1].toFixed(0)}° off</text>
      <text x={6} y={H + 14} fontSize="10" fill="#707070">{Wd.toFixed(0)} ft wide · drag the seat</text>
    </svg>
  );
}

// Front view of the box and drivers, to scale.
function HifiFront({ dim, w, t, lay, vented, port, guide, small }) {
  const k = 120 / Math.max(dim.h, dim.w * 1.2), W = dim.w * k, H = dim.h * k;
  const face = guide ? { w: guide.w, h: guide.h } : t.faceplate || { w: 4, h: 4 };
  return (
    <svg viewBox={`-4 -4 ${W + 8} ${H + 8}`} className={small ? "w-full h-auto max-h-40" : "h-40 w-auto"} role="img" aria-label={`Front view, ${dim.w} × ${dim.h}″`}>
      <rect x={0} y={0} width={W} height={H} rx="2" fill="#e6e6e6" stroke="#111111" strokeWidth="1.2" />
      <rect x={W / 2 - (face.w * k) / 2} y={(dim.h - lay.tweeterIn - face.h / 2) * k} width={face.w * k} height={face.h * k} rx={guide ? 3 : face.w * k / 2} fill="#707070" />
      <circle cx={W / 2} cy={(dim.h - lay.tweeterIn) * k} r={0.5 * k} fill="#e6e6e6" />
      <circle cx={W / 2} cy={(dim.h - lay.wooferIn) * k} r={(w.size * 0.95 * k) / 2} fill="#e6e6e6" stroke="#707070" />
      {vented && Array.from({ length: port.n }, (_, i) => <circle key={i} cx={W / 2 + (i - (port.n - 1) / 2) * (port.dia + 0.6) * k} cy={H - (port.dia / 2 + 1) * k} r={(port.dia * k) / 2} fill="#111111" />)}
    </svg>
  );
}

// every Hi-fi chart shares one fixed dB scale, so designs and charts compare by eye
const HIFI_TOP = 130, HIFI_BOT = 50;
// woofers listed smallest first, grouped by size in the picker
const HIFI_WOOFERS_BY_SIZE = HIFI_WOOFERS.slice().sort((a, b) => a.size - b.size);

// A result card, laid out like the PA optimizer's: what it is, a front view and its bass against yours, the four numbers with deltas.
function HifiCard({ k, i, n, curCurve, guide, previewing, onPreview, onLoad }) {
  const c = k.config, m = k.metrics, d = k.delta || {};
  const cw = HIFI_WOOFERS.find((o) => o.id === k.woofer), ct = HIFI_TWEETERS.find((o) => o.id === k.tweeter);
  const tile = (label, v, delta) => (
    <div className="bg-stone-50 border border-stone-200 rounded px-2 py-1.5">
      <div className="text-[10.5px] uppercase tracking-wider text-stone-500 font-semibold">{label}</div>
      <div className="tabular-nums">{v}</div>{delta}
    </div>
  );
  const who = { Xmax: "cone travel", port: "port air speed", thermal: "the woofer's power rating", amp: "the amp" }[k.whoW] || k.whoW;
  return (
    <div className={`bg-white border rounded-lg p-3.5 flex flex-col gap-2.5 min-w-full md:min-w-0 snap-start ${previewing ? "border-stone-900 ring-1 ring-stone-900" : "border-stone-300"}`}>
      <div className="text-[11px] uppercase tracking-wider font-bold text-stone-600">{k.label} · {i + 1} of {n}</div>
      <h3 className="text-lg leading-snug" style={{ fontFamily: "var(--font)", fontWeight: 700 }}>{cw.size}″ {k.names.woofer} · {c.dim.w} × {c.dim.h} × {c.dim.d}″</h3>
      <div className="grid grid-cols-[2fr_3fr] gap-2 items-end">
        <HifiFront dim={c.dim} w={cw} t={ct} lay={k.lay} vented={c.box === "vented"} port={c.port} guide={k.guided ? guide : null} small />
        <OutChart curve={k.curve} cur={curCurve} fmin={15} fmax={20000} band={null} top={HIFI_TOP} bot={HIFI_BOT} />
      </div>
      <div className="text-xs text-stone-600">{k.names.tweeter} · {c.box}{c.box === "vented" ? ` (${c.port.n} × ${c.port.dia}″ port, ${c.port.len}″${c.port.elbows ? `, ${c.port.elbows} elbow${c.port.elbows > 1 ? "s" : ""}` : ""})` : ""} · {c.wall === 0.5 ? "1/2″" : "3/4″"} · XO {c.xo} Hz · amps {c.wAmpW} / {c.tAmpW} W</div>
      <div className="grid grid-cols-2 gap-1.5">
        {tile("Drivers, pair", money(m.price), <Delta v={d.price} unit="$" lowerIsBetter />)}
        {tile("Weight", `${m.lb.toFixed(0)} lb`, <Delta v={d.lb} unit=" lb" lowerIsBetter digits={1} />)}
        {tile("At the seat", `${m.level.toFixed(1)} dB`, <Delta v={d.level} unit=" dB" digits={1} />)}
        {tile("F3 in room", `${m.f3.toFixed(0)} Hz`, <Delta v={d.f3} unit=" Hz" lowerIsBetter />)}
      </div>
      <div className="text-xs leading-snug"><b className="font-semibold">Limited by:</b> {who}</div>
      {k.warnings.filter((h) => !/^Woofer limited by/.test(h)).map((h) => <div key={h} className="text-xs border border-l-4 rounded px-2 py-1 bg-amber-50 border-amber-200 border-l-amber-300"><b className="font-semibold text-amber-700">{h}</b></div>)}
      <div className="text-xs text-stone-600">Changes: {k.changed.length ? k.changed.join(", ") : "none"}</div>
      <div className="flex gap-1.5 mt-auto">
        <button onClick={onPreview} className="flex-1 px-3 py-2 rounded border text-sm border-stone-300 bg-stone-50 hover:border-stone-500">Preview</button>
        <button onClick={onLoad} className="flex-1 px-3 py-2 rounded border text-sm font-semibold border-cmy-c bg-cmy-c text-white">Load</button>
      </div>
    </div>
  );
}

function HifiPage() {
  const guides = HORN_OPTIONS.filter((h) => h.exit === 1 && h.hf && h.hf.covH && h.size);
  const [w, setW] = useState(HIFI_WOOFERS.find((o) => o.pick) || HIFI_WOOFERS[0]);
  const [t, setT] = useState(HIFI_TWEETERS.find((o) => o.pick) || HIFI_TWEETERS[0]);
  const [guideSel, setGuide] = useState(guides.find((g) => g.id === "st260") || guides[0]);
  const [box, setBox] = useState("vented");
  const [dim, setDim] = useState({ w: 9, h: 15, d: 11 });
  const [wall, setWall] = useState(0.75);
  const [mat, setMat] = useState("ply");
  const [port, setPort] = useState({ n: 1, dia: 2, len: 6 });
  const [xo, setXo] = useState(2000);
  const [order, setOrder] = useState(4);
  const [wAmpW, setWAmpW] = useState(100);
  const [tAmpW, setTAmpW] = useState(50);
  const [bsc, setBsc] = useState(3);
  const [place, setPlace] = useState("free");
  const [wallFt, setWallFt] = useState(2);
  const [spacing, setSpacing] = useState(7);
  const [toe, setToe] = useState(15);
  const [seat, setSeat] = useState({ x: 0, y: 8 });
  const [earIn, setEarIn] = useState(38);
  const [standIn, setStandIn] = useState(24);
  const [plane, setPlane] = useState("h");
  // optimizer: same rules and layout as the PA planner's (switch, locks on the controls, goals in tap order)
  const ls = { get: (k, fb) => { try { const v = localStorage.getItem(k); return v == null ? fb : JSON.parse(v); } catch { return fb; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
  const [hOn, setHOnRaw] = useState(() => ls.get("hifi.opt", false));
  const setHOn = (v) => { setHOnRaw(v); ls.set("hifi.opt", v); };
  const [hGoals, setHGoals] = useState([]);
  const [hBudget, setHBudget] = useState(() => ls.get("hifi.budget", 800));
  const [hLocks, setHLocksRaw] = useState(() => { const l = ls.get("hifi.locks", {}) || {}; return { ...l, dim: { ...(l.dim || {}) } }; });
  const setHLocks = (f) => setHLocksRaw((p) => { const n = f(p); ls.set("hifi.locks", n); return n; });
  const [hRes, setHRes] = useState(null);
  const [hBusy, setHBusy] = useState(false);
  const [hPreview, setHPreview] = useState(null);   // { label, before, card }
  const [hUndo, setHUndo] = useState(null);
  const setD = (k, v) => setDim((p) => ({ ...p, [k]: v }));
  const setP = (k, v) => setPort((p) => ({ ...p, [k]: v }));
  const guide = t.type === "compression" || t.needsWaveguide ? { covH: guideSel.hf.covH, covV: guideSel.hf.covV || guideSel.hf.covH, w: guideSel.size.w, h: guideSel.size.h, name: guideSel.name } : null;
  const cfg = { box, dim, wall, mat, port, xo, order, wAmpW, tAmpW, bsc, place, wallFt, portMax: 17, guide };
  const tt = guide ? { ...t, faceplate: { w: guide.w, h: guide.h } } : t;
  const sys = hifiSystem(w, tt, cfg);
  if (!sys) return <main className="max-w-6xl mx-auto px-4 md:px-8 pb-16 text-sm">This woofer can't be modelled (its parameters aren't published).</main>;
  const F = hifiChips(sys, w, tt, cfg);
  // the seat, relative to each speaker (left at -spacing/2, toed in toward the middle)
  const geoOf = (sign) => {
    const sx = (sign * spacing) / 2, vx = seat.x - sx, vy = seat.y, d = Math.hypot(vx, vy);
    const axis = (-sign * toe * Math.PI) / 180, ang = Math.atan2(vx, vy) - axis;
    return { th: Math.abs(ang), eyeIn: earIn - standIn, distM: d * FT };
  };
  const gL = geoOf(-1), gR = geoOf(1);
  const freqs = logFreqs(15, 20000, 220);
  const rL = responseAt(sys, w, tt, cfg, gL, freqs), rR = responseAt(sys, w, tt, cfg, gR, freqs);
  const on = responseAt(sys, w, tt, cfg, { th: 0, eyeIn: sys.lay.tweeterIn, distM: 1 }, freqs);
  const pair = rL.map((o, i) => ({ f: o.f, spl: 10 * Math.log10(Math.pow(10, o.spl / 10) + Math.pow(10, rR[i].spl / 10)) }));
  const seatDist = (gL.distM + gR.distM) / 2;
  const atSeat = sys.maxLevel - 20 * Math.log10(seatDist) + 3;
  const tMax = freqs.map((f) => ({ f, spl: sys.tLevel + 20 * Math.log10(Math.max(1e-6, Math.hypot(lr(f, xo, order, "hp").re, lr(f, xo, order, "hp").im))) }));
  const map = dispersionMap(sys, w, tt, cfg, plane, Math.max(1, seatDist));
  const pairCost = 2 * ((w.price || 0) + (t.price || 0) + (guide ? guideSel.price || 0 : 0));
  const tile = (k, v, u) => (
    <div key={k} className="bg-stone-50 px-3 py-2.5">
      <div className="text-[10.5px] uppercase tracking-wider text-stone-500 font-semibold">{k}</div>
      <div className="text-xl font-medium tabular-nums mt-0.5 break-words">{v}<span className="text-xs text-stone-500 ml-0.5">{u}</span></div>
    </div>
  );
  const seg = (on) => `px-3 py-1.5 rounded border text-sm ${on ? "border-stone-900 bg-stone-900 text-stone-50" : "border-stone-300 hover:border-stone-500"}`;
  const optSeg = (on) => `px-3 py-2 rounded border text-sm ${on ? "border-stone-900 bg-stone-900 text-stone-50" : "border-stone-300 bg-stone-50 hover:border-stone-500"}`;
  const hLk = (key, what) => (hOn ? <LockBtn on={!!hLocks[key]} what={what} onClick={() => setHLocks((p) => ({ ...p, [key]: !p[key] }))} /> : null);
  const hDl = (dm, what) => (hOn ? <DimLock mode={hLocks.dim[dm] || "free"} what={what} onChange={(m) => setHLocks((p) => ({ ...p, dim: { ...p.dim, [dm]: m } }))} /> : null);
  const snapH = () => ({ woofer: w.id, tweeter: t.id, box, dim, port, wall, xo, wAmpW, tAmpW });
  const applyH = (c) => {
    setW(HIFI_WOOFERS.find((o) => o.id === c.woofer)); setT(HIFI_TWEETERS.find((o) => o.id === c.tweeter));
    setBox(c.box); setDim(c.dim); if (c.port) setPort(c.port); setWall(c.wall); setXo(c.xo); setWAmpW(c.wAmpW); setTAmpW(c.tAmpW);
  };
  const runH = () => {
    setHBusy(true);
    const base = hPreview ? hPreview.before : snapH();
    setTimeout(() => {
      try { setHRes(hifiOptimize({ cur: { ...cfg, ...base }, woofers: HIFI_WOOFERS, tweeters: HIFI_TWEETERS, goals: hGoals, locks: hLocks, budget: hBudget, seatM: seatDist, guidePrice: guideSel.price || 0 })); }
      finally { setHBusy(false); }
    }, 30);
  };
  const previewH = (k) => { const before = hPreview ? hPreview.before : snapH(); applyH(k.config); setHPreview({ label: k.label, before, card: k }); };
  const backH = () => { if (hPreview) applyH(hPreview.before); setHPreview(null); };
  const loadH = (k) => { const before = hPreview ? hPreview.before : snapH(); applyH(k.config); setHPreview(null); setHUndo(before); };
  const tapG = (g) => setHGoals((p) => (p.includes(g) ? p.filter((x) => x !== g) : [...p, g]));
  const nLocks = HIFI_LOCK_KEYS.filter((k) => hLocks[k]).length + Object.values(hLocks.dim).filter((m) => m && m !== "free").length;
  const allLocks = { ...Object.fromEntries(HIFI_LOCK_KEYS.map((k) => [k, true])), dim: { w: "exact", h: "exact", d: "exact" } };
  const optBar = (
    <div className="flex flex-wrap items-center gap-2">
      <button onClick={() => setHOn(!hOn)} aria-pressed={hOn} className={`px-3 py-2 rounded border text-sm ${hOn ? "border-stone-900 bg-stone-900 text-stone-50" : "border-stone-300 bg-stone-50 hover:border-stone-500"}`}>Optimizer: {hOn ? "on" : "off"}</button>
      {hOn && (<>
        <button onClick={() => setHLocks(() => allLocks)} disabled={nLocks >= HIFI_LOCK_KEYS.length + 3} aria-label="Lock everything" title="Lock everything, then unlock what the optimizer may change"
          className="inline-flex items-center gap-1 px-3 py-2 rounded border text-sm border-stone-300 bg-stone-50 hover:border-stone-500 disabled:opacity-40"><LockIcon locked={true} /><span className="text-xs">All</span></button>
        <button onClick={() => setHLocks(() => ({ dim: {} }))} disabled={!nLocks} aria-label={nLocks ? `Clear all ${nLocks} locks` : "No locks set"} title={nLocks ? `Clear all ${nLocks} locks` : "No locks set"}
          className="inline-flex items-center gap-1 px-3 py-2 rounded border text-sm border-stone-300 bg-stone-50 hover:border-stone-500 disabled:opacity-40"><LockIcon locked={false} />{nLocks ? <span className="text-xs">{nLocks}</span> : null}</button>
      </>)}
      {!hOn && <span className="text-xs text-stone-500">Find cheaper, lighter, deeper or louder designs inside your limits.</span>}
    </div>
  );
  const optPanel = hOn && (
    <div className="rounded-lg border border-stone-300 bg-white p-4 mt-3">
      <h2 className="text-xl" style={{ fontFamily: "var(--font)", fontWeight: 700 }}>Find a better design</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
        <div className="mt-3">
          <div className="text-sm text-stone-500 mb-1">Driver budget, pair <span className="text-xs">(woofers + tweeters{guide ? " + waveguides" : ""}, at the listed prices)</span></div>
          <div className="flex flex-wrap items-center gap-2 text-sm"><input type="number" inputMode="numeric" value={hBudget} min={50} step={25} onChange={(e) => { setHBudget(+e.target.value || 0); ls.set("hifi.budget", +e.target.value || 0); }} className="w-24 px-3 py-2 rounded border border-stone-300 bg-white" /> $</div>
        </div>
        <div className="mt-3">
          <div className="text-sm text-stone-500 mb-1">Goal <span className="text-xs">(choose one or more, in priority order)</span></div>
          <div className="flex flex-wrap gap-1">{Object.entries(HIFI_GOALS).map(([k, g]) => { const i = hGoals.indexOf(k); return <button key={k} title={g.name} aria-pressed={i >= 0} className={`relative ${optSeg(i >= 0)}`} onClick={() => tapG(k)}>{hGoals.length > 1 && i >= 0 && <RankBadge n={i + 1} />}{g.short}</button>; })}</div>
        </div>
      </div>
      <div className="mt-2 text-xs text-stone-500">Amps: woofer {hLocks.wAmpW ? `${wAmpW} W` : `any up to ${HIFI_AMP_MAX.wAmpW} W`} · tweeter {hLocks.tAmpW ? `${tAmpW} W` : `any up to ${HIFI_AMP_MAX.tAmpW} W`} (unlocked amps come back at the least power that does the job)</div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button onClick={runH} disabled={hBusy || !hGoals.length} className="px-4 py-2 rounded border text-sm font-semibold border-cmy-c bg-cmy-c text-white disabled:opacity-50">{hBusy ? "Searching…" : hGoals.length ? "Find 3 designs" : "Pick a goal first"}</button>
        {hRes && !hBusy && <span className="text-xs text-stone-500">Searched {hRes.stats.evaluated.toLocaleString()} designs in {(hRes.stats.ms / 1000).toFixed(1)} s{hRes.cards.length ? " · every design shown passes the checks (warnings are listed on the card)" : ""}</span>}
        {hUndo && !hPreview && <button onClick={() => { applyH(hUndo); setHUndo(null); }} className="px-3 py-2 rounded border text-sm border-stone-300 bg-stone-50 hover:border-stone-500">Undo load</button>}
      </div>
      {hRes && !hBusy && hRes.curProblems.length > 0 && <div className="mt-2 text-xs text-amber-800 bg-amber-50 rounded border-l-4 border-amber-300 px-2 py-1">Your design fails: {hRes.curProblems.join("; ")}. Fixes may cost or weigh more.</div>}
      {hRes && !hBusy && hRes.cards.length > 0 && (<>
        <div className="mt-4 flex md:grid md:grid-cols-3 gap-3 overflow-x-auto snap-x snap-mandatory pb-1">
          {hRes.cards.map((k, i) => <HifiCard key={i} k={k} i={i} n={hRes.cards.length} curCurve={hRes.curCurve} guide={guide} previewing={hPreview && hPreview.card === k} onPreview={() => previewH(k)} onLoad={() => loadH(k)} />)}
        </div>
        {hRes.cards.length > 1 && <div className="md:hidden text-xs text-stone-500 text-center mt-1">Swipe for {hRes.cards.length - 1} more</div>}
      </>)}
      {hRes && !hBusy && hRes.goalMissing && <div className="mt-2 text-xs text-amber-800 bg-amber-50 rounded border-l-4 border-amber-300 px-2 py-1">{hRes.goalMissing}</div>}
      {hRes && !hBusy && !hRes.cards.length && !hRes.goalMissing && <div className="mt-3 text-sm text-orange-900">Nothing fits all your limits. A bigger budget or fewer locks would open it up.</div>}
    </div>
  );
  return (
    <main className="max-w-6xl mx-auto px-4 md:px-8 pb-16 grid grid-cols-1 md:grid-cols-5 gap-8" style={{ fontFamily: "var(--font)" }}>
      <div className="md:col-span-5 min-w-0">
        {optBar}
        {optPanel}
        {hPreview && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded bg-stone-900 text-white border-t-4 border-cmy-y px-3 py-2 text-sm font-semibold">
            <span className="flex-1">Previewing “{hPreview.label}”</span>
            <button onClick={() => loadH(hPreview.card)} className="px-3 py-1.5 rounded border border-stone-900 bg-white text-stone-900">Keep</button>
            <button onClick={backH} className="px-3 py-1.5 rounded border border-stone-900 bg-white text-stone-900">Back</button>
          </div>
        )}
      </div>
      <div className="min-w-0 md:col-span-3 flex flex-col gap-4">
        <div className="flex gap-4 items-center">
        <div className="shrink-0"><HifiFront dim={dim} w={w} t={tt} lay={sys.lay} vented={sys.vented} port={port} guide={guide} /></div>
        <div className="flex-1 min-w-0 grid gap-px rounded-lg overflow-hidden border border-stone-300 bg-stone-200 grid-cols-2 sm:grid-cols-3 [&>*:last-child:nth-child(odd)]:col-span-2 sm:[&>*:last-child:nth-child(odd)]:col-span-1">
          {tile("Net volume", sys.net.toFixed(1), "L")}
          {sys.vented ? tile("Tuning Fb", sys.Fb.toFixed(0), "Hz") : tile("Qtc", sys.Qtc.toFixed(2), "")}
          {tile("F3 in room", sys.f3.toFixed(0), "Hz")}
          {tile("Max at the seat", atSeat.toFixed(0), "dB")}
          {tile("Weight", sys.lb.toFixed(0), "lb")}
          {tile("Pair", `$${Math.round(pairCost)}`, "")}
        </div>
        </div>
        <ResponseChart fmin={15} fmax={20000} top={HIFI_TOP} bot={HIFI_BOT} step={10} yLabel="dB SPL at 2.83 V"
          series={[{ curve: on, label: "On axis, 1 m", stroke: "#111111", tint: "rgba(0,0,0,0)" }, { curve: pair, label: `Pair at the seat (${(seatDist / FT).toFixed(1)} ft)`, stroke: "#0082c8", tint: "rgba(0,130,200,0.06)" }]}
          marks={[{ f: xo, label: "XO" }, { f: sys.bsF3, label: "Baffle step" }, ...(sys.Fb ? [{ f: sys.Fb, label: "Fb" }] : [])]} />
        <ResponseChart fmin={15} fmax={20000} top={HIFI_TOP} bot={HIFI_BOT} step={10} yLabel="max dB SPL @ 1 m"
          series={[{ curve: sys.wMax, label: w.name, stroke: "#e5007e", tint: "rgba(229,0,126,0.06)" }, { curve: tMax, label: t.name, stroke: "#0082c8", tint: "rgba(0,130,200,0.06)" }]} marks={[{ f: xo, label: "XO" }]} />
        <div className="flex flex-col gap-1.5">
          {F.map(([kind, head, body]) => (
            <div key={head} className={`block text-xs leading-relaxed px-3 py-2 rounded border ${CHIP_BG[kind] || CHIP_BG.ok}`}>
              <b className={`font-semibold mr-1.5 ${kind === "ok" ? "text-green-800" : kind === "warn" ? "text-amber-700" : "text-red-700"}`}>{head}</b>
              <span className="text-stone-600">{body}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
          <RoomView spacing={spacing} toe={toe} seat={seat} setSeat={setSeat} angles={[(gL.th * 180) / Math.PI, (gR.th * 180) / Math.PI]} />
          <div className="text-sm text-stone-600 leading-relaxed">
            <div className="text-xs uppercase tracking-wider text-stone-500 font-semibold mb-1">At the seat</div>
            {(seatDist / FT).toFixed(1)} ft from the pair; left speaker {((gL.th * 180) / Math.PI).toFixed(0)}° and right {((gR.th * 180) / Math.PI).toFixed(0)}° off axis.<br />
            Ears {earIn - standIn - sys.lay.tweeterIn >= 0 ? "above" : "below"} the tweeter by {Math.abs(earIn - standIn - sys.lay.tweeterIn).toFixed(1)}″.<br />
            Clean up to about {atSeat.toFixed(0)} dB here with both speakers.
          </div>
        </div>
        <div>
          <div className="flex gap-1 mb-2">{[["Horizontal", "h"], ["Vertical", "v"]].map(([l, v]) => <button key={v} onClick={() => setPlane(v)} className={seg(plane === v)}>{l}</button>)}</div>
          <DispMap map={map} title={plane === "h" ? "Horizontal dispersion, one speaker (0° is on axis)" : "Vertical dispersion: below (−) to above (+) the tweeter axis"} />
        </div>
        <details className="text-xs text-stone-600 rounded border border-stone-300 bg-stone-50 px-3 py-2">
          <summary className="cursor-pointer text-sm text-stone-700 py-1">Details</summary>
          <div className="leading-relaxed mt-1 flex flex-col gap-1.5">
            <div>Woofer {sys.lay.wooferIn.toFixed(1)}″ and tweeter {sys.lay.tweeterIn.toFixed(1)}″ from the bottom, {sys.lay.spacingIn.toFixed(1)}″ apart. {sys.gross.toFixed(1)} L gross, {sys.net.toFixed(1)} L net{sys.hpf ? `; DSP highpass ${sys.hpf} Hz (BW24) below the port tuning` : ""}.</div>
            <div>Tweeter trimmed {sys.trim.toFixed(1)} dB in the DSP to match the woofer; baffle step centred at {sys.bsF3.toFixed(0)} Hz{bsc ? `, ${bsc} dB boost` : ""}.</div>
            <div><span className="font-medium text-stone-700">{w.name}.</span> {w.note}</div>
            <div><span className="font-medium text-stone-700">{t.name}.</span> {t.note}</div>
            {guide && <div><span className="font-medium text-stone-700">{guide.name}.</span> {guideSel.note}</div>}
          </div>
        </details>
      </div>
      <aside className="min-w-0 md:col-span-2">
        <Pick label={`Woofer · ${w.size}″`} options={HIFI_WOOFERS_BY_SIZE} value={w} onChange={setW} extra={hLk("woofer", "the woofer")} group={(o) => `${o.size}″ woofers`} />
        <Pick label="Tweeter" options={HIFI_TWEETERS} value={t} onChange={setT} extra={hLk("tweeter", "the tweeter")} />
        {guide && <Pick label="Waveguide" options={guides} value={guideSel} onChange={setGuide} />}
        <div className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-x-2 gap-y-2 mb-3 text-sm">
          <span className="text-stone-500">Material</span>
          <div className="flex flex-wrap gap-1">{[["Birch ply", "ply"], ["MDF", "mdf"]].map(([l, v]) => <button key={v} onClick={() => setMat(v)} className={seg(mat === v)}>{l}</button>)}</div>
          <span />
          <span className="text-stone-500">Thickness</span>
          <div className="flex flex-wrap gap-1">{[[0.75, "3/4″"], [0.5, "1/2″"]].map(([v, l]) => <button key={v} onClick={() => setWall(v)} className={seg(wall === v)}>{l}</button>)}</div>
          <span>{hLk("wall", "the panel thickness")}</span>
        </div>
        <div className="rounded border border-stone-300 bg-white px-3 py-3 mb-4">
          <Slider label="Width" value={dim.w} min={6} max={16} step={0.25} unit="&#8243;" onChange={(v) => setD("w", v)} extra={hDl("w", "Width")} />
          <Slider label="Height" value={dim.h} min={9} max={44} step={0.25} unit="&#8243;" onChange={(v) => setD("h", v)} extra={hDl("h", "Height")} />
          <Slider label="Depth" value={dim.d} min={6} max={16} step={0.25} unit="&#8243;" onChange={(v) => setD("d", v)} extra={hDl("d", "Depth")} />
          <div className="flex items-center justify-between gap-2 mb-1 mt-1"><span className="text-sm text-stone-600">Ports</span>{hLk("box", "sealed or vented")}</div>
          <div className="flex flex-wrap gap-1 mb-3">{[["Sealed", "sealed", 0], ["1 port", "vented", 1], ["2 ports", "vented", 2]].map(([l, v, n]) => {
            const on = box === v && (v === "sealed" || port.n === n);
            return <button key={l} onClick={() => { setBox(v); if (n) setP("n", n); }} className={seg(on)}>{l}</button>;
          })}</div>
          {box === "vented" && (<>
            <Slider label="Port diameter" value={port.dia} min={1} max={4} step={0.25} unit="&#8243;" onChange={(v) => setP("dia", v)} />
            <Slider label="Port length (centreline)" value={port.len} min={1} max={30} step={0.25} unit="&#8243;" onChange={(v) => setP("len", v)} />
            <div className="flex flex-wrap gap-1 mb-3">{[[0, "Straight"], [1, "1 elbow"], [2, "2 elbows"]].map(([e, l]) => <button key={e} onClick={() => setP("elbows", e)} className={seg((port.elbows || 0) === e)}>{l}</button>)}</div>
          </>)}
          <div className="text-xs text-stone-500">{sys.gross.toFixed(1)} L gross{sys.vented ? `, ${sys.pArea.toFixed(1)} in² of port` : ", lightly stuffed"}.</div>
        </div>
        <div className="rounded border border-stone-300 bg-white px-3 py-3 mb-4">
          <Slider label="Crossover" value={xo} min={800} max={4000} step={50} unit=" Hz" onChange={setXo} extra={hLk("xo", "the crossover")} />
          <div className="flex gap-1 mb-3">{[[4, "LR24"], [8, "LR48"]].map(([v, l]) => <button key={v} onClick={() => setOrder(v)} className={seg(order === v)}>{l}</button>)}</div>
          <Slider label="Baffle-step boost" value={bsc} min={0} max={6} step={0.5} unit=" dB" onChange={setBsc} />
          <Slider label="Woofer amp @ 8 Ω" value={wAmpW} min={10} max={500} step={10} unit=" W" onChange={setWAmpW} extra={hLk("wAmpW", "the woofer amp power")} />
          <Slider label="Tweeter amp @ 8 Ω" value={tAmpW} min={5} max={200} step={5} unit=" W" onChange={setTAmpW} extra={hLk("tAmpW", "the tweeter amp power")} />
        </div>
        <div className="rounded border border-stone-300 bg-white px-3 py-3">
          <div className="text-sm text-stone-600 mb-1">Placement</div>
          <div className="flex flex-wrap gap-1 mb-3">{Object.entries(HIFI_PLACES).map(([k, p]) => <button key={k} onClick={() => setPlace(k)} className={seg(place === k)}>{p.name}</button>)}</div>
          {place !== "free" && <Slider label="Distance to the wall" value={wallFt} min={0.5} max={6} step={0.25} unit=" ft" onChange={setWallFt} />}
          <Slider label="Speaker spacing" value={spacing} min={3} max={14} step={0.5} unit=" ft" onChange={setSpacing} />
          <Slider label="Toe-in" value={toe} min={0} max={35} step={1} unit="°" onChange={setToe} />
          <Slider label="Box bottom height (stand)" value={standIn} min={0} max={40} step={1} unit="&#8243;" onChange={setStandIn} />
          <Slider label="Ear height" value={earIn} min={24} max={60} step={1} unit="&#8243;" onChange={setEarIn} />
        </div>
      </aside>
    </main>
  );
}

// ---------------------------------------------------------------
// Notes page: project decisions that aren't planner output
// ---------------------------------------------------------------
function NotesPage() {
  return (
    <main className="max-w-6xl mx-auto px-4 md:px-8 pb-16 flex flex-col gap-2">
        <section className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6" style={{ fontFamily: "var(--font)" }}>
          {RACKS.map((r) => {
            const total = r.items.reduce((a, [, c]) => a + c, 0);
            return (
              <div key={r.id} className="border border-stone-300 rounded-lg p-4 bg-stone-50">
                <div className="flex justify-between items-baseline mb-1">
                  <h2 className="text-xl" style={{ fontFamily: "var(--font)", fontWeight: 700 }}>{r.name}</h2>
                  <span className="text-sm tabular-nums text-stone-600">≈ ${total.toLocaleString()}</span>
                </div>
                <p className="text-xs text-stone-500 mb-3">{r.note}</p>
                <ul className="text-sm text-stone-700 space-y-1">
                  {r.items.map(([label, cost]) => (
                    <li key={label} className="flex justify-between gap-3"><span>{label}</span><span className="tabular-nums text-stone-500">${cost}</span></li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>

        <section className="mt-2" style={{ fontFamily: "var(--font)" }}>
          <h2 className="text-xl mb-2" style={{ fontFamily: "var(--font)", fontWeight: 700 }}>Signal path (mains rack)</h2>
          <div className="max-w-4xl"><SignalPath /></div>
          <p className="text-sm text-stone-700 max-w-3xl mt-3">
            Division of labour: the PA2 holds input EQ and master level, then crossovers, delay and driver EQ on six outputs.
            Each output feeds one amp channel, set full-range, with the amp's own limiter configured from the driver's power and
            impedance so it references real output voltage. A safety high-pass around 500 Hz in the horn amp catches a mis-recalled
            preset, which a level limiter cannot.
          </p>
        </section>
        <section className="mt-8" style={{ fontFamily: "var(--font)" }}>
          <h2 className="text-xl mb-3" style={{ fontFamily: "var(--font)", fontWeight: 700 }}>Amp DSP: QSC GXD4 / GXD8</h2>
          <ul className="text-sm text-stone-700 space-y-2 max-w-3xl">
            {[
              ["Power per channel", "GXD4: 400 W into 8 \u03a9, 600 W into 4 \u03a9. GXD8: 800 W into 8 \u03a9, 1200 W into 4 \u03a9. Continuous, both channels driven. Voltage gain 33.5 dB (GXD4), 36.5 dB (GXD8)."],
              ["Filters", "Linkwitz-Riley 24 dB/oct only. Highpass 20 Hz\u20134 kHz, lowpass 60 Hz\u20134 kHz. No Butterworth and nothing steeper. Plus a 4-band PEQ (\u00b112 dB, 0.1\u20133 oct) and 50 ms of delay."],
              ["Limiter", "\u201cSmart Speaker Protection\u201d: Mild, Medium or Aggressive; a speaker power of 5\u2013800 W (GXD8) or 5\u2013400 W (GXD4); and 4 or 8 \u03a9. QSC say to set the power to the speaker's continuous rating."],
              ["What it can't do", "No threshold in volts, no attack or release settings, no limiting confined to one band. QSC don't say how the power setting maps to a threshold (the spec sheet calls it a peak limiter, the manual an RMS limiter)."],
            ].map(([t, d]) => (
              <li key={t} className="flex gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-stone-400 shrink-0" />
                <span><span className="font-medium">{t}.</span> {d}</span>
              </li>
            ))}
          </ul>
          <h3 className="text-base font-medium mt-5 mb-2">Protecting an excursion-limited sub with a GXD</h3>
          <ul className="text-sm text-stone-700 space-y-2 max-w-3xl">
            {[
              ["1. Highpass", "At or a little above tuning, LR24. Set the planner's highpass to LR24 to match."],
              ["2. Limiter power", "The lower of the planner's \u201ccone reaches Xmax at X W\u201d and the driver's rating; Medium or Aggressive. On a GXD8 the ceiling is 800 W, which is just the amp's own limit."],
              ["3. Check it", "Play a sine at the frequency where excursion peaks (the planner's port-velocity row, just above tuning), raise it until the limit indicator lights, and measure AC volts at the speaker terminals. Compare with \u221a(W \u00d7 8)."],
              ["4. Steeper or in volts", "Do it in the PA2 ahead of the amps and keep the GXD limiter as a backstop. Not yet checked against the PA2 manual."],
              ["Horns", "A GXD4 puts 400 W on a 35 W AES driver like the DE360. Its limiter, set to the driver's rating, is the protection; set the planner's HF amp slider to the same power so its numbers match."],
            ].map(([t, d]) => (
              <li key={t} className="flex gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-stone-400 shrink-0" />
                <span><span className="font-medium">{t}.</span> {d}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-stone-500 mt-3 max-w-3xl">
            Xmax is where distortion climbs, not where damage starts; the mechanical limit is usually 2–3× further, so 1.2–1.4× the Xmax voltage is a common setting once you've listened.
            Sources: <a className="underline" href="https://www.qscaudio.com/resource-files/productresources/amp/gxd/q_amp_gxd_usermanual.pdf">GXD user manual</a>, <a className="underline" href="https://www.qscaudio.com/resource-files/productresources/amp/gxd/q_amp_gxd_specsheet.pdf">GXD spec sheet</a>.
          </p>
        </section>

        <section className="mt-8" style={{ fontFamily: "var(--font)" }}>
          <h2 className="text-xl mb-3" style={{ fontFamily: "var(--font)", fontWeight: 700 }}>Crossover / DSP: PA2 and alternatives</h2>
          <p className="text-sm text-stone-700 mb-3 max-w-3xl">What the planner's protection needs per output: 48 dB/oct highpass, a peak limiter set in volts or dBu with attack and release, a slower RMS limiter, PEQ and delay. At ~15 ft from the mixer keep the inputs balanced; outputs to amps in the same rack matter less.</p>
          <div className="overflow-x-auto"><table className="text-sm w-full min-w-[720px] border-collapse">
            <thead><tr className="text-stone-500 text-left border-b border-stone-300">
              {["Unit", "I/O", "Slopes", "Limiter", "PEQ / out", "Price (US)", "Notes"].map((h, i) => <th key={h} className={`py-1 pr-4 font-normal ${i === 0 ? "sticky left-0 bg-stone-100" : ""}`}>{h}</th>)}
            </tr></thead>
            <tbody>
              {[
              ["dbx DriveRack 260", "2×6 XLR", "LR to 48 (BW to 24)", "dBu threshold; attack, hold, release", "4", "$995 new, ~$390 used", "Best value: limits set straight from the amp's gain. Only 4 PEQ bands per output."],
              ["dbx DriveRack VENU360", "3×6 XLR", "BW / LR to 48", "Attack, hold, release; threshold vs full scale", "8", "$1,149 new, ~$750 used", "Best overall: independent outputs, up to 1 s delay, app control."],
              ["Behringer DCX2496", "3×6 XLR (+AES)", "BW / LR to 48", "Per output, release only; units unclear", "Shared pool", "~$339", "Budget pick. Steep slopes use up EQ filters. PC control over RS-232/485."],
              ["Behringer DCX2496LE", "2×6 XLR", "BW / LR to 48", "Same as DCX2496", "Shared pool", "~$289", "Same DSP, but no third input, no digital I/O and no PC port: front panel only."],
              ["Ashly AQM408", "4×8 XLR", "BW / LR / Bessel to 48; FIR (512 taps)", "Brick-wall, peak detect, −20 to +20 dBu, attack & release; plus compressor (peak or average) for an RMS stage", "PEQ blocks (count unconfirmed)", "$999 new (Sweetwater, Full Compass, B&H), ~$800 used", "Current. Meets every requirement; 2 spare outputs. Control is browser-only over Ethernet (no front-panel editing), so bring a phone or tablet on the rack's network."],
              ["t.racks DSP 408", "4×8 XLR", "up to 48 (unconfirmed)", "Attack, release; units unclear", "9", "$439", "Thomann only in the US."],
              ["dbx DriveRack PA2 (current)", "2×6 XLR", "BW / LR to 48", "No attack or release; up to 3 dB overshoot", "8, linked L/R", "~$599, ~$366 used", "Left and right share EQ and delay per band; 10 ms output delay."],
              ].map((r) => (
                <tr key={r[0]} className="border-b border-stone-200 align-top">
                  {r.map((c, i) => <td key={i} className={`py-1.5 pr-4 ${i === 0 ? "font-medium min-w-[8rem] sm:whitespace-nowrap sticky left-0 bg-stone-100" : ""}`}>{c}</td>)}
                </tr>
              ))}
            </tbody>
          </table></div>
          <p className="text-xs text-stone-500 mt-2 max-w-3xl">Ruled out: Dayton DSP-408 (RCA only, no limiter, 24 dB/oct max); miniDSP (only balanced 8-out model is end of life; Flex is 2×4); Xilica XP, Ashly Protea, BSS FDS-366T (discontinued, used only); Symetrix (over budget). Specs from manufacturer manuals; some prices from search snippets, Sep 2026. Pick: a used DriveRack 260 on a budget; new, the Ashly AQM408 (limiters in dBu with attack and release, 4×8) or the VENU360 (front panel plus app). Keep the GXD limiters as a backstop either way.</p>
        </section>

        <section className="mt-8" style={{ fontFamily: "var(--font)" }}>
          <h2 className="text-xl mb-3" style={{ fontFamily: "var(--font)", fontWeight: 700 }}>Home inputs: Gemini MXR-01BT</h2>
          <p className="text-sm text-stone-700 mb-3 max-w-3xl">Turntable, line and phone into the same DSP and amps, with one master volume. A 2-channel DJ mixer does it all in one box.</p>
          <ul className="text-sm text-stone-700 space-y-2 max-w-3xl">
            {[
              ["What it has", "2 channels, each switchable phono or line, 3-band EQ, Bluetooth input, 1/4″ mic, headphones, all-metal chassis."],
              ["Outputs", "Balanced 1/4″ TRS master (to the DSP), RCA master, and an RCA booth out with its own level."],
              ["Hook-up", "Master TRS → TRS-to-XLR-male cables → DSP inputs. Turntable ground wire to the mixer's ground post."],
              ["Volume", "Use the mixer master. Set DSP input and amp gains so the master at full is the loudest you'll want; the DSP and amp limiters stay as a backstop."],
              ["Booth out", "Spare RCA with its own level: could feed a fill or booth monitor through the DSP."],
              ["Turn-on", "Mixer and sources first, amps last; amps off first."],
            ].map(([t, d]) => (
              <li key={t} className="flex gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-stone-400 shrink-0" />
                <span><span className="font-medium">{t}.</span> {d}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-stone-500 mt-3 max-w-3xl">Source: <a className="underline" href="https://www.geminisound.com/products/mxr-01bt">Gemini MXR-01BT</a>. Alternative without a mixer: a hi-fi preamp with phono, RCA out through an ART CleanBox Pro to balanced.</p>
        </section>

        <section className="mt-8" style={{ fontFamily: "var(--font)" }}>
          <h2 className="text-xl mb-3" style={{ fontFamily: "var(--font)", fontWeight: 700 }}>Passive crossover: calibrate and build</h2>
          <p className="text-sm text-stone-700 mb-3 max-w-3xl">For fills without a maker's network (FaitalPRO, Ciare, B&C 8″). A 2nd-order 2-way is 6–8 parts: woofer coil + cap, HF cap + coil, two pad resistors. About $40–80 per box in parts. All values get tuned, not just the pad.</p>
          <ul className="text-sm text-stone-700 space-y-2 max-w-3xl">
            {[
              ["1. Gear (~$150, once)", "UMIK-1 mic, REW (free) to measure, VituixCAD (free) to design, and an impedance jig (Dayton DATS V3, or a resistor + soundcard in REW)."],
              ["2. Measure in the finished box", "Woofer and HF separately, no crossover: response at 1 m on axis (outdoors or gated), impedance, and a near-field of woofer + port. Don't move the mic between drivers, so the phase stays valid. Optional: 15/30/45° off axis."],
              ["3. Design", "Import into VituixCAD, start from the textbook network, tune values for a flat sum with no dip at the crossover. Round to real part values; keep the minimum impedance at about 5 Ω or above."],
              ["4. Prototype on DSP (optional)", "Copy the target curves into the PA2 or GXD, listen and measure, then match the passive design to what you liked."],
              ["5. Test build", "Clip leads or a loose board outside the box. Measure the whole speaker against the simulation; swap pad resistors to set the HF level (buy a few spare values). Listen at gig level."],
              ["6. Final build", "Stripboard is fine for the HF side; run the woofer path (~6 A at 300 W) in 14–16 AWG wire, not the strips, or wire point to point on a ply board. Space the coils or turn them 90° apart, away from the woofer magnet. Mount on foam, re-measure installed, copy for the other boxes and spot-check each."],
            ].map(([t, d]) => (
              <li key={t} className="flex gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-stone-400 shrink-0" />
                <span><span className="font-medium">{t}.</span> {d}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-stone-500 mt-3 max-w-3xl">Roughly a weekend to measure and design, plus an evening to build and verify.</p>
        </section>

        <section className="mt-8" style={{ fontFamily: "var(--font)" }}>
          <h2 className="text-xl mb-3" style={{ fontFamily: "var(--font)", fontWeight: 700 }}>Materials</h2>
          <ul className="text-sm text-stone-700 space-y-2 max-w-3xl">
            {[
              ["Prototype in particleboard", "Cheap and flat. Build it to verify duct tuning, then transfer interior dimensions \u2014 not the cut list \u2014 to the real material."],
              ["Consider 5/8\" or 1/2\" for the final boxes", "Sub column drops 119 \u2192 107 \u2192 95 lb loaded. Needs more bracing, and the extra interior volume lowers Fb, so the duct gets shorter."],
              ["MDO for the baffles", "Paints far better than birch, no edge penalty since no baffle edge is exposed."],
            ].map(([t, d]) => (
              <li key={t} className="flex gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-stone-400 shrink-0" />
                <span><span className="font-medium">{t}.</span> {d}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-8" style={{ fontFamily: "var(--font)" }}>
          <h2 className="text-xl mb-3" style={{ fontFamily: "var(--font)", fontWeight: 700 }}>Still to decide</h2>
          <ul className="text-sm text-stone-700 space-y-2 max-w-3xl">
            {[
              ["Baffle mounting", "Cleats (forgiving, costs 3/4\" of interior on each side) or a stopped rabbet in the frame panels (tighter, squares the box, needs a dado). Baffle size changes with the choice."],
              ["Bracing", "Not drawn. Volume and weight allow for two braces. Centre ribs, slat ladder or windowed shelves — decide once handle recesses are placed, since they compete for the same panel area."],
              ["Handles", "Recess type, depth and position on the sub. Interacts with bracing."],
              ["Driver margins", "Currently equal at top and sides. One recommendation is to offset deliberately so baffle modes and diffraction paths don't coincide — likely inaudible below 100 Hz, so mostly a visual decision."],
              ["Port edge finish", "The letterbox mouths are cut in the shell's nose band, so this is a shell-material question, not a baffle one. Paint carried into the ducts, or masked so the ply edge shows — end grain in the mouth needs sealing either way."],
              ["Duct tuning", "Verify Fb by impedance sweep on the particleboard prototype and trim the duct before cutting birch. End correction is the largest source of error in the modelled Fb."],
              ["Sensitivity", "SB's 99 dB claim is 3 dB above what their own published T/S parameters give (95.9 dB/2.83V). Everything about levels and limiter settings depends on which is right. Measure it, or assume the lower figure."],
              ["Driver clearance", "Check the Nero's frame and 8.4\" mounting depth against the baffle margin and anything that ends up behind the magnet."],
              ["Compression driver", "DE360 at $117 is the default; crossover floor on the A400G2 needs a distortion sweep to confirm ~1.1 kHz."],
              ["Horn print", "A400G2 in one piece needs a 400 mm+ bed; otherwise sectioned. Filament, print service, or buy the RX-28 instead."],
              ["Prototype material", "3/4\" particleboard for the first sub, then transfer verified interior dimensions to birch."],
              ["Final panel thickness", "3/4\" or braced 1/2\" birch (switch it under Plywood in the planner). 1/2\" needs bracing on roughly 12\" centres and a doubler at the driver cutout. Decide before the prototype, since wall thickness changes the interior volume and therefore the duct length."],
              ["Baffle material", "MDO if the baffles are painted — no baffle edge is exposed in any of the current configurations, so there is no reason not to. Birch only if the baffle is ever meant to be clear-finished."],
            ].map(([t, d]) => (
              <li key={t} className="flex gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-stone-400 shrink-0" />
                <span><span className="font-medium">{t}.</span> {d}</span>
              </li>
            ))}
          </ul>
        </section>

    </main>
  );
}


function FillsPage() {
  const [drv, setDrv] = useState(FILL_OPTIONS.find((o) => o.id === "bc10cxn64"));
  const [boxType, setBoxType] = useState("vented");
  const [dim, setDim] = useState({ w: 11.5, h: 16, d: 11 });
  const [port, setPort] = useState({ n: 1, dia: 3, len: 4 });
  const [hp, setHp] = useState(70);          // highpass to the subs, LR24
  const [ampW, setAmpW] = useState(300);     // per box, rated into 8 Ω
  const [portMax, setPortMax] = useState(20);
  const setD = (k, v) => setDim((p) => ({ ...p, [k]: v }));
  const setP = (k, v) => setPort((p) => ({ ...p, [k]: v }));
  const ts = drv.ts;
  const { gross, pArea, net, vM, sM, max: maxC, sens, f3, pad, hfLimW, lb, portLimited } = fillSystem(drv, { boxType, dim, port, hp, ampW, portMax });
  const near = (f) => nearest(maxC, f);
  const disp = ts.disp != null ? ts.disp : drv.size >= 10 ? 1.5 : 1;
  const hf = drv.hf;
  const kick = near(60).spl, mid = near(150).spl;
  const tile = (k, v, u) => (
    <div key={k} className="bg-stone-50 px-3 py-2.5">
      <div className="text-[10.5px] uppercase tracking-wider text-stone-500 font-semibold">{k}</div>
      <div className="text-xl font-medium tabular-nums mt-0.5 break-words">{v}<span className="text-xs text-stone-500 ml-0.5">{u}</span></div>
    </div>
  );
  const F = fillChips({ drv, dim, Fb: vM ? vM.Fb : null, Qtc: sM ? sM.Qtc : null, hp, portLimited, portMax, f3, hf, hfLimW, ampW, pad });
  return (
    <main className="max-w-6xl mx-auto px-4 md:px-8 pb-16 grid grid-cols-1 md:grid-cols-5 gap-8" style={{ fontFamily: "var(--font)" }}>
      <div className="min-w-0 md:col-span-3 flex flex-col gap-4">
        <p className="text-sm text-stone-600">Passive 8–10″ coaxial fills or booth monitors, highpassed to the subs. One amp channel each (or a pair in parallel).</p>
        <div className="grid gap-px rounded-lg overflow-hidden border border-stone-300 bg-stone-200 grid-cols-2 sm:grid-cols-[repeat(auto-fit,minmax(112px,1fr))] [&>*:last-child:nth-child(odd)]:col-span-2 sm:[&>*:last-child:nth-child(odd)]:col-span-1">
          {tile("Net volume", net.toFixed(0), "L")}
          {vM ? tile("Tuning Fb", vM.Fb.toFixed(0), "Hz") : tile("Qtc", sM.Qtc.toFixed(2), "")}
          {tile("F3", f3.toFixed(0), "Hz")}
          {tile("Max @ 60 Hz", kick.toFixed(1), "dB")}
          {tile("Max @ 150 Hz", mid.toFixed(1), "dB")}
          {tile("Weight", lb.toFixed(0), "lb")}
        </div>
        <ResponseChart fmax={300} series={[{ curve: maxC, label: drv.name, stroke: "#0082c8", tint: "rgba(0,130,200,0.07)" }]} marks={[{ f: hp, label: "HP" }, ...(vM ? [{ f: vM.Fb, label: "Fb" }] : [])]} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-0.5 text-sm">
          {[
            ["Woofer sensitivity", `${sens.toFixed(1)} dB`, "2.83 V, half space, 1 m, modelled"],
            ["HF sensitivity", hf ? `${hf.sens} dB` : "—", hf ? `pad about ${pad.toFixed(0)} dB to match` : "not published"],
            ["HF coverage", hf && hf.cov ? `${hf.cov}° conical` : "—"],
            ["HF crossover", hf && hf.xo ? `${hf.xo} Hz or higher` : "—", "recommended minimum"],
            ["Max SPL at 100 Hz", `${near(100).spl.toFixed(1)} dB`, `sine, ${near(100).who}-limited`],
            ["Price", drv.price ? `$${drv.price}` : "—", drv.src],
          ].map(([k, v, n]) => (
            <div key={k} className="flex justify-between gap-4 border-b border-stone-200 py-1">
              <span className="text-stone-500 shrink-0">{k}</span>
              <span className="text-right"><span className="font-medium tabular-nums">{v}</span>{n ? <span className="block text-xs text-stone-500">{n}</span> : null}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-1.5">
          {F.map(([kind, head, body]) => (
            <div key={head} className={`block text-xs leading-relaxed px-3 py-2 rounded border ${CHIP_BG[kind] || CHIP_BG.ok}`}>
              <b className={`font-semibold mr-1.5 ${kind === "ok" ? "text-green-800" : kind === "warn" ? "text-amber-700" : "text-red-700"}`}>{head}</b>
              <span className="text-stone-600">{body}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-stone-500"><span className="font-medium text-stone-600">{drv.name}.</span> {drv.note} Specs from usspeaker.com, Sep 2026. Box weight assumes 1/2″ birch. Displacement {ts.disp != null ? "as published" : `not published; ${disp} L assumed`}.</p>
      </div>
      <aside className="min-w-0 md:col-span-2">
        <Pick label="Coaxial driver" options={FILL_OPTIONS} value={drv} onChange={setDrv} />
        <div className="text-sm text-stone-500 mb-1">Box</div>
        <div className="flex gap-1 mb-2">
          {[["Vented", "vented"], ["Sealed", "sealed"]].map(([l, v]) => (
            <button key={v} onClick={() => setBoxType(v)} className={`px-3 py-1.5 rounded border text-sm ${boxType === v ? "border-stone-900 bg-stone-900 text-stone-50" : "border-stone-300 hover:border-stone-500"}`}>{l}</button>
          ))}
        </div>
        <div className="rounded border border-stone-300 bg-white px-3 py-3 mb-4">
          <Slider label="Width" value={dim.w} min={9} max={20} step={0.5} unit="&#8243;" onChange={(v) => setD("w", v)} />
          <Slider label="Height" value={dim.h} min={9} max={28} step={0.5} unit="&#8243;" onChange={(v) => setD("h", v)} />
          <Slider label="Depth" value={dim.d} min={7} max={20} step={0.5} unit="&#8243;" onChange={(v) => setD("d", v)} />
          {boxType === "vented" && (<>
            <Slider label="Ports" value={port.n} min={1} max={3} step={1} unit="" onChange={(v) => setP("n", v)} />
            <Slider label="Port diameter" value={port.dia} min={1.5} max={5} step={0.25} unit="&#8243;" onChange={(v) => setP("dia", v)} />
            <Slider label="Port length" value={port.len} min={1} max={14} step={0.25} unit="&#8243;" onChange={(v) => setP("len", v)} />
            <Slider label="Port velocity limit" value={portMax} min={12} max={30} step={0.5} unit=" m/s" onChange={setPortMax} />
          </>)}
          <div className="text-xs text-stone-500">{gross.toFixed(0)} L gross{boxType === "sealed" ? ", stuffed" : `, ${pArea.toFixed(1)} in² of port`}.</div>
        </div>
        <div className="rounded border border-stone-300 bg-white px-3 py-3">
          <Slider label="Highpass to the subs (LR24)" value={hp} min={50} max={160} step={5} unit=" Hz" onChange={setHp} />
          <Slider label="Amp power per box @ 8 Ω" value={ampW} min={25} max={800} step={25} unit=" W" onChange={setAmpW} />
          <div className="text-xs text-stone-500">A freed GXD4 channel with two 8 Ω fills in parallel gives about 300 W each.</div>
        </div>
      </aside>
    </main>
  );
}

function SheetDrawing({ sheet, S, idx }) {
  const sc = 4, W = S.w * sc, H = S.h * sc;
  const [box, cw] = useWidth(S.w === 48 ? 160 : 200);
  const fs = (12 * (W + 4)) / cw;   // 12 css px
  const colors = { Sub: "#fff3b0", Mid: "#cce6f4" };
  return (
    <div ref={box} className={`flex flex-col gap-1 w-full ${S.w === 48 ? "max-w-[240px] sm:w-[160px]" : "max-w-[300px] sm:w-[200px]"}`}>
      <div className="text-xs text-stone-500">Sheet {idx + 1}</div>
      <svg viewBox={`-2 -2 ${W + 4} ${H + 4}`} style={{ width: "100%", height: "auto" }} role="img" aria-label={`Sheet ${idx + 1} layout`}>
        <rect x="0" y="0" width={W} height={H} fill="#ffffff" stroke="#707070" />
        {sheet.items.map((it, i) => (
          <g key={i}>
            <rect x={it.x * sc} y={it.y * sc} width={it.w * sc} height={it.h * sc} fill={colors[it.box] || "#e6e6e6"} stroke="#707070" strokeWidth="0.8" />
            {it.w * sc > fs * 3.6 && it.h * sc > fs * 1.3 && (
              <text x={(it.x + it.w / 2) * sc} y={(it.y + it.h / 2) * sc + fs * 0.35} textAnchor="middle" fontSize={fs} fill="#111111" fontFamily="Inconsolata, monospace">{it.box} {it.part.split(" ")[0]}</text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

function CutlistPage(props) {
  const { joint, setJoint, sheetKind, setSheetKind, sets, setSets, wall } = props;
  const { parts, vent } = cutParts(props);
  const S = SHEETS[sheetKind], kerf = 0.125;
  const byT = {};
  parts.forEach((p) => { for (let i = 0; i < p.qty * sets; i++) (byT[p.t] = byT[p.t] || []).push(p); });
  const packs = Object.keys(byT).sort((a, b) => b - a).map((t) => ({ t: +t, ...packSheets(byT[t], S, kerf) }));
  const btn = (on) => `px-3 py-1.5 rounded border text-sm ${on ? "border-stone-900 bg-stone-900 text-stone-50" : "border-stone-300 hover:border-stone-500"}`;
  return (
    <main className="max-w-6xl mx-auto px-4 md:px-8 pb-16" style={{ fontFamily: "var(--font)" }}>
      <div className="flex flex-wrap gap-6 mb-5">
        <div><div className="text-sm text-stone-500 mb-1">Corner joints</div>
          <div className="flex gap-1">{[["butt", "Butt"], ["rabbet", "Rabbet"], ["miter", "Miter"]].map(([k, l]) => <button key={k} className={btn(joint === k)} onClick={() => setJoint(k)}>{l}</button>)}</div></div>
        <div><div className="text-sm text-stone-500 mb-1">Sheet</div>
          <div className="flex gap-1">{Object.entries(SHEETS).map(([k, s]) => <button key={k} className={btn(sheetKind === k)} onClick={() => setSheetKind(k)}>{s.name}</button>)}</div></div>
        <div><div className="text-sm text-stone-500 mb-1">Stacks</div>
          <div className="flex gap-1">{[1, 2, 4].map((n) => <button key={n} className={btn(sets === n)} onClick={() => setSets(n)}>{n}</button>)}</div></div>
      </div>
      <p className="text-sm text-stone-600 mb-4 max-w-3xl">From the planner's current boxes: {tName(wall)} walls, 3/4″ baffles set {f8(props.inset)}″ back, back panels in a rabbet. Sizes are finished dimensions in inches (width × length); {f8(kerf)}″ kerf allowed in the layout. Quantities are for {sets} stack{sets > 1 ? "s" : ""}.</p>
      <div className="overflow-x-auto mb-6"><table className="text-sm w-full sm:min-w-[640px] border-collapse">
        <thead><tr className="text-stone-500 text-left border-b border-stone-300">
          <th className="py-1 pr-3 font-normal">Box</th><th className="py-1 pr-3 font-normal">Part</th><th className="py-1 pr-3 font-normal text-right">Qty</th>
          <th className="py-1 pr-3 font-normal text-right">Width × length</th><th className="py-1 pr-3 font-normal">Ply</th><th className="py-1 font-normal hidden sm:table-cell">Notes</th>
        </tr></thead>
        <tbody>{parts.map((p, i) => (
          <tr key={i} className="border-b border-stone-200 align-top">
            <td className="py-1 pr-3">{p.box}</td><td className="py-1 pr-3">{p.part}{p.note && <span className="block sm:hidden text-xs text-stone-500">{p.note}</span>}</td><td className="py-1 pr-3 text-right tabular-nums">{p.qty * sets}</td>
            <td className="py-1 pr-3 text-right tabular-nums whitespace-nowrap">{f8(Math.min(p.a, p.b))} × {f8(Math.max(p.a, p.b))}</td>
            <td className="py-1 pr-3">{tName(p.t)}</td><td className="py-1 text-stone-600 hidden sm:table-cell">{p.note}</td>
          </tr>))}</tbody>
      </table></div>
      {vent.length > 0 && <p className="text-sm text-stone-600 mb-6">Also: {vent.join("; ")}.</p>}
      <h2 className="text-xl mb-2" style={{ fontFamily: "var(--font)", fontWeight: 700 }}>Sheet layout, {S.name}</h2>
      {packs.map((pk) => (
        <div key={pk.t} className="mb-6">
          <div className="text-sm font-medium mb-2">{tName(pk.t)} birch: {pk.sheets.length} sheet{pk.sheets.length > 1 ? "s" : ""}</div>
          {pk.tooBig.length > 0 && <div className="text-sm text-red-700 mb-2">Doesn't fit on one {S.name} sheet: {pk.tooBig.map((r) => `${r.box} ${r.part}`).join(", ")}.</div>}
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-4">{pk.sheets.map((sh, i) => <SheetDrawing key={i} sheet={sh} S={S} idx={i} />)}</div>
        </div>
      ))}
      <p className="text-xs text-stone-500">Simple row-by-row layout, grain direction ignored. Treat it as a sheet count and a starting point for your own cut plan. Driver cutouts are typical values; use the datasheet's.</p>
    </main>
  );
}

// ---------------------------------------------------------------
// Optimizer: lock buttons on the controls, the panel, result cards.
// ---------------------------------------------------------------
// Material Symbols "lock" / "lock_open" (filled), drawn inline so they never depend on a font loading
const LOCK_PATH = "M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z";
const LOCK_OPEN_PATH = "M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6h2c0-1.66 1.34-3 3-3s3 1.34 3 3v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z";
function LockIcon({ locked }) {
  return <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d={locked ? LOCK_PATH : LOCK_OPEN_PATH} fill="currentColor" fillRule="evenodd" /></svg>;
}
const lockCls = (on) => `inline-flex items-center justify-center gap-0.5 min-w-[28px] h-6 px-1.5 rounded border text-xs ${on ? "border-stone-900 bg-stone-900 text-stone-50" : "border-stone-300 text-stone-400 bg-white hover:border-stone-500 hover:text-stone-600"}`;
function LockBtn({ on, onClick, what }) {
  const tip = on ? `Locked: the optimizer keeps ${what}` : `Unlocked: the optimizer may change ${what}`;
  return <button type="button" onClick={onClick} aria-pressed={on} aria-label={tip} title={tip} className={lockCls(on)}><LockIcon locked={on} /></button>;
}
// every on/off lock the optimizer reads (box sizes are separate: subDim, midDim)
const LOCK_KEYS = ["sub", "mid", "cd", "horn", "vent", "wall", "hpf", "xoLo", "xoHi", "ampW", "mAmpW", "hfAmpW"];
const DIM_NEXT = { free: "max", max: "exact", exact: "free" };
function DimLock({ mode = "free", onChange, what }) {
  const tip = `${what}: ${mode === "free" ? "unlocked, the optimizer may change it" : mode === "max" ? "up to this value" : "locked at exactly this value"} (tap to change)`;
  return (
    <button type="button" onClick={() => onChange(DIM_NEXT[mode])} aria-label={tip} title={tip} className={lockCls(mode !== "free")}>
      <LockIcon locked={mode !== "free"} />{mode === "max" ? <span>≤</span> : mode === "exact" ? <span>=</span> : null}
    </button>
  );
}

// Start the optimizer in the worker inlined by build.sh; fall back to the main thread where workers are blocked.
let optWorker = null, optNoWorker = false, optSeq = 0;
function runOptimizer(input) {
  const id = ++optSeq;
  const local = () => new Promise((res, rej) => setTimeout(() => { try { res(optimize(input)); } catch (e) { rej(e); } }, 30));
  if (optNoWorker) return local();
  try {
    if (!optWorker) {
      const src = document.getElementById("opt-worker");
      if (!src || typeof Worker === "undefined") throw new Error("no worker");
      optWorker = new Worker(URL.createObjectURL(new Blob([src.textContent], { type: "text/javascript" })));
    }
  } catch { optNoWorker = true; return local(); }
  const w = optWorker;
  return new Promise((res, rej) => {
    let timer = null;
    const done = () => { clearTimeout(timer); w.removeEventListener("message", onMsg); w.removeEventListener("error", onErr); };
    const onMsg = (e) => { if (e.data.id !== id) return; done(); if (e.data.error) rej(new Error(e.data.error)); else res(e.data.out); };
    const onErr = () => { done(); optNoWorker = true; if (optWorker === w) optWorker = null; local().then(res, rej); };
    // a hung worker: stop it and report, rather than leaving the button on "Searching…"
    timer = setTimeout(() => { done(); try { w.terminate(); } catch {} if (optWorker === w) optWorker = null; rej(new Error("took longer than 60 s")); }, 60000);
    w.addEventListener("message", onMsg);
    w.addEventListener("error", onErr);
    w.postMessage({ id, input });
  });
}

// a goal's place in the priority order, floating on the button's corner so the label doesn't move
function RankBadge({ n }) {
  return <span className="absolute -top-2 -left-2 min-w-[18px] h-[18px] px-1 rounded-full bg-cmy-c text-white text-[11px] font-bold leading-[18px] text-center" aria-label={`priority ${n}`}>{n}</span>;
}
// status notes: a light tint of the status colour with a matching border
const CHIP_BG = { ok: "bg-green-50 border-green-200 border-l-4 border-l-green-300", warn: "bg-amber-50 border-amber-200 border-l-4 border-l-amber-300", bad: "bg-red-50 border-red-200 border-l-4 border-l-red-300" };
const money = (x) => `$${Math.round(x).toLocaleString()}`;
function Delta({ v, unit, lowerIsBetter, digits = 0 }) {
  if (v == null) return null;
  const r = Number(v.toFixed(digits));
  const good = lowerIsBetter ? r < 0 : r > 0, bad = lowerIsBetter ? r > 0 : r < 0;
  const txt = r === 0 ? "±0" : `${r > 0 ? "+" : "\u2212"}${unit === "$" ? money(Math.abs(r)) : Math.abs(r).toFixed(digits) + unit}`;
  return <div className={`text-xs font-semibold ${good ? "text-green-800" : bad ? "text-red-700" : "text-stone-500"}`}>{txt}{good ? " better" : bad ? " worse" : ""}</div>;
}

// Front view of a design, to scale, with your current design's outline dashed behind it.
function BoxFront({ g, cur }) {
  const W = 150, H = 150, pad = 4;
  // tower: the mid sits in the top of the sub column (drawn as a section of it), the horn on top
  const tall = (x) => x.sub.h + (x.tower ? 0 : x.mid.h) + (x.horn ? x.horn.h : 0);
  const wide = (x) => Math.max(x.sub.w, x.mid.w, x.horn ? x.horn.w : 0);
  const k = Math.min((H - 2 * pad) / Math.max(tall(g), cur ? tall(cur) : 0), (W - 2 * pad) / Math.max(wide(g), cur ? wide(cur) : 0));
  const cx = W / 2, y0 = H - pad;
  const stackRects = (x) => {
    const r = [], put = (w, h, y) => ({ x: cx - (w * k) / 2, y: y - h * k, w: w * k, h: h * k });
    const sb = put(x.sub.w, x.sub.h, y0), mb = x.tower ? { ...sb, h: x.mid.h * k } : put(x.mid.w, x.mid.h, sb.y), hb = x.horn ? put(x.horn.w, x.horn.h, mb.y) : null;
    r.push(sb); if (!x.tower) r.push(mb); if (hb) r.push(hb);
    return { sb, mb, hb, r };
  };
  const a = stackRects(g), b = cur ? stackRects(cur) : null, t = g.wall * k, v = g.cVent;
  const vent = [];
  if (g.portStyle === "slots" || g.portStyle === "folded") vent.push(<rect key="v" x={a.sb.x + t} y={a.sb.y + a.sb.h - t - v.slotH * k} width={a.sb.w - 2 * t} height={v.slotH * k} fill="#111111" />);
  else if (g.portStyle === "vslots" || g.portStyle === "vslot1") {
    vent.push(<rect key="l" x={a.sb.x + t} y={a.sb.y + t} width={v.throat * k} height={a.sb.h - 2 * t} fill="#111111" />);
    if (g.portStyle === "vslots") vent.push(<rect key="r" x={a.sb.x + a.sb.w - t - v.throat * k} y={a.sb.y + t} width={v.throat * k} height={a.sb.h - 2 * t} fill="#111111" />);
  } else for (let i = 0; i < (v.nt || 1); i++) {
    const n = v.nt || 1, gap = a.sb.w / (n + 1);
    vent.push(<circle key={i} cx={a.sb.x + gap * (i + 1)} cy={a.sb.y + a.sb.h - t - (v.dia * k) / 2 - 2} r={(v.dia * k) / 2} fill="#111111" />);
  }
  const ventH = g.portStyle === "slots" || g.portStyle === "folded" ? v.slotH * k + t : g.portStyle.startsWith("round") ? v.dia * k + 4 : 0;
  const driver = (box, size, below = 0) => <circle cx={box.x + box.w / 2} cy={box.y + (box.h - below) / 2} r={Math.min(size * 0.9 * k, box.w - 2 * t - 2, box.h - below - 2 * t - 2) / 2} fill="#e6e6e6" stroke="#707070" strokeWidth="1" />;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`Front view: sub ${g.sub.w} × ${g.sub.h}″, mid ${g.mid.w} × ${g.mid.h}″${cur ? "; your design dashed" : ""}`}>
      {b && b.r.map((q, i) => <rect key={i} x={q.x} y={q.y} width={q.w} height={q.h} fill="none" stroke="#707070" strokeWidth="1" strokeDasharray="3 2" />)}
      {a.r.map((q, i) => <rect key={i} x={q.x} y={q.y} width={q.w} height={q.h} rx="1" fill={q === a.hb ? "#707070" : "#e6e6e6"} fillOpacity={q === a.hb ? 1 : 0.85} stroke="#111111" strokeWidth="1.2" />)}
      {vent}
      {g.tower && <line x1={a.sb.x} x2={a.sb.x + a.sb.w} y1={a.mb.y + a.mb.h} y2={a.mb.y + a.mb.h} stroke="#111111" strokeWidth="1.2" />}
      {driver(g.tower ? { ...a.sb, y: a.mb.y + a.mb.h, h: a.sb.h - a.mb.h } : a.sb, g.subSize, ventH)}
      {driver(a.mb, g.midSize)}
    </svg>
  );
}

// The sub's clean output (music limit) against frequency, this design against yours; the scored 40-90 Hz band shaded.
function OutChart({ curve, cur, fmin = 20, fmax = 200, band = [40, 90], top = 135, bot = 80 }) {
  const [hover, setHover] = useState(null);
  const W = 220, H = 150, L = 26, R = 6, T = 16, B = 18;
  const x = (f) => L + (Math.log(f / fmin) / Math.log(fmax / fmin)) * (W - L - R), y = (d) => T + ((top - Math.max(bot, Math.min(top, d))) / (top - bot)) * (H - T - B);
  const path = (c) => c.map((o, i) => `${i ? "L" : "M"}${x(o[0]).toFixed(1)},${y(o[1]).toFixed(1)}`).join("");
  const at = (c, f) => c && c.reduce((b, o) => (Math.abs(Math.log(o[0] / f)) < Math.abs(Math.log(b[0] / f)) ? o : b));
  const move = (e) => {
    const r = e.currentTarget.getBoundingClientRect(), px = ((e.clientX - r.left) / r.width) * W;
    const f = fmin * Math.pow(fmax / fmin, (px - L) / (W - L - R));
    setHover(f >= fmin && f <= fmax ? f : null);
  };
  const ticks = []; for (let d = bot; d <= top; d += 10) ticks.push(d);
  const h1 = hover && at(curve, hover), h2 = hover && at(cur, hover);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto touch-none" onPointerMove={move} onPointerLeave={() => setHover(null)} role="img"
      aria-label="Clean sub output from 20 to 200 Hz, this design against yours">
      {band && <rect x={x(band[0])} y={T} width={x(band[1]) - x(band[0])} height={H - T - B} fill="#f2f2f2" />}
      {ticks.map((d) => <g key={d}><line x1={L} x2={W - R} y1={y(d)} y2={y(d)} stroke="#e6e6e6" /><text x={L - 3} y={y(d) + 3} fontSize="8" textAnchor="end" fill="#707070">{d}</text></g>)}
      {(fmax > 1000 ? [20, 100, 1000, 10000] : [20, 50, 100, 200, 500]).filter((f) => f >= fmin && f <= fmax).map((f) => <text key={f} x={x(f)} y={H - 6} fontSize="8" textAnchor="middle" fill="#707070">{f >= 1000 ? f / 1000 + "k" : f}</text>)}
      {cur && <path d={path(cur)} fill="none" stroke="#707070" strokeWidth="1.5" strokeDasharray="4 3" />}
      <path d={path(curve)} fill="none" stroke="#111111" strokeWidth="2" />
      {hover ? (<>
        <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="#707070" strokeWidth="0.75" />
        <circle cx={x(h1[0])} cy={y(h1[1])} r="2.5" fill="#111111" stroke="#fff" strokeWidth="1" />
        {(() => { const X = Math.max(L + 14, Math.min(W - R - 14, x(hover))); return <g><rect x={X - 14} y={H - B + 2} width="28" height="12" rx="2" fill="#111111" /><text x={X} y={H - B + 11} fontSize="8" textAnchor="middle" fill="#ffffff">{hover.toFixed(0)} Hz</text></g>; })()}
        <text x={L} y={9} fontSize="8.5" fill="#111111">{hover.toFixed(0)} Hz: {h1[1].toFixed(0)} dB{h2 ? ` · yours ${h2[1].toFixed(0)} dB` : ""}</text>
      </>) : (
        <text x={L} y={9} fontSize="8.5" fill="#707070"><tspan fill="#111111">━ this</tspan>{cur ? "  ╌ yours" : ""} · dB, clean</text>
      )}
    </svg>
  );
}
function OptCard({ k, i, n, cur, onPreview, onLoad, onSave, previewing, canSave }) {
  const c = k.config, m = k.metrics, d = k.delta || {};
  const tile = (label, v, delta) => (
    <div className="bg-stone-50 border border-stone-200 rounded px-2 py-1.5">
      <div className="text-[10.5px] uppercase tracking-wider text-stone-500 font-semibold">{label}</div>
      <div className="tabular-nums">{v}</div>{delta}
    </div>
  );
  const sheets = k.build.sheets.map((x) => `${x.n} sheet${x.n > 1 ? "s" : ""} ${x.t === 0.5 ? "1/2″" : x.t === 0.75 ? "3/4″" : x.t + "″"}`).join(" + ");
  return (
    <div className={`bg-white border rounded-lg p-3.5 flex flex-col gap-2.5 min-w-full md:min-w-0 snap-start ${previewing ? "border-stone-900 ring-1 ring-stone-900" : "border-stone-300"}`}>
      <div className="text-[11px] uppercase tracking-wider font-bold text-stone-600">{k.label} · {i + 1} of {n}</div>
      <h3 className="text-lg leading-snug" style={{ fontFamily: "var(--font)", fontWeight: 700 }}>{k.names.sub} · {c.cDim.w} × {c.cDim.h} × {c.cDim.d}″</h3>
      <div className="grid grid-cols-[2fr_3fr] gap-2 items-end">
        {k.geom && <BoxFront g={k.geom} cur={cur && cur.geom} />}
        {k.curve && <OutChart curve={k.curve} cur={cur && cur.curve} />}
      </div>
      <div className="text-xs text-stone-600">Mid {k.names.mid} · {k.names.cd} on {k.names.horn} · amps {c.ampW} / {c.mAmpW} / {c.hfAmpW} W</div>
      <div className="grid grid-cols-2 gap-1.5">
        {tile("Drivers", money(m.price), <Delta v={d.price} unit="$" lowerIsBetter />)}
        {tile("Heaviest", `${m.heaviest.toFixed(0)} lb`, <Delta v={d.heaviest} unit=" lb" lowerIsBetter />)}
        {tile("Output", `${m.out.toFixed(1)} dB`, <Delta v={d.out} unit=" dB" digits={1} />)}
        {tile("F3", `${m.f3.toFixed(0)} Hz`, <Delta v={d.f3} unit=" Hz" lowerIsBetter />)}
      </div>
      <div className="text-xs leading-snug"><b className="font-semibold">Limited by:</b> {k.limitedBy}</div>
      {k.warnings.filter(([h]) => !/limited$/.test(h)).map(([h, b]) => (
        <div key={h} className="text-xs border border-l-4 rounded px-2 py-1 bg-amber-50 border-amber-200 border-l-amber-300"><b className="font-semibold text-amber-700 mr-1">{h}</b>{b}</div>
      ))}
      <div className="text-xs text-stone-600">✓ Duct fits · {sheets} · Qtc {k.build.qtc.toFixed(2)}</div>
      <div className="text-xs text-stone-600">Changes: {k.changed.length ? k.changed.join(", ") : "none"}</div>
      {!k.priceKnown && <div className="text-[11px] text-stone-500">Some prices unknown</div>}
      <div className="flex gap-1.5 mt-auto">
        <button onClick={onPreview} className="flex-1 px-3 py-2 rounded border text-sm border-stone-300 bg-stone-50 hover:border-stone-500">Preview</button>
        <button onClick={onLoad} className="flex-1 px-3 py-2 rounded border text-sm font-semibold border-cmy-c bg-cmy-c text-white">Load</button>
        <button onClick={onSave} disabled={!canSave} title={canSave ? "" : "Sign in to save"} className="flex-1 px-3 py-2 rounded border text-sm border-stone-300 bg-stone-50 hover:border-stone-500 disabled:opacity-40">Save</button>
      </div>
    </div>
  );
}
const seg = (on) => `px-3 py-2 rounded border text-sm ${on ? "border-stone-900 bg-stone-900 text-stone-50" : "border-stone-300 bg-stone-50 hover:border-stone-500"}`;
function OptimizerPanel({ optIn, setOpt, run, busy, res, err, curOut, amps, previewCard, onPreview, onLoad, onSave, canSave }) {
  const need = roomNeed(optIn.room), target = Math.max(curOut != null ? curOut : need, need);
  const goals = optIn.goals, g = goals[0];
  // tap adds a goal at the end of the order; tap again removes it (none selected is allowed; the search waits for one)
  const tapGoal = (k) => setOpt({ goals: goals.includes(k) ? goals.filter((x) => x !== k) : [...goals, k] });
  const tgtText = !g ? "pick a goal" : (g === "louder" ? "as loud as it gets, F3 within 3 Hz" : g === "lower" ? `lowest F3, at least ${(target - 1.5).toFixed(0)} dB per stack` : `clean ${target.toFixed(0)} dB per stack`)
    + (goals.length > 1 ? `, and ${goals.slice(1).map((x) => ({ cheaper: "cheaper", lighter: "lighter", lower: "lower", louder: "louder" })[x]).join(" and ")} than yours` : "");
  return (
    <section className="max-w-6xl mx-auto px-4 md:px-8 pb-4" style={{ fontFamily: "var(--font)" }}>
      <div className="rounded-lg border border-stone-300 bg-white p-4">
        <h2 className="text-xl" style={{ fontFamily: "var(--font)", fontWeight: 700 }}>Find a better design</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          <div className="mt-3">
            <div className="text-sm text-stone-500 mb-1">Room, sq ft</div>
            <div className="flex flex-wrap gap-1">{Object.entries(ROOMS).map(([k, r]) => <button key={k} aria-label={r.name} className={seg(String(optIn.room) === k)} onClick={() => setOpt({ room: k === "outdoor" ? k : +k })}>{r.short}</button>)}</div>
          </div>
          <div className="mt-3">
            <div className="text-sm text-stone-500 mb-1">Max per box</div>
            <div className="flex items-center gap-2 text-sm"><input type="number" inputMode="numeric" value={optIn.maxLb} min={30} max={250} onChange={(e) => setOpt({ maxLb: +e.target.value || 0 })} className="w-24 px-3 py-2 rounded border border-stone-300 bg-white" /> lb</div>
          </div>
          <div className="mt-3">
            <div className="text-sm text-stone-500 mb-1">Driver budget, per stack <span className="text-xs">(sub + mid + CD, at the listed prices)</span></div>
            <div className="flex flex-wrap items-center gap-2 text-sm"><input type="number" inputMode="numeric" value={optIn.budget} min={100} step={25} onChange={(e) => setOpt({ budget: +e.target.value || 0 })} className="w-24 px-3 py-2 rounded border border-stone-300 bg-white" /> $</div>
          </div>
          <div className="mt-3">
            <div className="text-sm text-stone-500 mb-1">Goal <span className="text-xs">(choose one or more, in priority order)</span></div>
            <div className="flex flex-wrap gap-1">{Object.entries(GOALS).map(([k, gg]) => { const i = goals.indexOf(k); return (
              <button key={k} title={gg.name} aria-pressed={i >= 0} className={`relative ${seg(i >= 0)}`} onClick={() => tapGoal(k)}>{goals.length > 1 && i >= 0 && <RankBadge n={i + 1} />}{gg.short}</button>); })}</div>
          </div>
        </div>
        <div className="mt-3 text-sm px-3 py-2 rounded border border-dashed border-stone-300 bg-stone-50">Target: {tgtText}
          {curOut != null && <div className="text-xs text-stone-500 mt-0.5">Music limit, 40–90 Hz. Yours: {curOut.toFixed(0)} dB · {ROOMS[optIn.room] ? ROOMS[optIn.room].name : ""} needs about {need.toFixed(0)} dB</div>}</div>
        <div className="mt-2 text-xs text-stone-500">Amps: {amps}</div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button onClick={run} disabled={busy || !g} className="px-4 py-2 rounded border text-sm font-semibold border-cmy-c bg-cmy-c text-white disabled:opacity-50">{busy ? "Searching…" : g ? "Find 3 designs" : "Pick a goal first"}</button>
          {res && !busy && <span className="text-xs text-stone-500">Searched {res.stats.evaluated.toLocaleString()} designs in {(res.stats.ms / 1000).toFixed(1)} s{res.cards.length ? " · every design shown passes the planner's build checks (warnings are listed on the card)" : ""}</span>}
          {err && <span className="text-xs text-red-700">{err}</span>}
        </div>
        {res && !busy && res.curProblems && res.curProblems.length > 0 && <div className="mt-2 text-xs text-amber-800 bg-amber-50 rounded border-l-4 border-amber-300 px-2 py-1">Your design fails: {res.curProblems.join("; ")}. Fixes may cost or weigh more.</div>}
        {res && !busy && res.cards.length > 0 && (<>
          <div className="mt-4 flex md:grid md:grid-cols-3 gap-3 overflow-x-auto snap-x snap-mandatory pb-1">
            {res.cards.map((k, i) => <OptCard key={i} k={k} i={i} n={res.cards.length} cur={res.cur} previewing={previewCard === k} canSave={canSave}
              onPreview={() => onPreview(k)} onLoad={() => onLoad(k)} onSave={() => onSave(k)} />)}
          </div>
          {res.cards.length > 1 && <div className="md:hidden text-xs text-stone-500 text-center mt-1">Swipe for {res.cards.length - 1} more</div>}
        </>)}
        {res && !busy && res.goalMissing && <div className="mt-2 text-xs text-amber-800 bg-amber-50 rounded border-l-4 border-amber-300 px-2 py-1">{res.goalMissing}</div>}
        {res && !busy && !res.cards.length && res.nearMiss && (
          <div className="mt-4 rounded-lg border border-orange-300 bg-orange-50 px-3 py-3">
            <h3 className="text-base" style={{ fontFamily: "var(--font)", fontWeight: 700 }}>Nothing fits all your limits</h3>
            <div className="text-xs text-orange-900 mt-1">{res.nearMiss.closest ? `Closest: ${res.nearMiss.closest.names.sub}, ${res.nearMiss.closest.metrics.heaviest.toFixed(0)} lb, ${money(res.nearMiss.closest.metrics.price)} per stack, ${res.nearMiss.closest.metrics.out.toFixed(1)} dB. ` : ""}Blocked by: {res.nearMiss.blocking.join("; ")}.</div>
            {res.nearMiss.options.length > 0 && <div className="flex flex-wrap gap-1.5 mt-2">{res.nearMiss.options.map((o) => (
              <button key={o.text} className={seg(false)} onClick={() => run(o.set)}>{o.text}</button>))}</div>}
          </div>
        )}
      </div>
    </section>
  );
}

function StackPlanner() {
  const viewOf = () => (window.location.hash === "#notes" ? "notes" : window.location.hash === "#fills" ? "fills" : window.location.hash === "#hifi" ? "hifi" : window.location.hash === "#cutlist" ? "cutlist" : "planner");
  const [view, setView] = useState(viewOf);
  useEffect(() => {
    const on = () => setView(viewOf());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const [sub, setSub] = useState(SUB_OPTIONS.find((o) => o.id === "sbnero18"));
  const [mid, setMid] = useState(MID_OPTIONS.find((o) => o.id === "sbnero12"));
  const [horn, setHorn] = useState(HORN_OPTIONS.find((h) => h.id === "a400g2"));
  const [cd, setCd] = useState(CD_OPTIONS.find((c) => c.id === "de360"));
  const [midBox, setMidBox] = useState(MID_BOXES.find((o) => o.id === "b15"));   // last preset loaded
  const [mDim, setMDim] = useState({ ...MID_BOXES.find((o) => o.id === "b15").box });
  const [xoLo, setXoLo] = useState(120);         // sub -> mid crossover, LR24
  const [xoHi, setXoHi] = useState(900);         // mid -> horn crossover, LR24
  const [mAmpW, setMAmpW] = useState(400);       // amp power per mid channel, into 8 Ω
  const [tilt, setTilt] = useState(6);           // how much less the mid band needs than the sub band, dB
  const [hfAmpW, setHfAmpW] = useState(100);     // amp power per HF channel, rated into 8 Ω
  const [hfTilt, setHfTilt] = useState(6);       // how much less the horn band needs than the mid band, dB
  const setM = (k, v) => setMDim((p) => ({ ...p, [k]: v }));
  const plinth = 3; // fixed, matches the duct height
  const [cutaway, setCutaway] = useState(false);
  const [cabinet, setCabinet] = useState(CABINETS[0]);
  const [portStyle, setPortStyle] = useState("slots");
  const [layout, setLayout] = useState("stack");
  const format = FORMATS[0];   // 18″ sub + compression driver; mid is 12″ or 15″
  const [midSize, setMidSize] = useState(12);
  const [wall, setWall] = useState(0.75);   // side/top/bottom/back ply, in
  const [inset, setInset] = useState(0.75); // how far the baffles sit back from the frame front, in
  const [baffleColor, setBaffleColor] = useState("#e8b4a8");
  const [cabFinish, setCabFinish] = useState("birch");
  const [spacerH, setSpacerH] = useState(20);
  const [showDetails, setShowDetails] = useState(false);
  // phones: settings live in a bottom sheet with tabs; result sections fold (remembered per viewer)
  const [sheetOpen, setSheetOpen] = useState(false);
  const [tab, setTab] = useState("sub");
  const tabCls = (t) => (tab === t ? "" : "max-md:hidden");
  const [folds, setFolds] = useState(() => {
    try { return { sub: true, mid: false, horn: false, totals: false, ...JSON.parse(localStorage.getItem("planner.folds") || "{}") }; }
    catch { return { sub: true, mid: false, horn: false, totals: false }; }
  });
  const toggleFold = (id) => setFolds((f) => { const n = { ...f, [id]: !f[id] }; try { localStorage.setItem("planner.folds", JSON.stringify(n)); } catch {} return n; });
  const foldCls = (id) => (folds[id] ? "" : "max-md:hidden");
  const [full3d, setFull3d] = useState(false);
  // optimizer: switch, inputs and locks remembered per viewer
  const lsGet = (k, fb) => { try { const v = localStorage.getItem(k); return v == null ? fb : JSON.parse(v); } catch { return fb; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const [optOn, setOptOnRaw] = useState(() => lsGet("planner.opt", false));
  const setOptOn = (v) => { setOptOnRaw(v); lsSet("planner.opt", v); };
  // goals start empty on every load (not restored), so a search always starts from a goal you just picked
  const [optIn, setOptIn] = useState(() => { const { budgetPer, goal, goals, ...o } = lsGet("planner.optIn", {}) || {};
    return { room: 1000, maxLb: 125, budget: 900, ...o, goals: [] }; });
  const setOpt = (o) => setOptIn((p) => { const n = { ...p, ...o }; lsSet("planner.optIn", n); return n; });
  const [locks, setLocksRaw] = useState(() => { const l = lsGet("planner.locks", {}) || {}; return { ...l, subDim: { ...(l.subDim || {}) }, midDim: { ...(l.midDim || {}) } }; });
  const setLocks = (f) => setLocksRaw((p) => { const n = f(p); lsSet("planner.locks", n); return n; });
  const lk = (key, what) => optOn ? <LockBtn on={!!locks[key]} what={what} onClick={() => setLocks((p) => ({ ...p, [key]: !p[key] }))} /> : null;
  const dl = (box, dim, what) => optOn ? <DimLock mode={locks[box][dim] || "free"} what={what} onChange={(m) => setLocks((p) => ({ ...p, [box]: { ...p[box], [dim]: m } }))} /> : null;
  const [optRes, setOptRes] = useState(null);
  const [optBusy, setOptBusy] = useState(false);
  const [optErr, setOptErr] = useState("");
  const [preview, setPreview] = useState(null);   // { label, before }
  const [undoSnap, setUndoSnap] = useState(null);
  const [toast, setToast] = useState("");
  useEffect(() => {
    if (!full3d) return;
    const esc = (e) => { if (e.key === "Escape") setFull3d(false); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [full3d]);
  const [joint, setJoint] = useState("butt");       // cutlist corner joints
  const [sheetKind, setSheetKind] = useState("4x8");
  const [sets, setSets] = useState(2);   // "tops on spacers": spacer height, in   // "birch", "walnut" or a paint hex
  // Every cabinet is custom; the preset list below is only a starting point.
  const [cDim, setCDim] = useState({ w: 28, h: 32, d: 24 });
  const [cVent, setCVent] = useState({ slotH: 3, nt: 2, dia: 6, throat: 3, len: 14 });
  const [hpf, setHpf] = useState(33);
  const [hpType, setHpType] = useState("BW24");   // sub highpass alignment
  const [ampW, setAmpW] = useState(800);   // amp power per sub channel, into 8 Ω
  const [portMax, setPortMax] = useState(20);   // peak port air speed allowed, m/s
  const setC = (k, v) => setCDim((p) => ({ ...p, [k]: v }));
  const setV = (k, v) => setCVent((p) => ({ ...p, [k]: v }));

  // ---- saved configurations, backed by the artifact's document store ----
  const [db, setDb] = useState(null);
  const [saved, setSaved] = useState(null);     // null = still loading
  const [cfgName, setCfgName] = useState("");
  const [cfgMsg, setCfgMsg] = useState("");
  const [selCfg, setSelCfg] = useState("");
  // Firebase (github.io build): signed-in users keep configs under users/{uid}/.
  const [fbUser, setFbUser] = useState(null);
  const fb = !(window.claude && window.claude.use) && window.firebase && window.PLANNER_FIREBASE ? window.firebase : null;
  useEffect(() => {
    let live = true;
    if (fb) {
      if (!fb.apps.length) fb.initializeApp(window.PLANNER_FIREBASE);
      const un = fb.auth().onAuthStateChanged((u) => {
        if (!live) return;
        setFbUser(u);
        if (u) {
          const fs = fb.firestore();
          setDb({ collection: (name) => fs.collection(`users/${u.uid}/${name}`) });
        } else { setDb(null); setSaved([]); }
      });
      return () => { live = false; un(); };
    }
    (async () => {
      try {
        const d = window.claude && window.claude.use ? await window.claude.use("db") : null;
        if (live) { setDb(d); if (!d) setSaved([]); }
      } catch { if (live) { setDb(null); setSaved([]); } }
    })();
    return () => { live = false; };
  }, []);
  const signIn = () => fb.auth().signInWithPopup(new fb.auth.GoogleAuthProvider()).catch(() => { setCfgMsg("Sign-in failed"); setTimeout(() => setCfgMsg(""), 2500); });
  const signOut = () => fb.auth().signOut();
  // One-time copy of the configs saved in the claude.ai artifact (data/configs-seed.json).
  const importSeed = async () => {
    if (!db) return;
    setCfgMsg("Importing…");
    try {
      const rows = await (await fetch("configs-seed.json")).json();
      const have = new Set((saved || []).map((c) => c.name));
      let n = 0;
      for (const { id, ...c } of rows) {
        if (have.has(c.name)) continue;
        await db.collection("configs").doc(id).set(c); n++;
      }
      setCfgMsg(n ? `Imported ${n}` : "Nothing new to import");
    } catch { setCfgMsg("Couldn't import"); }
    setTimeout(() => setCfgMsg(""), 2500);
  };
  useEffect(() => {
    if (!db) return;
    const un = db.collection("configs").orderBy("savedAt", "desc").limit(50).onSnapshot(
      (snap) => setSaved(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => setSaved([])
    );
    return un;
  }, [db]);
  // In the tower layout the mid chamber is the sub's footprint, 15.5 in tall.
  const midDims = layout === "tower" ? { w: cDim.w, h: 15.5, d: cDim.d } : mDim;
  const midSel = { ...mid, box: midDims };
  const subList = SUB_OPTIONS.filter((o) => o.size === format.sub);
  const midList = MID_OPTIONS.filter((o) => (o.size || 12) === midSize);
  const boxList = MID_BOXES.filter((b) => (b.size || 12) === midSize && b.id !== "b13");
  const subBox = cDim;
  // Load a published cabinet into the sliders as a starting point.
  const startFrom = (cb) => {
    const d = cb.dims[format.sub];
    setCabinet(cb);
    setCDim({ w: d.w, h: d.h, d: d.d });
    const v = cb.vents[0];
    setPortStyle(v === "round1" || v === "round4" ? "round2" : v);
    if (v === "round1") setCVent((p) => ({ ...p, nt: 1, dia: 8, len: 11 }));
    else if (v === "round4") setCVent((p) => ({ ...p, nt: 4, dia: 4, len: 11.5 }));
    else if (v === "round2") setCVent((p) => ({ ...p, nt: 2, dia: 5, len: 9.8 }));
    else if (v === "folded") setCVent((p) => ({ ...p, slotH: 3, len: 15.75 }));
    else if (v === "vslots") setCVent((p) => ({ ...p, throat: 1.4, len: d.d - 3 }));
    else setCVent((p) => ({ ...p, slotH: 3, len: d.d - 4.5 }));
    if (cb.vent) setCVent((p) => ({ ...p, ...cb.vent }));   // published vent overrides the generic one
  };
  const subSel = { ...sub, box: subBox };
  useEffect(() => {
    const pickOf = (list) => list.find((o) => o.pick) || list[0];
    if (subList.length) setSub(pickOf(subList));
    if (midList.length) setMid(pickOf(midList));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format]);
  // Switching 12/15 picks that size's default driver and box; restoring a config sets them itself.
  const skipSizeReset = useRef(true);
  useEffect(() => {
    if (skipSizeReset.current) { skipSizeReset.current = false; return; }
    const pickOf = (list) => list.find((o) => o.pick) || list[0];
    if (midList.length) setMid(pickOf(midList));
    if (boxList.length) { const b = pickOf(boxList); setMidBox(b); setMDim({ ...b.box }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [midSize]);
  const mismatch = horn.exit !== cd.exit;

  // Port geometry, matching what the 3D view draws, so the table and the
  // model describe the same box.
  const PT = wall;
  const { port, grossL, netL, AMP_V, mdl, lim } = subSystem(sub, mid, {
    subBox, midDims: mDim, wall, inset, portStyle, cVent, hpf, hpType, ampW, portMax, layout });
  // Max SPL for a sine at each frequency (each frequency meets its own port and excursion limits);
  // the broadband limit above is what applies to music.
  const maxCurve = mdl ? maxCurveOf(mdl.curve, sub.ts, AMP_V, portMax) : null;
  const maxNear = (f) => maxCurve.reduce((b, o) => (Math.abs(o.f - f) < Math.abs(b.f - f) ? o : b));

  // ---- mid-bass: sealed box ----
  const { V: MID_V, grossL: midGrossL, netL: midNetL, effL: midEffL, mdl: mMdl, vTherm: vMidTherm, max: midMax, useV: midUseV } =
    midSystem(mid, { midDims, wall, inset, xoLo, xoHi, mAmpW });
  // 3/4" baffle at 2.3 lb/ft\u00b2, other panels and one brace at the chosen ply, plus 2 lb of hardware
  const midCabLb = midWeight(midDims, wall);
  const midLbLoaded = midCabLb + (mid.lb || 0);
  const midNear = (f) => midMax.reduce((b, o) => (Math.abs(o.f - f) < Math.abs(b.f - f) ? o : b));
  // Sub through its lowpass at the crossover, for the system chart. Its own limits scale with the filter.
  const subSys = mdl ? subThroughLp(mdl, sub.ts, AMP_V, portMax, xoLo) : null;
  // What the mid actually has to match: the sub at its music limit (one drive level for
  // the whole band), through its lowpass, less the music-balance allowance.
  // ---- horn + compression driver ----
  // Datasheet model, not T/S: on-horn sensitivity + 10 log P, shaped by the LR24
  // highpass at the crossover and a 12 dB/oct rolloff below the horn's loading limit.
  // Power: amp voltage into the driver's impedance, capped at program (2 x AES), derated
  // 6 dB per octave when crossing below the frequency the AES rating was measured at.
  const hf = cd.hf, hz = horn.hf || {};
  const hornModel = hornResponse(hf, hz, xoHi, hfAmpW);
  const hornAt = (f) => hornModel.curve.reduce((b, o) => (Math.abs(o.f - f) < Math.abs(b.f - f) ? o : b)).spl;
  // mid beamwidth at the horn crossover, as a rigid piston: -6 dB where ka sin(theta) = 2.2
  const midBeam = mid.ts ? pistonBeam(mid.ts.Sd, xoHi) : null;
  // Horizontal beamwidth against frequency: mid as a rigid piston, horn at its rated coverage down
  // to Keele's pattern-control limit and proportionally wider below. Rules of thumb.
  const beamCurves = (() => {
    const hz0 = horn.hf || {};
    const fK = hz0.covH && horn.size ? keeleF(hz0.covH, horn.size.w) : null;
    const midB = [], hornB = [];
    for (let i = 0; i < 160; i++) {
      const f = 200 * Math.pow(10000 / 200, i / 159);
      if (mid.ts) midB.push({ f, spl: pistonBeam(mid.ts.Sd, f) });
      if (fK && f >= (hz0.lowHz || 0) * 0.7) hornB.push({ f, spl: hornBeam(hz0.covH, fK, f) });
    }
    return { midB, hornB, fK };
  })();

  const subMusicAtXo = mdl && lim ? subMusicAt(mdl, lim, AMP_V, xoLo) : null;

  const portGeom = { ductH: cVent.slotH, nPorts: cVent.nt, portR: cVent.dia / 2, tubeLen: cVent.len, throat: cVent.throat };

  // One named snapshot of the whole system.
  const snapshot = () => ({
    format: format.id, sub: sub.id, mid: mid.id, midBox: midBox.id, cd: cd.id, horn: horn.id,
    cabinet: cabinet.id, portStyle, cDim, cVent, hpf, hpType, ampW, portMax, mDim, wall, inset, xoLo, xoHi, mAmpW, tilt, hfAmpW, hfTilt,
    layout, cutaway, baffleColor, cabFinish, spacerH, joint,
    summary: `${sub.name} · ${subBox.w}×${subBox.h}×${subBox.d}″ · ${port.area.toFixed(0)} in² · ${mdl ? mdl.Fb.toFixed(1) + " Hz" : "—"}`
  });
  const restore = (c) => {
    const find = (list, id, fb) => list.find((o) => o.id === id) || fb;
    if (c.wall === 0.5 || c.wall === 0.75) setWall(c.wall); else setWall(0.75);
    setInset(typeof c.inset === "number" ? c.inset : 0.75);
    if (c.sub) setSub(find(SUB_OPTIONS, c.sub, sub));
    if (c.mid) { const m = find(MID_OPTIONS, c.mid, mid); skipSizeReset.current = (m.size || 12) !== midSize; setMidSize(m.size || 12); setMid(m); }
    if (c.midBox) setMidBox(find(MID_BOXES, c.midBox, midBox));
    if (c.cd) setCd(find(CD_OPTIONS, c.cd, cd));
    if (c.horn) setHorn(find(HORN_OPTIONS, c.horn, horn));
    if (c.cDim) setCDim(c.cDim);
    if (c.cVent) setCVent(c.cVent);
    if (typeof c.hpf === "number") setHpf(c.hpf);
    if (c.hpType && HP_TYPES[c.hpType]) setHpType(c.hpType);
    if (typeof c.ampW === "number") setAmpW(c.ampW);
    if (typeof c.portMax === "number") setPortMax(c.portMax);
    if (c.mDim) setMDim(c.mDim); else if (c.midBox) { const b = MID_BOXES.find((x) => x.id === c.midBox); if (b) setMDim({ ...b.box }); }
    if (typeof c.xoLo === "number") setXoLo(c.xoLo);
    if (typeof c.xoHi === "number") setXoHi(c.xoHi);
    if (typeof c.mAmpW === "number") setMAmpW(c.mAmpW);
    if (typeof c.tilt === "number") setTilt(c.tilt);
    if (typeof c.hfAmpW === "number") setHfAmpW(c.hfAmpW);
    if (typeof c.hfTilt === "number") setHfTilt(c.hfTilt);
    if (typeof c.cutaway === "boolean") setCutaway(c.cutaway);
    if (c.layout) setLayout(c.layout);
    if (c.baffleColor) setBaffleColor(c.baffleColor);
    setCabFinish(c.cabFinish || "birch");
    setSpacerH(typeof c.spacerH === "number" ? c.spacerH : 20);
    if (c.joint) setJoint(c.joint);
    if (c.portStyle) setPortStyle(c.portStyle);
  };
  const saveCfg = async () => {
    const name = cfgName.trim();
    if (!db || !name) return;
    setCfgMsg("Saving…");
    try {
      await db.collection("configs").doc().set({ name, savedAt: Date.now(), ...snapshot() });
      setCfgName(""); setCfgMsg("Saved");
    } catch (e) {
      setCfgMsg(e && (e.code === "invalid_argument" || e.code === "permission-denied") ? "You don't have write access here" : "Couldn't save — try again");
    }
    setTimeout(() => setCfgMsg(""), 2500);
  };
  const delCfg = async (id) => {
    if (!db) return;
    try { await db.collection("configs").doc(id).delete(); }
    catch { setCfgMsg("Couldn't delete"); setTimeout(() => setCfgMsg(""), 2500); }
  };
  // ---- optimizer actions ----
  const today = () => new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const runOpt = async (over) => {
    const inp = { ...optIn, ...(over && over.nativeEvent ? {} : over || {}) };
    if (over && !over.nativeEvent) setOpt(over);
    if (!inp.goals.length) return;
    setOptBusy(true); setOptErr("");
    try {
      const cur = preview ? preview.before : snapshot();
      setOptRes(await runOptimizer({ cur, room: inp.room, maxLb: inp.maxLb, budget: inp.budget, goals: inp.goals, locks }));
    } catch (e) { setOptErr("The search failed: " + ((e && e.message) || e)); }
    setOptBusy(false);
  };
  // a result only sets the fields the search changes; finish, colours, layout and balance stay as they are now
  const optPreview = (k) => {
    const before = preview ? preview.before : snapshot();
    restore({ ...snapshot(), ...optFields(k.config) }); setPreview({ label: k.label, before, card: k });
  };
  const optBack = () => { if (preview) restore(preview.before); setPreview(null); };
  const optLoad = async (k) => {
    const before = preview ? preview.before : snapshot();
    restore({ ...snapshot(), ...optFields(k.config) }); setPreview(null); setUndoSnap(before);
    let msg = `Loaded "${k.label}".`;
    if (db) {
      const name = `Before optimizer, ${today()}`;
      try { await db.collection("configs").doc().set({ ...before, name, savedAt: Date.now() }); msg += ` Your previous design was saved as "${name}".`; }
      catch { msg += " Undo brings your previous design back."; }
    } else msg += " Undo brings your previous design back.";
    setToast(msg);
  };
  const optUndo = () => { if (undoSnap) restore(undoSnap); setUndoSnap(null); setToast(""); };
  const optSave = async (k) => {
    if (!db) return;
    const name = window.prompt("Name this design", `${k.label} · ${today()}`);
    if (!name) return;
    const m = k.metrics;
    try {
      await db.collection("configs").doc().set({ ...snapshot(), ...optFields(k.config), name: name.slice(0, 60), savedAt: Date.now(),
        summary: `${k.names.sub} · ${k.config.cDim.w}×${k.config.cDim.h}×${k.config.cDim.d}″ · ${m.Fb.toFixed(1)} Hz` });
      setToast(`Saved "${name.slice(0, 60)}".`);
    } catch { setToast("Couldn't save — try again"); }
  };
  const curOut = optOn ? (() => { try { const m = evaluateConfig(preview ? preview.before : snapshot()); return m ? m.out : null; } catch { return null; } })() : null;

  const subLbLoaded = subWeight(subBox, wall, sub.lb);

  const midL = midGrossL;
  const subTopH = plinth + subBox.h;
  const isTower = layout === "tower";
  const baseH = layout === "satellite" ? 34 : layout === "pole" ? subTopH + spacerH : isTower ? subTopH : subTopH + 0.4;
  const archT = isTower && !!horn.profile && !horn.scaleX && subBox.w / 2 - 0.75 > horn.size.w / 2;
  const stackH = isTower ? baseH + 15.5 + (archT ? subBox.w - 0.75 : horn.size.h + 2) : baseH + midDims.h + 1.2 + horn.size.h + 2;
  const hornCenter = isTower ? baseH + 15.5 + (archT ? subBox.w / 2 - 0.75 : (horn.size.h + 2) / 2) : baseH + midDims.h + 1.2 + 1 + horn.size.h / 2;

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900" style={{ fontFamily: "var(--font)" }}>
      <header className="px-4 md:px-8 pt-6 md:pt-8 pb-4 max-w-6xl mx-auto">
        <h1 className="text-3xl md:text-4xl leading-tight font-extrabold tracking-tight">SpeakNow</h1>
        {(() => {
          // two levels: the project (PA stack or hi-fi), then the PA stack's own pages
          const go = (v, href) => (e) => { e.preventDefault(); try { history.replaceState(null, "", v === "planner" ? " " : href); } catch {} setView(v); window.scrollTo(0, 0); };
          const pa = view !== "hifi";
          const top = [["planner", "PA Stack", "#", pa], ["hifi", "Hi-fi", "#hifi", !pa]];
          const sub = [["planner", "Design", "#"], ["cutlist", "Cutlist", "#cutlist"], ["fills", "Fills", "#fills"], ["notes", "Notes", "#notes"]];
          return (<>
            <nav className="flex gap-1 mt-3" style={{ fontFamily: "var(--font)" }} aria-label="Projects">
              {top.map(([v, label, href, on]) => (
                <a key={v} href={href} aria-current={on ? "page" : undefined} onClick={go(v, href)}
                  className={`px-4 py-2 rounded border-2 text-base font-semibold ${on ? "border-stone-900 bg-stone-900 text-stone-50" : "border-stone-300 hover:border-stone-500"}`}>{label}</a>
              ))}
            </nav>
            {pa && (
              <nav className="flex gap-4 mt-3 border-b border-stone-300" style={{ fontFamily: "var(--font)" }} aria-label="PA stack pages">
                {sub.map(([v, label, href]) => (
                  <a key={v} href={href} aria-current={view === v ? "page" : undefined} onClick={go(v, href)}
                    className={`py-2 -mb-px border-b-2 text-sm ${view === v ? "border-stone-900 font-semibold" : "border-transparent text-stone-500 hover:text-stone-900"}`}>{label}</a>
                ))}
              </nav>
            )}
          </>);
        })()}
      </header>
      {view === "notes" ? <NotesPage /> : view === "fills" ? <FillsPage /> : view === "hifi" ? <HifiPage /> : view === "cutlist" ? <CutlistPage {...{ sub, mid, subBox, midDims, wall, inset, joint, setJoint, sheetKind, setSheetKind, sets, setSets, portStyle, cVent, layout }} /> : <>

      {saved !== null && (
        <section className="max-w-6xl mx-auto px-4 md:px-8 pb-2" style={{ fontFamily: "var(--font)" }}>
          <div className="rounded-lg border border-stone-300 bg-stone-50 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-stone-500 mr-1">Saved configurations</span>
              {db ? (<>
                <input value={cfgName} onChange={(e) => setCfgName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveCfg(); }}
                  placeholder="Name this setup" maxLength={60}
                  className="px-3 py-1.5 rounded border border-stone-300 bg-white text-sm w-56 focus:outline-none focus:border-stone-900" />
                <button onClick={saveCfg} disabled={!cfgName.trim()}
                  className="px-3 py-1.5 rounded border text-sm border-stone-900 bg-stone-900 text-stone-50 disabled:opacity-35 disabled:cursor-not-allowed">Save current</button>
                {cfgMsg && <span className="text-xs text-stone-500">{cfgMsg}</span>}
                {fbUser && (<span className="ml-auto flex items-center gap-3 text-xs text-stone-500">
                  <button onClick={importSeed} className="hover:underline">Import saved configs</button>
                  <button onClick={signOut} className="hover:underline">Sign out</button>
                </span>)}
              </>) : fb ? (<>
                <button onClick={signIn}
                  className="px-3 py-1.5 rounded border text-sm border-stone-900 bg-stone-900 text-stone-50">Sign in with Google to save</button>
                {cfgMsg && <span className="text-xs text-stone-500">{cfgMsg}</span>}
              </>) : (
                <span className="text-xs text-stone-500">Saving is unavailable in this view. Everything else works.</span>
              )}
            </div>
            {saved.length > 0 && (() => {
              const cur = saved.find((c) => c.id === selCfg);
              return (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <select value={cur ? cur.id : ""} aria-label="Load a saved configuration"
                    onChange={(e) => { const c = saved.find((x) => x.id === e.target.value); setSelCfg(e.target.value); if (c) restore(c); }}
                    className="px-2 py-1.5 rounded border border-stone-300 bg-white text-sm min-w-0 max-w-full flex-1">
                    <option value="" disabled>Load a saved configuration ({saved.length})…</option>
                    {saved.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}{c.savedAt ? ` · ${new Date(c.savedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : ""}</option>
                    ))}
                  </select>
                  {cur && <button onClick={() => { delCfg(cur.id); setSelCfg(""); }} aria-label={`Delete ${cur.name}`}
                    className="text-xs text-stone-400 hover:text-red-700 px-1">Delete</button>}
                  {cur && cur.summary && <div className="basis-full text-xs text-stone-500 truncate">{cur.summary}</div>}
                </div>
              );
            })()}
          </div>
        </section>
      )}

      <section className="max-w-6xl mx-auto px-4 md:px-8 pb-3 flex flex-wrap items-center gap-2" style={{ fontFamily: "var(--font)" }}>
        <button onClick={() => setOptOn(!optOn)} aria-pressed={optOn}
          className={`px-3 py-2 rounded border text-sm ${optOn ? "border-stone-900 bg-stone-900 text-stone-50" : "border-stone-300 bg-stone-50 hover:border-stone-500"}`}>Optimizer: {optOn ? "on" : "off"}</button>
        {optOn && (() => {
          const n = Object.entries(locks).reduce((a, [k, v]) => a + (k.endsWith("Dim") ? Object.values(v).filter((m) => m && m !== "free").length : v ? 1 : 0), 0);
          const tip = n ? `Clear all ${n} lock${n > 1 ? "s" : ""}` : "No locks set";
          // lock everything (box sizes exact), then unlock the one or two things you want the optimizer to change
          const all = { ...Object.fromEntries(LOCK_KEYS.map((k) => [k, true])), subDim: { w: "exact", h: "exact", d: "exact" }, midDim: { w: "exact", h: "exact", d: "exact" } };
          const full = n >= LOCK_KEYS.length + 6;
          return (<>
            <button onClick={() => setLocks(() => all)} disabled={full} aria-label="Lock everything" title="Lock everything, then unlock what the optimizer may change"
              className="inline-flex items-center gap-1 px-3 py-2 rounded border text-sm border-stone-300 bg-stone-50 hover:border-stone-500 disabled:opacity-40"><LockIcon locked={true} /><span className="text-xs">All</span></button>
            <button onClick={() => setLocks(() => ({ subDim: {}, midDim: {} }))} disabled={!n} aria-label={tip} title={tip}
              className="inline-flex items-center gap-1 px-3 py-2 rounded border text-sm border-stone-300 bg-stone-50 hover:border-stone-500 disabled:opacity-40"><LockIcon locked={false} />{n ? <span className="text-xs">{n}</span> : null}</button>
          </>);
        })()}
        {!optOn && <span className="text-xs text-stone-500">Find cheaper, lighter or louder designs inside your limits.</span>}
      </section>
      {optOn && <OptimizerPanel optIn={optIn} setOpt={setOpt} run={runOpt} busy={optBusy} res={optRes} err={optErr} curOut={curOut}
        amps={[["sub", ampW, locks.ampW, 3000], ["mid", mAmpW, locks.mAmpW, 2000], ["HF", hfAmpW, locks.hfAmpW, 500]].map(([n, w, l, mx]) => `${n} ${l ? `${w} W` : `any up to ${mx} W`}`).join(" · ") + " per channel (unlocked amps come back at the least power that does the job)"} previewCard={preview && preview.card} canSave={!!db}
        onPreview={optPreview} onLoad={optLoad} onSave={optSave} />}
      {preview && (
        <div className="fixed top-0 inset-x-0 z-50 bg-stone-900 text-white border-b-4 border-cmy-y px-4 py-2 flex flex-wrap items-center justify-center gap-3 text-sm" style={{ fontFamily: "var(--font)" }}>
          <span>Previewing: <b className="font-semibold">{preview.label}</b></span>
          <button onClick={() => optLoad(preview.card)} className="px-3 py-1.5 rounded border font-semibold border-cmy-c bg-cmy-c text-white">Load</button>
          <button onClick={optBack} className="px-3 py-1.5 rounded border border-stone-900 bg-white">Back</button>
        </div>
      )}
      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-20 md:bottom-6 z-50 w-[calc(100%-2rem)] max-w-xl bg-stone-900 text-stone-50 rounded-lg px-4 py-2.5 flex items-center gap-3 text-sm shadow-lg" style={{ fontFamily: "var(--font)" }} role="status">
          <span className="flex-1">{toast}</span>
          {undoSnap && <button onClick={optUndo} className="px-3 py-1.5 rounded border border-stone-500">Undo</button>}
          <button onClick={() => setToast("")} aria-label="Dismiss" className="px-2 py-1.5 rounded border border-stone-700">✕</button>
        </div>
      )}
      {mdl && lim && (
        <div className="md:hidden sticky top-0 z-30 bg-stone-100/95 backdrop-blur border-b border-stone-300 px-4 py-1.5 grid grid-cols-4 gap-2 text-center" style={{ fontFamily: "var(--font)" }}>
          {[["Fb", `${mdl.Fb.toFixed(1)}`, "Hz"], ["35 Hz", `${maxNear(35).spl.toFixed(0)}`, "dB"], ["Sub", `${subLbLoaded.toFixed(0)}`, "lb"], ["Limit", { "port air speed": "port", "cone travel (Xmax)": "Xmax", "driver program rating": "thermal", "amplifier power": "amp" }[lim.who] || lim.who, ""]].map(([k, v, u]) => (
            <div key={k}><div className="text-[10px] uppercase tracking-wider text-stone-500">{k}</div><div className="text-sm font-medium tabular-nums">{v}<span className="text-[10px] text-stone-500 ml-0.5">{u}</span></div></div>
          ))}
        </div>
      )}
      <main className={`max-w-6xl mx-auto px-4 md:px-8 pb-16 grid ${sheetOpen ? "max-md:pb-[52dvh]" : "max-md:pb-24"} grid-cols-1 md:grid-cols-5 gap-8`}>
        <div className="min-w-0 md:col-span-3 flex flex-col gap-5">
        <section className={full3d ? "fixed inset-0 z-50 bg-stone-50" : "relative rounded-lg overflow-hidden border border-stone-300 bg-stone-50 h-[300px] md:h-[clamp(320px,56vh,560px)]"}>
          <button onClick={() => setFull3d((v) => !v)} aria-label={full3d ? "Close full screen" : "Full screen"}
            className="absolute top-2 right-2 z-10 px-2.5 py-1 rounded border border-stone-300 bg-white/90 text-xs" style={{ fontFamily: "var(--font)" }}>{full3d ? "Close" : "Full screen"}</button>
          <StackView sub={subSel} mid={midSel} horn={horn} plinth={plinth} cutaway={cutaway} portStyle={portStyle} layout={layout} baffleColor={baffleColor} portGeom={portGeom} wall={wall} inset={inset} cabFinish={cabFinish} spacerH={spacerH} />
        </section>

        <section className="mt-1" style={{ fontFamily: "var(--font)" }}>
          <FoldHead id="sub" title="Sub" folds={folds} toggle={toggleFold} className="mb-3 md:hidden" />
          <div className={foldCls("sub")}>
          {mdl && lim && (
            <div className="grid gap-px mb-4 rounded-lg overflow-hidden border border-stone-300 bg-stone-200 grid-cols-2 sm:grid-cols-[repeat(auto-fit,minmax(112px,1fr))] [&>*:last-child:nth-child(odd)]:col-span-2 sm:[&>*:last-child:nth-child(odd)]:col-span-1">
              {[
                ["Net volume", netL.toFixed(0), "L"],
                ["Tuning Fb", mdl.Fb.toFixed(1), "Hz"],
                ["System F3", mdl.f3.toFixed(0), "Hz"],
                ["Max SPL @ 35 Hz", maxNear(35).spl.toFixed(1), "dB"],
                ["Weight", subLbLoaded.toFixed(0), "lb"],
              ].map(([k, v, u]) => (
                <div key={k} className="bg-stone-50 px-3 py-2.5">
                  <div className="text-[10.5px] uppercase tracking-wider text-stone-500 font-semibold">{k}</div>
                  <div className="text-xl font-medium tabular-nums mt-0.5 break-words">{v}<span className="text-xs text-stone-500 ml-0.5">{u}</span></div>
                </div>
              ))}
            </div>
          )}
          {mdl && lim && <div className="mb-4"><ResponseChart fmax={20000} series={[{ curve: subSys, label: "Sub", stroke: "#111111", tint: "rgba(17,17,17,0.07)" }, ...(midMax ? [{ curve: midMax, label: "Mid-bass", stroke: "#e5007e", tint: "rgba(229,0,126,0.06)" }] : []), ...(hornModel ? [{ curve: hornModel.curve, label: "Horn", stroke: "#0082c8", tint: "rgba(0,130,200,0.06)" }] : [])]} marks={[{ f: mdl.Fb, label: "Fb" }, { f: xoLo, label: "XO" }, { f: xoHi, label: "XO" }]} /></div>}
          {mdl ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-0.5 text-sm">
              {[
                ["Gross internal", `${grossL.toFixed(0)} L`],
                ["Port area", `${port.area.toFixed(1)} in²`, `${((port.area / (sub.ts.Sd / 6.4516)) * 100).toFixed(0)}% of cone area`],
                ["Hydraulic diameter", `${port.dh.toFixed(2)}″`, port.dh < 2 ? "low — flare the mouths" : "acceptable with flares"],
                ["Midband sensitivity", `${(mdl.ref - 20 * Math.log10(AMP_V / 2.83)).toFixed(1)} dB`, "2.83 V, half space, 1 m"],
                ...[30, 35, 45, 60].map((f) => { const m = maxNear(f);
                  return [`Max SPL at ${f} Hz`, `${m.spl.toFixed(1)} dB`, `sine, ${m.who}-limited`]; }),
                ["First limit, music", lim.who, `at ${Math.round(lim.W / 10) * 10} W${lim.who === "cone travel (Xmax)" ? `, reached first at ${mdl.peakXF.toFixed(0)} Hz` : lim.who === "port air speed" ? `, reached first at ${mdl.peakVelF.toFixed(0)} Hz` : ""}; the two rows below are at this power`],
                ["Peak port velocity", `${lim.vel.toFixed(1)} m/s`, `at ${mdl.peakVelF.toFixed(0)} Hz`],
                ["Peak excursion", `${(mdl.peakX * lim.V / AMP_V).toFixed(1)} mm`, `${lim.xPct.toFixed(0)}% of Xmax, at ${mdl.peakXF.toFixed(0)} Hz`],
              ].map(([k, v, note]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-stone-200 py-1">
                  <span className="text-stone-500 shrink-0">{k}</span>
                  <span className="text-right">
                    <span className="font-medium tabular-nums">{v}</span>
                    {note ? <span className="block text-xs text-stone-500">{note}</span> : null}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-stone-600 ">
              {sub.name} can't be modelled yet: its parameters are incomplete. {sub.note}
            </p>
          )}
          {mdl && lim && (
            <div className="flex flex-col gap-1.5 mt-4">
              {(() => {
                const F = subChips({ subSize: format.sub, subBox, portStyle, cVent, PT, subLbLoaded, lim, peakXF: mdl.peakXF, aes: sub.ts.aes, ampW });
                return F.map(([kind, head, body]) => (
                  <div key={head} className={`block text-xs leading-relaxed px-3 py-2 rounded border ${CHIP_BG[kind] || CHIP_BG.ok}`}>
                    <b className={`font-semibold mr-1.5 ${kind === "ok" ? "text-green-800" : kind === "warn" ? "text-amber-700" : "text-red-700"}`}>{head}</b>
                    <span className="text-stone-600">{body}</span>
                  </div>
                ));
              })()}
            </div>
          )}
          </div>
        </section>

        <section className="mt-2" style={{ fontFamily: "var(--font)" }}>
          <FoldHead id="mid" title="Mid-bass" folds={folds} toggle={toggleFold} className="mb-3" />
          <div className={foldCls("mid")}>
          {mMdl ? (<>
            <div className="grid gap-px mb-4 rounded-lg overflow-hidden border border-stone-300 bg-stone-200 grid-cols-2 sm:grid-cols-[repeat(auto-fit,minmax(112px,1fr))] [&>*:last-child:nth-child(odd)]:col-span-2 sm:[&>*:last-child:nth-child(odd)]:col-span-1">
              {[
                ["Net volume", midNetL.toFixed(0), "L"],
                ["Box resonance Fc", mMdl.Fc.toFixed(0), "Hz"],
                ["Box F3", mMdl.f3.toFixed(0), "Hz"],
                [`Max SPL @ ${xoLo} Hz`, midNear(xoLo).spl.toFixed(1), "dB"],
                ["Weight", midLbLoaded.toFixed(0), "lb"],
              ].map(([k, v, u]) => (
                <div key={k} className="bg-stone-50 px-3 py-2.5">
                  <div className="text-[10.5px] uppercase tracking-wider text-stone-500 font-semibold">{k}</div>
                  <div className="text-xl font-medium tabular-nums mt-0.5 break-words">{v}<span className="text-xs text-stone-500 ml-0.5">{u}</span></div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-0.5 text-sm">
              {[
                ["Gross internal", `${midGrossL.toFixed(0)} L`, `acts like ${midEffL.toFixed(0)} L stuffed`],
                ["Qtc", mMdl.Qtc.toFixed(2), mMdl.Qtc > 0.8 ? "peaky" : mMdl.Qtc < 0.5 ? "very damped" : "well damped"],
                ["Midband sensitivity", `${(mMdl.ref - 20 * Math.log10(MID_V / 2.83)).toFixed(1)} dB`, "2.83 V, half space, 1 m"],
                ...[xoLo, 200, 500].map((f) => { const m = midNear(f);
                  return [`Max SPL at ${f} Hz`, `${m.spl.toFixed(1)} dB`, `sine, ${m.who}-limited`]; }),
                ["Peak excursion", `${(mMdl.peakX * midUseV / MID_V).toFixed(1)} mm`, `${(mMdl.peakX * midUseV / MID_V / mid.ts.Xmax * 100).toFixed(0)}% of Xmax at ${Math.round(midUseV * midUseV / 8)} W, with the ${xoLo} Hz highpass`],
              ].map(([k, v, note]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-stone-200 py-1">
                  <span className="text-stone-500 shrink-0">{k}</span>
                  <span className="text-right">
                    <span className="font-medium tabular-nums">{v}</span>
                    {note ? <span className="block text-xs text-stone-500">{note}</span> : null}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-1.5 mt-4">
              {(() => {
                const F = midChips({ midSize, midDims, Qtc: mMdl.Qtc, f3: mMdl.f3, peakX: mMdl.peakX, xoLo, ts: mid.ts, V: MID_V, useV: midUseV, vTherm: vMidTherm, mAmpW,
                  subMusicAtXo, tilt, midAtXo: subMusicAtXo != null ? midNear(xoLo) : null });
                return F.map(([kind, head, body]) => (
                  <div key={head} className={`block text-xs leading-relaxed px-3 py-2 rounded border ${CHIP_BG[kind] || CHIP_BG.ok}`}>
                    <b className={`font-semibold mr-1.5 ${kind === "ok" ? "text-green-800" : kind === "warn" ? "text-amber-700" : "text-red-700"}`}>{head}</b>
                    <span className="text-stone-600">{body}</span>
                  </div>
                ));
              })()}
            </div>
          </>) : (
            <p className="text-sm text-stone-600">{mid.name} can't be modelled yet: its parameters are incomplete. {mid.note}</p>
          )}
          </div>
        </section>

        <section className="mt-2" style={{ fontFamily: "var(--font)" }}>
          <FoldHead id="horn" title="Horn" folds={folds} toggle={toggleFold} className="mb-3" />
          <div className={foldCls("horn")}>
          {hornModel ? (<>
            <div className="grid gap-px mb-4 rounded-lg overflow-hidden border border-stone-300 bg-stone-200 grid-cols-2 sm:grid-cols-[repeat(auto-fit,minmax(112px,1fr))] [&>*:last-child:nth-child(odd)]:col-span-2 sm:[&>*:last-child:nth-child(odd)]:col-span-1">
              {[
                ["Sensitivity", hf.sens.toFixed(1), "dB"],
                ["Power used", Math.round(hornModel.P), "W"],
                ["Max SPL", hornModel.flat.toFixed(1), "dB"],
                ["Coverage", hz.covH ? `${hz.covH}\u00b0\u00d7${hz.covV || "?"}\u00b0` : "\u2014", ""],
                ["Mid beam at XO", midBeam ? Math.round(midBeam) : "\u2014", midBeam ? "\u00b0" : ""],
              ].map(([k, v, u]) => (
                <div key={k} className="bg-stone-50 px-3 py-2.5">
                  <div className="text-[10.5px] uppercase tracking-wider text-stone-500 font-semibold">{k}</div>
                  <div className="text-xl font-medium tabular-nums mt-0.5 break-words">{v}<span className="text-xs text-stone-500 ml-0.5">{u}</span></div>
                </div>
              ))}
            </div>
            <div className="mb-4">
              <ResponseChart fmin={200} fmax={10000} top={180} bot={0} step={30} H={220} yLabel="horizontal beamwidth, °"
                series={[...(beamCurves.midB.length ? [{ curve: beamCurves.midB, label: `Mid-bass ${midSize}″`, stroke: "#e5007e", tint: "rgba(229,0,126,0)" }] : []), ...(beamCurves.hornB.length ? [{ curve: beamCurves.hornB, label: horn.name, stroke: "#0082c8", tint: "rgba(0,130,200,0)" }] : [])]}
                marks={[{ f: xoHi, label: "XO" }, ...(beamCurves.fK ? [{ f: beamCurves.fK, label: "horn control" }] : [])]} />
            </div>
            <div className="flex flex-col gap-1.5">
              {(() => {
                const F = hornChips({ hf, hz, horn, xoHi, hornModel, hfAmpW, midAtXoHi: midMax ? midNear(xoHi).spl : null, hfTilt, hornAtXo: hornAt(xoHi), midBeam, fK: beamCurves.fK });
                return F.map(([kind, head, body]) => (
                  <div key={head} className={`block text-xs leading-relaxed px-3 py-2 rounded border ${CHIP_BG[kind] || CHIP_BG.ok}`}>
                    <b className={`font-semibold mr-1.5 ${kind === "ok" ? "text-green-800" : kind === "warn" ? "text-amber-700" : "text-red-700"}`}>{head}</b>
                    <span className="text-stone-600">{body}</span>
                  </div>
                ));
              })()}
            </div>
          </>) : (
            <p className="text-sm text-stone-600">{cd.name} can't be modelled yet: sensitivity or power rating missing.</p>
          )}
          </div>
        </section>

        </div>

        <aside className={`min-w-0 md:col-span-2 max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-40 max-md:bg-stone-100 max-md:border-t max-md:border-stone-300 max-md:rounded-t-xl max-md:shadow-[0_-6px_20px_rgba(0,0,0,0.10)]`} style={{ fontFamily: "var(--font)" }} aria-label="Settings">
          <div className="md:hidden flex gap-1 px-3 pt-2 pb-2" role="tablist">
            {[["sub", "Sub"], ["mid", "Mid"], ["horn", "Horn"], ["look", "Look"]].map(([t, label]) => (
              <button key={t} role="tab" aria-selected={sheetOpen && tab === t}
                onClick={() => { if (sheetOpen && tab === t) setSheetOpen(false); else { setTab(t); setSheetOpen(true); } }}
                className={`flex-1 px-2 py-2 rounded border text-sm ${sheetOpen && tab === t ? "border-stone-900 bg-stone-900 text-stone-50" : "border-stone-300 bg-stone-50"}`}>{label}</button>
            ))}
            {sheetOpen && <button onClick={() => setSheetOpen(false)} aria-label="Close settings" className="px-3 rounded border border-stone-300 bg-stone-50 text-sm">✕</button>}
          </div>
          <div className={`max-md:overflow-y-auto max-md:overscroll-contain max-md:px-4 max-md:pt-1 max-md:pb-4 max-md:max-h-[45dvh] ${sheetOpen ? "" : "max-md:hidden"}`}>
          <div className={tabCls("look")}>
          <div className="mb-5">
            <div className="text-sm text-stone-500 mb-1 flex items-center justify-between gap-2"><span>Plywood (baffles stay 3/4″)</span>{lk("wall", "the plywood")}</div>
            <div className="flex gap-1">
              {[[0.75, "3/4″ birch"], [0.5, "1/2″ birch, braced"]].map(([t, label]) => (
                <button key={t} onClick={() => setWall(t)} className={`px-3 py-1.5 rounded border text-sm ${wall === t ? "border-stone-900 bg-stone-900 text-stone-50" : "border-stone-300 hover:border-stone-500"}`}>{label}</button>
              ))}
            </div>
            <div className="mt-3"><Slider label="Baffle inset" value={inset} min={0} max={1.5} step={0.25} unit="&#8243;" onChange={setInset} /></div>
          </div>
          </div>
          <div className={tabCls("sub")}>
          <Pick label="Sub driver" options={subList} value={sub} onChange={setSub} extra={lk("sub", "the sub driver")} />
          </div>
          <div className={tabCls("look")}>
          <div className="mb-5">
            <div className="text-sm text-stone-500 mb-1">Cabinet finish</div>
            <div className="flex flex-wrap gap-1.5 items-center">
              {Object.entries(CAB_FINISHES).map(([k, f]) => (
                <button key={k} title={f.name} onClick={() => setCabFinish(k)}
                  className={`px-2.5 h-7 rounded-full border-2 text-xs ${cabFinish === k ? "border-stone-900" : "border-stone-300"}`}
                  style={{ background: f.swatch, color: k === "walnut" ? "#f2f2f2" : "#111111" }}>{f.name}</button>
              ))}
              {SWATCHES.map(([hex, name]) => (
                <button key={hex} title={`Painted: ${name}`} onClick={() => setCabFinish(hex)}
                  className={`swatch w-7 h-7 rounded-full border-2 ${cabFinish.toLowerCase() === hex ? "border-stone-900" : "border-stone-300"}`}
                  style={{ background: hex }} />
              ))}
              <label className="swatch w-7 h-7 rounded-full border-2 border-stone-300 overflow-hidden cursor-pointer relative" title="Custom paint">
                <span className="absolute inset-0" style={{ background: "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)" }} />
                <input type="color" value={CAB_FINISHES[cabFinish] ? "#ffffff" : cabFinish} onChange={(e) => setCabFinish(e.target.value)}
                  className="opacity-0 absolute inset-0 w-full h-full cursor-pointer" />
              </label>
              <span className="text-xs text-stone-500 ml-1 tabular-nums">{CAB_FINISHES[cabFinish] ? CAB_FINISHES[cabFinish].name : `painted ${cabFinish}`}</span>
            </div>
          </div>
          </div>
          <div className={tabCls("look")}>
          <div className="mb-5">
            <div className="text-sm text-stone-500 mb-1">Baffle colour</div>
            <div className="flex flex-wrap gap-1.5 items-center">
              {SWATCHES.map(([hex, name]) => (
                <button
                  key={hex}
                  title={name}
                  onClick={() => setBaffleColor(hex)}
                  className={`swatch w-7 h-7 rounded-full border-2 ${baffleColor.toLowerCase() === hex ? "border-stone-900" : "border-stone-300"}`}
                  style={{ background: hex }}
                />
              ))}
              <label className="swatch w-7 h-7 rounded-full border-2 border-stone-300 overflow-hidden cursor-pointer relative" title="Custom">
                <span className="absolute inset-0" style={{ background: "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)" }} />
                <input
                  type="color"
                  value={baffleColor}
                  onChange={(e) => setBaffleColor(e.target.value)}
                  className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                />
              </label>
              <span className="text-xs text-stone-500 ml-1 tabular-nums">{baffleColor}</span>
            </div>
          </div>
          </div>
          <div className={tabCls("look")}>
          <div className="mb-5">
            <div className="text-sm text-stone-500 mb-1">View</div>
            <div className="flex gap-1">
              {[["Finished", false], ["Cutaway", true]].map(([label, v]) => (
                <button key={label} onClick={() => setCutaway(v)} className={`px-3 py-2 rounded border text-sm ${cutaway === v ? "border-stone-900 bg-stone-900 text-stone-50" : "border-stone-300 hover:border-stone-500"}`}>{label}</button>
              ))}
            </div>
          </div>
          </div>
          <div className={tabCls("look")}>
          <div className="mb-5">
            <div className="text-sm text-stone-500 mb-1">Layout</div>
            <div className="flex gap-1">
              {[["Two stacks", "stack"], ["Tops on spacers", "pole"], ["Tower", "tower"], ["One sub + satellites", "satellite"]].map(([label, v]) => (
                <button key={v} onClick={() => setLayout(v)} className={`px-3 py-2 rounded border text-sm ${layout === v ? "border-stone-900 bg-stone-900 text-stone-50" : "border-stone-300 hover:border-stone-500"}`}>{label}</button>
              ))}
            </div>
            {layout === "pole" && <div className="mt-3"><Slider label="Spacer height" value={spacerH} min={4} max={36} step={1} unit="&#8243;" onChange={setSpacerH} /></div>}
          </div>
          </div>
          <div className={tabCls("sub")}>
          <div className="mb-5">
            <div className="text-sm text-stone-500 mb-1">Cabinet</div>
            <div className="rounded border border-stone-300 bg-white px-3 py-3">
              <Slider label="Width"  value={cDim.w} min={18} max={40} step={0.5} unit="&#8243;" onChange={(v) => setC("w", v)} extra={dl("subDim", "w", "Sub width")} />
              <Slider label="Height" value={cDim.h} min={18} max={42} step={0.5} unit="&#8243;" onChange={(v) => setC("h", v)} extra={dl("subDim", "h", "Sub height")} />
              <Slider label="Depth"  value={cDim.d} min={14} max={32} step={0.5} unit="&#8243;" onChange={(v) => setC("d", v)} extra={dl("subDim", "d", "Sub depth")} />
            </div>
          </div>
          </div>
          <div className={tabCls("sub")}>
          <div className="mb-5">
            <div className="text-sm text-stone-500 mb-1 flex items-center justify-between gap-2"><span>Vent</span>{lk("vent", "the vent style")}</div>
            <div className="flex flex-wrap gap-1">
              {[["Rectangular", !portStyle.startsWith("round"), "slots"], ["Round tubes", portStyle.startsWith("round"), "round2"]].map(([label, on, v]) => (
                <button key={label} onClick={() => { if (!on) setPortStyle(v); }} className={`px-3 py-2 rounded border text-sm ${on ? "border-stone-900 bg-stone-900 text-stone-50" : "border-stone-300 hover:border-stone-500"}`}>{label}</button>
              ))}
            </div>
            {!portStyle.startsWith("round") && (
              <div className="flex flex-wrap gap-1 mt-1">
                {[["slots", "Bottom"], ["folded", "Bottom, folded"], ["vslots", "Both sides"], ["vslot1", "One side"]].map(([v, label]) => {
                  const on = portStyle === v;
                  return <button key={v} onClick={() => setPortStyle(v)} className={`px-3 py-1.5 rounded border text-xs ${on ? "border-stone-900 bg-stone-900 text-stone-50" : "border-stone-300 hover:border-stone-500"}`}>{label}</button>;
                })}
              </div>
            )}
            <div className="rounded border border-stone-300 bg-white px-3 py-3 mt-2">
              {(portStyle === "slots" || portStyle === "folded") &&
                <Slider label="Slot height" value={cVent.slotH} min={1.5} max={9} step={0.25} unit="&#8243;" onChange={(v) => setV("slotH", v)} />}
              {(portStyle === "vslots" || portStyle === "vslot1") &&
                <Slider label="Duct throat" value={cVent.throat} min={1} max={portStyle === "vslot1" ? 10 : 7} step={0.25} unit="&#8243;" onChange={(v) => setV("throat", v)} />}
              {portStyle.startsWith("round") && <>
                <Slider label="Tubes" value={cVent.nt} min={1} max={6} step={1} unit="" onChange={(v) => setV("nt", v)} />
                <Slider label="Tube diameter" value={cVent.dia} min={3} max={10} step={0.25} unit="&#8243;" onChange={(v) => setV("dia", v)} />
              </>}
              <Slider label="Duct length" value={cVent.len} min={3} max={30} step={0.5} unit="&#8243;" onChange={(v) => setV("len", v)} />
              <Slider label="Port velocity limit" value={portMax} min={12} max={30} step={0.5} unit=" m/s" onChange={setPortMax} />
              <div className="text-xs text-stone-500">{port.desc}. {port.area.toFixed(1)} in&#178;.</div>
            </div>
          </div>
          <div className="mb-5">
            <div className="text-sm text-stone-500 mb-1">Sub highpass and amp</div>
            <div className="rounded border border-stone-300 bg-white px-3 py-3">
              <Slider label={`Highpass (${hpType})`} value={hpf} min={20} max={50} step={1} unit=" Hz" onChange={setHpf} extra={lk("hpf", "the highpass")} />
              <div className="flex flex-wrap gap-1 -mt-1 mb-3">
                {Object.keys(HP_TYPES).map((t) => (
                  <button key={t} onClick={() => setHpType(t)} className={`px-2.5 py-1 rounded border text-xs ${hpType === t ? "border-stone-900 bg-stone-900 text-stone-50" : "border-stone-300 hover:border-stone-500"}`}>{t}</button>
                ))}
              </div>
              <Slider label="Amp power per channel @ 8 Ω" value={ampW} min={200} max={3000} step={50} unit=" W" onChange={setAmpW} extra={lk("ampW", "the sub amp power")} />
            </div>
          </div>
          </div>
          <div className={tabCls("mid")}>
          <div className="mb-2">
            <div className="text-sm text-stone-500 mb-1">Mid-bass size</div>
            <div className="flex gap-1">
              {[12, 15].map((n) => (
                <button key={n} onClick={() => setMidSize(n)} className={`px-3 py-1.5 rounded border text-sm ${midSize === n ? "border-stone-900 bg-stone-900 text-stone-50" : "border-stone-300 hover:border-stone-500"}`}>{n}″</button>
              ))}
            </div>
          </div>
          <Pick label={`Mid-bass ${midSize}"`} options={midList} value={mid} onChange={setMid} extra={lk("mid", "the mid-bass driver")} />
          <div className="mb-5">
            <div className="text-sm text-stone-500 mb-1">Mid-bass cabinet (sealed)</div>
            <div className="rounded border border-stone-300 bg-white px-3 py-3">
              {layout === "tower" ? (
                <div className="text-xs text-stone-500 mb-3">Tower layout: the mid chamber is the sub's footprint, {cDim.w}″ × 15.5″ × {cDim.d}″.</div>
              ) : (<>
                <Slider label="Width"  value={mDim.w} min={10} max={24} step={0.5} unit="&#8243;" onChange={(v) => setM("w", v)} extra={dl("midDim", "w", "Mid width")} />
                <Slider label="Height" value={mDim.h} min={10} max={24} step={0.5} unit="&#8243;" onChange={(v) => setM("h", v)} extra={dl("midDim", "h", "Mid height")} />
                <Slider label="Depth"  value={mDim.d} min={8} max={24} step={0.5} unit="&#8243;" onChange={(v) => setM("d", v)} extra={dl("midDim", "d", "Mid depth")} />
              </>)}
              <Slider label="Crossover, sub to mid" value={xoLo} min={60} max={250} step={5} unit=" Hz" onChange={setXoLo} extra={lk("xoLo", "the sub-to-mid crossover")} />
              <Slider label="Crossover, mid to horn" value={xoHi} min={500} max={2000} step={50} unit=" Hz" onChange={setXoHi} extra={lk("xoHi", "the mid-to-horn crossover")} />
              <Slider label="Mid amp power per channel @ 8 Ω" value={mAmpW} min={50} max={2000} step={25} unit=" W" onChange={setMAmpW} extra={lk("mAmpW", "the mid amp power")} />
              <Slider label="Music balance: mid band needs less by" value={tilt} min={0} max={12} step={1} unit=" dB" onChange={setTilt} />
              <div className="text-xs text-stone-500">0 dB asks the mid to match the sub flat out. Bass-heavy music usually carries 6–10 dB less from 200 Hz to 1 kHz than at 40–60 Hz.</div>
            </div>
          </div>
          </div>
          <div className={tabCls("horn")}>
          <Pick label="Compression driver" options={CD_OPTIONS} value={cd} onChange={setCd} extra={lk("cd", "the compression driver")} />
          <Pick label="Horn" options={HORN_OPTIONS} value={horn} onChange={setHorn} extra={lk("horn", "the horn")} />
          <div className="rounded border border-stone-300 bg-white px-3 py-3 mb-4">
            <Slider label="HF amp power per channel @ 8 Ω" value={hfAmpW} min={10} max={500} step={5} unit=" W" onChange={setHfAmpW} extra={lk("hfAmpW", "the HF amp power")} />
            <Slider label="Music balance: HF band needs less by" value={hfTilt} min={0} max={12} step={1} unit=" dB" onChange={setHfTilt} />
            <div className="text-xs text-stone-500">16 Ω drivers draw half the power from the same amp.</div>
          </div>
          {mismatch && <div className="text-sm text-red-700 mb-4">Horn throat and driver exit don't match ({horn.exit}" vs {cd.exit}").</div>}
          </div>
          </div>
        </aside>


        <section className="min-w-0 md:col-span-5 mt-6" style={{ fontFamily: "var(--font)" }}>
          <FoldHead id="totals" title="Totals for the current selection" folds={folds} toggle={toggleFold} className="mb-2" />
          <div className={foldCls("totals")}>
          {(() => {
            const subBoxLb = subLbLoaded - (sub.lb || 0); // same estimate as the stats row
            const midBoxLb = midCabLb;   // same estimate as the mid-bass stats row
            const rows = [
              ["Sub column", sub.price, sub.lb, subBoxLb, subBox.h],
              ["Mid-bass box", mid.price, mid.lb, midBoxLb, midDims.h],
              ["Compression driver", cd.price, cd.lb || 0, 0, 0],
              ["Horn", horn.price, (horn.lb || 0) + 1, 0, horn.size.h + 1],
            ];
            const sum = (i) => rows.reduce((a, r) => a + (r[i] || 0), 0);
            const stackLb = sum(2) + sum(3) + (plinth ? 6 : 0);
            return (
              <div className="overflow-x-auto max-w-3xl"><table className="text-sm w-full min-w-[340px] border-collapse">
                <thead><tr className="text-stone-500 text-left border-b border-stone-300">
                  <th className="py-1 pr-4 font-normal">Per stack</th><th className="py-1 pr-4 font-normal text-right">Drivers $</th><th className="py-1 pr-4 font-normal text-right">Driver lb</th><th className="py-1 pr-4 font-normal text-right">Cabinet lb</th><th className="py-1 pr-4 font-normal text-right">Box lb</th><th className="py-1 font-normal text-right">Height in</th>
                </tr></thead>
                <tbody>
                  {rows.map(([n, pr, dl, cl, h]) => (
                    <tr key={n} className="border-b border-stone-200"><td className="py-1 pr-4">{n}</td><td className="py-1 pr-4 text-right tabular-nums">{pr ? `$${pr}` : "—"}</td><td className="py-1 pr-4 text-right tabular-nums">{dl.toFixed(0)}</td><td className="py-1 pr-4 text-right tabular-nums">{cl ? cl.toFixed(0) : "—"}</td><td className="py-1 pr-4 text-right tabular-nums">{(dl + cl).toFixed(0)}</td><td className="py-1 text-right tabular-nums">{h.toFixed(1)}</td></tr>
                  ))}
                  <tr className="font-medium"><td className="py-1 pr-4">One stack{plinth ? ` + ${plinth}" plinth` : ""}</td><td className="py-1 pr-4 text-right tabular-nums">${sum(1).toLocaleString()}</td><td className="py-1 pr-4 text-right tabular-nums">{sum(2).toFixed(0)}</td><td className="py-1 pr-4 text-right tabular-nums">{(sum(3) + (plinth ? 6 : 0)).toFixed(0)}</td><td className="py-1 pr-4 text-right tabular-nums">{stackLb.toFixed(0)}</td><td className="py-1 text-right tabular-nums">{stackH.toFixed(0)}</td></tr>
                  <tr className="font-medium text-stone-900"><td className="py-1 pr-4">Pair</td><td className="py-1 pr-4 text-right tabular-nums">${(2 * sum(1)).toLocaleString()}</td><td className="py-1 pr-4 text-right tabular-nums">{(2 * sum(2)).toFixed(0)}</td><td className="py-1 pr-4 text-right tabular-nums">{(2 * (sum(3) + (plinth ? 6 : 0))).toFixed(0)}</td><td className="py-1 pr-4 text-right tabular-nums">{(2 * stackLb).toFixed(0)}</td><td></td></tr>
                </tbody>
              </table></div>
            );
          })()}
          </div>
        </section>
        <div className="min-w-0 md:col-span-5 mt-4" style={{ fontFamily: "var(--font)" }}>
          <button onClick={() => setShowDetails((v) => !v)} aria-expanded={showDetails}
            className="text-sm px-3 py-1.5 rounded border border-stone-300 hover:border-stone-500">{showDetails ? "Hide" : "Show"} sub, mid-bass and horn details</button>
        </div>
        {showDetails && <section className="min-w-0 md:col-span-5 grid grid-cols-1 md:grid-cols-3 gap-6" style={{ fontFamily: "var(--font)" }}>
          <div>
            <h2 className="text-xl mb-2" style={{ fontFamily: "var(--font)", fontWeight: 700 }}>Sub</h2>
            <p className="text-sm text-stone-700">
              {sub.name} in a {subBox.w}×{subBox.h}×{subBox.d} in cabinet, {grossL.toFixed(0)} L gross, {netL.toFixed(0)} L net.
              Vent: {port.desc}. 3/4″ baffle set {inset}″ behind the frame, {wall === 0.5 ? "1/2″" : "3/4″"} birch walls, 1/4″ roundovers on the front edges.
            </p>
          </div>
          <div>
            <h2 className="text-xl mb-2" style={{ fontFamily: "var(--font)", fontWeight: 700 }}>Mid-bass cube</h2>
            <p className="text-sm text-stone-700">
              {mid.name} in a {midDims.w}×{midDims.h}×{midDims.d} in sealed box, gross {midL.toFixed(0)} L, lightly stuffed.
              Covers {xoLo} Hz to {xoHi} Hz. Same construction, flush-mounted driver.
            </p>
            {mid.note && <p className="text-sm text-stone-600 mt-2"><span className="font-medium text-stone-700">{mid.name}.</span> {mid.note}</p>}
          </div>
          <div>
            <h2 className="text-xl mb-2" style={{ fontFamily: "var(--font)", fontWeight: 700 }}>Horn</h2>
            <p className="text-sm text-stone-700">
              {horn.name} with {cd.name}, crossed at {xoHi} Hz (maker suggests {horn.xo}). Sits on a short block so the mouth clears the cube.
              Total stack height about {stackH.toFixed(0)} in, horn centre at {hornCenter.toFixed(0)} in.
            </p>
            {cd.note && <p className="text-sm text-stone-600 mt-2"><span className="font-medium text-stone-700">{cd.name}.</span> {cd.note}</p>}
            {horn.note && <p className="text-sm text-stone-600 mt-2"><span className="font-medium text-stone-700">{horn.name}.</span> {horn.note}</p>}
          </div>
        </section>}

      </main>
      </>}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(StackPlanner));
