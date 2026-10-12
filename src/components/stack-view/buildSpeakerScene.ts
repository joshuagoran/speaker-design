// Any speaker spec in the 3D view: its chambers where the spec puts them, from today's PA and Hi-fi parts. The layout
// (lib/speaker/speakerLayout) places the chambers, the walls they share and the drivers; each part keeps the rules of
// the engine its catalog table comes from: the PA's subs and mids (buildCone, the driver bodies), its letterbox, side
// ducts and flared tubes (buildSubwoofer's vent parts) and its horns (buildHorn, set into the baffle as the tower sets
// one, or on the top as the mid box carries one); the Hi-fi's woofers, coaxials, tweeters, waveguides, round ports,
// slots and passive radiators (buildHifiScene's parts). The cabinet is built as its construction says: the PA's frame
// with the baffle set back by the inset (its top arched where the layout draws it: lib/speaker drawsArchedTop), or
// the Hi-fi box with its baffle over the whole front and its roundover (its top drawn flat for now).
import * as THREE from "three";
import { createSceneContext, type SceneContext } from "./sceneContext";
import { BAFFLE_THICKNESS_IN, buildCabinet } from "./buildCabinet";
import { buildHifiCabinet } from "./buildHifiCabinet";
import { buildCone, paConeRadius } from "./buildCone";
import { buildHorn } from "./buildHorn";
import { buildDriverBody } from "./buildBraces";
import { hornBaffleHole } from "./towerParts";
import { buildSubSlotShelf, buildSubVent, subVentHoles, subVentPlan } from "./buildSubwoofer";
import {
  addRadiator,
  addRoundPorts,
  addSlotShelf,
  addTweeter,
  addWoofer,
  ellipsePath,
  hifiCompressionDriver,
  plateHole,
  wooferCutoutR,
} from "./buildHifiScene";
import { circlePath, flareGeometry, roundedRectPath } from "./geometry";
import { ROUNDOVER_IN } from "./stackHeights";
import {
  driverHorn,
  drawsArchedTop,
  driverSpots,
  driversOnBaffle,
  hornFlare,
  onTop,
  PORT_RULE,
  portRule,
  radiatorsAt,
  roundPortsAt,
  speakerLayout,
  type FaceRect,
  type PlacedChamber,
} from "../../lib/speaker/speakerLayout";
import { baffleInsetIn } from "../../lib/speaker/chamberAir";
import { PANEL } from "../../constants/cutParts";
import {
  CD_OPTIONS,
  FILL_OPTIONS,
  MID_OPTIONS,
  SUB_OPTIONS,
  driverMountKind,
  hifiDriverById,
  hornMountKind,
} from "../../lib/data";
import { byId } from "../../lib/tables";
import { DEFAULT_PA } from "../../lib/defaults";
import { driverKeepOut } from "../../lib/pa/calc";
import { subDriverDepthIn } from "../../lib/pa/tubes";
import { DRIVER_CLEARANCE_IN } from "../../lib/pa/bracing";
import { hornBodyColor } from "../../lib/pa/hornColor";
import { TOWER_HORN_WALL_GAP_IN } from "../../lib/pa/tower";
import { slotOpening } from "../../lib/hifi/boxLayout";
import { MID_DEPTH_FALLBACK_IN } from "../../data/catalog/driver-cutouts";
import { HIFI_BOX_LAYOUT } from "../../constants/hifiLayout";
import { HIFI_FRONT_PARTS } from "../../constants/hifiScene";
import { THREAD_MOUNT } from "../../constants/throatMounts";
import {
  CABINET_CONSTRUCTION,
  CHAMBER_LOAD,
  DRIVER_KIND,
  PORT_SHAPE,
  VENT_KIND,
} from "../../constants/speakerSpec";
import type { BoxRegion, Horn, RadiatorPanel, SpeakerDriver, SpeakerSpec } from "../../types";

