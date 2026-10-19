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
import { BAFFLE_CORNER_IN, BAFFLE_THICKNESS_IN, buildCabinet } from "./buildCabinet";
import { buildHifiCabinet } from "./buildHifiCabinet";
import { buildCone, paConeRadius } from "./buildCone";
import { buildHorn } from "./buildHorn";
import { buildFoldHorn } from "./buildFoldHorn";
import {
  NO_WALL_OPENINGS,
  openingRect,
  panelPieces,
  type WallOpening,
  type WallOpenings,
} from "./wallCuts";
import { buildBracesAt, buildDriverBody } from "./buildBraces";
import { buildHardware } from "./buildHardware";
import { hornBaffleHole } from "./towerParts";
import { buildSubSlotShelf, buildSubVent, subVentHoles } from "./buildSubwoofer";
import { subVentPlan } from "../../lib/build/ventPlan";
import {
  addRadiator,
  addRoundPorts,
  addSlotShelf,
  addSlotWall,
  addTweeter,
  addWoofer,
  ellipsePath,
  hifiCompressionDriver,
  plateHole,
  wooferCutoutR,
} from "./buildHifiScene";
import { circlePath, ductGeometry, roundedRectPath, type DuctSection } from "./geometry";
import { ROUNDOVER_IN } from "./stackHeights";
import { HORN_DRIVER_ROOM_IN } from "../../constants/hornPath";
import { PARTS_3D } from "../../styles/palette";
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
  slotOpeningsAt,
  hornFitsWhereSet,
  hornCutoutBox,
  chamberHardwareBox,
} from "../../lib/speaker/speakerLayout";
import { baffleInsetIn } from "../../lib/speaker/chamberAir";
import { cabinetBuild } from "../../lib/speaker/speakerBuild";
import { driverBoardPieces } from "../../lib/speaker/driverBoard";
import { foldDrawing } from "../../lib/speaker/foldHorn";
import { bracingRegions } from "../../lib/build/bracing";
import { PANEL } from "../../constants/cutParts";
import {
  CD_OPTIONS,
  FILL_OPTIONS,
  MID_OPTIONS,
  SPEAKER_SUB_OPTIONS,
  driverMountKind,
  hifiDriverById,
  hornMountKind,
} from "../../lib/data";
import { byId } from "../../lib/tables";
import { DEFAULT_PA } from "../../lib/defaults";
import { driverKeepOut, slotFolds } from "../../lib/acoustics/boxModels";
import { PORT_STYLE } from "../../constants/portStyles";
import { subDriverDepthIn } from "../../lib/build/tubes";
import { DRIVER_CLEARANCE_IN } from "../../lib/build/boxBracing";
import { hornBodyColor } from "../../lib/speaker/hornColor";
import { TOWER_HORN_WALL_GAP_IN } from "../../lib/speaker/tower";
import { MID_DEPTH_FALLBACK_IN } from "../../data/catalog/driver-cutouts";
import { HIFI_BOX_LAYOUT } from "../../constants/hifiLayout";
import { HIFI_FRONT_PARTS } from "../../constants/hifiScene";
import { THREAD_MOUNT } from "../../constants/throatMounts";
import {
  CABINET_CONSTRUCTION,
  CHAMBER_LOAD,
  DRIVER_KIND,
  FOLD_WALL,
  PORT_SHAPE,
  VENT_KIND,
} from "../../constants/speakerSpec";
import type { BoxRegion, Horn, RadiatorPanel, SpeakerDriver, SpeakerSpec } from "../../types";

