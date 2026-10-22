// The PA boxes' build parts and rules (vents, end corrections, bracing, keep-outs, weights), the filters, and the
// limits. Pure TS, no React, window or THREE.
import { rectangleEndCorrection } from "./radiation";
import {
  driverPressurePa,
  LID_STRESS_LIMIT_PA,
  PRESSURE_STRESS_LIMIT_PA,
  STACK_LOAD_N,
} from "../build/strength";
import type {
  BoxAxis,
  BoxBracing,
  BoxKeepOut,
  BoxRegion,
  BackJointId,
  BraceStyleId,
  CompressionHf,
  CornerJoint,
  CutBoxId,
  CutPart,
  CutPartId,
  BoxHandles,
  BoxHardwarePlan,
  CogMass,
  Dims3,
  FillDriver,
  HighpassType,
  HornResponse,
  MidDriver,
  PlateHole,
  PlateStock,
  PortStyle,
  SubDriver,
  SubLimitWho,
  NominalImpedance,
  ThieleSmall,
  VentSpec,
  PanelMaterial,
} from "../../types";
import { DRIVER_CUTOUT_IN, DRIVER_MOTOR_DIA_IN } from "../../data/catalog/driver-cutouts";
import { defaultPanelIn, panelLbPerSqFt } from "../build/panel";
import { BAFFLE_PLY_IN, DUCT_DIVIDER_DEFAULT, PLYWOOD_MATERIAL } from "../../constants/panelSizes";
import { SHARP_BEND_CORRECTION, SLOT_INNER_END } from "../../data/acoustics/slot-inner-end";
import {
  modelTubeElbows,
  subDriverDepthIn,
  subTubeKit,
  tubeDriverOnBaffle,
  tubeLayout,
  type TubeDriver,
} from "../build/tubes";
import { TUBE_FLARE_RADIUS_IN } from "../../data/acoustics/tube-ends";
import { ELBOW_WORDS, PORT_STYLE } from "../../constants/portStyles";
import {
  BACK_JOINT_CUT_NOTES,
  BACK_JOINT_PARTITION_NOTES,
  BACK_JOINT_RAIL_NOTES,
  BACK_JOINT_SUMMARY,
  BOX_AXIS_NAMES,
  BRACE_PANEL_NAMES,
  DEFAULT_BACK_JOINT,
  RIB_HALF_LAP_NOTE,
} from "../../constants/bracing";
import {
  panelStock,
  BOX_AXES,
  braceBox,
  defaultBraceStyleNear,
  ribRunAxis,
  WINDOW_RAIL_IN,
} from "../build/bracing";
import {
  BASKET_RING_SHARE,
  BASKET_TAPER_STEPS,
  DRIVER_CLEARANCE_IN,
  MOTOR_START_SHARE,
  DUCT_SUPPORT_MIN_SHARE,
  NO_SUPPORTS,
  PA_PANEL_TARGET_HZ,
  paBoxPanels,
  type PaBoxInside,
  type PaBoxSupports,
} from "../build/boxBracing";
import { hardwareKeepOut, mountedCutout, planBoxHardware } from "../build/hardware";
import { INPUT_JACK } from "../../data/catalog/cabinet-hardware";
import { HARDWARE_KIND_NAMES, hardwarePlaceWords } from "../../constants/hardware";
import { towerHornCutout } from "../speaker/tower";
import {
  KG_PER_LB,
  LITERS_PER_CUBIC_IN,
  METERS_PER_INCH,
  SQ_IN_PER_SQ_FT,
} from "../../constants/units";
import {
  aesDerate,
  hfProgramWatts,
  ohmsOf,
  programWatts,
  sensitivityAt283,
  voltsToWatts,
  wattsToVolts,
} from "../power";
import { PA_SLOT_FINS } from "../../constants/speakerSpec";
import { CORNER_JOINT } from "../../constants/cutParts";

// Which sub vent layouts are round tubes; a record over every `PortStyle`, so a new layout must say which it is.
const ROUND_PORT: Record<PortStyle, boolean> = {
  slots: false,
  vslots: false,
  vslot1: false,
  round1: true,
  round2: true,
  round4: true,
};
/**
 * The longest straight bottom slot, in inches from the baffle front: the floor run to the back wall (`t` the wall ply),
 * leaving the slot's own height open behind its mouth.
 */
export const maxStraightSlotIn = (box: Pick<Dims3, "d">, slotH: number, t: number) =>
  box.d - t - slotH;
/**
 * Whether a bottom slot (`slots`) folds up the back wall: only when it is longer than the straight run holds. A slot
 * that fits straight is built, and modeled, straight.
 */
export const slotFolds = (box: Pick<Dims3, "d">, v: Pick<VentSpec, "slotH" | "len">, t: number) =>
  v.len > maxStraightSlotIn(box, v.slotH, t);
/**
 * A folded bottom slot's floor shelf (the floor leg's roof), from the baffle front as a straight slot's shelf is: the
 * longest straight run less the rear channel's wall (`t`), which the shelf runs up to.
 */
export const foldedShelfIn = (box: Pick<Dims3, "d">, slotH: number, t: number) =>
  maxStraightSlotIn(box, slotH, t) - t;
/**
 * A straight slot's fins' length, from the box's front to the back panel: they run on past the shelf as floor ribs
 * (with the air), so the floor is held whatever the slot's length, and the back's and top's ribs line up on them.
 */
export const slotFinIn = (box: Pick<Dims3, "d">, t: number) => box.d - t;
/**
 * The most fins a bottom slot of height `slotH` takes across the inside width `iw` in wall ply `t`: each opening stays at
 * least as wide as the ply and half the slot's height, so the slot keeps an area and a finite end correction.
 */
export const maxSlotFins = (iw: number, t: number, slotH: number) => {
  const least = Math.max(t, slotH / 2);
  return Math.max(0, Math.floor((iw - least) / (t + least)));
};
/**
 * How many fins split a bottom slot: the vent's own count (the Speaker page's), held to `maxSlotFins`, else two (the
 * PA designs' default, kept so their results do not change).
 */
export const slotFinsOf = (v: Pick<VentSpec, "fins" | "slotH">, iw: number, t: number) =>
  v.fins === undefined ? PA_SLOT_FINS : Math.min(v.fins, maxSlotFins(iw, t, v.slotH));
/**
 * A bottom slot's fins of wall ply `t` across the inside width `iw`, splitting it into equal openings: each opening's
 * width (`open`), each fin's center (`centers`) and each opening's center (`openings`), across from the inside's center
 * line. The cutlist, the bracing, the model, the 3D view and the front drawings all place the fins by it.
 */
export function slotFinLayout(iw: number, t: number, fins: number) {
  const open = (iw - fins * t) / (fins + 1);
  return {
    open,
    centers: Array.from({ length: fins }, (_, i) => (i - (fins - 1) / 2) * (open + t)),
    openings: Array.from({ length: fins + 1 }, (_, j) => (j - fins / 2) * (open + t)),
  };
}
// The least the rear channel's wall rises from the floor leg's roof's underside, so the folded duct has a mouth to open
// into. This is a folded bottom slot vent's wall, not a folded horn's room or board (constants/foldHorn).
const FOLD_MIN_WALL_IN = 1;
/**
 * The most a folded bottom slot's rear channel wall rises from the floor leg's roof's underside: up to one slot height
 * under the lid's inside face, so the channel's mouth has the same gap to the lid as a straight slot's has to the back wall. The
 * floor (`t`) and the slot sit under the roof's underside, the lid (`t`) over the gap.
 */
export const maxFoldedRearWallIn = (box: Pick<Dims3, "h">, slotH: number, t: number) =>
  box.h - 2 * t - 2 * slotH;
/**
 * A folded bottom slot's rear channel wall, in inches up from the underside of the floor leg's roof (`t + slotH` above
 * the box's bottom, where the wall starts: the floor leg runs on under it into the channel). The duct's length is its
 * centerline:
 * the floor run from the baffle front to the middle of the rear channel (`d - t - slotH / 2`), then up the channel to
 * the wall's top (`slotH / 2` + the wall), so the wall is `len - (d - t)`, never under the least rise nor over the most
 * (the model, the 3D view and the cutlist all take this one wall).
 */
export const foldedRearWallIn = (
  box: Pick<Dims3, "d" | "h">,
  v: Pick<VentSpec, "slotH" | "len">,
  t: number,
) =>
  Math.max(FOLD_MIN_WALL_IN, Math.min(maxFoldedRearWallIn(box, v.slotH, t), v.len - (box.d - t)));
/**
 * The shortest folded bottom slot that can be built (its rear wall at the least rise). A slot longer than the straight
 * run holds but shorter than this fits neither way.
 */
export const minFoldedSlotIn = (box: Pick<Dims3, "d">, t: number) => box.d - t + FOLD_MIN_WALL_IN;
/** The longest folded bottom slot: its rear wall at the most rise, one slot height under the lid. */
export const maxFoldedSlotIn = (box: Pick<Dims3, "d" | "h">, slotH: number, t: number) =>
  box.d - t + maxFoldedRearWallIn(box, slotH, t);
