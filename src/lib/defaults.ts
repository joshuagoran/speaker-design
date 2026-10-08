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
  FORMATS,
  N314T,
  SB17NRX,
  SB26STCN,
  ST260,
} from "./data";
import { byIdOrThrow } from "./tables";
import { CUTLIST_DEFAULTS } from "./pa/cutlist";
import { DEFAULT_HARDWARE } from "./pa/hardware";
import type {
  Cabinet,
  CompressionDriver,
  FillDesignState,
  Format,
  HifiDesignState,
  Horn,
  MidBox,
  MidDriver,
  MidSize,
  PaDesignConfig,
  PlywoodSheetKind,
  PortMemory,
  SavedHifiConfig,
  SubDriver,
} from "../types";
import { CATALOG_TABLE_NAMES } from "../constants/catalogTables";
import { DUCT_DIVIDER_DEFAULT } from "../constants/panelSizes";
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
