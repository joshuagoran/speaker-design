// A speaker spec's build, chamber by chamber: its braces and ribs by the PA boxes' bracing rule, its hardware, its cut
// parts, the wood and the vent inside its air, its net air and its weight. Pure.
//
// - Bracing: every chamber of direct radiators is braced as its own box by the PA rule (lib/pa/calc braceShell: each
//   panel over PA_PANEL_TARGET_HZ, with the cabinet's style and back joint), its drivers, vent and hardware kept clear.
//   A chamber with a PA sub and a PA port in a frame cabinet runs the PA sub box's own rule (subBoxBracing), so the PA
//   designs match the PA page. A horn-loaded chamber takes none (the horn's walls hold its panels).
// - Hardware (`SpeakerCabinet.hardware`): the PA presets (lib/pa/hardware) in each shell's lowest chamber.
// - Net air: the chamber's clear volume less its drivers, the vent's air, the wood inside (the braces and ribs, the
//   vent's walls, a frame's baffle cleats round its clear face) and the hardware's recesses. No allowance: every part is
//   counted.
// - Cut parts: chambers that fill one box of one depth share one shell (`SHELL_CUT_BOX`) with partitions inside, and an
//   arched top where the views draw one on a frame; any other chamber is its own box, less the walls another chamber
//   gives it. A frame is the PA boxes' (lib/pa/calc boxParts), a flush box the Hi-fi box's (lib/hifi/cutlist
//   flushBoxPanels).
// - Weight: the PA's rule on a frame (its box weights: the 3/4″ baffle and the walls by their outside faces, the braces,
//   the fixings; a chamber over another adds what it builds, as the tower's cabinet over its sub box), the Hi-fi's on a
//   flush box; the drivers with their horns, the radiators and the hardware.
import type {
  PurchasedPart,
  BraceStyleId,
  BoxBracing,
  BoxHandles,
  BoxHardwarePlan,
  BoxRegion,
  ChamberCutBoxId,
  CornerJoint,
  CutBoxId,
  CutPart,
  Dims3,
  FacePoint,
  PlateHole,
  PortStyle,
  RadiatorPanel,
  SpeakerCabinet,
  SpeakerChamber,
  SpeakerDriver,
  SpeakerPort,
  SpeakerSlotPort,
  SubDriver,
  ThieleSmall,
  VentPanel,
  VentSpec,
} from "../../types";
import type { HardwareDriver } from "../pa/hardware";
import {
  BAFFLE_PLY_IN,
  MID_FIXINGS_LB,
  SUB_FIXINGS_LB,
  archStripIn,
  archedShellParts,
  boxParts,
  braceParts,
  braceShell,
  braceWoodIn3,
  coneKeepOut,
  cutoutNote,
  formatInches,
  hardwareCutNotes,
  hornCutoutWords,
  internalWoodLiters,
  isRoundPort,
  maxFoldedSlotIn,
  paConeBody,
  partitionNote,
  railsOnBack,
  subBoxBracing,
  subCutNote,
  subHardwarePlan,
  subKeepOut,
  subVentParts,
  type BraceInputs,
  type BraceShell,
  type ConeBody,
  type HardwareCutNotes,
} from "../pa/calc";
import { subTubeKit } from "../pa/tubes";
import { towerHornCutout } from "../pa/tower";
import { hardwareKeepOut, planBoxHardware } from "../pa/hardware";
import { DRIVER_CLEARANCE_IN, NO_SUPPORTS, type PaBoxSupports } from "../pa/bracing";
import { MIN_BAY_IN, braceShortfalls, defaultBraceStyleNear, panelStock } from "../bracing";
import { panelLbPerSqFt } from "../panel";
import {
  HIFI_FALLBACK_LB,
  HIFI_FIXINGS_LB,
  hifiPortElbows,
  radiatorsLb,
  slotMaxLength,
} from "../hifi/hifi";
import {
  aboveBaffleEdge,
  flushBoxPanels,
  joinNotes,
  offsetWords,
  radiatorCutoutNote,
  roundPortHoleNote,
  roundPortLine,
  roundoverNote,
  sizedCutout,
  slotOpeningNote,
  slotShelfPart,
  tweeterCutoutNote,
} from "../hifi/cutlist";
import {
  CD_OPTIONS,
  FILL_OPTIONS,
  HIFI_PASSIVES,
  MID_OPTIONS,
  SUB_OPTIONS,
  hifiDriverById,
} from "../data";
import { byId } from "../tables";
import { TOUCH_IN, baffleInsetIn, chamberVentModel, sharedWalls, slotRunIn } from "./chamberAir";
import { coneDepthIn, driverListing, sourceOf } from "./driverParts";
import { conesAreaCm2, frontChamber, throatCones } from "./hornThroat";
import { chamberSetbackIn, driverBoardPieces } from "./driverBoard";
import { segmentsAirLiters } from "../acoustics/hornSegments";
import {
  PORT_RULE,
  driverAcrossIn,
  driverHorn,
  driverSpots,
  driversOnBaffle,
  drawsArchedTop,
  hornFlare,
  onTop,
  portRule,
  radiatorsAt,
  roundPortsAt,
  slotOpeningsAt,
  speakerLayout,
  type PlacedChamber,
  type SpeakerLayout,
  hornFitsWhereSet,
  hornCutoutBox,
} from "./speakerLayout";
import { onPolyline } from "./hornFold";
import {
  DRIVER_CUTOUT_IN,
  HIFI_DRIVER_CUTOUT_IN,
  HIFI_MOTOR_CUTOUT_SHARE,
} from "../../data/catalog/driver-cutouts";
import { BACK_JOINT_FLUSH_NOTES, BACK_JOINT_RAIL_NOTES, NO_BRACING } from "../../constants/bracing";
import { HORN_MOUNT_NAMES } from "../../constants/hornMount";
import { CM2_PER_IN2, KG_PER_LB, LITERS_PER_CUBIC_IN } from "../../constants/units";
import { PANEL, SHELL_CUT_BOX, chamberCutBox, cutBoxName } from "../../constants/cutParts";
import { SPEAKER_TEXT, DRIVER_KIND_NAMES } from "../../constants/speakerPage";
import { HARDWARE_BOX } from "../../constants/hardware";
import {
  PURCHASED_PART,
  purchasedElbowName,
  purchasedPipeName,
  purchasedTubeName,
} from "../../constants/purchasedParts";
import {
  CABINET_CONSTRUCTION,
  CHAMBER_LOAD,
  DRIVER_KIND,
  HORN_DRIVE,
  PORT_SHAPE,
  SLOT_PLACE,
  VENT_KIND,
} from "../../constants/speakerSpec";

/** The least air the build gives a chamber, L (the Hi-fi box model's floor). */
export const MIN_NET_L = 1;
/** The joint the build cuts a chamber with to count the wood inside it (the joint doesn't move the inside). */
const COUNT_JOINT: CornerJoint = "butt";
/** in² to ft² */
const SQ_IN_PER_SQ_FT = 144;

/** A chamber's inside behind the baffle, in: its clear width and height, its depth, and a bottom slot's band. */
export interface ChamberInside {
  iw: number;
  ih: number;
  inD: number;
  band: number;
}

/** One chamber's build. */
export interface ChamberBuild {
  /** its rows' box in the cutlist */
  box: ChamberCutBoxId;
  /** its braces and ribs by rule (a horn-loaded chamber's round its flare) */
  bracing: BoxBracing;
  /** its hardware (a shell's lowest chamber, when the cabinet has some); null for none */
  hardware: BoxHardwarePlan | null;
  /** its PA sub and port with its box, where the PA sub box's rules apply (its duct-fit check reads them); else null */
  paSub: (PaSub & { box: Dims3 }) | null;
  inside: ChamberInside;
  /** its clear volume, the vent's air in it, the horn's own air, the wood inside it and the hardware's recesses, L */
  clearL: number;
  ventL: number;
  /** the air of the horn built into it, its flare and its front chamber; 0 for a direct chamber */
  hornL: number;
  woodL: number;
  recessL: number;
  /** what it weighs, lb: its wood (panels and braces) with the fixings, its drivers and radiators, its hardware */
  lb: { wood: number; drivers: number; hardware: number; total: number };
}

/** A cabinet's build: each chamber's, in the cabinet's order, and the whole speaker's weight, lb. */
export interface CabinetBuild {
  chambers: ChamberBuild[];
  lb: number;
}

/** A chamber as the build places it: its index and place, its box as the PA rules take it, its inside. */
interface ChamberFrame {
  index: number;
  placed: PlacedChamber;
  /** its outside as its own box, with a wall added where another chamber gives it one (so the inside is its clear face) */
  box: Dims3;
  inside: ChamberInside;
  /** the walls other chambers give it */
  shared: { below: boolean; left: boolean };
  /** its PA sub and port, where the PA sub box's rules apply */
  paSub: PaSub | null;
}

/** Whether a cabinet is a frame (the PA's, its baffle set back on cleats) rather than a flush box (the Hi-fi's). */
const isFrame = (cabinet: Pick<SpeakerCabinet, "construction">) =>
  cabinet.construction === CABINET_CONSTRUCTION.frameInset;

/** The baffle's thickness, in: a frame's 3/4″, a flush box's walls'. */
const baffleIn = (cabinet: SpeakerCabinet) =>
  isFrame(cabinet) ? BAFFLE_PLY_IN : cabinet.panel.thicknessIn;

