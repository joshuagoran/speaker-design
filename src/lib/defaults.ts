// The default designs and parts, as whole objects: the drivers are the table entries themselves.
import {
  A460G2_14,
  B15,
  BC10CXN64,
  BC18NBX,
  CABINETS,
  CD_OPTIONS,
  F12PR300,
  FILL_OPTIONS,
  FORMATS,
  HIFI_TWEETERS,
  HIFI_WAVEGUIDES,
  HIFI_WOOFERS,
  HORN_OPTIONS,
  MID_OPTIONS,
  N314T,
  PD1850,
  SB17NRX,
  SUB_OPTIONS,
  SB26STCN,
  ST260,
} from "./data";
import { byIdOrThrow } from "./tables";
import { CUTLIST_DEFAULTS } from "./build/cutlist";
import { DEFAULT_HARDWARE } from "./build/hardware";
import type {
  BandFilter,
  Cabinet,
  CompressionDriver,
  CrossoverOrder,
  FillDesignState,
  FillDriver,
  Format,
  HifiDesignState,
  HifiTweeter,
  HifiWaveguide,
  HifiWoofer,
  Horn,
  MidBox,
  MidDriver,
  MidSize,
  PaDesignConfig,
  PlywoodSheetKind,
  PortMemory,
  SavedHifiConfig,
  DriverKind,
  SpeakerBand,
  SpeakerChamber,
  SpeakerDriverParts,
  SpeakerSpec,
  SpeakerSubDriver,
  SubDriver,
  FoldBoard,
  GenericTop,
  HornDrive,
  HornFold,
  HornGoals,
  HornSegment,
  SidePoint,
} from "../types";
import { CATALOG_TABLE_NAMES } from "../constants/catalogTables";
import { DUCT_DIVIDER_DEFAULT, PLYWOOD_MATERIAL } from "../constants/panelSizes";
import { HIFI_DRIVE } from "../constants/hifiEngine";
import {
  FOLD_WALL,
  HORN_DRIVE,
  PORT_SHAPE,
  SPEAKER_BAND,
  AUTO_BAND_NAMES,
  VENT_KIND,
} from "../constants/speakerSpec";
import { HORN_PROFILE } from "../constants/hornEngine";
import { MM_PER_IN } from "../constants/units";
import { HIFI_STUFFING_GAIN } from "./acoustics/wooferBox";
import {
  DIRECT_LOAD,
  FLUSH_BOX,
  NO_FILTERS,
  flushBracing,
  NO_HARDWARE,
  stuffingPctOf,
} from "./speaker/specParts";
import { DEFAULT_BACK_JOINT } from "../constants/bracing";
import { HORN_MOUNT_DEFAULT } from "../constants/hornMount";

/** The PA design's starting state: a saved config with its driver, horn, box, format and cabinet ids replaced by the objects, plus the cutlist and mid size choices. */
export type PaDefaults = Omit<
  Required<PaDesignConfig>,
  // braceStyle and hornColor have no default: the plywood's style and the horn's catalog finish
  | "format"
  | "cabinet"
  | "summary"
  | "sub"
  | "mid"
  | "midBox"
  | "cd"
  | "horn"
  | "braceStyle"
  | "hornColor"
> & {
  format: Format;
  cabinet: Cabinet;
  sub: SubDriver;
  mid: MidDriver;
  midBox: MidBox;
  cd: CompressionDriver;
  horn: Horn;
  midSize: MidSize;
  plywoodSheetKind: PlywoodSheetKind;
  boxSetCount: number;
};

/**
 * The PA stack on first load. It mirrors the seed "lil block stack LE" in `data/configs-seed.json` with the sub swapped
 * for the B&C 18NBX100 and the sub box set to 24 × 32 × 18; the fields the seed does not carry (wall, inset, finish, spacer, cutlist choices, plywood, sets, mid size) keep the values the hooks always started on.
 */
