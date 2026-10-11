// The ids of the speaker designer's spec (SpeakerSpec, SystemSpec in src/types.ts; read adapters in lib/speaker).
import type {
  DriverKind,
  HifiBoxKind,
  PanelNominal,
  RoundPort,
  SlotPort,
  SpeakerPart,
} from "../types";

/** The speakers of a system read from one design, by id: each speaker's id and name end with its part. */
export const SPEAKER_PART = {
  speaker: "speaker",
  sub: "sub",
  top: "top",
  tower: "tower",
} as const;

/** The name each part adds to the system's name. */
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

/** A speaker's bands, by id, low to high. A 2-way uses low and high; air is the top octave (a super tweeter). */
export const SPEAKER_BAND = {
  low: "low",
  mid: "mid",
  high: "high",
  air: "air",
} as const;

/** Where a horn sits, by id: in the baffle, or freestanding on the box top (T1, the Hi-fi round waveguides). */
export const HORN_PLACEMENT = {
  baffle: "baffle",
  top: "top",
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

/** What a source does in a system, by id. */
export const SOURCE_ROLE = {
  main: "main",
  sub: "sub",
  fill: "fill",
  monitor: "monitor",
} as const;

/** A source's delay when the system aligns it (the PA sub against the tops). */
export const AUTO_DELAY = "auto";

/** How a system's front end processes, by id: fixed analog cards (PA v2), or a DSP. */
export const FRONT_END_KIND = {
  analog: "analog",
  digital: "digital",
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