/** The speaker scene's own meshes (every reused part keeps its builder's names). */
export const SPEAKER_MESH_NAMES = {
  /** a wall two chambers share: inside one shell, or the lower (or left) chamber's in a stepped shell */
  partition: "chamberPartition",
  /** a horn-loaded chamber's flare, one mesh per leg of its path (one for a straight path) */
  hornFlare: "chamberHornFlare",
  /** the gap where a folded path turns from one leg to the next */
  hornTurn: "chamberHornTurn",
  /** the bay the drivers stand in behind the throat */
  hornBay: "chamberHornBay",
  /** the walls' back edges at the throat's plane: boards round the throat's opening, never over it */
  hornThroat: "chamberHornThroat",
  /** the driver board behind the bay, one mesh per piece of it: the baffle the drivers mount on (painted as one) */
  driverBoard: "chamberDriverBoard",
  /** a front-loaded or tapped horn's driver inside the chamber, drawn in the cutaway */
  hornDriver: "chamberHornDriver",
  /** a board of a drawn (folded) horn's side section, one mesh per board */
  foldBoard: "chamberFoldBoard",
  /** a drawn horn's driver behind its board, one mesh per driver, drawn in the cutaway */
  foldDriver: "chamberFoldDriver",
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

/** How far a horn driver's face stands back from the cones' plane, in. */
const HORN_DRIVER_GAP_IN = 0.02;
/** The angle two panels of a horn's flare make before the view draws a line along their edge, degrees. */
const HORN_EDGE_DEG = 3;
/** The corner radius of a horn-loaded chamber's mouth in the baffle, in. */
const HORN_MOUTH_CORNER_IN = 0.25;
/** The corner radius of a slot's opening, in (as the Hi-fi box cuts it). */
const SLOT_CORNER_IN = 0.02;
/**
 * How far an opening's hole in a panel stays off the chamber's clear face's edge, in. A hole that touches the panel's
 * outline is cut as part of it (the triangulation then spans the opening: the panel covers it), and a horn mouth or a
 * slot as tall as the face, or against a wall, does touch it. The walls hide the sliver the gap leaves. (Its corners are
 * the baffle's at least, `BAFFLE_CORNER_IN`: a sharper corner at the baffle's corner pokes out of the outline.)
 */
const OPENING_EDGE_GAP_IN = 0.002;
/** How close two places count as the same, in. */
const SAME_IN = 1e-9;

/** A chamber's inside as the bracing rule takes it: across, up and deep, in. */
const braceInner = ({ iw, ih, inD }: { iw: number; ih: number; inD: number }) => ({
  x: iw,
  y: ih,
  z: inD,
});

/** The braces and ribs the bracing rule puts in chamber `index`, as regions of its inside. */
const braceRegionsOf = (cabinet: SpeakerSpec["cabinet"], index: number) => {
  const built = cabinetBuild(cabinet).chambers[index];
  return built
    ? bracingRegions(built.bracing, braceInner(built.inside), cabinet.panel.thicknessIn)
    : [];
};

/** What the scene draws: the spec's cabinet and look, the view's cutaway, and whether it shows the drivers. */
export interface SpeakerSceneProps {
  spec: Pick<SpeakerSpec, "cabinet" | "look">;
  cutaway: boolean;
  /** the drivers, their horns and their bodies drawn (default); false leaves their cutouts open */
  drivers?: boolean;
}

/** The meshes and groups a driver is drawn with, which the view leaves out while the drivers are hidden. */
const DRIVER_PART_NAMES: ReadonlySet<string> = new Set([
  SPEAKER_GROUP_NAMES.driver,
  SPEAKER_MESH_NAMES.hornDriver,
  SPEAKER_MESH_NAMES.foldDriver,
]);

/**
 * What the scene reads of its props, as a key that changes exactly when the scene does: the construction, the top, the
 * panels' thickness, inset and roundover; each chamber's place, size, vent (a port's sizes and position, the radiators'
 * part, count and position), drivers (part, count, position, horn) and horn path (its drive, path, driver board,
 * segments' areas and lengths and flare laws, and mouth position), and, in the cutaway, its braces and ribs (so the bracing style and target
 * rebuild it); the look and the cutaway.
 * The model's own inputs (stuffing, net air, bands, a port's elbows and a horn's throat chamber) are left out.
 */
export function speakerSceneKey({ spec, cutaway, drivers = true }: SpeakerSceneProps): string {
  const { cabinet, look } = spec;
  return JSON.stringify({
    cutaway,
    drivers,
    look,
    construction: cabinet.construction,
    top: cabinet.top,
    wall: cabinet.panel.thicknessIn,
    inset: baffleInsetIn(cabinet),
    roundover: cabinet.roundoverIn,
    // the handles' model and offsets, and the input dish (the posts follow the dish and the horn on the top)
    handles: cabinet.handles,
    inputDish: cabinet.inputDish,
    chambers: cabinet.chambers.map(({ at, dims, vent, drivers, load }, i) => ({
      at,
      dims,
      // the braces and ribs the cutaway draws (the bracing style and target, and anything else that moves them)
      braces: cutaway ? braceRegionsOf(cabinet, i) : null,
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
              doubleBoard: load.horn.doubleBoard === true,
              segments: load.horn.segments.map(({ profile, s1, s2, length }) => [
                profile,
                s1,
                s2,
                length,
              ]),
              mouth: load.horn.mouthPosition,
              // a folded horn's drawing: its boards, drivers and mouth
              fold: load.horn.fold ?? null,
            }
          : null,
    })),
  });
}