export const DEFAULT_PA = {
  // the only format and cabinet a PA design has ever offered; nothing changes them
  format: byIdOrThrow(FORMATS, "full", CATALOG_TABLE_NAMES.formats),
  cabinet: byIdOrThrow(CABINETS, "column", CATALOG_TABLE_NAMES.cabinets),
  sub: BC18NBX,
  mid: F12PR300,
  cd: N314T,
  horn: A460G2_14,
  midBox: B15,
  portStyle: "slots",
  cDim: { w: 24, h: 32, d: 18 },
  cVent: { slotH: 3, nt: 2, dia: 4.25, throat: 2, len: 14 },
  hpf: 31,
  hpType: "BW24",
  ampW: 800,
  portMax: 23.5,
  mDim: { w: 15, h: 15, d: 15 },
  wall: 0.75,
  panel: "3/4",
  divider: DUCT_DIVIDER_DEFAULT,
  inset: 0.75,
  xoLo: 120,
  xoHi: 900,
  xoLoOrder: 4,
  xoHiOrder: 4,
  mAmpW: 400,
  hfAmpW: 100,
  layout: "stack",
  hardware: DEFAULT_HARDWARE,
  backJoint: DEFAULT_BACK_JOINT,
  hornMount: HORN_MOUNT_DEFAULT,
  baffleColor: "#4a5d4e",
  cabFinish: "birch",
  spacerH: 20,
  joint: "butt",
  ...CUTLIST_DEFAULTS,
  exactIn: {},
  midSize: 12,
  plywoodSheetKind: "4x8",
  boxSetCount: 2,
} satisfies PaDefaults;

/** What each port shape starts at: the round port's diameter and the slot's height. The toggle falls back to these until you size the other shape. */
export const DEFAULT_PORT_SIZE: PortMemory = { dia: 2, h: 1 };

/** The default hi-fi design, room and waveguide. */
export const DEFAULT_HIFI = {
  woofer: SB17NRX,
  tweeter: SB26STCN,
  selectedWaveguide: ST260,
  boxType: "vented",
  boxDims: { w: 9, h: 15, d: 11 },
  wallPanel: "3/4",
  panelExactIn: {},
  panelMaterial: "ply",
  portSpec: { n: 1, dia: DEFAULT_PORT_SIZE.dia, len: 6 },
  radiatorSelection: { id: "sb16pfcr", n: 2, addG: 0 },
  crossoverHz: 2000,
  crossoverOrder: 4,
  wooferAmpWatts: 100,
  tweeterAmpWatts: 50,
  baffleStepCompensationDb: 3,
  placement: "free",
  distanceToWallFt: 2,
  speakerSpacingFt: 7,
  toeInDeg: 15,
  listeningSeat: { x: 0, y: 8 },
  earHeightIn: 38,
  standHeightIn: 24,
  dispersionPlane: "h",
  roundoverIn: 0,
  tweeterOffsetIn: 0,
} satisfies HifiDesignState;

/**
 * The Hi-fi speaker's look in the 3D view: the PA stack's cabinet finish and baffle paint (the two pages share the
 * pickers and the finishes; each design keeps its own choice). Designs saved before the look load with these.
 */
export const DEFAULT_HIFI_LOOK = {
  cabFinish: DEFAULT_PA.cabFinish,
  baffleColor: DEFAULT_PA.baffleColor,
} satisfies Required<Pick<SavedHifiConfig, "cabFinish" | "baffleColor">>;

/** The default fill design. */
export const DEFAULT_FILL = {
  driver: BC10CXN64,
  boxType: "vented",
  boxDims: { w: 11.5, h: 16, d: 11 },
  portSpec: { n: 1, dia: 3, len: 4 },
  highpassHz: 70,
  highpassOrder: 4,
  ampWatts: 300,
  maxPortAirSpeedMs: 20,
} satisfies FillDesignState;

/** The part each driver kind starts on when the Speaker page adds one: the default PA, hi-fi, and fill designs' parts. */
export const DEFAULT_DRIVER_IDS = {
  sub: DEFAULT_PA.sub.id,
  mid: DEFAULT_PA.mid.id,
  compression: DEFAULT_PA.cd.id,
  woofer: DEFAULT_HIFI.woofer.id,
  tweeter: DEFAULT_HIFI.tweeter.id,
  coaxial: DEFAULT_FILL.driver.id,
} as const satisfies { [K in DriverKind]: SpeakerDriverParts[K]["id"] };

/**
 * A chamber the Speaker page adds: sealed and stuffed as the Hi-fi engine stuffs one, the Hi-fi starting box's size, no
 * drivers yet; its net air from the size.
 */