/** The gap from a folded bottom slot's mouth (the rear channel's top) up to the inside of the lid, in inches. */
export const foldedLidGapIn = (
  box: Pick<Dims3, "d" | "h">,
  v: Pick<VentSpec, "slotH" | "len">,
  t: number,
) => box.h - 2 * t - v.slotH - foldedRearWallIn(box, v, t);

/**
 * A flared tube's air-speed limit over a sharp-edged vent's: flaring the ends delays the flow's separation at the mouth,
 * where the jet and its vortices make the noise and compression that set the limit (Roozen, Bockholts, van Eck &
 * Hirschberg, "Vortex sound in bass-reflex ports of loudspeakers", J. Acoust. Soc. Am. 104 (1998) 1914–1924; Salvatti,
 * Devantier & Button, "Maximizing performance from loudspeaker ports", J. Audio Eng. Soc. 50 (2002) 19–45, whose flared
 * ports stay clean to well above a straight port's onset). About 30 m/s against the 23.5 m/s sine peak a PA design
 * allows a sharp-edged slot, whose cut ends the cutlist doesn't round over.
 */
export const FLARED_PORT_SPEED_RATIO = 30 / 23.5;
/**
 * The air-speed limit for a vent, m/s: `portMax` (the design's setting, a sharp-edged vent's) for the slots and side
 * ducts, FLARED_PORT_SPEED_RATIO times it for flared round tubes.
 */
export const ventSpeedLimit = (style: PortStyle, portMax: number) =>
  ROUND_PORT[style] ? portMax * FLARED_PORT_SPEED_RATIO : portMax;

/** Whether the sub's vents are round tubes (`round1`, `round2`, `round4`) rather than rectangular ducts. */
export const isRoundPort = (style: PortStyle): style is Extract<PortStyle, `round${string}`> =>
  ROUND_PORT[style];

// ---------------------------------------------------------------
// Vented-box model. Same lumped-element circuit used to check this
// design offline; see the provenance note under the table.
// Complex helpers kept local and minimal.
// ---------------------------------------------------------------
interface Complex {
  re: number;
  im: number;
}
// Each highpass type's alignment and order (lib/speaker/bandFilter `filterTransfer`): Butterworth n, or a
// Linkwitz-Riley 2m, a Butterworth m squared. LR24 is -6 dB at the corner, BW24 -3 dB.
export const HIGHPASS_ALIGNMENTS: Record<
  HighpassType,
  readonly [kind: "bw" | "lr", order: number]
> = {
  BW24: ["bw", 4],
  LR24: ["lr", 4],
  BW48: ["bw", 8],
  LR48: ["lr", 8],
};
// The normalized Butterworth sections of even order n, s² + b·s + 1: each b = 2 sin((2k − 1)π / 2n), k = 1 … n/2.
// Kept per order: the hi-fi crossover calls for them at every frequency of every design the optimizer tries.
const SECTIONS = new Map<number, number[]>();
function butterworthSections(n: number) {
  let b = SECTIONS.get(n);
  if (!b) {
    b = Array.from({ length: n / 2 }, (_, k) => 2 * Math.sin(((2 * k + 1) * Math.PI) / (2 * n)));
    SECTIONS.set(n, b);
  }
  return b;
}
// Normalized Butterworth denominator of even order n: the product of its sections, in plain real arithmetic
export function butterworth(s: Complex, n: number): Complex {
  const s2re = s.re * s.re - s.im * s.im,
    s2im = 2 * s.re * s.im;
  let re = 1,
    im = 0;
  for (const b of butterworthSections(n)) {
    const qre = s2re + b * s.re + 1,
      qim = s2im + b * s.im,
      t = re * qre - im * qim;
    im = re * qim + im * qre;
    re = t;
  }
  return { re, im };
}
// A model curve's box phase made continuous: each point moved by whole turns to within half a turn of the next one
// up, from the top of the curve down (the top keeps its own value: there a box's phase is near 0).
export function unwrapRawPhase(curve: { rawPhase?: number }[]) {
  for (let i = curve.length - 2; i >= 0; i--) {
    const p = curve[i].rawPhase ?? 0,
      up = curve[i + 1].rawPhase ?? 0;
    curve[i].rawPhase = p - 2 * Math.PI * Math.round((p - up) / (2 * Math.PI));
  }
}

// ---------------------------------------------------------------
// Bracing by rule (lib/build/bracing): each panel's first plate resonance, and the window braces or ribs that lift every
// panel over PA_PANEL_TARGET_HZ. The cutlist, the volumes, the weights and the 3D view all read these.
// ---------------------------------------------------------------
/** A side duct's flared ends stand this much proud of its throat, in (a strip set at 20°, as the 3D view and the fit check draw it). */
const SIDE_DUCT_FLARE_IN = 0.43;
/** A side duct's width off its side wall, in: the throat, the wall, and the flare its ends stand out by. */
const sideDuctWidthIn = (v: Pick<VentSpec, "throat">, t: number) =>
  v.throat + t + SIDE_DUCT_FLARE_IN;
/**
 * A PA panel's stock for the plate model, from its exact thickness: the one place bracing reads the panel thickness and
 * its weight (lib/build/panel, plywood), with birch ply's moduli.
 */
export const paPanelStock = (t: number): PlateStock => panelStock(t, PLYWOOD_MATERIAL);
/** A PA box's inside as boxParts cuts it: behind a 3/4″ baffle set `inset` back, `band` of a bottom slot under it. */
const paInside = (box: Dims3, t: number, inset: number, band = 0) => ({
  iw: box.w - 2 * t,
  ih: box.h - 2 * t,
  inD: box.d - inset - BAFFLE_PLY_IN - t,
  band,
});
/**
 * The run (in) of a slot or side duct's shelf in the box's air, `len` from the frame front: behind the baffle (`inset`
 * back, BAFFLE_PLY_IN thick), where the box's air starts, so the run and the gap behind the mouth add up to the box's
 * inside depth (paInside), as SLOT_INNER_END's box takes them.
 */
const slotRunIn = (v: Pick<VentSpec, "len">, inset: number) => v.len - inset - BAFFLE_PLY_IN;
/** The sub's vent as the bracing reads it: its sizes, and its divider and tubes where it has them. */
export type BraceVent = Pick<VentSpec, "slotH" | "len" | "throat" | "div" | "nt" | "dia" | "fins">;
/**
 * Where the duct's length changes the sub's bracing: whether the duct runs far enough back to hold the panels it runs
 * along (ductHolds: then its parts' lines, subVentLines, are supports: a bottom slot's shelf across both sides and its
 * two fins along the bottom (a straight slot's fins run on to the back, so they hold the floor at any length), a side duct's wall along the top and bottom and its dividers across its side), whether a
 * bottom slot folds up the back (and whether its rear channel wall rises far enough, DUCT_SUPPORT_MIN_SHARE of the
 * inside height, to hold the sides: `wallHolds`) and whether the tubes take elbows (subKeepOut).
 */
export interface DuctFlags {
  holds: boolean;
  folds: boolean;
  wallHolds: boolean;
  elbows: boolean;
}
/** The sub's duct's flags (DuctFlags) at its length in this box. */
export const ductFlagsOf = (
  box: Dims3,
  t: number,
  inset: number,
  style: PortStyle,
  v: BraceVent,
  drv: TubeDriver,
): DuctFlags => ({
  holds: ductHolds(box, t, inset, style, v),
  folds: style === PORT_STYLE.slot && slotFolds(box, v, t),
  wallHolds:
    style === PORT_STYLE.slot &&
    slotFolds(box, v, t) &&
    foldedRearWallIn(box, v, t) >= DUCT_SUPPORT_MIN_SHARE * paInside(box, t, inset).ih,
  elbows:
    isRoundPort(style) &&
    modelTubeElbows(box, style, { nt: v.nt, dia: v.dia, len: v.len }, t, inset, drv) > 0,
});
/** Whether the sub's duct runs far enough back (DUCT_SUPPORT_MIN_SHARE of the depth) to hold the panels it runs along. */
const ductHolds = (
  box: Dims3,
  t: number,
  inset: number,
  style: PortStyle,
  v: Pick<VentSpec, "slotH" | "len">,
) => {
  const { inD } = paInside(box, t, inset);
  const len =
    style === PORT_STYLE.slot && slotFolds(box, v, t) ? foldedShelfIn(box, v.slotH, t) : v.len;
  return slotRunIn({ len }, inset) >= DUCT_SUPPORT_MIN_SHARE * inD;
};
/**
 * The lines the sub's vent parts run along on its panels, however short the vent (subBoxBracing takes them as
 * supports only past DUCT_SUPPORT_MIN_SHARE, its duct flags' `holds`): a rib may always stop on them to clear the vent.
 */