/** A PA sub chamber: its sub and its port as the PA's rules take them (its style and vent sizes). */
export interface PaSub {
  sub: SubDriver;
  style: PortStyle;
  vent: VentSpec;
}

/** A PA port's sizes as the PA's rules take them (VentSpec): the sizes its style doesn't read stay 0. */
function paVentOf(port: SpeakerPort): VentSpec {
  const none: VentSpec = { slotH: 0, nt: 0, dia: 0, throat: 0, len: port.len };
  switch (port.shape) {
    case PORT_SHAPE.duct:
      return { ...none, throat: port.throat, div: port.div };
    case PORT_SHAPE.slot:
      return { ...none, slotH: port.h, fins: port.fins };
    default:
      return { ...none, nt: port.n, dia: port.dia };
  }
}

/**
 * The chamber's PA sub and port, where the PA sub box's rules apply: a frame cabinet, a direct chamber with a catalog
 * sub, and a PA port (side ducts, the letterbox or flared tubes: speakerLayout `portRule`). Null otherwise.
 */
function paSubOf(cabinet: SpeakerCabinet, chamber: SpeakerChamber): PaSub | null {
  if (!isFrame(cabinet) || chamber.load.kind !== CHAMBER_LOAD.direct) return null;
  const rule = portRule(chamber);
  const entry = chamber.drivers.find((d) => d.kind === DRIVER_KIND.sub);
  const sub = entry ? byId(SUB_OPTIONS, entry.driverId) : undefined;
  if (rule?.rule !== PORT_RULE.pa || !sub || chamber.vent.kind !== VENT_KIND.vented) return null;
  return { sub, style: rule.portStyle, vent: paVentOf(chamber.vent.port) };
}

/** The chambers placed, each with its box, inside and PA sub. */
function chamberFrames(cabinet: SpeakerCabinet, layout: SpeakerLayout): ChamberFrame[] {
  const t = cabinet.panel.thicknessIn;
  return layout.chambers.map((placed, index) => {
    const { chamber } = placed;
    const shared = sharedWalls(cabinet, chamber);
    const paSub = paSubOf(cabinet, chamber);
    return {
      index,
      placed,
      box: {
        w: chamber.dims.w + (shared.left ? t : 0),
        h: chamber.dims.h + (shared.below ? t : 0),
        d: chamber.dims.d,
      },
      inside: {
        iw: placed.clear.w,
        ih: placed.clear.h,
        inD: isFrame(cabinet)
          ? chamber.dims.d - baffleInsetIn(cabinet) - BAFFLE_PLY_IN - t
          : chamber.dims.d - 2 * t,
        band: paSub?.style === "slots" ? paSub.vent.slotH + t : 0,
      },
      shared,
      paSub,
    };
  });
}

/** A cone's body, depth, weight and figures as the bracing and the hardware read them. */
interface ConeBuild {
  body: ConeBody;
  depthIn: number;
  lb: number;
  ts: Pick<ThieleSmall, "Sd" | "Xmax" | "disp">;
}

/** A cone driver's body (its catalog's, or the Hi-fi estimates where the catalog has none); null for another kind. */
function coneBuild(driver: SpeakerDriver): ConeBuild | null {
  /** its depth behind the baffle's front: the catalog's, or the fallback for its kind and size */
  const depthIn = coneDepthIn(driver) ?? 0;
  const hifiCone = (size: number, lb: number, ts: ConeBuild["ts"]): ConeBuild => {
    const cutoutIn = HIFI_DRIVER_CUTOUT_IN[size] ?? driverAcrossIn(driver);
    return {
      body: { cutoutIn, motorIn: cutoutIn * HIFI_MOTOR_CUTOUT_SHARE },
      depthIn,
      lb,
      ts,
    };
  };
  switch (driver.kind) {
    case DRIVER_KIND.sub: {
      const sub = byId(SUB_OPTIONS, driver.driverId);
      return sub ? { body: paConeBody(sub.size), depthIn, lb: sub.lb, ts: sub.ts } : null;
    }
    case DRIVER_KIND.mid: {
      const mid = byId(MID_OPTIONS, driver.driverId);
      return mid
        ? {
            body: paConeBody(mid.size),
            depthIn,
            lb: mid.lb || 0,
            ts: mid.ts,
          }
        : null;
    }
    case DRIVER_KIND.woofer: {
      const woofer = hifiDriverById("woofer", driver.driverId);
      return woofer ? hifiCone(woofer.size, woofer.lb || HIFI_FALLBACK_LB.woofer, woofer.ts) : null;
    }
    case DRIVER_KIND.coaxial: {
      const coax = byId(FILL_OPTIONS, driver.driverId);
      return coax ? hifiCone(coax.size, coax.lb || HIFI_FALLBACK_LB.woofer, coax.ts) : null;
    }
    case DRIVER_KIND.compression:
    case DRIVER_KIND.tweeter:
      return null;
  }
}

/** One driver's weight, lb: its catalog weight (the Hi-fi fallbacks where a Hi-fi part lists none) and its horn's. */
function driverLb(driver: SpeakerDriver): number {
  const hornLb = driverHorn(driver)?.lb || 0;
  switch (driver.kind) {
    case DRIVER_KIND.sub:
      return (byId(SUB_OPTIONS, driver.driverId)?.lb || 0) + hornLb;
    case DRIVER_KIND.mid:
      return (byId(MID_OPTIONS, driver.driverId)?.lb || 0) + hornLb;
    case DRIVER_KIND.compression:
      return (byId(CD_OPTIONS, driver.driverId)?.lb || 0) + hornLb;
    case DRIVER_KIND.woofer:
      return (hifiDriverById("woofer", driver.driverId)?.lb || HIFI_FALLBACK_LB.woofer) + hornLb;
    case DRIVER_KIND.tweeter:
      return (hifiDriverById("tweeter", driver.driverId)?.lb || HIFI_FALLBACK_LB.tweeter) + hornLb;
    case DRIVER_KIND.coaxial:
      return (byId(FILL_OPTIONS, driver.driverId)?.lb || HIFI_FALLBACK_LB.woofer) + hornLb;
  }
}

/**
 * A datasheet driver's room behind the baffle's front (a compression driver or a tweeter, with its horn where it drives
 * one), across and deep, in: the horn's mouth, and its body with the driver's behind it; without a horn, the driver's
 * body or a tweeter's plate (its depth taken as the plate's width).
 */
function datasheetRoom(driver: SpeakerDriver): Dims3 | null {
  const horn = driverHorn(driver);
  const body =
    driver.kind === DRIVER_KIND.compression ? byId(CD_OPTIONS, driver.driverId)?.body : undefined;
  if (horn) return { w: horn.size.w, h: horn.size.h, d: horn.size.d + (body?.depth ?? 0) };
  if (body) return { w: body.dia, h: body.dia, d: body.depth };
  if (driver.kind !== DRIVER_KIND.tweeter) return null;
  const tweeter = hifiDriverById("tweeter", driver.driverId);
  const plate = tweeter && (tweeter.ownGuide ?? tweeter.faceplate);
  return plate ? { w: plate.w, h: plate.h, d: plate.w } : null;
}

/** A front-view point as the chamber's inside takes it: in from its inside corner, above a slot's band. */
const insidePoint = (f: ChamberFrame, p: FacePoint) => ({
  x: p.xIn - f.placed.clear.x,
  y: p.yIn - f.placed.clear.y - f.inside.band,
});

/** A box `w` × `h` round `c` in the inside, from `z0` to `z1` back from the baffle, with the drivers' clearance. */
const roomAround = (
  c: { x: number; y: number },
  w: number,
  h: number,
  z0: number,
  z1: number,
): BoxRegion => ({
  x: [c.x - w / 2 - DRIVER_CLEARANCE_IN, c.x + w / 2 + DRIVER_CLEARANCE_IN],
  y: [c.y - h / 2 - DRIVER_CLEARANCE_IN, c.y + h / 2 + DRIVER_CLEARANCE_IN],
  z: [z0, z1],
});

/**
 * What the bracing reads of a chamber's drivers: each one's room behind the baffle (a cone's basket and motor, a horn
 * or a tweeter's body), the largest cone's cutout as the baffle's hole with its weight on its edge, the cones' figures
 * for the pressure check (their areas and displacements add), and the heaviest cone for the hardware's center of
 * gravity. Drivers off the baffle (a horn on the top, a horn's drivers inside) take none.
 */
function chamberDrivers(f: ChamberFrame, baffleT: number) {
  const { placed } = f;
  const regions: BoxRegion[] = [];
  let hole: PlateHole | undefined;
  let heaviest: HardwareDriver | null = null;
  let ts: ConeBuild["ts"] | undefined;
  /** off the baffle (a horn's drivers at its throat): their figures for the pressure check, no room or hole there */
  const onBaffle = driversOnBaffle(placed.chamber);
  for (const driver of placed.chamber.drivers) {
    if (onTop(driver)) continue;
    const cone = coneBuild(driver);
    if (cone) {
      const disp = (cone.ts.disp ?? 0) * driver.count;
      ts = {
        Sd: (ts?.Sd ?? 0) + cone.ts.Sd * driver.count,
        Xmax: ts ? Math.min(ts.Xmax, cone.ts.Xmax) : cone.ts.Xmax,
        disp: (ts?.disp ?? 0) + disp,
      };
    }
    if (!onBaffle) continue;
    const room = cone ? null : datasheetRoom(driver);
    for (const spot of driverSpots(placed, driver)) {
      const c = insidePoint(f, spot);
      if (cone) {
        regions.push(...coneKeepOut(c, cone.body, cone.depthIn));
        const r = cone.body.cutoutIn / 2;
        if (!hole || r > hole.r) hole = { cx: c.x, cy: c.y, r, ringKg: cone.lb * KG_PER_LB };
        if (!heaviest || cone.lb > heaviest.lb)
          heaviest = { center: c, lb: cone.lb, depthIn: cone.depthIn };
      } else if (room) regions.push(roomAround(c, room.w, room.h, 0, room.d - baffleT));
    }
  }
  return { regions, hole, ts, heaviest };
}