/** A chamber's holes in a panel, drawn once its origin (center line, bottom) is known in the panel's coordinates. */
type Holes = (x: number, y: number) => THREE.Path[];

/**
 * Where a chamber's baffle is, once its shell is built: the face at `zf`, the inside face at `innerZ`; `banded`, whether
 * its lower edge starts above the chamber's slot band (`ChamberParts.slotBand`) rather than the band being cut in it.
 */
interface BaffleAt {
  zf: number;
  innerZ: number;
  banded: boolean;
}

/** A chamber's openings in its shell's baffle and back, and its parts, built once the baffle's place is known. */
interface ChamberParts {
  baffle: Holes[];
  back: Holes[];
  /**
   * openings across its top and bottom walls (a drawn horn's mouth or vent), from its center line (x = 0): clear in the
   * panel where the wall is the shell's, none where another chamber is
   */
  top: WallOpening[];
  bottom: WallOpening[];
  /**
   * a slot band and its openings, its height up from the chamber's clear face: the PA letterbox's, or a plain slot stack
   * the clear face's width. A frame's baffle starts above the band where the chamber spans its shell's bottom (as the
   * PA sub's does) or stands in a stepped shell, else the openings are cut in the baffle
   */
  slotBand: { h: number; hole: Holes } | null;
  build: (at: BaffleAt) => void;
}

/**
 * Builds any speaker as a Group (no DOM or WebGL needed). Units: inches; the floor at y = 0, the cabinet centered on
 * x = 0, its front at z = half the deepest chamber's depth. Chambers that fill one box of one depth get one shell, one
 * baffle and the shared walls inside it (as the PA tower is built); otherwise each chamber is its own box at its place.
 */
