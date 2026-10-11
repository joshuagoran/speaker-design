// The ids of the speaker designer's spec (SpeakerSpec, SystemSpec in src/types.ts; read adapters in lib/speaker).
import type { DriverKind, HifiBoxKind, PanelNominal, SpeakerTemplate } from "../types";

/**
 * The templates a design starts from, by id. A template sets only the first values of a new design (owner, Oct 2026);
 * no model or check reads it.
 */
export const SPEAKER_TEMPLATE = {
  sub: "sub",
  top: "top",
  tower: "tower",
  hifi: "hifi",
  fill: "fill",
  monitor: "monitor",
} as const;

/** The name each template shows. */
export const SPEAKER_TEMPLATE_NAMES = {
  sub: "PA sub",
  top: "Mid/high box",
  tower: "Tower",
  hifi: "Hi-fi",
  fill: "Fill",
  monitor: "Monitor",
} as const satisfies Record<SpeakerTemplate, string>;

/** The driver kinds, by id: each names the catalog table its driver id is in (`SpeakerDriverParts`). */
export const DRIVER_KIND = {
  sub: "sub",
  mid: "mid",
  compression: "compression",
  woofer: "woofer",
  tweeter: "tweeter",
  coaxial: "coaxial",
} as const satisfies { [K in DriverKind]: K };

/** A speaker's bands, by id, low to high. A 2-way uses low and high. */
export const SPEAKER_BAND = {
  low: "low",
  mid: "mid",
  high: "high",
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

/** A port's shapes, by id: round tubes, a slot along the bottom, or ducts up the front sides (the PA side ducts). */
export const PORT_SHAPE = {
  round: "round",
  slot: "slot",
  duct: "duct",
} as const;

/** How a chamber's drivers meet the air, by id: straight (a direct radiator), or through a horn in the box. */
export const CHAMBER_LOAD = {
  direct: "direct",
  horn: "horn",
} as const;

/**
 * How a horn's driver drives its path, by id. Front: the cone's front at the throat, its rear into the chamber (a
 * front-loaded horn, the horn engine's case). Tapped: the cone's front and rear each at a point on the path.
 */
export const HORN_DRIVE = {
  front: "front",
  tapped: "tapped",
} as const;

/** How a horn's path runs in the box, by id: straight, or folded (a bass bin). The acoustics read only the segments. */
export const HORN_PATH = {
  straight: "straight",
  folded: "folded",
} as const;

/** What a source does in a system, by id. */
export const SOURCE_ROLE = {
  main: "main",
  sub: "sub",
  fill: "fill",
  monitor: "monitor",
} as const;

/** A source's delay when the system aligns it (the PA sub against the tops). */
export const AUTO_DELAY = "auto";

/** Why a chamber has no horn-engine design yet, by id (lib/speaker/hornDesign `hornDesignOf`). */
export const HORN_ENGINE_GAP = {
  /** a tapped horn: the engine models only a front-loaded one */
  tapped: "tapped",
  /** not one driver with Thiele/Small parameters in the chamber */
  driver: "driver",
  /** no net air set for the rear chamber */
  netLiters: "netLiters",
  /** a vent the engine doesn't take yet: a slot, side ducts or radiators */
  vent: "vent",
} as const;

/** The Fills model's walls: ½″ ply (lib/pa/calc `fillSystem` takes an inch off each outside size). */
export const FILL_PANEL = "1/2" satisfies PanelNominal;