/** The Designer scene's own meshes (every reused part keeps its builder's names). */
export const SPEAKER_MESH_NAMES = {
  /** a wall two chambers share: inside one shell, or the lower (or left) chamber's in a stepped shell */
  partition: "chamberPartition",
  /** a horn-loaded chamber's flare, one mesh per segment */
  hornFlare: "chamberHornFlare",
  /** a front-loaded or tapped horn's driver inside the chamber, drawn in the cutaway */
  hornDriver: "chamberHornDriver",
  /** a chamber's own panel in a stepped shell: an outside wall, its back or its baffle */
  wall: "chamberWall",
} as const;

/** The groups the scene puts each shell, chamber and driver in, so a check can find where it placed them. */
export const SPEAKER_GROUP_NAMES = {
  shell: "speakerShell",
  chamber: "speakerChamber",
  /** one driver, at its spot on the baffle (or, its horn on the top, on the top) */
  driver: "speakerDriver",
} as const;

/** The squareness of a horn-loaded chamber's flare sections: a rounded rectangle (`flareGeometry`). */
const HORN_FLARE_SQUARENESS = 6;
/** A front-loaded horn's driver body drawn at its throat in the cutaway: its depth, in. */
const HORN_DRIVER_DEPTH_IN = 3;
/** The corner radius of a horn-loaded chamber's mouth in the baffle, in. */
const HORN_MOUTH_CORNER_IN = 0.25;
/** The corner radius of a slot's opening, in (as the Hi-fi box cuts it). */
const SLOT_CORNER_IN = 0.02;
/** How close two places count as the same, in. */
const SAME_IN = 1e-9;

/** What the scene draws: the spec's cabinet and look, and the view's cutaway. */
export interface SpeakerSceneProps {
  spec: Pick<SpeakerSpec, "cabinet" | "look">;
  cutaway: boolean;
}

/**
 * What the scene reads of its props, as a key that changes exactly when the scene does: the construction, the top, the
 * panels' thickness, inset and roundover; each chamber's place, size, vent (a port's sizes and position, the radiators'
 * part, count and position), drivers (part, count, position, horn) and horn path (its drive, path, segments' areas and
 * lengths, and mouth position); the look and the cutaway.
 * The model's own inputs (stuffing, net air, bands, a port's elbows, a horn's profiles and throat chamber) are left out.
 */
export function speakerSceneKey({ spec, cutaway }: SpeakerSceneProps): string {
  const { cabinet, look } = spec;
  return JSON.stringify({
    cutaway,
    look,
    construction: cabinet.construction,
    top: cabinet.top,
    wall: cabinet.panel.thicknessIn,
    inset: baffleInsetIn(cabinet),
    roundover: cabinet.roundoverIn,
    chambers: cabinet.chambers.map(({ at, dims, vent, drivers, load }) => ({
      at,
      dims,
      vent:
        vent.kind === VENT_KIND.vented
          ? {
              kind: vent.kind,
              // the views fold a port as its engine does: its elbows don't change them
              port:
                vent.port.shape === PORT_SHAPE.duct ? vent.port : { ...vent.port, elbows: null },
            }
          : vent.kind === VENT_KIND.radiator
            ? {
                kind: vent.kind,
                id: vent.radiators.id,
                n: vent.radiators.n,
                position: vent.position,
              }
            : { kind: vent.kind },
      drivers: drivers.map(({ kind, driverId, count, position, horn }) => ({
        kind,
        driverId,
        count,
        position,
        horn,
      })),
      horn:
        load.kind === CHAMBER_LOAD.horn
          ? {
              drive: load.horn.drive.kind,
              path: load.horn.path,
              segments: load.horn.segments.map(({ s1, s2, length }) => [s1, s2, length]),
              mouth: load.horn.mouthPosition,
            }
          : null,
    })),
  });
}

/** A chamber's holes in a panel, drawn once its origin (center line, bottom) is known in the panel's coordinates. */
type Holes = (x: number, y: number) => THREE.Path[];

/** Where a chamber's baffle is, once its shell is built: the face at `zf`, the inside face at `innerZ`. */
interface BaffleAt {
  zf: number;
  innerZ: number;
}