export function buildSpeakerScene({
  spec,
  cutaway,
  drivers = true,
}: SpeakerSceneProps): THREE.Group {
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
    const band = frame
      ? members.find(
          ({ placed, parts }) =>
            parts.slotBand &&
            Math.abs(placed.y0 - shell.y0) < SAME_IN &&
            Math.abs(placed.dims.w - dims.w) < SAME_IN,
        )
      : undefined;
    const baffleBottom = band?.parts.slotBand?.h ?? 0;
    // a horn-loaded chamber's front panel (the frame round its mouth) is cabinet, not baffle: the baffle is its driver
    // board, which the drivers mount on. A shell with any other chamber keeps its baffle, that chamber's, and so does
    // a back-loaded horn (its drivers are on the baffle, no board).
    const hornFront = members.every(
      ({ placed }) =>
        !driversOnBaffle(placed.chamber) &&
        (hornFlare(cabinet, placed) !== null || foldDrawing(cabinet, placed.chamber) !== null),
    );
    const faceCtx: SceneContext = hornFront
      ? { ...ctx, materials: { ...ctx.materials, baffle: ctx.materials.shell } }
      : ctx;
    /** every chamber's holes in a panel whose origin is `y0` up from the shell's bottom, on its center line */
    const holes = (y0: number, panel: typeof PANEL.baffle | typeof PANEL.back) =>
      members.flatMap((m) => {
        const { g, parts } = m;
        const slot =
          panel === PANEL.baffle && m !== band && parts.slotBand ? [parts.slotBand.hole] : [];
        return [...parts[panel], ...slot].flatMap((h) => h(g.position.x, g.position.y - y0));
      });
    /**
     * the openings in the shell's top and bottom: each chamber's, where its wall is the shell's (a chamber that stands
     * on or under another has the partition there), in the shell group's x
     */
    const wallOpenings: WallOpenings = {
      top: members.flatMap(({ placed, g, parts }) =>
        Math.abs(placed.y0 + placed.dims.h - (shell.y0 + dims.h)) < SAME_IN
          ? parts.top.map((o) => ({ ...o, x0: o.x0 + g.position.x, x1: o.x1 + g.position.x }))
          : [],
      ),
      bottom: members.flatMap(({ placed, g, parts }) =>
        Math.abs(placed.y0 - shell.y0) < SAME_IN
          ? parts.bottom.map((o) => ({ ...o, x0: o.x0 + g.position.x, x1: o.x1 + g.position.x }))
          : [],
      ),
    };
    let at: BaffleAt;
    if (shell.stepped) {
      const [placed] = shell.members;
      at = buildSteppedPanels(
        { ...faceCtx, group },
        placed,
        { baffle: holes(0, PANEL.baffle), back: holes(0, PANEL.back) },
        frame,
        baffleBottom,
        wallOpenings,
      );
    } else if (frame) {
      // the frame's baffle holes are centered on the baffle, its back's on the box
      const baffleCy = T + baffleBottom + (dims.h - 2 * T - baffleBottom) / 2;
      const zf = buildCabinet(
        { ...faceCtx, group },
        {
          dims,
          baffleHoles: holes(baffleCy, PANEL.baffle),
          backHoles: holes(dims.h / 2, PANEL.back),
          wallOpenings,
          y: 0,
          archTop: drawsArchedTop(cabinet, layout),
          baffleBottom,
        },
      ).baffleZ;
      at = { zf, innerZ: zf - BAFFLE_THICKNESS_IN, banded: band !== undefined };
    } else {
      const built = buildHifiCabinet(
        { ...faceCtx, group },
        {
          dim: dims,
          roundover: cabinet.roundoverIn,
          holes: {
            baffle: holes(0, PANEL.baffle),
            back: holes(0, PANEL.back),
            sides: { [-1]: [], 1: [] },
          },
          wallOpenings,
          // a horn chamber's mouth looks onto its boards: the panels' inner faces show, as in the PA's frame
          lining: !members.some(({ placed }) => placed.chamber.load.kind === CHAMBER_LOAD.horn),
        },
      );
      at = { zf: built.frontZ, innerZ: built.shellFrontZ, banded: false };
    }
    for (const { parts } of members) parts.build(at);
    // the handles, input dish and horn posts the build plans (the cutlist and the weights count these same parts), on the
    // faces of the box they are placed on (buildHardware)
    for (const { placed, g } of members) {
      const plan = cabinetBuild(cabinet).chambers[layout.chambers.indexOf(placed)]?.hardware;
      if (!plan) continue;
      const on = chamberHardwareBox(cabinet, placed);
      buildHardware(ctx, {
        plan,
        box: on.box,
        y: on.y0 - placed.y0,
        x: on.cx - placed.cx,
        parent: g,
      });
    }
    // the braces and ribs the bracing rule puts in each chamber, shown in the cutaway
    if (cutaway)
      for (const { placed, g } of members) {
        const built = cabinetBuild(cabinet).chambers[layout.chambers.indexOf(placed)];
        if (!built) continue;
        const { clear } = placed;
        buildBracesAt(ctx, {
          bracing: built.bracing,
          inner: braceInner(built.inside),
          corner: { x: clear.x - placed.cx, y: clear.y - placed.y0, z: at.innerZ },
          parent: g,
        });
      }
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
  if (!drivers) {
    // the drivers hidden: their parts come out, their cutouts stay open in the baffle and the boards
    const hidden: THREE.Object3D[] = [];
    ctx.group.traverse((o) => {
      if (DRIVER_PART_NAMES.has(o.name)) hidden.push(o);
    });
    for (const o of hidden) o.removeFromParent();
  }
  return ctx.group;
}

/**
 * A chamber's own panels in a stepped shell (`ctx.group`: its center line at x = 0, its bottom at y = 0): the walls it
 * builds (lib/speaker/speakerLayout `PlacedChamber.walls`: a partition where another chamber stands on it or right of it,
 * none where another gives it one), each the chamber's depth; its back and its baffle over its clear face, the baffle set
 * back by the frame's inset, ¾″ in the PA's frame and a wall thick in the Hi-fi box, its lower edge `bottom` above the
 * clear face's (a slot band's). A wall of its own that has openings (`wallOpenings`: a drawn horn's mouth or vent in the
 * top or the bottom) is built as the pieces round them. Returns where its baffle is.
 */