export function subVentLines(
  box: Dims3,
  t: number,
  style: PortStyle,
  v: Pick<VentSpec, "slotH" | "throat" | "div" | "fins">,
): PaBoxSupports {
  const { iw, ih } = paInside(box, t, 0);
  if (style === PORT_STYLE.slot) {
    const shelf = v.slotH + t / 2;
    // the fins' centers, in from the left side (the 3D view's)
    const bottom = slotFinLayout(iw, t, slotFinsOf(v, iw, t)).centers.map((c) => iw / 2 + c);
    return { sideL: [shelf], sideR: [shelf], top: [], bottom };
  }
  if (style === "vslots" || style === "vslot1") {
    // the dividers' centers, splitting the duct's open height in three
    const div = ductDividerIn(v),
      seg = (ih - 2 * div) / 3;
    const dividers = [seg + div / 2, 2 * seg + (3 * div) / 2],
      wall = v.throat + t / 2,
      both = style === "vslots"; // a single duct goes on the right side
    const across = [...(both ? [wall] : []), iw - wall];
    return { sideL: both ? dividers : [], sideR: dividers, top: across, bottom: across };
  }
  return NO_SUPPORTS;
}
/**
 * Where a rib may stop to clear the sub's vent: on its parts' lines (subVentLines), but clear of a side duct's flared
 * ends on the top and bottom (subKeepOut keeps the duct to them).
 */
export function subVentStops(
  box: Dims3,
  t: number,
  style: PortStyle,
  v: Pick<VentSpec, "slotH" | "throat" | "div" | "fins">,
): PaBoxSupports {
  const lines = subVentLines(box, t, style, v);
  if (style !== "vslots" && style !== "vslot1") return lines;
  const { iw } = paInside(box, t, 0);
  const w = sideDuctWidthIn(v, t) - t / 2;
  const across = [...(style === "vslots" ? [w] : []), iw - w];
  return { ...lines, top: across, bottom: across };
}
/** A cone's size behind the baffle as the braces keep clear of it: its cutout's and its motor's diameters, in. */
export interface ConeBody {
  cutoutIn: number;
  motorIn: number;
}
/**
 * A cone driver's room behind the baffle, which no brace or rib may enter, as boxes round its axis: the cutout's square
 * at the baffle (the basket comes through it), stepping in along the basket to the motor's and back to the back of the
 * magnet (lib/build/boxBracing's shares), each with DRIVER_CLEARANCE_IN to spare. `depthIn` is the mounting depth from the
 * baffle's front.
 */
export function coneKeepOut(
  center: { x: number; y: number },
  body: ConeBody,
  depthIn: number,
): BoxRegion[] {
  const c = DRIVER_CLEARANCE_IN;
  const depth = Math.max(0, depthIn - BAFFLE_PLY_IN),
    rCut = body.cutoutIn / 2,
    rMotor = Math.min(rCut, body.motorIn / 2);
  const zRing = BASKET_RING_SHARE * depth,
    zMotor = MOTOR_START_SHARE * depth;
  const box = (r: number, z0: number, z1: number): BoxRegion => ({
    x: [center.x - r - c, center.x + r + c],
    y: [center.y - r - c, center.y + r + c],
    z: [z0, z1],
  });
  const step = (zMotor - zRing) / BASKET_TAPER_STEPS;
  return [
    box(rCut, 0, zRing),
    ...Array.from({ length: BASKET_TAPER_STEPS }, (_, i) =>
      box(
        rCut - ((rCut - rMotor) * i) / BASKET_TAPER_STEPS,
        zRing + i * step,
        zRing + (i + 1) * step,
      ),
    ),
    box(rMotor, zMotor, depth + c),
  ];
}
/** A PA cone's body by its size class: the typical cutout and the class's motor (DRIVER_MOTOR_DIA_IN). */
export const paConeBody = (size: SubDriver["size"] | MidDriver["size"]): ConeBody => ({
  cutoutIn: DRIVER_CUTOUT_IN[size],
  motorIn: DRIVER_MOTOR_DIA_IN[size],
});
/** A PA cone's room behind the baffle (coneKeepOut), by its size class. */
export const driverKeepOut = (
  center: { x: number; y: number },
  size: SubDriver["size"] | MidDriver["size"],
  depthIn: number,
): BoxRegion[] => coneKeepOut(center, paConeBody(size), depthIn);
/** Where the sub driver's center sits on the inside of the baffle, in from the box's inside corner (the 3D view's). */
export function subDriverCenter(
  box: Dims3,
  t: number,
  style: PortStyle,
  v: Pick<VentSpec, "slotH" | "throat">,
  size: SubDriver["size"],
) {
  const { iw, ih } = paInside(box, t, 0);
  if (isRoundPort(style)) {
    const d = tubeDriverOnBaffle(box, style, t, size);
    return { x: iw / 2 + d.x, y: d.y };
  }
  if (style === "vslots") return { x: iw / 2, y: ih / 2 };
  // a single side duct (on the right) pushes the driver into the middle of the baffle left
  if (style === "vslot1") return { x: iw / 2 - (v.throat + SIDE_DUCT_FLARE_IN + t) / 2, y: ih / 2 };
  const band = v.slotH + t;
  return { x: iw / 2, y: band + (ih - band) / 2 };
}
/** The clear floor behind a bottom slot's inner end, in slot heights: room for the air to leave the duct. */
const SLOT_CLEAR_HEIGHTS = 2;
/**
 * How far back a bottom slot's room runs, in from the baffle: the duct and SLOT_CLEAR_HEIGHTS slot heights more, up to
 * the next whole inch (so duct lengths a hair apart share their bracing), or the whole depth when it folds.
 */
const slotRoomIn = (
  inD: number,
  inset: number,
  v: Pick<VentSpec, "len" | "slotH">,
  folds: boolean,
) =>
  folds
    ? inD
    : Math.min(
        inD,
        Math.ceil(Math.max(0, v.len - inset - BAFFLE_PLY_IN) + SLOT_CLEAR_HEIGHTS * v.slotH),
      );
/**
 * What no brace or rib in the sub may enter: its driver (driverKeepOut), and its vent's parts and the air they hold: a
 * bottom slot under its shelf as far back as the duct runs and two slot heights more (room for the air at its inner end;
 * folded, the whole floor and the rear channel up the back to the lid as well), a side duct between its wall and the
 * side (its flared ends a flare wider) and each round tube's run along the floor (up to the lid where it takes
 * elbows), these two over the whole depth. The slot's room follows its length; the built box's volume moves with the
 * ribs it lets in behind a short slot.
 */
export function subKeepOut(
  box: Dims3,
  t: number,
  inset: number,
  style: PortStyle,
  v: BraceVent,
  drv: TubeDriver,
  /** whether the slot folds and the tubes take elbows; absent: at the vent's length in this box */
  bends: Pick<DuctFlags, "folds" | "elbows"> = ductFlagsOf(box, t, inset, style, v, drv),
  /** a bottom slot's room over the whole floor, whatever its length (the hardware's placement keeps to that) */
  wholeFloor = false,
): BoxKeepOut {
  const { iw, ih, inD } = paInside(box, t, inset);
  const driver = driverKeepOut(
    subDriverCenter(box, t, style, v, drv.size),
    drv.size,
    subDriverDepthIn(drv),
  );
  const vent: BoxRegion[] = [];
  const z: readonly [number, number] = [0, inD];
  if (style === PORT_STYLE.slot) {
    const band = v.slotH + t;
    const slotEnd = wholeFloor ? inD : slotRoomIn(inD, inset, v, bends.folds);
    vent.push({ x: [0, iw], y: [0, band], z: [0, slotEnd] });
    if (bends.folds) vent.push({ x: [0, iw], y: [0, ih], z: [inD - band, inD] });
  } else if (style === "vslots" || style === "vslot1") {
    // the duct to its flared ends' outer face
    const w = sideDuctWidthIn(v, t);
    if (style === "vslots") vent.push({ x: [0, w], y: [0, ih], z });
    vent.push({ x: [iw - w, iw], y: [0, ih], z });
  } else if (isRoundPort(style)) {
    const { elbows } = bends;
    const rr = v.dia / 2 + TUBE_FLARE_RADIUS_IN;
    for (const p of tubeLayout(box, style, v, t, drv.size).tubes)
      vent.push({
        x: [iw / 2 + p.x - rr, iw / 2 + p.x + rr],
        y: [p.y - rr, elbows ? ih : p.y + rr],
        z,
      });
  }
  return { driver, vent };
}
// boxes repeat thousands of times in the optimizers' searches: the rule runs once per box and its surroundings (the
// supports, the stops and the keep-out, which the duct lengths a hair apart share), and once per exact set of inputs
const BRACING_MEMO = new Map<string, BoxBracing>();
const INPUT_MEMO = new Map<string, BoxBracing>();
const BRACING_MEMO_MAX = 20000;
const linesKey = (s: PaBoxSupports) =>
  `${s.sideL.join()};${s.sideR.join()};${s.top.join()};${s.bottom.join()};${s.sideZ?.join() ?? ""};${s.bottomZ?.join() ?? ""};${s.finIn ?? ""}`;
/**
 * A folded slot's rear channel wall as a line on both sides, back from the baffle (inside): the channel's front wall,
 * a slot height and a wall in from the back, `t` thick, glued between the sides. Where it rises DUCT_SUPPORT_MIN_SHARE
 * of the inside height (DuctFlags `wallHolds`) it holds both sides there and a side rib may stop on it.
 */
