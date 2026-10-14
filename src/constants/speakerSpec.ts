// The ids of the speaker spec (SpeakerSpec, StackSpec, SpaceSpec in src/types.ts; read adapters in
// lib/speaker).
import type {
  CabinetConstruction,
  CabinetTop,
  DriverKind,
  HifiBoxKind,
  PanelNominal,
  RoundPort,
  SlotPort,
  SpeakerPart,
} from "../types";

/** The speakers read from one design, by id: each speaker's id and name end with its part. */
export const SPEAKER_PART = {
  speaker: "speaker",
  sub: "sub",
  top: "top",
  tower: "tower",
} as const;

/** The name each part adds to the design's name. */
export const SPEAKER_PART_NAMES = {
  speaker: "Speaker",
  sub: "Sub",
  top: "Mid/high box",
  tower: "Tower",
} as const satisfies Record<SpeakerPart, string>;

/** The driver kinds, by id: each names the catalog table its driver id is in (`SpeakerDriverParts`). */
export const DRIVER_KIND = {
  sub: "sub",
  mid: "mid",
  compression: "compression",
  woofer: "woofer",
  tweeter: "tweeter",
  coaxial: "coaxial",
} as const satisfies { [K in DriverKind]: K };

/**
 * The bands the read adapters give a speaker, by id, low to high. A 2-way uses low and high; air is the top octave (a
 * super tweeter). The Speaker page adds bands of its own with generated ids.
 */
export const SPEAKER_BAND = {
  low: "low",
  mid: "mid",
  high: "high",
  air: "air",
} as const;

/** The name the read adapters give each of their bands. */
export const SPEAKER_BAND_NAMES = {
  low: "Low",
  mid: "Mid",
  high: "High",
  air: "Air",
} as const satisfies Record<keyof typeof SPEAKER_BAND, string>;

/** Where a horn sits, by id: in the baffle, or freestanding on the box top (T1, the Hi-fi round waveguides). */
export const HORN_PLACEMENT = {
  baffle: "baffle",
  top: "top",
} as const;

/**
 * How a cabinet's shell is built, by id: the PA's frame with its baffle set back by the inset, or the Hi-fi's flush box
 * with its baffle over the whole front.
 */
export const CABINET_CONSTRUCTION = {
  frameInset: "frameInset",
  flushBox: "flushBox",
} as const;

/** The name the settings show for each construction. */
export const CABINET_CONSTRUCTION_NAMES = {
  frameInset: "Frame and inset baffle",
  flushBox: "Flush box",
} as const satisfies Record<CabinetConstruction, string>;

/** A cabinet's top shapes, by id: flat, or a semicircle the full width of the cabinet (the PA tower's arched top). */
export const CABINET_TOP = {
  flat: "flat",
  arched: "arched",
} as const;

/** The name the settings show for each top shape. */
export const CABINET_TOP_NAMES = {
  flat: "Flat",
  arched: "Arched",
} as const satisfies Record<CabinetTop, string>;

/**
 * Why an arched top is drawn and cut flat, by id (lib/speaker `archBlock`): the first condition the cabinet misses. A
 * frame, one shell, one chamber at the top, that chamber the full width, and at least half as tall as the cabinet is
 * wide.
 */
export const ARCH_BLOCK = {
  frame: "frame",
  shell: "shell",
  topChambers: "topChambers",
  width: "width",
  height: "height",
} as const;

/** A chamber's vent kinds, by id: the Hi-fi box kinds. A vented chamber's port is round, a slot or side ducts. */
export const VENT_KIND = {
  sealed: "sealed",
  vented: "vented",
  radiator: "radiator",
} as const satisfies { [K in HifiBoxKind]: K };

/** A port's shapes, by id: round tubes or slots (the Hi-fi port shapes), or ducts up the front sides (the PA side ducts). */
export const PORT_SHAPE = {
  round: "round",
  slot: "slot",
  duct: "duct",
} as const satisfies {
  round: NonNullable<RoundPort["shape"]>;
  slot: SlotPort["shape"];
  duct: string;
};

/**
 * Where a Hi-fi rule slot's openings are on the baffle, by id: stacked along the floor (the Hi-fi box's), or up each front
 * side of the chamber, beside the horn mouth (the PA v2 boxes').
 */
export const SLOT_PLACE = {
  floor: "floor",
  sides: "sides",
} as const;

/** The fins across the PA sub's letterbox slot (lib/pa/calc ventGeometry splits it in three). */
export const PA_SLOT_FINS = 2;

/**
 * A slot's kind, by id: the PA sub's letterbox (a slot with `fins`: on the floor from the frame front, folded up the back
 * when too long) or a plain slot (the Hi-fi slot rule).
 */
export const SLOT_KIND = {
  letterbox: "letterbox",
  plain: "plain",
} as const;

/** A round port's tube ends, by id: flared (the PA tube rule, `flared`) or plain (the Hi-fi round port rule). */
export const TUBE_ENDS = {
  flared: "flared",
  plain: "plain",
} as const;

