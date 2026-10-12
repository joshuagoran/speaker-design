// The Speaker page's names and choices (src/pages/speaker): the spec's ids as the page shows them.
import type {
  ArchBlock,
  ChamberLoad,
  DriverKind,
  FilterType,
  HifiBoxKind,
  HifiDrive,
  HornDrive,
  HornPath,
  HornPlacement,
  SpeakerModelGap,
  SpeakerPort,
  VentPanel,
} from "../types";
import { FIRST_ORDER_FILTER } from "./speakerSpec";
import { UI_TEXT } from "./uiText";

/** Each driver kind as the Speaker page names it: the catalog table it picks from. */
export const DRIVER_KIND_NAMES = {
  sub: "PA sub",
  mid: "PA mid-bass",
  compression: "Compression driver",
  woofer: "Hi-fi woofer",
  tweeter: "Tweeter",
  coaxial: "Coaxial",
} as const satisfies Record<DriverKind, string>;

/**
 * The driver picker's types: one woofer list for the three woofer kinds (PA sub, PA mid-bass, Hi-fi woofer), with
 * their size as a filter, then the other kinds.
 */
export const DRIVER_TYPE_NAMES = {
  woofer: "Woofer",
  compression: "Compression driver",
  tweeter: "Tweeter",
  coaxial: "Coaxial",
} as const satisfies Partial<Record<DriverKind, string>>;

/** The woofer size filter's first choice: every size. */
export const ALL_SIZES = "All sizes";

/** A woofer size as the size filter and the list's groups name it. */
export const wooferSizeName = (size: number) => `${size} in`;

/** Each vent kind as the Speaker page names it. */
export const VENT_KIND_NAMES = {
  sealed: "Sealed",
  vented: "Ported",
  radiator: "Passive radiator",
} as const satisfies Record<HifiBoxKind, string>;

/** Each port shape as the Speaker page names it. */
export const PORT_SHAPE_NAMES = {
  round: "Round",
  slot: "Slot",
  duct: "Side ducts",
} as const satisfies Record<NonNullable<SpeakerPort["shape"]>, string>;

/** The filter types a band offers, in the order the picker lists them, and the name each shows. */
export const FILTER_TYPE_NAMES = {
  [FIRST_ORDER_FILTER]: "1st order (6 dB/oct)",
  BW24: "BW24",
  LR24: "LR24",
  BW48: "BW48",
  LR48: "LR48",
} as const satisfies Record<FilterType, string>;

/** Where a setting's value comes from, by id: worked out by its rule (Auto), or typed in (Custom). */
export const SET_BY = {
  auto: "auto",
  custom: "custom",
} as const;

/** The name the settings show for each. */
export const SET_BY_NAMES = {
  auto: "Auto",
  custom: "Custom",
} as const satisfies Record<keyof typeof SET_BY, string>;

/** The panels a vent can be cut into, as the Speaker page names them. */
export const VENT_PANEL_NAMES = {
  baffle: "Baffle",
  back: "Back",
} as const satisfies Record<VentPanel, string>;

/** Each place a horn on a driver can sit, as the Speaker page names it (`HORN_PLACEMENT`). */
export const HORN_PLACEMENT_NAMES = {
  baffle: "In the baffle",
  top: "Freestanding on top",
} as const satisfies Record<HornPlacement, string>;

/** Why a horn can't sit in a place, by place (the place's button shows it). */
export const HORN_PLACEMENT_NO_FIT = {
  baffle: "The horn mouth is larger than the clear face of the chamber.",
  top: "Another chamber is on the top of this chamber.",
} as const satisfies Record<HornPlacement, string>;

/** How a chamber's drivers meet the air, as the chamber's Load setting names it (`CHAMBER_LOAD`). */
export const CHAMBER_LOAD_NAMES = {
  direct: "Direct",
  horn: "Horn",
} as const satisfies Record<ChamberLoad["kind"], string>;