/** Whether a radiator's panel is one a vent can take (the baffle or the back), not a side. */
const isVentPanel = (panel: RadiatorPanel): panel is VentPanel => panel !== PANEL.side;

/** How far a passive radiator takes room behind its panel, in: its travel both ways and an inch of frame. */
const radiatorRoomIn = (xmaxMm: number) => 1 + (2 * xmaxMm) / 25.4;

/**
 * The room the chamber's vent takes, which no brace or rib may enter: a PA port's parts and air as the PA sub box
 * keeps them clear (subKeepOut, with the port rule's sub), a Hi-fi slot along the floor as far back as it runs, each
 * Hi-fi tube's run back from its panel, and each radiator's travel behind its panel.
 */
function ventRegions(cabinet: SpeakerCabinet, f: ChamberFrame): BoxRegion[] {
  const { chamber } = f.placed;
  const { iw, inD } = f.inside;
  const t = cabinet.panel.thicknessIn;
  const fromPanel = (panel: VentPanel, depth: number): readonly [number, number] =>
    panel === PANEL.back ? [Math.max(0, inD - depth), inD] : [0, Math.min(inD, depth)];
  if (chamber.vent.kind === VENT_KIND.radiator) {
    const drv = byId(HIFI_PASSIVES, chamber.vent.radiators.id);
    if (!drv) return [];
    const depth = radiatorRoomIn(drv.Xmax);
    // each radiator on the baffle or the back (one on a side takes no room a rib on the baffle or back could need)
    return radiatorsAt(cabinet, f.placed).spots.flatMap((s) => {
      const { panel } = s;
      if (!isVentPanel(panel)) return [];
      const c = insidePoint(f, { xIn: f.placed.cx + s.x, yIn: f.placed.y0 + s.y });
      return [roomAround(c, s.shape.w, s.shape.h, ...fromPanel(panel, depth))];
    });
  }
  const rule = portRule(chamber);
  if (!rule || chamber.vent.kind !== VENT_KIND.vented) return [];
  if (rule.rule === PORT_RULE.pa) {
    const vent = paVentOf(chamber.vent.port);
    return [...subKeepOut(f.box, t, baffleInsetIn(cabinet), rule.portStyle, vent, rule.sub).vent];
  }
  const { port } = rule;
  if (port.shape === PORT_SHAPE.slot) {
    const z: readonly [number, number] = [0, Math.min(inD, port.len)];
    // the slots up the front sides, each against its wall
    if (port.place === SLOT_PLACE.sides)
      return slotOpeningsAt(f.placed, port, t).map((o) => {
        const c = insidePoint(f, { xIn: f.placed.cx + o.x, yIn: f.placed.y0 + o.y + o.h / 2 });
        return { x: [c.x - o.w / 2, c.x + o.w / 2], y: [c.y - o.h / 2, c.y + o.h / 2], z };
      });
    // the slots stacked along the floor, each under its shelf
    return [{ x: [0, iw], y: [0, port.n * (port.h + t)], z }];
  }
  const tubes = roundPortsAt(f.placed, port);
  return tubes.spots.map((s) => {
    const c = insidePoint(f, { xIn: f.placed.cx + s.x, yIn: f.placed.y0 + s.y });
    return roomAround(c, 2 * s.r, 2 * s.r, ...fromPanel(tubes.panel, port.len));
  });
}

/**
 * The room a horn built into the chamber takes, which no brace or rib may enter: its flare from the mouth on the baffle
 * back along its path (lib/speaker/hornGeometry, as the views draw it: its legs, turns and the drivers' bay), each box as
 * large as the two sections it spans, then the drivers at the throat, a cone's depth further where the cone is deeper than
 * the bay. The rear chamber's walls round it are braced; the flare's own walls hold themselves. None for a chamber without
 * a horn.
 */
/**
 * Where a horn's flare leaves each panel it runs along from the mouth (its keep-out reaches the panel there), back from
 * the baffle: its wall, glued to the panel, holds the panel in a line across it there (PaBoxSupports `flareZ`). A flare
 * that never meets a panel, or meets it to the back, gives that panel no line.
 */
function flareLines(f: ChamberFrame, regions: readonly BoxRegion[]): PaBoxSupports["flareZ"] {
  const { iw, ih, inD } = f.inside;
  /** the front run of regions that reach a panel, and where it ends */
  const leaves = (reaches: (r: BoxRegion) => boolean): number[] => {
    let z = 0;
    for (const r of regions) {
      if (!reaches(r) || r.z[0] > z + 1e-9) break;
      z = r.z[1];
    }
    return z > 1e-9 && z < inD - MIN_BAY_IN ? [z] : [];
  };
  // the flare's own edge: its room less the drivers' clearance round it
  const c = DRIVER_CLEARANCE_IN;
  return {
    sideL: leaves((r) => r.x[0] + c <= 1e-9),
    sideR: leaves((r) => r.x[1] - c >= iw - 1e-9),
    bottom: leaves((r) => r.y[0] + c <= 1e-9),
    top: leaves((r) => r.y[1] - c >= ih - 1e-9),
  };
}

function flareRegions(cabinet: SpeakerCabinet, f: ChamberFrame): BoxRegion[] {
  const flare = hornFlare(cabinet, f.placed);
  if (!flare) return [];
  const { path } = flare;
  const { inD } = f.inside;
  const out: BoxRegion[] = [];
  /** a box round two rectangles' union, from `za` to `zb` back from the baffle (either way round), kept inside the chamber */
  const room = (
    a: { cx: number; cy: number; w: number; h: number },
    b: { cx: number; cy: number; w: number; h: number },
    za: number,
    zb: number,
  ) => {
    const [z0, z1] = [Math.min(za, zb), Math.min(inD, Math.max(za, zb))];
    if (z0 >= inD) return;
    const x0 = Math.min(a.cx - a.w / 2, b.cx - b.w / 2),
      x1 = Math.max(a.cx + a.w / 2, b.cx + b.w / 2),
      y0 = Math.min(a.cy - a.h / 2, b.cy - b.h / 2),
      y1 = Math.max(a.cy + a.h / 2, b.cy + b.h / 2);
    const c = insidePoint(f, { xIn: (x0 + x1) / 2, yIn: (y0 + y1) / 2 });
    out.push(roomAround(c, x1 - x0, y1 - y0, z0, z1));
  };
  // a folded path laid out in runs: each run's duct as its box, from its nearest to its farthest point
  if (flare.fold) {
    const { fold } = flare;
    for (const run of fold.runs) {
      const pts = [...run.left, ...run.right];
      const ys = pts.map((p) => p.y),
        zs = pts.map((p) => p.z);
      const rect = {
        cx: fold.cx,
        cy: (Math.min(...ys) + Math.max(...ys)) / 2,
        w: fold.widthIn,
        h: Math.max(...ys) - Math.min(...ys),
      };
      room(rect, rect, Math.max(0, Math.min(...zs)), Math.max(...zs));
    }
    return out.sort((x, y) => x.z[0] - y.z[0]);
  }
  // each leg from section to section (each box as large as both ends), then each turn
  for (const leg of path.legs)
    leg.sections.forEach((sec, i) => {
      const next = leg.sections[i + 1];
      if (next) room(sec, next, sec.z, next.z);
    });
  for (const t of path.turns) {
    const rect = { cx: t.cx, cy: (t.y0 + t.y1) / 2, w: t.w, h: t.y1 - t.y0 };
    room(rect, rect, t.z0, t.z1);
  }
  // the drivers at the throat: their bay (the front chamber), and each body behind its cone's face, as large as
  // the bay or the cone, whichever is larger
  const { bay } = path;
  if (bay) {
    const cones = f.placed.chamber.drivers.flatMap((d) => coneBuild(d) ?? []);
    const coneIn = Math.max(0, ...cones.map((k) => k.depthIn));
    const coneW = Math.max(0, ...cones.map((k) => k.body.cutoutIn));
    const rect = { cx: bay.x + bay.w / 2, cy: bay.y + bay.h / 2, w: bay.w, h: bay.h };
    const deep = {
      ...rect,
      w: Math.max(rect.w, coneW),
      h: Math.max(rect.h, coneW),
    };
    /** the bodies run behind the cones' faces: back along z on an even path, toward the baffle on an odd one */
    const way = path.folds % 2 === 0 ? 1 : -1;
    // the front chamber
    room(rect, rect, bay.z0, bay.z1);
    // the driver board behind it, then the deepest driver from its cone's face
    if (bay.boardIn > 0 && bay.coneZ !== bay.boardZ) room(rect, rect, bay.boardZ, bay.coneZ);
    if (coneIn > 0) room(deep, deep, bay.coneZ, bay.coneZ + way * coneIn);
  }
  // the flare's lines are read from the mouth back
  return out.sort((x, y) => x.z[0] - y.z[0]);
}