function foldWallLine(box: Dims3, t: number, inset: number, v: Pick<VentSpec, "slotH">) {
  const { inD } = paInside(box, t, inset);
  return inD - (v.slotH + t) + t / 2;
}
const remember = (memo: Map<string, BoxBracing>, key: string, b: BoxBracing) => {
  if (memo.size >= BRACING_MEMO_MAX) memo.clear();
  memo.set(key, b);
  return b;
};
/**
 * A driver's cutout on the baffle: its center (in from the box's inside corner) less a slot's band below it, with the
 * driver's catalog weight hung round its edge (none where the entry has no weight).
 */
const baffleCutout = (
  center: { x: number; y: number },
  band: number,
  drv: Pick<SubDriver | MidDriver, "size"> & Partial<Pick<SubDriver | MidDriver, "lb">>,
): PlateHole => ({
  cx: center.x,
  cy: center.y - band,
  r: DRIVER_CUTOUT_IN[drv.size] / 2,
  ringKg: (drv.lb || 0) * KG_PER_LB,
});
function paBracing(
  box: Dims3,
  t: number,
  inset: number,
  band: number,
  sup: PaBoxSupports,
  stops: PaBoxSupports,
  keepOut: BoxKeepOut,
  /** what sets the keep-out besides the box and the plywood (the caller's inputs to it and its spans) */
  keepKey: string,
  style: BraceStyleId,
  back: BackJointId,
  /** the driver's cutout on the baffle, in from the baffle's corner */
  hole: PlateHole,
  /** the driver's figures for the pressure it puts in the box (lib/build/strength); absent: no pressure checked */
  ts: Pick<ThieleSmall, "Sd" | "Xmax" | "disp"> | undefined,
  /** every panel's first mode should clear it, Hz */
  targetHz: number,
): BoxBracing {
  const key = `${targetHz}|${style}|${back}|${box.w}|${box.h}|${box.d}|${t}|${inset}|${band}|${linesKey(sup)}|${linesKey(stops)}|${keepKey}|${hole.cx},${hole.cy},${hole.r},${hole.ringKg ?? 0}|${ts ? `${ts.Sd},${ts.Xmax},${ts.disp}` : ""}`;
  const hit = BRACING_MEMO.get(key);
  if (hit) return hit;
  return remember(
    BRACING_MEMO,
    key,
    braceShell(
      {
        inside: paInside(box, t, inset, band),
        wall: paPanelStock(t),
        baffle: paPanelStock(BAFFLE_PLY_IN),
      },
      { sup, stops, keepOut, style, back, hole, ts, targetHz },
    ),
  );
}
/** A box's shell as the bracing rule reads it: its inside behind the baffle, and its walls' and baffle's stock. */
export interface BraceShell {
  inside: PaBoxInside;
  wall: PlateStock;
  baffle: PlateStock;
}
/** What the bracing rule reads besides the shell: the supports and stops, the keep-out, style, back and driver. */
export interface BraceInputs {
  sup: PaBoxSupports;
  stops: PaBoxSupports;
  keepOut: BoxKeepOut;
  style: BraceStyleId;
  back: BackJointId;
  /** the largest cutout on the baffle, in from the baffle's corner; absent: none */
  hole?: PlateHole;
  /** the driver's figures for the pressure it puts in the box (lib/build/strength); absent: no pressure checked */
  ts: Pick<ThieleSmall, "Sd" | "Xmax" | "disp"> | undefined;
  /** every panel's first mode should clear it, Hz: the PA boxes' PA_PANEL_TARGET_HZ, or a Speaker-page cabinet's own */
  targetHz: number;
}
/**
 * A box's braces and ribs by rule (lib/build/bracing braceBox): its six panels (paBoxPanels) to the target, the
 * braces cut from the wall stock, and the strength checks' loads: the driver's pressure in the box's air and a load
 * spread over the lid. The PA boxes' rule (paBracing), for any shell and stock.
 */
export function braceShell(
  { inside, wall, baffle }: BraceShell,
  { sup, stops, keepOut, style, back, hole, ts, targetHz }: BraceInputs,
): BoxBracing {
  const insideL = inside.iw * inside.ih * inside.inD * LITERS_PER_CUBIC_IN;
  const lidM2 = inside.iw * inside.inD * METERS_PER_INCH ** 2;
  return braceBox({
    inner: { x: inside.iw, y: inside.ih, z: inside.inD },
    panels: paBoxPanels(inside, wall, baffle, sup, stops, back, hole),
    targetHz,
    style,
    braceStock: wall,
    keepOut,
    loads: {
      pressurePa: ts ? driverPressurePa(ts.Sd, ts.Xmax, insideL - (ts.disp ?? 0)) : 0,
      pressureLimitPa: PRESSURE_STRESS_LIMIT_PA,
      lidPa: STACK_LOAD_N / lidM2,
      lidLimitPa: LID_STRESS_LIMIT_PA,
    },
  });
}
/** The hardware's recesses as a keep-out key (the bracing memo's). */
const regionsKey = (rs: readonly BoxRegion[]) =>
  rs.map((r) => `${r.x.join()},${r.y.join()},${r.z.join()}`).join(";");
/**
 * The sub box's braces and ribs by rule, and its panels' resonances: its vent's parts as supports, and its driver and
 * vent kept clear (subKeepOut), and with `handles` (the box has its hardware) the recesses of its handles and input dish
 * as well, placed first (subHardwarePlacement). The optimizers' cards use it too (they leave the hardware out).
 */
export function subBoxBracing(
  box: Dims3,
  t: number,
  inset: number,
  style: PortStyle,
  v: BraceVent,
  drv: TubeDriver & Partial<Pick<SubDriver, "lb" | "ts">>,
  braceStyle: BraceStyleId | undefined,
  handles?: BoxHandles,
  back: BackJointId = DEFAULT_BACK_JOINT,
  /** every panel's first mode should clear it, Hz (a Speaker-page cabinet's own target) */
  targetHz: number = PA_PANEL_TARGET_HZ,
  /** the walls' material, for the handles' center of gravity */
  material: PanelMaterial = PLYWOOD_MATERIAL,
): BoxBracing {
  const bs = braceStyle ?? defaultBraceStyleNear(t);
  // the duct's length counts only where it changes the bracing (its flags)
  const flags = ductFlagsOf(box, t, inset, style, v, drv);
  const recesses = handles
    ? hardwareKeepOut(subHardwarePlacement(box, t, inset, style, v, drv, handles, null, material))
    : [];
  const hwKey = regionsKey(recesses);
  const key = `${material}|${targetHz}|${bs}|${back}|${box.w}|${box.h}|${box.d}|${t}|${inset}|${style}|${style === PORT_STYLE.slot ? slotRoomIn(paInside(box, t, inset).inD, inset, v, flags.folds) : ""}|${v.slotH}|${slotFinsOf(v, box.w - 2 * t, t)}|${flags.holds}|${flags.folds}|${flags.wallHolds}|${flags.elbows}|${v.throat}|${v.div}|${v.nt}|${v.dia}|${drv.size}|${drv.depthIn}|${drv.lb ?? 0}|${drv.ts ? `${drv.ts.Sd},${drv.ts.Xmax},${drv.ts.disp}` : ""}|${hwKey}`;
  const hit = INPUT_MEMO.get(key);
  if (hit) return hit;
  const keepOut = { ...subKeepOut(box, t, inset, style, v, drv, flags), hardware: recesses };
  // the keep-out from its inputs other than the length, and the spans the length sets
  const keepKey = `${style}|${v.slotH}|${v.throat}|${v.div}|${v.nt}|${v.dia}|${drv.size}|${drv.depthIn}|${keepOut.vent.map((r) => `${r.y.join()},${r.z.join()}`).join(";")}|${hwKey}`;
  return remember(
    INPUT_MEMO,
    key,
    paBracing(
      box,
      t,
      inset,
      style === PORT_STYLE.slot ? v.slotH + t : 0,
      {
        ...(flags.holds ? subVentLines(box, t, style, v) : NO_SUPPORTS),
        // a straight slot's fins run the whole depth, however short its shelf: they hold the floor
        ...(style === PORT_STYLE.slot && !flags.folds
          ? { bottom: subVentLines(box, t, style, v).bottom, finIn: v.slotH }
          : {}),
        // a folded slot's rear channel wall holds both sides where it rises far enough
        sideZ: flags.wallHolds ? [foldWallLine(box, t, inset, v)] : [],
      },
      // and a side rib running back may stop on it there; on a lower wall it would end in the air over the channel; a
      // floor rib behind a short slot starts where its clear floor ends
      {
        ...subVentStops(box, t, style, v),
        sideZ: flags.wallHolds ? [foldWallLine(box, t, inset, v)] : [],
        bottomZ:
          style === PORT_STYLE.slot && !flags.folds
            ? [slotRoomIn(paInside(box, t, inset).inD, inset, v, false)]
            : [],
      },
      keepOut,
      keepKey,
      bs,
      back,
      baffleCutout(
        subDriverCenter(box, t, style, v, drv.size),
        style === PORT_STYLE.slot ? v.slotH + t : 0,
        drv,
      ),
      drv.ts,
      targetHz,
    ),
  );
}
/** A box's braces' and ribs' wood, in³. */
export const braceWoodIn3 = (b: Pick<BoxBracing, "windowIn3" | "ribIn3"> | null | undefined) =>
  b ? b.windowIn3 + b.ribIn3 : 0;