/** A chamber's openings in its shell's baffle and back, and its parts, built once the baffle's place is known. */
interface ChamberParts {
  baffle: Holes[];
  back: Holes[];
  /**
   * a PA letterbox's band and its opening: a frame's baffle starts above the band where the chamber spans its shell's
   * bottom (as the PA sub's does), else the opening is cut in the baffle
   */
  slotBand: { h: number; hole: Holes } | null;
  build: (at: BaffleAt) => void;
}

/**
 * Builds any speaker as a Group (no DOM or WebGL needed). Units: inches; the floor at y = 0, the cabinet centered on
 * x = 0, its front at z = half the deepest chamber's depth. Chambers that fill one box of one depth get one shell, one
 * baffle and the shared walls inside it (as the PA tower is built); otherwise each chamber is its own box at its place.
 */
export function buildSpeakerScene({ spec, cutaway }: SpeakerSceneProps): THREE.Group {
  const { cabinet, look } = spec;
  const T = cabinet.panel.thicknessIn;
  /** the PA's frame, its baffle set back by the inset; else the Hi-fi box, its baffle over the whole front */
  const frame = cabinet.construction === CABINET_CONSTRUCTION.frameInset;
  const ctx = createSceneContext({
    wall: T,
    inset: baffleInsetIn(cabinet),
    cabFinish: look.cabFinish ?? DEFAULT_PA.cabFinish,
    baffleColor: look.baffleColor ?? DEFAULT_PA.baffleColor,
    cutaway,
    // each horn takes its own color (`hornContext`)
    horn: {},
  });
  const layout = speakerLayout(cabinet);
  // one shell round chambers that fill one box; else a stepped shell of the chambers that touch (each building only
  // the walls it owns), and a box of its own for any other
  const shells = layout.oneShell
    ? [
        {
          x0: -layout.size.w / 2,
          y0: 0,
          dims: layout.size,
          members: layout.chambers,
          stepped: false,
        },
      ]
    : layout.chambers.map((c) => ({
        x0: c.x0,
        y0: c.y0,
        dims: c.dims,
        members: [c],
        stepped: c.touches,
      }));
  for (const shell of shells) {
    const { dims } = shell;
    const cx = shell.x0 + dims.w / 2;
    const group = new THREE.Group();
    group.name = SPEAKER_GROUP_NAMES.shell;
    group.position.set(cx, shell.y0, layout.size.d / 2 - dims.d / 2);
    ctx.group.add(group);
    // each chamber in its own group: its center line at x = 0, its bottom at y = 0, centered on z = 0 as its shell is
    const members = shell.members.map((placed) => {
      const g = new THREE.Group();
      g.name = SPEAKER_GROUP_NAMES.chamber;
      g.position.set(placed.cx - cx, placed.y0 - shell.y0, 0);
      group.add(g);
      return { placed, g, parts: chamberParts({ ...ctx, group: g }, placed, cabinet, look) };
    });
    const band =
      frame && !shell.stepped
        ? members.find(
            ({ placed, parts }) =>
              parts.slotBand &&
              Math.abs(placed.y0 - shell.y0) < SAME_IN &&
              Math.abs(placed.dims.w - dims.w) < SAME_IN,
          )
        : undefined;
    const baffleBottom = band?.parts.slotBand?.h ?? 0;
    /** every chamber's holes in a panel whose origin is `y0` up from the shell's bottom, on its center line */
    const holes = (y0: number, panel: typeof PANEL.baffle | typeof PANEL.back) =>
      members.flatMap((m) => {
        const { g, parts } = m;
        const slot =
          panel === PANEL.baffle && m !== band && parts.slotBand ? [parts.slotBand.hole] : [];
        return [...parts[panel], ...slot].flatMap((h) => h(g.position.x, g.position.y - y0));
      });
    let at: BaffleAt;
    if (shell.stepped) {
      const [placed] = shell.members;
      at = buildSteppedPanels(
        { ...ctx, group },
        placed,
        { baffle: holes(0, PANEL.baffle), back: holes(0, PANEL.back) },
        frame,
      );
    } else if (frame) {
      // the frame's baffle holes are centered on the baffle, its back's on the box
      const baffleCy = T + baffleBottom + (dims.h - 2 * T - baffleBottom) / 2;
      const zf = buildCabinet(
        { ...ctx, group },
        {
          dims,
          baffleHoles: holes(baffleCy, PANEL.baffle),
          backHoles: holes(dims.h / 2, PANEL.back),
          y: 0,
          archTop: drawsArchedTop(cabinet, layout),
          baffleBottom,
        },
      ).baffleZ;
      at = { zf, innerZ: zf - BAFFLE_THICKNESS_IN };
    } else {
      const built = buildHifiCabinet(
        { ...ctx, group },
        {
          dim: dims,
          roundover: cabinet.roundoverIn,
          holes: {
            baffle: holes(0, PANEL.baffle),
            back: holes(0, PANEL.back),
            sides: { [-1]: [], 1: [] },
          },
        },
      );
      at = { zf: built.frontZ, innerZ: built.shellFrontZ };
    }
    for (const { parts } of members) parts.build(at);
    if (!layout.oneShell) continue;
    // the walls the chambers share, inside the shell's walls, from the back panel to the baffle's inside face
    const zB = -dims.d / 2 + T;
    for (const p of layout.partitions) {
      const x0 = Math.max(p.x, shell.x0 + T),
        x1 = Math.min(p.x + p.w, shell.x0 + dims.w - T),
        y0 = Math.max(p.y, shell.y0 + T),
        y1 = Math.min(p.y + p.h, shell.y0 + dims.h - T);
      if (x1 <= x0 || y1 <= y0 || at.innerZ <= zB) continue;
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(x1 - x0, y1 - y0, at.innerZ - zB),
        ctx.materials.inner,
      );
      wall.position.set((x0 + x1) / 2 - cx, (y0 + y1) / 2 - shell.y0, (at.innerZ + zB) / 2);
      wall.name = SPEAKER_MESH_NAMES.partition;
      group.add(wall);
    }
  }
  return ctx.group;
}