/** The bracing rule's results on general chambers, by their inputs (the page asks again on every change). */
const BRACE_MEMO = new Map<string, BoxBracing>();
const BRACE_MEMO_MAX = 2000;
/** The bracing rule on a shell and its inputs, remembered. */
function bracedShell(shell: BraceShell, inputs: BraceInputs): BoxBracing {
  const key = JSON.stringify([shell, inputs]);
  const hit = BRACE_MEMO.get(key);
  if (hit) return hit;
  if (BRACE_MEMO.size >= BRACE_MEMO_MAX) BRACE_MEMO.clear();
  const b = braceShell(shell, inputs);
  BRACE_MEMO.set(key, b);
  return b;
}

/**
 * A chamber's braces and ribs and its hardware. The hardware is placed first (the handles at the center of gravity,
 * the dish low on the back, the horn's posts on a top with a horn on it), then the braces round its recesses, then the
 * hardware checked against them, as the PA boxes do. A cabinet with no bracing (`NO_BRACING`) takes none: its panels'
 * modes are the bare shell's, held against its target.
 */
function chamberBracing(
  cabinet: SpeakerCabinet,
  f: ChamberFrame,
  handles: BoxHandles | null,
): Pick<ChamberBuild, "bracing" | "hardware"> {
  if (cabinet.braceStyle !== NO_BRACING)
    return chamberBracingAs(cabinet, cabinet.braceStyle, cabinet.braceTargetHz, f, handles);
  // the rule to no target adds nothing (and anything a strength check adds is taken off): the bare shell
  const t = cabinet.panel.thicknessIn;
  const bare = chamberBracingAs(cabinet, defaultBraceStyleNear(t), 0, f, handles);
  const bracing: BoxBracing = {
    ...bare.bracing,
    windows: { x: [], y: [], z: [] },
    notch: null,
    ribs: [],
    windowIn3: 0,
    ribIn3: 0,
    targetHz: cabinet.braceTargetHz,
  };
  bracing.meets = braceShortfalls(bracing).length === 0;
  return { bracing, hardware: bare.hardware };
}

/** A chamber's braces and ribs in `style` to `targetHz`, and its hardware (`chamberBracing`). */
function chamberBracingAs(
  cabinet: SpeakerCabinet,
  style: BraceStyleId,
  targetHz: number,
  f: ChamberFrame,
  handles: BoxHandles | null,
): Pick<ChamberBuild, "bracing" | "hardware"> {
  const t = cabinet.panel.thicknessIn;
  const inset = baffleInsetIn(cabinet);
  const { backJoint: back } = cabinet;
  const { chamber } = f.placed;
  if (f.paSub) {
    const { sub, style: portStyle, vent } = f.paSub;
    return {
      bracing: subBoxBracing(
        f.box,
        t,
        inset,
        portStyle,
        vent,
        sub,
        style,
        handles ?? undefined,
        back,
        targetHz,
      ),
      hardware: handles
        ? subHardwarePlan(f.box, t, inset, portStyle, vent, sub, style, handles, back, targetHz)
        : null,
    };
  }
  const drivers = chamberDrivers(f, baffleIn(cabinet));
  const flare = flareRegions(cabinet, f);
  /** a horn's flare walls, where they leave the panels, hold them in a line */
  const flareSupports: PaBoxSupports = { ...NO_SUPPORTS, flareZ: flareLines(f, flare) };
  const keepOut = {
    driver: [...drivers.regions, ...flare],
    vent: ventRegions(cabinet, f),
  };
  const plan = (bracing: BoxBracing | null) =>
    handles &&
    planBoxHardware({
      box: chamber.drivers.some((d) => onTop(d) && hornFitsWhereSet(f.placed, d))
        ? HARDWARE_BOX.mid
        : HARDWARE_BOX.sub,
      dims: f.box,
      t,
      inset,
      handles,
      driver: drivers.heaviest ?? {
        center: { x: f.inside.iw / 2, y: f.inside.ih / 2 },
        lb: 0,
        depthIn: 0,
      },
      bracing,
      keepOut,
    });
  const placed = plan(null);
  const wall = panelStock(t, cabinet.panel.material);
  const bracing = bracedShell(
    {
      inside: f.inside,
      wall,
      baffle: isFrame(cabinet) ? panelStock(BAFFLE_PLY_IN, cabinet.panel.material) : wall,
    },
    {
      sup: flareSupports,
      stops: flareSupports,
      keepOut: { ...keepOut, hardware: placed ? hardwareKeepOut(placed) : [] },
      style,
      back,
      targetHz,
      ...(drivers.hole ? { hole: drivers.hole } : {}),
      ts: drivers.ts,
    },
  );
  return { bracing, hardware: plan(bracing) };
}

/** Whether two chambers touch: one stands on the other, or right beside it, along part of the edge. */
function touching(a: SpeakerChamber, b: SpeakerChamber): boolean {
  const overlap = (a0: number, a1: number, b0: number, b1: number) => a0 < b1 && b0 < a1;
  const onTopOf = (lo: SpeakerChamber, hi: SpeakerChamber) =>
    Math.abs(lo.at.yIn + lo.dims.h - hi.at.yIn) < TOUCH_IN &&
    overlap(lo.at.xIn, lo.at.xIn + lo.dims.w, hi.at.xIn, hi.at.xIn + hi.dims.w);
  const rightOf = (l: SpeakerChamber, r: SpeakerChamber) =>
    Math.abs(l.at.xIn + l.dims.w - r.at.xIn) < TOUCH_IN &&
    overlap(l.at.yIn, l.at.yIn + l.dims.h, r.at.yIn, r.at.yIn + r.dims.h);
  return onTopOf(a, b) || onTopOf(b, a) || rightOf(a, b) || rightOf(b, a);
}

/** Each chamber's shell's lowest (then leftmost) chamber: chambers that touch form one shell. */
function shellBases(chambers: readonly SpeakerChamber[]): number[] {
  const group = chambers.map((_, i) => i);
  const find = (i: number): number => (group[i] === i ? i : (group[i] = find(group[i])));
  chambers.forEach((a, i) =>
    chambers.forEach((b, j) => {
      if (j > i && touching(a, b)) group[find(j)] = find(i);
    }),
  );
  const lowest = (i: number, j: number) => {
    const a = chambers[i].at,
      b = chambers[j].at;
    return a.yIn < b.yIn - TOUCH_IN || (Math.abs(a.yIn - b.yIn) < TOUCH_IN && a.xIn < b.xIn)
      ? i
      : j;
  };
  const base = new Map<number, number>();
  chambers.forEach((_, i) => {
    const g = find(i);
    const seen = base.get(g);
    base.set(g, seen === undefined ? i : lowest(seen, i));
  });
  return chambers.map((_, i) => base.get(find(i)) ?? i);
}

/**
 * Whether the cutlist and the weights take the cabinet's top arched: an arched top the views draw (`drawsArchedTop`) on
 * a frame (the flush box draws and cuts it flat, as the 3D view does).
 */
export const cutsArchedTop = (cabinet: SpeakerCabinet, layout: SpeakerLayout) =>
  isFrame(cabinet) && drawsArchedTop(cabinet, layout);

/** A cutout's area on the baffle for each of the chamber's drivers on it, in²: a cone's cutout, a horn's, a plate's. */
function cutoutsIn2(cabinet: SpeakerCabinet, placed: PlacedChamber): number {
  if (!driversOnBaffle(placed.chamber)) return 0;
  return placed.chamber.drivers.reduce((sum, driver) => {
    if (onTop(driver)) return sum;
    const cone = coneBuild(driver);
    const horn = driverHorn(driver);
    // a cone's round cutout; a compression driver's horn as the tower cuts it; a tweeter's waveguide or plate by its
    // own size (the cutlist's note)
    const one = cone
      ? (Math.PI / 4) * cone.body.cutoutIn ** 2
      : horn && driver.kind === DRIVER_KIND.compression
        ? towerHornCutout(
            hornCutoutBox(placed, cabinet.panel.thicknessIn),
            cabinet.panel.thicknessIn,
            horn,
          ).area
        : ((room) => (room ? room.w * room.h : 0))(datasheetRoom(driver));
    return sum + driver.count * one;
  }, 0);
}

/**
 * The chamber's panels' and braces' weight with its fixings, lb. A shell's lowest chamber weighs as a box of its own
 * (its six outside faces, as the PA weighs its sub and mid boxes and the Hi-fi its box); each chamber over or beside it
 * adds what it builds: its baffle less its drivers' cutouts and its back, its outside walls by their outside faces, and
 * the partitions it builds at their inside size (the tower's cabinet over its sub box). The top chamber of an arched
 * top takes the arch: its faces to the springline and the half disc, its sides to the springline, the bent strip.
 */
