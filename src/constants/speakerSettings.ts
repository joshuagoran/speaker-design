// The Speaker page's settings column words (src/pages/speaker): the sub-sections, the folds' summaries, the position
// labels and the tooltips. One short sentence per line; longer help goes in a tooltip.
import type { CabinetConstruction } from "../types";
import type { FILL_LEVEL_PCT } from "./speakerSteps";
import { CABINET_TOP_NAMES } from "./speakerSpec";
import { SPEAKER_SETTINGS_SECTIONS } from "./settingsSections";

// Names that tips here and on the Speaker page (constants/speakerPage) both use (`**name**`): each name once.
/** The horn's goals button. */
export const START_FROM_GOALS = "Start from goals";
/** The horn import's fold. */
export const HORN_IMPORT_NAME = "Import a Hornresp record";
/** The horn's type setting. */
export const HORN_TYPE_NAME = "Horn type";
/** A chamber's Type choice for drivers on the baffle, sealed or ported (`CHAMBER_LOAD_NAMES.direct`). */
export const BOX_LOAD_NAME = "Box";

/** A fill level's id (`FILL_LEVEL_PCT`). */
type FillLevel = keyof typeof FILL_LEVEL_PCT;

/**
 * The position labels (CLAUDE.md, UI rules): a sign names the side. The code keeps x, y and z; each label's tooltip says
 * where it is measured from.
 */
export const POSITION_LABELS = {
  x: "Left (−) / Right (+)",
  y: "Down (−) / Up (+)",
  z: "Front (−) / Back (+)",
} as const;

/** Where each position is measured from: a driver's, a vent's or a horn mouth's on its chamber, and a chamber's. */
export const POSITION_TIPS = {
  partX: "From the chamber's center, seen from the front.",
  partY: "From the chamber's bottom.",
  partZ: "From the chamber's front edge, seen from the side.",
  chamberX: "From the cabinet's center, seen from the front.",
  chamberY: "From the cabinet's bottom.",
  /** a cabinet of one chamber: the chamber is the cabinet, so it has no position of its own */
  oneChamber: "With one chamber, the chamber is the cabinet. It has no position of its own.",
} as const;

/** Each fill level as its button names it. */
export const FILL_NAMES = {
  none: "None",
  lined: "Lined",
  half: "Half",
  full: "Full",
} as const satisfies Record<FillLevel, string>;

/** What to do for each fill level, as its button's tooltip says it. */
export const FILL_TIPS = {
  none: "No fill.",
  lined: "Line the walls, about 1 in thick.",
  half: "Fill about half the air, loosely.",
  full: "Fill all the air, loosely.",
} as const satisfies Record<FillLevel, string>;

/** Each fill level in the Fill and bracing summary. */
export const FILL_SUMMARY = {
  none: "No fill",
  lined: "Lined walls",
  half: "Half fill",
  full: "Full fill",
} as const satisfies Record<FillLevel, string>;

/** The construction in the Construction summary, in one word. */
export const CONSTRUCTION_SHORT = {
  frameInset: "Frame",
  flushBox: "Flush",
} as const satisfies Record<CabinetConstruction, string>;

/** The chamber card's sub-sections that the horn's tips name. */
const SIZE_NAME = "Size";
const DRIVERS_NAME = "Drivers";