/** Where flared tubes sit, by id: in a row along the bottom, or in the baffle's corners round the driver (`corners`). */
export const TUBE_LAYOUT = {
  row: "row",
  corners: "corners",
} as const;

/** How a chamber's drivers meet the air, by id: straight (a direct radiator), or through a horn in the box. */
export const CHAMBER_LOAD = {
  direct: "direct",
  horn: "horn",
} as const;

/** How a horn's drivers drive its path, by id (`HornDrive`): front-loaded, back-loaded or tapped. */
export const HORN_DRIVE = {
  front: "front",
  back: "back",
  tapped: "tapped",
} as const;

/** How a horn's path runs in the box, by id: straight, or folded (a bass bin). The acoustics read only the segments. */
export const HORN_PATH = {
  straight: "straight",
  folded: "folded",
} as const;

/** A first-order filter's type (6 dB/oct): a series capacitor or coil, as a super tweeter on the HF channel. */
export const FIRST_ORDER_FILTER = "1st";

/**
 * A delay its rule sets: a stack member's when the stack aligns it (the PA sub against the tops), a space placement's
 * when the space's solver does (lib/speaker/solveFeeds).
 */
export const AUTO_DELAY = "auto";

/** A space fill's level when the space's solver sets it (lib/speaker/solveFeeds): the nearest main's, where it aims. */
export const AUTO_LEVEL = "auto";

/** What a space places, by id: a stack, or a speaker alone on its own input range. */
export const SPACE_ITEM = {
  stack: "stack",
  speaker: "speaker",
} as const;

/** Why a chamber has no horn-engine design yet, by id (lib/speaker/hornDesign `hornDesignOf`). */
export const HORN_ENGINE_GAP = {
  /** a tapped horn: the engine models only a front-loaded one */
  tapped: "tapped",
  /** a back-loaded horn: the engine models only a front-loaded one */
  backLoaded: "backLoaded",
  /** no driver, drivers of more than one kind or id, or a driver with no Thiele/Small parameters */
  driver: "driver",
  /** no net air set for the rear chamber */
  netLiters: "netLiters",
  /** a vent the engine doesn't take yet: side ducts, radiators, or a slot whose width the box sets */
  vent: "vent",
} as const;

/** The Fills model's walls: ½″ ply (lib/pa/calc `fillSystem` takes an inch off each outside size). */
export const FILL_PANEL = "1/2" satisfies PanelNominal;

/**
 * Why the speaker model (lib/speaker/speakerResponse) leaves out a chamber or a driver, by id. A horn chamber that the
 * horn engine can't take gives its `HORN_ENGINE_GAP` instead.
 */
export const SPEAKER_MODEL_GAP = {
  /** a driver id that isn't in its kind's catalog table */
  unknownDriver: "unknownDriver",
  /** cone drivers of more than one id, or feeding different bands, share the chamber's air */
  mixedDrivers: "mixedDrivers",
  /** a compression driver, tweeter or coaxial with no published HF sensitivity */
  noHf: "noHf",
  /** a passive radiator id that isn't in the catalog */
  unknownRadiator: "unknownRadiator",
  /** the box model can't run on these sizes (no air, port area or length, cones or radiators) */
  noModel: "noModel",
  /** a band's filter corner (or the feed's) isn't a positive frequency */
  badFilter: "badFilter",
} as const;

/** The voltage of 1 W into 8 Ω, V RMS: what datasheets quote a 1 W sensitivity at (the engines round √8 to it). */
export const ONE_WATT_VOLTS = 2.83;

/** The drive the speaker model works at, V RMS: 1 W into 8 Ω, as the Hi-fi response charts. */
export const SPEAKER_RESPONSE_VOLTS = ONE_WATT_VOLTS;

/**
 * How far in front of a stack its response is worked out, m: there the members' paths differ as a listener hears them
 * (lib/speaker/stackResponse).
 */
export const STACK_LISTEN_DISTANCE_M = 4;

/** The saved speakers' collection under users/{uid} (the speaker library, next to `configs` and `hifiConfigs`). */
export const SPEAKERS_COLLECTION = "speakers";

/** The saved stacks' collection under users/{uid}, next to the speaker library. */
export const STACKS_COLLECTION = "stacks";

/** The saved spaces' collection under users/{uid}, next to the speaker library and the stacks. */
export const SPACES_COLLECTION = "spaces";

/**
 * The PA and Hi-fi pages' saves under users/{uid}. Those pages go away at L3f; the Stack page opens their saves through
 * the one read adapter (src/pages/stack/oldSaves).
 */
export const OLD_SAVE_COLLECTIONS = {
  pa: "configs",
  hifi: "hifiConfigs",
} as const;
/** Which page an old save is from. */
export type OldSaveKind = keyof typeof OLD_SAVE_COLLECTIONS;
export const OLD_SAVE_KIND = { pa: "pa", hifi: "hifi" } as const satisfies Record<
  OldSaveKind,
  OldSaveKind
>;