function woodLb(
  cabinet: SpeakerCabinet,
  layout: SpeakerLayout,
  f: ChamberFrame,
  isBase: boolean,
  bracing: BoxBracing | null,
): number {
  const { placed, shared, inside } = f;
  const { w, h, d } = placed.dims;
  const t = cabinet.panel.thicknessIn;
  const wallRate = panelLbPerSqFt(t, cabinet.panel.material);
  const baffleRate = isFrame(cabinet)
    ? panelLbPerSqFt(BAFFLE_PLY_IN, cabinet.panel.material)
    : wallRate;
  const arched =
    cutsArchedTop(cabinet, layout) && Math.abs(placed.y0 + h - layout.size.h) < TOUCH_IN;
  const R = layout.size.w / 2;
  const face = arched ? w * (h - R) + (Math.PI / 2) * R * R : w * h;
  const sideH = arched ? h - R : h;
  const top = arched ? archStripIn(w, t) * d : w * d;
  /** the partitions it builds: its top wall under a chamber, its right wall beside one */
  const above = placed.walls.some((p) => p.shared && p.w >= p.h);
  const right = placed.walls.some((p) => p.shared && p.w < p.h);
  const panels = isBase
    ? face * baffleRate + (face + top + w * d + 2 * sideH * d) * wallRate
    : (face - cutoutsIn2(cabinet, placed)) * baffleRate +
      (face +
        (above ? inside.iw * inside.inD : top) +
        (shared.below ? 0 : w * d) +
        (shared.left ? 0 : sideH * d) +
        (right ? inside.ih * inside.inD : sideH * d)) *
        wallRate;
  const braces = (braceWoodIn3(bracing) * wallRate) / SQ_IN_PER_SQ_FT / t;
  const board = driverBoardOf(cabinet, f);
  /** the driver board's panels, in², of the walls' plywood */
  const boardIn2 = board ? board.netIn2 * board.pieces : 0;
  const cones = placed.chamber.drivers.filter((dr) => coneBuild(dr) !== null);
  const fixings = isFrame(cabinet)
    ? placed.chamber.drivers.some((dr) => dr.kind === DRIVER_KIND.sub)
      ? SUB_FIXINGS_LB
      : cones.length
        ? MID_FIXINGS_LB
        : 0
    : isBase
      ? HIFI_FIXINGS_LB
      : 0;
  return (
    (panels + (boardIn2 + hornBoardsIn2(cabinet, f)) * wallRate) / SQ_IN_PER_SQ_FT +
    braces +
    fixings
  );
}

/** The chamber's radiators' weight, lb (none for another vent, or a radiator the catalog doesn't have). */
function chamberRadiatorsLb(chamber: SpeakerChamber): number {
  if (chamber.vent.kind !== VENT_KIND.radiator) return 0;
  const drv = byId(HIFI_PASSIVES, chamber.vent.radiators.id);
  return drv ? radiatorsLb({ ...chamber.vent.radiators, drv }) : 0;
}

/** The chamber's wood inside its air, L: its braces and ribs, its vent's walls, a frame's baffle cleats round its face. */
function insideWoodL(cabinet: SpeakerCabinet, f: ChamberFrame, bracing: BoxBracing | null) {
  return internalWoodLiters(
    [...countShell(cabinet, f, bracing), ...ventParts(cabinet, f).parts],
    chamberCutBox(f.index),
  );
}

/** The chamber cut as its own box for counting the wood inside it: a frame's cleats and braces, a flush box's braces. */
function countShell(cabinet: SpeakerCabinet, f: ChamberFrame, bracing: BoxBracing | null) {
  const box = chamberCutBox(f.index);
  const t = cabinet.panel.thicknessIn;
  if (isFrame(cabinet))
    return boxParts(box, f.box.w, f.box.h, f.box.d, t, baffleInsetIn(cabinet), COUNT_JOINT, {
      band: f.inside.band,
      bracing,
    }).P;
  return bracing ? braceParts(box, bracing, insideAxes(f), t) : [];
}

/** The chamber's inside on the bracing's axes. */
const insideAxes = (f: ChamberFrame) => ({ x: f.inside.iw, y: f.inside.ih, z: f.inside.inD });

/** Whether a Hi-fi rule slot fits its chamber: a folded slot up the back (the PA slot's fold), a straight one along the floor. */
const hifiSlotFits = (dims: Dims3, port: SpeakerSlotPort, t: number) =>
  port.folded
    ? port.len <= maxFoldedSlotIn(dims, port.h, t)
    : port.len <= slotMaxLength(dims, t, port);

/**
 * Whether a chamber's vent fits it by the Hi-fi rule (lib/speaker/speakerLayout `portRule`): a slot by its length, round
 * tubes by the elbows they need (lib/hifi hifiPortElbows). A PA port's fit is its fit chips' (lib/speaker/fitChips), so
 * it, and a chamber with no vent, count as fitting here.
 */
export function hifiVentFits(
  cabinet: Pick<SpeakerCabinet, "panel">,
  chamber: SpeakerChamber,
): boolean {
  const rule = portRule(chamber);
  if (!rule || rule.rule === PORT_RULE.pa) return true;
  const t = cabinet.panel.thicknessIn;
  const { port } = rule;
  return port.shape === PORT_SHAPE.slot
    ? hifiSlotFits(chamber.dims, port, t)
    : hifiPortElbows(chamber.dims, t, port) !== null;
}

/**
 * The chamber's vent as cutlist rows and bought parts: a PA port's parts (a slot's shelf and fins, side ducts' walls and
 * dividers; flared tubes bought, with their stock pipe: lib/pa/calc subVentParts), a Hi-fi slot's shelf, a Hi-fi
 * round port's tubes bought.
 */
function ventParts(cabinet: SpeakerCabinet, f: ChamberFrame): { parts: CutPart[]; vent: string[] } {
  const { chamber } = f.placed;
  const rule = portRule(chamber);
  if (!rule || chamber.vent.kind !== VENT_KIND.vented) return { parts: [], vent: [] };
  const box = chamberCutBox(f.index);
  const t = cabinet.panel.thicknessIn;
  if (rule.rule === PORT_RULE.pa) {
    const vent = paVentOf(chamber.vent.port);
    const kit = isRoundPort(rule.portStyle)
      ? subTubeKit(f.box, rule.portStyle, vent, t, baffleInsetIn(cabinet), rule.sub)
      : null;
    return subVentParts(box, f.box, t, rule.portStyle, vent, kit);
  }
  const { port } = rule;
  if (port.shape === PORT_SHAPE.slot) {
    const fits = hifiSlotFits(chamber.dims, port, t);
    const tooLong = fits
      ? null
      : port.folded
        ? SPEAKER_TEXT.slotTooLongFolded
        : SPEAKER_TEXT.slotTooLong;
    // the slot runs the whole clear face (`slotRunIn`)
    const shelf = slotShelfPart(
      box,
      { ...port, w: slotRunIn({ w: f.inside.iw, h: f.inside.ih }, port) },
      t,
      tooLong,
    );
    return {
      // slots up the sides: the same plate, a wall of each slot instead of a roof
      parts: [
        port.place === SLOT_PLACE.sides
          ? {
              ...shelf,
              note: joinNotes([SPEAKER_TEXT.sideSlotWalls(port.n, formatInches(port.h)), tooLong]),
            }
          : shelf,
      ],
      vent: [],
    };
  }
  return {
    parts: [],
    vent: [roundPortLine(port, hifiPortElbows(chamber.dims, t, port), SPEAKER_TEXT.portTooLong)],
  };
}

/** The build of each cabinet the page asked for (a spec's cabinet doesn't change in place). */
const BUILDS = new WeakMap<SpeakerCabinet, CabinetBuild>();

/** The cabinet's build: each chamber's bracing, hardware, inside air and weight, and the whole speaker's weight. */
export function cabinetBuild(cabinet: SpeakerCabinet): CabinetBuild {
  const hit = BUILDS.get(cabinet);
  if (hit) return hit;
  const layout = speakerLayout(cabinet);
  const frames = chamberFrames(cabinet, layout);
  const bases = shellBases(cabinet.chambers);
  const chambers = frames.map((f): ChamberBuild => {
    const isBase = bases[f.index] === f.index;
    const { bracing, hardware } = chamberBracing(cabinet, f, isBase ? cabinet.hardware : null);
    const { chamber } = f.placed;
    const vent = chamberVentModel(cabinet, chamber);
    const radiators = chamberRadiatorsLb(chamber);
    const wood = woodLb(cabinet, layout, f, isBase, bracing);
    const drivers = chamber.drivers.reduce((sum, d) => sum + d.count * driverLb(d), 0) + radiators;
    const hardwareLb = hardware?.lb ?? 0;
    return {
      box: chamberCutBox(f.index),
      bracing,
      hardware,
      paSub: f.paSub && { ...f.paSub, box: f.box },
      inside: f.inside,
      clearL: f.inside.iw * f.inside.ih * f.inside.inD * LITERS_PER_CUBIC_IN,
      ventL: vent ? vent.areaIn2 * vent.lenIn * LITERS_PER_CUBIC_IN : 0,
      hornL: hornAirL(cabinet, chamber),
      woodL: insideWoodL(cabinet, f, bracing) + driverBoardL(cabinet, f) + hornBoardsL(cabinet, f),
      recessL: hardware?.liters ?? 0,
      lb: { wood, drivers, hardware: hardwareLb, total: wood + drivers + hardwareLb },
    };
  });
  const build = { chambers, lb: chambers.reduce((sum, c) => sum + c.lb.total, 0) };
  BUILDS.set(cabinet, build);
  return build;
}

/**
 * The air of a horn built into the chamber, L: its flare (each section by its flare law) and the front chamber under the
 * walls' back edges, with the cutouts a doubled driver board leaves in front of the cones (lib/speaker/hornThroat); it
 * is the horn's, not the rear chamber's. 0 for a direct chamber.
 */
