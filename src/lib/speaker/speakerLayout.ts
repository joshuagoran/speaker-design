// Where a speaker spec's parts sit in its cabinet's front view, inches: the chambers at their `at` positions and the
// walls two of them share (`sharedWalls`, the lower or left chamber's), each driver entry's drivers, the port by the
// rule of the engine it comes from (a Hi-fi round port or radiators at their own position where set), and a
// horn-loaded chamber's mouth (at its own position where set). The 3D view (stack-view/buildSpeakerScene) and
// the front drawing (drawings/SpeakerFront) both read it. x is across from the cabinet's center line (+ to the right
// seen from the front), y up from the cabinet's bottom. Both views draw the left speaker of a pair, so a driver's
// `xIn` (+ toward the pair's inside) is + to the right, as the Hi-fi page draws it. Pure.
import type {
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
import { DEFAULT_PA } from "../defaults";
import { baffleInsetIn, sharedWalls, TOUCH_IN } from "./chamberAir";
import { RADIATOR_PANEL } from "../hifi/hifi";
import {
  radiatorSpots,
  roundPortSpots,
  type RadiatorSpot,
  type RoundSpot,
} from "../hifi/boxLayout";
import { PANEL } from "../../constants/cutParts";
import { HIFI_FRONT_PARTS } from "../../constants/hifiScene";
import { HIFI_BOX_LAYOUT } from "../../constants/hifiLayout";
import { CM_PER_IN } from "../../constants/units";
import { PORT_STYLE } from "../../constants/portStyles";
import {
  CABINET_TOP,
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
 * Whether a catalog horn fits where it would sit on a chamber. In the baffle: its mouth inside the chamber's clear face
 * (a rectangular horn's width runs to the clear face, as the tower cuts it, so only its height must fit). On the top:
 * its mouth no wider than the chamber, and no chamber standing on this one.
 */
export function hornFits(
  horn: Pick<Horn, "size" | "rect">,
  placed: Pick<PlacedChamber, "clear" | "dims" | "walls">,
  placement: HornPlacement,
): boolean {
  if (placement === HORN_PLACEMENT.top)
    return horn.size.w <= placed.dims.w && !placed.walls.some((w) => w.shared && w.w >= w.h);
  return horn.size.h <= placed.clear.h && (!!horn.rect || horn.size.w <= placed.clear.w);
}

/**
 * Where a newly picked horn sits on a chamber: the catalog's `rect` flag sets the first choice (a rectangular horn in
 * the baffle, a round one freestanding on the top, as the Hi-fi page's waveguides), where it fits (`hornFits`); else the
 * other place. The user can pick either place that fits.
 */
export function defaultHornPlacement(
  horn: Pick<Horn, "size" | "rect">,
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
 * Whether the views draw the cabinet's top arched: an `arched` top over chambers that share one shell, its top chamber
 * running the shell's whole width and at least half as tall as that (the semicircle stays inside it, as the tower's
 * horn section). Otherwise the top is drawn flat.
 */
export function drawsArchedTop(
  cabinet: Pick<SpeakerCabinet, "top">,
  layout: SpeakerLayout,
): boolean {
  if (cabinet.top !== CABINET_TOP.arched || !layout.oneShell) return false;
  const top = layout.chambers.filter((c) => Math.abs(c.y0 + c.dims.h - layout.size.h) < TOUCH_IN);
  return (
    top.length === 1 &&
    Math.abs(top[0].dims.w - layout.size.w) < TOUCH_IN &&
    top[0].dims.h >= layout.size.w / 2
  );
}

/** A horn-loaded chamber's flare as the views draw it, inches. */
export interface HornFlare {
  /** the mouth on the baffle, centered at the horn's `mouthPosition` (absent: on the chamber's clear face) */
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
  /** the horn's `mouthPosition` would put the mouth past the clear face: drawn moved inside it */
  mouthMoved: boolean;
}

/** An area of `areaIn2` in the shape of `like` (its width over its height), in. */
const shaped = (areaIn2: number, like: Dims2): Dims2 => {
  const aspect = like.w / like.h;
  return { w: Math.sqrt(areaIn2 * aspect), h: Math.sqrt(areaIn2 / aspect) };
};

/**
 * The flare of a chamber's horn (its segments' areas and lengths, Hornresp's cm² and cm), throat at the back, mouth on
 * the baffle: the mouth as square as its area allows inside the clear face (wider than square where a square would be
 * taller than the face, the clear width at most; cut to the clear face when larger than it), each section the mouth's shape; the mouth centered at the
 * horn's `mouthPosition` (kept inside the clear face), else on the clear face; the path at most the chamber's clear
 * depth (as the model takes it: less the back, the baffle and the baffle's inset). Null for a chamber with no horn or
 * no segments.
 */
export function hornFlare(
  cabinet: Pick<SpeakerCabinet, "panel" | "construction" | "insetIn">,
  placed: PlacedChamber,
): HornFlare | null {
  const { load } = placed.chamber;
  if (load.kind !== CHAMBER_LOAD.horn || !load.horn.segments.length) return null;
  const horn: SpeakerHorn = load.horn;
  const areaIn2 = (cm2: number) => cm2 / (CM_PER_IN * CM_PER_IN);
  const { clear } = placed;
  const mouthArea = areaIn2(horn.segments[horn.segments.length - 1].s2);
  // as square as it fits: wider than square where a square would be taller than the clear face
  const w = Math.min(clear.w, Math.max(Math.sqrt(mouthArea), mouthArea / clear.h));
  const h = Math.min(clear.h, mouthArea / w);
  /** what the clear face leaves of the mouth's area: every section is drawn that much smaller */
  const fit = (w * h) / mouthArea;
  const set = horn.mouthPosition
    ? intoFace(
        [{ x: placed.cx + horn.mouthPosition.xIn, y: placed.y0 + horn.mouthPosition.yIn }],
        () => ({ w: w / 2, h: h / 2 }),
        clear,
      )
    : null;
  const [center] = set?.spots ?? [{ x: clear.x + clear.w / 2, y: clear.y + clear.h / 2 }];
  const mouth = { x: center.x - w / 2, y: center.y - h / 2, w, h };
  const pathIn = horn.segments.reduce((sum, s) => sum + s.length, 0) / CM_PER_IN;
  const depthIn = placed.dims.d - 2 * cabinet.panel.thicknessIn - baffleInsetIn(cabinet);
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
    mouthMoved: set?.moved ?? false,
  };
}