export { PLYWOOD_SHEETS } from "../../data/catalog/plywood";
export const formatInches = (x: number) => {
  // inches to the nearest 1/16, as 12 5/8
  const n = Math.round(x * 16),
    whole = Math.floor(n / 16),
    r = n % 16;
  if (!r) return `${whole}`;
  let a = r,
    b = 16;
  while (a % 2 === 0) {
    a /= 2;
    b /= 2;
  }
  return whole ? `${whole} ${a}/${b}` : `${a}/${b}`;
};
export { formatThickness } from "../build/panel";

/** Whether a box's window braces have rails on its back: a frame across x or y has a rear rail; one across z stands parallel to it. */
export const railsOnBack = (b: Pick<BoxBracing, "windows"> | null | undefined) =>
  !!b && b.windows.x.length + b.windows.y.length > 0;
/** The back panel's cutlist note: how it goes into the rabbet, and onto the window braces' rear rails where they meet it. */
const backNote = (back: BackJointId, rails: boolean) => {
  const onRails = rails ? BACK_JOINT_RAIL_NOTES[back] : null;
  return onRails ? `${BACK_JOINT_CUT_NOTES[back]}; ${onRails}` : BACK_JOINT_CUT_NOTES[back];
};
/** The rabbet on a shell panel's rear edge that the back sits in, screwed or glued (`back`). */
const rearRabbetNote = (t: number, back: BackJointId) =>
  `rabbet ${formatInches(t)} × ${formatInches(t / 2)} on rear edge for the ${BACK_JOINT_SUMMARY[back]}`;
/** A side's joint at the `edges` it meets the top and bottom on, and its rear rabbet. */
const sideJointNote = (joint: CornerJoint, t: number, edges: string, back: BackJointId) =>
  joint === CORNER_JOINT.rabbet
    ? `rabbet ${formatInches(t)} × ${formatInches(t / 2)} ${edges}; ${rearRabbetNote(t, back)}`
    : joint === CORNER_JOINT.miter
      ? `45° on ${edges}; ${rearRabbetNote(t, back)}`
      : rearRabbetNote(t, back);

export function boxParts(
  label: CutBoxId,
  W: number,
  H: number,
  D: number,
  t: number,
  inset: number,
  joint: CornerJoint,
  extra: {
    band?: number;
    cutNote?: string;
    bracing?: BoxBracing | null;
    /** the hardware's cutout notes, by panel (hardwareCutNotes) */
    hardware?: HardwareCutNotes;
    /** how the back goes on; absent: screwed (`DEFAULT_BACK_JOINT`) */
    back?: BackJointId;
    /** whether window braces' rear rails meet the back; absent: whether `bracing`'s do (railsOnBack) */
    backRails?: boolean;
  } = {},
) {
  const BT = BAFFLE_PLY_IN,
    P: CutPart[] = [];
  const back = extra.back ?? DEFAULT_BACK_JOINT;
  const topW = joint === CORNER_JOINT.butt ? W - 2 * t : joint === CORNER_JOINT.rabbet ? W - t : W;
  const rearNote = rearRabbetNote(t, back);
  const sideNote = sideJointNote(joint, t, "top and bottom edges", back);
  const topNote = joint === CORNER_JOINT.miter ? `45° on both ends; ${rearNote}` : rearNote;
  const hw = extra.hardware ?? {};
  const withNote = (note: string, more: string | undefined) => (more ? `${note}; ${more}` : note);
  P.push({ box: label, part: "side", qty: 2, a: D, b: H, t, note: withNote(sideNote, hw.side) });
  P.push({
    box: label,
    part: "topBottom",
    qty: 2,
    a: D,
    b: topW,
    t,
    note: withNote(topNote, hw.top),
  });
  P.push({
    box: label,
    part: "back",
    qty: 1,
    a: W - t,
    b: H - t,
    t,
    note: withNote(backNote(back, extra.backRails ?? railsOnBack(extra.bracing)), hw.back),
  });
  const iw = W - 2 * t,
    ih = H - 2 * t,
    band = extra.band || 0;
  P.push({
    box: label,
    part: "baffle",
    qty: 1,
    a: iw,
    b: ih - band,
    t: BT,
    note: `set ${formatInches(inset)}″ back on cleats; ${extra.cutNote || ""}`.replace(/; $/, ""),
  });
  P.push({
    box: label,
    part: "baffleCleat",
    qty: 2,
    a: BT,
    b: iw,
    t: BT,
    note: "glue and screw behind the baffle",
  });
  P.push({
    box: label,
    part: "baffleCleat",
    qty: 2,
    a: BT,
    b: ih - band - 2 * BT,
    t: BT,
    note: "",
  });
  const inD = D - inset - BT - t;
  if (extra.bracing) P.push(...braceParts(label, extra.bracing, { x: iw, y: ih, z: inD }, t));
  return { P, iw, ih, inD };
}

// where a window brace across each axis lies, and where positions along each axis are measured from
const WINDOW_PLANE: Record<BoxAxis, string> = {
  x: "upright, front to back",
  y: "level",
  z: "upright, parallel to the baffle",
};
const AXIS_FROM: Record<BoxAxis, string> = {
  x: "from the left side",
  y: "up from the bottom",
  z: "back from the baffle",
};
const atList = (at: readonly number[]) => at.map((x) => `${formatInches(x)}″`).join(", ");
/** A box's window braces and ribs as cutlist rows: each axis' window braces, then each panel's ribs. */
export function braceParts(
  box: CutBoxId,
  b: BoxBracing,
  inner: Record<BoxAxis, number>,
  t: number,
): CutPart[] {
  const out: CutPart[] = [];
  const rails = `cut out the center, leave ${formatInches(WINDOW_RAIL_IN)}″ rails`;
  for (const axis of ["y", "x", "z"] as const) {
    // across x, the braces that cross the driver open their frame to the baffle round it
    const open = axis === "x" && b.notch ? b.notch.at : [];
    const closed = b.windows[axis].filter((x) => !open.includes(x));
    const [pa, pb] = BOX_AXES.filter((o) => o !== axis).map((o) => inner[o]);
    const row = (at: number[], note: string) => {
      if (at.length) out.push({ box, part: "windowBrace", qty: at.length, a: pa, b: pb, t, note });
    };
    row(closed, `${WINDOW_PLANE[axis]}, ${atList(closed)} ${AXIS_FROM[axis]}; ${rails}`);
    if (b.notch)
      row(
        open,
        `${WINDOW_PLANE[axis]}, ${atList(open)} ${AXIS_FROM[axis]}; ${rails}, and leave the front rail out from ${formatInches(b.notch.y[0])}″ to ${formatInches(b.notch.y[1])}″ ${AXIS_FROM.y}, clear of the driver`,
      );
  }
  for (const r of b.ribs) {
    const run = ribRunAxis(r.panel, r.across);
    // a rib crosses the window braces across the axis it runs along, where they stand within its length (Ribs has none)
    const lap = b.windows[run].some((w) => w > r.from + 1e-6 && w < r.from + r.len - 1e-6)
      ? RIB_HALF_LAP_NOTE
      : "";
    const from = r.from > 1e-6 ? `, starting ${formatInches(r.from)}″ ${AXIS_FROM[run]}` : "";
    out.push({
      box,
      part: "rib",
      qty: r.at.length,
      a: r.depth,
      b: r.len,
      t,
      note: `${BRACE_PANEL_NAMES[r.panel]}, on edge, running ${BOX_AXIS_NAMES[run]}, ${atList(r.at)} ${AXIS_FROM[r.across]}${from}${lap}`,
    });
  }
  return out;
}

/** A baffle row's cutout note: the cutout is a typical size, and the driver's datasheet has the real one. */
export const cutoutNote = (inches: number) =>
  `${formatInches(inches)}″ driver cutout (typical; use the datasheet's)`;

/** A box's hardware cutout notes, by the cutlist row they go on: the sides (both), the top, the back. */
export type HardwareCutNotes = Partial<Record<"side" | "top" | "back", string>>;
/**
 * A part's cutout note, as cutoutNote words a driver's: its size as mounted (across the panel by up it, or front to back
 * on the lid), the part, and where it goes (`where`).
 */
export const hardwareCutoutNote = (
  part: Pick<BoxHardwarePlan["parts"][number], "part" | "kind" | "panel">,
  where: string,
) => {
  const c = mountedCutout(part.part) ?? { across: 0, up: 0 };
  const up = part.panel === "top" ? "front to back" : "high";
  return `${formatInches(c.across)}″ wide × ${formatInches(c.up)}″ ${up} cutout for the ${part.part.name} ${HARDWARE_KIND_NAMES[part.kind]}, ${where}`;
};
/**
 * Where a placed part's cutout center sits, from named edges of its panel (hardwarePlaceWords): the handles on both
 * sides from the front and bottom edges, the dish on the back from its bottom edge (which sits in the rabbet, t/2 up),
 * the horn's posts on the top from its rear edge. The cutlist and Details both say it this way.
 */
