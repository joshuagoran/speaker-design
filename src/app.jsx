const { useEffect, useRef, useState } = React;
import { ToggleButton } from "./components/ui/ToggleButton.jsx";
import { Button } from "./components/ui/Button.jsx";
import { Tooltip } from "./components/ui/Tooltip.jsx";
import { SwatchPicker } from "./components/ui/SwatchPicker.jsx";
import { Card } from "./components/ui/Card.jsx";
import { SectionHeading } from "./components/ui/SectionHeading.jsx";
import { NumberField } from "./components/ui/NumberField.jsx";
import { SelectField } from "./components/ui/SelectField.jsx";
import { Slider } from "./components/ui/Slider.jsx";
import { FoldHeading } from "./components/ui/FoldHeading.jsx";
import { Notice } from "./components/ui/Notice.jsx";
import { ResponseChart } from "./components/charts/ResponseChart.jsx";
import { OptimizerCurveChart } from "./components/charts/OptimizerCurveChart.jsx";
import { DispersionMap } from "./components/charts/DispersionMap.jsx";
import { SignalPath } from "./components/drawings/SignalPath.jsx";
import { RoomView } from "./components/drawings/RoomView.jsx";
import { HifiFront } from "./components/drawings/HifiFront.jsx";
import { SheetDrawing } from "./components/drawings/SheetDrawing.jsx";
import { LockButton } from "./components/lock/LockButton.jsx";
import { LOCK_KEYS } from "./constants/lockKeys.js";
import { DimensionLock } from "./components/lock/DimensionLock.jsx";
import { runPaOptimizer } from "./lib/pa/runOptimizer.js";
import { CHIP_BACKGROUND_CLASSES } from "./components/optimizer/OptimizerResultCard.jsx";
import { formatDollars } from "./lib/format.js";
import { Delta } from "./components/optimizer/Delta.jsx";
import { OptimizerPanel } from "./components/optimizer/OptimizerPanel.jsx";
import { OptimizerBar } from "./components/optimizer/OptimizerBar.jsx";
import { GoalPicker } from "./components/optimizer/GoalPicker.jsx";
import { RunRow } from "./components/optimizer/RunRow.jsx";
import { ResultCards } from "./components/optimizer/ResultCards.jsx";
import { StatLabel, StatRow } from "./components/optimizer/StatRow.jsx";
import { useConfigStore } from "./components/saved-configs/useConfigStore.js";
import { SavedConfigs } from "./components/saved-configs/SavedConfigs.jsx";
import { HIFI_TOP, HIFI_BOT } from "./constants/chartScales.js";
import { METERS_PER_FOOT } from "./constants/units.js";
import { subChips, midChips, hornChips, fillChips } from "./lib/pa/chips.js";
import { evaluateDesign as evaluateConfig, pickOptimizedFields } from "./lib/pa/optimize.js";
import { SUB_OPTIONS, MID_OPTIONS, MID_BOXES, CD_OPTIONS, HORN_OPTIONS, RACKS, PAINT_SWATCHES, CABINET_FINISHES, CABINETS, FORMATS, FILL_OPTIONS, HIFI_WOOFERS, HIFI_TWEETERS, HIFI_PASSIVES, passiveRadiatorMassMax } from "./lib/data.js";
import { hifiSystem, hifiChips, hifiResponseAt, hifiDispersionMap, logSpacedFrequencies, linkwitzRileyFilter, SPEAKER_PLACEMENTS as HIFI_PLACES } from "./lib/hifi/hifi.js";
import { optimizeHifiSpeaker, HIFI_OPTIMIZER_GOALS, HIFI_LOCK_KEYS } from "./lib/hifi/optimize.js";
import { paDispersionMap, firstNullAngleDeg } from "./lib/pa/dispersion.js";
import { subSystem, maxOutputCurve as maxCurveOf, hornResponse, pistonBeamWidthDeg, keeleFrequency, hornBeamWidthDeg, subWeightLb, midWeightLb, HIGHPASS_ALIGNMENTS, PLYWOOD_SHEETS, formatInches, formatThickness, cutParts, packSheets, midSystem, fillSystem, subThroughLowpass, nearestPoint, subMusicOutputAt } from "./lib/pa/calc.js";



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
    const finish = CABINET_FINISHES[cabFinish];
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
    // Holes use the same baffle-centered coordinates as cabinet().
    const archOutline = (P, hw, yb, acy, r) => {
      P.moveTo(-hw, yb); P.lineTo(hw, yb); P.lineTo(hw, acy);
      P.absarc(0, acy, r, 0, Math.PI, false); P.lineTo(-hw, yb);
      return P;
    };
    const archCabinet = (w, h, d, y, holes, baffleBottom = 0, x = 0, parent = group) => {
      const R = w / 2, acy = h / 2 - R;                  // arch center, frame-centered coords
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
    // arched: horn centered on the arch, equal margin below and around it
    const twHsH = archTop ? (s.w / 2 - T) + s.w / 2 : horn.size.h + 2;
    const extH = towerMode ? TW_MID + twHsH : 0;
    const baffleH = s.h + extH - 2 * T - bandH;
    const baffleCy = pl + T + bandH + baffleH / 2; // absolute center of the baffle
    // centered when symmetric; bottom slots: centered in the baffle above the duct (sub section only in a tower)
    const drvAbsY = corners || vSlot ? pl + s.h / 2
      : !round ? pl + T + bandH + (s.h - 2 * T - bandH) / 2
      : pl + s.h - T - innerW / 2;
    const vThroat = pg.throat != null ? pg.throat : Math.round(((sub.size >= 18 ? 66 : 54) / (2 * (s.h - 2 * T))) * 100) / 100;
    // a single side duct pushes the driver into the middle of the remaining baffle
    const drvX = sides.length === 1 && vSlot ? -sides[0] * (vThroat + 0.43 + T) / 2 : 0;
    const holes = [circPath(drvX, drvAbsY - baffleCy, drvR)];
    let portCy = 0;
    if (round) {
      // 8" sits low on the baffle; 5" pair centered 10" up
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
      // the rear channel rises until the centerline adds up to the set duct length
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

// woofers listed smallest first, grouped by size in the picker, A–Z within a size
const HIFI_WOOFERS_BY_SIZE = HIFI_WOOFERS.slice().sort((a, b) => a.size - b.size || a.name.localeCompare(b.name));
// tweeters split into domes and compression drivers (which need a waveguide), domes first
// passive radiators by size, A–Z within a size
const HIFI_PASSIVES_BY_SIZE = HIFI_PASSIVES.slice().sort((a, b) => a.size - b.size || a.name.localeCompare(b.name));
const prOf = (c) => (c && c.box === "radiator" && c.pr ? { drv: HIFI_PASSIVES.find((o) => o.id === c.pr.id), n: c.pr.n, addG: c.pr.addG } : null);
const isCD = (o) => o.type === "compression" || o.needsWaveguide;
const HIFI_TWEETERS_BY_TYPE = HIFI_TWEETERS.slice().sort((a, b) => isCD(a) - isCD(b) || a.name.localeCompare(b.name));

// A result card, laid out like the PA optimizer's: what it is, a front view and its bass against yours, the four numbers with deltas.
function HifiCard({ k, i, n, curCurve, guide, previewing, onPreview, onLoad }) {
  const c = k.config, m = k.metrics, d = k.delta || {};
  const cw = HIFI_WOOFERS.find((o) => o.id === k.woofer), ct = HIFI_TWEETERS.find((o) => o.id === k.tweeter);
  const tile = (label, v, delta) => (
    <div className="bg-stone-50 border border-stone-300 rounded px-2 py-1.5">
      <div className="text-xs uppercase tracking-wider text-stone-500 font-semibold">{label}</div>
      <div className="tabular-nums">{v}</div>{delta}
    </div>
  );
  const who = { Xmax: "cone travel", port: "port air speed", radiator: "radiator travel", thermal: "the woofer's power rating", amp: "the amp" }[k.whoW] || k.whoW;
  return (
    <div className={`bg-white border rounded-lg p-3.5 flex flex-col gap-2.5 min-w-full md:min-w-0 snap-start ${previewing ? "border-stone-900 ring-1 ring-stone-900" : "border-stone-300"}`}>
      <div className="text-xs uppercase tracking-wider font-bold text-stone-500">{k.label} · {i + 1} of {n}</div>
      <h3 className="text-lg leading-snug" style={{ fontFamily: "var(--font)", fontWeight: 700 }}>{cw.size}″ {k.names.woofer} · {c.dim.w} × {c.dim.h} × {c.dim.d}″</h3>
      <div className="grid grid-cols-[2fr_3fr] gap-2 items-end">
        <HifiFront dim={c.dim} w={cw} t={ct} lay={k.lay} vented={c.box === "vented"} port={c.port} pr={prOf(c)} guide={k.guided ? guide : null} small />
        <OptimizerCurveChart curve={k.curve} cur={curCurve} fmin={15} fmax={20000} band={null} top={HIFI_TOP} bot={HIFI_BOT} />
      </div>
      <div className="text-xs text-stone-500">{k.names.tweeter} · {c.box}{c.box === "vented" && c.port.shape === "slot" ? ` (${c.port.h}″ slot, ${c.port.len}″ long)` : c.box === "vented" ? ` (${c.port.n} × ${c.port.dia}″ port, ${c.port.len}″${c.port.elbows ? `, ${c.port.elbows} elbow${c.port.elbows > 1 ? "s" : ""}` : ""})` : c.box === "radiator" && prOf(c) ? ` (${c.pr.n} × ${prOf(c).drv.name}, +${c.pr.addG} g)` : ""} · {c.wall === 0.5 ? "1/2″" : "3/4″"} · XO {c.xo} Hz · amps {c.wAmpW} / {c.tAmpW} W</div>
      <div className="grid grid-cols-2 gap-1.5">
        {tile("Drivers, pair", formatDollars(m.price), <Delta v={d.price} unit="$" lowerIsBetter />)}
        {tile("Weight", `${m.lb.toFixed(0)} lb`, <Delta v={d.lb} unit=" lb" lowerIsBetter digits={1} />)}
        {tile("At the seat", `${m.level.toFixed(1)} dB`, <Delta v={d.level} unit=" dB" digits={1} />)}
        {tile("F3 in room", `${m.f3.toFixed(0)} Hz`, <Delta v={d.f3} unit=" Hz" lowerIsBetter />)}
      </div>
      <div className="text-xs leading-snug"><b className="font-semibold">Limited by:</b> {who}</div>
      {k.warnings.filter((h) => !/^Woofer limited by/.test(h)).map((h) => <div key={h} className="text-xs border border-l-4 rounded px-2 py-1 bg-amber-50 border-amber-200 border-l-amber-300"><b className="font-semibold text-amber-700">{h}</b></div>)}
      <div className="text-xs text-stone-500">Changes: {k.changed.length ? k.changed.join(", ") : "none"}</div>
      <div className="flex gap-1.5 mt-auto">
        <button onClick={onPreview} className="flex-1 px-3 py-2 rounded border text-sm border-stone-300 bg-stone-50 hover:border-stone-500">Preview</button>
        <Button variant="primary" onClick={onLoad} className="flex-1">Load</Button>
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
  const [prSel, setPrSel] = useState({ id: "sb16pfcr", n: 2, addG: 0 });
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
  const store = useConfigStore("hifiConfigs");
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
  const guide = t.type === "compression" || t.needsWaveguide ? { covH: guideSel.hf.covH, covV: guideSel.hf.covV || guideSel.hf.covH, w: guideSel.size.w, h: guideSel.size.h, name: guideSel.name, freestanding: !guideSel.rect } : null;
  const prDrv = HIFI_PASSIVES.find((o) => o.id === prSel.id) || HIFI_PASSIVES[0];
  const pr = { drv: prDrv, n: prSel.n, addG: Math.min(prSel.addG, passiveRadiatorMassMax(prDrv)) };
  const cfg = { box, dim, wall, mat, port, pr, xo, order, wAmpW, tAmpW, bsc, place, wallFt, portMax: 17, guide };
  const tt = guide ? { ...t, faceplate: { w: guide.w, h: guide.h } } : t;
  const sys = hifiSystem(w, tt, cfg);
  if (!sys) return <main className="max-w-6xl mx-auto px-4 md:px-8 pb-16 text-sm">This woofer can't be modelled (its parameters aren't published).</main>;
  const F = hifiChips(sys, w, tt, cfg);
  // the seat, relative to each speaker (left at -spacing/2, toed in toward the middle)
  const geoOf = (sign) => {
    const sx = (sign * spacing) / 2, vx = seat.x - sx, vy = seat.y, d = Math.hypot(vx, vy);
    const axis = (-sign * toe * Math.PI) / 180, ang = Math.atan2(vx, vy) - axis;
    return { th: Math.abs(ang), eyeIn: earIn - standIn, distM: d * METERS_PER_FOOT };
  };
  const gL = geoOf(-1), gR = geoOf(1);
  const freqs = logSpacedFrequencies(15, 20000, 220);
  const rL = hifiResponseAt(sys, w, tt, cfg, gL, freqs), rR = hifiResponseAt(sys, w, tt, cfg, gR, freqs);
  const on = hifiResponseAt(sys, w, tt, cfg, { th: 0, eyeIn: sys.lay.tweeterIn, distM: 1 }, freqs);
  const pair = rL.map((o, i) => ({ f: o.f, spl: 10 * Math.log10(Math.pow(10, o.spl / 10) + Math.pow(10, rR[i].spl / 10)) }));
  const seatDist = (gL.distM + gR.distM) / 2;
  const atSeat = sys.maxLevel - 20 * Math.log10(seatDist) + 3;
  const tMax = freqs.map((f) => ({ f, spl: sys.tLevel + 20 * Math.log10(Math.max(1e-6, Math.hypot(linkwitzRileyFilter(f, xo, order, "hp").re, linkwitzRileyFilter(f, xo, order, "hp").im))) }));
  const map = hifiDispersionMap(sys, w, tt, cfg, plane, Math.max(1, seatDist));
  const pairCost = 2 * ((w.price || 0) + (t.price || 0) + (guide ? guideSel.price || 0 : 0) + (box === "radiator" ? pr.n * (prDrv.price || 0) : 0));
  const tile = (k, v, u) => (
    <div key={k} className="bg-stone-50 px-3 py-2.5">
      <div className="text-xs uppercase tracking-wider text-stone-500 font-semibold"><StatLabel k={k} /></div>
      <div className="text-xl font-medium tabular-nums mt-0.5 break-words">{v}<span className="text-xs text-stone-500 ml-0.5">{u}</span></div>
    </div>
  );
  const hLk = (key, what) => (hOn ? <LockButton on={!!hLocks[key]} what={what} onClick={() => setHLocks((p) => ({ ...p, [key]: !p[key] }))} /> : null);
  const hDl = (dm, what) => (hOn ? <DimensionLock mode={hLocks.dim[dm] || "free"} what={what} onChange={(m) => setHLocks((p) => ({ ...p, dim: { ...p.dim, [dm]: m } }))} /> : null);
  const snapH = () => ({ woofer: w.id, tweeter: t.id, box, dim, port, pr: box === "radiator" ? prSel : undefined, wall, xo, wAmpW, tAmpW });
  // Everything on the page, for saving (undefined fields dropped: the stores reject them)
  const savedSnapH = () => JSON.parse(JSON.stringify({ ...snapH(), guide: guideSel.id, mat, order, bsc, place, wallFt, spacing, toe, seat, earIn, standIn,
    summary: `${w.name} + ${t.name} · ${dim.w}×${dim.h}×${dim.d}″ · ${box === "radiator" ? "passive radiator" : box}` }));
  const restoreH = (c) => {
    const pick = (list, id) => list.find((o) => o.id === id);
    const ok = (f, v) => { if (v !== undefined) f(v); };
    ok(setW, pick(HIFI_WOOFERS, c.woofer)); ok(setT, pick(HIFI_TWEETERS, c.tweeter)); ok(setGuide, pick(guides, c.guide));
    [[setBox, c.box], [setDim, c.dim], [setPort, c.port], [setPrSel, c.pr], [setWall, c.wall], [setMat, c.mat], [setXo, c.xo], [setOrder, c.order],
     [setWAmpW, c.wAmpW], [setTAmpW, c.tAmpW], [setBsc, c.bsc], [setPlace, c.place], [setWallFt, c.wallFt], [setSpacing, c.spacing], [setToe, c.toe],
     [setSeat, c.seat], [setEarIn, c.earIn], [setStandIn, c.standIn]].forEach(([f, v]) => ok(f, v));
    setHPreview(null); setHUndo(null); setHRes(null);
  };
  const applyH = (c) => {
    setW(HIFI_WOOFERS.find((o) => o.id === c.woofer)); setT(HIFI_TWEETERS.find((o) => o.id === c.tweeter));
    setBox(c.box); setDim(c.dim); if (c.port) setPort(c.port); if (c.pr) setPrSel(c.pr); setWall(c.wall); setXo(c.xo); setWAmpW(c.wAmpW); setTAmpW(c.tAmpW);
  };
  const runH = () => {
    setHBusy(true);
    const base = hPreview ? hPreview.before : snapH();
    setTimeout(() => {
      try { setHRes(optimizeHifiSpeaker({ cur: { ...cfg, ...base }, woofers: HIFI_WOOFERS, tweeters: HIFI_TWEETERS, passives: HIFI_PASSIVES, goals: hGoals, locks: hLocks, budget: hBudget, seatM: seatDist, guidePrice: guideSel.price || 0 })); }
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
    <OptimizerBar on={hOn} onToggle={() => setHOn(!hOn)} hint="Find cheaper, lighter, deeper or louder designs inside your limits."
      nLocks={nLocks} lockMax={HIFI_LOCK_KEYS.length + 3} onLockAll={() => setHLocks(() => allLocks)} onClear={() => setHLocks(() => ({ dim: {} }))} />
  );
  const optPanel = hOn && (
    <Card pad="lg" className="mt-3">
      <SectionHeading>Find a better design</SectionHeading>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
        <div className="mt-3">
          <NumberField label={<>Driver budget, pair <span className="text-xs">(woofers + tweeters{guide ? " + waveguides" : ""}, at the listed prices)</span></>} value={hBudget} min={50} step={25} unit="$" onChange={(n) => { setHBudget(n); ls.set("hifi.budget", n); }} className="" />
        </div>
        <GoalPicker defs={HIFI_OPTIMIZER_GOALS} selected={hGoals} onTap={tapG} />
      </div>
      <RunRow busy={hBusy} hasGoal={hGoals.length > 0} onRun={runH} stats={hRes && hRes.stats} note={hRes && hRes.cards.length ? " · every design shown passes the checks (warnings are listed on the card)" : ""}>
        {hUndo && !hPreview && <Button size="md" onClick={() => { applyH(hUndo); setHUndo(null); }}>Undo load</Button>}
      </RunRow>
      {hRes && !hBusy && hRes.curProblems.length > 0 && <Notice>Your design fails: {hRes.curProblems.join("; ")}. Fixes may cost or weigh more.</Notice>}
      {hRes && !hBusy && <ResultCards cards={hRes.cards} render={(k, i) => <HifiCard key={i} k={k} i={i} n={hRes.cards.length} curCurve={hRes.curCurve} guide={guide} previewing={hPreview && hPreview.card === k} onPreview={() => previewH(k)} onLoad={() => loadH(k)} />} />}
      {hRes && !hBusy && hRes.goalMissing && <Notice>{hRes.goalMissing}</Notice>}
      {hRes && !hBusy && !hRes.cards.length && !hRes.goalMissing && <div className="mt-3 text-sm text-orange-900">Nothing fits all your limits. A bigger budget or fewer locks would open it up.</div>}
    </Card>
  );
  return (
    <main className="max-w-6xl mx-auto px-4 md:px-8 pb-16 grid grid-cols-1 md:grid-cols-5 gap-8" style={{ fontFamily: "var(--font)" }}>
      <div className="md:col-span-5 min-w-0">
        <SavedConfigs bare store={store} snapshot={savedSnapH} restore={restoreH} />
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
        <div className="shrink-0"><HifiFront dim={dim} w={w} t={tt} lay={sys.lay} vented={sys.vented} port={port} pr={sys.radiator ? pr : null} guide={guide} /></div>
        <div className="flex-1 min-w-0 grid gap-px rounded-lg overflow-hidden border border-stone-300 bg-stone-300 grid-cols-2 sm:grid-cols-3 [&>*:last-child:nth-child(odd)]:col-span-2 sm:[&>*:last-child:nth-child(odd)]:col-span-1">
          {tile("Net volume", sys.net.toFixed(1), "L")}
          {sys.Fb != null ? tile("Tuning Fb", sys.Fb.toFixed(0), "Hz") : tile("Qtc", sys.Qtc.toFixed(2), "")}
          {tile("F3 in room", sys.f3.toFixed(0), "Hz")}
          {tile("Max at the seat", atSeat.toFixed(0), "dB")}
          {tile("Weight", sys.lb.toFixed(0), "lb")}
          {tile("Pair", `$${Math.round(pairCost)}`, "")}
        </div>
        </div>
        <ResponseChart fmin={15} fmax={20000} top={HIFI_TOP} bot={HIFI_BOT} step={10} yLabel="dB SPL at 2.83 V"
          series={[{ curve: on, label: "On axis, 1 m", stroke: PAL.ink, tint: PAL.alpha(PAL.ink, 0) }, { curve: pair, label: `Pair at the seat (${(seatDist / METERS_PER_FOOT).toFixed(1)} ft)`, stroke: PAL.cyan, tint: PAL.alpha(PAL.cyan, 0.06) }]}
          marks={[{ f: xo, label: "XO" }, { f: sys.bsF3, label: "Baffle step" }, ...(sys.Fb ? [{ f: sys.Fb, label: "Fb" }] : [])]} />
        <ResponseChart fmin={15} fmax={20000} top={HIFI_TOP} bot={HIFI_BOT} step={10} yLabel="max dB SPL @ 1 m"
          series={[{ curve: sys.wMax, label: w.name, stroke: PAL.magenta, tint: PAL.alpha(PAL.magenta, 0.06) }, { curve: tMax, label: t.name, stroke: PAL.cyan, tint: PAL.alpha(PAL.cyan, 0.06) }]} marks={[{ f: xo, label: "XO" }]} />
        <div className="flex flex-col gap-1.5">
          {F.map(([kind, head, body]) => (
            <div key={head} className={`block text-xs leading-relaxed px-3 py-2 rounded border ${CHIP_BACKGROUND_CLASSES[kind] || CHIP_BACKGROUND_CLASSES.ok}`}>
              <b className={`font-semibold mr-1.5 ${kind === "ok" ? "text-green-800" : kind === "warn" ? "text-amber-700" : "text-red-700"}`}>{head}</b>
              <span className="text-stone-500">{body}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
          <RoomView spacing={spacing} toe={toe} seat={seat} setSeat={setSeat} angles={[(gL.th * 180) / Math.PI, (gR.th * 180) / Math.PI]} />
          <div className="text-sm text-stone-500 leading-relaxed">
            <div className="text-xs uppercase tracking-wider text-stone-500 font-semibold mb-1">At the seat</div>
            <div>{(seatDist / METERS_PER_FOOT).toFixed(1)} ft from the pair</div>
            <div>Off axis: L {((gL.th * 180) / Math.PI).toFixed(0)}°, R {((gR.th * 180) / Math.PI).toFixed(0)}°</div>
            <div>Ears {earIn - standIn - sys.lay.tweeterIn >= 0 ? "above" : "below"} tweeter {Math.abs(earIn - standIn - sys.lay.tweeterIn).toFixed(1)}″</div>
            <div><Tooltip tip={`Clean up to about ${atSeat.toFixed(0)} dB at the seat with both speakers playing.`}>Max level</Tooltip> {atSeat.toFixed(0)} dB</div>
          </div>
        </div>
        <div>
          <div className="flex gap-1 mb-2">{[["Horizontal", "h"], ["Vertical", "v"]].map(([l, v]) => <ToggleButton key={v} onClick={() => setPlane(v)} on={plane === v}>{l}</ToggleButton>)}</div>
          <DispersionMap map={map} title={plane === "h" ? "Horizontal dispersion, one speaker (0° is on axis)" : "Vertical dispersion: below (−) to above (+) the tweeter axis"} />
        </div>
        <details className="text-xs text-stone-500 rounded border border-stone-300 bg-stone-50 px-3 py-2">
          <summary className="cursor-pointer text-sm text-stone-900 py-1">Details</summary>
          <div className="leading-relaxed mt-1 flex flex-col gap-1.5">
            <div>Woofer {sys.lay.wooferIn.toFixed(1)}″ and tweeter {sys.lay.tweeterIn.toFixed(1)}″ from the bottom, {sys.lay.spacingIn.toFixed(1)}″ apart. {sys.gross.toFixed(1)} L gross, {sys.net.toFixed(1)} L net{sys.hpf ? `; DSP highpass ${sys.hpf} Hz (BW24) below the port tuning` : ""}.</div>
            <div>Tweeter trimmed {sys.trim.toFixed(1)} dB in the DSP to match the woofer; baffle step centered at {sys.bsF3.toFixed(0)} Hz{bsc ? `, ${bsc} dB boost` : ""}.</div>
            <div><Tooltip tip={w.note}><span className="font-medium text-stone-900">{w.name}</span></Tooltip></div>
            <div><Tooltip tip={t.note}><span className="font-medium text-stone-900">{t.name}</span></Tooltip></div>
            {guide && <div><Tooltip tip={guideSel.note}><span className="font-medium text-stone-900">{guide.name}</span></Tooltip></div>}
          </div>
        </details>
      </div>
      <aside className="min-w-0 md:col-span-2">
        <SelectField label={`Woofer · ${w.size}″`} options={HIFI_WOOFERS_BY_SIZE} value={w} onChange={setW} extra={hLk("woofer", "the woofer")} group={(o) => `${o.size}″ woofers`} />
        <SelectField label={`Tweeter · ${isCD(t) ? "compression driver" : "dome"}`} options={HIFI_TWEETERS_BY_TYPE} value={t} onChange={setT} extra={hLk("tweeter", "the tweeter")} group={(o) => (isCD(o) ? "Compression drivers (on a waveguide)" : "Dome tweeters")} />
        {guide && <SelectField label="Waveguide" options={guides} value={guideSel} onChange={setGuide} />}
        <div className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-x-2 gap-y-2 mb-3 text-sm">
          <span className="text-stone-500">Material</span>
          <div className="flex flex-wrap gap-1">{[["Birch ply", "ply"], ["MDF", "mdf"]].map(([l, v]) => <ToggleButton key={v} onClick={() => setMat(v)} on={mat === v}>{l}</ToggleButton>)}</div>
          <span />
          <span className="text-stone-500">Thickness</span>
          <div className="flex flex-wrap gap-1">{[[0.75, "3/4″"], [0.5, "1/2″"]].map(([v, l]) => <ToggleButton key={v} onClick={() => setWall(v)} on={wall === v}>{l}</ToggleButton>)}</div>
          <span>{hLk("wall", "the panel thickness")}</span>
        </div>
        <Card className="mb-4">
          <Slider label="Width" value={dim.w} min={6} max={16} step={0.25} unit="″" onChange={(v) => setD("w", v)} extra={hDl("w", "Width")} />
          <Slider label="Height" value={dim.h} min={9} max={44} step={0.25} unit="″" onChange={(v) => setD("h", v)} extra={hDl("h", "Height")} />
          <Slider label="Depth" value={dim.d} min={6} max={16} step={0.25} unit="″" onChange={(v) => setD("d", v)} extra={hDl("d", "Depth")} />
          <div className="flex items-center justify-between gap-2 mb-1 mt-1"><span className="text-sm text-stone-500">Ports</span>{hLk("box", "sealed, ported or radiator")}</div>
          <div className="grid grid-cols-3 gap-1 mb-3">{[["Sealed", "sealed", 0, "Sealed"], ["1 port", "vented", 1, "One round port"], ["2 ports", "vented", 2, "Two round ports"], ["Slot", "vented", "slot", "Slot vent along the bottom of the baffle"], ["1 PR", "radiator", 1, "One passive radiator"], ["2 PR", "radiator", 2, "Two passive radiators"]].map(([l, v, n, tip]) => {
            const slotOn = port.shape === "slot";
            const on = box === v && (v === "sealed" || (v === "vented" ? (n === "slot" ? slotOn : !slotOn && port.n === n) : pr.n === n));
            return <ToggleButton key={l} size="xs" className="min-w-0 whitespace-nowrap" title={tip} aria-label={tip} on={on} onClick={() => { setBox(v); if (v === "vented") setPort((p) => (n === "slot" ? { ...p, shape: "slot", h: p.h || 1, len: p.len } : { ...p, shape: "round", n })); if (v === "radiator") setPrSel((p) => ({ ...p, n })); }}>{l}</ToggleButton>;
          })}</div>
          {box === "vented" && (<>
            {port.shape === "slot"
              ? <Slider label={`Slot height (${sys.slotW.toFixed(1)}″ wide)`} value={port.h || 1} min={0.5} max={3} step={0.125} unit="″" onChange={(v) => setP("h", v)} />
              : <Slider label="Port diameter" value={port.dia} min={1} max={4} step={0.25} unit="″" onChange={(v) => setP("dia", v)} />}
            <Slider label={port.shape === "slot" ? "Slot length" : "Port length (centerline)"} value={port.len} min={1} max={30} step={0.25} unit="″" onChange={(v) => setP("len", v)} />
          </>)}
          {box === "radiator" && (<>
            <SelectField label={`Passive radiator · ${prDrv.shape ? "5 × 8″ oval" : `${prDrv.size}″`}`} options={HIFI_PASSIVES_BY_SIZE} value={prDrv} onChange={(o) => setPrSel((p) => ({ ...p, id: o.id, addG: Math.min(p.addG, passiveRadiatorMassMax(o)) }))} group={(o) => (o.shape ? "Oval radiators" : `${o.size}″ radiators`)} />
            <Slider label="Added mass, each" value={pr.addG} min={0} max={passiveRadiatorMassMax(prDrv)} step={5} unit=" g" onChange={(v) => setPrSel((p) => ({ ...p, addG: v }))} />
          </>)}
          <div className="text-xs text-stone-500">{sys.gross.toFixed(1)} L gross{sys.vented ? `, ${sys.pArea.toFixed(1)} in² of ${sys.slot ? "slot" : "port"}` : sys.radiator ? `; radiators on the back tune it to ${sys.Fb.toFixed(0)} Hz, with a notch at ${sys.Fp.toFixed(0)} Hz (their own resonance)${prDrv.xmaxKind === "mechanical" ? ". Its travel limit is the mechanical one; no linear figure is published" : ""}` : ", lightly stuffed"}.</div>
        </Card>
        <Card className="mb-4">
          <Slider label="Crossover" value={xo} min={800} max={4000} step={50} unit=" Hz" onChange={setXo} extra={hLk("xo", "the crossover")} />
          <div className="flex gap-1 mb-3">{[[4, "LR24"], [8, "LR48"]].map(([v, l]) => <ToggleButton key={v} size="xs" onClick={() => setOrder(v)} on={order === v}>{l}</ToggleButton>)}</div>
          <Slider label="Baffle-step boost" value={bsc} min={0} max={6} step={0.5} unit=" dB" onChange={setBsc} />
          <Slider label="Woofer amp @ 8 Ω" value={wAmpW} min={10} max={500} step={10} unit=" W" onChange={setWAmpW} extra={hLk("wAmpW", "the woofer amp power")} />
          <Slider label="Tweeter amp @ 8 Ω" value={tAmpW} min={5} max={200} step={5} unit=" W" onChange={setTAmpW} extra={hLk("tAmpW", "the tweeter amp power")} />
        </Card>
        <Card>
          <div className="text-sm text-stone-500 mb-1">Placement</div>
          <div className="flex flex-wrap gap-1 mb-3">{Object.entries(HIFI_PLACES).map(([k, p]) => <ToggleButton key={k} onClick={() => setPlace(k)} on={place === k}>{p.name}</ToggleButton>)}</div>
          {place !== "free" && <Slider label="Distance to the wall" value={wallFt} min={0.5} max={6} step={0.25} unit=" ft" onChange={setWallFt} />}
          <Slider label="Speaker spacing" value={spacing} min={3} max={14} step={0.5} unit=" ft" onChange={setSpacing} />
          <Slider label="Toe-in" value={toe} min={0} max={35} step={1} unit="°" onChange={setToe} />
          <Slider label="Box bottom height (stand)" value={standIn} min={0} max={40} step={1} unit="″" onChange={setStandIn} />
          <Slider label="Ear height" value={earIn} min={24} max={60} step={1} unit="″" onChange={setEarIn} />
        </Card>
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
                  <SectionHeading><Tooltip tip={r.note}>{r.name}</Tooltip></SectionHeading>
                  <span className="text-sm tabular-nums text-stone-500">≈ ${total.toLocaleString()}</span>
                </div>
                <div className="mb-3" />
                <ul className="text-sm text-stone-900 space-y-1">
                  {r.items.map(([label, cost]) => (
                    <li key={label} className="flex justify-between gap-3"><span>{label}</span><span className="tabular-nums text-stone-500">${cost}</span></li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>

        <section className="mt-2" style={{ fontFamily: "var(--font)" }}>
          <SectionHeading className="mb-2">Signal path (mains rack)</SectionHeading>
          <div className="max-w-4xl"><SignalPath /></div>
          <p className="text-sm text-stone-900 max-w-3xl mt-3"><Tooltip tip="the PA2 holds input EQ and master level, then crossovers, delay and driver EQ on six outputs. Each output feeds one amp channel, set full-range, with the amp's own limiter configured from the driver's power and impedance so it references real output voltage. A safety high-pass around 500 Hz in the horn amp catches a mis-recalled preset, which a level limiter cannot.">How the DSP work is split</Tooltip></p>
        </section>
        <section className="mt-8" style={{ fontFamily: "var(--font)" }}>
          <SectionHeading className="mb-3">Amp DSP: QSC GXD4 / GXD8</SectionHeading>
          <ul className="text-sm text-stone-900 space-y-2 max-w-3xl">
            {[
              ["Power per channel", "GXD4: 400 W into 8 \u03a9, 600 W into 4 \u03a9. GXD8: 800 W into 8 \u03a9, 1200 W into 4 \u03a9. Continuous, both channels driven. Voltage gain 33.5 dB (GXD4), 36.5 dB (GXD8)."],
              ["Filters", "Linkwitz-Riley 24 dB/oct only. Highpass 20 Hz\u20134 kHz, lowpass 60 Hz\u20134 kHz. No Butterworth and nothing steeper. Plus a 4-band PEQ (\u00b112 dB, 0.1\u20133 oct) and 50 ms of delay."],
              ["Limiter", "\u201cSmart Speaker Protection\u201d: Mild, Medium or Aggressive; a speaker power of 5\u2013800 W (GXD8) or 5\u2013400 W (GXD4); and 4 or 8 \u03a9. QSC say to set the power to the speaker's continuous rating."],
              ["What it can't do", "No threshold in volts, no attack or release settings, no limiting confined to one band. QSC don't say how the power setting maps to a threshold (the spec sheet calls it a peak limiter, the manual an RMS limiter)."],
            ].map(([t, d]) => (
              <li key={t} className="flex gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-stone-500 shrink-0" />
                <span><span className="font-medium">{t}.</span> {d}</span>
              </li>
            ))}
          </ul>
          <h3 className="text-base font-medium mt-5 mb-2">Protecting an excursion-limited sub with a GXD</h3>
          <ul className="text-sm text-stone-900 space-y-2 max-w-3xl">
            {[
              ["1. Highpass", "At or a little above tuning, LR24. Set the planner's highpass to LR24 to match."],
              ["2. Limiter power", "The lower of the planner's \u201ccone reaches Xmax at X W\u201d and the driver's rating; Medium or Aggressive. On a GXD8 the ceiling is 800 W, which is just the amp's own limit."],
              ["3. Check it", "Play a sine at the frequency where excursion peaks (the planner's port-velocity row, just above tuning), raise it until the limit indicator lights, and measure AC volts at the speaker terminals. Compare with \u221a(W \u00d7 8)."],
              ["4. Steeper or in volts", "Do it in the PA2 ahead of the amps and keep the GXD limiter as a backstop. Not yet checked against the PA2 manual."],
              ["Horns", "A GXD4 puts 400 W on a 35 W AES driver like the DE360. Its limiter, set to the driver's rating, is the protection; set the planner's HF amp slider to the same power so its numbers match."],
            ].map(([t, d]) => (
              <li key={t} className="flex gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-stone-500 shrink-0" />
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
          <SectionHeading className="mb-3">Crossover / DSP: PA2 and alternatives</SectionHeading>
          <p className="text-sm text-stone-900 mb-3 max-w-3xl">What the planner's protection needs per output: 48 dB/oct highpass, a peak limiter set in volts or dBu with attack and release, a slower RMS limiter, PEQ and delay. At ~15 ft from the mixer keep the inputs balanced; outputs to amps in the same rack matter less.</p>
          <div className="overflow-x-auto"><table className="text-sm w-full min-w-[720px] border-collapse">
            <thead><tr className="text-stone-500 text-left border-b border-stone-300">
              {["Unit", "I/O", "Slopes", "Limiter", "PEQ / out", "Price (US)", "Notes"].map((h, i) => <th key={h} className={`py-1 pr-4 font-normal ${i === 0 ? "sticky left-0 bg-stone-50" : ""}`}>{h}</th>)}
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
                <tr key={r[0]} className="border-b border-stone-300 align-top">
                  {r.map((c, i) => <td key={i} className={`py-1.5 pr-4 ${i === 0 ? "font-medium min-w-[8rem] sm:whitespace-nowrap sticky left-0 bg-stone-50" : ""}`}>{c}</td>)}
                </tr>
              ))}
            </tbody>
          </table></div>
          <p className="text-sm text-stone-900 mt-2 max-w-3xl">Pick: a used DriveRack 260 on a budget; new, the Ashly AQM408 (limiters in dBu with attack and release, 4×8) or the VENU360 (front panel plus app). Keep the GXD limiters as a backstop either way. <Tooltip tip="Ruled out: Dayton DSP-408 (RCA only, no limiter, 24 dB/oct max); miniDSP (only balanced 8-out model is end of life; Flex is 2×4); Xilica XP, Ashly Protea, BSS FDS-366T (discontinued, used only); Symetrix (over budget). Specs from manufacturer manuals; some prices from search snippets, Sep 2026.">Why not the others?</Tooltip></p>
        </section>

        <section className="mt-8" style={{ fontFamily: "var(--font)" }}>
          <SectionHeading className="mb-3">Home inputs: Gemini MXR-01BT</SectionHeading>
          <p className="text-sm text-stone-900 mb-3 max-w-3xl">Turntable, line and phone into the same DSP and amps, with one master volume. A 2-channel DJ mixer does it all in one box.</p>
          <ul className="text-sm text-stone-900 space-y-2 max-w-3xl">
            {[
              ["What it has", "2 channels, each switchable phono or line, 3-band EQ, Bluetooth input, 1/4″ mic, headphones, all-metal chassis."],
              ["Outputs", "Balanced 1/4″ TRS master (to the DSP), RCA master, and an RCA booth out with its own level."],
              ["Hook-up", "Master TRS → TRS-to-XLR-male cables → DSP inputs. Turntable ground wire to the mixer's ground post."],
              ["Volume", "Use the mixer master. Set DSP input and amp gains so the master at full is the loudest you'll want; the DSP and amp limiters stay as a backstop."],
              ["Booth out", "Spare RCA with its own level: could feed a fill or booth monitor through the DSP."],
              ["Turn-on", "Mixer and sources first, amps last; amps off first."],
            ].map(([t, d]) => (
              <li key={t} className="flex gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-stone-500 shrink-0" />
                <span><span className="font-medium">{t}.</span> {d}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-stone-500 mt-3 max-w-3xl">Source: <a className="underline" href="https://www.geminisound.com/products/mxr-01bt">Gemini MXR-01BT</a>. Alternative without a mixer: a hi-fi preamp with phono, RCA out through an ART CleanBox Pro to balanced.</p>
        </section>

        <section className="mt-8" style={{ fontFamily: "var(--font)" }}>
          <SectionHeading className="mb-3">Passive crossover: calibrate and build</SectionHeading>
          <p className="text-sm text-stone-900 mb-3 max-w-3xl">For fills without a maker's network (FaitalPRO, Ciare, B&C 8″). A 2nd-order 2-way is 6–8 parts: woofer coil + cap, HF cap + coil, two pad resistors. About $40–80 per box in parts. All values get tuned, not just the pad.</p>
          <ul className="text-sm text-stone-900 space-y-2 max-w-3xl">
            {[
              ["1. Gear (~$150, once)", "UMIK-1 mic, REW (free) to measure, VituixCAD (free) to design, and an impedance jig (Dayton DATS V3, or a resistor + soundcard in REW)."],
              ["2. Measure in the finished box", "Woofer and HF separately, no crossover: response at 1 m on axis (outdoors or gated), impedance, and a near-field of woofer + port. Don't move the mic between drivers, so the phase stays valid. Optional: 15/30/45° off axis."],
              ["3. Design", "Import into VituixCAD, start from the textbook network, tune values for a flat sum with no dip at the crossover. Round to real part values; keep the minimum impedance at about 5 Ω or above."],
              ["4. Prototype on DSP (optional)", "Copy the target curves into the PA2 or GXD, listen and measure, then match the passive design to what you liked."],
              ["5. Test build", "Clip leads or a loose board outside the box. Measure the whole speaker against the simulation; swap pad resistors to set the HF level (buy a few spare values). Listen at gig level."],
              ["6. Final build", "Stripboard is fine for the HF side; run the woofer path (~6 A at 300 W) in 14–16 AWG wire, not the strips, or wire point to point on a ply board. Space the coils or turn them 90° apart, away from the woofer magnet. Mount on foam, re-measure installed, copy for the other boxes and spot-check each."],
            ].map(([t, d]) => (
              <li key={t} className="flex gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-stone-500 shrink-0" />
                <span><span className="font-medium">{t}.</span> {d}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-stone-900 mt-3 max-w-3xl"><Tooltip tip="Roughly a weekend to measure and design, plus an evening to build and verify.">About 1 weekend</Tooltip></p>
        </section>

        <section className="mt-8" style={{ fontFamily: "var(--font)" }}>
          <SectionHeading className="mb-3">Materials</SectionHeading>
          <ul className="text-sm text-stone-900 space-y-2 max-w-3xl">
            {[
              ["Prototype in particleboard", "Cheap and flat. Build it to verify duct tuning, then transfer interior dimensions \u2014 not the cut list \u2014 to the real material."],
              ["Consider 5/8\" or 1/2\" for the final boxes", "Sub column drops 119 \u2192 107 \u2192 95 lb loaded. Needs more bracing, and the extra interior volume lowers Fb, so the duct gets shorter."],
              ["MDO for the baffles", "Paints far better than birch, no edge penalty since no baffle edge is exposed."],
            ].map(([t, d]) => (
              <li key={t} className="flex gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-stone-500 shrink-0" />
                <span><span className="font-medium">{t}.</span> {d}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-8" style={{ fontFamily: "var(--font)" }}>
          <SectionHeading className="mb-3">Still to decide</SectionHeading>
          <ul className="text-sm text-stone-900 space-y-2 max-w-3xl">
            {[
              ["Baffle mounting", "Cleats (forgiving, costs 3/4\" of interior on each side) or a stopped rabbet in the frame panels (tighter, squares the box, needs a dado). Baffle size changes with the choice."],
              ["Bracing", "Not drawn. Volume and weight allow for two braces. Center ribs, slat ladder or windowed shelves — decide once handle recesses are placed, since they compete for the same panel area."],
              ["Handles", "Recess type, depth and position on the sub. Interacts with bracing."],
              ["Driver margins", "Currently equal at top and sides. One recommendation is to offset deliberately so baffle modes and diffraction paths don't coincide — likely inaudible below 100 Hz, so mostly a visual decision."],
              ["Port edge finish", "The letterbox mouths are cut in the shell's nose band, so this is a shell-material question, not a baffle one. Paint carried into the ducts, or masked so the ply edge shows — end grain in the mouth needs sealing either way."],
              ["Duct tuning", "Verify Fb by impedance sweep on the particleboard prototype and trim the duct before cutting birch. End correction is the largest source of error in the modelled Fb."],
              ["Sensitivity", "SB's 99 dB claim is 3 dB above what their own published T/S parameters give (95.9 dB/2.83V). Everything about levels and limiter settings depends on which is right. Measure it, or assume the lower figure."],
              ["Driver clearance", "Check the Nero's frame and 8.4\" mounting depth against the baffle margin and anything that ends up behind the magnet."],
              ["Compression driver", "DE360 at $117 is the default; crossover floor on the A400G2 needs a distortion sweep to confirm ~1.1 kHz."],
              ["Horn print", "A400G2 in one piece needs a 400 mm+ bed; otherwise sectioned. Filament, print service, or buy the RX-28 instead."],
              ["Prototype material", "3/4\" particleboard for the first sub, then transfer verified interior dimensions to birch."],
              ["Final panel thickness", "3/4\" or braced 1/2\" birch (switch it under Plywood in the planner). 1/2\" needs bracing on roughly 12\" centers and a doubler at the driver cutout. Decide before the prototype, since wall thickness changes the interior volume and therefore the duct length."],
              ["Baffle material", "MDO if the baffles are painted — no baffle edge is exposed in any of the current configurations, so there is no reason not to. Birch only if the baffle is ever meant to be clear-finished."],
            ].map(([t, d]) => (
              <li key={t} className="flex gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-stone-500 shrink-0" />
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
  const near = (f) => nearestPoint(maxC, f);
  const disp = ts.disp != null ? ts.disp : drv.size >= 10 ? 1.5 : 1;
  const hf = drv.hf;
  const kick = near(60).spl, mid = near(150).spl;
  const tile = (k, v, u) => (
    <div key={k} className="bg-stone-50 px-3 py-2.5">
      <div className="text-xs uppercase tracking-wider text-stone-500 font-semibold"><StatLabel k={k} /></div>
      <div className="text-xl font-medium tabular-nums mt-0.5 break-words">{v}<span className="text-xs text-stone-500 ml-0.5">{u}</span></div>
    </div>
  );
  const F = fillChips({ drv, dim, Fb: vM ? vM.Fb : null, Qtc: sM ? sM.Qtc : null, hp, portLimited, portMax, f3, hf, hfLimW, ampW, pad });
  return (
    <main className="max-w-6xl mx-auto px-4 md:px-8 pb-16 grid grid-cols-1 md:grid-cols-5 gap-8" style={{ fontFamily: "var(--font)" }}>
      <div className="min-w-0 md:col-span-3 flex flex-col gap-4">
        <p className="text-sm text-stone-500"><Tooltip tip="Passive 8–10″ coaxial fills or booth monitors, highpassed to the subs. One amp channel each (or a pair in parallel).">Passive fills</Tooltip></p>
        <div className="grid gap-px rounded-lg overflow-hidden border border-stone-300 bg-stone-300 grid-cols-2 sm:grid-cols-[repeat(auto-fit,minmax(112px,1fr))] [&>*:last-child:nth-child(odd)]:col-span-2 sm:[&>*:last-child:nth-child(odd)]:col-span-1">
          {tile("Net volume", net.toFixed(0), "L")}
          {vM ? tile("Tuning Fb", vM.Fb.toFixed(0), "Hz") : tile("Qtc", sM.Qtc.toFixed(2), "")}
          {tile("F3", f3.toFixed(0), "Hz")}
          {tile("Max @ 60 Hz", kick.toFixed(1), "dB")}
          {tile("Max @ 150 Hz", mid.toFixed(1), "dB")}
          {tile("Weight", lb.toFixed(0), "lb")}
        </div>
        <ResponseChart fmax={300} series={[{ curve: maxC, label: drv.name, stroke: PAL.cyan, tint: PAL.alpha(PAL.cyan, 0.07) }]} marks={[{ f: hp, label: "HP" }, ...(vM ? [{ f: vM.Fb, label: "Fb" }] : [])]} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-0.5 text-sm">
          {[
            ["Woofer sensitivity", `${sens.toFixed(1)} dB`, "2.83 V, half space, 1 m, modelled"],
            ["HF sensitivity", hf ? `${hf.sens} dB` : "—", hf ? `pad about ${pad.toFixed(0)} dB to match` : "not published"],
            ["HF coverage", hf && hf.cov ? `${hf.cov}° conical` : "—"],
            ["HF crossover", hf && hf.xo ? `${hf.xo} Hz or higher` : "—", "recommended minimum"],
            ["Max SPL at 100 Hz", `${near(100).spl.toFixed(1)} dB`, `sine, ${near(100).who}-limited`],
            ["Price", drv.price ? `$${drv.price}` : "—", drv.src],
          ]
.map(([k, v, note, tip]) => <StatRow key={k} k={k} v={v} note={note} tip={tip} />)}
        </div>
        <div className="flex flex-col gap-1.5">
          {F.map(([kind, head, body]) => (
            <div key={head} className={`block text-xs leading-relaxed px-3 py-2 rounded border ${CHIP_BACKGROUND_CLASSES[kind] || CHIP_BACKGROUND_CLASSES.ok}`}>
              <b className={`font-semibold mr-1.5 ${kind === "ok" ? "text-green-800" : kind === "warn" ? "text-amber-700" : "text-red-700"}`}>{head}</b>
              <span className="text-stone-500">{body}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-stone-500"><span className="font-medium text-stone-500">{drv.name}.</span> {drv.note} <Tooltip tip={`Specs from usspeaker.com, Sep 2026. Box weight assumes 1/2″ birch. Displacement ${ts.disp != null ? "as published" : `not published; ${disp} L assumed`}.`}>Spec notes</Tooltip></p>
      </div>
      <aside className="min-w-0 md:col-span-2">
        <SelectField label="Coaxial driver" options={FILL_OPTIONS} value={drv} onChange={setDrv} />
        <div className="text-sm text-stone-500 mb-1">Box</div>
        <div className="flex gap-1 mb-2">
          {[["Vented", "vented"], ["Sealed", "sealed"]].map(([l, v]) => (
            <ToggleButton key={v} onClick={() => setBoxType(v)} on={boxType === v}>{l}</ToggleButton>
          ))}
        </div>
        <Card className="mb-4">
          <Slider label="Width" value={dim.w} min={9} max={20} step={0.5} unit="″" onChange={(v) => setD("w", v)} />
          <Slider label="Height" value={dim.h} min={9} max={28} step={0.5} unit="″" onChange={(v) => setD("h", v)} />
          <Slider label="Depth" value={dim.d} min={7} max={20} step={0.5} unit="″" onChange={(v) => setD("d", v)} />
          {boxType === "vented" && (<>
            <Slider label="Ports" value={port.n} min={1} max={3} step={1} unit="" onChange={(v) => setP("n", v)} />
            <Slider label="Port diameter" value={port.dia} min={1.5} max={5} step={0.25} unit="″" onChange={(v) => setP("dia", v)} />
            <Slider label="Port length" value={port.len} min={1} max={14} step={0.25} unit="″" onChange={(v) => setP("len", v)} />
            <Slider label="Port velocity limit" value={portMax} min={12} max={30} step={0.5} unit=" m/s" onChange={setPortMax} />
          </>)}
          <div className="text-xs text-stone-500">{gross.toFixed(0)} L gross{boxType === "sealed" ? ", stuffed" : `, ${pArea.toFixed(1)} in² of port`}.</div>
        </Card>
        <Card>
          <Slider label="Highpass to the subs (LR24)" value={hp} min={50} max={160} step={5} unit=" Hz" onChange={setHp} />
          <Slider label="Amp power per box @ 8 Ω" value={ampW} min={25} max={800} step={25} unit=" W" onChange={setAmpW} />
          <div className="text-xs text-stone-500">A freed GXD4 channel with two 8 Ω fills in parallel gives about 300 W each.</div>
        </Card>
      </aside>
    </main>
  );
}

function CutlistPage(props) {
  const { joint, setJoint, sheetKind, setSheetKind, sets, setSets, wall } = props;
  const { parts, vent } = cutParts(props);
  const S = PLYWOOD_SHEETS[sheetKind], kerf = 0.125;
  const byT = {};
  parts.forEach((p) => { for (let i = 0; i < p.qty * sets; i++) (byT[p.t] = byT[p.t] || []).push(p); });
  const packs = Object.keys(byT).sort((a, b) => b - a).map((t) => ({ t: +t, ...packSheets(byT[t], S, kerf) }));
  return (
    <main className="max-w-6xl mx-auto px-4 md:px-8 pb-16" style={{ fontFamily: "var(--font)" }}>
      <div className="flex flex-wrap gap-6 mb-5">
        <div><div className="text-sm text-stone-500 mb-1">Corner joints</div>
          <div className="flex gap-1">{[["butt", "Butt"], ["rabbet", "Rabbet"], ["miter", "Miter"]].map(([k, l]) => <ToggleButton key={k} on={joint === k} onClick={() => setJoint(k)}>{l}</ToggleButton>)}</div></div>
        <div><div className="text-sm text-stone-500 mb-1">Sheet</div>
          <div className="flex gap-1">{Object.entries(PLYWOOD_SHEETS).map(([k, s]) => <ToggleButton key={k} on={sheetKind === k} onClick={() => setSheetKind(k)}>{s.name}</ToggleButton>)}</div></div>
        <div><div className="text-sm text-stone-500 mb-1">Stacks</div>
          <div className="flex gap-1">{[1, 2, 4].map((n) => <ToggleButton key={n} on={sets === n} onClick={() => setSets(n)}>{n}</ToggleButton>)}</div></div>
      </div>
      <p className="text-sm text-stone-500 mb-4 max-w-3xl">From the planner's current boxes: {formatThickness(wall)} walls, 3/4″ baffles set {formatInches(props.inset)}″ back, back panels in a rabbet. Sizes are finished dimensions in inches (width × length); {formatInches(kerf)}″ kerf allowed in the layout. Quantities are for {sets} stack{sets > 1 ? "s" : ""}.</p>
      <div className="overflow-x-auto mb-6"><table className="text-sm w-full sm:min-w-[640px] border-collapse">
        <thead><tr className="text-stone-500 text-left border-b border-stone-300">
          <th className="py-1 pr-3 font-normal">Box</th><th className="py-1 pr-3 font-normal">Part</th><th className="py-1 pr-3 font-normal text-right">Qty</th>
          <th className="py-1 pr-3 font-normal text-right">Width × length</th><th className="py-1 pr-3 font-normal">Ply</th><th className="py-1 font-normal hidden sm:table-cell">Notes</th>
        </tr></thead>
        <tbody>{parts.map((p, i) => (
          <tr key={i} className="border-b border-stone-300 align-top">
            <td className="py-1 pr-3">{p.box}</td><td className="py-1 pr-3">{p.part}{p.note && <span className="block sm:hidden text-xs text-stone-500">{p.note}</span>}</td><td className="py-1 pr-3 text-right tabular-nums">{p.qty * sets}</td>
            <td className="py-1 pr-3 text-right tabular-nums whitespace-nowrap">{formatInches(Math.min(p.a, p.b))} × {formatInches(Math.max(p.a, p.b))}</td>
            <td className="py-1 pr-3">{formatThickness(p.t)}</td><td className="py-1 text-stone-500 hidden sm:table-cell">{p.note}</td>
          </tr>))}</tbody>
      </table></div>
      {vent.length > 0 && <p className="text-sm text-stone-500 mb-6">Also: {vent.join("; ")}.</p>}
      <SectionHeading className="mb-2">Sheet layout, {S.name}</SectionHeading>
      {packs.map((pk) => (
        <div key={pk.t} className="mb-6">
          <div className="text-sm font-medium mb-2">{formatThickness(pk.t)} birch: {pk.sheets.length} sheet{pk.sheets.length > 1 ? "s" : ""}</div>
          {pk.tooBig.length > 0 && <div className="text-sm text-red-700 mb-2">Doesn't fit on one {S.name} sheet: {pk.tooBig.map((r) => `${r.box} ${r.part}`).join(", ")}.</div>}
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-4">{pk.sheets.map((sh, i) => <SheetDrawing key={i} sheet={sh} S={S} idx={i} />)}</div>
        </div>
      ))}
      <p className="text-sm text-stone-500"><Tooltip tip="Simple row-by-row layout, grain direction ignored. Treat it as a sheet count and a starting point for your own cut plan. Driver cutouts are typical values; use the datasheet's.">About this layout</Tooltip></p>
    </main>
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
  const [paPlane, setPaPlane] = useState("v");    // dispersion map: vertical (lobing) or horizontal
  const [mAmpW, setMAmpW] = useState(400);       // amp power per mid channel, into 8 Ω
  const [tilt, setTilt] = useState(6);           // how much less the mid band needs than the sub band, dB
  const [hfAmpW, setHfAmpW] = useState(100);     // amp power per HF channel, rated into 8 Ω
  const [hfTilt, setHfTilt] = useState(6);       // how much less the horn band needs than the mid band, dB
  const setM = (k, v) => setMDim((p) => ({ ...p, [k]: v }));
  const plinth = 3; // fixed, matches the duct height
  const [cutaway, setCutaway] = useState(false);
  const [cabinet] = useState(CABINETS[0]);
  const [portStyle, setPortStyle] = useState("slots");
  const [layout, setLayout] = useState("stack");
  const format = FORMATS[0];   // 18″ sub + compression driver; mid is 12″ or 15″
  const [midSize, setMidSize] = useState(12);
  const [wall, setWall] = useState(0.75);   // side/top/bottom/back ply, in
  const [inset, setInset] = useState(0.75); // how far the baffles sit back from the frame front, in
  const [baffleColor, setBaffleColor] = useState(PAINT_SWATCHES.find(([, name]) => name === "Dusty pink")[0]);
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
  const lk = (key, what) => optOn ? <LockButton on={!!locks[key]} what={what} onClick={() => setLocks((p) => ({ ...p, [key]: !p[key] }))} /> : null;
  const dl = (box, dim, what) => optOn ? <DimensionLock mode={locks[box][dim] || "free"} what={what} onChange={(m) => setLocks((p) => ({ ...p, [box]: { ...p[box], [dim]: m } }))} /> : null;
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
  const store = useConfigStore("configs");
  const { db, saved, fb, fbUser, cfgMsg, setCfgMsg, signIn, signOut } = store;
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
  // In the tower layout the mid chamber is the sub's footprint, 15.5 in tall.
  const midDims = layout === "tower" ? { w: cDim.w, h: 15.5, d: cDim.d } : mDim;
  const midSel = { ...mid, box: midDims };
  const subList = SUB_OPTIONS.filter((o) => o.size === format.sub);
  const midList = MID_OPTIONS.filter((o) => (o.size || 12) === midSize);
  const boxList = MID_BOXES.filter((b) => (b.size || 12) === midSize && b.id !== "b13");
  const subBox = cDim;
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
  const midCabLb = midWeightLb(midDims, wall);
  const midLbLoaded = midCabLb + (mid.lb || 0);
  const midNear = (f) => midMax.reduce((b, o) => (Math.abs(o.f - f) < Math.abs(b.f - f) ? o : b));
  // Sub through its lowpass at the crossover, for the system chart. Its own limits scale with the filter.
  const subSys = mdl ? subThroughLowpass(mdl, sub.ts, AMP_V, portMax, xoLo) : null;
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
  const midBeam = mid.ts ? pistonBeamWidthDeg(mid.ts.Sd, xoHi) : null;
  // Horizontal beamwidth against frequency: mid as a rigid piston, horn at its rated coverage down
  // to Keele's pattern-control limit and proportionally wider below. Rules of thumb.
  const beamCurves = (() => {
    const hz0 = horn.hf || {};
    const fK = hz0.covH && horn.size ? keeleFrequency(hz0.covH, horn.size.w) : null;
    const midB = [], hornB = [];
    for (let i = 0; i < 160; i++) {
      const f = 200 * Math.pow(10000 / 200, i / 159);
      if (mid.ts) midB.push({ f, spl: pistonBeamWidthDeg(mid.ts.Sd, f) });
      if (fK && f >= (hz0.lowHz || 0) * 0.7) hornB.push({ f, spl: hornBeamWidthDeg(hz0.covH, fK, f) });
    }
    return { midB, hornB, fK };
  })();

  const subMusicAtXo = mdl && lim ? subMusicOutputAt(mdl, lim, AMP_V, xoLo) : null;

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
    if (c.hpType && HIGHPASS_ALIGNMENTS[c.hpType]) setHpType(c.hpType);
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
  // ---- optimizer actions ----
  const today = () => new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const runOpt = async (over) => {
    const inp = { ...optIn, ...(over && over.nativeEvent ? {} : over || {}) };
    if (over && !over.nativeEvent) setOpt(over);
    if (!inp.goals.length) return;
    setOptBusy(true); setOptErr("");
    try {
      const cur = preview ? preview.before : snapshot();
      setOptRes(await runPaOptimizer({ cur, room: inp.room, maxLb: inp.maxLb, budget: inp.budget, goals: inp.goals, locks }));
    } catch (e) { setOptErr("The search failed: " + ((e && e.message) || e)); }
    setOptBusy(false);
  };
  // a result only sets the fields the search changes; finish, colours, layout and balance stay as they are now
  const optPreview = (k) => {
    const before = preview ? preview.before : snapshot();
    restore({ ...snapshot(), ...pickOptimizedFields(k.config) }); setPreview({ label: k.label, before, card: k });
  };
  const optBack = () => { if (preview) restore(preview.before); setPreview(null); };
  const optLoad = async (k) => {
    const before = preview ? preview.before : snapshot();
    restore({ ...snapshot(), ...pickOptimizedFields(k.config) }); setPreview(null); setUndoSnap(before);
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
      await db.collection("configs").doc().set({ ...snapshot(), ...pickOptimizedFields(k.config), name: name.slice(0, 60), savedAt: Date.now(),
        summary: `${k.names.sub} · ${k.config.cDim.w}×${k.config.cDim.h}×${k.config.cDim.d}″ · ${m.Fb.toFixed(1)} Hz` });
      setToast(`Saved "${name.slice(0, 60)}".`);
    } catch { setToast("Couldn't save — try again"); }
  };
  const curOut = optOn ? (() => { try { const m = evaluateConfig(preview ? preview.before : snapshot()); return m ? m.out : null; } catch { return null; } })() : null;

  const subLbLoaded = subWeightLb(subBox, wall, sub.lb);

  const midL = midGrossL;
  const subTopH = plinth + subBox.h;
  const isTower = layout === "tower";
  const baseH = layout === "satellite" ? 34 : layout === "pole" ? subTopH + spacerH : isTower ? subTopH : subTopH + 0.4;
  const archT = isTower && !!horn.profile && !horn.scaleX && subBox.w / 2 - 0.75 > horn.size.w / 2;
  const stackH = isTower ? baseH + 15.5 + (archT ? subBox.w - 0.75 : horn.size.h + 2) : baseH + midDims.h + 1.2 + horn.size.h + 2;
  const hornCenter = isTower ? baseH + 15.5 + (archT ? subBox.w / 2 - 0.75 : (horn.size.h + 2) / 2) : baseH + midDims.h + 1.2 + 1 + horn.size.h / 2;
  // driver heights for the dispersion map: mid centered in its box (or the tower's mid section), sub at its box center
  const midCenter = isTower ? baseH + 15.5 / 2 : baseH + midDims.h / 2;
  const PA_MAP_M = 10;
  const paMap = mid.ts && hz.covH && horn.size ? paDispersionMap({
    sub: sub.ts ? { zIn: plinth + subBox.h / 2, Sd: sub.ts.Sd } : null, mid: { zIn: midCenter, Sd: mid.ts.Sd },
    horn: { zIn: hornCenter, covH: hz.covH, covV: hz.covV || hz.covH, wIn: horn.size.w, hIn: horn.size.h }, xoLo, xoHi, order: 4,
  }, paPlane, PA_MAP_M) : null;
  const mhGap = hornCenter - midCenter, mhNull = firstNullAngleDeg(mhGap, xoHi);

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900" style={{ fontFamily: "var(--font)" }}>
      <header className="px-4 md:px-8 pt-6 md:pt-8 pb-4 max-w-6xl mx-auto">
        {(() => {
          // two levels: the project (PA stack or hi-fi), then the PA stack's own pages
          const go = (v, href) => (e) => { e.preventDefault(); try { history.replaceState(null, "", v === "planner" ? " " : href); } catch {} setView(v); window.scrollTo(0, 0); };
          const pa = view !== "hifi";
          const top = [["planner", "PA Stack", "#", pa], ["hifi", "Hi-fi", "#hifi", !pa]];
          const sub = [["planner", "Design", "#"], ["cutlist", "Cutlist", "#cutlist"], ["fills", "Fills", "#fills"], ["notes", "Notes", "#notes"]];
          return (<>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <h1 className="text-3xl md:text-4xl leading-tight font-extrabold tracking-tight">SpeakNow</h1>
            <nav className="flex gap-1" style={{ fontFamily: "var(--font)" }} aria-label="Projects">
              {top.map(([v, label, href, on]) => (
                <a key={v} href={href} aria-current={on ? "page" : undefined} onClick={go(v, href)}
                  className={`px-4 py-2 rounded border-2 text-base font-semibold ${on ? "border-stone-900 bg-stone-900 text-stone-50" : "border-stone-300 hover:border-stone-500"}`}>{label}</a>
              ))}
            </nav>
            </div>
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

      <SavedConfigs store={store} snapshot={snapshot} restore={restore}
        extra={fbUser && <button onClick={importSeed} className="hover:underline">Import saved configs</button>} />

      <section className="max-w-6xl mx-auto px-4 md:px-8 pb-3" style={{ fontFamily: "var(--font)" }}>
        {(() => {
          const n = Object.entries(locks).reduce((a, [k, v]) => a + (k.endsWith("Dim") ? Object.values(v).filter((m) => m && m !== "free").length : v ? 1 : 0), 0);
          // lock everything (box sizes exact), then unlock the one or two things you want the optimizer to change
          const all = { ...Object.fromEntries(LOCK_KEYS.map((k) => [k, true])), subDim: { w: "exact", h: "exact", d: "exact" }, midDim: { w: "exact", h: "exact", d: "exact" } };
          return <OptimizerBar on={optOn} onToggle={() => setOptOn(!optOn)} hint="Find cheaper, lighter or louder designs inside your limits."
            nLocks={n} lockMax={LOCK_KEYS.length + 6} onLockAll={() => setLocks(() => all)} onClear={() => setLocks(() => ({ subDim: {}, midDim: {} }))} />;
        })()}
      </section>
      {optOn && <OptimizerPanel optIn={optIn} setOpt={setOpt} run={runOpt} busy={optBusy} res={optRes} err={optErr} curOut={curOut} 
        previewCard={preview && preview.card} canSave={!!db}
        onPreview={optPreview} onLoad={optLoad} onSave={optSave} />}
      {preview && (
        <div className="fixed top-0 inset-x-0 z-50 bg-stone-900 text-white border-b-4 border-cmy-y px-4 py-2 flex flex-wrap items-center justify-center gap-3 text-sm" style={{ fontFamily: "var(--font)" }}>
          <span>Previewing: <b className="font-semibold">{preview.label}</b></span>
          <Button variant="primary" size="xs" onClick={() => optLoad(preview.card)}>Load</Button>
          <button onClick={optBack} className="px-3 py-1.5 rounded border border-stone-900 bg-white">Back</button>
        </div>
      )}
      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-20 md:bottom-6 z-50 w-[calc(100%-2rem)] max-w-xl bg-stone-900 text-stone-50 rounded-lg px-4 py-2.5 flex items-center gap-3 text-sm shadow-lg" style={{ fontFamily: "var(--font)" }} role="status">
          <span className="flex-1">{toast}</span>
          {undoSnap && <button onClick={optUndo} className="px-3 py-1.5 rounded border border-stone-500">Undo</button>}
          <button onClick={() => setToast("")} aria-label="Dismiss" className="px-2 py-1.5 rounded border border-stone-900">✕</button>
        </div>
      )}
      {mdl && lim && (
        <div className="md:hidden sticky top-0 z-30 bg-stone-50/95 backdrop-blur border-b border-stone-300 px-4 py-1.5 grid grid-cols-4 gap-2 text-center" style={{ fontFamily: "var(--font)" }}>
          {[["Fb", `${mdl.Fb.toFixed(1)}`, "Hz"], ["35 Hz", `${maxNear(35).spl.toFixed(0)}`, "dB"], ["Sub", `${subLbLoaded.toFixed(0)}`, "lb"], ["Limit", { "port air speed": "port", "cone travel (Xmax)": "Xmax", "driver program rating": "thermal", "amplifier power": "amp" }[lim.who] || lim.who, ""]].map(([k, v, u]) => (
            <div key={k}><div className="text-xs uppercase tracking-wider text-stone-500">{k}</div><div className="text-sm font-medium tabular-nums">{v}<span className="text-xs text-stone-500 ml-0.5">{u}</span></div></div>
          ))}
        </div>
      )}
      <main className={`max-w-6xl mx-auto px-4 md:px-8 pb-16 grid ${sheetOpen ? "max-md:pb-[52dvh]" : "max-md:pb-24"} grid-cols-1 md:grid-cols-5 gap-8`}>
        <div className="min-w-0 md:col-span-3 flex flex-col gap-5">
        <section className={full3d ? "fixed inset-0 z-50 bg-stone-50" : "relative rounded-lg overflow-hidden border border-stone-300 bg-stone-50 h-[300px] md:h-[clamp(320px,56vh,560px)]"}>
          <button onClick={() => setFull3d((v) => !v)} aria-label={full3d ? "Close full screen" : "Full screen"} title={full3d ? "Close full screen" : "Full screen"}
            className="absolute top-2 right-2 z-10 w-9 h-9 inline-flex items-center justify-center rounded border border-stone-300 bg-white/90 hover:border-stone-500">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {full3d ? <path d="M4 4l8 8M12 4l-8 8" /> : <path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" />}
            </svg>
          </button>
          <StackView sub={subSel} mid={midSel} horn={horn} plinth={plinth} cutaway={cutaway} portStyle={portStyle} layout={layout} baffleColor={baffleColor} portGeom={portGeom} wall={wall} inset={inset} cabFinish={cabFinish} spacerH={spacerH} />
        </section>

        <section className="mt-1" style={{ fontFamily: "var(--font)" }}>
          <FoldHeading id="sub" title="Sub" folds={folds} toggle={toggleFold} className="mb-3 md:hidden" />
          <div className={foldCls("sub")}>
          {mdl && lim && (
            <div className="grid gap-px mb-4 rounded-lg overflow-hidden border border-stone-300 bg-stone-300 grid-cols-2 sm:grid-cols-[repeat(auto-fit,minmax(112px,1fr))] [&>*:last-child:nth-child(odd)]:col-span-2 sm:[&>*:last-child:nth-child(odd)]:col-span-1">
              {[
                ["Net volume", netL.toFixed(0), "L"],
                ["Tuning Fb", mdl.Fb.toFixed(1), "Hz"],
                ["System F3", mdl.f3.toFixed(0), "Hz"],
                ["Max SPL @ 35 Hz", maxNear(35).spl.toFixed(1), "dB"],
                ["Weight", subLbLoaded.toFixed(0), "lb"],
              ].map(([k, v, u]) => (
                <div key={k} className="bg-stone-50 px-3 py-2.5">
                  <div className="text-xs uppercase tracking-wider text-stone-500 font-semibold"><StatLabel k={k} /></div>
                  <div className="text-xl font-medium tabular-nums mt-0.5 break-words">{v}<span className="text-xs text-stone-500 ml-0.5">{u}</span></div>
                </div>
              ))}
            </div>
          )}
          {mdl && lim && <div className="mb-4"><ResponseChart fmax={20000} series={[{ curve: subSys, label: "Sub", stroke: PAL.ink, tint: PAL.alpha(PAL.ink, 0.07) }, ...(midMax ? [{ curve: midMax, label: "Mid-bass", stroke: PAL.magenta, tint: PAL.alpha(PAL.magenta, 0.06) }] : []), ...(hornModel ? [{ curve: hornModel.curve, label: "Horn", stroke: PAL.cyan, tint: PAL.alpha(PAL.cyan, 0.06) }] : [])]} marks={[{ f: mdl.Fb, label: "Fb" }, { f: xoLo, label: "XO" }, { f: xoHi, label: "XO" }]} /></div>}
          {mdl ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-0.5 text-sm">
              {[
                ["Gross internal", `${grossL.toFixed(0)} L`],
                ["Port area", `${port.area.toFixed(1)} in²`, `${((port.area / (sub.ts.Sd / 6.4516)) * 100).toFixed(0)}% of cone area`],
                ["Hydraulic diameter", `${port.dh.toFixed(2)}″`, port.dh < 2 ? "low — flare the mouths" : "acceptable with flares"],
                ["Midband sensitivity", `${(mdl.ref - 20 * Math.log10(AMP_V / 2.83)).toFixed(1)} dB`, "2.83 V, half space, 1 m"],
                ...[30, 35, 45, 60].map((f) => { const m = maxNear(f);
                  return [`Max SPL at ${f} Hz`, `${m.spl.toFixed(1)} dB`, `sine, ${m.who}-limited`]; }),
                ["First limit, music", lim.who, `at ${Math.round(lim.W / 10) * 10} W`, `at ${Math.round(lim.W / 10) * 10} W${lim.who === "cone travel (Xmax)" ? `, reached first at ${mdl.peakXF.toFixed(0)} Hz` : lim.who === "port air speed" ? `, reached first at ${mdl.peakVelF.toFixed(0)} Hz` : ""}; the two rows below are at this power.`],
                ["Peak port velocity", `${lim.vel.toFixed(1)} m/s`, `at ${mdl.peakVelF.toFixed(0)} Hz`],
                ["Peak excursion", `${(mdl.peakX * lim.V / AMP_V).toFixed(1)} mm`, `${lim.xPct.toFixed(0)}% of Xmax, at ${mdl.peakXF.toFixed(0)} Hz`],
              ]
.map(([k, v, note, tip]) => <StatRow key={k} k={k} v={v} note={note} tip={tip} />)}
            </div>
          ) : (
            <p className="text-sm text-stone-500 ">
              {sub.name} can't be modelled yet: its parameters are incomplete. {sub.note}
            </p>
          )}
          {mdl && lim && (
            <div className="flex flex-col gap-1.5 mt-4">
              {(() => {
                const F = subChips({ subSize: format.sub, subBox, portStyle, cVent, PT, subLbLoaded, lim, peakXF: mdl.peakXF, aes: sub.ts.aes, ampW });
                return F.map(([kind, head, body]) => (
                  <div key={head} className={`block text-xs leading-relaxed px-3 py-2 rounded border ${CHIP_BACKGROUND_CLASSES[kind] || CHIP_BACKGROUND_CLASSES.ok}`}>
                    <b className={`font-semibold mr-1.5 ${kind === "ok" ? "text-green-800" : kind === "warn" ? "text-amber-700" : "text-red-700"}`}>{head}</b>
                    <span className="text-stone-500">{body}</span>
                  </div>
                ));
              })()}
            </div>
          )}
          </div>
        </section>

        <section className="mt-2" style={{ fontFamily: "var(--font)" }}>
          <FoldHeading id="mid" title="Mid-bass" folds={folds} toggle={toggleFold} className="mb-3" />
          <div className={foldCls("mid")}>
          {mMdl ? (<>
            <div className="grid gap-px mb-4 rounded-lg overflow-hidden border border-stone-300 bg-stone-300 grid-cols-2 sm:grid-cols-[repeat(auto-fit,minmax(112px,1fr))] [&>*:last-child:nth-child(odd)]:col-span-2 sm:[&>*:last-child:nth-child(odd)]:col-span-1">
              {[
                ["Net volume", midNetL.toFixed(0), "L"],
                ["Box resonance Fc", mMdl.Fc.toFixed(0), "Hz"],
                ["Box F3", mMdl.f3.toFixed(0), "Hz"],
                [`Max SPL @ ${xoLo} Hz`, midNear(xoLo).spl.toFixed(1), "dB"],
                ["Weight", midLbLoaded.toFixed(0), "lb"],
              ].map(([k, v, u]) => (
                <div key={k} className="bg-stone-50 px-3 py-2.5">
                  <div className="text-xs uppercase tracking-wider text-stone-500 font-semibold"><StatLabel k={k} /></div>
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
                ["Peak excursion", `${(mMdl.peakX * midUseV / MID_V).toFixed(1)} mm`, `${(mMdl.peakX * midUseV / MID_V / mid.ts.Xmax * 100).toFixed(0)}% of Xmax`, `At ${Math.round(midUseV * midUseV / 8)} W, with the ${xoLo} Hz highpass.`],
              ]
.map(([k, v, note, tip]) => <StatRow key={k} k={k} v={v} note={note} tip={tip} />)}
            </div>
            <div className="flex flex-col gap-1.5 mt-4">
              {(() => {
                const F = midChips({ midSize, midDims, Qtc: mMdl.Qtc, f3: mMdl.f3, peakX: mMdl.peakX, xoLo, ts: mid.ts, V: MID_V, useV: midUseV, vTherm: vMidTherm, mAmpW,
                  subMusicAtXo, tilt, midAtXo: subMusicAtXo != null ? midNear(xoLo) : null });
                return F.map(([kind, head, body]) => (
                  <div key={head} className={`block text-xs leading-relaxed px-3 py-2 rounded border ${CHIP_BACKGROUND_CLASSES[kind] || CHIP_BACKGROUND_CLASSES.ok}`}>
                    <b className={`font-semibold mr-1.5 ${kind === "ok" ? "text-green-800" : kind === "warn" ? "text-amber-700" : "text-red-700"}`}>{head}</b>
                    <span className="text-stone-500">{body}</span>
                  </div>
                ));
              })()}
            </div>
          </>) : (
            <p className="text-sm text-stone-500">{mid.name} can't be modelled yet: its parameters are incomplete. {mid.note}</p>
          )}
          </div>
        </section>

        <section className="mt-2" style={{ fontFamily: "var(--font)" }}>
          <FoldHeading id="horn" title="Horn" folds={folds} toggle={toggleFold} className="mb-3" />
          <div className={foldCls("horn")}>
          {hornModel ? (<>
            <div className="grid gap-px mb-4 rounded-lg overflow-hidden border border-stone-300 bg-stone-300 grid-cols-2 sm:grid-cols-[repeat(auto-fit,minmax(112px,1fr))] [&>*:last-child:nth-child(odd)]:col-span-2 sm:[&>*:last-child:nth-child(odd)]:col-span-1">
              {[
                ["Sensitivity", hf.sens.toFixed(1), "dB"],
                ["Power used", Math.round(hornModel.P), "W"],
                ["Max SPL", hornModel.flat.toFixed(1), "dB"],
                ["Coverage", hz.covH ? `${hz.covH}\u00b0\u00d7${hz.covV || "?"}\u00b0` : "\u2014", ""],
                ["Mid beam at XO", midBeam ? Math.round(midBeam) : "\u2014", midBeam ? "\u00b0" : ""],
              ].map(([k, v, u]) => (
                <div key={k} className="bg-stone-50 px-3 py-2.5">
                  <div className="text-xs uppercase tracking-wider text-stone-500 font-semibold"><StatLabel k={k} /></div>
                  <div className="text-xl font-medium tabular-nums mt-0.5 break-words">{v}<span className="text-xs text-stone-500 ml-0.5">{u}</span></div>
                </div>
              ))}
            </div>
            <div className="mb-4">
              <ResponseChart fmin={200} fmax={10000} top={180} bot={0} step={30} H={220} yLabel="horizontal beamwidth, °"
                series={[...(beamCurves.midB.length ? [{ curve: beamCurves.midB, label: `Mid-bass ${midSize}″`, stroke: PAL.magenta, tint: PAL.alpha(PAL.magenta, 0) }] : []), ...(beamCurves.hornB.length ? [{ curve: beamCurves.hornB, label: horn.name, stroke: PAL.cyan, tint: PAL.alpha(PAL.cyan, 0) }] : [])]}
                marks={[{ f: xoHi, label: "XO" }, ...(beamCurves.fK ? [{ f: beamCurves.fK, label: "horn control" }] : [])]} />
            </div>
            {paMap && (<div className="mb-4">
              <div className="flex gap-1 mb-2">{[["v", "Vertical"], ["h", "Horizontal"]].map(([v, l]) => <ToggleButton key={v} size="xs" on={paPlane === v} onClick={() => setPaPlane(v)}>{l}</ToggleButton>)}</div>
              <DispersionMap map={paMap} title={paPlane === "v" ? `Vertical dispersion at ${PA_MAP_M} m: below (−) to above (+) the horn axis` : `Horizontal dispersion at ${PA_MAP_M} m, at horn height (0° is on axis)`} />
              <div className="text-xs text-stone-500 mt-1">Mid and horn centers {mhGap.toFixed(1)}″ apart: {mhNull ? `the first null at the ${xoHi} Hz crossover is about ${mhNull.toFixed(0)}° above and below the horn axis.` : `under half a wavelength at ${xoHi} Hz, so no null at the crossover.`}</div>
            </div>)}
            <div className="flex flex-col gap-1.5">
              {(() => {
                const F = hornChips({ hf, hz, horn, xoHi, hornModel, hfAmpW, midAtXoHi: midMax ? midNear(xoHi).spl : null, hfTilt, hornAtXo: hornAt(xoHi), midBeam, fK: beamCurves.fK });
                return F.map(([kind, head, body]) => (
                  <div key={head} className={`block text-xs leading-relaxed px-3 py-2 rounded border ${CHIP_BACKGROUND_CLASSES[kind] || CHIP_BACKGROUND_CLASSES.ok}`}>
                    <b className={`font-semibold mr-1.5 ${kind === "ok" ? "text-green-800" : kind === "warn" ? "text-amber-700" : "text-red-700"}`}>{head}</b>
                    <span className="text-stone-500">{body}</span>
                  </div>
                ));
              })()}
            </div>
          </>) : (
            <p className="text-sm text-stone-500">{cd.name} can't be modelled yet: sensitivity or power rating missing.</p>
          )}
          </div>
        </section>

        </div>

        <aside className={`min-w-0 md:col-span-2 max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-40 max-md:bg-stone-50 max-md:border-t max-md:border-stone-300 max-md:rounded-t-xl max-md:shadow-sheet`} style={{ fontFamily: "var(--font)" }} aria-label="Settings">
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
                <ToggleButton key={t} onClick={() => setWall(t)} on={wall === t}>{label}</ToggleButton>
              ))}
            </div>
            <div className="mt-3"><Slider label="Baffle inset" value={inset} min={0} max={1.5} step={0.25} unit="″" onChange={setInset} /></div>
          </div>
          </div>
          <div className={tabCls("sub")}>
          <SelectField label="Sub driver" options={subList} value={sub} onChange={setSub} extra={lk("sub", "the sub driver")} />
          </div>
          <div className={tabCls("look")}>
          <SwatchPicker label="Cabinet finish" value={cabFinish} onChange={setCabFinish} swatches={PAINT_SWATCHES} presets={CABINET_FINISHES} titlePrefix="Painted: "
            note={CABINET_FINISHES[cabFinish] ? CABINET_FINISHES[cabFinish].name : `painted ${cabFinish}`} />
          </div>
          <div className={tabCls("look")}>
          <SwatchPicker label="Baffle colour" value={baffleColor} onChange={setBaffleColor} swatches={PAINT_SWATCHES} note={baffleColor} />
          </div>
          <div className={tabCls("look")}>
          <div className="mb-5">
            <div className="text-sm text-stone-500 mb-1">View</div>
            <div className="flex gap-1">
              {[["Finished", false], ["Cutaway", true]].map(([label, v]) => (
                <ToggleButton key={label} onClick={() => setCutaway(v)} on={cutaway === v}>{label}</ToggleButton>
              ))}
            </div>
          </div>
          </div>
          <div className={tabCls("look")}>
          <div className="mb-5">
            <div className="text-sm text-stone-500 mb-1">Layout</div>
            <div className="flex gap-1">
              {[["Two stacks", "stack"], ["Tops on spacers", "pole"], ["Tower", "tower"], ["One sub + satellites", "satellite"]].map(([label, v]) => (
                <ToggleButton key={v} onClick={() => setLayout(v)} on={layout === v}>{label}</ToggleButton>
              ))}
            </div>
            {layout === "pole" && <div className="mt-3"><Slider label="Spacer height" value={spacerH} min={4} max={36} step={1} unit="″" onChange={setSpacerH} /></div>}
          </div>
          </div>
          <div className={tabCls("sub")}>
          <div className="mb-5">
            <div className="text-sm text-stone-500 mb-1">Cabinet</div>
            <Card>
              <Slider label="Width"  value={cDim.w} min={18} max={40} step={0.5} unit="″" onChange={(v) => setC("w", v)} extra={dl("subDim", "w", "Sub width")} />
              <Slider label="Height" value={cDim.h} min={18} max={42} step={0.5} unit="″" onChange={(v) => setC("h", v)} extra={dl("subDim", "h", "Sub height")} />
              <Slider label="Depth"  value={cDim.d} min={14} max={32} step={0.5} unit="″" onChange={(v) => setC("d", v)} extra={dl("subDim", "d", "Sub depth")} />
            </Card>
          </div>
          </div>
          <div className={tabCls("sub")}>
          <div className="mb-5">
            <div className="text-sm text-stone-500 mb-1 flex items-center justify-between gap-2"><span>Vent</span>{lk("vent", "the vent style")}</div>
            <div className="flex flex-wrap gap-1">
              {[["Rectangular", !portStyle.startsWith("round"), "slots"], ["Round tubes", portStyle.startsWith("round"), "round2"]].map(([label, on, v]) => (
                <ToggleButton key={label} onClick={() => { if (!on) setPortStyle(v); }} on={on}>{label}</ToggleButton>
              ))}
            </div>
            {!portStyle.startsWith("round") && (
              <div className="flex flex-wrap gap-1 mt-1">
                {[["slots", "Bottom"], ["folded", "Bottom, folded"], ["vslots", "Both sides"], ["vslot1", "One side"]].map(([v, label]) => {
                  const on = portStyle === v;
                  return <ToggleButton key={v} onClick={() => setPortStyle(v)} on={on} size="xs">{label}</ToggleButton>;
                })}
              </div>
            )}
            <Card className="mt-2">
              {(portStyle === "slots" || portStyle === "folded") &&
                <Slider label="Slot height" value={cVent.slotH} min={1.5} max={9} step={0.25} unit="″" onChange={(v) => setV("slotH", v)} />}
              {(portStyle === "vslots" || portStyle === "vslot1") &&
                <Slider label="Duct throat" value={cVent.throat} min={1} max={portStyle === "vslot1" ? 10 : 7} step={0.25} unit="″" onChange={(v) => setV("throat", v)} />}
              {portStyle.startsWith("round") && <>
                <Slider label="Tubes" value={cVent.nt} min={1} max={6} step={1} unit="" onChange={(v) => setV("nt", v)} />
                <Slider label="Tube diameter" value={cVent.dia} min={3} max={10} step={0.25} unit="″" onChange={(v) => setV("dia", v)} />
              </>}
              <Slider label="Duct length" value={cVent.len} min={3} max={30} step={0.5} unit="″" onChange={(v) => setV("len", v)} />
              <Slider label="Port velocity limit" value={portMax} min={12} max={30} step={0.5} unit=" m/s" onChange={setPortMax} />
              <div className="text-xs text-stone-500">{port.desc}. {port.area.toFixed(1)} in&#178;.</div>
            </Card>
          </div>
          <div className="mb-5">
            <div className="text-sm text-stone-500 mb-1">Sub highpass and amp</div>
            <Card>
              <Slider label={`Highpass (${hpType})`} value={hpf} min={20} max={50} step={1} unit=" Hz" onChange={setHpf} extra={lk("hpf", "the highpass")} />
              <div className="flex flex-wrap gap-1 -mt-1 mb-3">
                {Object.keys(HIGHPASS_ALIGNMENTS).map((t) => (
                  <ToggleButton key={t} onClick={() => setHpType(t)} on={hpType === t} size="xs">{t}</ToggleButton>
                ))}
              </div>
              <Slider label="Amp power per channel @ 8 Ω" value={ampW} min={200} max={3000} step={50} unit=" W" onChange={setAmpW} extra={lk("ampW", "the sub amp power")} />
            </Card>
          </div>
          </div>
          <div className={tabCls("mid")}>
          <div className="mb-2">
            <div className="text-sm text-stone-500 mb-1">Mid-bass size</div>
            <div className="flex gap-1">
              {[12, 15].map((n) => (
                <ToggleButton key={n} onClick={() => setMidSize(n)} on={midSize === n}>{n}″</ToggleButton>
              ))}
            </div>
          </div>
          <SelectField label={`Mid-bass ${midSize}″`} options={midList} value={mid} onChange={setMid} extra={lk("mid", "the mid-bass driver")} />
          <div className="mb-5">
            <div className="text-sm text-stone-500 mb-1">Mid-bass cabinet (sealed)</div>
            <Card>
              {layout === "tower" ? (
                <div className="text-xs text-stone-500 mb-3">Tower layout: the mid chamber is the sub's footprint, {cDim.w}″ × 15.5″ × {cDim.d}″.</div>
              ) : (<>
                <Slider label="Width"  value={mDim.w} min={10} max={24} step={0.5} unit="″" onChange={(v) => setM("w", v)} extra={dl("midDim", "w", "Mid width")} />
                <Slider label="Height" value={mDim.h} min={10} max={24} step={0.5} unit="″" onChange={(v) => setM("h", v)} extra={dl("midDim", "h", "Mid height")} />
                <Slider label="Depth"  value={mDim.d} min={8} max={24} step={0.5} unit="″" onChange={(v) => setM("d", v)} extra={dl("midDim", "d", "Mid depth")} />
              </>)}
              <Slider label="Crossover, sub to mid" value={xoLo} min={60} max={250} step={5} unit=" Hz" onChange={setXoLo} extra={lk("xoLo", "the sub-to-mid crossover")} />
              <Slider label="Crossover, mid to horn" value={xoHi} min={500} max={2000} step={50} unit=" Hz" onChange={setXoHi} extra={lk("xoHi", "the mid-to-horn crossover")} />
              <Slider label="Mid amp power per channel @ 8 Ω" value={mAmpW} min={50} max={2000} step={25} unit=" W" onChange={setMAmpW} extra={lk("mAmpW", "the mid amp power")} />
              <Slider label={<Tooltip tip="0 dB asks the mid to match the sub flat out. Bass-heavy music usually carries 6–10 dB less from 200 Hz to 1 kHz than at 40–60 Hz.">Music balance: mid band needs less by</Tooltip>} value={tilt} min={0} max={12} step={1} unit=" dB" onChange={setTilt} />
            </Card>
          </div>
          </div>
          <div className={tabCls("horn")}>
          <SelectField label="Compression driver" options={CD_OPTIONS} value={cd} onChange={setCd} extra={lk("cd", "the compression driver")} />
          <SelectField label="Horn" options={HORN_OPTIONS} value={horn} onChange={setHorn} extra={lk("horn", "the horn")} />
          <Card className="mb-4">
            <Slider label="HF amp power per channel @ 8 Ω" value={hfAmpW} min={10} max={500} step={5} unit=" W" onChange={setHfAmpW} extra={lk("hfAmpW", "the HF amp power")} />
            <Slider label="Music balance: HF band needs less by" value={hfTilt} min={0} max={12} step={1} unit=" dB" onChange={setHfTilt} />
          </Card>
          {mismatch && <div className="text-sm text-red-700 mb-4">Horn throat and driver exit don't match ({horn.exit}″ vs {cd.exit}″).</div>}
          </div>
          </div>
        </aside>


        <section className="min-w-0 md:col-span-5 mt-6" style={{ fontFamily: "var(--font)" }}>
          <FoldHeading id="totals" title="Totals for the current selection" folds={folds} toggle={toggleFold} className="mb-2" />
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
                    <tr key={n} className="border-b border-stone-300"><td className="py-1 pr-4">{n}</td><td className="py-1 pr-4 text-right tabular-nums">{pr ? `$${pr}` : "—"}</td><td className="py-1 pr-4 text-right tabular-nums">{dl.toFixed(0)}</td><td className="py-1 pr-4 text-right tabular-nums">{cl ? cl.toFixed(0) : "—"}</td><td className="py-1 pr-4 text-right tabular-nums">{(dl + cl).toFixed(0)}</td><td className="py-1 text-right tabular-nums">{h.toFixed(1)}</td></tr>
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
            <SectionHeading className="mb-2">Sub</SectionHeading>
            <p className="text-sm text-stone-900">
              {sub.name} in a {subBox.w}×{subBox.h}×{subBox.d} in cabinet, {grossL.toFixed(0)} L gross, {netL.toFixed(0)} L net.
              Vent: {port.desc}. 3/4″ baffle set {inset}″ behind the frame, {wall === 0.5 ? "1/2″" : "3/4″"} birch walls, 1/4″ roundovers on the front edges.
            </p>
          </div>
          <div>
            <SectionHeading className="mb-2">Mid-bass cube</SectionHeading>
            <p className="text-sm text-stone-900">
              {mid.name} in a {midDims.w}×{midDims.h}×{midDims.d} in sealed box, gross {midL.toFixed(0)} L, lightly stuffed.
              Covers {xoLo} Hz to {xoHi} Hz. Same construction, flush-mounted driver.
            </p>
            {mid.note && <p className="text-sm text-stone-500 mt-2"><span className="font-medium text-stone-900">{mid.name}.</span> {mid.note}</p>}
          </div>
          <div>
            <SectionHeading className="mb-2">Horn</SectionHeading>
            <p className="text-sm text-stone-900">
              {horn.name} with {cd.name}, crossed at {xoHi} Hz (maker suggests {horn.xo}). Sits on a short block so the mouth clears the cube.
              Total stack height about {stackH.toFixed(0)} in, horn center at {hornCenter.toFixed(0)} in.
            </p>
            {cd.note && <p className="text-sm text-stone-500 mt-2"><span className="font-medium text-stone-900">{cd.name}.</span> {cd.note}</p>}
            {horn.note && <p className="text-sm text-stone-500 mt-2"><span className="font-medium text-stone-900">{horn.name}.</span> {horn.note}</p>}
          </div>
        </section>}

      </main>
      </>}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(StackPlanner));