export const DEFAULT_SPEAKER_CHAMBER: SpeakerChamber = {
  at: { xIn: 0, yIn: 0 },
  dims: DEFAULT_HIFI.boxDims,
  netLiters: null,
  stuffingPct: stuffingPctOf(HIFI_STUFFING_GAIN),
  vent: { kind: VENT_KIND.sealed },
  load: DIRECT_LOAD,
  drivers: [],
  bracing: flushBracing(DEFAULT_PA.wall),
};

/** A band the Speaker page adds: no filters, at 0 dB, active, on the Hi-fi woofer's amp power. */
export const DEFAULT_SPEAKER_BAND: Omit<SpeakerBand, "id" | "name"> = {
  highpass: null,
  lowpass: null,
  levelDb: 0,
  drive: HIFI_DRIVE.active,
  ampW: DEFAULT_HIFI.wooferAmpWatts,
};

/**
 * The Speaker page's empty speaker: one chamber (DEFAULT_SPEAKER_CHAMBER) in the PA's ¾″ birch ply, a flush box with a
 * flat top and sharp edges, one low band with no filters and the full input range; the PA's look.
 */
export const EMPTY_SPEAKER: Omit<SpeakerSpec, "id" | "name"> = {
  cabinet: {
    chambers: [DEFAULT_SPEAKER_CHAMBER],
    panel: { nominal: DEFAULT_PA.panel, material: PLYWOOD_MATERIAL, thicknessIn: DEFAULT_PA.wall },
    ...FLUSH_BOX,
    ...NO_HARDWARE,
    roundoverIn: 0,
    tiltDeg: 0,
  },
  bands: [{ id: SPEAKER_BAND.low, name: AUTO_BAND_NAMES.fullRange, ...DEFAULT_SPEAKER_BAND }],
  input: NO_FILTERS,
  look: { cabFinish: DEFAULT_PA.cabFinish, baffleColor: DEFAULT_PA.baffleColor },
};

/** A vented box's starting size and port, as a hi-fi design takes them. */
type StartBox = Pick<HifiDesignState, "boxDims" | "portSpec">;

/**
 * The Speaker page's DJ booth monitor templates: a pair, one on
 * each side of the DJ, hung or on pedestals (not floor wedges), 0.5–1.5 m away, 90–100° wide, crossed to the subs at
 * 70 Hz LR24 (60–80 Hz). Two options:
 * - a coaxial in a small vented box: the Celestion FTX1025 (10″, 100°) in the default fill design's box and port with ½″ walls,
 *   crossed at its HF section's recommended minimum;
 * - an 8″ and a 1″ compression driver on a small 4–6″ horn mounted tight above it, crossed at about 2.5–3 kHz (the low
 *   end: an 8″ narrows to about 65° at 2.7 kHz): the FaitalPRO 8PR200 (published to 5 kHz) and the B&C DE250 on the
 *   B&C ME20 (90° × 60°, holds its pattern above about 1.9 kHz), in a vented ¾″ box.
 */
export const DEFAULT_MONITOR = {
  highpass: { hz: 70, order: 4 },
  coax: byIdOrThrow(FILL_OPTIONS, "celftx1025", CATALOG_TABLE_NAMES.fills),
  coaxBox: {
    boxDims: DEFAULT_FILL.boxDims,
    portSpec: { shape: PORT_SHAPE.round, ...DEFAULT_FILL.portSpec },
  },
  woofer: byIdOrThrow(HIFI_WOOFERS, "f8pr200", CATALOG_TABLE_NAMES.hifiWoofers),
  tweeter: byIdOrThrow(HIFI_TWEETERS, "de250", CATALOG_TABLE_NAMES.hifiTweeters),
  waveguide: byIdOrThrow(HIFI_WAVEGUIDES, "me20", CATALOG_TABLE_NAMES.hifiWaveguides),
  crossoverHz: 2500,
  hornBox: {
    boxDims: { w: 11, h: 20, d: 11 },
    portSpec: { shape: PORT_SHAPE.round, n: 1, dia: 3, len: 6 },
  },
} satisfies {
  highpass: { hz: BandFilter["hz"]; order: CrossoverOrder };
  coax: FillDriver;
  coaxBox: StartBox;
  woofer: HifiWoofer;
  tweeter: HifiTweeter;
  waveguide: HifiWaveguide;
  crossoverHz: number;
  hornBox: StartBox;
};