function hornAirL(cabinet: Pick<SpeakerCabinet, "panel">, chamber: SpeakerChamber): number {
  if (chamber.load.kind !== CHAMBER_LOAD.horn) return 0;
  const throat = throatCones(chamber.drivers);
  return (
    segmentsAirLiters(chamber.load.horn.segments) +
    (throat
      ? frontChamber(throat.cone, throat.count, chamberSetbackIn(cabinet.panel, chamber)).liters
      : 0)
  );
}

/**
 * A horn chamber's driver board as the build counts it: its face (the bay's size) less the cones' cutouts, in², and how
 * many pieces of the walls' plywood it is. Null for a chamber with no horn, a back-loaded horn (its drivers are on the
 * baffle: no board), or no bay (no cone sizes it).
 */
function driverBoardOf(
  cabinet: SpeakerCabinet,
  f: ChamberFrame,
): { bay: { w: number; h: number }; netIn2: number; pieces: number } | null {
  const { chamber } = f.placed;
  if (chamber.load.kind !== CHAMBER_LOAD.horn || chamber.load.horn.drive.kind === HORN_DRIVE.back)
    return null;
  const flare = hornFlare(cabinet, f.placed);
  // a folded path's drivers mount on one of its boards (`hornBoardParts`)
  const bay = flare && !flare.fold ? flare.path.bay : null;
  if (!bay) return null;
  /** the cutouts, as the front chamber takes them: each cone's area */
  const cutoutsIn2 = conesAreaCm2(chamber.drivers) / CM2_PER_IN2;
  return {
    bay,
    netIn2: Math.max(0, bay.w * bay.h - cutoutsIn2),
    pieces: driverBoardPieces(chamber.load.horn),
  };
}

/** A folded horn's boards (lib/speaker/hornFold), with the duct's width across the box; none for another chamber. */
function hornBoardsOf(cabinet: SpeakerCabinet, f: ChamberFrame) {
  const fold = hornFlare(cabinet, f.placed)?.fold;
  return fold ? { fold, boards: fold.boards } : null;
}

/** The face area of a folded horn's boards, in² (0 for none): each board's length times the duct's width. */
function hornBoardsIn2(cabinet: SpeakerCabinet, f: ChamberFrame): number {
  const of = hornBoardsOf(cabinet, f);
  return of ? of.boards.reduce((sum, b) => sum + b.lengthIn * of.fold.widthIn, 0) : 0;
}

/** The wood of a folded horn's boards, L: each a wall thick. */
const hornBoardsL = (cabinet: SpeakerCabinet, f: ChamberFrame) =>
  hornBoardsIn2(cabinet, f) * cabinet.panel.thicknessIn * LITERS_PER_CUBIC_IN;

/**
 * A folded horn's boards as cutlist rows, each a piece of the walls' plywood as long as its duct face and as wide as
 * the duct: which runs it walls, its end cuts, and the drivers' cutouts on the board their spot is on, with the spot's
 * distance from the board's end. None for another chamber.
 */
function hornBoardParts(cabinet: SpeakerCabinet, f: ChamberFrame): CutPart[] {
  const of = hornBoardsOf(cabinet, f);
  if (!of) return [];
  const { fold } = of;
  const spot = fold.mount;
  /** the board the drivers' spot is on (the nearest to it), and how far along it the spot is from its first end */
  const spotBoard = spot
    ? of.boards.reduce(
        (best, b, i) => {
          const on = onPolyline(spot.at, b.points);
          return on.off < best.off ? { i, ...on } : best;
        },
        { i: -1, off: Infinity, along: 0 },
      )
    : null;
  const cutouts = f.placed.chamber.drivers.flatMap((driver) => {
    const cone = coneBuild(driver);
    return cone
      ? [
          SPEAKER_TEXT.driverBoardCutout(
            driver.count,
            kindWord(driver),
            cutoutNote(cone.body.cutoutIn),
          ),
        ]
      : [];
  });
  return of.boards.map((board, i) => {
    return {
      box: chamberCutBox(f.index),
      part: "hornBoard",
      qty: 1,
      a: board.lengthIn,
      b: fold.widthIn,
      t: cabinet.panel.thicknessIn,
      note: joinNotes([
        SPEAKER_TEXT.hornBoardNote(board.run, board.across),
        SPEAKER_TEXT.hornBoardCuts([
          Math.round(board.endCutsDeg[0]),
          Math.round(board.endCutsDeg[1]),
        ]),
        ...(i === spotBoard?.i
          ? [...cutouts, SPEAKER_TEXT.hornBoardSpot(formatInches(spotBoard.along))]
          : []),
      ]),
    };
  });
}

/** The wood of a horn chamber's driver board, L (0 for none): its cutouts are front chamber air (`hornAirL`). */
function driverBoardL(cabinet: SpeakerCabinet, f: ChamberFrame): number {
  const board = driverBoardOf(cabinet, f);
  return board ? board.netIn2 * board.pieces * cabinet.panel.thicknessIn * LITERS_PER_CUBIC_IN : 0;
}

/** A horn chamber's driver board as a cutlist row, `qty` pieces (two when doubled) of the walls' plywood; null for none. */
function driverBoardPart(cabinet: SpeakerCabinet, f: ChamberFrame): CutPart | null {
  const board = driverBoardOf(cabinet, f);
  if (!board) return null;
  const cutouts = f.placed.chamber.drivers.flatMap((driver) => {
    const cone = coneBuild(driver);
    return cone
      ? [
          SPEAKER_TEXT.driverBoardCutout(
            driver.count,
            kindWord(driver),
            cutoutNote(cone.body.cutoutIn),
          ),
        ]
      : [];
  });
  return {
    box: chamberCutBox(f.index),
    part: "driverBoard",
    qty: board.pieces,
    a: board.bay.w,
    b: board.bay.h,
    t: cabinet.panel.thicknessIn,
    note: joinNotes([SPEAKER_TEXT.driverBoardNote(board.pieces), ...cutouts]),
  };
}

/**
 * The chamber's air as the box models take it, L: its `netLiters` where set; else its clear volume less the cones'
 * displacement (`displacementL`), the vent's air, a horn's own air, the wood inside it and the hardware's recesses
 * (`cabinetBuild`), and at least 1 L.
 */
export function chamberNetLiters(
  cabinet: SpeakerCabinet,
  chamber: SpeakerChamber,
  displacementL: number,
): number {
  if (chamber.netLiters !== null) return chamber.netLiters;
  const build = cabinetBuild(cabinet).chambers[cabinet.chambers.indexOf(chamber)];
  if (!build) return MIN_NET_L;
  return Math.max(
    MIN_NET_L,
    build.clearL - displacementL - build.ventL - build.hornL - build.woodL - build.recessL,
  );
}

// ---- the cutlist ----

/** A driver entry's name in a baffle note: its kind as the Speaker page names it. */
const kindWord = (driver: SpeakerDriver) => DRIVER_KIND_NAMES[driver.kind];

/**
 * Where a part sits on a baffle, as the notes mark it: its center up from the baffle's bottom edge and across from its
 * center line. `edgeY` is the baffle's bottom edge, `centerX` its center, both in the cabinet's front view.
 */
interface BaffleMarks {
  up: (y: number) => string;
  across: (x: number) => string;
}

/** The marks on a frame's baffle: up from its bottom edge, which sits `edgeY` up the cabinet. */
const frameMarks = (edgeY: number, centerX: number): BaffleMarks => ({
  up: (y) => `${formatInches(y - edgeY)}″ up from its bottom edge`,
  across: (x) => offsetWords(x - centerX),
});

/** The marks on a flush box's baffle, whose box stands `boxY` up the cabinet (lib/hifi/cutlist aboveBaffleEdge). */
const flushMarks = (boxY: number, centerX: number, joint: CornerJoint, t: number): BaffleMarks => ({
  up: (y) => aboveBaffleEdge(y - boxY, joint, t),
  across: (x) => offsetWords(x - centerX),
});

/**
 * The chamber's cutouts, by panel, as cutlist notes: each driver on the baffle at its spot (a cone's cutout, a horn's,
 * a tweeter's plate), a PA sub's tube holes (lib/pa/calc subCutNote), a Hi-fi port or slot, the radiators on their
 * panel, a horn-loaded chamber's mouth. A PA sub in a box of its own keeps the PA page's note, without its place.
 */