/** How a horn's path runs, as the Horn settings name it (`HORN_PATH`). */
export const HORN_PATH_NAMES = {
  straight: "Straight",
  folded: "Folded",
} as const satisfies Record<HornPath, string>;

/** How a horn's drivers drive its path, as the Horn settings name it (`HORN_DRIVE`). */
export const HORN_DRIVE_NAMES = {
  front: "Front-loaded",
  tapped: "Tapped",
  back: "Back-loaded",
} as const satisfies Record<HornDrive["kind"], string>;

/** Each band drive as the Speaker page names it. */
export const DRIVE_NAMES = {
  active: "Active",
  passive: "Passive",
} as const satisfies Record<HifiDrive, string>;

/** Why an arched top stays flat, by `ARCH_BLOCK` id: the condition the cabinet misses, in words. */
export const ARCH_BLOCK_TEXT = {
  frame: "An arch needs the frame and inset baffle construction.",
  shell: "An arch needs all chambers in one box: the same depth, with no gaps.",
  topChambers: "An arch needs one chamber at the top.",
  width: "An arch needs the top chamber to be the full width of the cabinet.",
  height: "An arch needs the top chamber to be at least half as tall as the cabinet is wide.",
} as const satisfies Record<ArchBlock, string>;

/** Why the model leaves a chamber or driver out, in words. */
export const MODEL_GAP_TEXT = {
  unknownDriver: "a driver is not in its catalog",
  mixedDrivers: "cone drivers of different models, or on different bands, share its air",
  noHf: "a driver has no published HF sensitivity",
  unknownRadiator: "the passive radiator is not in the catalog",
  noModel: "the box model cannot run on these sizes (air, port, counts)",
  badFilter: "a band filter has a corner that is not a positive frequency",
  tapped: "a tapped horn (the horn engine takes only a front-loaded horn)",
  backLoaded: "a back-loaded horn (the horn engine takes only a front-loaded horn)",
  driver: "the horn needs one kind of cone driver with Thiele/Small parameters",
  netLiters: "the horn's rear chamber needs its net air set",
  vent: "the horn engine does not take this vent yet",
} as const satisfies Record<SpeakerModelGap, string>;