/**
 * The PA v2 sub bin: 18″ subs stacked in one
 * throat, front-loaded on a straight-sided 1-D flare (the box's own top and bottom, two flat side walls that angle out:
 * a parabolic flare, its area growing linearly), a vented rear chamber with one slot on each front side, folded once
 * along the back wall, tuned to ~35 Hz with a 30 Hz BW24 subsonic, on the PA's 800 W. The sizes are each driver's
 * share; the template takes them once per driver. Its mouth is the face between the side slots (~980 mm in the mock-up,
 * the template's eighth-inch box ~978 mm).
 */
export const PA_V2_SUB_BIN = {
  sub: BC18NBX,
  /**
   * the box's outside width and depth, mm (its height: the drivers' openings and two walls). The depth is the
   * mock-up's 766 mm made 3/8″ deeper (the template's 30 1/2″): the smallest 1/8″ step that holds the flare, the
   * walls' clearance and the drivers at their catalog depth.
   */
  widthMm: 1182,
  depthMm: 775,
  /** each driver's share of the throat's and the mouth's height, mm: two 18″ fill the 920 mm mouth */
  openingMm: 460,
  /**
   * the flare: its compression ratio (the cones' area over the throat's: the side walls' back edges cover the cones'
   * outer parts, lib/speaker/hornThroat; the owner's pick from the sweep of 1 to 3 in quarter steps, for the flatter
   * band), and its length, cm
   */
  compression: 2,
  flareCm: 50,
  /** each driver's share of the rear chamber's net air, L: the wedges beside the flare join it (~324 L for two) */
  rearLiters: 162,
  /** the slots: this wide and the mouth's height, mm (~600 cm² per driver), and their folded length */
  slotWidthMm: 65,
  slotLengthMm: 680,
  subsonic: { hz: 30, type: "BW24" },
} satisfies {
  sub: SubDriver;
  subsonic: BandFilter;
  [figure: string]: number | SubDriver | BandFilter;
};

/** A point of a side section given in mm (`zMm` back from the baffle's inside face, `yMm` up from the inside bottom). */
const mmPoint = (zMm: number, yMm: number): SidePoint => ({
  zIn: zMm / MM_PER_IN,
  yIn: yMm / MM_PER_IN,
});
/** A board between two side-section points given in mm: its center line's ends. */
const mmBoard = (a: readonly [number, number], b: readonly [number, number]): FoldBoard => ({
  a: mmPoint(...a),
  b: mmPoint(...b),
});
/** TH18's joints, mm: each is two boards' center lines meeting at a corner (the same point on both). */
const TH18_JOINT = {
  /** the driver board's back end and the long back board's foot */
  driverFoot: [446.2, 309.2],
  /** the front board's foot and the closed-end leg's top board */
  frontFoot: [113.3, 606.7],
} as const;

/**
 * TH18 by Xoc1: a tapped horn for one Precision Devices PD.1850/3, from its plans (side section, mm, 18 mm birch ply)
 * and its Hornresp record (tools/hornresp/records/th18-xoc1.txt). The box is 724 mm deep and 1016 mm tall outside; the
 * plans give no width, so the clear width is the published 535 mm. The boards are the plans' boards, as center lines
 * in the clear side section (688 × 980 mm): each from the plans' faces, offset half a board. A free end stops half a
 * board short of the plans' end (the trace rounds it by that much). The cones face up into the closed-end leg at the
 * plans' spot (260 mm along the driver board from the front); the motor hangs in the mouth leg. The two corner boards
 * (the chamfer at the bottom back and the brace at the top back) are full-width boards: the air behind them is sealed.
 */
