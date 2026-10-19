// The Hi-fi speaker in the 3D view: one speaker (the left of the pair) on the floor, built from the same numbers the
// Hi-fi page's model and its 2D front drawing use (lib/speaker/twoWay and lib/build/boxLayout: the driver layout, the vent and radiators' places), with
// the PA view's scene context, cone, horn, driver and horn mounts.
import * as THREE from "three";
import { type SceneContext } from "./sceneContext";
import { buildCone, CONE_FACE_BACK_IN } from "./buildCone";
import { addElbow, addPipe, type TubeStyle } from "./tubeParts";
import {
  circlePath,
  flareGeometry,
  flareMouthPath,
  roundedRectPath,
  roundedRectShape,
} from "./geometry";
import { CD_OPTIONS } from "../../lib/data";
import { hifiTubeRoom } from "../../lib/acoustics/wooferBox";
import { isAmt, isRibbon } from "../../lib/speaker/twoWay";
import {
  amtOpening,
  slotOpening,
  type RadiatorSpot,
  type RoundSpot,
} from "../../lib/build/boxLayout";
import {
  ELBOW_COUNTS,
  MAX_ELBOWS,
  tubeElbows,
  tubeLegs,
  type TubeRoom,
} from "../../lib/build/tubeFold";
import { HIFI_DRIVER_CUTOUT_IN } from "../../data/catalog/driver-cutouts";
import { HIFI_FRONT_PARTS, HIFI_GENERIC_BODIES } from "../../constants/hifiScene";
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
  /** a horn-loaded tweeter's flare, or a ribbon's flared throat in its waveguide plate */
  flare: "tweeterFlare",
  ribbon: "ribbonDiaphragm",
  /** an AMT's folded diaphragm (its backing and folds) behind its plate's opening */
  amt: "amtDiaphragm",
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
    tweeter: Pick<
      HifiTweeter,
      "id" | "exit" | "faceplate" | "domeIn" | "type" | "ownGuide" | "mount"
    >;
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
 * else a GENERIC body (`HIFI_GENERIC_BODIES`) the Hi-fi table's diameter across (on a screw-on driver its generic bolt
 * pattern only sizes the bracket clamped at the throat).
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
export const wooferCutoutR = (size: number) =>
  (HIFI_DRIVER_CUTOUT_IN[size] ?? size * HIFI_GENERIC_BODIES.cutoutPerSize) / 2;

/** An ellipse hole (a circle when `rx` = `ry`) centered on (x, y). */
export const ellipsePath = (x: number, y: number, rx: number, ry: number) => {
  const p = new THREE.Path();
  p.absellipse(x, y, rx, ry, 0, Math.PI * 2, true, 0);
  return p;
};

/**
 * Whether a tweeter's plate is round: a faceplate as tall as it is wide is a disc; a ribbon's waveguide plate is
 * square, an AMT's plate a rounded rectangle whatever its size, and any other plate a rounded rectangle.
 */
const roundPlate = (t: Pick<HifiTweeter, "type">, face: Dims2) =>
  !isRibbon(t) && !isAmt(t) && face.w === face.h;

/** A tweeter's plate outline: a disc, or a rounded rectangle (`roundPlate`). */
const plateShape = (t: Pick<HifiTweeter, "type">, face: Dims2) => {
  if (roundPlate(t, face)) {
    const s = new THREE.Shape();
    s.absarc(0, 0, face.w / 2, 0, Math.PI * 2, false);
    return s;
  }
  return roundedRectShape(face.w, face.h, HIFI_FRONT_PARTS.plateCornerIn);
};
export const plateHole = (t: Pick<HifiTweeter, "type">, x: number, y: number, face: Dims2) =>
  roundPlate(t, face)
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

/**
 * The woofer: its frame on the baffle and cone (PA's), or, in the cutaway, the frame and a GENERIC body behind it. A
 * coaxial's woofer has its HF in its center: a short horn with a phase plug in place of the dust cap, and, in the
 * cutaway, the HF driver behind the magnet.
 */