/** The Speaker page's results headings and chart labels. */
export const SPEAKER_TEXT = {
  views: "The speaker",
  front: "Front",
  hornPlaceholder:
    "The views draw a folded horn path straight. They also shorten a path that is longer than its chamber is deep. The fold layout comes later.",
  hornMouthClipped:
    "A horn mouth is larger than the clear face of its chamber. The views draw it at the clear face, with a smaller flare.",
  hornMouthMoved:
    "A horn mouth is set outside the clear face of its chamber. The views move it to the nearest place that fits.",
  ventMoved:
    "A port or radiator is set outside the clear face of its chamber. The views move it to the nearest place that fits.",
  response: "Response",
  chambers: "Chambers",
  bands: "Bands",
  sum: "Sum",
  yLabel: "dB SPL, 2.83 V, 1 m",
  modelNote:
    "On axis at 1 m in half space. Every band gets 2.83 V. The model does not include the baffle step, the room or the driver positions yet. The Space page adds them.",
  noBands: "No band has a modeled driver. Add a driver to a chamber and select its band.",
  maxOutput: "Maximum output",
  maxYLabel: "max dB SPL, 1 m",
  speakerMax: "Speaker max",
  maxNote:
    "On axis at 1 m. Each band gets its amp's full power, up to the first limit: cone travel, port air speed, radiator travel, the driver's program rating (2 × AES) or the amp. You set the port air speed limit in the chamber. A band's max is for music, with one drive for the whole band. The sum uses one input for all bands. A band limits the sum only where the band has signal.",
  chamber: "Chamber",
  noFilter: "None",
  /** a band the user adds, by its place among the bands */
  newBandName: (n: number) => `Band ${n}`,
  build: "Price, weight and bracing",
  weight: "Weight",
  /** under the price, weight and bracing, before the bracing words */
  priceNote:
    "The price is the total of the purchased parts on the Cutlist tab: the drivers, the horns, the radiators, the port tubes and the hardware. It does not include the plywood.",
  /** a chamber's weight tile, by its place */
  chamberWeight: (n: number) => `Chamber ${n} weight`,
  /** under the weight and bracing, with the bracing rule's panel target in words */
  buildNote: (target: string) =>
    `The PA bracing rule braces each chamber until every panel is above ${target}. The notices above show the panels that do not get there. The net air of each chamber subtracts the braces, the vent walls, the baffle cleats and the hardware. The weight includes the panels, the braces, the drivers with their horns, the radiators and the hardware. The Cutlist tab lists every part.`,
  noBraces: "no braces",
  /** the Build notice and summary when the cabinet has no bracing (`NO_BRACING`) */
  notBraced:
    "The panels are not braced. The cutlist, the weight and the net air have no braces. Brace the box later, or from the outside.",
  notBracedSummary: "not braced",
  buildNoteUnbraced:
    "The net air of each chamber subtracts the vent walls, the baffle cleats and the hardware. The weight includes the panels, the drivers with their horns, the radiators and the hardware. The Cutlist tab lists every part.",
  hornNoFit:
    "A horn does not fit where it is mounted. Another chamber is on its top, or its mouth is larger than the baffle of its chamber. Select the other mounting in the driver settings. Until you do, the views and the cutlist do not show the horn.",
  hornNoFitNote:
    "the horn does not fit where it is mounted; no cutout until you change the mounting",
  portTooLong: "too long for this chamber: make it shorter",
  slotTooLong: "too long to run straight in this chamber: make it shorter, or fold it",
  slotTooLongFolded: "too long to fold in this chamber: make it shorter",
  /** a chamber whose braces can't bring every panel to the target (or a panel over its strength limit), by its place */
  underTarget: (n: number, target: string) =>
    `Chamber ${n} does not get to the ${target} bracing target. The rule cannot fit enough braces around its drivers, vent and horn. These panels are below the target, or above a strength limit:`,
  inputRange: "Input range",
  inputHint: "Filters in front of the speaker. They are not part of the box.",
  inputTip:
    "The filters in front of the speaker, for example the crossover to a sub. They are not part of the box. In a stack, the crossover of the stack sets them.",
  inputOff: "Off",
  construction: "Construction",
  top: "Top",
  inset: "Baffle inset, in",
  insetTip: "How far the baffle is behind the front edge of the frame.",
  braceStyle: "Bracing",
  backJoint: "Back panel",
  wallPanel: "Wall panels",
  /** the wall panels' tooltip, with the frame box's baffle thickness in words */
  wallPanelTip: (baffle: string) =>
    `The panel size of the sides, top, bottom and back. On a frame box, the baffle stays ${baffle}. On a flush box, the baffle is this size too. Thinner walls get more braces.`,
  /** the construction summary's wall panels, by their thickness in words */
  wallPanelSummary: (t: string) => `${t} walls`,
  braceTarget: "Bracing target",
  /** the target's tooltip, with the PA boxes' target in words */
  braceTargetTip: (pa: string) =>
    `The rule adds braces until the first resonance of each panel is above this frequency. The PA boxes use ${pa}.`,
  /** under the Top choice when an arched top cannot apply: the start of the reason (`ARCH_BLOCK_TEXT`) */
  archFlat: "The top stays flat.",
  fromLeft: "From left, in",
  fromBottom: "From bottom, in",
  backFromFront: "Back from front, in",
  placeTip:
    "Seen from the front. The position of the center, from the left side and the bottom of the chamber.",
  portPlace: "Port position",
  radiatorPlace: "Radiator position",
  mouthPlace: "Horn mouth position",
  panel: "Panel",
  slotNarrow: "Opening, narrow side, in",
  slotLong: "Opening, long side, in",
  portLength: "Length, in",
  /** the side ducts' dividers' tooltip: the shared tip, and which thickness each size takes */
  ductDividersTip: `${UI_TEXT.ductDividersTip} Dividers of the wall size have the thickness of the walls. You can measure it on the Cutlist page. Dividers of a different size have the default thickness.`,
  ventFixed: "The shape of this port sets its position (the PA port rule or the slot rule).",
  load: "Load",
  loadTip:
    "Direct: the cones radiate from the baffle. Horn: a horn in the box. A new horn has one conical section from the cones to the clear face. The net air is then the rear chamber.",
  loadNoCone: "A horn needs a cone driver with Thiele/Small parameters in this chamber.",
  horn: "Horn",
  hornSections: "Flare sections",
  hornSection: (n: number) => `Section ${n}`,
  hornProfile: "Profile",
  hornStart: "Start area, in²",
  hornEnd: "End area, in²",
  hornThroat: "Throat chamber",
  hornThroatTip: "The air between the cones and the horn throat, in liters. Use 0 for none.",
  hornPath: "Path",
  hornPathTip:
    "The model uses only the sections. The views draw a folded path straight for now. The fold layout comes later.",
  hornDrive: "Drive",
  hornDriveNote:
    "The horn engine models only a front-loaded horn now. It does not model a tapped or back-loaded horn yet.",
  /** the note under a section that starts with a step, by the section's number */
  hornStep: (n: number) =>
    `Section ${n} starts at a different area than section ${n - 1} ends. This makes a step in the horn.`,
  /** the closed fold for settings most designs leave alone (a horn's steps, a chamber's position) */
  advanced: "Advanced",
  /** the chamber Advanced fold's summary: its position, in */
  chamberAt: (x: number, y: number) => `${x} in from left, ${y} in up`,
  /** the Advanced fold's summary: the steps in the horn now */
  hornSteps: (n: number) => `Steps: ${n === 0 ? "none" : n}`,
  hornStepsSetting: "Steps",
  hornStepsTip:
    "Off: each section starts at the end area of the section before it, so the horn is smooth. On: each section after the first shows its start area, so you can make a step. When you set Off, each start area goes back to the end area before it.",
  hornProfileTip:
    "The shape of the flare in this section: how its area grows from the start to the end.",
  hornStartTip: "The area of the section at its throat end.",
  hornEndTip: "The area of the section at its mouth end.",
  hornLengthTip: "The length of the section along the horn path.",
  hornPathSectionsTip: "The horn is a row of sections, from the throat to the mouth.",
  driverHornTip:
    "A horn or waveguide on this compression driver or tweeter. None: the driver has no horn.",
  hornMountTip:
    "In the baffle: the horn mouth is cut into the baffle. Freestanding on top: the horn stands on the top of the chamber.",
  levelTip:
    "Sets the level of this band against the other bands, in dB. A negative value makes the band quieter. The default is 0 dB: no change, so each driver plays at its own sensitivity.",
  driveTip:
    "Active: the band has its own amp channel, and its filters are in the front end (DSP). Passive: a crossover network in the box, on an amp channel that the band shares.",
  ampTip:
    "The power of the amp channel for this band, in W into 8 Ω. The maximum output uses it. For a passive band, use the power of the shared channel.",
  cornerTip:
    "The corner frequency of the filter. A highpass cuts below it, and a lowpass cuts above it.",
  netAirTip:
    "The air the drivers work against. Auto: the inside volume minus the walls, the braces, the drivers and the vent. Custom: you type the value.",
  stuffingTip:
    "Fiber fill in the chamber, in percent. Fill makes the box act larger. 10% is normal, and 15% is heavy.",
  airSpeedTip:
    "The highest air speed in the port at full power. Above it, the port makes noise. The maximum output stops at this limit.",
  radiatorMassTip: "Mass that you add to each passive radiator. More mass tunes the box lower.",
  startOverHint:
    "This replaces the current design. To open a saved speaker, use the saved configurations above.",
  hornStepsOff: "Off",
  hornStepsOn: "On",
  addSection: "Add section",
  removeSection: "Remove section",
} as const;
