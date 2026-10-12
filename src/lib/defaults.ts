// What the planner shows on first load, as whole objects: the drivers are the table entries themselves.
import {
  A460G2_14,
  B15,
  B18,
  BC10CXN64,
  BC15NDL76,
  BC18NBX,
  CABINETS,
  F12PR300,
  FILL_OPTIONS,
  FORMATS,
  HIFI_TWEETERS,
  HIFI_WAVEGUIDES,
  HIFI_WOOFERS,
  HORN_OPTIONS,
  MID_OPTIONS,
  N314T,
  SB17NRX,
  SB26STCN,
  ST260,
} from "./data";
import { byIdOrThrow } from "./tables";
import { CUTLIST_DEFAULTS } from "./pa/cutlist";
import { DEFAULT_HARDWARE } from "./pa/hardware";
import type {
  BandFilter,
  Cabinet,
  CompressionDriver,
  CrossoverOrder,
  FillDesignState,
  FillDriver,
  Format,
  HifiDesignState,
  HifiPort,
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
  SubDriver,
} from "../types";
import { CATALOG_TABLE_NAMES } from "../constants/catalogTables";
import { DUCT_DIVIDER_DEFAULT, PLYWOOD_MATERIAL } from "../constants/panelSizes";
import { HIFI_DRIVE } from "../constants/hifiEngine";
import { SPEAKER_BAND, SPEAKER_BAND_NAMES, VENT_KIND } from "../constants/speakerSpec";
import { HIFI_STUFFING_GAIN } from "./hifi/hifi";
import { DIRECT_LOAD, FLUSH_BOX, NO_FILTERS, stuffingPctOf } from "./speaker/specParts";
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
  // the only format and cabinet the planner has ever offered; nothing changes them
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
  tilt: 6,
  hfAmpW: 100,
  hfTilt: 3,
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

/** The mid driver and box the mid size toggle switches to: the 12 is the starting design's, the 15 has its own. */
export const DEFAULT_MID_BY_SIZE: Partial<Record<MidSize, Pick<PaDefaults, "mid" | "midBox">>> = {
  12: { mid: DEFAULT_PA.mid, midBox: DEFAULT_PA.midBox },
  15: { mid: BC15NDL76, midBox: B18 },
};

/** What each port shape starts at: the round port's diameter and the slot's height. The toggle falls back to these until you size the other shape. */
export const DEFAULT_PORT_SIZE: PortMemory = { dia: 2, h: 1 };

/** The Hi-fi page's starting design, room and waveguide. */
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

/** The Fills page's starting design. */
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

/** The part each driver kind starts on when the Designer adds one: the PA, Hi-fi and Fills pages' starting parts. */
export const DEFAULT_DRIVER_IDS = {
  sub: DEFAULT_PA.sub.id,
  mid: DEFAULT_PA.mid.id,
  compression: DEFAULT_PA.cd.id,
  woofer: DEFAULT_HIFI.woofer.id,
  tweeter: DEFAULT_HIFI.tweeter.id,
  coaxial: DEFAULT_FILL.driver.id,
} as const satisfies { [K in DriverKind]: SpeakerDriverParts[K]["id"] };

/**
 * A chamber the Designer adds: sealed and stuffed as the Hi-fi engine stuffs one, the Hi-fi starting box's size, no
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
};

/** A band the Designer adds: no filters, at 0 dB, active, on the Hi-fi woofer's amp power. */
export const DEFAULT_SPEAKER_BAND: Omit<SpeakerBand, "id" | "name"> = {
  highpass: null,
  lowpass: null,
  levelDb: 0,
  drive: HIFI_DRIVE.active,
  ampW: DEFAULT_HIFI.wooferAmpWatts,
};

/**
 * The Designer's empty speaker: one chamber (DEFAULT_SPEAKER_CHAMBER) in the PA's ¾″ birch ply, a flush box with a
 * flat top and sharp edges, one low band with no filters and the full input range; the PA's look.
 */
export const EMPTY_SPEAKER: Omit<SpeakerSpec, "id" | "name"> = {
  cabinet: {
    chambers: [DEFAULT_SPEAKER_CHAMBER],
    panel: { nominal: DEFAULT_PA.panel, material: PLYWOOD_MATERIAL, thicknessIn: DEFAULT_PA.wall },
    ...FLUSH_BOX,
    roundoverIn: 0,
    tiltDeg: 0,
  },
  bands: [{ id: SPEAKER_BAND.low, name: SPEAKER_BAND_NAMES.low, ...DEFAULT_SPEAKER_BAND }],
  input: NO_FILTERS,
  look: { cabFinish: DEFAULT_PA.cabFinish, baffleColor: DEFAULT_PA.baffleColor },
};