export function addWoofer(
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

/**
 * The slot's roof: a shelf the opening's width running the slot's `len` back from the baffle's inside face
 * (`shellFrontZ`), as the model and the cutlist take it.
 */
export function addSlotShelf(
  ctx: SceneContext,
  {
    opening,
    len,
    shellFrontZ,
  }: { opening: ReturnType<typeof slotOpening>; len: number; shellFrontZ: number },
) {
  const T = ctx.wall;
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(opening.w, T, len), ctx.materials.inner);
  shelf.position.set(opening.x, opening.y + opening.h + T / 2, shellFrontZ - len / 2);
  shelf.name = HIFI_MESH_NAMES.slotShelf;
  ctx.group.add(shelf);
}

/**
 * A slot up a front side's wall (the PA v2 boxes'): the plate that closes it on the inside, a wall thick, as tall as the
 * opening, running back `len` from the baffle's inside face (`shellFrontZ`). It stops at the back panel (`backZ`, its
 * inside face); a slot longer than the box is deep turns in along the back panel for the rest, `opening.w` from it.
 * `side` is the wall it stands against (-1 left, 1 right).
 */
export function addSlotWall(
  ctx: SceneContext,
  {
    opening,
    side,
    len,
    shellFrontZ,
    backZ,
  }: {
    opening: { x: number; y: number; w: number; h: number };
    side: -1 | 1;
    len: number;
    shellFrontZ: number;
    backZ: number;
  },
) {
  const T = ctx.wall;
  const run = Math.min(len, shellFrontZ - backZ);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(T, opening.h, run), ctx.materials.inner);
  plate.position.set(
    opening.x - (side * (opening.w + T)) / 2,
    opening.y + opening.h / 2,
    shellFrontZ - run / 2,
  );
  plate.name = HIFI_MESH_NAMES.slotShelf;
  ctx.group.add(plate);
  const rest = len - run;
  if (rest <= 1e-9) return;
  // the fold: along the back panel, inward from the side wall
  const fold = new THREE.Mesh(new THREE.BoxGeometry(rest, opening.h, T), ctx.materials.inner);
  fold.position.set(
    opening.x + (side * opening.w) / 2 - (side * rest) / 2,
    opening.y + opening.h / 2,
    backZ + opening.w + T / 2,
  );
  fold.name = HIFI_MESH_NAMES.slotShelf;
  ctx.group.add(fold);
}

/**
 * The round ports: each a flanged tube from the baffle front, folded as the model folds it (lib/build/tubeFold). `fold`, for
 * a port placed elsewhere (the Speaker page's set position): the room its tubes have and whether the riser heads down;
 * absent, the Hi-fi box's room (`hifiTubeRoom`), rising.
 */
export function addRoundPorts(
  ctx: SceneContext,
  {
    spots,
    port,
    dim,
    zf,
    fold,
  }: {
    spots: RoundSpot[];
    port: RoundPort;
    dim: Dims3;
    zf: number;
    fold?: { room: TubeRoom; down: boolean };
  },
) {
  const T = ctx.wall;
  // the fewest elbows that fit, as the model takes them (lib/acoustics/wooferBox hifiPortElbows); a port too long for any: the most
  const room = fold?.room ?? hifiTubeRoom(dim, T);
  /** the riser's way: up, or down */
  const up = fold?.down ? -1 : 1;
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
    addElbow(tube, bend, V(s.x, s.y + up * bend, zc + bend), V(0, -up, 0), V(0, 0, -1));
    const top = s.y + up * legs.rise;
    if (e === 1) {
      addPipe(tube, V(s.x, s.y + up * bend, zc), V(s.x, top, zc));
      continue;
    }
    addPipe(tube, V(s.x, s.y + up * bend, zc), V(s.x, top - up * bend, zc));
    addElbow(tube, bend, V(s.x, top - up * bend, zc + bend), V(0, 0, -1), V(0, up, 0));
    addPipe(tube, V(s.x, top, zc + bend), V(s.x, top, zc + legs.back));
  }
}

