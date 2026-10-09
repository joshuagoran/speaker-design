// The Hi-fi speaker in the 3D view: one speaker (the left of the pair) on the floor, built from the same numbers the
// Hi-fi page's model and its 2D front drawing use (lib/hifi: the driver layout, the vent and radiators' places), with
// the PA view's scene context, cone, horn, driver and horn mounts.
import * as THREE from "three";
import { createSceneContext, type SceneContext } from "./sceneContext";
import { buildCone, CONE_FACE_BACK_IN } from "./buildCone";
import { buildHorn } from "./buildHorn";
import { buildHifiCabinet, type HifiCabinetHoles } from "./buildHifiCabinet";
import { addElbow, addPipe, type TubeStyle } from "./tubeParts";
import { circlePath, roundedRectPath, roundedRectShape } from "./geometry";
import { CD_OPTIONS } from "../../lib/data";
import { hifiTubeRoom } from "../../lib/hifi/hifi";
import {
  radiatorSpots,
  roundPortSpots,
  slotOpening,
  type RadiatorSpot,
  type RoundSpot,
} from "../../lib/hifi/boxLayout";
import { ELBOW_COUNTS, MAX_ELBOWS, tubeElbows, tubeLegs } from "../../lib/tubeFold";
import { HIFI_DRIVER_CUTOUT_IN } from "../../data/catalog/driver-cutouts";
import { HIFI_FRONT_PARTS, HIFI_GENERIC_BODIES } from "../../constants/hifiScene";
import { HIFI_BOX_LAYOUT } from "../../constants/hifiLayout";
import type { Props as StackSceneProps } from "./buildStackScene";
import type {
  CompressionDriver,
  Dims2,
  Dims3,
  DriverLayout,
  HifiConfig,
  HifiTweeter,
  HifiWaveguide,
  HifiWoofer,
  PassiveRadiatorChoice,
  RadiatorPanel,
  RoundPort,
  WaveguideSpec,
} from "../../types";

/** The Hi-fi scene's own meshes and groups, by part (the horn, its driver and mounts keep buildHorn's names). */
export const HIFI_MESH_NAMES = {
  /** the woofer: its frame, cone (or, in the cutaway, its body) */
  woofer: "hifiWoofer",
  /** a round port's tube and flange, or the slot's shelf */
  port: "hifiPort",
  slotShelf: "hifiSlotShelf",
  /** a passive radiator's group (its frame and cone), on its panel */
  radiator: "passiveRadiator",
  /** a tweeter's faceplate, or a ribbon's waveguide plate, flush in the baffle */
  faceplate: "tweeterFaceplate",
  dome: "tweeterDome",
  /** a horn-loaded tweeter's flare */
  flare: "tweeterFlare",
  ribbon: "ribbonDiaphragm",
  /** a tweeter's body behind the baffle, in the cutaway */
  tweeterBody: "tweeterBody",
  /** a coaxial's HF in its woofer's center: the horn's flare and its phase plug, and, in the cutaway, its driver */
  coaxHorn: "coaxHorn",
  coaxPlug: "coaxPhasePlug",
  coaxHfBody: "coaxHfBody",
} as const;

/**
 * What the scene draws: the design as the model has it (`HifiConfig`: the box's outside size, its walls, roundover
 * and tweeter offset, all inches; the vent, null unless vented), the drivers and their layout, the radiators and their
 * panel, the waveguide, and the look and the cutaway as the PA scene takes them.
 */
export type HifiSceneProps = Pick<HifiConfig, "dim"> &
  Required<Pick<HifiConfig, "wall" | "roundoverIn" | "tweeterOffsetIn">> &
  Pick<StackSceneProps, "baffleColor" | "cutaway"> &
  Required<Pick<StackSceneProps, "cabFinish">> & {
    /** the vent, when the box is vented */
    port: HifiConfig["port"] | null;
    woofer: Pick<HifiWoofer, "size">;
    /** the tweeter as chosen (not the copy with its waveguide's mouth as the faceplate) */
    tweeter: Pick<HifiTweeter, "id" | "exit" | "faceplate" | "domeIn" | "type" | "ownGuide">;
    lay: DriverLayout;
    /** the passive radiators, when the box has them, and the panel they go on */
    radiators: Pick<PassiveRadiatorChoice, "drv" | "n"> | null;
    radiatorPanel: RadiatorPanel;
    /** the waveguide in use (a ribbon's own included), and the catalog horn behind it for a compression driver */
    guide: Pick<WaveguideSpec, "w" | "h" | "freestanding"> | null;
    waveguide: HifiWaveguide | null;
  };

