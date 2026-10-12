// The Designer page's names and choices (src/pages/designer): the spec's ids as the page shows them.
import type {
  DriverKind,
  FilterType,
  HifiBoxKind,
  HifiDrive,
  HornPlacement,
  SpeakerModelGap,
  SpeakerPort,
  VentPanel,
} from "../types";
import { FIRST_ORDER_FILTER } from "./speakerSpec";

/** Each driver kind as the Designer names it: the catalog table it picks from. */
export const DRIVER_KIND_NAMES = {
  sub: "PA sub",
  mid: "PA mid-bass",
  compression: "Compression driver",
  woofer: "Hi-fi woofer",
  tweeter: "Tweeter",
  coaxial: "Coaxial",
} as const satisfies Record<DriverKind, string>;

/** Each vent kind as the Designer names it. */
export const VENT_KIND_NAMES = {
  sealed: "Sealed",
  vented: "Ported",
  radiator: "Passive radiator",
} as const satisfies Record<HifiBoxKind, string>;

/** Each port shape as the Designer names it. */
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

/** The panels a vent can be cut into, as the Designer names them. */
export const VENT_PANEL_NAMES = {
  baffle: "Baffle",
  back: "Back",
} as const satisfies Record<VentPanel, string>;

/** Each place a horn on a driver can sit, as the Designer names it (`HORN_PLACEMENT`). */
export const HORN_PLACEMENT_NAMES = {
  baffle: "In the baffle",
  top: "Freestanding on top",
} as const satisfies Record<HornPlacement, string>;

/** Why a horn can't sit in a place, by place (the place's button shows it). */
export const HORN_PLACEMENT_NO_FIT = {
  baffle: "The horn's mouth is larger than the chamber's clear face.",
  top: "Another chamber stands on this chamber's top.",
} as const satisfies Record<HornPlacement, string>;

/** Each band drive as the Designer names it. */
export const DRIVE_NAMES = {
  active: "Active",
  passive: "Passive",
} as const satisfies Record<HifiDrive, string>;

/** Why the model leaves a chamber or driver out, in words. */
export const MODEL_GAP_TEXT = {
  unknownDriver: "a driver isn't in its catalog",
  mixedDrivers:
    "cone drivers of more than one model, or on different bands, share its air (not modeled yet)",
  noHf: "a driver has no published HF sensitivity",
  unknownRadiator: "the passive radiator isn't in the catalog",
  noModel: "the box model can't run on these sizes (air, port, counts)",
  badFilter: "a band's filter corner isn't a positive frequency",
  tapped: "a tapped horn (the horn engine takes only a front-loaded horn)",
  backLoaded: "a back-loaded horn (the horn engine takes only a front-loaded horn)",
  driver: "the horn needs one kind of cone driver with Thiele/Small parameters",
  netLiters: "the horn's rear chamber needs its net air set",
  vent: "the horn engine doesn't take this vent yet",
} as const satisfies Record<SpeakerModelGap, string>;

/** The Designer's results headings and chart labels. */
export const DESIGNER_TEXT = {
  views: "The speaker",
  front: "Front",
  hornPlaceholder:
    "A folded horn path, or one longer than its chamber is deep, is drawn straight and shortened to fit for now (its fold layout comes later).",
  hornMouthClipped:
    "A horn mouth larger than its chamber's clear face is drawn at the clear face, its flare shrunk to match.",
  hornMouthMoved:
    "A horn mouth set past its chamber's clear face is drawn moved inside it, at the nearest place that fits.",
  ventMoved:
    "A port or radiator set past its chamber's clear face is drawn moved inside it, at the nearest place that fits.",
  response: "Response",
  chambers: "Chambers",
  bands: "Bands",
  sum: "Sum",
  yLabel: "dB SPL on axis, 2.83 V, 1 m",
  modelNote:
    "On axis at 1 m in half space, every band at 2.83 V; no baffle step, room or driver positions yet (the Space page will add them).",
  noBands: "No band has a modeled driver yet: add a driver to a chamber and pick its band.",
  maxOutput: "Maximum output",
  maxYLabel: "dB SPL on axis, 1 m, at the first limit",
  speakerMax: "Speaker max",
  maxNote:
    "Each band at its amp's full power, up to its first limit: cone travel, port air speed (each vent's own limit, set in its chamber), radiator travel, the driver's program rating (2 × AES) or the amp. A band's max is for music: one drive for the whole band. The sum takes one input for every band, and a band limits it only where the band carries signal.",
  chamber: "Chamber",
  noFilter: "None",
  /** a band the user adds, by its place among the bands */
  newBandName: (n: number) => `Band ${n}`,
  build: "Weight and bracing",
  weight: "Weight",
  /** a chamber's weight tile, by its place */
  chamberWeight: (n: number) => `Chamber ${n} weight`,
  /** under the weight and bracing, with the bracing rule's panel target in words */
  buildNote: (target: string) =>
    `Each chamber is braced by the PA bracing rule, to the bracing target: every panel above ${target}. The panels that still miss it are listed above. Each chamber's net air counts the braces, the vent's walls, the baffle cleats and the hardware. The weight counts the panels, braces, drivers with their horns, radiators and hardware. The Cutlist tab lists every part.`,
  noBraces: "no braces",
  hornNoFit:
    "A horn does not fit where it is mounted: another chamber stands on its top, or its mouth is larger than its chamber's baffle. Pick the other mounting in its driver's settings. Until then the views and the cutlist leave it out.",
  hornNoFitNote: "its horn does not fit where it is mounted; no cutout until its mounting changes",
  portTooLong: "too long for this chamber: make it shorter",
  slotTooLong: "too long to run straight in this chamber: make it shorter, or fold it",
  slotTooLongFolded: "too long to fold in this chamber: make it shorter",
  /** a chamber whose braces can't bring every panel to the target (or a panel over its strength limit), by its place */
  underTarget: (n: number, target: string) =>
    `Chamber ${n} does not meet the ${target} bracing target: the rule cannot fit enough braces round its drivers, vent and horn. These panels still miss the target, or a strength limit:`,
  inputRange: "Input range",
  inputHint:
    "In a stack, its crossover sets this, e.g. the crossover to a sub. Not part of the box.",
  inputOff: "Off",
  construction: "Construction",
  top: "Top",
  inset: "Baffle inset, in",
  insetTip: "How far the baffle sits behind the frame's front edge.",
  braceStyle: "Bracing",
  backJoint: "Back panel",
  braceTarget: "Bracing target",
  /** the target's tooltip, with the PA boxes' target in words */
  braceTargetTip: (pa: string) =>
    `The rule adds braces until each panel's first resonance is above this. The PA boxes use ${pa}.`,
  archNotDrawn:
    "The arch draws over a top chamber that runs the full width and is at least half as tall as the cabinet is wide, in one shell. The top of this cabinet is drawn flat.",
  fromLeft: "From left, in",
  fromBottom: "From bottom, in",
  backFromFront: "Back from front, in",
  placeTip: "Seen from the front: from the chamber's left side and its bottom, to the center.",
  portPlace: "Port position",
  radiatorPlace: "Radiator position",
  mouthPlace: "Horn mouth position",
  panel: "Panel",
  slotNarrow: "Opening, narrow side, in",
  slotLong: "Opening, long side, in",
  portLength: "Length, in",
  ventFixed: "This port's place comes from its shape (the PA port rule or the slot rule).",
} as const;
