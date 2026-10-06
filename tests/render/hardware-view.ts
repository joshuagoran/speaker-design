// The render check's page (tests/render-hardware.mjs bundles it): the default PA stack with its hardware, built as the
// planner builds it, seen from the camera the URL asks for, so the handles, dishes and posts can be looked at close up.
//   ?handle=H1105|30769|none &cutaway=1 &layout=stack|tower|pole|satellite &az=deg &el=deg &dist=in &tx= &ty= &tz= (look-at, in)
import * as THREE from "three";
import { buildStackScene } from "../../src/components/stack-view/buildStackScene";
import { DEFAULT_PA } from "../../src/lib/defaults";
import {
  midBoxBracing,
  midHardwarePlan,
  midKeepOut,
  subBoxBracing,
  subHardwarePlan,
  subKeepOut,
} from "../../src/lib/pa/calc";
import { STAGE } from "../../src/styles/palette";
import { HANDLE_CHOICES } from "../../src/lib/pa/hardware";
import type { BoxHandles, PaLayout } from "../../src/types";
import { PA_LAYOUT_NAMES } from "../../src/constants/paLayouts";
import { keysOf } from "../../src/lib/records";

const q = new URLSearchParams(location.search);
const num = (k: string, d: number) => (q.has(k) ? Number(q.get(k)) : d);
const model = HANDLE_CHOICES.find((c) => c === q.get("handle")) ?? DEFAULT_PA.hardware.sub.model;
const layout: PaLayout = keysOf(PA_LAYOUT_NAMES).find((k) => k === q.get("layout")) ?? "stack";
const cutaway = q.get("cutaway") === "1";
const d = DEFAULT_PA;
const handles: BoxHandles = { model, upIn: 0, backIn: 0 };
const mDim = layout === "tower" ? { w: d.cDim.w, h: 15.5, d: d.cDim.d } : d.mDim;
const group = buildStackScene({
  sub: { ...d.sub, box: d.cDim },
  mid: { ...d.mid, box: d.mDim },
  horn: d.horn,
  plinth: 3,
  cutaway,
  portStyle: d.portStyle,
  layout,
  baffleColor: d.baffleColor,
  portGeom: {
    ductH: d.cVent.slotH,
    nPorts: d.cVent.nt,
    portR: d.cVent.dia / 2,
    tubeLen: d.cVent.len,
    throat: d.cVent.throat,
  },
  wall: d.wall,
  inset: d.inset,
  cabFinish: d.cabFinish,
  spacerH: d.spacerH,
  subBracing: subBoxBracing(
    d.cDim,
    d.wall,
    d.inset,
    d.portStyle,
    d.cVent,
    d.sub,
    undefined,
    handles,
  ),
  midBracing: midBoxBracing(mDim, d.wall, d.inset, d.mid, layout, undefined, handles),
  subKeepOut: subKeepOut(d.cDim, d.wall, d.inset, d.portStyle, d.cVent, d.sub),
  midKeepOut: layout === "tower" ? null : midKeepOut(mDim, d.wall, d.mid),
  subHardware: subHardwarePlan(
    d.cDim,
    d.wall,
    d.inset,
    d.portStyle,
    d.cVent,
    d.sub,
    undefined,
    handles,
  ),
  midHardware: midHardwarePlan(mDim, d.wall, d.inset, d.mid, layout, undefined, handles),
});

const W = 900,
  H = 700;
const scene = new THREE.Scene();
const stage = STAGE.light;
scene.background = new THREE.Color(stage.floor);
scene.add(new THREE.HemisphereLight(stage.sky, stage.ground, stage.hemi));
const key = new THREE.DirectionalLight(stage.sky, stage.key);
key.position.set(40, 80, 30);
scene.add(key);
scene.add(group);
const az = (num("az", 35) * Math.PI) / 180,
  el = (num("el", 20) * Math.PI) / 180,
  dist = num("dist", 140);
const target = new THREE.Vector3(num("tx", 0), num("ty", 30), num("tz", 0));
const cam = new THREE.PerspectiveCamera(32, W / H, 0.1, 1000);
cam.position
  .copy(target)
  .add(
    new THREE.Vector3(
      Math.sin(az) * Math.cos(el),
      Math.sin(el),
      Math.cos(az) * Math.cos(el),
    ).multiplyScalar(dist),
  );
cam.lookAt(target);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H);
document.body.style.margin = "0";
document.body.appendChild(renderer.domElement);
renderer.render(scene, cam);
document.title = "rendered";