export const TH18_XOC1 = {
  driver: PD1850,
  /** the box's outside size, mm: its clear width (535 mm) and two walls, its depth and height from the plans */
  outerMm: { w: 571, h: 1016, d: 724 },
  wallMm: 18,
  /** the record's sections (cm², cm): conical, the fronts tap S2 and the rears S4 */
  segments: [
    { profile: HORN_PROFILE.conical, s1: 283.55, s2: 455.34, length: 21.76 },
    { profile: HORN_PROFILE.conical, s1: 455.34, s2: 1248.53, length: 217.59 },
    { profile: HORN_PROFILE.conical, s1: 1248.53, s2: 2150.7, length: 44.87 },
    { profile: HORN_PROFILE.conical, s1: 2150.7, s2: 2717.8, length: 24.22 },
  ],
  drive: { kind: HORN_DRIVE.tapped, frontTap: 1, rearTap: 3 },
  /**
   * the band it is built for: from the record's tuning (3 dB down at 36 Hz in Hornresp) to about where its response
   * first dips (115 Hz), at the most the straight horn reaches over it at full power (127 dB at 1 m)
   */
  goals: { lowHz: 36, highHz: 115, targetDb: 127 },
  fold: {
    boards: [
      // the driver board: its lower face from the mouth's top (526 mm up outside) down at 24.2° to the back board
      mmBoard([0, 509.8], TH18_JOINT.driverFoot),
      // the long back board: its front face 489 mm back outside at the top (811 mm up), 497 long, leaning 4° forward
      mmBoard(TH18_JOINT.driverFoot, [479.4, 784]),
      // the front board: its front face from 139 mm (869 mm up) to 122 mm (620 mm up) back outside, 250 long
      mmBoard(TH18_JOINT.frontFoot, [129.4, 842]),
      // the closed-end leg's top board: its lower face 407 long, 9.6° steeper than the driver board, to the back board
      mmBoard(TH18_JOINT.frontFoot, [451.2, 380.6]),
      // the short board down from the top: its front face 295 mm back outside, 297 long
      mmBoard([286, 980], [286, 692]),
      // the 186 board: from the closed-end leg's top board (306 mm back, 519 mm up) to the back board (599 mm up)
      mmBoard([269.5, 502.2], [466.2, 595.7]),
      // the chamfer at the bottom back: 159 × 159 outside, at 45°
      mmBoard([552.3, 0], [688, 135.7]),
      // the brace at the top back: 113 × 113, at 45°
      mmBoard([587.7, 980], [688, 879.7]),
    ],
    // the cones' center 260 mm along the driver board's lower face from the front: half way along its center line
    drivers: { board: 0, along: 0.4994, face: 1 },
    // the front is open from the inside bottom to the driver board (526 mm up outside)
    mouth: { wall: FOLD_WALL.baffle, fromIn: 0, toIn: 508 / MM_PER_IN },
  },
} satisfies {
  driver: SpeakerSubDriver;
  segments: HornSegment[];
  drive: HornDrive;
  goals: HornGoals;
  fold: HornFold;
  [figure: string]: unknown;
};

/**
 * The PA v2 mid box (the Hornresp case tests/hornresp/mid-pair):
 * two 10″ in one throat, ~280 mm apart, the side walls' back edges over the cones' outer parts (the front chamber
 * follows them), an exponential 1-D flare (the box's own top and bottom, two curved side walls), a vented rear chamber
 * (~34 L, the wedges sealed) with a straight slot on each front side, tuned to ~95 Hz, on 450 W per driver. It crosses
 * to the HF (the N314T on the DIY R-OSSE, its own box) at the R-OSSE's lowest crossover. The Hornresp case keeps the
 * mock-up's 800 cm² throat and 1 L throat chamber.
 */
export const PA_V2_MID_BOX = {
  mid: byIdOrThrow(MID_OPTIONS, "es10mb600", CATALOG_TABLE_NAMES.mids),
  drivers: 2,
  hfHorn: byIdOrThrow(HORN_OPTIONS, "diy_rosse110x50", CATALOG_TABLE_NAMES.horns),
  /**
   * the box's outside width and depth, mm (its height: the opening and two walls). The depth is the mock-up's 526 mm
   * made 1/4″ deeper (the template's 21″): the smallest 1/8″ step that holds the flare, the walls' clearance and the
   * drivers at their depth.
   */
  widthMm: 614,
  depthMm: 533,
  /** the throat's and the mouth's height, mm, and the cones' spacing in it */
  openingMm: 560,
  coneSpacingMm: 280,
  /**
   * the flare's compression ratio (the cones' area over the throat's: the side walls' back edges cover the cones' outer
   * parts, lib/speaker/hornThroat; the best of 1 to 3 in quarter steps) and its length, cm; the
   * mouth is the face between the side slots at the box's inside height (~500 × 560 mm, 2800 cm², in the mock-up; the
   * template's eighth-inch box gives ~2750 cm²)
   */
  compression: 2,
  flareCm: 35,
  rearLiters: 34,
  slotWidthMm: 21,
  slotLengthMm: 165,
  ampW: 450,
} satisfies {
  mid: MidDriver;
  hfHorn: Horn;
  [figure: string]: number | MidDriver | Horn;
};