/**
 * A chamber's own panels in a stepped shell (`ctx.group`: its center line at x = 0, its bottom at y = 0): the walls it
 * builds (lib/speaker/speakerLayout `PlacedChamber.walls`: a partition where another chamber stands on it or right of it,
 * none where another gives it one), each the chamber's depth; its back and its baffle over its clear face, the baffle set
 * back by the frame's inset, ¾″ in the PA's frame and a wall thick in the Hi-fi box. Returns where its baffle is.
 */
function buildSteppedPanels(
  ctx: SceneContext,
  placed: PlacedChamber,
  holes: { baffle: THREE.Path[]; back: THREE.Path[] },
  frame: boolean,
): BaffleAt {
  const T = ctx.wall;
  const { d } = placed.dims;
  const local = (r: FaceRect) => ({
    x: r.x + r.w / 2 - placed.cx,
    y: r.y + r.h / 2 - placed.y0,
  });
  for (const w of placed.walls) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(w.w, w.h, d),
      w.shared ? ctx.materials.inner : ctx.materials.shell,
    );
    const at = local(w);
    m.position.set(at.x, at.y, 0);
    m.name = w.shared ? SPEAKER_MESH_NAMES.partition : SPEAKER_MESH_NAMES.wall;
    ctx.group.add(m);
  }
  const { clear } = placed;
  const c = local(clear);
  /** a panel over the clear face, `depth` thick from `z` back, with its holes */
  const panel = (cut: THREE.Path[], depth: number, z: number, materials: THREE.Material[]) => {
    const shape = new THREE.Shape([
      new THREE.Vector2(c.x - clear.w / 2, c.y - clear.h / 2),
      new THREE.Vector2(c.x + clear.w / 2, c.y - clear.h / 2),
      new THREE.Vector2(c.x + clear.w / 2, c.y + clear.h / 2),
      new THREE.Vector2(c.x - clear.w / 2, c.y + clear.h / 2),
    ]);
    shape.holes.push(...cut);
    const m = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 48 }),
      materials,
    );
    m.position.z = z - depth;
    m.name = SPEAKER_MESH_NAMES.wall;
    ctx.group.add(m);
  };
  panel(holes.back, T, -d / 2 + T, [ctx.materials.shell]);
  const thick = frame ? BAFFLE_THICKNESS_IN : T;
  const zf = d / 2 - ctx.inset;
  // its faces painted, its cut edges bare ply (as the PA's baffle)
  panel(holes.baffle, thick, zf, [
    ctx.materials.baffle,
    ctx.cutaway ? ctx.materials.baffle : ctx.materials.inner,
  ]);
  return { zf, innerZ: zf - thick };
}