/**
 * The compression driver behind a waveguide: the PA catalogue's, where it lists the same driver (its body and bolts),
 * else a GENERIC body (`HIFI_GENERIC_BODIES`) the Hi-fi table's diameter across.
 */
export function hifiCompressionDriver(
  t: Pick<HifiTweeter, "id" | "exit" | "faceplate">,
): Pick<CompressionDriver, "body" | "exit"> {
  const pa = CD_OPTIONS.find((c) => c.id === t.id);
  if (pa) return pa;
  const g = HIFI_GENERIC_BODIES.compressionDriver;
  const dia = t.faceplate.w;
  return { exit: t.exit ?? 1, body: { dia, depth: dia * g.depthPerDia, bolts: g.bolts } };
}

/** A woofer's baffle cutout radius: its size class's typical cutout, else a GENERIC share of its size. */
const wooferCutoutR = (size: number) =>
  (HIFI_DRIVER_CUTOUT_IN[size] ?? size * HIFI_GENERIC_BODIES.cutoutPerSize) / 2;

/** An ellipse hole (a circle when `rx` = `ry`) centered on (x, y). */
const ellipsePath = (x: number, y: number, rx: number, ry: number) => {
  const p = new THREE.Path();
  p.absellipse(x, y, rx, ry, 0, Math.PI * 2, true, 0);
  return p;
};

/** A faceplate's outline: a disc when it is as tall as it is wide, else a rounded rectangle. */
const plateShape = (face: Dims2) => {
  if (face.w === face.h) {
    const s = new THREE.Shape();
    s.absarc(0, 0, face.w / 2, 0, Math.PI * 2, false);
    return s;
  }
  return roundedRectShape(face.w, face.h, HIFI_FRONT_PARTS.plateCornerIn);
};
const plateHole = (x: number, y: number, face: Dims2) =>
  face.w === face.h
    ? circlePath(x, y, face.w / 2)
    : roundedRectPath(x, y, face.w, face.h, HIFI_FRONT_PARTS.plateCornerIn);

/** A cylinder (a cone's frustum when the radii differ) `len` long along z, its `r0` end toward +z, centered on the origin. */
function zCylinder(r0: number, r1: number, len: number, material: THREE.Material, open = false) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, len, 40, 1, open), material);
  m.rotation.x = Math.PI / 2; // the cylinder's +y (its r0 end) toward +z
  return m;
}

/**
 * A driver's cutout lined in black, `len` deep (the basket's rim inside the panel), so a glance past the frame into the
 * cutout finds the driver, not the bare ply: an open tube along z on the origin, drawn from inside.
 */
function holeLiner(ctx: SceneContext, r: number, len: number) {
  const inside = ctx.materials.black.clone();
  inside.side = THREE.BackSide;
  return zCylinder(r - 0.005, r - 0.005, len, inside, true);
}