function buildSteppedPanels(
  ctx: SceneContext,
  placed: PlacedChamber,
  holes: { baffle: THREE.Path[]; back: THREE.Path[] },
  frame: boolean,
  bottom: number,
  wallOpenings: WallOpenings = NO_WALL_OPENINGS,
): BaffleAt {
  const T = ctx.wall;
  const { d } = placed.dims;
  const local = (r: FaceRect) => ({
    x: r.x + r.w / 2 - placed.cx,
    y: r.y + r.h / 2 - placed.y0,
  });
  const { clear } = placed;
  const innerAt = d / 2 - ctx.inset - (frame ? BAFFLE_THICKNESS_IN : T);
  for (const w of placed.walls) {
    const at = local(w);
    // a level wall of its own above or below the clear face takes that side's openings
    const level = w.w >= w.h && !w.shared;
    const openings = !level
      ? []
      : w.y >= clear.y + clear.h - SAME_IN
        ? wallOpenings.top
        : w.y + w.h <= clear.y + SAME_IN
          ? wallOpenings.bottom
          : [];
    const pieces = panelPieces(
      { x0: at.x - w.w / 2, x1: at.x + w.w / 2, z0: -d / 2, z1: d / 2 },
      openings.map((o) => openingRect(innerAt, o)),
    );
    for (const piece of pieces) {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(piece.x1 - piece.x0, w.h, piece.z1 - piece.z0),
        w.shared ? ctx.materials.inner : ctx.materials.shell,
      );
      m.position.set((piece.x0 + piece.x1) / 2, at.y, (piece.z0 + piece.z1) / 2);
      m.name = w.shared ? SPEAKER_MESH_NAMES.partition : SPEAKER_MESH_NAMES.wall;
      ctx.group.add(m);
    }
  }
  const c = local(clear);
  /** a panel over the clear face above `lo`, `depth` thick from `z` back, with its holes */
  const panel = (
    cut: THREE.Path[],
    depth: number,
    z: number,
    materials: THREE.Material[],
    lo = 0,
  ) => {
    const shape = new THREE.Shape([
      new THREE.Vector2(c.x - clear.w / 2, c.y - clear.h / 2 + lo),
      new THREE.Vector2(c.x + clear.w / 2, c.y - clear.h / 2 + lo),
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
  panel(
    holes.baffle,
    thick,
    zf,
    [ctx.materials.baffle, ctx.cutaway ? ctx.materials.baffle : ctx.materials.inner],
    bottom,
  );
  return { zf, innerZ: zf - thick, banded: bottom > 0 };
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
      return byId(SPEAKER_SUB_OPTIONS, driver.driverId)?.size;
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
    const sub = byId(SPEAKER_SUB_OPTIONS, driver.driverId);
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
  /** a drawn (folded) horn: its boards and drivers are inside, on its own boards, none on the baffle */
  const drawing = foldDrawing(cabinet, chamber);
  const baffle: Holes[] = [],
    back: Holes[] = [],
    top: WallOpening[] = [],
    bottom: WallOpening[] = [],
    builds: ((at: BaffleAt) => void)[] = [];
  let slotBand: ChamberParts["slotBand"] = null;
  /**
   * A rectangular opening in a panel: the chamber's origin (`ox`, `oy`, as `Holes` take them) and the opening's center
   * (`x`, `y`) from the chamber's center line and bottom. It stays a hair inside the chamber's clear face
   * (`OPENING_EDGE_GAP_IN`).
   */
  const openingPath = (
    ox: number,
    oy: number,
    x: number,
    y: number,
    w: number,
    h: number,
    corner: number,
  ) => {
    const lo = { x: placed.clear.x - placed.cx, y: placed.clear.y - placed.y0 };
    const x0 = Math.max(x - w / 2, lo.x + OPENING_EDGE_GAP_IN),
      x1 = Math.min(x + w / 2, lo.x + placed.clear.w - OPENING_EDGE_GAP_IN),
      y0 = Math.max(y - h / 2, lo.y + OPENING_EDGE_GAP_IN),
      y1 = Math.min(y + h / 2, lo.y + placed.clear.h - OPENING_EDGE_GAP_IN);
    return roundedRectPath(
      ox + (x0 + x1) / 2,
      oy + (y0 + y1) / 2,
      x1 - x0,
      y1 - y0,
      Math.max(corner, BAFFLE_CORNER_IN),
    );
  };
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
          // on its waveguide, as a hi-fi design has it: its compression driver behind, on the top or set into the baffle
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
        hole((hx, hy) => hornBaffleHole(hornCutoutBox(placed, T), T, horn, hx, hy));
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
      // a drawn horn's drivers are on its board (`buildFoldHorn`); only a horn on the top is drawn here
      if (drawing && !onTop(driver)) continue;
      const x = spot.xIn - placed.cx,
        y = spot.yIn - placed.y0;
      // a horn that no longer fits where it is set isn't built (the page says so)
      if ((onBaffle || onTop(driver)) && hornFitsWhereSet(placed, driver)) addDriver(driver, x, y);
      else
        builds.push(({ innerZ }) => {
          // a front-loaded horn's drivers stand in the bay at its throat, where the layout stacks them
          const { bay } = flare?.path ?? { bay: null };
          addHornDriver(
            ctx,
            placed,
            driver,
            { x, y },
            // the bay's z range is back from the baffle's inside face; the cone faces the throat, its face the walls'
            // clearance behind their back edges, its body behind it
            bay
              ? { front: innerZ - bay.coneZ, back: innerZ - bay.bodyZ }
              : { front: innerZ, back: innerZ - HORN_DRIVER_ROOM_IN },
          );
        });
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
        // each opening between the fins
        hole: (ox, oy) =>
          plan.fins.openings.map((x) =>
            roundedRectPath(
              ox + x,
              oy + T + plan.ductH / 2,
              plan.fins.open,
              plan.ductH,
              SLOT_CORNER_IN,
            ),
          ),
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
      // each of the stacked slots, under its own shelf
      const openings = slotOpeningsAt(placed, port, T);
      const cut: Holes = (ox, oy) =>
        openings.map((o) => openingPath(ox, oy, o.x, o.y + o.h / 2, o.w, o.h, SLOT_CORNER_IN));
      const top = openings[openings.length - 1];
      const fullWidth = top.w >= placed.clear.w - SAME_IN;
      // the frame's baffle sits between the walls, on the clear face, so a slot its full width can't be a hole in it:
      // the baffle starts above the stack's top shelf, as it does above the letterbox's band
      if (frame && fullWidth)
        slotBand = { h: top.y + top.h + T - (placed.clear.y - placed.y0), hole: cut };
      else baffle.push(cut);
      // a folded slot too long to run straight: the PA slot's fold up the back wall, its one full-width slot (the
      // length the fit check takes: lib/speaker/speakerBuild hifiSlotFits)
      const fold =
        port.folded &&
        openings.length === 1 &&
        fullWidth &&
        slotFolds(dims, { slotH: port.h, len: port.len }, T);
      builds.push(({ zf, innerZ, banded }) => {
        if (fold) {
          const plan = subVentPlan(
            DEFAULT_PA.sub,
            dims,
            PORT_STYLE.slot,
            { ductH: port.h, tubeLen: port.len, fins: 0 },
            T,
          );
          buildSubSlotShelf(ctx, plan, { box: dims, plinth: 0, parent: ctx.group });
          return;
        }
        // above a band, each shelf's front edge is the baffle between the slots: from the baffle's face
        const front = banded ? zf : innerZ;
        openings.forEach((opening) =>
          opening.side
            ? addSlotWall(ctx, {
                opening,
                side: opening.side,
                len: port.len + front - innerZ,
                shellFrontZ: front,
                backZ: -dims.d / 2 + T,
              })
            : addSlotShelf(ctx, { opening, len: port.len + front - innerZ, shellFrontZ: front }),
        );
      });
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

  // a drawn horn: its boards, its drivers on theirs, and its mouth and vent in their walls (a hole where the wall is a panel)
  if (drawing) {
    const { clear } = placed;
    for (const opening of [drawing.fold.mouth, drawing.fold.vent]) {
      if (!opening) continue;
      const up = opening.wall === FOLD_WALL.baffle || opening.wall === FOLD_WALL.back;
      const from = Math.max(0, Math.min(opening.fromIn, opening.toIn));
      const to = Math.min(
        up ? clear.h : drawing.room.depthIn,
        Math.max(opening.fromIn, opening.toIn),
      );
      if (!(to > from)) continue;
      if (up) {
        // across the clear width, from `from` to `to` up the wall (the baffle and the back run up)
        const hole: Holes = (ox, oy) => [
          openingPath(
            ox,
            oy,
            clear.x + clear.w / 2 - placed.cx,
            clear.y - placed.y0 + (from + to) / 2,
            clear.w,
            to - from,
            HORN_MOUTH_CORNER_IN,
          ),
        ];
        (opening.wall === FOLD_WALL.baffle ? baffle : back).push(hole);
      } else {
        // across the clear width, from `from` to `to` back from the baffle's inside face (the top and the bottom run back)
        (opening.wall === FOLD_WALL.top ? top : bottom).push({
          x0: clear.x - placed.cx,
          x1: clear.x + clear.w - placed.cx,
          fromIn: from,
          toIn: to,
        });
      }
    }
    builds.push(({ innerZ }) =>
      buildFoldHorn(ctx, {
        drawing,
        innerZ,
        clear,
        origin: { x: placed.cx, y: placed.y0 },
        names: {
          board: SPEAKER_MESH_NAMES.foldBoard,
          driver: SPEAKER_MESH_NAMES.foldDriver,
        },
      }),
    );
  }

  // a horn built into the box: its mouth in the baffle, its flare from the segments behind it
  if (flare) {
    const { mouth } = flare;
    const mx = mouth.x + mouth.w / 2 - placed.cx,
      my = mouth.y + mouth.h / 2 - placed.y0;
    baffle.push((ox, oy) => [openingPath(ox, oy, mx, my, mouth.w, mouth.h, HORN_MOUTH_CORNER_IN)]);
    const { path } = flare;
    builds.push(({ innerZ }) => {
      const material = ctx.materials.inner.clone();
      material.side = THREE.DoubleSide;
      const line = new THREE.LineBasicMaterial({ color: PARTS_3D.black });
      /** a duct of flat panels with a line along each edge, named for the check that finds it */
      const duct = (
        name: string,
        sections: readonly DuctSection[],
        look: THREE.Material = material,
      ) => {
        const geometry = ductGeometry(sections);
        const mesh = new THREE.Mesh(geometry, look);
        mesh.name = name;
        mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry, HORN_EDGE_DEG), line));
        ctx.group.add(mesh);
      };
      /** a rectangle of the path in the group's coordinates: z measured back from the baffle's inside face */
      const at = (c: { cx: number; cy: number; z: number; w: number; h: number }): DuctSection => ({
        x: c.cx - placed.cx,
        y: c.cy - placed.y0,
        z: innerZ - c.z,
        w: c.w,
        h: c.h,
      });
      for (const leg of path.legs) duct(SPEAKER_MESH_NAMES.hornFlare, leg.sections.map(at));
      for (const t of path.turns) {
        const rect = { cx: t.cx, cy: (t.y0 + t.y1) / 2, w: t.w, h: t.y1 - t.y0 };
        duct(SPEAKER_MESH_NAMES.hornTurn, [at({ ...rect, z: t.z0 }), at({ ...rect, z: t.z1 })]);
      }
      // the drivers' bay behind the throat (the front chamber): its sides, and the walls' back edges returning to them
      // along the throat's plane as strips round the throat's opening (lib/speaker/hornGeometry `HornBay.strips`). The
      // strips are boards a wall thick on the cones' side of that plane: the opening itself stays clear, cones to mouth.
      const { bay } = path;
      if (bay) {
        const rect = { cx: bay.x + bay.w / 2, cy: bay.y + bay.h / 2, w: bay.w, h: bay.h };
        duct(
          SPEAKER_MESH_NAMES.hornBay,
          [at({ ...rect, z: bay.z0 }), at({ ...rect, z: bay.z1 })],
          ctx.materials.shell,
        );
        // the driver board behind the bay: the baffle the drivers mount on, painted as one, a piece of the walls' plywood
        // each (two when doubled), with a hole for every cone; the first piece's front face is the bay's end
        const toBack = path.folds % 2 === 0 ? 1 : -1;
        const pieces =
          chamber.load.kind === CHAMBER_LOAD.horn ? driverBoardPieces(chamber.load.horn) : 1;
        const pieceIn = bay.boardIn / pieces;
        const cones = chamber.drivers.flatMap((driver) => {
          const size = coneSize(driver);
          return size === undefined
            ? []
            : driverSpots(placed, driver).map((spot) => ({
                x: spot.xIn - placed.cx,
                y: spot.yIn - placed.y0,
                r: wooferCutoutR(size),
              }));
        });
        const local = { x: bay.x - placed.cx, y: bay.y - placed.y0 };
        for (let k = 0; k < pieces; k++) {
          const shape = new THREE.Shape([
            new THREE.Vector2(local.x, local.y),
            new THREE.Vector2(local.x + bay.w, local.y),
            new THREE.Vector2(local.x + bay.w, local.y + bay.h),
            new THREE.Vector2(local.x, local.y + bay.h),
          ]);
          for (const c of cones) shape.holes.push(circlePath(c.x, c.y, c.r));
          const piece = new THREE.Mesh(
            new THREE.ExtrudeGeometry(shape, {
              depth: pieceIn,
              bevelEnabled: false,
              curveSegments: 48,
            }),
            [ctx.materials.baffle, ctx.cutaway ? ctx.materials.baffle : ctx.materials.inner],
          );
          // this piece's two faces, back from the baffle's inside face; the extrusion runs from its position toward the front
          const faces = [
            bay.boardZ + toBack * k * pieceIn,
            bay.boardZ + toBack * (k + 1) * pieceIn,
          ];
          piece.position.z = innerZ - Math.max(...faces);
          piece.name = SPEAKER_MESH_NAMES.driverBoard;
          ctx.group.add(piece);
        }
        /** the throat's plane, back from the baffle's inside face, and the way the cones lie from it (back, or forward) */
        const throatZ = path.folds % 2 === 0 ? bay.z0 : bay.z1;
        const toCones = path.folds % 2 === 0 ? 1 : -1;
        for (const strip of bay.strips) {
          const board = new THREE.Mesh(
            new THREE.BoxGeometry(strip.w, strip.h, bay.stripIn),
            ctx.materials.shell,
          );
          board.name = SPEAKER_MESH_NAMES.hornThroat;
          board.position.set(
            strip.x + strip.w / 2 - placed.cx,
            strip.y + strip.h / 2 - placed.y0,
            innerZ - (throatZ + (toCones * bay.stripIn) / 2),
          );
          ctx.group.add(board);
        }
      }
    });
  }

  return { baffle, back, top, bottom, slotBand, build: (at) => builds.forEach((b) => b(at)) };
}

/**
 * A front-loaded or tapped horn's driver inside its chamber, in the cutaway: a body of its cone's cutout at (x, y), its
 * cone at `front` (the cones' plane behind the walls' back edges, z in the group) and its body behind it to `back`,
 * kept off the back panel.
 */
function addHornDriver(
  ctx: SceneContext,
  placed: PlacedChamber,
  driver: SpeakerDriver,
  { x, y }: { x: number; y: number },
  { front, back }: { front: number; back: number },
) {
  const size = coneSize(driver);
  if (!ctx.cutaway || size === undefined) return;
  const backZ = -placed.dims.d / 2 + ctx.wall;
  const r = wooferCutoutR(size);
  const depth = Math.abs(front - back);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, depth, 32), ctx.materials.black);
  body.rotation.x = Math.PI / 2; // its axis along z
  // a hair behind the cones' plane, so the cone's face doesn't fight the bay's sides
  body.position.set(
    x,
    y,
    Math.max(backZ + depth / 2, (front + back) / 2 + Math.sign(back - front) * HORN_DRIVER_GAP_IN),
  );
  body.name = SPEAKER_MESH_NAMES.hornDriver;
  ctx.group.add(body);
}
