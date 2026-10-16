// Where a speaker spec's parts sit in its cabinet's front view, inches: the chambers at their `at` positions and the
// walls two of them share (`sharedWalls`, the lower or left chamber's), each driver entry's drivers, the port by the
// rule of the engine it comes from (a Hi-fi round port or radiators at their own position where set), and a
// horn-loaded chamber's mouth (at its own position where set). Where the drivers stand is settled here, once, for every
// reader: on a baffle, at the spec's position kept on the baffle and off every other opening; in a horn-loaded chamber,
// stacked and centered in the bay behind the throat (`driverSpots`). The 3D view (stack-view/buildSpeakerScene) and
// the front drawing (drawings/SpeakerFront) both read it. x is across from the cabinet's center line (+ to the right
// seen from the front), y up from the cabinet's bottom. Both views draw the left speaker of a pair, so a driver's
// `xIn` (+ toward the pair's inside) is + to the right, as the Hi-fi page draws it. Pure.
import type {
  ArchBlock,
  Dims2,
  Dims3,
  FacePoint,
  Horn,
  HornPlacement,
  PaPortGeometry,
  PortStyle,
  SpeakerCabinet,
  SpeakerChamber,
  SpeakerDriver,
  SpeakerHorn,
  SpeakerPort,
  SpeakerRoundPort,
  SpeakerSlotPort,
  SubDriver,
  VentPanel,
  VentPosition,
  ThieleSmall,
  HornBoards,
  HornSegment,
} from "../../types";
import {
  CD_OPTIONS,
  FILL_OPTIONS,
  HIFI_PASSIVES,
  MID_OPTIONS,
  SUB_OPTIONS,
  hifiDriverById,
  hornById,
} from "../data";
import { byId } from "../tables";
import { MESHED_HORN_IDS } from "../../data/meshes/meshedHorns";
import { DEFAULT_PA } from "../defaults";
import { clearDepthIn, sharedWalls, slotRunIn, TOUCH_IN } from "./chamberAir";
import { HIFI_FALLBACK_LB, RADIATOR_PANEL } from "../hifi/hifi";
import { paConeBody, type ConeBody } from "../pa/calc";
import { coneDepthIn } from "./driverParts";
import { subVentOpenings, subVentPlan } from "../pa/subVentPlan";
import {
  radiatorSpots,
  roundPortSpots,
  type RadiatorSpot,
  type RoundSpot,
} from "../hifi/boxLayout";
import { PANEL } from "../../constants/cutParts";
import { HIFI_FRONT_PARTS, HIFI_GENERIC_BODIES } from "../../constants/hifiScene";
import {
  DRIVER_CUTOUT_IN,
  HIFI_DRIVER_CUTOUT_IN,
  HIFI_MOTOR_CUTOUT_SHARE,
} from "../../data/catalog/driver-cutouts";
import { HIFI_BOX_LAYOUT } from "../../constants/hifiLayout";
import { CM2_PER_IN2, CM_PER_IN, MM_PER_IN } from "../../constants/units";
import {
  foldBodyFrom,
  foldPasses,
  hornBoardsLayout,
  type FoldDriverBody,
  type FoldLayout,
  type FoldRoom,
} from "./hornBoards";
import {
  isFolded,
  mirroredBoards,
  mouthAtBottom,
  offsetZigzagBoards,
  zigzagBoards,
} from "./foldLayouts";
import {
  FOLD_AUTO_GROWTHS,
  FOLD_FACE,
  FOLD_AUTO_MAX_LEGS,
  FOLD_AUTO_TURN_SHARES,
  FOLD_OFFSET_REAR_SHARES,
} from "../../constants/hornBoards";
import { HORN_LIFT_IN } from "../../constants/paLayouts";
import { isSizedSegment } from "../acoustics/hornSegments";
import { hornPath, type HornPath } from "./hornGeometry";
import { driverBodyIn, wallClearanceIn } from "./hornThroat";
import { driverBoardIn } from "./driverBoard";
import { PORT_STYLE } from "../../constants/portStyles";
import {
  ARCH_BLOCK,
  CABINET_CONSTRUCTION,
  CABINET_TOP,
  CHAMBER_LOAD,
  DRIVER_KIND,
  HORN_DRIVE,
  HORN_PLACEMENT,
  PORT_SHAPE,
  SLOT_PLACE,
  VENT_KIND,
} from "../../constants/speakerSpec";

/** How far apart a driver entry's alike drivers sit, edge to edge, in. */
const DRIVER_GAP_IN = 0.5;

/** A rectangle in the front view: its lower-left corner and size. */
export interface FaceRect extends Dims2 {
  x: number;
  y: number;
}

/**
 * One of a chamber's walls in the front view, a wall thick: `shared` where another chamber stands on it or against it
 * (a partition, the lower or left chamber's), else an outside wall.
 */
export interface ChamberWall extends FaceRect {
  shared: boolean;
}

/** A chamber as its cabinet places it. */
export interface PlacedChamber {
  chamber: SpeakerChamber;
  /** its outside, as its own box: lower-left corner, size, and center line across */
  x0: number;
  y0: number;
  cx: number;
  dims: Dims3;
  /** its clear face inside its walls, a shared wall counted once (lib/speaker/chamberAir `chamberClearFace`) */
  clear: FaceRect;
  /**
   * the walls it builds (`SpeakerChamber.dims`): its top and right walls whole, the partitions where a chamber stands on
   * or right of it among them; its floor and left side where no chamber gives it one (an overhang past the chamber
   * under it keeps its own floor there, so the box stays closed)
   */
  walls: ChamberWall[];
  /** another chamber touches it (shares a wall with it) */
  touches: boolean;
  /**
   * where each of its driver entries' drivers stand (`placeDrivers`, read through `driverSpots`); an entry's spots stay
   * out of it where the spec sets a place the layout does not keep (a horn on the top)
   */
  spots: Map<SpeakerDriver, FacePoint[]>;
}

/** A cabinet's chambers placed, and the walls they share. */
export interface SpeakerLayout {
  /** the chambers' bounds, as deep as the deepest; the lowest chamber stands on y = 0 */
  size: Dims3;
  /**
   * the chambers fill one box of one depth: one shell round them all and one baffle, the walls they share inside it
   * (as the PA tower is built); otherwise chambers that touch form a stepped shell, and any other is its own box
   */
  oneShell: boolean;
  chambers: PlacedChamber[];
  /** each shared wall in the front view: the lower chamber's top wall, or the left chamber's right wall, where they meet */
  partitions: ChamberWall[];
}

/** A span along an edge. */
type Span = readonly [number, number];

/** The overlap of [a0, a1] and [b0, b1], or null when they only touch or miss. */
function overlap(a0: number, a1: number, b0: number, b1: number): Span | null {
  const lo = Math.max(a0, b0),
    hi = Math.min(a1, b1);
  return hi - lo > TOUCH_IN ? [lo, hi] : null;
}

/** `span` cut at the `marks` (sorted, inside it): each piece, and whether it lies in one of them. */
function splitSpan(span: Span, marks: readonly Span[]): { span: Span; marked: boolean }[] {
  const out: { span: Span; marked: boolean }[] = [];
  let at = span[0];
  for (const [lo, hi] of [...marks].sort((a, b) => a[0] - b[0])) {
    if (lo - at > TOUCH_IN) out.push({ span: [at, lo], marked: false });
    out.push({ span: [lo, hi], marked: true });
    at = hi;
  }
  if (span[1] - at > TOUCH_IN) out.push({ span: [at, span[1]], marked: false });
  return out;
}

/** What the layout reads of a cabinet: its chambers and panels, and the frame a horn's path is cut for. */
type LayoutCabinet = Pick<SpeakerCabinet, "chambers" | "panel" | "construction" | "insetIn">;