/** Builds one Hi-fi speaker as a Group (no DOM or WebGL needed). Units: inches; the floor at y = 0. */
export function buildHifiScene(p: HifiSceneProps): THREE.Group {
  const { dim, wall: T, lay, tweeter: t } = p;
  const horn = p.guide && p.waveguide && !t.ownGuide ? p.waveguide : null;
  const ctx = createSceneContext({
    wall: T,
    inset: 0, // the baffle is the box's front
    cabFinish: p.cabFinish,
    baffleColor: p.baffleColor,
    cutaway: p.cutaway,
    // the context reads a horn only for its body's color: the waveguide's catalog finish
    horn: horn ?? {},
  });
  const zf = dim.d / 2;
  const tx = lay.onTop ? 0 : p.tweeterOffsetIn,
    ty = lay.tweeterIn;
  const holes: HifiCabinetHoles = { baffle: [], back: [], sides: { [-1]: [], 1: [] } };

  // the woofer's cutout, and the vent's openings
  const wooferR = wooferCutoutR(p.woofer.size);
  holes.baffle.push(circlePath(0, lay.wooferIn, wooferR));
  const round = p.port && p.port.shape !== "slot" ? roundPortSpots(p.port) : [];
  round.forEach((s) =>
    holes.baffle.push(circlePath(s.x, s.y, s.r + HIFI_BOX_LAYOUT.portTubeWallIn)),
  );
  const slot = p.port && p.port.shape === "slot" ? p.port : null;
  const slotHole = slot ? slotOpening(dim, T, slot) : null;
  if (slotHole)
    holes.baffle.push(
      roundedRectPath(0, slotHole.y + slotHole.h / 2, slotHole.w, slotHole.h, 0.02),
    );

  // the radiators' cutouts, on their panels
  const spots = p.radiators ? radiatorSpots(p.radiators, p.radiatorPanel, T) : [];
  const sideZ = (-dim.d / 2 + zf - Math.max(T, p.roundoverIn)) / 2;
  for (const s of spots) {
    const rx = s.shape.w / 2 - HIFI_FRONT_PARTS.radiatorFrameIn,
      ry = s.shape.h / 2 - HIFI_FRONT_PARTS.radiatorFrameIn;
    if (s.panel === "side") holes.sides[s.side ?? -1].push(ellipsePath(sideZ, s.y, rx, ry));
    else holes[s.panel].push(ellipsePath(0, s.y, rx, ry));
  }

  // the tweeter's hole: a waveguide set into the baffle, a ribbon's plate, or a faceplate; none for a coaxial's HF,
  // which sits in its woofer
  const face: Dims2 | null = horn || lay.coax ? null : (t.ownGuide ?? t.faceplate);
  if (horn && p.guide && !p.guide.freestanding)
    holes.baffle.push(
      roundedRectPath(
        tx,
        ty,
        p.guide.w,
        p.guide.h,
        Math.min(p.guide.w, p.guide.h) * HIFI_FRONT_PARTS.guideCornerPerSize,
      ),
    );
  else if (face) holes.baffle.push(plateHole(tx, ty, face));

  const { shellFrontZ } = buildHifiCabinet(ctx, {
    dim,
    roundover: p.roundoverIn,
    holes,
  });

  addWoofer(ctx, {
    r: wooferR,
    size: p.woofer.size,
    y: lay.wooferIn,
    zf,
    shellFrontZ,
    coax: !!lay.coax,
  });
  if (p.port && p.port.shape !== "slot")
    addRoundPorts(ctx, { spots: round, port: p.port, dim, zf });
  if (slot && slotHole) {
    // the slot's roof: a shelf the opening's width running the slot's length back from the baffle's inside face, as
    // the model and the cutlist take it
    const len = slot.len;
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(slotHole.w, T, len), ctx.materials.inner);
    shelf.position.set(0, slotHole.y + slotHole.h + T / 2, shellFrontZ - len / 2);
    shelf.name = HIFI_MESH_NAMES.slotShelf;
    ctx.group.add(shelf);
  }
  for (const s of spots) addRadiator(ctx, s, { dim, zf, sideZ });

  // the tweeter: a waveguide with its compression driver (on the box top on its mount, or set into the baffle), a
  // ribbon's plate, a horn-loaded tweeter's flare or a dome, each plate flush in the baffle
  if (horn && p.guide) {
    const cd = hifiCompressionDriver(t);
    if (p.guide.freestanding)
      buildHorn(ctx, { horn, cd, y: dim.h, xs: [0], mount: dim, backRoundover: 0 });
    else
      buildHorn(ctx, {
        horn,
        cd,
        y: dim.h,
        xs: [tx],
        mount: dim,
        // set into the baffle, its mouth flush with the front, as the PA tower sets its horn
        tower: { cy: ty, width: p.guide.w, sectionH: 0 },
      });
  } else if (face) addTweeter(ctx, { t, face, x: tx, y: ty, zf });
  return ctx.group;
}