/** A vented box's starting size and round port, as the Hi-fi page takes them. */
interface StartBox {
  dims: HifiDesignState["boxDims"];
  port: HifiPort;
}

/**
 * The Designer's DJ booth monitor templates (docs/speaker-designer-plan.md P4 and the owner decisions): a pair, one on
 * each side of the DJ, hung or on pedestals (not floor wedges), 0.5–1.5 m away, 90–100° wide, crossed to the subs at
 * 70 Hz LR24 (60–80 Hz). Two options:
 * - a coaxial in a small vented box: the Celestion FTX1025 (10″, 100°) in the Fills page's box and port with ½″ walls,
 *   crossed at its HF section's recommended minimum;
 * - an 8″ and a 1″ compression driver on a small 4–6″ horn mounted tight above it, crossed at about 2.5–3 kHz (the low
 *   end: an 8″ narrows to about 65° at 2.7 kHz): the FaitalPRO 8PR200 (published to 5 kHz) and the B&C DE250 on the
 *   B&C ME20 (90° × 60°, holds its pattern above about 1.9 kHz), in a vented ¾″ box.
 */
export const DEFAULT_MONITOR = {
  highpass: { hz: 70, order: 4 },
  coax: byIdOrThrow(FILL_OPTIONS, "celftx1025", CATALOG_TABLE_NAMES.fills),
  coaxBox: { dims: DEFAULT_FILL.boxDims, port: { shape: "round", ...DEFAULT_FILL.portSpec } },
  woofer: byIdOrThrow(HIFI_WOOFERS, "f8pr200", CATALOG_TABLE_NAMES.hifiWoofers),
  tweeter: byIdOrThrow(HIFI_TWEETERS, "de250", CATALOG_TABLE_NAMES.hifiTweeters),
  waveguide: byIdOrThrow(HIFI_WAVEGUIDES, "me20", CATALOG_TABLE_NAMES.horns),
  crossoverHz: 2500,
  hornBox: { dims: { w: 11, h: 20, d: 11 }, port: { shape: "round", n: 1, dia: 3, len: 6 } },
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
 * The PA v2 sub bin (docs/pa-v2-plan.md, the lead option and its mock-up; the horn engine's Hornresp case
 * tests/hornresp/sub-bin-vented holds one driver's share): 18″ subs stacked in one throat, front-loaded on a straight
 * 1-D flare from the cones, a vented rear chamber with one slot on each front side, folded once along the back wall,
 * tuned to ~35 Hz with a 30 Hz BW24 subsonic, on the PA's 800 W. The sizes are each driver's share; the template takes
 * them once per driver.
 */
export const PA_V2_SUB_BIN = {
  sub: BC18NBX,
  /** the box's outside width and depth, mm (its height: the drivers' openings and two walls) */
  widthMm: 1182,
  depthMm: 766,
  /** each driver's share of the throat's and the mouth's height, mm: two 18″ fill the 920 mm mouth */
  openingMm: 460,
  /** the flare: from the cone's area to each driver's share of the mouth, cm², over its length, cm, in conical steps */
  mouthCm2: 4500,
  flareCm: 50,
  flareSteps: 4,
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

/**
 * The PA v2 mid box (docs/pa-v2-plan.md, the lead option and its mock-up; the Hornresp case tests/hornresp/mid-pair):
 * two 10″ in one throat, ~280 mm apart, a 1 L throat chamber, an exponential 1-D flare, a vented rear chamber (~34 L,
 * the wedges sealed) with a straight slot on each front side, tuned to ~95 Hz, on 450 W per driver. It crosses to the
 * HF (the N314T on the DIY R-OSSE, its own box) at the R-OSSE's lowest crossover.
 */
export const PA_V2_MID_BOX = {
  mid: byIdOrThrow(MID_OPTIONS, "es10mb600", CATALOG_TABLE_NAMES.mids),
  drivers: 2,
  hfHorn: byIdOrThrow(HORN_OPTIONS, "diy_rosse110x50", CATALOG_TABLE_NAMES.horns),
  /** the box's outside width and depth, mm (its height: the opening and two walls) */
  widthMm: 614,
  depthMm: 526,
  /** the throat's and the mouth's height, mm, and the cones' spacing in it */
  openingMm: 560,
  coneSpacingMm: 280,
  throatChamberL: 1,
  throatCm2: 800,
  mouthCm2: 2800,
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