export function hardwarePlace(
  p: Pick<BoxHardwarePlan["parts"][number], "kind" | "u" | "v">,
  box: Pick<Dims3, "d">,
  t: number,
) {
  const at = (x: number) => formatInches(x);
  if (p.kind === "handle")
    return hardwarePlaceWords("handle", [
      [at(p.u), "front"],
      [at(p.v), "bottom"],
    ]);
  if (p.kind === "plate") return hardwarePlaceWords("plate", [[at(p.v - t / 2), "bottom"]]);
  return hardwarePlaceWords("posts", [[at(box.d - p.v), "rear"]]);
}
/**
 * A box's hardware as cutout notes on its panels (hardwarePlace): the handles on both sides, the dish on the back with
 * its jacks, the horn's posts on the top only.
 */
export function hardwareCutNotes(plan: BoxHardwarePlan, box: Dims3, t: number): HardwareCutNotes {
  const out: HardwareCutNotes = {};
  for (const p of plan.parts) {
    const note = hardwareCutoutNote(p, hardwarePlace(p, box, t));
    if (p.kind === "handle" && p.panel === "sideL") out.side = note;
    else if (p.kind === "plate") out.back = `${note}; 2 × ${INPUT_JACK.name} in it (in, link)`;
    else if (p.kind === "posts") out.top = note;
  }
  return out;
}

/**
 * The sub's vent panels as weights for its center of gravity (lib/build/hardware boxCenterOfGravity), each at its middle
 * (`y` up from the box's bottom, `z` back from its front), cut and placed as the cutlist and the 3D view take them: a
 * bottom slot's shelf and two fins from the front, and a folded slot's rear channel wall; a side duct's wall and its two
 * dividers from the front, at the design's divider thickness. Round tubes count none.
 */
export function subVentMasses(
  box: Dims3,
  t: number,
  style: PortStyle,
  v: BraceVent,
  material: PanelMaterial = PLYWOOD_MATERIAL,
): CogMass[] {
  const { iw, ih } = paInside(box, t, 0);
  const ply = (a: number, b: number, th: number) =>
    (a * b * panelLbPerSqFt(th, material)) / SQ_IN_PER_SQ_FT;
  if (style === PORT_STYLE.slot) {
    const folded = slotFolds(box, v, t);
    const len = folded
      ? foldedShelfIn(box, v.slotH, t)
      : Math.min(v.len, maxStraightSlotIn(box, v.slotH, t));
    const out: CogMass[] = [
      { lb: ply(iw, len, t), y: t + v.slotH + t / 2, z: len / 2 },
      // a straight slot's fins run on to the back
      folded
        ? { lb: slotFinsOf(v, iw, t) * ply(v.slotH, len, t), y: t + v.slotH / 2, z: len / 2 }
        : {
            lb: slotFinsOf(v, iw, t) * ply(v.slotH, slotFinIn(box, t), t),
            y: t + v.slotH / 2,
            z: slotFinIn(box, t) / 2,
          },
    ];
    if (folded) {
      const wallH = foldedRearWallIn(box, v, t);
      out.push({
        lb: ply(iw, wallH, t),
        y: t + v.slotH + wallH / 2,
        z: box.d - t - v.slotH - t / 2,
      });
    }
    return out;
  }
  if (style === "vslots" || style === "vslot1") {
    const n = style === "vslot1" ? 1 : 2;
    // the duct runs back from the mouth, leaving at least a throat's gap to the back panel
    const len = Math.min(v.len, box.d - t - v.throat);
    return [
      { lb: n * ply(ih, len, t), y: box.h / 2, z: len / 2 },
      { lb: 2 * n * ply(v.throat, len, ductDividerIn(v)), y: box.h / 2, z: len / 2 },
    ];
  }
  return [];
}

/**
 * The sub box's hardware from its presets (lib/build/hardware planBoxHardware), placed before the braces: its driver where
 * the 3D view puts it, its keep-out, and its vent's panels in the center of gravity. `bracing` (absent: none) only
 * checks the parts; it doesn't move them.
 */
function subHardwarePlacement(
  box: Dims3,
  t: number,
  inset: number,
  style: PortStyle,
  v: BraceVent,
  drv: TubeDriver & Partial<Pick<SubDriver, "lb">>,
  handles: BoxHandles,
  bracing: BoxBracing | null = null,
  material: PanelMaterial = PLYWOOD_MATERIAL,
): BoxHardwarePlan {
  return planBoxHardware({
    box: "sub",
    dims: box,
    t,
    inset,
    handles,
    driver: {
      center: subDriverCenter(box, t, style, v, drv.size),
      lb: drv.lb || 0,
      depthIn: subDriverDepthIn(drv),
    },
    bracing,
    keepOut: subKeepOut(box, t, inset, style, v, drv, undefined, true),
    ventMasses: subVentMasses(box, t, style, v, material),
    material,
  });
}
/**
 * The sub box's hardware (subHardwarePlacement), checked against its braces and ribs by rule, which were planned round
 * its recesses (subBoxBracing with the handles).
 */
export function subHardwarePlan(
  box: Dims3,
  t: number,
  inset: number,
  style: PortStyle,
  v: BraceVent,
  drv: TubeDriver & Pick<SubDriver, "lb"> & Partial<Pick<SubDriver, "ts">>,
  braceStyle: BraceStyleId | undefined,
  handles: BoxHandles,
  back: BackJointId = DEFAULT_BACK_JOINT,
  /** the bracing's panel target, Hz (subBoxBracing) */
  targetHz: number = PA_PANEL_TARGET_HZ,
  /** the walls' material (subBoxBracing) */
  material: PanelMaterial = PLYWOOD_MATERIAL,
): BoxHardwarePlan {
  const bracing = subBoxBracing(
    box,
    t,
    inset,
    style,
    v,
    drv,
    braceStyle,
    handles,
    back,
    targetHz,
    material,
  );
  return subHardwarePlacement(box, t, inset, style, v, drv, handles, bracing, material);
}
/** A horn's baffle cutout (towerHornCutout) in words: a round hole, a traced outline, or a rectangle with its corners. */
export const hornCutoutWords = (
  hc: Pick<ReturnType<typeof towerHornCutout>, "shape" | "w" | "h" | "r">,
) =>
  hc.shape === "circle"
    ? `${formatInches(hc.w)}″ round`
    : hc.shape === "outline"
      ? `${formatInches(hc.w)}″ × ${formatInches(hc.h)}″ (trace the mouth's outline)`
      : `${formatInches(hc.w)}″ × ${formatInches(hc.h)}″, ${formatInches(hc.r)}″ corners`;

/**
 * A partition row's note: where it sits (`where`), its notches round a frame's baffle cleats (`cleats`), its back edge
 * and its seal.
 */
export const partitionNote = (where: string, back: BackJointId, cleats: boolean) =>
  `${where}${cleats ? "; notch the front corners 3/4″ square round the baffle cleats" : ""}; ${BACK_JOINT_PARTITION_NOTES[back]}; seal each airtight`;

/**
 * A frame shell's rows (boxParts of the whole `dims`, label `box`) with an arched top: a semicircle the full width, its
 * outer radius half the width and its springline that far below the top. The sides stop at the springline, a bent
 * strip makes the top, the back and baffle take its curve (which a straight guillotine cut can't make), one cleat runs
 * across the bottom and the uprights stop at the springline. The PA tower's top (lib/speaker/tower towerSpec), on any frame
 * shell.
 */
export function archedShellParts(
  shell: CutPart[],
  box: CutBoxId,
  dims: Dims3,
  t: number,
  joint: CornerJoint,
  extra: {
    back: BackJointId;
    /** a bottom slot's band under the baffle */
    band: number;
    /** the handles' cutout note on the sides */
    sideHardware?: string;
  },
): CutPart[] {
  const { w: W, h: H, d: D } = dims;
  const { back, band } = extra;
  const R = W / 2,
    spring = H - R,
    iw = W - 2 * t;
  const curve = (r: number) =>
    `arched top, ${formatInches(r)}″ radius: cut the blank square, then the arch with a jigsaw or a router on a circle jig (not a straight guillotine cut)`;
  const arched = shell.flatMap((p): CutPart[] => {
    if (p.part === "side")
      return [
        {
          ...p,
          b: spring,
          note: [
            sideJointNote(joint, t, "the bottom edge", back),
            "top edge square, under the arched top's ends",
            extra.sideHardware,
          ]
            .filter(Boolean)
            .join("; "),
        },
      ];
    if (p.part === "topBottom") return [{ ...p, part: "bottom", qty: 1 }];
    if (p.part === "back" || p.part === "baffle")
      return [{ ...p, note: `${p.note}; ${curve(p.a / 2)}` }];
    // the cleats: one across the bottom, and the uprights to the springline; glue blocks round the arch
    if (p.part === "baffleCleat") return [];
    return [p];
  });
  const cleats: CutPart[] = [
    {
      box,
      part: "baffleCleat",
      qty: 1,
      a: BAFFLE_PLY_IN,
      b: iw,
      t: BAFFLE_PLY_IN,
      note: "glue and screw behind the baffle, across the bottom; glue blocks round the arch",
    },
    {
      box,
      part: "baffleCleat",
      qty: 2,
      a: BAFFLE_PLY_IN,
      b: spring - t - band - BAFFLE_PLY_IN,
      t: BAFFLE_PLY_IN,
      note: "up to the arch's springline",
    },
  ];
  const bent: CutPart = {
    box,
    part: "archTop",
    qty: 1,
    a: D,
    b: archStripIn(W, t),
    t,
    note: `bent over the sides to a ${formatInches(R)}″ outer radius, its length on its centerline: kerf the inside face across it every 1/2″, or laminate bending ply to ${formatInches(t)}″; a curve, so only its blank comes off a straight guillotine cut; ${rearRabbetNote(t, back)}'s arch`,
  };
  return [...arched, ...cleats, bent];
}