/**
 * The woofer: its frame on the baffle and cone (PA's), or, in the cutaway, the frame and a GENERIC body behind it. A
 * coaxial's woofer has its HF in its center: a short horn with a phase plug in place of the dust cap, and, in the
 * cutaway, the HF driver behind the magnet.
 */
function addWoofer(
  ctx: SceneContext,
  {
    r,
    size,
    y,
    zf,
    shellFrontZ,
    coax,
  }: { r: number; size: number; y: number; zf: number; shellFrontZ: number; coax: boolean },
) {
  const g = new THREE.Group();
  g.name = HIFI_MESH_NAMES.woofer;
  ctx.group.add(g);
  const frameR = Math.max(r + 0.1, (size * HIFI_FRONT_PARTS.wooferFramePerSize) / 2);
  const ring = new THREE.Shape();
  ring.absarc(0, y, frameR, 0, Math.PI * 2, false);
  ring.holes.push(circlePath(0, y, r * HIFI_FRONT_PARTS.wooferFrameLip));
  const frame = new THREE.Mesh(
    new THREE.ExtrudeGeometry(ring, {
      depth: HIFI_FRONT_PARTS.wooferFrameIn,
      bevelEnabled: false,
      curveSegments: 48,
    }),
    ctx.materials.black,
  );
  frame.position.z = zf;
  g.add(frame);
  const liner = holeLiner(ctx, r, zf - shellFrontZ);
  liner.position.set(0, y, zf - (zf - shellFrontZ) / 2);
  g.add(liner);
  buildCone(ctx, { r, y, z: zf, parent: g, cap: !coax });
  if (coax && !ctx.cutaway) addCoaxHorn(ctx, { r, y, z: zf - CONE_FACE_BACK_IN, parent: g });
  if (!ctx.cutaway) return;
  const b = HIFI_GENERIC_BODIES.woofer;
  const depth = size * b.depthPerSize,
    magnetR = (size * b.magnetDiaPerSize) / 2,
    magnetLen = size * b.magnetDepthPerSize;
  const basketLen = Math.max(0.1, depth - magnetLen - (zf - shellFrontZ));
  const basket = zCylinder(r, magnetR * 0.8, basketLen, ctx.materials.black);
  basket.position.set(0, y, shellFrontZ - basketLen / 2);
  g.add(basket);
  const magnet = zCylinder(magnetR, magnetR, magnetLen, ctx.materials.black);
  magnet.position.set(0, y, shellFrontZ - basketLen - magnetLen / 2);
  g.add(magnet);
  if (!coax) return;
  const hf = HIFI_GENERIC_BODIES.coaxHf;
  const hfR = (size * hf.diaPerSize) / 2,
    hfLen = size * hf.depthPerSize;
  const body = zCylinder(hfR, hfR, hfLen, ctx.materials.black);
  body.position.set(0, y, shellFrontZ - basketLen - magnetLen - hfLen / 2);
  body.name = HIFI_MESH_NAMES.coaxHfBody;
  g.add(body);
}

/**
 * A coaxial's HF in its woofer's center, in place of the dust cap: a short horn flaring from its throat on the cone
 * (at `z`) toward the listener, and the phase plug in the throat (`HIFI_FRONT_PARTS.coax`, per cone radius `r`).
 */