/**
 * A context for one horn in a new group under `ctx.group`: its body takes `horn`'s color (the look's paint, else its
 * catalog finish).
 */
function hornContext(ctx: SceneContext, horn: Horn, hornColor: string | undefined): SceneContext {
  const hornShell = ctx.materials.hornShell.clone();
  hornShell.color.setHex(hornBodyColor(horn, hornColor));
  const group = new THREE.Group();
  ctx.group.add(group);
  return { ...ctx, group, materials: { ...ctx.materials, hornShell } };
}

/** A cone driver's nominal size, inches; undefined for a datasheet kind or an id its table doesn't have. */
function coneSize(driver: SpeakerDriver): number | undefined {
  switch (driver.kind) {
    case DRIVER_KIND.sub:
      return byId(SUB_OPTIONS, driver.driverId)?.size;
    case DRIVER_KIND.mid:
      return byId(MID_OPTIONS, driver.driverId)?.size;
    case DRIVER_KIND.woofer:
      return hifiDriverById("woofer", driver.driverId)?.size;
    case DRIVER_KIND.coaxial:
      return byId(FILL_OPTIONS, driver.driverId)?.size;
    case DRIVER_KIND.compression:
    case DRIVER_KIND.tweeter:
      return undefined;
  }
}

/** A PA cone's basket and motor behind the baffle, as the PA's keep-out has them, in its box's inside coordinates. */
function paDriverBody(driver: SpeakerDriver, center: { x: number; y: number }): BoxRegion[] | null {
  if (driver.kind === DRIVER_KIND.sub) {
    const sub = byId(SUB_OPTIONS, driver.driverId);
    return sub ? driverKeepOut(center, sub.size, subDriverDepthIn(sub)) : null;
  }
  if (driver.kind === DRIVER_KIND.mid) {
    const mid = byId(MID_OPTIONS, driver.driverId);
    return mid
      ? driverKeepOut(center, mid.size, mid.depthIn ?? MID_DEPTH_FALLBACK_IN[mid.size])
      : null;
  }
  return null;
}

/**
 * One chamber's openings and parts, in its own group (`ctx.group`: its center line at x = 0, its bottom at y = 0):
 * its drivers at their spots, its port or radiators by their engine's rule, and a horn-loaded chamber's mouth and flare.
 */