/**
 * The generic vented subs: an approximation of the common commercial 18″ subs (QSC, EV, JBL, Mackie, RCF), not one
 * product. One or two B&C 18SW115 in one vented chamber with a letterbox slot, on the PA's subsonic, below the PA's
 * crossover to the tops.
 */
export const GENERIC_SUB = {
  sub: byIdOrThrow(SUB_OPTIONS, "bc18sw", CATALOG_TABLE_NAMES.subs),
  subsonic: { hz: 33, type: "BW24" },
  single: {
    count: 1,
    dims: { w: 22, h: 25, d: 28 },
    port: { shape: PORT_SHAPE.slot, n: 1, h: 4.5, len: 14, fins: 2 },
    ampW: 1600,
  },
  dual: {
    count: 2,
    dims: { w: 46, h: 25, d: 27 },
    port: { shape: PORT_SHAPE.slot, n: 1, h: 4, len: 13, fins: 2 },
    ampW: 2400,
  },
} satisfies {
  sub: SubDriver;
  subsonic: BandFilter;
  [box: string]: unknown;
};

/**
 * The generic tops: an approximation of the common commercial 12″ and 15″ powered tops (QSC, EV, JBL,
 * Mackie, RCF), not one product. A cone and a 1″-exit driver with a 1.75″ coil (the B&C DE250) on a 90° horn in the
 * baffle, crossed at about 1.7–1.8 kHz as the makers do, in a vented box with a letterbox slot along the floor.
 */
export const GENERIC_TOPS = {
  cd: byIdOrThrow(CD_OPTIONS, "de250", CATALOG_TABLE_NAMES.compressionDrivers),
  twelve: {
    mid: byIdOrThrow(MID_OPTIONS, "by12lex1300nd", CATALOG_TABLE_NAMES.mids),
    horn: byIdOrThrow(HORN_OPTIONS, "me45", CATALOG_TABLE_NAMES.horns),
    box: {
      dims: { w: 14.5, h: 24, d: 14 },
      port: { shape: PORT_SHAPE.slot, n: 1, h: 2.25, len: 9, fins: 1 },
    },
    crossoverHz: 1800,
    highpass: { hz: 48, type: "BW24" },
    ampW: 800,
    hfAmpW: 100,
    hfLevelDb: -15,
    hardware: { handles: DEFAULT_PA.hardware.mid, inputDish: true },
  },
  fifteen: {
    mid: byIdOrThrow(MID_OPTIONS, "by15g40", CATALOG_TABLE_NAMES.mids),
    horn: byIdOrThrow(HORN_OPTIONS, "me45", CATALOG_TABLE_NAMES.horns),
    box: {
      dims: { w: 17, h: 28, d: 15.5 },
      port: { shape: PORT_SHAPE.slot, n: 1, h: 2, len: 9, fins: 1 },
    },
    crossoverHz: 1700,
    highpass: { hz: 42, type: "BW24" },
    ampW: 1000,
    hfAmpW: 100,
    hfLevelDb: -13,
    hardware: { handles: DEFAULT_PA.hardware.mid, inputDish: true },
  },
} satisfies { cd: CompressionDriver; [top: string]: CompressionDriver | GenericTop };

/**
 * The generic 18″ horn sub: an approximation of the common commercial folded front-loaded 18″ bins, not one product,
 * at the Cerwin-Vega EL-36's size.
 * One B&C 18SW115 in a sealed rear chamber, its horn laid out from its goals (Start from goals: the horn engine's
 * folded front-loaded design).
 */
export const GENERIC_HORN_SUB = {
  sub: byIdOrThrow(SUB_OPTIONS, "bc18sw", CATALOG_TABLE_NAMES.subs),
  dims: { w: 24, h: 36, d: 36 },
  goals: { lowHz: 40, highHz: 130, targetDb: 131 },
  subsonic: { hz: 35, type: "BW24" },
  ampW: 1200,
} satisfies {
  sub: SubDriver;
  dims: SpeakerChamber["dims"];
  goals: HornGoals;
  subsonic: BandFilter;
  ampW: number;
};