/** The cabinet's chambers placed in its front view, with the walls they build and share. */
export function speakerLayout(cabinet: LayoutCabinet): SpeakerLayout {
  const t = cabinet.panel.thicknessIn;
  const list = cabinet.chambers;
  if (!list.length)
    return { size: { w: 0, h: 0, d: 0 }, oneShell: false, chambers: [], partitions: [] };
  const minX = Math.min(...list.map((c) => c.at.xIn)),
    maxX = Math.max(...list.map((c) => c.at.xIn + c.dims.w)),
    minY = Math.min(...list.map((c) => c.at.yIn)),
    maxY = Math.max(...list.map((c) => c.at.yIn + c.dims.h));
  const size = { w: maxX - minX, h: maxY - minY, d: Math.max(...list.map((c) => c.dims.d)) };
  const boxes = list.map((chamber) => ({
    chamber,
    x0: chamber.at.xIn - minX - size.w / 2,
    y0: chamber.at.yIn - minY,
    ...chamber.dims,
  }));
  type Box = (typeof boxes)[number];
  /** where `b` stands on `a` (a's top), across; where `b` stands right of `a` (a's right side), up */
  const onTopOf = (a: Box, b: Box) =>
    Math.abs(a.y0 + a.h - b.y0) < TOUCH_IN ? overlap(a.x0, a.x0 + a.w, b.x0, b.x0 + b.w) : null;
  const rightOf = (a: Box, b: Box) =>
    Math.abs(a.x0 + a.w - b.x0) < TOUCH_IN ? overlap(a.y0, a.y0 + a.h, b.y0, b.y0 + b.h) : null;
  const marks = (spans: (Span | null)[]) => spans.filter((s): s is Span => s !== null);
  const chambers = boxes.map((box): PlacedChamber => {
    const { chamber, x0, y0, w, h } = box;
    const others = boxes.filter((b) => b !== box);
    const { below, left } = sharedWalls(cabinet, chamber);
    const lo = { x: left ? 0 : t, y: below ? 0 : t };
    const above = marks(others.map((b) => onTopOf(box, b)));
    const under = marks(others.map((b) => onTopOf(b, box)));
    const right = marks(others.map((b) => rightOf(box, b)));
    const leftOf = marks(others.map((b) => rightOf(b, box)));
    const walls: ChamberWall[] = [];
    const across = (y: number, spans: { span: Span; marked: boolean }[], keep: boolean) =>
      spans.forEach(({ span: [a, b], marked }) => {
        if (keep || !marked) walls.push({ x: a, y, w: b - a, h: t, shared: keep && marked });
      });
    const up = (x: number, spans: { span: Span; marked: boolean }[], keep: boolean) =>
      spans.forEach(({ span: [a, b], marked }) => {
        if (keep || !marked) walls.push({ x, y: a, w: t, h: b - a, shared: keep && marked });
      });
    // the top wall and the floor run the whole width; the sides fit between them
    across(y0 + h - t, splitSpan([x0, x0 + w], above), true);
    const floor = splitSpan([x0, x0 + w], under);
    across(y0, floor, false);
    /** whether its own floor reaches the corner at `x` */
    const floorAt = (x: number) =>
      floor.some(({ span: [a, b], marked }) => !marked && a - TOUCH_IN <= x && x <= b + TOUCH_IN);
    const sides = (x: number) => [y0 + (floorAt(x) ? t : 0), y0 + h - t] as const;
    up(x0 + w - t, splitSpan(sides(x0 + w), right), true);
    up(x0, splitSpan(sides(x0), leftOf), false);
    return {
      chamber,
      x0,
      y0,
      cx: x0 + w / 2,
      dims: chamber.dims,
      clear: { x: x0 + lo.x, y: y0 + lo.y, w: w - lo.x - t, h: h - lo.y - t },
      walls,
      touches: above.length + under.length + right.length + leftOf.length > 0,
      spots: new Map(),
    };
  });
  // the drivers' places, once every chamber's face and walls are known (a horn's path reads them)
  for (const placed of chambers) placed.spots = placeDrivers(cabinet, placed);
  const area = list.reduce((sum, c) => sum + c.dims.w * c.dims.h, 0);
  const disjoint = boxes.every((a, i) =>
    boxes
      .slice(i + 1)
      .every(
        (b) =>
          !overlap(a.x0, a.x0 + a.w, b.x0, b.x0 + b.w) ||
          !overlap(a.y0, a.y0 + a.h, b.y0, b.y0 + b.h),
      ),
  );
  const oneShell =
    disjoint &&
    Math.abs(area - size.w * size.h) < 1e-6 &&
    list.every((c) => Math.abs(c.dims.d - size.d) < TOUCH_IN);
  return {
    size,
    oneShell,
    chambers,
    partitions: chambers.flatMap((c) => c.walls.filter((w) => w.shared)),
  };
}

/** A driver entry's horn from the catalog (a PA horn or a Hi-fi waveguide); null for none or a stale id. */
export const driverHorn = (driver: Pick<SpeakerDriver, "horn">): Horn | null =>
  (driver.horn && hornById(driver.horn.hornId)) ?? null;

/** Whether a driver entry's horn stands on its chamber's top (its position's `yIn` is then back from the front). */
export const onTop = (driver: Pick<SpeakerDriver, "horn">) =>
  driver.horn?.placement === HORN_PLACEMENT.top;

/**
 * Whether a catalog horn fits where it would sit on a chamber. In the baffle: its mouth's height inside the chamber's
 * clear face, and its width too unless the tower's cutout trims it to the clear face (a rectangular horn, or one drawn
 * from its mesh: lib/pa/tower towerHornCutout). On the top: no chamber standing on this one (a horn wider than the
 * chamber stands over its edges, as on the PA mid box).
 */
export function hornFits(
  horn: Pick<Horn, "id" | "size" | "rect">,
  placed: Pick<PlacedChamber, "clear" | "dims" | "walls">,
  placement: HornPlacement,
): boolean {
  if (placement === HORN_PLACEMENT.top) return !placed.walls.some((w) => w.shared && w.w >= w.h);
  const trimmed = !!horn.rect || MESHED_HORN_IDS.has(horn.id);
  return horn.size.h <= placed.clear.h && (trimmed || horn.size.w <= placed.clear.w);
}

/**
 * The box a baffle horn's cutout is sized in (lib/pa/tower towerHornCutout): the chamber's clear face and a wall each
 * side, so a chamber beside another cuts within its own clear face. The cutlist, the weights, the 3D view and the front
 * drawing all size it here.
 */
export const hornCutoutBox = (placed: Pick<PlacedChamber, "clear">, t: number) => ({
  w: placed.clear.w + 2 * t,
});

/**
 * Whether a driver's horn fits where it is set (`hornFits`); a driver without a catalog horn always does. One that no
 * longer fits (a chamber now stands on its top horn, or the horn is larger than the chamber) can't be built there: the
 * views leave it out and the page says so.
 */
export const hornFitsWhereSet = (
  placed: Pick<PlacedChamber, "clear" | "dims" | "walls">,
  driver: Pick<SpeakerDriver, "horn">,
) => {
  const horn = driverHorn(driver);
  return !horn || !driver.horn || hornFits(horn, placed, driver.horn.placement);
};

/**
 * Where a newly picked horn sits on a chamber: the catalog's `rect` flag sets the first choice (a rectangular horn in
 * the baffle, a round one freestanding on the top, as the Hi-fi page's waveguides), where it fits (`hornFits`); else the
 * other place. The user can pick either place that fits.
 */
export function defaultHornPlacement(
  horn: Pick<Horn, "id" | "size" | "rect">,
  placed: Pick<PlacedChamber, "clear" | "dims" | "walls">,
): HornPlacement {
  const first = horn.rect ? HORN_PLACEMENT.baffle : HORN_PLACEMENT.top;
  const other = horn.rect ? HORN_PLACEMENT.top : HORN_PLACEMENT.baffle;
  return hornFits(horn, placed, first) || !hornFits(horn, placed, other) ? first : other;
}

/**
 * How wide one driver of an entry is on the baffle, in: a PA cone's nominal size, a Hi-fi woofer's or a coaxial's
 * frame, a tweeter's plate or the horn it drives; 0 for an id its table doesn't have.
 */
export function driverAcrossIn(driver: SpeakerDriver): number {
  const horn = driverHorn(driver);
  const frame = (size: number) => size * HIFI_FRONT_PARTS.wooferFramePerSize;
  switch (driver.kind) {
    case DRIVER_KIND.sub:
      return byId(SUB_OPTIONS, driver.driverId)?.size ?? 0;
    case DRIVER_KIND.mid:
      return byId(MID_OPTIONS, driver.driverId)?.size ?? 0;
    case DRIVER_KIND.woofer: {
      const woofer = hifiDriverById("woofer", driver.driverId);
      return woofer ? frame(woofer.size) : 0;
    }
    case DRIVER_KIND.coaxial: {
      const coax = byId(FILL_OPTIONS, driver.driverId);
      return coax ? frame(coax.size) : 0;
    }
    case DRIVER_KIND.tweeter: {
      if (horn) return horn.size.w;
      const tweeter = hifiDriverById("tweeter", driver.driverId);
      return tweeter ? (tweeter.ownGuide ?? tweeter.faceplate).w : 0;
    }
    case DRIVER_KIND.compression:
      return horn ? horn.size.w : (byId(CD_OPTIONS, driver.driverId)?.body.dia ?? 0);
  }
}