function chamberParts(
  ctx: SceneContext,
  placed: PlacedChamber,
  cabinet: SpeakerSceneProps["spec"]["cabinet"],
  look: SpeakerSceneProps["spec"]["look"],
): ChamberParts {
  const { chamber, dims } = placed;
  const T = ctx.wall;
  const frame = cabinet.construction === CABINET_CONSTRUCTION.frameInset;
  /** a horn built into the box, and how far its throat is behind the baffle's face */
  const flare = hornFlare(cabinet, placed);
  const flareIn = flare ? flare.segments.reduce((sum, s) => sum + s.length, 0) : 0;
  const baffle: Holes[] = [],
    back: Holes[] = [],
    builds: ((at: BaffleAt) => void)[] = [];
  let slotBand: ChamberParts["slotBand"] = null;
  /** a horn on the top: its lid's back edge ends at the frame's roundover (the Hi-fi box's back edges are sharp) */
  const backRoundover = frame ? ROUNDOVER_IN : 0;

  /**
   * One driver: its hole in the baffle at (x, y), and its parts in its own group there (a horn on the top: on the
   * chamber's top above x, back from the front by its position's `yIn`).
   */
  const addDriver = (driver: SpeakerDriver, x: number, y: number) => {
    const horn = driverHorn(driver);
    const top = onTop(driver);
    const group = new THREE.Group();
    group.name = SPEAKER_GROUP_NAMES.driver;
    group.position.set(x, top ? dims.h : y, top ? -driver.position.yIn : 0);
    ctx.group.add(group);
    const c: SceneContext = { ...ctx, group };
    const hole = (path: (x: number, y: number) => THREE.Path) =>
      baffle.push((ox, oy) => [path(ox + x, oy + y)]);
    switch (driver.kind) {
      case DRIVER_KIND.sub:
      case DRIVER_KIND.mid: {
        // the PA's cone in its cutout, and its basket and motor in the cutaway
        const size = coneSize(driver);
        if (size === undefined) return;
        const r = paConeRadius(size);
        const body = paDriverBody(driver, { x: x + dims.w / 2 - T, y: y - T });
        hole((hx, hy) => circlePath(hx, hy, r));
        builds.push(({ zf }) => {
          buildCone(c, { r, y: 0, z: zf });
          // the keep-out is in the chamber's inside coordinates: the box's bottom and center line from here
          if (body)
            buildDriverBody(c, {
              keepOut: { driver: body, vent: [] },
              box: dims,
              x: -x,
              y: -y,
              parent: group,
              clearance: DRIVER_CLEARANCE_IN,
            });
        });
        return;
      }
      case DRIVER_KIND.woofer:
      case DRIVER_KIND.coaxial: {
        // the Hi-fi woofer: its frame, cone and liner (a coaxial's HF in its center), its body in the cutaway
        const size = coneSize(driver);
        if (size === undefined) return;
        const r = wooferCutoutR(size);
        hole((hx, hy) => circlePath(hx, hy, r));
        builds.push(({ zf, innerZ }) =>
          addWoofer(c, {
            r,
            size,
            y: 0,
            zf,
            shellFrontZ: innerZ,
            coax: driver.kind === DRIVER_KIND.coaxial,
          }),
        );
        return;
      }
      case DRIVER_KIND.tweeter: {
        const t = hifiDriverById("tweeter", driver.driverId);
        if (!t) return;
        if (horn && !t.ownGuide) {
          // on its waveguide, the Hi-fi page's way: its compression driver behind, on the top or set into the baffle
          const cd = hifiCompressionDriver(t);
          const screwOn =
            driverMountKind(t) === THREAD_MOUNT || hornMountKind(horn) === THREAD_MOUNT;
          if (top) {
            builds.push(() =>
              buildHorn(hornContext(c, horn, look.hornColor), {
                horn,
                cd,
                y: 0,
                mount: dims,
                backRoundover,
                screwOn,
              }),
            );
            return;
          }
          const guide = horn.size;
          hole((hx, hy) =>
            roundedRectPath(
              hx,
              hy,
              guide.w,
              guide.h,
              Math.min(guide.w, guide.h) * HIFI_FRONT_PARTS.guideCornerPerSize,
            ),
          );
          builds.push(() =>
            buildHorn(hornContext(c, horn, look.hornColor), {
              horn,
              cd,
              y: dims.h - y,
              mount: dims,
              tower: { cy: 0, width: guide.w, sectionH: 0 },
            }),
          );
          return;
        }
        // a ribbon's or an AMT's own plate, a horn-loaded tweeter's faceplate or a dome, flush in the baffle
        const face = t.ownGuide ?? t.faceplate;
        hole((hx, hy) => plateHole(t, hx, hy, face));
        builds.push(({ zf }) => addTweeter(c, { t, face, x: 0, y: 0, zf }));
        return;
      }
      case DRIVER_KIND.compression: {
        const cd = byId(CD_OPTIONS, driver.driverId);
        if (!cd) return;
        if (!horn) {
          // no horn: only its exit through the baffle
          hole((hx, hy) => circlePath(hx, hy, cd.exit / 2));
          return;
        }
        if (top) {
          // the PA mid box's way: on the lid, held by its mount
          builds.push(() =>
            buildHorn(hornContext(c, horn, look.hornColor), {
              horn,
              cd,
              y: 0,
              mount: dims,
              hornMount: driver.horn?.mount ?? undefined,
              backRoundover,
            }),
          );
          return;
        }
        // the PA tower's way: set into the baffle, its mouth on the front plane
        const clearW = placed.clear.w;
        hole((hx, hy) => hornBaffleHole({ w: clearW + 2 * T }, T, horn, hx, hy));
        builds.push(() =>
          buildHorn(hornContext(c, horn, look.hornColor), {
            horn,
            cd,
            y: dims.h - y,
            mount: dims,
            tower: { cy: 0, width: clearW - 2 * TOWER_HORN_WALL_GAP_IN, sectionH: 0 },
          }),
        );
        return;
      }
    }
  };

  // the drivers: on the baffle (or their horns on the top), or a front-loaded or tapped horn's inside at its throat
  const onBaffle = driversOnBaffle(chamber);
  for (const driver of chamber.drivers)
    for (const spot of driverSpots(placed, driver)) {
      const x = spot.xIn - placed.cx,
        y = spot.yIn - placed.y0;
      if (onBaffle || onTop(driver)) addDriver(driver, x, y);
      else builds.push(({ zf }) => addHornDriver(ctx, placed, driver, { x, y, z: zf - flareIn }));
    }

  // the port, by its engine's rule
  const rule = portRule(chamber);
  if (rule?.rule === PORT_RULE.pa) {
    const plan = subVentPlan(rule.sub, dims, rule.portStyle, rule.portGeom, T);
    baffle.push((ox, oy) => subVentHoles(plan, dims, T, { x: ox, plinth: oy, baffleCy: 0 }));
    // the letterbox's mouth along the bottom, under its shelf
    if (plan.bandH > 0)
      slotBand = {
        h: plan.bandH,
        hole: (ox, oy) => [
          roundedRectPath(ox, oy + T + plan.ductH / 2, plan.innerW, plan.ductH, SLOT_CORNER_IN),
        ],
      };
    builds.push(({ zf }) => {
      buildSubVent(ctx, plan, {
        sub: rule.sub,
        box: dims,
        plinth: 0,
        baffleZ: zf,
        parent: ctx.group,
      });
      buildSubSlotShelf(ctx, plan, { box: dims, plinth: 0, parent: ctx.group });
    });
  } else if (rule?.rule === PORT_RULE.hifi) {
    const { port } = rule;
    if (port.shape === PORT_SHAPE.slot) {
      const opening = slotOpening(dims, T, port);
      baffle.push((ox, oy) => [
        roundedRectPath(ox, oy + opening.y + opening.h / 2, opening.w, opening.h, SLOT_CORNER_IN),
      ]);
      builds.push(({ innerZ }) =>
        addSlotShelf(ctx, { opening, len: port.len, shellFrontZ: innerZ }),
      );
    } else {
      // on the baffle, or on the back: there the tubes run in from the back's outer face (a group turned to face back,
      // so across is mirrored)
      const { panel, spots } = roundPortsAt(placed, port);
      (panel === PANEL.back ? back : baffle).push((ox, oy) =>
        spots.map((s) => circlePath(ox + s.x, oy + s.y, s.r + HIFI_BOX_LAYOUT.portTubeWallIn)),
      );
      builds.push(({ zf, innerZ }) => {
        if (!port.position) {
          addRoundPorts(ctx, { spots, port, dim: dims, zf });
          return;
        }
        // a set position: the tubes fold inside the chamber from where they are, the riser toward the farther of its
        // floor and top, the run from the port's panel to the inside face of the one facing it. The model's elbow count
        // (`port.elbows`) still takes the Hi-fi rule's row along the bottom.
        const clearLo = placed.clear.y - placed.y0,
          clearHi = clearLo + placed.clear.h;
        const rowY = spots.reduce((sum, s) => sum + s.y, 0) / Math.max(1, spots.length);
        const down = rowY > (clearLo + clearHi) / 2;
        const backZ = -dims.d / 2;
        const onBack = panel === PANEL.back;
        const fold = {
          room: {
            run: onBack ? innerZ - backZ : zf - (backZ + T),
            rise: down ? rowY - clearLo : clearHi - rowY,
            stop: onBack ? T : zf - innerZ,
          },
          down,
        };
        if (!onBack) {
          addRoundPorts(ctx, { spots, port, dim: dims, zf, fold });
          return;
        }
        const group = new THREE.Group();
        group.rotation.y = Math.PI;
        ctx.group.add(group);
        addRoundPorts(
          { ...ctx, group },
          { spots: spots.map((s) => ({ ...s, x: -s.x })), port, dim: dims, zf: -backZ, fold },
        );
      });
    }
  }

  // the passive radiators, where the layout puts them (by the Hi-fi rule, on the back, unless the vent sets a position)
  const radiators = radiatorsAt(cabinet, placed).spots;
  if (radiators.length) {
    const k = HIFI_FRONT_PARTS.radiatorFrameIn;
    const on = (panel: RadiatorPanel) => (ox: number, oy: number) =>
      radiators
        .filter((s) => s.panel === panel)
        .map((s) => ellipsePath(ox + s.x, oy + s.y, s.shape.w / 2 - k, s.shape.h / 2 - k));
    baffle.push(on(PANEL.baffle));
    back.push(on(PANEL.back));
    builds.push(({ zf, innerZ }) => {
      const sideZ = (-dims.d / 2 + innerZ) / 2;
      for (const s of radiators) {
        // each in a group at its place across (the Hi-fi part centers it on its panel)
        const group = new THREE.Group();
        group.position.x = s.x;
        ctx.group.add(group);
        addRadiator({ ...ctx, group }, s, { dim: dims, zf, sideZ });
      }
    });
  }

  // a horn built into the box: its mouth in the baffle, its flare from the segments behind it
  if (flare) {
    const { mouth } = flare;
    const mx = mouth.x + mouth.w / 2 - placed.cx,
      my = mouth.y + mouth.h / 2 - placed.y0;
    baffle.push((ox, oy) => [
      roundedRectPath(ox + mx, oy + my, mouth.w, mouth.h, HORN_MOUTH_CORNER_IN),
    ]);
    builds.push(({ zf }) => {
      const material = ctx.materials.inner.clone();
      material.side = THREE.DoubleSide;
      // throat first, from the back: each segment grows toward the mouth on the baffle
      let z = zf - flareIn;
      for (const s of flare.segments) {
        const m = new THREE.Mesh(
          flareGeometry({
            throat: s.throat,
            mouth: s.mouth,
            depth: s.length,
            squareness: () => HORN_FLARE_SQUARENESS,
          }),
          material,
        );
        m.position.set(mx, my, z);
        m.name = SPEAKER_MESH_NAMES.hornFlare;
        ctx.group.add(m);
        z += s.length;
      }
    });
  }

  return { baffle, back, slotBand, build: (at) => builds.forEach((b) => b(at)) };
}

/**
 * A front-loaded or tapped horn's driver inside its chamber, in the cutaway: a body of its cone's cutout facing the
 * throat at (x, y, z), behind it (a placeholder until the horn's fold layout places it), kept off the back panel.
 */
function addHornDriver(
  ctx: SceneContext,
  placed: PlacedChamber,
  driver: SpeakerDriver,
  { x, y, z: throatZ }: { x: number; y: number; z: number },
) {
  const size = coneSize(driver);
  if (!ctx.cutaway || size === undefined) return;
  const backZ = -placed.dims.d / 2 + ctx.wall;
  const r = wooferCutoutR(size);
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, HORN_DRIVER_DEPTH_IN, 32),
    ctx.materials.black,
  );
  body.rotation.x = Math.PI / 2; // its axis along z
  body.position.set(
    x,
    y,
    Math.max(backZ, throatZ - HORN_DRIVER_DEPTH_IN) + HORN_DRIVER_DEPTH_IN / 2,
  );
  body.name = SPEAKER_MESH_NAMES.hornDriver;
  ctx.group.add(body);
}