function chamberNotes(
  cabinet: SpeakerCabinet,
  f: ChamberFrame,
  marks: BaffleMarks,
  ownBox: boolean,
): { baffle: string[]; back: string[]; side: string[] } {
  const { placed } = f;
  const { chamber } = placed;
  const t = cabinet.panel.thicknessIn;
  const baffle: string[] = [],
    back: string[] = [],
    side: string[] = [];
  const at = (p: FacePoint) => `centered ${marks.up(p.yIn)}${marks.across(p.xIn)}`;
  if (f.paSub) {
    const { sub, style, vent } = f.paSub;
    const kit = isRoundPort(style)
      ? subTubeKit(f.box, style, vent, t, baffleInsetIn(cabinet), sub)
      : null;
    const note = subCutNote(sub, vent, kit);
    const entry = chamber.drivers.find((d) => d.kind === DRIVER_KIND.sub);
    const [spot] = entry ? driverSpots(placed, entry) : [];
    baffle.push(ownBox || !spot ? note : `sub ${note}, ${at(spot)}`);
  }
  if (driversOnBaffle(chamber))
    for (const driver of chamber.drivers) {
      if (f.paSub && driver.kind === DRIVER_KIND.sub) continue;
      const horn = driverHorn(driver);
      if (!hornFitsWhereSet(placed, driver)) {
        baffle.push(`${kindWord(driver)}: ${SPEAKER_TEXT.hornNoFitNote}`);
        continue;
      }
      if (onTop(driver)) {
        const mount = driver.horn?.mount;
        baffle.push(
          `${kindWord(driver)}: no cutout, its horn stands on the top${mount ? `, on the ${HORN_MOUNT_NAMES[mount].toLowerCase()}` : ""}`,
        );
        continue;
      }
      for (const spot of driverSpots(placed, driver)) {
        switch (driver.kind) {
          case DRIVER_KIND.sub:
          case DRIVER_KIND.mid: {
            const size =
              driver.kind === DRIVER_KIND.sub
                ? byId(SUB_OPTIONS, driver.driverId)?.size
                : byId(MID_OPTIONS, driver.driverId)?.size;
            if (size)
              baffle.push(
                `${kindWord(driver)}: ${cutoutNote(DRIVER_CUTOUT_IN[size])}, ${at(spot)}`,
              );
            break;
          }
          case DRIVER_KIND.woofer:
          case DRIVER_KIND.coaxial: {
            const size =
              driver.kind === DRIVER_KIND.woofer
                ? hifiDriverById("woofer", driver.driverId)?.size
                : byId(FILL_OPTIONS, driver.driverId)?.size;
            if (size)
              baffle.push(
                `${kindWord(driver).toLowerCase()}: ${sizedCutout(size)}, center ${marks.up(spot.yIn)}${marks.across(spot.xIn)}`,
              );
            break;
          }
          case DRIVER_KIND.tweeter: {
            const tweeter = hifiDriverById("tweeter", driver.driverId);
            const plate = horn ? horn.size : (tweeter?.ownGuide ?? tweeter?.faceplate);
            if (plate)
              baffle.push(tweeterCutoutNote(plate, marks.up(spot.yIn), 0) + marks.across(spot.xIn));
            break;
          }
          case DRIVER_KIND.compression: {
            const body = byId(CD_OPTIONS, driver.driverId)?.body;
            if (horn)
              baffle.push(
                `horn cutout ${hornCutoutWords(towerHornCutout(hornCutoutBox(placed, t), t, horn))}, ${at(spot)}`,
              );
            else if (body)
              baffle.push(
                `${kindWord(driver)}: ${formatInches(body.dia)}″ round cutout, ${at(spot)}`,
              );
            break;
          }
        }
      }
    }
  const flare = hornFlare(cabinet, placed);
  if (flare)
    baffle.push(
      `horn mouth: ${formatInches(flare.mouth.w)} × ${formatInches(flare.mouth.h)}″ opening, ${at({
        xIn: flare.mouth.x + flare.mouth.w / 2,
        yIn: flare.mouth.y + flare.mouth.h / 2,
      })}`,
    );
  const rule = portRule(chamber);
  if (rule?.rule === PORT_RULE.hifi) {
    const { port } = rule;
    if (port.shape === PORT_SHAPE.slot)
      baffle.push(
        port.place === SLOT_PLACE.sides
          ? SPEAKER_TEXT.sideSlotOpening(
              port.n,
              formatInches(port.h),
              formatInches(slotOpeningsAt(placed, port, t)[0].h),
            )
          : slotOpeningNote(
              { ...port, w: f.inside.iw },
              slotOpeningsAt(placed, port, t).map((o) => marks.up(placed.y0 + o.y)),
            ),
      );
    else {
      const tubes = roundPortsAt(placed, port);
      const note = port.position
        ? `${roundPortHoleNote(port)}, ${at({
            xIn: placed.cx + tubes.spots.reduce((s, p) => s + p.x, 0) / tubes.spots.length,
            yIn: placed.y0 + tubes.spots.reduce((s, p) => s + p.y, 0) / tubes.spots.length,
          })}`
        : roundPortHoleNote(port);
      (tubes.panel === PANEL.back ? back : baffle).push(note);
    }
  }
  if (chamber.vent.kind === VENT_KIND.radiator) {
    const drv = byId(HIFI_PASSIVES, chamber.vent.radiators.id);
    const { spots } = radiatorsAt(cabinet, placed);
    const panel = spots[0]?.panel ?? chamber.vent.position?.panel;
    if (drv && panel) {
      const note = radiatorCutoutNote({ drv, n: chamber.vent.radiators.n }, panel);
      (panel === PANEL.back ? back : panel === PANEL.side ? side : baffle).push(note);
    }
  }
  return { baffle, back, side };
}

/** The hardware's cutout notes on a box's panels, with more notes on its sides and back (vents, radiators). */
function withNotes(
  hw: HardwareCutNotes | undefined,
  more: { back: readonly string[]; side: readonly string[] },
): HardwareCutNotes {
  const join = (a: string | undefined, b: readonly string[]) => joinNotes([a, ...b]) || undefined;
  return { ...hw, side: join(hw?.side, more.side), back: join(hw?.back, more.back) };
}

/**
 * A chamber's own box less the walls other chambers give it. Its box (ChamberFrame `box`) carries a wall on each given
 * side so the inside is the chamber's clear face; the panels on that side are then sized to the chamber itself:
 * - its floor given (it stands on a chamber): the top alone is cut, and the sides run the chamber's height, standing on
 *   the chamber below's top;
 * - its left side given (it stands beside a chamber): the right side alone is cut, the top and bottom end square on the
 *   neighbor's wall (a butt joint already does; a rabbeted one loses its t/2 tongue, a mitered one its wall);
 * - the back (and a flush box's baffle) stops at the neighbor's wall on a given side: a frame's back, and a flush box's
 *   rabbeted or mitered faces, lose the t/2 they would set into a rabbet there; a flush box's butt-jointed faces, which
 *   cover the edges, lose the whole wall. A frame's baffle and cleats already fit the clear face.
 */
function withoutGivenWalls(
  parts: CutPart[],
  shared: ChamberFrame["shared"],
  joint: CornerJoint,
  t: number,
  frame: boolean,
): CutPart[] {
  const topCut = { butt: 0, rabbet: t / 2, miter: t }[joint];
  const faceCut = !frame && joint === "butt" ? t : t / 2;
  const left = shared.left ? 1 : 0,
    below = shared.below ? 1 : 0;
  /** a side's joint words without the bottom edge it no longer has (a frame's and a flush box's wording) */
  const sideNote = (note: string) =>
    shared.below
      ? note
          .replace("top and bottom edges", "top edge")
          .replace(
            "all four edges, for the top, bottom, baffle and back",
            "the top, front and rear edges, for the top, baffle and back",
          )
      : note;
  /** a mitered top's joint words without the left end it no longer has */
  const topNote = (note: string) =>
    shared.left ? note.replace("45° on both ends", "45° on the right end") : note;
  return parts.map((p): CutPart => {
    switch (p.part) {
      case "side":
        return {
          ...p,
          qty: p.qty - left,
          b: p.b - below * t,
          note: joinNotes([
            shared.left && "right side only: its left side is the chamber beside it's right side",
            shared.below && "stands on the chamber below's top",
            sideNote(p.note),
          ]),
        };
      case "topBottom":
        return {
          ...p,
          qty: p.qty - below,
          b: p.b - left * topCut,
          note: joinNotes([
            shared.below && "top only: its floor is the chamber below's top",
            shared.left && "left end square on the chamber beside it",
            topNote(p.note),
          ]),
        };
      case "back":
        return { ...p, a: p.a - left * faceCut, b: p.b - below * faceCut };
      case "baffle":
        return frame ? p : { ...p, a: p.a - left * faceCut, b: p.b - below * faceCut };
      default:
        return p;
    }
  });
}

/** The hardware's parts as bought, for the line under the list. */
const hardwareLine = (box: CutBoxId, plan: BoxHardwarePlan) =>
  `${cutBoxName(box)} hardware: ${plan.bought
    .map(({ part, qty }) => `${qty} × ${part.name} ($${part.price.toFixed(2)}, ${part.src})`)
    .join(", ")}`;

/**
 * The speaker's cutlist rows and bought parts, at the corner joint `joint`. Chambers that fill one box of one depth
 * (`SpeakerLayout.oneShell`) share one shell: its sides, top and bottom (or an arched top), back and baffle under
 * `SHELL_CUT_BOX`, every chamber's cutouts on the one baffle, and each chamber's partitions, braces and vent parts
 * under its own box. Any other chamber is a box of its own (`chamberCutBox`), less the walls another chamber gives it.
 * `also` is the lines under the list (the bought vent parts and the hardware, as the PA and Hi-fi pages give them);
 * `vent` is the vent's lines alone, the notes under the purchased parts table (`speakerPurchasedParts`).
 */