/** An arched top's bent strip, in: the semicircle's length on its centerline, a wall in from the outer radius. */
export const archStripIn = (w: number, t: number) => Math.PI * (w / 2 - t / 2);

/** The sub's round tubes as bought: the stock pipe, its holes in the baffle and the elbows each takes (lib/build/tubes). */
export type SubTubeKit = ReturnType<typeof subTubeKit>;
/** The sub box's baffle note: the driver's cutout, and its tubes' holes where it has round tubes (`kit`). */
export const subCutNote = (
  sub: Pick<SubDriver, "size">,
  cVent: Pick<VentSpec, "nt" | "dia">,
  kit: SubTubeKit | null,
) =>
  cutoutNote(DRIVER_CUTOUT_IN[sub.size]) +
  (kit
    ? `; ${cVent.nt} × ${formatInches(kit.pipe?.odIn ?? cVent.dia)}″ tube holes, rounded over ${formatInches(TUBE_FLARE_RADIUS_IN)}″`
    : "");
/**
 * The sub's vent as cutlist rows of `box`: a bottom slot's shelf and fins (and its rear channel wall where it folds),
 * a side duct's walls and dividers; round tubes as a line of bought parts (`vent`) from their kit.
 */
export function subVentParts(
  box: CutBoxId,
  subBox: Dims3,
  t: number,
  portStyle: PortStyle,
  cVent: VentSpec,
  kit: SubTubeKit | null,
): { parts: CutPart[]; vent: string[] } {
  const iw = subBox.w - 2 * t,
    ih = subBox.h - 2 * t;
  if (portStyle === PORT_STYLE.slot) {
    const folded = slotFolds(subBox, cVent, t);
    const len = folded ? foldedShelfIn(subBox, cVent.slotH, t) : cVent.len;
    const parts: CutPart[] = [
      { box, part: "ductShelf", qty: 1, a: iw, b: len, t, note: "roof of the bottom slot" },
    ];
    const fins = slotFinsOf(cVent, iw, t);
    const split = `splits the slot into ${fins + 1} openings`;
    if (fins > 0)
      parts.push({
        box,
        part: "ductFin",
        qty: fins,
        a: cVent.slotH,
        b: folded ? len : slotFinIn(subBox, t),
        t,
        note: folded ? split : `${split}; runs on to the back panel, a floor rib past the shelf`,
      });
    if (folded)
      parts.push({
        box,
        part: "ductRearWall",
        qty: 1,
        a: iw,
        b: foldedRearWallIn(subBox, cVent, t),
        t,
        note: "rear channel, rises up the back",
      });
    return { parts, vent: [] };
  }
  if (portStyle === "vslots" || portStyle === "vslot1") {
    const n = portStyle === "vslot1" ? 1 : 2;
    return {
      parts: [
        {
          box,
          part: "sideDuctWall",
          qty: n,
          a: ih,
          b: cVent.len,
          t,
          note: `${formatInches(cVent.throat)}″ throat; 20° chamfer both ends`,
        },
        {
          box,
          part: "ductDivider",
          qty: 2 * n,
          a: cVent.throat,
          b: cVent.len,
          t: ductDividerIn(cVent),
          note: "",
        },
      ],
      vent: [],
    };
  }
  if (!kit) return { parts: [], vent: [] };
  return {
    parts: [],
    vent: [
      `${cVent.nt} × ${formatInches(cVent.dia)}″ port tube, ${formatInches(cVent.len)}″ long on its centerline` +
        (kit.elbows
          ? ` with ${ELBOW_WORDS[kit.elbows]} (${cVent.nt * kit.elbows} × 90° elbow)`
          : "") +
        (kit.pipe
          ? `, cut from ${kit.sticks} × ${kit.pipe.stickFt} ft Sch 40 PVC; flare each inner mouth ${formatInches(TUBE_FLARE_RADIUS_IN)}″`
          : `; no stock pipe in the catalog for ${formatInches(cVent.dia)}″`),
    ],
  };
}

// Where `x` falls on an ascending axis: the cell's lower index and the fraction across it, clamped to the axis' ends.
function axisCell(axis: readonly number[], x: number) {
  const last = axis.length - 1;
  if (!(x > axis[0])) return { i: 0, f: 0 };
  if (x >= axis[last]) return { i: last - 1, f: 1 };
  let i = 0;
  while (axis[i + 1] < x) i++;
  return { i, f: (x - axis[i]) / (axis[i + 1] - axis[i]) };
}
// the run axis doubles at each step, so it is read on a log scale
const RUN_LOG2 = SLOT_INNER_END.run.map(Math.log2);
/**
 * The inner end correction (in) of a slot `h` high that runs along a wall and opens into the box: the shelf forming it
 * `t` thick with the box open beyond it, running `run` from the box's front to the mouth, a facing wall `gap` from the
 * mouth, the box spanning `span` across the mouth (SLOT_INNER_END, interpolated in its axes; outside them, its nearest
 * edge).
 */
export function slotMouthCorrection(h: number, span: number, gap: number, t: number, run: number) {
  const T = SLOT_INNER_END;
  const a = axisCell(T.gap, gap > 0 ? h / gap : Infinity),
    b = axisCell(T.span, h / span),
    c = axisCell(T.wall, t / h),
    d = axisCell(RUN_LOG2, run > 0 ? Math.log2(run / h) : -Infinity);
  let v = 0;
  for (let da = 0; da < 2; da++)
    for (let db = 0; db < 2; db++)
      for (let dc = 0; dc < 2; dc++)
        for (let dd = 0; dd < 2; dd++) {
          const k =
            (da ? a.f : 1 - a.f) *
            (db ? b.f : 1 - b.f) *
            (dc ? c.f : 1 - c.f) *
            (dd ? d.f : 1 - d.f);
          if (k) v += k * T.ecOverH[a.i + da][b.i + db][c.i + dc][d.i + dd];
        }
  return v * h;
}
/**
 * The most slotMouthCorrection can be for a mouth `h` high across `span`, its shelf `t` thick, whatever the gap and the
 * run (in): at the nearest gap (the table rises toward the facing wall), at the run there that gives the most (a short
 * run's narrow room behind the mouth can give more than a long one's). A bound for a search that hasn't cut the duct.
 */
export function slotMouthCorrectionMost(h: number, span: number, t: number) {
  let most = 0;
  for (const r of SLOT_INNER_END.run)
    most = Math.max(most, slotMouthCorrection(h, span, 0, t, r * h));
  return most;
}
/**
 * A side duct's dividers' thickness, in: two per duct, bracing its inner wall to the side wall across the throat. The
 * vent carries the design's (its divider size at the measured thickness); a vent without one, as in older saves, is ½″.
 */
export const ductDividerIn = (v: Pick<VentSpec, "div">) =>
  v.div ?? defaultPanelIn(DUCT_DIVIDER_DEFAULT, PLYWOOD_MATERIAL);
/**
 * A bottom slot's inner end correction (in), `inset` the baffle front behind the frame front. Straight: its mouth on the
 * floor, the back wall behind it, the box's inside height across it. Folded up the back wall: the floor leg turns a sharp 90° into the rear channel (SHARP_BEND_CORRECTION
 * against the centerline the length is measured on), and the channel's mouth, under the lid, is the same kind of mouth
 * turned on its side: along the back panel, the rear wall its shelf (rising from the floor leg's roof), the lid the
 * facing wall, the box's inside depth across it. `most`: the most it can be in this box, straight or folded, whatever
 * the length (slotMouthCorrectionMost).
 */
