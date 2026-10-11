// The Designer page's names and choices (src/pages/designer): the spec's ids as the page shows them.
import type {
  BandId,
  DriverKind,
  FilterType,
  HifiBoxKind,
  HifiDrive,
  SpeakerModelGap,
  SpeakerPort,
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

/** Each band as the Designer names it. */
export const BAND_NAMES = {
  low: "Low",
  mid: "Mid",
  high: "High",
  air: "Air",
} as const satisfies Record<BandId, string>;

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

/** Where a new design starts, by id. */
export const DESIGNER_START = {
  empty: "empty",
  hifi: "hifi",
  paSub: "paSub",
  paTop: "paTop",
  paTower: "paTower",
} as const;
export type DesignerStart = (typeof DESIGNER_START)[keyof typeof DESIGNER_START];

/** What each start shows. */
export const DESIGNER_START_NAMES = {
  empty: "Empty speaker",
  hifi: "The Hi-fi design",
  paSub: "The PA design's sub",
  paTop: "The PA design's mid/high box",
  paTower: "The PA design's tower",
} as const satisfies Record<DesignerStart, string>;

/** The name a new design takes, by start (a saved speaker keeps its own). */
export const DESIGNER_START_SPEAKER_NAMES = {
  empty: "New speaker",
  hifi: "Hi-fi speaker",
  paSub: "PA sub",
  paTop: "PA mid/high box",
  paTower: "PA tower",
} as const satisfies Record<DesignerStart, string>;

/** The Designer's results headings and chart labels. */
export const DESIGNER_TEXT = {
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
  /** the note under the maximum-output chart, with the vents' air-speed limits, m/s */
  maxNote: (portMs: number, flaredMs: number) =>
    `Each band at its amp's full power, up to its first limit: cone travel, port air speed, radiator travel, the driver's program rating (2 × AES) or the amp. A vent takes ${portMs.toFixed(0)} m/s (flared PA tubes ${flaredMs.toFixed(0)} m/s). A band's max is for music: one drive for the whole band. The sum and the speaker's max take one input for every band.`,
  chamber: "Chamber",
} as const;
