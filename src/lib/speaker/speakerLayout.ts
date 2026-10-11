// Where a speaker spec's parts sit in its cabinet's front view, inches: the chambers at their `at` positions and the
// walls two of them share (`sharedWalls`, the lower or left chamber's), each driver entry's drivers, the port by the
// rule of the engine it comes from, and a horn-loaded chamber's mouth. The 3D view (stack-view/buildSpeakerScene) and
// the front drawing (drawings/SpeakerFront) both read it. x is across from the cabinet's center line (+ to the right
// seen from the front), y up from the cabinet's bottom. Both views draw the left speaker of a pair, so a driver's
// `xIn` (+ toward the pair's inside) is + to the right, as the Hi-fi page draws it. Pure.
import type {
  Dims2,
  Dims3,
  FacePoint,
  Horn,
  PaPortGeometry,
  PortStyle,
  RoundPort,
  SlotPort,
  SpeakerCabinet,
  SpeakerChamber,
  SpeakerDriver,
  SpeakerHorn,
  SpeakerPort,
  SubDriver,
} from "../../types";
import {
  CD_OPTIONS,
  FILL_OPTIONS,
  MID_OPTIONS,
  SUB_OPTIONS,
  hifiDriverById,
  hornById,
} from "../data";
import { byId } from "../tables";
import { DEFAULT_PA } from "../defaults";
import { sharedWalls, TOUCH_IN } from "./chamberAir";
import { HIFI_FRONT_PARTS } from "../../constants/hifiScene";
import { CM_PER_IN } from "../../constants/units";
import { PORT_STYLE } from "../../constants/portStyles";
import {
  CHAMBER_LOAD,
  DRIVER_KIND,
  HORN_DRIVE,
  HORN_PATH,
  HORN_PLACEMENT,
  PORT_SHAPE,
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

/** The cabinet's chambers placed in its front view, with the walls they build and share. */
export function speakerLayout(cabinet: Pick<SpeakerCabinet, "chambers" | "panel">): SpeakerLayout {
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
    };
  });
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

/**
 * Where an entry's `count` drivers sit: side by side across its position, a driver's width and a gap apart. On the
 * baffle, each center (`position` from the chamber's center line and its bottom); a horn on the top stands on the
 * chamber's top, at its `xIn`.
 */
export function driverSpots(placed: PlacedChamber, driver: SpeakerDriver): FacePoint[] {
  const pitch = driverAcrossIn(driver) + DRIVER_GAP_IN;
  const y = onTop(driver) ? placed.y0 + placed.dims.h : placed.y0 + driver.position.yIn;
  return Array.from({ length: Math.max(1, driver.count) }, (_, i) => ({
    xIn: placed.cx + driver.position.xIn + (i - (driver.count - 1) / 2) * pitch,
    yIn: y,
  }));
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
  | { rule: typeof PORT_RULE.hifi; port: RoundPort | SlotPort };

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
        ? pa(PORT_STYLE.slot, { ductH: port.h, tubeLen: port.len })
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

/** A horn-loaded chamber's flare as the views draw it, inches. */
export interface HornFlare {
  /** the mouth on the baffle, centered on the chamber's clear face */
  mouth: FaceRect;
  /** each segment's throat and mouth, of the mouth's shape, and its length back from the front */
  segments: { throat: Dims2; mouth: Dims2; length: number }[];
  /**
   * the path is drawn straight as a placeholder: a folded path (its fold layout comes later), or one longer than the
   * chamber is deep, shortened to fit
   */
  placeholder: boolean;
  /** the mouth is larger than the clear face: drawn at the clear face, every section shrunk alike */
  mouthClipped: boolean;
}

/** An area of `areaIn2` in the shape of `like` (its width over its height), in. */
const shaped = (areaIn2: number, like: Dims2): Dims2 => {
  const aspect = like.w / like.h;
  return { w: Math.sqrt(areaIn2 * aspect), h: Math.sqrt(areaIn2 / aspect) };
};

/**
 * The flare of a chamber's horn (its segments' areas and lengths, Hornresp's cm² and cm), throat at the back, mouth on
 * the baffle: the mouth as square as its area allows inside the clear face (it runs the clear width when wider than
 * that, and is cut to the clear face when larger than it), each section the mouth's shape; the path at most the chamber's clear depth (as the model takes it: less the
 * back, the baffle and the inset). Null for a chamber with no horn or no segments.
 */
export function hornFlare(
  cabinet: Pick<SpeakerCabinet, "panel" | "insetIn">,
  placed: PlacedChamber,
): HornFlare | null {
  const { load } = placed.chamber;
  if (load.kind !== CHAMBER_LOAD.horn || !load.horn.segments.length) return null;
  const horn: SpeakerHorn = load.horn;
  const areaIn2 = (cm2: number) => cm2 / (CM_PER_IN * CM_PER_IN);
  const { clear } = placed;
  const mouthArea = areaIn2(horn.segments[horn.segments.length - 1].s2);
  const w = Math.min(clear.w, Math.sqrt(mouthArea));
  const h = Math.min(clear.h, mouthArea / w);
  /** what the clear face leaves of the mouth's area: every section is drawn that much smaller */
  const fit = (w * h) / mouthArea;
  const mouth = { x: clear.x + (clear.w - w) / 2, y: clear.y + (clear.h - h) / 2, w, h };
  const pathIn = horn.segments.reduce((sum, s) => sum + s.length, 0) / CM_PER_IN;
  const depthIn = placed.dims.d - 2 * cabinet.panel.thicknessIn - cabinet.insetIn;
  const placeholder = horn.path === HORN_PATH.folded || pathIn > depthIn;
  const scale = placeholder && pathIn > 0 ? Math.min(1, depthIn / pathIn) : 1;
  return {
    mouth,
    segments: horn.segments.map((s) => ({
      throat: shaped(areaIn2(s.s1) * fit, mouth),
      mouth: shaped(areaIn2(s.s2) * fit, mouth),
      length: (s.length / CM_PER_IN) * scale,
    })),
    placeholder,
    mouthClipped: fit < 1 - 1e-9,
  };
}