export function slotInnerEndCorrection(
  box: Dims3,
  v: Pick<VentSpec, "slotH" | "len">,
  t: number,
  inset: number,
  folded: boolean,
  most = false,
) {
  const h = v.slotH;
  if (most)
    return Math.max(
      slotMouthCorrectionMost(h, box.h - 2 * t, t),
      SHARP_BEND_CORRECTION * h + slotMouthCorrectionMost(h, paInside(box, t, inset).inD, t),
    );
  // the slot runs from the frame front under the baffle (as maxStraightSlotIn, the 3D view and the cutlist take it), so
  // its mouth is `d - t - len` from the back panel: a slot height at the longest straight run; its shelf runs into the
  // box's air from behind the baffle (slotRunIn)
  if (!folded)
    return slotMouthCorrection(h, box.h - 2 * t, box.d - t - v.len, t, slotRunIn(v, inset));
  const depth = paInside(box, t, inset).inD; // across the rear channel's mouth, the box's depth behind the baffle
  return (
    SHARP_BEND_CORRECTION * h +
    slotMouthCorrection(h, depth, foldedLidGapIn(box, v, t), t, foldedRearWallIn(box, v, t) - t)
  );
}
/**
 * A side duct's end corrections (in), each duct's (`n` of them, one against each side wall for a pair). Outside, the
 * ground mirrors the bottom of its mouth (throat × open height). Inside, the same mouth as a bottom slot's, turned on its
 * side: the side wall its floor, the duct's inner wall (`t`, from the frame front as the cutlist and the 3D view take it)
 * its shelf (its run in the box's air: slotRunIn), the back wall `d - t - len` behind the mouth, and across it the box's
 * inside width (half of it for a pair: the center line is a plane of symmetry). `most`: the most it can be in this box, whatever the length
 * (slotMouthCorrectionMost).
 */
export function sideDuctEndCorrection(
  box: Dims3,
  v: Pick<VentSpec, "throat" | "len" | "div">,
  t: number,
  inset: number,
  n: 1 | 2,
  most = false,
) {
  const th = v.throat,
    span = (box.w - 2 * t) / n,
    open = box.h - 2 * t - 2 * ductDividerIn(v);
  return (
    rectangleEndCorrection(th, 2 * open) +
    (most
      ? slotMouthCorrectionMost(th, span, t)
      : slotMouthCorrection(th, span, box.d - t - v.len, t, slotRunIn(v, inset)))
  );
}

// Liters of wood inside a box: everything behind the baffle except the shell panels themselves.
// Window braces keep ~2 in rails, so only their rails count.
const SHELL: ReadonlySet<CutPartId> = new Set([
  "side",
  "topBottom",
  "back",
  "baffle",
  "partition",
  "archTop",
]);
export function internalWoodLiters(parts: CutPart[], box: CutBoxId) {
  let in3 = 0;
  for (const p of parts) {
    if (p.box !== box || SHELL.has(p.part)) continue;
    const a = Math.min(p.a, p.b),
      b = Math.max(p.a, p.b);
    const R = WINDOW_RAIL_IN;
    const area =
      p.part === "windowBrace" ? a * b - Math.max(0, a - 2 * R) * Math.max(0, b - 2 * R) : a * b;
    in3 += area * p.t * p.qty;
  }
  return in3 * LITERS_PER_CUBIC_IN;
}

// ---- limits ----
// Every limit is an amp output voltage for a sine at the amp's rated power into 8 ohm. Port and
// cone limits use the sine's peaks. Thermal is program power, 2 x AES, into the driver's nominal
// impedance (lib/power): AES noise has a 6 dB crest, so a sine with the same peak voltage carries
// twice the AES power; music with at least that crest keeps the coil's average at or under AES.
export const thermalVoltageLimit = (ts: Pick<ThieleSmall, "aes" | "imp">) =>
  wattsToVolts(programWatts(ts.aes), ts);
/** The amp's voltage at an amp power `W`, the watts into its load's nominal impedance, V RMS (lib/power). */
export const ampVoltage = (W: number, load: NominalImpedance) => wattsToVolts(W, load);
/** The amp power that gives `V` into the load, W: the watts into its nominal impedance (lib/power). */
export const ampWatts = (V: number, load: NominalImpedance) => voltsToWatts(V, load);
/**
 * A sine's limit at one point of a curve modeled at `AMP_V`: the amp output voltage where the first of the port's air
 * speed, the cone's Xmax, the driver's program rating (thermal) and the amp gives out, and which; with each limit's
 * own voltage (`vp`, `vx`, `vt`). The point's excursion and air speed carry its filters; the program rating and the
 * amp are ceilings on the whole drive.
 */
export function sineLimitAt(
  o: { xmm: number; vel?: number },
  ts: Pick<ThieleSmall, "aes" | "imp" | "Xmax">,
  AMP_V: number,
  portMax: number,
): { V: number; who: SubLimitWho; vp: number; vx: number; vt: number } {
  const vt = thermalVoltageLimit(ts);
  const vp = o.vel != null ? (AMP_V * portMax) / o.vel : Infinity,
    vx = (AMP_V * ts.Xmax) / o.xmm;
  const V = Math.min(vp, vx, vt, AMP_V);
  const who = V === vp ? "port" : V === vx ? "Xmax" : V === vt ? "thermal" : "amp";
  return { V, who, vp, vx, vt };
}
// The sub-bass band, Hz: the low end the sub's readout averages, an absolute level to compare designs by (F3 is relative
// to each driver's own passband).
export const SUB_BASS_BAND_HZ = [30, 50] as const;
/**
 * The amp power, W into the channel's `load` (lib/power), at which an HF section (at its nominal impedance) behind a
 * passive pad of `pad` dB reaches its rating `ratingW` (W into its impedance): the Speaker page's HF headroom check.
 */
export const hfLimitWatts = (
  ratingW: number,
  hf: NominalImpedance,
  pad: number,
  load: NominalImpedance,
) => ampWatts(wattsToVolts(ratingW, hf), load) * Math.pow(10, pad / 10);

// ---- horn ----
// Datasheet model, not T/S: on-horn sensitivity + 10 log P, shaped by the LR24 (or, order 8, LR48)
// highpass at the crossover and 12 dB/oct below the horn's loading limit. Power: the amp power (watts
// into the driver's impedance, lib/power), capped at program (2 x AES), derated 6 dB/oct below the
// frequency AES was rated at.
/**
 * The power a compression driver takes, W: the amp's (`hfAmpW`, the watts into the driver's impedance) or its program
 * rating (2 × AES, derated 6 dB/oct below the frequency AES was rated at when crossed at `xoHi`), the lower.
 */
export function hornPower(
  hf: Pick<CompressionHf, "aes" | "aesXo" | "imp">,
  xoHi: number,
  hfAmpW: number,
): Pick<HornResponse, "P" | "pAmp" | "pProg" | "derate" | "imp" | "who"> {
  const imp = ohmsOf(hf);
  const pAmp = hfAmpW;
  const derate = aesDerate(xoHi, hf.aesXo);
  const pProg = hfProgramWatts(hf, xoHi);
  const P = Math.min(pAmp, pProg);
  return { P, pAmp, pProg, derate, imp, who: P === pAmp ? "amp" : "thermal" };
}
// Keele: a horn holds its angle down to f = 25 400 / (mouth width m x angle deg) (1e6 in-deg-Hz).
export const keeleFrequency = (covDeg: number, mouthIn: number) =>
  25400 / (mouthIn * METERS_PER_INCH * covDeg);
// ---- weights (lb) ----
/**
 * What each box weighs besides its panels, braces, driver and the catalog's hardware, lb:
 * the screws, glue, wiring and damping. The handles, the input dish and its jacks, and the horn posts are counted by
 * part, so these are only the remainder.
 */
export const SUB_FIXINGS_LB = 3.5;
export const MID_FIXINGS_LB = 0.5;
// ---- the mid-bass box: sealed, always lightly stuffed ----
export const STUFFING_VOLUME_GAIN = 1.15; // ~15% more effective volume from light stuffing
/** A mid's displacement, L: its published one, else assumed by size (4 L for a 15″, 2.5 L for a smaller one). */
export const midDisplacementL = (mid: Pick<MidDriver, "size" | "ts">) =>
  mid.ts && mid.ts.disp != null ? mid.ts.disp : mid.size === 15 ? 4 : 2.5;
/**
 * The pad that brings a coaxial's HF section down to its woofer behind a passive network, dB (never negative). Both
 * sensitivities are 1 W / 1 m at their own impedance, so the HF's moves to 2.83 V first (a 16 ohm section gets half
 * the power the 8 ohm woofer does), as the Hi-fi engine's level match does. Zero without
 * an HF section. The Fill speaker template reads it (fillDriverPadDb).
 * @param hf the coaxial's HF section, or null for a fill without one
 * @param wooferSensDb the woofer's sensitivity at 2.83 V / 1 m, dB
 */
export function fillHfPadDb(hf: FillDriver["hf"], wooferSensDb: number): number {
  if (!hf) return 0;
  return Math.max(0, sensitivityAt283(hf.sens, hf) - wooferSensDb);
}

/**
 * The pad for a fill driver: its HF section down to the maker's woofer sensitivity (`lfSens`). The Fill speaker
 * template reads it.
 */
export function fillDriverPadDb(drv: Pick<FillDriver, "hf" | "lfSens">): number {
  return fillHfPadDb(drv.hf, drv.lfSens);
}