/** A cone's body, depth, weight and figures as the bracing and the hardware read them. */
export interface ConeBuild {
  body: ConeBody;
  depthIn: number;
  lb: number;
  ts: Pick<ThieleSmall, "Sd" | "Xmax" | "disp">;
}

/** A cone driver's body (its catalog's, or the Hi-fi estimates where the catalog has none); null for another kind. */
export function coneBuild(driver: SpeakerDriver): ConeBuild | null {
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

/**
 * Where an entry's `count` drivers sit as the spec sets them: side by side across its position, a driver's width and a
 * gap apart. On the baffle, each center (`position` from the chamber's center line and its bottom); a horn on the top
 * stands on the chamber's top, at its `xIn`. The layout keeps these only for a horn on the top (`driverSpots`).
 */
function specSpots(placed: PlacedChamber, driver: SpeakerDriver): FacePoint[] {
  const y = onTop(driver) ? placed.y0 + placed.dims.h : placed.y0 + driver.position.yIn;
  return groupOffsets(driver).map((dx) => ({ xIn: placed.cx + driver.position.xIn + dx, yIn: y }));
}

/** How far apart an entry's alike drivers' centers are, in: a driver's width and a gap. */
const groupPitch = (driver: SpeakerDriver) => driverAcrossIn(driver) + DRIVER_GAP_IN;

/** Each of an entry's drivers' center across from the entry's own center, in. */
const groupOffsets = (driver: SpeakerDriver): number[] =>
  Array.from(
    { length: Math.max(1, driver.count) },
    (_, i) => (i - (Math.max(1, driver.count) - 1) / 2) * groupPitch(driver),
  );

/**
 * Where an entry's `count` drivers stand, as the layout settles them (`placeDrivers`): on a baffle, the spec's position
 * kept inside the baffle and off the other drivers and openings; in a horn-loaded chamber, stacked and centered in the
 * bay behind the throat; a horn on the top stands as the spec sets it. The front drawing, the 3D view, the cutlist and
 * the Space page all read these.
 */
export function driverSpots(placed: PlacedChamber, driver: SpeakerDriver): FacePoint[] {
  return placed.spots.get(driver) ?? specSpots(placed, driver);
}

/**
 * Whether a chamber's drivers are on its baffle: a direct radiator's and a back-loaded horn's (their fronts radiate
 * from it); a front-loaded or tapped horn's sit inside, at its throat or taps.
 */
export const driversOnBaffle = (chamber: Pick<SpeakerChamber, "load">) =>
  chamber.load.kind === CHAMBER_LOAD.direct || chamber.load.horn.drive.kind === HORN_DRIVE.back;

/** The engines whose port rules a spec's port follows, by id (`PortRule`). */
export const PORT_RULE = { pa: "pa", hifi: "hifi" } as const;

/**
 * A vented chamber's port by the rule of the engine it comes from (as the model takes it, lib/speaker/chamberAir
 * `chamberVentModel`):
 * - the PA sub's, for side ducts, a slot with `fins` (the letterbox) and `flared` tubes in a chamber with a PA sub: its
 *   port style and vent sizes, and the sub the tube rule reads (a duct or slot chamber without one takes the default
 *   PA sub's: only the tubes read it);
 * - the Hi-fi's, for any other round port or slot;
 * null for a sealed or radiator chamber.
 */
export type PortRule =
  | {
      rule: typeof PORT_RULE.pa;
      portStyle: PortStyle;
      portGeom: Partial<PaPortGeometry>;
      sub: Pick<SubDriver, "size" | "depthIn">;
    }
  | { rule: typeof PORT_RULE.hifi; port: SpeakerRoundPort | SpeakerSlotPort };

export function portRule(chamber: SpeakerChamber): PortRule | null {
  if (chamber.vent.kind !== VENT_KIND.vented) return null;
  const port: SpeakerPort = chamber.vent.port;
  const subEntry = chamber.drivers.find((d) => d.kind === DRIVER_KIND.sub);
  const sub = (subEntry && byId(SUB_OPTIONS, subEntry.driverId)) ?? null;
  const pa = (portStyle: PortStyle, portGeom: Partial<PaPortGeometry>): PortRule => ({
    rule: PORT_RULE.pa,
    portStyle,
    portGeom,
    sub: sub ?? DEFAULT_PA.sub,
  });
  switch (port.shape) {
    case PORT_SHAPE.duct:
      return pa(port.n === 1 ? PORT_STYLE.oneDuct : PORT_STYLE.twoDucts, {
        throat: port.throat,
        tubeLen: port.len,
        divider: port.div,
      });
    case PORT_SHAPE.slot:
      return port.fins !== undefined
        ? pa(PORT_STYLE.slot, { ductH: port.h, tubeLen: port.len, fins: port.fins })
        : { rule: PORT_RULE.hifi, port };
    default:
      return port.flared && sub
        ? pa(
            port.corners
              ? PORT_STYLE.cornerTubes
              : port.n === 1
                ? PORT_STYLE.oneTube
                : PORT_STYLE.tubeRow,
            {
              nPorts: port.n,
              portR: port.dia / 2,
              tubeLen: port.len,
            },
          )
        : { rule: PORT_RULE.hifi, port };
  }
}

/** A slot's opening on the baffle: its center across and its bottom up (the chamber's own coordinates), and its size. */
export interface SlotOpening extends Dims2 {
  x: number;
  y: number;
  /** the side wall it stands against (-1 left, 1 right seen from the front); absent for a slot along the floor */
  side?: -1 | 1;
}

/**
 * A Hi-fi slot's openings on its chamber's baffle, in the chamber's own coordinates: `x` from its center line, `y` (an
 * opening's bottom) up from its bottom. Along the floor (the default): `n` alike stacked from the clear face's floor up,
 * each under its own shelf a wall thick, each the clear face's whole width (`slotRunIn`). Up the sides (`SLOT_PLACE`): `n`
 * alike standing on the floor, alternately against the left and the right wall and a wall apart across, each as wide as
 * the slot's narrow side and as tall as the clear face.
 */
export function slotOpeningsAt(
  placed: Pick<PlacedChamber, "clear" | "cx" | "y0">,
  port: Pick<SpeakerSlotPort, "n" | "h" | "place">,
  t: number,
): SlotOpening[] {
  const { clear } = placed;
  const n = Math.max(1, port.n);
  if (port.place === SLOT_PLACE.sides) {
    const h = slotRunIn(clear, port);
    return Array.from({ length: n }, (_, k) => {
      const left = k % 2 === 0;
      const inset = port.h / 2 + Math.floor(k / 2) * (port.h + t);
      return {
        x: left ? clear.x - placed.cx + inset : clear.x + clear.w - placed.cx - inset,
        y: clear.y - placed.y0,
        w: port.h,
        h,
        side: left ? -1 : 1,
      };
    });
  }
  const w = slotRunIn(clear, port);
  return Array.from({ length: n }, (_, k) => ({
    x: clear.x + clear.w / 2 - placed.cx,
    y: clear.y - placed.y0 + k * (port.h + t),
    w,
    h: port.h,
  }));
}

/**
 * The face a horn has: the chamber's clear face less the columns its side slots take, each a slot and a wall wide (the
 * slots stand beside the mouth, never over it).
 */
export function hornFace(
  placed: Pick<PlacedChamber, "chamber" | "clear" | "cx" | "y0">,
  t: number,
): FaceRect {
  const { clear, chamber } = placed;
  const rule = portRule(chamber);
  if (rule?.rule !== PORT_RULE.hifi) return clear;
  const { port } = rule;
  if (port.shape !== PORT_SHAPE.slot) return clear;
  const sides = slotOpeningsAt(placed, port, t).flatMap((o) => (o.side ? [o.side] : []));
  const columns = (side: -1 | 1) => sides.filter((x) => x === side).length * (port.h + t);
  return {
    ...clear,
    x: clear.x + columns(-1),
    w: Math.max(0, clear.w - columns(-1) - columns(1)),
  };
}

/** How far a set position may be off before the layout counts it as moved, in. */
const MOVED_IN = 1e-9;

/**
 * A group of parts moved together into `face`: each part's center and its half size; the least shift that puts every
 * part inside it, or the group centered on it where the group is larger. `moved`: it had to shift.
 */
function intoFace<S extends { x: number; y: number }>(
  spots: S[],
  half: (s: S) => Dims2,
  face: FaceRect,
): { spots: S[]; moved: boolean } {
  if (!spots.length) return { spots, moved: false };
  const shift = (lo: number, hi: number, faceLo: number, faceSize: number) =>
    hi - lo > faceSize
      ? faceLo + faceSize / 2 - (lo + hi) / 2
      : Math.max(faceLo - lo, Math.min(0, faceLo + faceSize - hi));
  const dx = shift(
    Math.min(...spots.map((s) => s.x - half(s).w)),
    Math.max(...spots.map((s) => s.x + half(s).w)),
    face.x,
    face.w,
  );
  const dy = shift(
    Math.min(...spots.map((s) => s.y - half(s).h)),
    Math.max(...spots.map((s) => s.y + half(s).h)),
    face.y,
    face.h,
  );
  return {
    spots: spots.map((s) => ({ ...s, x: s.x + dx, y: s.y + dy })),
    moved: Math.abs(dx) > MOVED_IN || Math.abs(dy) > MOVED_IN,
  };
}

/** The chamber's clear face in its own coordinates: from its center line across and its bottom up. */
const localClear = ({ clear, cx, y0 }: PlacedChamber): FaceRect => ({
  ...clear,
  x: clear.x - cx,
  y: clear.y - y0,
});

/**
 * A vent's spots placed at `position`: the rule's spots moved together so that their center is at it, then into the
 * chamber's clear face (`moved` where that shifts them: the views draw them there, and the page says so).
 */
function movedTo<S extends { x: number; y: number }>(
  placed: PlacedChamber,
  spots: S[],
  half: (s: S) => Dims2,
  position: VentPosition,
): { spots: S[]; moved: boolean } {
  if (!spots.length) return { spots, moved: false };
  const mean = (pick: (s: S) => number) =>
    spots.reduce((sum, s) => sum + pick(s), 0) / spots.length;
  const dx = position.xIn - mean((s) => s.x),
    dy = position.yIn - mean((s) => s.y);
  const at = spots.map((s) => ({ ...s, x: s.x + dx, y: s.y + dy }));
  return intoFace(at, half, localClear(placed));
}

/**
 * A Hi-fi round port's tubes placed: their panel, each tube's center from the chamber's center line and bottom, and
 * whether a set position was moved to keep them inside the clear face.
 */
export interface PlacedRoundPorts {
  panel: VentPanel;
  spots: RoundSpot[];
  moved: boolean;
}

/**
 * A Hi-fi round port's tubes on their chamber: at the port's `position` (the row's center, on its panel) where set,
 * each cut (its tube's outside) kept inside the clear face; else by the Hi-fi rule (lib/hifi/boxLayout
 * `roundPortSpots`: a row centered along the baffle's bottom).
 */
export function roundPortsAt(
  placed: PlacedChamber,
  port: Pick<SpeakerRoundPort, "n" | "dia" | "position">,
): PlacedRoundPorts {
  const spots = roundPortSpots(port);
  if (!port.position) return { panel: PANEL.baffle, spots, moved: false };
  const cut = (s: RoundSpot) => {
    const r = s.r + HIFI_BOX_LAYOUT.portTubeWallIn;
    return { w: r, h: r };
  };
  return { panel: port.position.panel, ...movedTo(placed, spots, cut, port.position) };
}

/** A passive radiator placed: its spot on its panel (lib/hifi/boxLayout), and its center across from the center. */
export interface PlacedRadiator extends RadiatorSpot {
  x: number;
}

/**
 * A radiator chamber's radiators on it: at the vent's `position` (the stack's center, on its panel) where set, each
 * kept inside the clear face; else by the Hi-fi rule (lib/hifi/boxLayout `radiatorSpots`: stacked up `RADIATOR_PANEL`
 * from its bottom, centered across). None for any other chamber or a radiator id the catalog doesn't have. `moved`: a
 * set position was moved to keep them inside.
 */
export function radiatorsAt(
  cabinet: Pick<SpeakerCabinet, "panel">,
  placed: PlacedChamber,
): { spots: PlacedRadiator[]; moved: boolean } {
  const { vent } = placed.chamber;
  if (vent.kind !== VENT_KIND.radiator) return { spots: [], moved: false };
  const drv = byId(HIFI_PASSIVES, vent.radiators.id);
  if (!drv) return { spots: [], moved: false };
  const panel = vent.position?.panel ?? RADIATOR_PANEL;
  const spots = radiatorSpots({ drv, n: vent.radiators.n }, panel, cabinet.panel.thicknessIn).map(
    (s) => ({ ...s, x: 0 }),
  );
  if (!vent.position) return { spots, moved: false };
  return movedTo(placed, spots, (s) => ({ w: s.shape.w / 2, h: s.shape.h / 2 }), vent.position);
}

/** Whether the chamber's vent has a set position the layout moved to keep it inside the clear face. */
export function ventMoved(cabinet: Pick<SpeakerCabinet, "panel">, placed: PlacedChamber): boolean {
  const rule = portRule(placed.chamber);
  if (rule?.rule === PORT_RULE.hifi && rule.port.shape !== PORT_SHAPE.slot)
    return roundPortsAt(placed, rule.port).moved;
  return radiatorsAt(cabinet, placed).moved;
}

/**
 * The first of the layout's shape conditions for an arch that it misses: chambers that share one shell, one chamber at
 * the top, running the shell's whole width and at least half as tall as that (the semicircle stays inside it, as the
 * tower's horn section); null when it meets them all.
 */
function archShapeBlock(layout: SpeakerLayout): ArchBlock | null {
  if (!layout.oneShell) return ARCH_BLOCK.shell;
  const top = layout.chambers.filter((c) => Math.abs(c.y0 + c.dims.h - layout.size.h) < TOUCH_IN);
  if (top.length !== 1) return ARCH_BLOCK.topChambers;
  if (Math.abs(top[0].dims.w - layout.size.w) >= TOUCH_IN) return ARCH_BLOCK.width;
  if (top[0].dims.h < layout.size.w / 2) return ARCH_BLOCK.height;
  return null;
}

/**
 * Whether the views draw the cabinet's top arched: an `arched` top whose layout meets the arch's shape conditions
 * (`archShapeBlock`). Otherwise the top is drawn flat.
 */
export const drawsArchedTop = (cabinet: Pick<SpeakerCabinet, "top">, layout: SpeakerLayout) =>
  cabinet.top === CABINET_TOP.arched && archShapeBlock(layout) === null;

/**
 * Why the cabinet's arched top is drawn and cut flat: a flush box (the arch needs a frame), else the first shape
 * condition the layout misses; null when the arch applies. The settings show it under the Top choice.
 */
export const archBlock = (
  cabinet: Pick<SpeakerCabinet, "construction">,
  layout: SpeakerLayout,
): ArchBlock | null =>
  cabinet.construction === CABINET_CONSTRUCTION.frameInset
    ? archShapeBlock(layout)
    : ARCH_BLOCK.frame;

/** A horn-loaded chamber's flare as the views draw it, inches. */
export interface HornFlare {
  /** the mouth on the baffle, centered at the horn's `mouthPosition` (absent: on the horn's face) */
  mouth: FaceRect;
  /**
   * a straight path from the throat to the mouth (lib/speaker/hornGeometry): one geometry for every view. Its `fits` is
   * false where it does not fit the chamber: the views then draw it as it is, past the walls. Null for a folded path,
   * which is its boards (`fold`)
   */
  path: HornPath | null;
  /** a folded path's boards worked out in the chamber's side section; null for a straight path */
  fold: ChamberFold | null;
  /** the mouth is larger than the horn's face: drawn at the face, every section shrunk alike */
  mouthClipped: boolean;
  /** the horn's `mouthPosition` would put the mouth past the face: drawn moved inside it */
  mouthMoved: boolean;
}

/**
 * The box round a horn chamber's drivers stacked in its bay (`hornStack`), or null for none that have a size. A
 * back-loaded horn's drivers stand on the baffle, not in a bay behind a throat: null.
 */
function driverBox(placed: PlacedChamber): Dims2 | null {
  if (driversOnBaffle(placed.chamber)) return null;
  const drivers = placed.chamber.drivers.filter((d) => !onTop(d) && driverAcrossIn(d) > 0);
  return drivers.length ? hornStack(drivers, placed.clear).box : null;
}

/**
 * The flare of a chamber's horn (its segments' areas and lengths, Hornresp's cm² and cm), throat at the back, mouth on the
 * baffle: the mouth as square as its area allows inside the horn's face (the clear face less its side slots; wider than
 * square where a square would be taller than the face, the face's width at most; cut to the face when larger than it), the
 * mouth centered at the horn's `mouthPosition` (kept inside the face), else on the face. The path is
 * `hornPath`'s, from the segments and the chamber's clear depth (as the model takes it: less the back, the baffle and the
 * baffle's inset); it has a bay (and a driver board) only where the drivers stand in the horn (not a back-loaded one's,
 * which are on the baffle). Null for a chamber with no horn, no segments, or a segment with a size that is not positive and finite.
 */
export function hornFlare(
  cabinet: Pick<SpeakerCabinet, "panel" | "construction" | "insetIn">,
  placed: PlacedChamber,
): HornFlare | null {
  const { load } = placed.chamber;
  if (load.kind !== CHAMBER_LOAD.horn || !load.horn.segments.length) return null;
  // a zero, negative or missing size draws nothing (the model names it a gap), never a NaN flare
  if (!load.horn.segments.every(isSizedSegment)) return null;
  const horn: SpeakerHorn = load.horn;
  const t = cabinet.panel.thicknessIn;
  const face = hornFace(placed, t);
  if (isFolded(horn)) {
    const fold = chamberFoldIn(cabinet, placed, horn, face);
    const [ga, gb] = fold.layout.gates.length
      ? [
          fold.layout.gates[fold.layout.gates.length - 1].a,
          fold.layout.gates[fold.layout.gates.length - 1].b,
        ]
      : [
          { z: 0, y: 0 },
          { z: 0, y: face.h },
        ];
    // the mouth is the last gate, where the last leg meets its wall: across the face, between the gate's ends
    const y0 = face.y + Math.min(ga.y, gb.y);
    const mouth = { x: face.x, y: y0, w: face.w, h: Math.abs(gb.y - ga.y) };
    return { mouth, path: null, fold, mouthClipped: false, mouthMoved: false };
  }
  const mouthArea = horn.segments[horn.segments.length - 1].s2 / CM2_PER_IN2;
  // as square as it fits: wider than square where a square would be taller than the face
  const w = Math.min(face.w, Math.max(Math.sqrt(mouthArea), mouthArea / face.h));
  const h = Math.min(face.h, mouthArea / w);
  /** what the face leaves of the mouth's area: every section is drawn that much smaller */
  const fit = (w * h) / mouthArea;
  const set = horn.mouthPosition
    ? intoFace(
        [{ x: placed.cx + horn.mouthPosition.xIn, y: placed.y0 + horn.mouthPosition.yIn }],
        () => ({ w: w / 2, h: h / 2 }),
        face,
      )
    : null;
  const [center] = set?.spots ?? [{ x: face.x + face.w / 2, y: face.y + face.h / 2 }];
  const mouth = { x: center.x - w / 2, y: center.y - h / 2, w, h };
  const path = hornPath({
    segments: horn.segments,
    areaScale: fit,
    mouth,
    drivers: driverBox(placed),
    clear: face,
    depthIn: clearDepthIn(cabinet, placed.dims),
    wallIn: t,
    frontIn: wallClearanceIn(placed.chamber.drivers),
    bodyIn: driverBodyIn(placed.chamber.drivers),
    boardIn: driverBoardIn(t, horn),
    folded: false,
  });
  if (!path) return null;
  return { mouth, path, fold: null, mouthClipped: fit < 1 - 1e-9, mouthMoved: set?.moved ?? false };
}

/**
 * A folded horn's boards worked out in its chamber's side section: the boards (`room`'s coordinates: z back from the
 * baffle's inside face, y up from the horn's face's bottom), the room, the layout (gates, sections, taps, checks), and
 * where the side section's bottom sits in the front view (`y0In`).
 */
export interface ChamberFold {
  plan: HornBoards;
  /** the boards are the automatic choice (the horn has none of its own) */
  auto: boolean;
  room: FoldRoom;
  layout: FoldLayout;
  y0In: number;
  /** the drivers' body the boards were checked with (the 3D view draws it); null without a cone */
  body: FoldDriverBody | null;
}

/**
 * A folded horn's boards in its chamber (`face` its horn face): its own, or the zigzag whose path comes nearest the
 * sections' length; worked out with the chamber's first cone as the drivers' body.
 */
function chamberFoldIn(
  cabinet: Pick<SpeakerCabinet, "panel" | "construction" | "insetIn">,
  placed: PlacedChamber,
  horn: SpeakerHorn,
  face: FaceRect,
): ChamberFold {
  const room: FoldRoom = {
    depthIn: clearDepthIn(cabinet, placed.dims),
    heightIn: face.h,
    wallIn: cabinet.panel.thicknessIn,
    widthIn: face.w,
  };
  // the same chamber in the same room is worked out once (the views, the build and the model all read it)
  const key = JSON.stringify([room, face.y]);
  const cached = FOLD_CACHE.get(placed.chamber);
  if (cached?.key === key) return cached.fold;
  const body = foldBodyOf(placed.chamber);
  const chosen =
    horn.boards ??
    autoBoards(room, horn.segments, body, horn.drive.kind, mouthAtBottom(horn, placed.dims.h));
  const plan = withDriverBoardPieces(chosen, horn.doubleBoard ? 2 : 1);
  const fold = {
    plan,
    auto: !horn.boards,
    room,
    layout: hornBoardsLayout(plan, room, body),
    y0In: face.y,
    body,
  };
  FOLD_CACHE.set(placed.chamber, { key, fold });
  return fold;
}

/**
 * The drivers' body a chamber's boards must fit: its first cone's cutout, motor, depth and excursion, and how many
 * cones it has; null without a cone.
 */
function foldBodyOf(chamber: SpeakerChamber): FoldDriverBody | null {
  const cones = chamber.drivers.flatMap((d) => {
    const cone = coneBuild(d);
    return cone ? [{ cone, count: d.count }] : [];
  });
  const first = cones[0]?.cone;
  return first
    ? foldBodyFrom(
        first.body,
        first.depthIn,
        (first.ts.Xmax ?? 0) / MM_PER_IN,
        cones.reduce((sum, c) => sum + c.count, 0),
      )
    : null;
}

/**
 * The side section a chamber's folded horn lays out in, and the drivers' body its boards must fit, as the chamber
 * stands in the cabinet (found by its place); null for a chamber that is not in the cabinet.
 */
export function foldRoomOf(
  cabinet: LayoutCabinet & Pick<SpeakerCabinet, "panel" | "construction" | "insetIn">,
  chamber: SpeakerChamber,
): { room: FoldRoom; body: FoldDriverBody | null } | null {
  const index = cabinet.chambers.findIndex(
    (c) => c === chamber || (c.at.xIn === chamber.at.xIn && c.at.yIn === chamber.at.yIn),
  );
  const laid = {
    ...cabinet,
    chambers: cabinet.chambers.map((c, i) => (i === index ? chamber : c)),
  };
  const placed = index >= 0 ? speakerLayout(laid).chambers[index] : undefined;
  if (!placed) return null;
  const face = hornFace(placed, cabinet.panel.thicknessIn);
  return {
    room: {
      depthIn: clearDepthIn(cabinet, placed.dims),
      heightIn: face.h,
      wallIn: cabinet.panel.thicknessIn,
      widthIn: face.w,
    },
    body: foldBodyOf(chamber),
  };
}

/**
 * The layouts the automatic choice and Design from goals try for a drive: zigzags of each leg count, turn width and
 * growth; a tapped horn's with its drivers on the first board or the last, an offset horn's over a sealed rear chamber
 * of each height (none without a driver's body to size it), a front-loaded horn's with its throat at the closed end.
 */
export const zigzagTries = (
  room: FoldRoom,
  kind: SpeakerHorn["drive"]["kind"],
  body: FoldDriverBody | null,
  bottom = false,
): HornBoards[] =>
  bottom
    ? layoutTries(room, kind, body).map((plan) => mirroredBoards(plan, room.heightIn))
    : layoutTries(room, kind, body);

/** The layouts for a drive, mouth at the top (`zigzagTries`). */
const layoutTries = (
  room: FoldRoom,
  kind: SpeakerHorn["drive"]["kind"],
  body: FoldDriverBody | null,
): HornBoards[] => {
  if (kind === HORN_DRIVE.offset) return body ? offsetPlans(room, body.cutoutIn) : [];
  const tapped = kind === HORN_DRIVE.tapped;
  return zigzagPlans(room, tapped).flatMap((plan) =>
    // a tapped horn's drivers on the first board, or the last: their backs into the mouth's leg, the tallest
    tapped && plan.drivers && plan.boards.length > 1 ? [plan, onLastBoard(plan)] : [plan],
  );
};

/** Each odd leg count, rear chamber height (as a share of the height), turn width and growth of the offset zigzag. */
const offsetPlans = (room: FoldRoom, cutoutIn: number): HornBoards[] =>
  Array.from({ length: FOLD_AUTO_MAX_LEGS / 2 }, (_, i) =>
    FOLD_OFFSET_REAR_SHARES.flatMap((rear) =>
      FOLD_AUTO_TURN_SHARES.flatMap((share) =>
        FOLD_AUTO_GROWTHS.map((growth) =>
          offsetZigzagBoards(room, 2 * i + 1, room.heightIn * rear, cutoutIn, share, growth),
        ),
      ),
    ),
  ).flat();

/** A tapped zigzag with its drivers moved to its last board, midway along it, the fronts down into the leg below. */
function onLastBoard(plan: HornBoards): HornBoards {
  const at = plan.boards.length - 1;
  const board = plan.boards[at];
  const a = plan.corners[board.a],
    b = plan.corners[board.b];
  return {
    ...plan,
    drivers: { board: at, alongIn: Math.hypot(b.z - a.z, b.y - a.y) / 2, coneFace: FOLD_FACE.line },
  };
}

/** Each even leg count, turn width and growth of the zigzag. */
const zigzagPlans = (room: FoldRoom, tapped: boolean): HornBoards[] =>
  Array.from({ length: FOLD_AUTO_MAX_LEGS / 2 }, (_, i) =>
    FOLD_AUTO_TURN_SHARES.flatMap((share) =>
      FOLD_AUTO_GROWTHS.map((growth) => zigzagBoards(room, 2 * (i + 1), tapped, share, growth)),
    ),
  ).flat();

/** The boards with the drivers' board `pieces` panels thick (the horn's Double setting). */
function withDriverBoardPieces(plan: HornBoards, pieces: 1 | 2): HornBoards {
  const at = plan.drivers?.board;
  if (at === undefined) return plan;
  return { ...plan, boards: plan.boards.map((b, i) => (i === at ? { ...b, pieces } : b)) };
}

/** Each folded chamber's boards worked out, with the room they were worked out in (`chamberFoldIn`). */
const FOLD_CACHE = new WeakMap<SpeakerChamber, { key: string; fold: ChamberFold }>();

/** What a failed check costs a layout in the automatic choice, in of path: more than any path's difference. */
const FAILED_LAYOUT_IN = 1e6;

/**
 * The zigzag (each even leg count, each turn width) that passes every check, if one does, whose path comes nearest the
 * sections' length (the even leg counts up to `FOLD_AUTO_MAX_LEGS`): a tapped
 * horn's with its drivers on the first board, another's with its throat at the closed end.
 */
function autoBoards(
  room: FoldRoom,
  segments: readonly HornSegment[],
  body: FoldDriverBody | null,
  kind: SpeakerHorn["drive"]["kind"],
  bottom: boolean,
): HornBoards {
  const wantIn = segments.reduce((sum, s) => sum + s.length, 0) / CM_PER_IN;
  const found = zigzagTries(room, kind, body, bottom);
  // with nothing to try (an offset horn with no cone), a front-loaded zigzag
  const tries = found.length ? found : zigzagTries(room, HORN_DRIVE.front, body, bottom);
  // a layout that passes every check beats one that does not; then the path nearest the sections'
  const cost = (plan: HornBoards) => {
    const layout = hornBoardsLayout(plan, room, body);
    return (foldPasses(layout) ? 0 : FAILED_LAYOUT_IN) + Math.abs(layout.pathIn - wantIn);
  };
  // a cost that is not a number (sizes being typed) counts as the worst
  const costs = tries.map((plan) => {
    const c = cost(plan);
    return Number.isFinite(c) ? c : Infinity;
  });
  const best = costs.indexOf(Math.min(...costs));
  return tries[best < 0 ? 0 : best];
}

/** A folded horn chamber's boards worked out (`ChamberFold`), found in the cabinet; null for any other chamber. */
export function chamberFold(
  cabinet: LayoutCabinet & Pick<SpeakerCabinet, "panel" | "construction" | "insetIn">,
  chamber: SpeakerChamber,
): ChamberFold | null {
  // the chamber itself, or an edited copy of the one at its place: laid out in that place
  const index = cabinet.chambers.findIndex(
    (c) => c === chamber || (c.at.xIn === chamber.at.xIn && c.at.yIn === chamber.at.yIn),
  );
  if (index < 0) return null;
  const laid =
    cabinet.chambers[index] === chamber
      ? cabinet
      : { ...cabinet, chambers: cabinet.chambers.map((c, i) => (i === index ? chamber : c)) };
  const placed = speakerLayout(laid).chambers[index];
  return (placed && hornFlare(laid, placed)?.fold) ?? null;
}

/** A box in the front view by its edges, in. */
export interface EdgeBox {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** The box of width `w` and height `h` centered at (x, y). */
const boxAt = (x: number, y: number, w: number, h: number): EdgeBox => ({
  x0: x - w / 2,
  x1: x + w / 2,
  y0: y - h / 2,
  y1: y + h / 2,
});

/** How far two boxes may overlap before they count as overlapping, in: a shared edge is no overlap. */
const OVERLAP_IN = 1e-9;
/** The step the search for a free place moves by, in. */
export const SCAN_STEP_IN = 0.25;

const overlapping = (a: EdgeBox, b: EdgeBox) =>
  a.x0 < b.x1 - OVERLAP_IN &&
  b.x0 < a.x1 - OVERLAP_IN &&
  a.y0 < b.y1 - OVERLAP_IN &&
  b.y0 < a.y1 - OVERLAP_IN;

/**
 * What a driver covers on its baffle, in, across and up: a cone's nominal size or frame, a tweeter's plate or horn, a
 * compression driver's horn. A baffle horn the cutout trims to the clear face (a rectangular or meshed horn: `hornFits`)
 * is no wider than `clear`. No other driver, port or slot may overlap it.
 */
export function driverFrame(driver: SpeakerDriver, clear: Dims2): Dims2 {
  const horn = driverHorn(driver);
  const across = driverAcrossIn(driver);
  switch (driver.kind) {
    case DRIVER_KIND.tweeter: {
      if (horn) return { w: horn.size.w, h: horn.size.h };
      const tweeter = hifiDriverById("tweeter", driver.driverId);
      const face = tweeter && (tweeter.ownGuide ?? tweeter.faceplate);
      return { w: face?.w ?? 0, h: face?.h ?? 0 };
    }
    case DRIVER_KIND.compression: {
      if (!horn) return { w: across, h: across };
      const trimmed = !!horn.rect || MESHED_HORN_IDS.has(horn.id);
      return { w: trimmed ? Math.min(horn.size.w, clear.w) : horn.size.w, h: horn.size.h };
    }
    default:
      return { w: across, h: across };
  }
}

/**
 * A driver's cutout in its baffle, in, across and up: a cone's round hole (the cutlist's), a plate's or a horn's own.
 * It stays inside the baffle's panel (the frame round it may reach the panel's edge).
 */
export function driverFootprint(driver: SpeakerDriver, clear: Dims2): Dims2 {
  const round = (diameter: number): Dims2 => ({ w: diameter, h: diameter });
  const hifiCutout = (size: number) =>
    round(HIFI_DRIVER_CUTOUT_IN[size] ?? size * HIFI_GENERIC_BODIES.cutoutPerSize);
  switch (driver.kind) {
    case DRIVER_KIND.sub: {
      const sub = byId(SUB_OPTIONS, driver.driverId);
      return sub ? round(DRIVER_CUTOUT_IN[sub.size]) : round(0);
    }
    case DRIVER_KIND.mid: {
      const mid = byId(MID_OPTIONS, driver.driverId);
      return mid ? round(DRIVER_CUTOUT_IN[mid.size]) : round(0);
    }
    case DRIVER_KIND.woofer: {
      const woofer = hifiDriverById("woofer", driver.driverId);
      return woofer ? hifiCutout(woofer.size) : round(0);
    }
    case DRIVER_KIND.coaxial: {
      const coax = byId(FILL_OPTIONS, driver.driverId);
      return coax ? hifiCutout(coax.size) : round(0);
    }
    default:
      return driverFrame(driver, clear);
  }
}

/**
 * One driver entry's drivers as a group on the baffle: each driver's center from the group's own, and the group's size
 * by what it covers (`frame`) and by its cutouts (`cutout`).
 */
function driverGroup(driver: SpeakerDriver, clear: Dims2) {
  const offsets = groupOffsets(driver);
  const span = offsets[offsets.length - 1] - offsets[0];
  const sized = ({ w, h }: Dims2): Dims2 => ({ w: span + w, h });
  return {
    offsets,
    frame: sized(driverFrame(driver, clear)),
    cutout: sized(driverFootprint(driver, clear)),
  };
}

/**
 * The drivers of a horn-loaded chamber stacked and centered, as the bay holds them: each entry's drivers side by side
 * (as on a baffle), the entries one above the other, the first at the bottom, a gap (`DRIVER_GAP_IN`, less where the
 * clear face is not tall enough for it) apart. Each driver's center from the stack's own, and the box round the stack.
 */
function hornStack(drivers: readonly SpeakerDriver[], clear: Dims2) {
  const groups = drivers.map((d) => {
    const { offsets, frame } = driverGroup(d, clear);
    return { driver: d, offsets, size: frame };
  });
  const total = groups.reduce((sum, g) => sum + g.size.h, 0);
  const gap =
    groups.length > 1
      ? Math.min(DRIVER_GAP_IN, Math.max(0, (clear.h - total) / (groups.length - 1)))
      : 0;
  const height = total + gap * Math.max(0, groups.length - 1);
  let y = -height / 2;
  const rows = groups.map((g) => {
    const row = { driver: g.driver, dy: y + g.size.h / 2, offsets: g.offsets };
    y += g.size.h + gap;
    return row;
  });
  return { rows, box: { w: Math.max(0, ...groups.map((g) => g.size.w)), h: height } };
}

/**
 * The openings in a chamber's baffle that no driver may overlap, as boxes in the front view: the Hi-fi slots (the stack
 * along the floor with its shelves, or each column up the sides), the Hi-fi round ports and the radiators on the baffle,
 * the PA port's openings (its tubes, its side ducts, its letterbox's band), and a back-loaded horn's mouth.
 */
export function baffleOpenings(cabinet: LayoutCabinet, placed: PlacedChamber): EdgeBox[] {
  const t = cabinet.panel.thicknessIn;
  const { clear, cx, y0, chamber } = placed;
  const boxes: EdgeBox[] = [];
  const rule = portRule(chamber);
  if (rule?.rule === PORT_RULE.pa) {
    const plan = subVentPlan(rule.sub, placed.dims, rule.portStyle, rule.portGeom, t);
    for (const o of subVentOpenings(plan, placed.dims, t))
      boxes.push(
        o.shape === "circle"
          ? boxAt(cx + o.x, y0 + o.y, 2 * o.r, 2 * o.r)
          : boxAt(cx + o.x, y0 + o.y, o.w, o.h),
      );
    // the letterbox's band along the floor, under its shelf
    if (plan.bandH > 0)
      boxes.push({ x0: clear.x, x1: clear.x + clear.w, y0: clear.y, y1: clear.y + plan.bandH });
  } else if (rule?.rule === PORT_RULE.hifi) {
    const { port } = rule;
    if (port.shape === PORT_SHAPE.slot) {
      const openings = slotOpeningsAt(placed, port, t);
      if (port.place === SLOT_PLACE.sides) {
        // a column of each side's slots and their walls, from the wall in
        for (const side of [-1, 1] as const) {
          const n = openings.filter((o) => o.side === side).length;
          if (n === 0) continue;
          const width = n * (port.h + t);
          boxes.push({
            x0: side < 0 ? clear.x : clear.x + clear.w - width,
            x1: side < 0 ? clear.x + width : clear.x + clear.w,
            y0: clear.y,
            y1: clear.y + clear.h,
          });
        }
      } else {
        // the stack along the floor, with the shelf over its top slot
        const top = openings[openings.length - 1];
        boxes.push({
          x0: clear.x,
          x1: clear.x + clear.w,
          y0: clear.y,
          y1: y0 + top.y + top.h + t,
        });
      }
    } else {
      const { panel, spots } = roundPortsAt(placed, port);
      if (panel === PANEL.baffle)
        for (const s of spots) {
          const d = 2 * (s.r + HIFI_BOX_LAYOUT.portTubeWallIn);
          boxes.push(boxAt(cx + s.x, y0 + s.y, d, d));
        }
    }
  }
  for (const s of radiatorsAt(cabinet, placed).spots)
    if (s.panel === PANEL.baffle) boxes.push(boxAt(cx + s.x, y0 + s.y, s.shape.w, s.shape.h));
  // a back-loaded horn's mouth is on the baffle, apart from its drivers
  if (chamber.load.kind === CHAMBER_LOAD.horn && chamber.load.horn.drive.kind === HORN_DRIVE.back) {
    const flare = hornFlare(cabinet, placed);
    if (flare)
      boxes.push({
        x0: flare.mouth.x,
        x1: flare.mouth.x + flare.mouth.w,
        y0: flare.mouth.y,
        y1: flare.mouth.y + flare.mouth.h,
      });
  }
  return boxes;
}

/** The most entries whose every order is tried when one leaves another no room (`orders`). */
export const MAX_PERMUTED = 5;

/**
 * The orders to place `items` in: as they are, then the other orders (every one for a few items, else only the reverse),
 * so a place found for one never has to leave another none.
 */
export function* orders<T>(items: readonly T[]): Generator<readonly T[]> {
  yield items;
  if (items.length < 2) return;
  if (items.length > MAX_PERMUTED) {
    yield [...items].reverse();
    return;
  }
  const permute = function* (rest: readonly T[], head: readonly T[]): Generator<readonly T[]> {
    if (rest.length === 0) {
      yield head;
      return;
    }
    for (let i = 0; i < rest.length; i++)
      yield* permute([...rest.slice(0, i), ...rest.slice(i + 1)], [...head, rest[i]]);
  };
  // the spec's own order came first; skip it here
  let skipped = false;
  for (const order of permute(items, [])) {
    if (!skipped && order.every((item, i) => item === items[i])) {
      skipped = true;
      continue;
    }
    yield order;
  }
}

/** A center along one axis kept so that a part of `size` stays inside [lo, lo + span] (centered where it is larger). */
const keptIn = (at: number, size: number, lo: number, span: number) =>
  size >= span ? lo + span / 2 : Math.min(lo + span - size / 2, Math.max(lo + size / 2, at));

/**
 * The place nearest `want` for a part whose cutouts are `size` across and up inside `face`, and that covers `frame`
 * clear of every box in `taken`: `want` kept inside the face, else the nearest place beside a box it meets (or, failing
 * that, the nearest free place on a grid). Where no free place exists (the face is too full), `want` kept inside the
 * face, and `free` is false.
 */
export function nearestFree(
  face: FaceRect,
  { size, frame }: { size: Dims2; frame: Dims2 },
  want: { x: number; y: number },
  taken: readonly EdgeBox[],
): { x: number; y: number; free: boolean } {
  const kept = {
    x: keptIn(want.x, size.w, face.x, face.w),
    y: keptIn(want.y, size.h, face.y, face.h),
  };
  const free = (c: { x: number; y: number }) =>
    !taken.some((b) => overlapping(boxAt(c.x, c.y, frame.w, frame.h), b));
  const inside = (c: { x: number; y: number }) =>
    c.x - size.w / 2 >= face.x - OVERLAP_IN &&
    c.x + size.w / 2 <= face.x + face.w + OVERLAP_IN &&
    c.y - size.h / 2 >= face.y - OVERLAP_IN &&
    c.y + size.h / 2 <= face.y + face.h + OVERLAP_IN;
  if (free(kept)) return { ...kept, free: true };
  const near = (list: { x: number; y: number }[]) =>
    list
      .filter((c) => inside(c) && free(c))
      .sort(
        (a, b) => Math.hypot(a.x - want.x, a.y - want.y) - Math.hypot(b.x - want.x, b.y - want.y),
      )[0];
  // beside each box in the way: touching its edge across, up, or both
  const beside = taken.flatMap((b) => {
    const xs = [b.x1 + frame.w / 2, b.x0 - frame.w / 2],
      ys = [b.y1 + frame.h / 2, b.y0 - frame.h / 2];
    return [
      ...xs.map((x) => ({ x, y: kept.y })),
      ...ys.map((y) => ({ x: kept.x, y })),
      ...xs.flatMap((x) => ys.map((y) => ({ x, y }))),
    ];
  });
  const found = near(beside);
  if (found) return { ...found, free: true };
  const grid: { x: number; y: number }[] = [];
  for (
    let x = face.x + size.w / 2;
    x <= face.x + face.w - size.w / 2 + OVERLAP_IN;
    x += SCAN_STEP_IN
  )
    for (
      let y = face.y + size.h / 2;
      y <= face.y + face.h - size.h / 2 + OVERLAP_IN;
      y += SCAN_STEP_IN
    )
      grid.push({ x, y });
  const onGrid = near(grid);
  return onGrid ? { ...onGrid, free: true } : { ...kept, free: false };
}

/**
 * Where a chamber's drivers stand (see `driverSpots`):
 * - on a baffle (a direct chamber's, a back-loaded horn's): each entry's drivers as one group at the spec's position,
 *   kept inside the clear face (their footprints, cutouts and frames) and off the drivers before it and every opening
 *   in the baffle (`baffleOpenings`), at the nearest place where that holds;
 * - in a front-loaded or tapped horn's chamber: stacked and centered in the bay behind the throat (`hornStack`), at the
 *   bay the horn's path gives them (lib/speaker/hornGeometry), else at the center of the horn's face.
 * A horn on the top, and a horn that no longer fits where it is set, stay as the spec has them (the views leave the
 * second out).
 */
function placeDrivers(
  cabinet: LayoutCabinet,
  placed: PlacedChamber,
): Map<SpeakerDriver, FacePoint[]> {
  const spots = new Map<SpeakerDriver, FacePoint[]>();
  const drivers = placed.chamber.drivers.filter(
    (d) => !onTop(d) && driverAcrossIn(d) > 0 && hornFitsWhereSet(placed, d),
  );
  if (!drivers.length) return spots;
  if (driversOnBaffle(placed.chamber)) {
    const openings = baffleOpenings(cabinet, placed);
    /** the drivers placed one after the other in `order`, each at the nearest free place; whether every one found one */
    const placeIn = (order: readonly SpeakerDriver[]) => {
      const taken = [...openings];
      const out = new Map<SpeakerDriver, FacePoint[]>();
      let allFree = true;
      for (const d of order) {
        const { offsets, frame, cutout } = driverGroup(d, placed.clear);
        const c = nearestFree(
          placed.clear,
          { size: cutout, frame },
          { x: placed.cx + d.position.xIn, y: placed.y0 + d.position.yIn },
          taken,
        );
        allFree &&= c.free;
        taken.push(boxAt(c.x, c.y, frame.w, frame.h));
        out.set(
          d,
          offsets.map((dx) => ({ xIn: c.x + dx, yIn: c.y })),
        );
      }
      return { spots: out, allFree };
    };
    // a driver placed first can leave a later one no room: another order may fit them all (the spec's order first)
    let first: Map<SpeakerDriver, FacePoint[]> | null = null;
    for (const order of orders(drivers)) {
      const placedIn = placeIn(order);
      first ??= placedIn.spots;
      if (placedIn.allFree) return placedIn.spots;
    }
    return first ?? spots;
  }
  const stack = hornStack(drivers, placed.clear);
  const bay = hornFlare(cabinet, placed)?.path?.bay;
  const face = hornFace(placed, cabinet.panel.thicknessIn);
  const center = bay
    ? { x: bay.x + bay.w / 2, y: bay.y + bay.h / 2 }
    : {
        x: keptIn(face.x + face.w / 2, stack.box.w, face.x, face.w),
        y: keptIn(face.y + face.h / 2, stack.box.h, face.y, face.h),
      };
  for (const row of stack.rows)
    spots.set(
      row.driver,
      row.offsets.map((dx) => ({ xIn: center.x + dx, yIn: center.y + row.dy })),
    );
  return spots;
}

/**
 * The cabinet with every baffle driver's position set to where the layout stands it (`placeDrivers`): a typed position
 * that would leave the baffle, or overlap another driver or opening, is kept at the nearest place that does not. A
 * horn-loaded chamber's drivers have no position to set (the bay places them) and stay as they are. The same cabinet
 * back when nothing moves.
 */
export function settledCabinet(cabinet: SpeakerCabinet): SpeakerCabinet {
  const layout = speakerLayout(cabinet);
  let moved = false;
  const chambers = cabinet.chambers.map((chamber, i) => {
    const placed = layout.chambers[i];
    if (!driversOnBaffle(chamber)) return chamber;
    const drivers = chamber.drivers.map((d) => {
      const at = placed.spots.get(d);
      if (!at?.length) return d;
      const xIn = at.reduce((sum, s) => sum + s.xIn, 0) / at.length - placed.cx;
      const yIn = at[0].yIn - placed.y0;
      if (Math.abs(xIn - d.position.xIn) < MOVED_IN && Math.abs(yIn - d.position.yIn) < MOVED_IN)
        return d;
      moved = true;
      return { ...d, position: { xIn, yIn } };
    });
    return { ...chamber, drivers };
  });
  return moved ? { ...cabinet, chambers } : cabinet;
}

/**
 * The box a chamber's hardware is placed on, in the front view: the chamber's own box with a wall added where another
 * chamber gives it one (so the box is whole, as the cutlist and the weights place the hardware on it), its center line
 * `cx` across and its bottom `y0` up from the cabinet's bottom.
 */
export function chamberHardwareBox(
  cabinet: Pick<SpeakerCabinet, "chambers" | "panel">,
  placed: Pick<PlacedChamber, "chamber" | "cx" | "y0" | "dims">,
): { box: Dims3; cx: number; y0: number } {
  const t = cabinet.panel.thicknessIn;
  const { below, left } = sharedWalls(cabinet, placed.chamber);
  return {
    box: {
      w: placed.dims.w + (left ? t : 0),
      h: placed.dims.h + (below ? t : 0),
      d: placed.dims.d,
    },
    cx: placed.cx - (left ? t / 2 : 0),
    y0: placed.y0 - (below ? t : 0),
  };
}

/**
 * A speaker's extent, in: its layout, across from the cabinet's center line (`minX`, `maxX`) and up from its bottom
 * (`maxY`), the horns standing on its top included. Each such horn's box (`topHorns`) is its mouth's width and height
 * and its body's depth, `HORN_LIFT_IN` above its lid and back from the front by its position's `yIn`, as the 3D view
 * sets it (x and y its box's bottom center at the mouth, z its mouth's distance back from the front).
 */
export function speakerBounds(cabinet: LayoutCabinet) {
  const layout = speakerLayout(cabinet);
  const topHorns = layout.chambers.flatMap((placed) =>
    placed.chamber.drivers.flatMap((d) => {
      const horn = driverHorn(d);
      return horn && onTop(d) && hornFitsWhereSet(placed, d)
        ? driverSpots(placed, d).map((s) => ({
            x: s.xIn,
            y: s.yIn + HORN_LIFT_IN,
            z: d.position.yIn,
            ...horn.size,
          }))
        : [];
    }),
  );
  return {
    layout,
    topHorns,
    minX: Math.min(-layout.size.w / 2, ...topHorns.map((h) => h.x - h.w / 2)),
    maxX: Math.max(layout.size.w / 2, ...topHorns.map((h) => h.x + h.w / 2)),
    maxY: Math.max(layout.size.h, ...topHorns.map((h) => h.y + h.h)),
  };
}