function addCoaxHorn(
  ctx: SceneContext,
  { r, y, z, parent }: { r: number; y: number; z: number; parent: THREE.Object3D },
) {
  const P = HIFI_FRONT_PARTS.coax;
  const mouthR = r * P.hornMouthPerCone,
    throatR = r * P.hornThroatPerCone,
    rise = r * P.hornRisePerCone;
  // the flare's inside shows, so it is drawn both sides
  const metal = ctx.materials.hardware.clone();
  metal.side = THREE.DoubleSide;
  const flare = zCylinder(mouthR, throatR, rise, metal, true);
  flare.position.set(0, y, z + rise / 2);
  flare.name = HIFI_MESH_NAMES.coaxHorn;
  parent.add(flare);
  const plugR = throatR * P.plugPerThroat;
  const plug = new THREE.Mesh(
    new THREE.SphereGeometry(plugR, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    ctx.materials.aluminum,
  );
  plug.rotation.x = Math.PI / 2; // the plug's tip toward +z, at the horn's mouth
  plug.scale.y = rise / plugR;
  plug.position.set(0, y, z);
  plug.name = HIFI_MESH_NAMES.coaxPlug;
  parent.add(plug);
}

/** The round ports: each a flanged tube from the baffle front, folded as the model folds it (lib/tubeFold). */
function addRoundPorts(
  ctx: SceneContext,
  { spots, port, dim, zf }: { spots: RoundSpot[]; port: RoundPort; dim: Dims3; zf: number },
) {
  const T = ctx.wall;
  // the fewest elbows that fit, as the model takes them (lib/hifi hifiPortElbows); a port too long for any: the most
  const room = hifiTubeRoom(dim, T);
  const e = tubeElbows(room, port.dia, port.len) ?? ELBOW_COUNTS[MAX_ELBOWS];
  const legs = tubeLegs(room, port.dia, port.len, e);
  const r = port.dia / 2;
  const tube: TubeStyle = {
    r,
    material: ctx.materials.port,
    name: HIFI_MESH_NAMES.port,
    parent: ctx.group,
  };
  const bend = Math.min(r * 1.5, legs.run / 2, legs.rise > 0 ? legs.rise / 2 : r * 1.5);
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  for (const s of spots) {
    const flange = new THREE.Shape();
    flange.absarc(0, 0, r + HIFI_FRONT_PARTS.portFlangeIn, 0, Math.PI * 2, false);
    flange.holes.push(circlePath(0, 0, r));
    const lip = new THREE.Mesh(new THREE.ShapeGeometry(flange, 48), ctx.materials.port);
    lip.position.set(s.x, s.y, zf + 0.01);
    lip.name = HIFI_MESH_NAMES.port;
    ctx.group.add(lip);
    const zc = zf - legs.run; // the first corner
    if (e === 0) {
      addPipe(tube, V(s.x, s.y, zf), V(s.x, s.y, zc));
      continue;
    }
    addPipe(tube, V(s.x, s.y, zf), V(s.x, s.y, zc + bend));
    addElbow(tube, bend, V(s.x, s.y + bend, zc + bend), V(0, -1, 0), V(0, 0, -1));
    const top = s.y + legs.rise;
    if (e === 1) {
      addPipe(tube, V(s.x, s.y + bend, zc), V(s.x, top, zc));
      continue;
    }
    addPipe(tube, V(s.x, s.y + bend, zc), V(s.x, top - bend, zc));
    addElbow(tube, bend, V(s.x, top - bend, zc + bend), V(0, 0, -1), V(0, 1, 0));
    addPipe(tube, V(s.x, top, zc + bend), V(s.x, top, zc + legs.back));
  }
}

/** A passive radiator on its panel: its frame on the outside and the PA cone in its cutout (an oval one stretched). */
function addRadiator(
  ctx: SceneContext,
  s: RadiatorSpot,
  { dim, zf, sideZ }: { dim: Dims3; zf: number; sideZ: number },
) {
  // a frame whose +z faces out of its panel, on the panel's outer face
  const g = new THREE.Group();
  g.name = HIFI_MESH_NAMES.radiator;
  if (s.panel === "baffle") g.position.set(0, s.y, zf);
  else if (s.panel === "back") {
    g.position.set(0, s.y, -dim.d / 2);
    g.rotation.y = Math.PI;
  } else {
    const side = s.side ?? -1;
    g.position.set((side * dim.w) / 2, s.y, sideZ);
    g.rotation.y = (side * Math.PI) / 2;
  }
  ctx.group.add(g);
  const k = HIFI_FRONT_PARTS.radiatorFrameIn;
  const rx = s.shape.w / 2 - k,
    ry = s.shape.h / 2 - k;
  const outline = new THREE.Shape();
  outline.absellipse(0, 0, s.shape.w / 2, s.shape.h / 2, 0, Math.PI * 2, false, 0);
  const lip = HIFI_FRONT_PARTS.wooferFrameLip;
  outline.holes.push(ellipsePath(0, 0, rx * lip, ry * lip));
  const frame = new THREE.Mesh(
    new THREE.ExtrudeGeometry(outline, {
      depth: HIFI_FRONT_PARTS.wooferFrameIn,
      bevelEnabled: false,
      curveSegments: 48,
    }),
    ctx.materials.black,
  );
  g.add(frame);
  const cone = new THREE.Group();
  cone.scale.x = rx / ry;
  g.add(cone);
  const liner = holeLiner(ctx, ry, ctx.wall);
  liner.position.z = -ctx.wall / 2;
  cone.add(liner);
  buildCone(ctx, { r: ry, y: 0, z: 0, parent: cone });
}

/**
 * A tweeter without a waveguide horn, flush in the baffle: a ribbon's waveguide plate with its diaphragm in its
 * throat, a horn-loaded tweeter's faceplate round its flare, or a dome's faceplate with the dome on it; and, in the
 * cutaway, a GENERIC body behind (the catalogue gives no depth).
 */
function addTweeter(
  ctx: SceneContext,
  {
    t,
    face,
    x,
    y,
    zf,
  }: { t: HifiSceneProps["tweeter"]; face: Dims2; x: number; y: number; zf: number },
) {
  const P = HIFI_FRONT_PARTS;
  const add = (m: THREE.Mesh, name: string) => {
    m.name = name;
    ctx.group.add(m);
    return m;
  };
  const shape = plateShape(face);
  if (t.ownGuide) {
    const sw = face.w * P.ribbon.w,
      sh = face.h * P.ribbon.h;
    shape.holes.push(roundedRectPath(0, 0, sw, sh, 0.02));
    const ribbon = add(
      new THREE.Mesh(new THREE.BoxGeometry(sw, sh, 0.02), ctx.materials.aluminum),
      HIFI_MESH_NAMES.ribbon,
    );
    ribbon.position.set(x, y, zf - P.ribbon.setBackIn);
  } else if (t.type === "horn-loaded") {
    const mouthR = Math.min(t.domeIn / 2, Math.min(face.w, face.h) / 2 - P.plateCornerIn);
    shape.holes.push(circlePath(0, 0, mouthR));
    // the flare's inside shows, so it is drawn both sides
    const throughBlack = ctx.materials.black.clone();
    throughBlack.side = THREE.DoubleSide;
    const flare = add(
      zCylinder(mouthR, mouthR * P.flareThroat, P.flareDepthIn, throughBlack, true),
      HIFI_MESH_NAMES.flare,
    );
    flare.position.set(x, y, zf - P.flareDepthIn / 2);
  } else {
    const r = t.domeIn / 2;
    const dome = add(
      new THREE.Mesh(
        new THREE.SphereGeometry(r, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2),
        ctx.materials.hardware,
      ),
      HIFI_MESH_NAMES.dome,
    );
    dome.rotation.x = Math.PI / 2; // the dome's pole toward +z
    dome.scale.y = P.domeRise;
    dome.position.set(x, y, zf);
    const surround = add(
      new THREE.Mesh(
        new THREE.TorusGeometry(r * P.domeSurround.rPerDome, P.domeSurround.tubeIn, 8, 40),
        ctx.materials.black,
      ),
      HIFI_MESH_NAMES.dome,
    );
    surround.position.set(x, y, zf);
  }
  const plate = add(
    new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape, {
        depth: P.faceplateIn,
        bevelEnabled: false,
        curveSegments: 48,
      }),
      ctx.materials.black,
    ),
    HIFI_MESH_NAMES.faceplate,
  );
  plate.position.set(x, y, zf - P.faceplateIn);
  if (!ctx.cutaway) return;
  const b = HIFI_GENERIC_BODIES.tweeter;
  const body = add(
    zCylinder(
      (face.w * b.diaPerFace) / 2,
      (face.w * b.diaPerFace) / 2,
      b.depthIn,
      ctx.materials.black,
    ),
    HIFI_MESH_NAMES.tweeterBody,
  );
  body.position.set(x, y, zf - P.faceplateIn - b.depthIn / 2);
}