/** The settings column's words. */
export const SETTINGS_TEXT = {
  // the chamber card's sub-sections
  size: SIZE_NAME,
  vent: "Vent",
  fillBracing: "Fill and bracing",
  horn: "Horn",
  hornSettings: "Horn settings",
  drivers: DRIVERS_NAME,
  removeChamber: "Remove",
  addChamber: "Add chamber",
  addDriver: "Add driver",
  /** a driver's trash icon: what it does, by the driver's place */
  deleteDriver: (n: number) => `Delete driver ${n}`,
  noDrivers: "No drivers yet.",
  ventType: "Vent type",
  advanced: "Advanced",
  /** the chamber Advanced fold's summary: its position, as the fields show it */
  chamberAt: (x: number, y: number) => `at ${x}, ${y}`,
  // fiber fill
  fill: "Fiber fill",
  fillTip:
    "Polyester fiber slows the air in the box. The box then acts larger and tunes a little lower.",
  /** the readout beside the fill: the air the box acts as, L, and its gain, % */
  actsAs: (liters: string, pct: number) => `Acts as ${liters} L (+${pct}%)`,
  // bracing
  bracing: "Bracing",
  braceTarget: "Target",
  backPanel: "Back panel",
  /** the Fill and bracing summary's bracing: the style's words and its target, as formatted text */
  bracedTo: (style: string, target: string) => `${style} to ${target}`,
  noBraces: "no braces",
  // the horn
  goals: "Goals",
  goalLow: "Low",
  goalHigh: "High",
  goalLevel: "Level",
  designTip: `Sets initial horn layout using your goals, **${DRIVERS_NAME}**, **${SIZE_NAME}**, and **${HORN_TYPE_NAME}**.`,
  rearChamber: "Rear chamber",
  rearChamberTip: "The closed air behind the cones.",
  editManually: "Edit manually",
  setByDesign: `Set by **${START_FROM_GOALS}** or **${HORN_IMPORT_NAME}**.`,
  setByImport: `Set to the initial value or by **${HORN_IMPORT_NAME}**.`,
  hornImport: HORN_IMPORT_NAME,
  frontTap: "Front tap after section",
  backTap: "Back tap after section",
  tap: "Tap after section",
  tapsTip: "Where the front and back of the cones join the horn, counted from the closed end.",
  tapTip: "Where the front of the cones joins the horn, counted from the closed end.",
  /** the Horn settings summary: a horn's sections and path length, in */
  hornSections: (n: number, lengthIn: string) =>
    `${n} ${n === 1 ? "section" : "sections"}, ${lengthIn} in long`,
  /** the Horn settings summary: where the taps are, in from the closed end */
  hornTaps: (front: string, back: string) => `taps ${front} / ${back} in`,
  hornTapAt: (at: string) => `tap ${at} in`,
  // drivers
  band: "Band",
  bandTip: `The band from **${SPEAKER_SETTINGS_SECTIONS.bands}** that plays this driver.`,
  coneBand: "Cone's band",
  hfBand: "HF's band",
  hfBandTip: `The band from **${SPEAKER_SETTINGS_SECTIONS.bands}** that plays the HF section of this driver.`,
  /** a driver's summary: its band by name */
  bandName: (name: string) => `${name} band`,
  /** a coaxial driver's summary: its HF section's band */
  hfBandName: (name: string) => `HF ${name} band`,
  noBand: "No band",
  /** a driver's summary: the horn standing on its chamber's top */
  hornOnTop: (horn: string) => `${horn} on top`,
  // bands and filters
  externalCrossover: "External crossover",
  externalCrossoverTip: "The filters in your DSP or amp, before this speaker.",
  highPass: "High-pass",
  lowPass: "Low-pass",
  filterOff: "Off",
  corner: "Corner",
  cornerTip:
    "The corner frequency of the filter. A high-pass cuts below it. A low-pass cuts above it.",
  removeBand: "Remove",
  ampPower: "Amp power",
  /** a filter in a band's summary: its side, type and corner, or off */
  filterOn: (side: string, type: string, corner: string) => `${side} ${type} ${corner}`,
  filterIsOff: (side: string) => `${side} off`,
  /** a first-order filter in a summary: its slope */
  firstOrder: "6 dB/oct",
  /** the bands summary: a band's pass range from its filters */
  bandRange: (from: string, to: string) => `${from}–${to}`,
  bandAbove: (from: string) => `above ${from}`,
  bandBelow: (to: string) => `below ${to}`,
  fullRange: "full range",
  // construction
  top: "Top",
  topTip: `**${CABINET_TOP_NAMES.flat}**, or a semicircle the full width of the cabinet. Only for speakers where every chamber is a **${BOX_LOAD_NAME}**.`,
  handles: "Handles",
  handlesTip: "Two handles, one on each side. They go on the lowest chamber of each shell.",
  handlesNone: "None",
  handlesOn: "Handles",
  handleType: "Handle type",
  dish: "Input dish",
  dishTip:
    "An input dish with two jacks on the back. With a horn on the top, it also has binding posts for the horn. It goes on the lowest chamber of each cabinet.",
  dishNone: "None",
  dishOn: "On the back",
  /** the Construction summary's walls, top and hardware */
  walls: (t: string) => `${t} walls`,
  topSummary: (top: string) => `${top.toLowerCase()} top`,
  hardwareHandles: "handles",
  hardwareDish: "input dish",
  noHardware: "no hardware",
  // the chamber summary
  boxSummary: (vent: string) => `${vent} box`,
  hornSummary: (drive: string, path: string) => `${drive} horn, ${path.toLowerCase()}`,
  driverCount: (n: number) => `${n} ${n === 1 ? "driver" : "drivers"}`,
} as const;