/** A passive radiator on its panel: its frame on the outside and the PA cone in its cutout (an oval one stretched). */
export function addRadiator(
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
 * A tweeter without a waveguide horn, flush in the baffle: a ribbon's square waveguide plate with its flared throat
 * down to the diaphragm's slot, an AMT's flat plate with its opening onto the folded diaphragm, a horn-loaded
 * tweeter's faceplate round its flare, or a dome's faceplate with the dome on it; and, in the
 * cutaway, a GENERIC body behind (the catalogue gives no depth).
 */
export function addTweeter(
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
  // a flare's inside shows, so it is drawn both sides
  const flareMaterial = () => {
    const m = ctx.materials.black.clone();
    m.side = THREE.DoubleSide;
    return m;
  };
  const shape = plateShape(t, face);
  // the cutaway's body sits behind the plate, or behind a ribbon's flare
  let bodyZ = zf - P.faceplateIn;
  if (isRibbon(t)) {
    const R = P.ribbon;
    const slot = { w: face.w * R.slot.w, h: face.h * R.slot.h },
      mouth = { w: face.w * R.mouth.w, h: face.h * R.mouth.h },
      depth = face.w * R.depthPerPlate;
    // the plate's hole is the flare's own mouth outline, so the two meet
    shape.holes.push(flareMouthPath(0, 0, mouth, R.flareSquareness));
    const flare = add(
      new THREE.Mesh(
        flareGeometry({ throat: slot, mouth, depth, squareness: () => R.flareSquareness }),
        flareMaterial(),
      ),
      HIFI_MESH_NAMES.flare,
    );
    flare.position.set(x, y, zf - depth);
    const ribbon = add(
      new THREE.Mesh(new THREE.BoxGeometry(slot.w, slot.h, 0.02), ctx.materials.aluminum),
      HIFI_MESH_NAMES.ribbon,
    );
    ribbon.position.set(x, y, zf - depth);
    bodyZ = zf - depth;
  } else if (isAmt(t)) {
    // a flat plate with an opening onto the folded diaphragm: a dark backing, the folds across the opening's short side
    const A = P.amt;
    const open = amtOpening(face);
    shape.holes.push(roundedRectPath(0, 0, open.w, open.h, A.openingCornerIn));
    const foldZ = zf - A.setBackIn - A.foldDepthIn / 2;
    const backing = add(
      new THREE.Mesh(new THREE.BoxGeometry(open.w, open.h, 0.02), ctx.materials.black),
      HIFI_MESH_NAMES.amt,
    );
    backing.position.set(x, y, zf - A.setBackIn - A.foldDepthIn);
    const foldGeo = open.tall
      ? new THREE.BoxGeometry(open.w, A.foldWidthIn, A.foldDepthIn)
      : new THREE.BoxGeometry(A.foldWidthIn, open.h, A.foldDepthIn);
    for (const off of open.folds) {
      const fold = add(new THREE.Mesh(foldGeo, ctx.materials.aluminum), HIFI_MESH_NAMES.amt);
      fold.position.set(open.tall ? x : x + off, open.tall ? y + off : y, foldZ);
    }
    bodyZ = zf - A.setBackIn - A.foldDepthIn;
  } else if (t.type === "horn-loaded") {
    const mouthR = Math.min(t.domeIn / 2, Math.min(face.w, face.h) / 2 - P.plateCornerIn);
    shape.holes.push(circlePath(0, 0, mouthR));
    const flare = add(
      zCylinder(mouthR, mouthR * P.flareThroat, P.flareDepthIn, flareMaterial(), true),
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
  body.position.set(x, y, bodyZ - b.depthIn / 2);
}