export function speakerCutParts(
  cabinet: SpeakerCabinet,
  joint: CornerJoint,
): { parts: CutPart[]; also: string[]; vent: string[] } {
  const layout = speakerLayout(cabinet);
  const frames = chamberFrames(cabinet, layout);
  const build = cabinetBuild(cabinet);
  const t = cabinet.panel.thicknessIn;
  const frame = isFrame(cabinet);
  const inset = baffleInsetIn(cabinet);
  const back = cabinet.backJoint;
  /** a flush box's back, by its joint, and screwed to the window braces' rails where they meet it */
  const flushBack = (hwBack: string | undefined, rails: boolean) =>
    joinNotes([BACK_JOINT_FLUSH_NOTES[back], rails && BACK_JOINT_RAIL_NOTES[back], hwBack]);
  const arched = cutsArchedTop(cabinet, layout);
  const roundover = frame ? false : roundoverNote(cabinet.roundoverIn, t, joint);
  const parts: CutPart[] = [],
    also: string[] = [],
    ventLines: string[] = [];
  /** a chamber's braces, vent parts and bought vent parts */
  const insideParts = (f: ChamberFrame) => {
    const { bracing } = build.chambers[f.index];
    const vent = ventParts(cabinet, f);
    also.push(...vent.vent);
    ventLines.push(...vent.vent);
    return [
      ...(bracing ? braceParts(chamberCutBox(f.index), bracing, insideAxes(f), t) : []),
      ...vent.parts,
    ];
  };
  for (const c of build.chambers) if (c.hardware) also.push(hardwareLine(c.box, c.hardware));
  if (layout.oneShell && frames.length > 1) {
    const { size } = layout;
    // the shell's lowest (then leftmost) chamber, which takes the hardware (shellBases)
    const base = frames[shellBases(cabinet.chambers)[0]];
    // a bottom slot's band under the one baffle, where its chamber runs the shell's width
    const band = Math.abs(base.placed.dims.w - size.w) < TOUCH_IN ? base.inside.band : 0;
    const marks = frame ? frameMarks(t + band, 0) : flushMarks(0, 0, joint, t);
    const notes = frames.map((f) => chamberNotes(cabinet, f, marks, false));
    const plan = build.chambers[base.index].hardware;
    const hw = withNotes(plan ? hardwareCutNotes(plan, base.box, t) : undefined, {
      back: notes.flatMap((n) => n.back),
      side: notes.flatMap((n) => n.side),
    });
    if (frame) {
      const shell = boxParts(SHELL_CUT_BOX, size.w, size.h, size.d, t, inset, joint, {
        band,
        cutNote: joinNotes(notes.flatMap((n) => n.baffle)),
        hardware: hw,
        back,
        backRails: build.chambers.some((c) => railsOnBack(c.bracing)),
      }).P;
      parts.push(
        ...(arched
          ? archedShellParts(shell, SHELL_CUT_BOX, size, t, joint, {
              back,
              band,
              sideHardware: hw.side,
            })
          : shell),
      );
    } else
      parts.push(
        ...flushBoxPanels(SHELL_CUT_BOX, size, t, joint, {
          side: hw.side,
          baffle: [...notes.flatMap((n) => n.baffle), roundover],
          back: flushBack(
            hw.back,
            build.chambers.some((c) => railsOnBack(c.bracing)),
          ),
        }),
      );
    const inD = Math.min(...frames.map((f) => f.inside.inD));
    for (const f of frames) {
      const box = chamberCutBox(f.index);
      for (const wall of f.placed.walls.filter((w) => w.shared)) {
        const across = wall.w >= wall.h;
        const lo = across ? Math.max(wall.x, -size.w / 2 + t) : Math.max(wall.y, t);
        const hi = across
          ? Math.min(wall.x + wall.w, size.w / 2 - t)
          : Math.min(wall.y + wall.h, size.h - t);
        parts.push({
          box,
          part: "partition",
          qty: 1,
          a: hi - lo,
          b: inD,
          t,
          note: partitionNote(
            across
              ? `level, top face ${formatInches(wall.y + t)}″ up from the bottom`
              : `upright, its right face ${formatInches(wall.x + t + size.w / 2)}″ from the left`,
            back,
            frame,
          ),
        });
      }
      parts.push(...insideParts(f), ...driverBoardParts(f));
    }
    return { parts, also, vent: ventLines };
  }
  for (const f of frames) {
    const box = chamberCutBox(f.index);
    const { placed, shared } = f;
    const boxY = placed.y0 - (shared.below ? t : 0);
    const centerX = placed.x0 - (shared.left ? t : 0) + f.box.w / 2;
    const marks = frame
      ? frameMarks(placed.clear.y + f.inside.band, centerX)
      : flushMarks(boxY, centerX, joint, t);
    const notes = chamberNotes(cabinet, f, marks, true);
    const { bracing, hardware } = build.chambers[f.index];
    const hw = withNotes(hardware ? hardwareCutNotes(hardware, f.box, t) : undefined, notes);
    const own = frame
      ? boxParts(box, f.box.w, f.box.h, f.box.d, t, inset, joint, {
          band: f.inside.band,
          cutNote: joinNotes(notes.baffle),
          bracing,
          hardware: hw,
          back,
        }).P
      : flushBoxPanels(box, f.box, t, joint, {
          side: hw.side,
          baffle: [...notes.baffle, roundover],
          back: flushBack(hw.back, railsOnBack(bracing)),
        });
    const walls = withoutGivenWalls(own, shared, joint, t, frame);
    parts.push(
      ...(arched && frames.length === 1
        ? archedShellParts(walls, box, f.box, t, joint, {
            back,
            band: f.inside.band,
            sideHardware: hw.side,
          })
        : walls),
    );
    // a frame's own box already carries its braces (boxParts)
    if (frame) parts.push(...ventPartsOf(f));
    else parts.push(...insideParts(f));
    parts.push(...driverBoardParts(f), ...hornBoardParts(cabinet, f));
  }
  return { parts, also, vent: ventLines };

  /** a horn chamber's driver board: its own row, a piece or two of the walls' plywood */
  function driverBoardParts(f: ChamberFrame): CutPart[] {
    const board = driverBoardPart(cabinet, f);
    return board ? [board] : [];
  }

  function ventPartsOf(f: ChamberFrame) {
    const vent = ventParts(cabinet, f);
    also.push(...vent.vent);
    ventLines.push(...vent.vent);
    return vent.parts;
  }
}

/**
 * The parts bought for the speaker, as the Cutlist page's purchased parts table lists them: the drivers, their horns,
 * the passive radiators, the port tubes (a PA port's stock pipe and elbows; a Hi-fi round port's flared tubes, with no
 * catalog price) and the hardware. The same part in more than one place is one row.
 */
export function speakerPurchasedParts(cabinet: SpeakerCabinet): PurchasedPart[] {
  const rows: PurchasedPart[] = [];
  const add = (row: PurchasedPart) => {
    if (row.count <= 0) return;
    const same = rows.find(
      (r) => r.kind === row.kind && r.model === row.model && r.unit === row.unit,
    );
    if (same) same.count += row.count;
    else rows.push({ ...row });
  };
  const listed = (
    kind: PurchasedPart["kind"],
    listing: { name: string; price: number | null; src: string },
    count: number,
  ) =>
    add({
      kind,
      model: listing.name,
      count,
      unit: listing.price,
      source: listing.price === null ? null : sourceOf(listing.src),
    });
  const layout = speakerLayout(cabinet);
  const frames = chamberFrames(cabinet, layout);
  const t = cabinet.panel.thicknessIn;
  for (const f of frames) {
    const { chamber } = f.placed;
    for (const d of chamber.drivers) {
      const listing = driverListing(d);
      if (listing) listed(PURCHASED_PART.driver, listing, d.count);
      const horn = driverHorn(d);
      // a horn that does not fit where it is mounted is left out, as the views and the cutlist leave it out
      if (horn && hornFitsWhereSet(f.placed, d)) listed(PURCHASED_PART.horn, horn, d.count);
    }
    const { vent } = chamber;
    if (vent.kind === VENT_KIND.radiator) {
      const drv = byId(HIFI_PASSIVES, vent.radiators.id);
      if (drv) listed(PURCHASED_PART.radiator, drv, vent.radiators.n);
      continue;
    }
    const rule = portRule(chamber);
    if (!rule || vent.kind !== VENT_KIND.vented) continue;
    if (rule.rule === PORT_RULE.pa) {
      if (!isRoundPort(rule.portStyle)) continue;
      const tube = paVentOf(vent.port);
      const kit = subTubeKit(f.box, rule.portStyle, tube, t, baffleInsetIn(cabinet), rule.sub);
      if (kit.pipe)
        add({
          kind: PURCHASED_PART.portTube,
          model: purchasedPipeName(kit.pipe),
          count: kit.sticks,
          unit: kit.pipe.price,
          source: sourceOf(kit.pipe.src),
        });
      if (kit.elbow && kit.elbows)
        add({
          kind: PURCHASED_PART.portElbow,
          model: purchasedElbowName(kit.elbow.dia),
          count: tube.nt * kit.elbows,
          unit: kit.elbow.price,
          source: kit.elbow.src === null ? null : sourceOf(kit.elbow.src),
        });
      continue;
    }
    const { port } = rule;
    if (port.shape === PORT_SHAPE.slot) continue;
    add({
      kind: PURCHASED_PART.portTube,
      model: purchasedTubeName(port.dia, port.len),
      count: port.n,
      unit: null,
      source: null,
    });
  }
  for (const c of cabinetBuild(cabinet).chambers)
    for (const { part, qty } of c.hardware?.bought ?? [])
      add({
        kind: PURCHASED_PART.hardware,
        model: part.name,
        count: qty,
        unit: part.price,
        source: sourceOf(part.src),
      });
  return rows;
}
