import type { AmpSteps } from "./lib/optimizer/ampSteps";
import type { Dispatch, SetStateAction } from "react";
import type { CHIP_IDS } from "./constants/chipIds";
import type { CUT_BOX_NAMES, CUT_PART_NAMES } from "./constants/cutParts";
import type { PURCHASED_PART_NAMES } from "./constants/purchasedParts";
import type {
  BACK_JOINT_NAMES,
  BOX_AXIS_NAMES,
  BRACE_PANEL_NAMES,
  BRACE_STYLE_NAMES,
  SPEAKER_BRACE_STYLE_NAMES,
  STRENGTH_LOAD_NAMES,
} from "./constants/bracing";
import type { INPUT_RANGE_LIMIT, LIMIT_NAMES } from "./constants/limits";
import type { CHANGE_NAMES } from "./constants/optimizerText";
import type { HIFI_DRIVE_NAMES } from "./constants/hifiEngine";
import type { HORN_PROFILE } from "./constants/hornEngine";
import type {
  AUTO_DELAY,
  CABINET_CONSTRUCTION,
  ARCH_BLOCK,
  CABINET_TOP,
  CHAMBER_LOAD,
  FIRST_ORDER_FILTER,
  FRONT_END_KIND,
  HORN_DRIVE,
  HORN_ENGINE_GAP,
  HORN_PATH,
  HORN_PLACEMENT,
  PORT_SHAPE,
  SPACE_ITEM,
  SPEAKER_BAND,
  SPEAKER_MODEL_GAP,
  SPEAKER_PART,
} from "./constants/speakerSpec";
import type { COAX_GAP_NAMES } from "./constants/coax";
import type { DRIVER_PART } from "./constants/space";
import type { DSP_COLUMNS } from "./constants/dspColumns";
import type { AMP_CLASSES, AMP_COLUMNS } from "./constants/ampColumns";
import type { CardSlot } from "./lib/optimizer/selectCards";
import type { MAKER_NAMES } from "./data/catalog/makers";
import type { AMP_SERIES } from "./data/catalog/amps";
import type { DSP_UNITS } from "./data/catalog/dsp-units";
import type { Keep } from "./lib/optimizer/shortfall";
import type { THEME_CHOICES, THEME_SYSTEM } from "./constants/themes";
import type { PANEL_NOMINAL_NAMES } from "./constants/panelSizes";
import type { THROAT_MOUNT_NAMES, THROAT_THREAD_NAMES } from "./constants/throatMounts";
import type { HORN_MOUNT_NAMES } from "./constants/hornMount";
import type { SelectedCard } from "./lib/optimizer/selectCards";
import type { HANDLES } from "./data/catalog/cabinet-hardware";
import type {
  HARDWARE_KIND_NAMES,
  HARDWARE_OBSTACLE_NAMES,
  NO_HANDLES,
} from "./constants/hardware";

// Shapes of the parts catalog tables in data/catalog/ (lib/data.ts derives the app's view of them).
//
// A spec the vendor does not publish is `null` in the table (the note says so), so it stays in the type as `number | null`.
// A field that only some entries have is optional (`?`).

/** Sub driver diameters in inches; also the keys of a cabinet's `dims`. */
export type SubSize = 15 | 18;
/** Mid driver diameters in inches. */
export type MidSize = 10 | 12 | 15;

/** The setter `useState` returns, as a hook hands it to the page. */
export type Setter<T> = Dispatch<SetStateAction<T>>;

/** Outer or internal dimensions in inches. */
export interface Dims3 {
  w: number;
  h: number;
  d: number;
}

/** Width and height only, in inches. */
export interface Dims2 {
  w: number;
  h: number;
}

// ---- Thiele-Small blocks ----

/**
 * An Xmax formula from coil winding height Hvc and gap height Hg: "plain" is (Hvc − Hg)/2, "hg/4" adds Hg/4 (B&C, Celestion,
 * Lavoce, Ciare), "hg/3" adds Hg/3 (FaitalPRO, SB Audience), "hg/3.5" adds Hg/3.5 (Beyma).
 */
export type GapFormula = "plain" | "hg/4" | "hg/3" | "hg/3.5";
/** How a maker computes its Xmax: a gap formula, Eminence's greater of the plain overhang and the 10 % distortion point, or unstated. */
export type XmaxFormula = GapFormula | "overhang-or-x10" | "unstated";

/** Every excursion figure the maker publishes, one-way mm, as published. */
export interface PublishedExcursion {
  /** the maker's Xmax; null where it publishes none (the B&C coaxials give only Xvar) */
  Xmax: number | null;
  formula: XmaxFormula;
  /** B&C's 10 % distortion limit */
  Xvar?: number;
  /** mechanical limit (Eminence Xlim, passive radiators' Xmech) */
  Xlim?: number;
  /** damage limit (a peak-to-peak figure is halved) */
  Xdamage?: number;
  /** SB Acoustics' linear travel, peak to peak */
  travelPP?: number;
  /** where the figures and heights were read: the maker's datasheet or product page */
  src?: string;
}

/**
 * How the comparable Xmax was found: from Hvc and Hg, from the maker's figure and its known formula, as published (a
 * passive radiator's limit: no motor, so no gap), or estimated.
 */
export type XmaxBasis = "derived" | "converted" | "published" | "estimated";

/**
 * The comparable Xmax, (Hvc − Hg)/2 + Hg/4 one-way mm, as a band: `lo` = `hi` unless `basis` is "estimated", and the
 * driver's `Xmax` is its center.
 */
export interface XmaxBand {
  basis: XmaxBasis;
  lo: number;
  hi: number;
}

/** The Thiele-Small parameters and ratings every driver table lists. `disp` is the driver's displacement in liters, null where unpublished. */
export interface ThieleSmall {
  Fs: number;
  Qts: number;
  Qes: number;
  Qms: number;
  Vas: number;
  Sd: number;
  /** the comparable one-way excursion the models use, mm: the center of `xmax` (see `lib/xmax`) */
  Xmax: number;
  xmax: XmaxBand;
  pub: PublishedExcursion;
  /** voice-coil winding height and magnetic gap height, mm, where the maker publishes them */
  Hvc?: number;
  Hg?: number;
  Re: number;
  /**
   * voice-coil inductance, mH, where the maker publishes it: every T/S model reads it (lib/acoustics/driverCircuit
   * `coilFactor`), so the top rolls off; none when absent, and the models take the coil as Re alone
   */
  Le?: number;
  Bl: number;
  Mms: number;
  aes: number;
  disp: number | null;
}

/** A curve at the low and high ends of an estimated Xmax band (see `lib/xmax`). */
export interface BandCurves<P> {
  lo: P[];
  hi: P[];
}

/** A Thiele-Small block as a driver table holds it: the maker's figures, before `lib/xmax` adds the comparable Xmax. */
export type RawTS<T extends ThieleSmall> = Omit<T, "Xmax" | "xmax">;
/** A driver as its table holds it. */
export type RawDriver<D extends { ts: ThieleSmall }> = Omit<D, "ts"> & { ts: RawTS<D["ts"]> };

/**
 * The Thiele-Small fields the box models (`boxModel`, `closedBox`, `passiveRadiatorBox`) and the horn engine read, the
 * voice coil's inductance where listed; `closedBox` and `passiveRadiatorBox` leave `Xmax` alone.
 */
export type BoxModelTS = Pick<
  ThieleSmall,
  "Fs" | "Qms" | "Sd" | "Xmax" | "Bl" | "Re" | "Mms" | "Le"
>;

/** Subs always list a displacement. */
export interface SubTS extends ThieleSmall {
  disp: number;
}

/**
 * Hi-fi woofers also list 2.83 V sensitivity and nominal impedance (informational; no model reads them), and their
 * inductance (ThieleSmall's Le). A coaxial's woofer (lib/data coaxParts) has no inductance or LF impedance in its table,
 * so those two are absent there.
 */
export interface HifiWooferTS extends ThieleSmall {
  sens: number;
  imp?: number;
}

// ---- PA stack ----

/** A driver maker's id (`MAKER_NAMES` holds its name). */
export type MakerId = keyof typeof MAKER_NAMES;

export interface SubDriver {
  id: string;
  lb: number;
  name: string;
  /** who makes it (`MAKER_NAMES`): code reads this, never the start of `name` */
  maker: MakerId;
  price: number;
  src: string;
  size: SubSize;
  ts: SubTS;
  /** the maker's published sensitivity, dB at 1 m (informational: the models use the T/S); absent where not entered */
  sens?: number;
  /** mounting depth in inches, from the maker's datasheet; absent where it isn't published (a gap the Notes page words around) */
  depthIn?: number;
  note: string;
}

export interface MidDriver {
  id: string;
  size: MidSize;
  lb: number;
  name: string;
  /** who makes it (`MAKER_NAMES`): code reads this, never the start of `name` */
  maker: MakerId;
  price: number | null;
  src: string;
  ts: ThieleSmall;
  /** mounting depth in inches, from the maker's datasheet; absent where not entered (MID_DEPTH_FALLBACK_IN stands in) */
  depthIn?: number;
  note: string;
}

/** The compression section of a compression driver (1 W / 1 m on `sensRef`, aes in watts above `aesXo`). */
export interface CompressionHf {
  sens: number;
  sensRef: string;
  aes: number;
  aesXo: number;
  minXo: number;
  imp: number;
}

export interface CompressionDriver {
  id: string;
  lb: number;
  name: string;
  /** the horn-side specs; missing for a driver with none published */
  hf?: CompressionHf;
  /** throat exit in inches */
  exit: number;
  /** the body as the 3-D view draws it */
  body: CompressionDriverBody;
  price: number | null;
  src: string;
  note: string;
}

/** One step of a turned part (a throat adapter, a driver body), front to back: [diameter, length] in inches. */
export type BodyStep = readonly [dia: number, len: number];

/** A compression driver's body: its outside size and the bolts on its front face, in. */
export interface CompressionDriverBody {
  /** overall diameter and depth */
  dia: number;
  depth: number;
  /** the tapped holes on the front face: how many, the thread, and the bolt circle */
  bolts: { n: number; thread: string; circle: number };
  /** the outline front to back, when a photo shows its steps; without it the view draws a generic stepped body */
  steps?: readonly BodyStep[];
}

/** How a driver meets a horn's throat (`THROAT_MOUNT_NAMES`): bolts on a circle, or a screw-on thread. */
export type ThroatMountKind = keyof typeof THROAT_MOUNT_NAMES;
/** A screw-on throat thread (`THROAT_THREAD_NAMES`). */
export type ThroatThread = keyof typeof THROAT_THREAD_NAMES;
/** A screw-on throat: its thread. */
export interface ThreadMount {
  thread: ThroatThread;
}
/**
 * How a compression driver meets a horn: its front-face bolts (the body's pattern, as the PA catalogue holds it) or a
 * screw-on thread. The 3-D view draws a bolt-on driver with the PA catalogue's body for the same driver, else a
 * generic one.
 */
export type DriverMount = Pick<CompressionDriverBody, "bolts"> | ThreadMount;

/**
 * An adapter between a driver and a horn whose throats meet differently (`MOUNT_ADAPTERS`): the driver side and the
 * horn side it joins, its US price (null when no vendor sells it) and where the price was read.
 */
export interface MountAdapter {
  id: string;
  name: string;
  lb: number;
  /** the mount the driver has, and the mount the horn has, that it joins */
  driver: ThroatMountKind;
  horn: ThroatMountKind;
  price: number | null;
  src: string;
  note: string;
}

/** One point of a horn's flare, [radius, depth] in inches. */
export type HornProfilePoint = readonly [radius: number, depth: number];

/** A throat adapter between a horn's throat and the compression driver. */
export interface HornAdapter {
  name: string;
  /** the outline, front (horn side) to back (driver side); the lengths add up to the adapter's length */
  steps: readonly BodyStep[];
  /** the bolt circles on its front flange (to the horn body) and on its back face (to the driver), in */
  bodyBoltCircle: number;
  driverBoltCircle: number;
}

export interface HornHf {
  covH: number;
  covV: number | null;
  minXo: number | null;
  lowHz: number;
}

/** A horn's factory finish in the 3-D view (`HORN_FINISH_COLORS`). */
export type HornFinish = "black";

/**
 * Where a horn is offered when not everywhere: "hifi" for a small waveguide only the Hi-fi page lists (the PA picker
 * and optimizers leave it out; `HORN_OPTIONS` in src/lib/data.ts).
 */
export type HornScope = "hifi";

export interface Horn {
  id: string;
  lb: number;
  name: string;
  hf?: HornHf;
  /** throat exit in inches */
  exit: number;
  /**
   * the flare drawn in the 3-D view, stretched to fit `size`; a horn without one is drawn as a generic flare
   */
  profile?: readonly HornProfilePoint[];
  /** the throat adapter the driver bolts to, when the horn takes one; it adds its length behind the body */
  adapter?: HornAdapter;
  /** a rectangular mouth */
  rect?: boolean;
  /** the factory finish of a horn that ships painted; absent: drawn in the printed cream */
  finish?: HornFinish;
  /** the one page that offers it; absent: every page (the PA horns, and the Hi-fi waveguides among them) */
  scope?: HornScope;
  /** a screw-on throat; absent: the driver bolts to the throat flange */
  mount?: ThreadMount;
  /** US dollars; null when no vendor sells it (the optimizers then leave it out unless it is locked) */
  price: number | null;
  src: string;
  /** the mouth's width and height and the body's depth (without the adapter), in */
  size: Dims3;
  driver: string;
  xo: string;
  note: string;
}

/** A horn the hi-fi page can use as a waveguide: one with its coverage specs. */
export type HifiWaveguide = Horn & { hf: HornHf };

/** The cabinet's ported-vent kinds. */
export type VentKind = "slots" | "round1" | "round2" | "vslots" | "round4";

export interface Cabinet {
  id: string;
  name: string;
  vents: VentKind[];
  /** a fixed slot, for a cabinet whose vendor specifies one */
  vent?: { slotH: number; len: number };
  dims: Record<SubSize, Dims3>;
  note: string;
}

export interface MidBox {
  id: string;
  name: string;
  box: Dims3;
  note: string;
  /** the mid size it suits, when it is for one size only */
  size?: MidSize;
}

/** The named cabinet finishes; the cabinet's `cabFinish` can also be any paint color, as a hex string. */
export type FinishId = "birch" | "walnut";

export interface CabinetFinish {
  name: string;
  color: number;
  inner: number;
  rough: number;
  swatch: string;
}

/** A named system size: sub and mid diameters in inches. */
export interface Format {
  id: string;
  name: string;
  sub: SubSize;
  mid: 10 | 12;
  note: string;
}

/** An amp's id: one of the models in the amps catalog (`AMP_SERIES`), so a rack can't name an amp that isn't there. */
export type AmpId = (typeof AMP_SERIES)[number]["models"][number]["id"];

/** A DSP unit's id: one of the rows in the DSP catalog (`DSP_UNITS`). */
export type DspUnitId = (typeof DSP_UNITS)[number]["id"];

/** A DSP unit with a settled used price: only these can be a rack line, which takes the price from the unit. */
export type PricedDspUnitId = Extract<(typeof DSP_UNITS)[number], { usedPrice: PriceRange }>["id"];

/** A rack line that is no catalog part: description and price in dollars. */
export type RackTextItem = readonly [text: string, price: number];

/**
 * A rack line that is a used amp from the amps catalog: its name and price come from the amp entry. `use` says what
 * it drives, `rating` adds its 8 Ω power, `note` follows.
 */
export interface RackAmpItem {
  amp: AmpId;
  use: string;
  rating?: true;
  note?: string;
}

/**
 * A rack line that is a used DSP unit from the DSP catalog: its name and used price come from the unit's entry.
 */
export interface RackDspItem {
  dsp: PricedDspUnitId;
  note: string;
}

/** One line of a rack's parts list. */
export type RackItem = RackTextItem | RackAmpItem | RackDspItem;

export interface Rack {
  id: string;
  name: string;
  note: string;
  items: readonly RackItem[];
}

/** A rack as the Notes page lists it: every line resolved to its words and price. */
export type RackView = Omit<Rack, "items"> & { items: { label: string; price: PriceRange }[] };

/** A crossover / DSP unit as the Notes page's comparison table shows it: one display-text cell per column. */
export type DspUnitRow = Readonly<Record<DspColumn, string>>;

/** A column of the DSP comparison table: a cell of every unit's row (`DSP_COLUMNS` holds their order and headers). */
export type DspColumn = keyof typeof DSP_COLUMNS;

/** A DSP unit in the catalog: its id (racks name it by this) and its comparison-table row. */
export interface DspUnit {
  id: string;
  row: DspUnitRow;
  /** a used one's price range, US dollars, where settled: the table's price cell adds it and a rack line uses it */
  usedPrice?: PriceRange;
}

/** A price in US dollars as a range, low to high (equal for a single price). */
export type PriceRange = Pick<XmaxBand, "lo" | "hi">;

/** An amp's output-stage class (`AMP_CLASSES`). */
export type AmpClass = keyof typeof AMP_CLASSES;

/** A column of the Notes page's amp table (`AMP_COLUMNS` holds their order and headers). */
export type AmpColumn = keyof typeof AMP_COLUMNS;

/** One amplifier model of a series: per-channel power, continuous with all channels driven. */
export interface AmpModel {
  id: string;
  /** model name without the brand, as the notes write it (`GXD4`) */
  model: string;
  /** output-stage class; null where the maker doesn't state it */
  ampClass: AmpClass | null;
  /** output channels, unbridged */
  channels: number;
  /** watts per channel into 8 Ω and into 4 Ω */
  w8: number;
  w4: number;
  /** voltage gain, dB; null where the maker publishes neither gain nor sensitivity */
  gainDb: number | null;
  /** the speaker-power range its limiter can be set to, watts; null where the limiter takes no speaker power */
  limiterW: readonly [min: number, max: number] | null;
  /** a used one's price, US dollars, as the racks buy it */
  usedPrice: number;
  /** the used price is an estimate: no US listing was found */
  usedPriceEst?: true;
  /** what sets this model apart from its series, or where a figure came from; display text */
  note?: string;
}

/** An amplifier series and the DSP its models share, as the Notes page and the signal-path drawing describe it. */
export interface AmpSeries {
  brand: string;
  models: readonly AmpModel[];
  /** whether the amps have DSP (crossovers, EQ, delay), not just fixed filters */
  dsp: boolean;
  /** the crossover filters (or, with no DSP, the fixed filters), display text */
  filters: string;
  /** the limiter's name and presets, display text */
  limiterModes: string;
  /** what the amp's processing can't do, display text */
  limits: string;
  /** where the figures come from: the maker's documents */
  src: readonly { name: string; url: string }[];
}

/** A paint color: [hex, name]. */
export type PaintSwatch = readonly [hex: string, name: string];

// ---- Fills ----

export interface FillHf {
  sens: number;
  aes: number;
  xo: number | null;
  imp: number;
  cov: number | null;
}

export interface FillDriver {
  id: string;
  size: number;
  lb: number;
  name: string;
  /** who makes it (`MAKER_NAMES`): code reads this, never the start of `name` */
  maker: MakerId;
  price: number | null;
  src: string;
  ts: ThieleSmall;
  /** the compression section; null for a fill without one */
  hf: FillHf | null;
  lfSens: number;
  note: string;
}

// ---- Hi-fi ----

/** An HF figure a coaxial's maker doesn't publish, by id (`COAX_GAP_NAMES`): the whole HF section, its crossover or its coverage. */
export type CoaxGap = keyof typeof COAX_GAP_NAMES;

/**
 * A coaxial (a `FillDriver`) as the Hi-fi engine takes it (lib/data coaxParts): its woofer, and its HF section as a
 * tweeter of type "coaxial" at the woofer's center, the cone its conical waveguide (`ownGuide`). Both carry the
 * coaxial's id: a design whose woofer and tweeter ids are equal is a coaxial (lib/hifi isCoax). The woofer carries the
 * coaxial's weight and price, the HF part none. `tweeter` is null where the maker publishes no HF section (the woofer
 * alone can be modeled); `gaps` lists the HF figures that are missing.
 */
export interface CoaxParts {
  woofer: HifiWoofer;
  tweeter: HifiTweeter | null;
  gaps: readonly CoaxGap[];
}

export interface HifiWoofer {
  id: string;
  size: number;
  lb: number;
  name: string;
  /** who makes it (`MAKER_NAMES`): code reads this, never the start of `name` */
  maker: MakerId;
  /** US dollars; null for a coaxial with no US price (the optimizer then leaves it out unless it is your design's) */
  price: number | null;
  src: string;
  ts: HifiWooferTS;
  /** highest usable frequency, Hz */
  fmax: number | null;
  note: string;
}

/**
 * A tweeter's kind; "amt" is an air motion transformer (a folded diaphragm behind a flat plate), "coaxial" a coaxial's
 * HF section, at its woofer's center (lib/data coaxParts).
 */
export type TweeterType = "dome" | "horn-loaded" | "compression" | "ribbon" | "amt" | "coaxial";

export interface TweeterHf {
  sens: number;
  aes: number;
  aesXo: number | null;
  minXo: number | null;
  imp: number;
  fs: number | null;
}

/** A ribbon's own waveguide, or an AMT's plate: coverage in degrees and mouth size in inches. */
export interface OwnGuide {
  name: string;
  covH: number;
  covV: number;
  w: number;
  h: number;
}

export interface HifiTweeter {
  id: string;
  lb: number;
  name: string;
  price: number;
  src: string;
  hf: TweeterHf;
  type: TweeterType;
  /** exit diameter in inches, null for a horn-loaded tweeter */
  exit: number | null;
  /** the baffle cut-out the tweeter needs, inches; 3.5 in square where the maker gives no size, and a round faceplate is a square of its diameter */
  faceplate: Dims2;
  /** absent on the ribbons and AMTs, which come with their own */
  needsWaveguide?: boolean;
  note: string;
  /** radiating diameter in inches for the directivity: the exit, or the mouth of a horn-loaded tweeter */
  domeIn: number;
  /** the tweeter's own waveguide: a ribbon's plate, an AMT's plate, or a coaxial's woofer cone round its HF */
  ownGuide?: OwnGuide;
  /**
   * a compression driver's throat mount: its bolts or a screw-on thread; absent: bolt-on, with the PA catalogue's
   * pattern for the same driver, else a generic 2-bolt one
   */
  mount?: DriverMount;
}

/**
 * A tweeter as the table gives it: the faceplate is a round `diameter` or `w` and `h` (null where the maker gives no size),
 * and `domeIn` is not set yet. `data.ts` turns every row into a `HifiTweeter` when the module loads.
 */
export type HifiTweeterRaw = Omit<HifiTweeter, "faceplate" | "domeIn"> & {
  faceplate: { diameter: number } | Dims2 | null;
};

export interface PassiveRadiator {
  id: string;
  name: string;
  /** who makes it (`MAKER_NAMES`): code reads this, never the start of `name` */
  maker: MakerId;
  size: number;
  Sd: number;
  Mms: number;
  Cms: number;
  Qms: number;
  Fs: number;
  /** the one-way limit the model uses, mm: the linear `pub.Xmax`, else the mechanical `pub.Xlim` (see `lib/xmax`) */
  Xmax: number;
  xmax: XmaxBand;
  /** the maker's figures: a linear `Xmax`, or only the mechanical limit `Xlim` (SB, Purifi, Seas) */
  pub: PublishedExcursion;
  lb: number | null;
  price: number;
  src: string;
  note: string;
  /** a non-round cone's width and height in inches */
  shape?: Dims2;
  /** the most added mass in grams; the planner allows 3 x Mms when absent */
  maxAddG?: number;
}

/** A passive radiator as its table holds it: the published limit, before `lib/xmax` adds the comparable one. */
export type RawPassiveRadiator = Omit<PassiveRadiator, "Xmax" | "xmax">;

/** The passive radiators chosen in a saved Hi-fi design: driver id, count and added mass per unit in grams. */
export interface RadiatorSelection {
  id: string;
  n: number;
  addG: number;
}

export type HifiBoxKind = "sealed" | "vented" | "radiator";

// ---- Hi-fi design (lib/hifi) ----

export type HifiPlacement = "free" | "wall" | "corner";
export type PanelMaterial = "ply" | "mdf";
/** Linkwitz-Riley crossover order: 4 is 24 dB/oct, 8 is 48 dB/oct. */
export type CrossoverOrder = 4 | 8;

/**
 * A high-pass to a sub ahead of the woofer: a Linkwitz-Riley filter of `order` at `hz`, the woofer's half of the
 * sub-to-speaker crossover. At or above the automatic subsonic's corner it takes its place; below it the subsonic stays in
 * series (lib/hifi hifiBox).
 */
export interface HifiHighpass {
  hz: number;
  order: CrossoverOrder;
}

/** How the speaker is driven, by id (`HIFI_DRIVE_NAMES`): an amp channel per driver behind a DSP crossover, or one amp channel and a passive network. */
export type HifiDrive = keyof typeof HIFI_DRIVE_NAMES;

/**
 * A round port. `n` is the number of equal openings, `dia` and `len` are in inches, `elbows` is how many bends it
 * takes to fit. The `?: undefined` fields are the slot's, so the two port kinds can be told apart by `shape` and read
 * without narrowing.
 */
export interface RoundPort {
  shape?: "round";
  n: number;
  dia: number;
  len: number;
  elbows?: number;
  h?: undefined;
  w?: undefined;
}

/** A full-width slot along the bottom of the baffle: height `h`, length `len`, in inches; `w` is set by `hifiSystem`. */
export interface SlotPort {
  shape: "slot";
  n: number;
  h: number;
  w?: number;
  len: number;
  dia?: undefined;
  elbows?: undefined;
}

export type HifiPort = RoundPort | SlotPort;

/** A slot port with its width, as `hifiSystem` models it. */
export type SizedSlotPort = SlotPort & Required<Pick<SlotPort, "w">>;

/** What the port toggle remembers across shapes, in inches: the last round port's diameter and the last slot's height. */
export type PortMemory = Pick<RoundPort, "dia"> & Pick<SlotPort, "h">;

/** The passive radiators in use: the driver itself, how many, and the added mass on each in grams. */
export interface PassiveRadiatorChoice {
  drv: PassiveRadiator;
  n: number;
  addG: number;
}

/** A waveguide's coverage in degrees and mouth size in inches; `freestanding` sits it on the box top. */
export interface WaveguideSpec {
  name: string;
  covH: number;
  covV: number;
  w: number;
  h: number;
  freestanding: boolean;
  /** the waveguide's own lowest crossover, Hz (its loading); null or absent when it sets none */
  minXo?: HornHf["minXo"];
  /** where the waveguide stops holding its pattern and loading the driver, Hz; absent when it sets none */
  lowHz?: HornHf["lowHz"];
  /** a screw-on waveguide's thread; absent: the driver bolts on */
  mount?: Horn["mount"];
}

/** The Hi-fi design the model works on (the Hi-fi page's state, with the units the lib uses: inches, Hz, watts, dB). */
export interface HifiConfig {
  box: HifiBoxKind;
  /** the passive radiators (used when `box` is "radiator") */
  readonly pr?: PassiveRadiatorChoice;
  dim: Dims3;
  /** panel thickness in inches; 0.75 when absent */
  wall?: number;
  mat?: PanelMaterial;
  /** the port (used when `box` is "vented") */
  readonly port: HifiPort;
  /** crossover frequency, Hz */
  xo: number;
  order?: CrossoverOrder;
  /** woofer and tweeter amplifier watts */
  wAmpW: number;
  tAmpW?: number;
  /** baffle-step compensation in dB */
  bsc?: number;
  place?: HifiPlacement;
  /** distance to the wall behind in feet */
  wallFt?: number;
  /** the port's air speed limit, m/s */
  portMax?: number;
  /** subsonic high-pass for a vented or radiator box, Hz; null for none */
  hpf?: number | null;
  /** the waveguide, or null for a bare dome */
  guide?: WaveguideSpec | null;
  /** extra tweeter sensitivity from the waveguide, dB */
  guideGain?: number;
  /** the woofer response's frequency points from 15 Hz to 2 kHz (196 when absent); the curve runs on at the same spacing */
  N?: number;
  /** radius of the roundover on the baffle's edges, inches; 0 (sharp) when absent */
  roundoverIn?: number;
  /** how far the tweeter sits off the baffle's center line, inches, + toward the inside of the pair (mirror-imaged); 0 when absent */
  tweeterOffsetIn?: number;
  /** a high-pass to a sub, in place of the subsonic `hpf` (in series with it below its corner); absent: none */
  hp?: HifiHighpass;
  /**
   * active (absent): the tweeter has its own amp, `tAmpW`; passive: one amp channel, `wAmpW`, feeds both drivers and
   * the tweeter gets its power through the network's pad (`tAmpW` is not read)
   */
  drive?: HifiDrive;
  /** the box's kick-back, degrees: its baffle tilted back so its axis points this far up; 0 when absent */
  tiltDeg?: number;
}

/** Where the drivers sit on the baffle, inches from the box bottom. */
export interface DriverLayout {
  tweeterIn: number;
  wooferIn: number;
  spacingIn: number;
  /** the tweeter's waveguide sits on the box top */
  onTop?: true;
  /** a coaxial: the tweeter is the woofer's own HF section, at its center (spacing 0) */
  coax?: true;
}

/** What stops a level, by id (`LIMIT_NAMES` holds the word a chart label shows for it). */
export type LimitId = keyof typeof LIMIT_NAMES;
/** What limits the woofer's output at a frequency: any limit, a radiator's travel included. */
export type WooferLimit = LimitId;

/** The woofer's response at one frequency, with the baffle step, placement, EQ and low-pass applied. */
export interface WooferPoint {
  f: number;
  spl: number;
  raw: number;
  xmm: number;
  vel: number | null;
  prx: number | null;
  /** the baffle-step EQ gain and the low-pass gain */
  e: number;
  lp: number;
}

/** How loud the woofer can play at one frequency before something gives out. `s` is the scale from full-scale input. */
export interface WooferMaxPoint {
  f: number;
  spl: number;
  who: WooferLimit;
  s: number;
}

/** What every modeled Hi-fi speaker has, whatever its box. */
export interface HifiSystemBase {
  gross: number;
  net: number;
  disp: number;
  pVol: number;
  pArea: number;
  f3Box: number;
  ref: number;
  refW: number;
  woofer: WooferPoint[];
  wMax: WooferMaxPoint[];
  /** `wMax` at the low and high ends of the woofer's and radiator's estimated Xmax; null when both are exact */
  wMaxBand: BandCurves<WooferMaxPoint> | null;
  sMusic: number;
  whoW: WooferLimit;
  trim: number;
  tSens: number;
  tSens283: number;
  tLevel: number;
  wLevel: number;
  maxLevel: number;
  who: "tweeter" | "woofer";
  pMax: number;
  derate: number;
  lb: number;
  portFits: boolean;
  /** the fewest elbows that fit the port; null when it is too long even with two */
  portElbows: number | null;
  lay: DriverLayout;
  f3: number;
  hpf: number | null;
  /** the high-pass to a sub in use (`hpf` is null unless the subsonic stays in series below it); absent when the design has none */
  hp?: HifiConfig["hp"];
  xo: number;
  order: CrossoverOrder;
  bsF3: number;
  /** the tweeter's level at 1 m at `f` Hz for `volts`, through its high-pass */
  tweeterAt: (f: number, volts: number) => number;
  V: number;
}

/** A sealed box, lightly stuffed: its Qtc. */
export interface HifiSealedSystem extends HifiSystemBase {
  kind: Extract<HifiBoxKind, "sealed">;
  Qtc: number;
  Fb?: undefined;
  Fp?: undefined;
  peakVel: null;
}

/** A ported box: its tuning, the port's peak air speed and, for a slot, the slot's width in inches (null for round ports). */
export interface HifiVentedSystem extends HifiSystemBase {
  kind: Extract<HifiBoxKind, "vented">;
  Fb: number;
  slotW: number | null;
  peakVel: number;
  Qtc?: undefined;
  Fp?: undefined;
}

/** A passive-radiator box: the radiators used, whether they fit the back, the box tuning and the radiators' own resonance. */
export interface HifiRadiatorSystem extends HifiSystemBase {
  kind: Extract<HifiBoxKind, "radiator">;
  pr: PassiveRadiatorChoice;
  Fb: number;
  Fp: number;
  peakVel: null;
  Qtc?: undefined;
}

/**
 * The modeled speaker: `hifiSystem`'s result, one variant per box kind. The `?: undefined` fields are the other
 * boxes', so `Fb`, `Fp` and `Qtc` can be read without narrowing and `kind` says which one is set.
 */
export type HifiSystem = HifiSealedSystem | HifiVentedSystem | HifiRadiatorSystem;

/** A check on the design: a severity, a short title, a sentence of detail and the check's id. */
export type HifiChip = Chip<ChipId<"hifi">>;

/** Where the listener sits: feet across the room (x) and back from the speakers (y). */
export interface ListeningSeat {
  x: number;
  y: number;
}

/** Where the listener is relative to one speaker: horizontal angle off its axis (rad), ear height above the box bottom (in) and distance (m). */
export interface ListenerGeometry {
  th: number;
  eyeIn: number;
  distM: number;
  /** which side of the axis the listener is on: 1 toward the other speaker (where a + tweeter offset goes), -1 away; 1 when absent */
  side?: -1 | 1;
  /** the on-axis distance the drivers are time-aligned at, m; `distM` when absent (a map's arc keeps it while the listener moves round) */
  alignM?: number;
  /**
   * the point is already in the box's own frame (on its axis, or on a dispersion map's arc round it), so the box's
   * tilt (`HifiConfig.tiltDeg`) is not applied to it; absent: the point is in the room, the box tilted under it
   */
  boxFrame?: true;
}

export interface FrequencyPoint {
  f: number;
  spl: number;
}

/** A curve point with its phase, radians, unwrapped along the curve. */
export type PhasePoint = FrequencyPoint & { phase: number };

/** The plane a dispersion map is taken in: horizontal (sideways off axis) or vertical (above and below it). */
export type DispersionPlane = "h" | "v";

/** Level against angle and frequency, relative to on-axis; `rows[angle][frequency]` in dB. */
export interface HifiDispersionMap {
  angles: number[];
  freqs: number[];
  rows: number[][];
  /** the design's crossover frequencies, Hz, low to high, which the map marks */
  crossovers: number[];
}

// ---- Hi-fi optimizer (lib/hifi/optimize) ----

export type HifiGoal = "cheaper" | "lighter" | "lower" | "louder";

export type DimensionLockMode = "free" | "exact" | "max";

/** The optimizer locks that are plain on/off switches (a box dimension has its own mode: `dim`). */
export type HifiLockKey = "woofer" | "tweeter" | "box" | "xo" | "wAmpW" | "tAmpW";

/** The optimizer's on/off locks, plus how each box dimension is held. */
export interface HifiOptimizerLocks extends Partial<Record<HifiLockKey, boolean>> {
  dim?: Partial<Record<keyof Dims3, DimensionLockMode>>;
}

/** A radiator design as the page hands it to the optimizer: the driver named by id, with no `drv` yet. */
export interface PassiveRadiatorHandover {
  id: string;
  n: number;
  addG: number;
}

/** The design the optimizer starts from: the page's config with the drivers named by id. */
export interface HifiOptimizerCurrent extends HifiConfig {
  woofer: string;
  tweeter: string;
  tAmpW: number;
}

export interface HifiOptimizerInput {
  /** `pr` can come as `{ id, n, addG }`; the optimizer looks the driver up in `passives` */
  cur: Omit<HifiOptimizerCurrent, "pr"> & {
    readonly pr?: PassiveRadiatorChoice | PassiveRadiatorHandover;
  };
  woofers: readonly HifiWoofer[];
  tweeters: readonly HifiTweeter[];
  passives?: readonly PassiveRadiator[];
  goals?: readonly HifiGoal[];
  locks?: HifiOptimizerLocks;
  /** the most the drivers may cost for a pair, in dollars */
  budget?: number;
  /** listening distance, m */
  seatM?: number;
  /** the price of a waveguide, for one speaker */
  guidePrice?: number;
  /** the plywood the search designs in (HIFI_OPTIMIZER_PANEL) at its measured thickness, inches; absent: its default */
  wall?: number;
}

/** What a design is scored on: price for the pair in dollars, weight in lb, in-room F3 in Hz and clean level at the seat in dB. */
export interface HifiMetrics {
  gross: number;
  f3: number;
  price: number;
  level: number;
  lb: number;
}

/** One speaker's paths to the seat for its level there, m: its woofer's and its tweeter's (lib/hifi hifiSeatPaths). */
export interface HifiSeatPaths {
  wM: number;
  tM: number;
}

/**
 * The metrics with whether the price is whole: false when a part has no US price (a coaxial's), so `price` sums only
 * the known ones and the real one is higher (`UI_TEXT.partialPriceMark`), as the PA side's `priceKnown`.
 */
export interface HifiPricedMetrics extends HifiMetrics {
  priceKnown: boolean;
}

/** The Hi-fi page's design and room, as the planner holds it. */
export interface HifiDesignState {
  woofer: HifiWoofer;
  tweeter: HifiTweeter;
  selectedWaveguide: HifiWaveguide;
  boxType: HifiBoxKind;
  boxDims: Dims3;
  /** the walls' nominal size */
  wallPanel: PanelNominal;
  /** the Cutlist page's measured thickness of each nominal size */
  panelExactIn: PanelExactIn;
  panelMaterial: PanelMaterial;
  portSpec: HifiPort;
  radiatorSelection: RadiatorSelection;
  crossoverHz: number;
  crossoverOrder: CrossoverOrder;
  wooferAmpWatts: number;
  tweeterAmpWatts: number;
  baffleStepCompensationDb: number;
  placement: HifiPlacement;
  distanceToWallFt: number;
  speakerSpacingFt: number;
  toeInDeg: number;
  listeningSeat: ListeningSeat;
  earHeightIn: number;
  standHeightIn: number;
  dispersionPlane: DispersionPlane;
  /** baffle edge roundover radius, inches (0: sharp) */
  roundoverIn: number;
  /** tweeter offset from the baffle's center line, inches, + toward the inside of the pair */
  tweeterOffsetIn: number;
  /** a high-pass to a sub (`HifiConfig.hp`); absent: none */
  subHighpass?: HifiConfig["hp"];
  /** active or passive drive (`HifiConfig.drive`); absent: active */
  drive?: HifiConfig["drive"];
  /** the box's kick-back, degrees (`HifiConfig.tiltDeg`); absent: 0 */
  tiltDeg?: HifiConfig["tiltDeg"];
  /** the least distance each speaker's level at the seat, and the dispersion map, are worked out at, m; absent: `HIFI_SEAT_FLOOR_M` */
  seatFloorM?: number;
  /** the port's air speed limit, m/s (`HifiConfig.portMax`); absent: `HIFI_PORT_MAX_MS` */
  portMaxMs?: HifiConfig["portMax"];
}

/** What the model reads off a design that can be modeled: the system, and the curves and numbers worked out from it. */
export interface HifiSpeakerModel {
  speakerSystem: HifiSystem;
  warningChips: HifiChip[];
  /** both speakers' clean output at the seat, dB: each at its own distance, its drivers' paths counted close in, added in power (lib/hifi/nearField hifiPairLevelDb) */
  maxLevelAtSeatDb: number;
  onAxisResponse: FrequencyPoint[];
  pairResponse: FrequencyPoint[];
  /** what the tweeter can play at 1 m, behind the crossover */
  tweeterMaxCurve: FrequencyPoint[];
  dispersion: HifiDispersionMap;
  /** the tweeter's edge diffraction alone on axis at 1 m: the ripple it puts on the response, dB */
  edgeRipple: FrequencyPoint[];
  /** that ripple's ± spread from 1 to 5 kHz, dB */
  edgeRippleDb: number;
}

/**
 * How near the seat is for the models that stay far-field close in (lib/hifi): the woofer's piston and the waveguide's
 * directivity, the dispersion map drawn at the seat distance (its ±90° arc points close to the baffle) and the time
 * alignment set at the listening distance (sensitive to the ear's height close in). The level, baffle step and boundary
 * gain take their near-field forms below HIFI_NEAR_FIELD_M (lib/hifi/nearField).
 */
export interface HifiNearField {
  /** the nearer speaker's distance to the seat, at least the seat floor (`HifiDesignState.seatFloorM`), m */
  distM: number;
  /** that over the baffle's longer side, and over the woofer's diameter */
  boxRatio: number;
  wooferRatio: number;
  /** under HIFI_NEAR_FIELD_M (constants/hifiEngine), where the near-field forms are in use and the models above are approximate */
  near: boolean;
}

/** The Hi-fi design as the models read it, worked out from the planner's state. */
export interface HifiDesign {
  /** the box's least width and height, inches: what its parts need, up to the sliders' step (lib/hifi/boxLayout) */
  boxMin: Dims2;
  /** the walls' exact thickness, inches (lib/panel): what the model, cutlist and weight are worked out at */
  wallThicknessIn: number;
  /** the waveguide picked for compression drivers (the optimizer tries them on it even while a ribbon is loaded) */
  compressionWaveguide: WaveguideSpec;
  /** the waveguide in use: the tweeter's own, the picked one for a tweeter that needs one, else none */
  waveguideSpec: WaveguideSpec | null;
  radiatorDriver: PassiveRadiator;
  radiator: PassiveRadiatorChoice;
  speakerConfig: HifiConfig;
  tweeterWithWaveguide: HifiTweeter;
  /** each speaker's seat geometry: the left one at -spacing/2, the right at +spacing/2 */
  leftGeometry: ListenerGeometry;
  rightGeometry: ListenerGeometry;
  /** the average distance to the seat, at least the seat floor (`HifiDesignState.seatFloorM`, 1 m by default) */
  seatDistanceM: number;
  /** the same distance in feet, as the page shows it */
  seatDistanceFt: number;
  /** how near the seat is for the far-field models; a later chip reads it */
  nearField: HifiNearField;
  pairCostUsd: number;
  /** false when a part in it has no US price: `pairCostUsd` sums the known ones (`UI_TEXT.partialPriceMark`) */
  pairCostKnown: boolean;
  /** null when the woofer can't be modeled (its parameters aren't published) */
  speakerModel: HifiSpeakerModel | null;
}

/** The optimizer locks as a page holds them: an on/off lock per key, and the lock mode of each box dimension for each box (always present). */
export type OptimizerLocks<K extends string, B extends string> = Partial<Record<K, boolean>> &
  Record<B, Partial<Record<keyof Dims3, DimensionLockMode>>>;

/** The Hi-fi optimizer locks as the page holds them. */
export type HifiPlannerLocks = OptimizerLocks<HifiLockKey, "dim">;

/** The card being previewed, and the design to go back to when the preview ends. */
export interface DesignPreview<Card, Config> {
  label: string;
  before: Config;
  card: Card;
}

/** The fields of a design a card applies (the ones the optimizer searched). */
export interface HifiCardConfig {
  woofer: string;
  tweeter: string;
  box: HifiBoxKind;
  dim: Dims3;
  port: HifiPort;
  pr: RadiatorSelection | undefined;
  wall: number;
  xo: number;
  wAmpW: number;
  tAmpW: number;
}

/** The fields of a Hi-fi design a card applies (the keys of `HIFI_OPTIMIZED_FIELDS`). */
export type HifiOptimizedField =
  | "woofer"
  | "tweeter"
  | "box"
  | "dim"
  | "port"
  | "pr"
  | "wall"
  | "xo"
  | "wAmpW"
  | "tAmpW";
export type HifiOptimizedFields = Pick<HifiCardConfig, HifiOptimizedField>;

/**
 * What the Hi-fi page saves: the fields a card applies and the rest of the design and room. The JSON round trip drops
 * undefined fields, so `pr` is absent unless the box has radiators.
 */
export interface SavedHifiConfig
  extends Omit<HifiCardConfig, "pr">, Pick<PaDesignConfig, "cabFinish" | "baffleColor"> {
  pr?: RadiatorSelection;
  /** the walls' nominal size; absent in configs saved before the sizes (their `wall` names it) */
  panel?: PanelNominal;
  guide: string;
  mat: PanelMaterial;
  order: CrossoverOrder;
  bsc: number;
  place: HifiPlacement;
  wallFt: number;
  spacing: number;
  toe: number;
  seat: ListeningSeat;
  earIn: number;
  standIn: number;
  /** baffle edge roundover radius, inches; absent in configs saved before it existed (sharp edges) */
  roundover?: number;
  /** tweeter offset, inches, + toward the inside; absent in configs saved before it existed (centered) */
  tweeterOffset?: number;
  summary: string;
}

/** A card's change from the current design. */
export interface HifiMetricsDelta {
  /** null when either price isn't whole (`HifiPricedMetrics.priceKnown`): no difference can be told */
  price: number | null;
  lb: number;
  level: number;
  f3: number;
}

/** What a card changes from your design, in the words its "changes" line shows. */
export type ChangeName = (typeof CHANGE_NAMES)[keyof typeof CHANGE_NAMES];

export interface HifiOptimizerCard {
  label: string;
  why: string;
  /** which card it is (first, fix, closest, smallest or an alternative's goal): code reads this, never the label */
  slot: CardSlot<HifiGoal>;
  woofer: string;
  tweeter: string;
  config: HifiCardConfig;
  metrics: HifiMetrics;
  /** false when a part has no US price: `metrics.price` sums the known ones (`HifiPricedMetrics`) */
  priceKnown: boolean;
  delta: HifiMetricsDelta | null;
  /** the warnings on this design (the checks it passes with a warning) */
  warnings: HifiChip[];
  names: { woofer: string; tweeter: string };
  lay: DriverLayout;
  /** the tweeter sits on a waveguide (undefined for a tweeter that needs none) */
  guided: boolean | undefined;
  /** the tweeter comes with its own waveguide */
  ownGuide: boolean;
  /** what differs from the current design: "woofer", "box size", "amp power" ... */
  changed: ChangeName[];
  /** clean level at the seat as [Hz, dB] points */
  curve: [number, number][];
  whoW: WooferLimit;
}

export interface HifiOptimizerResult {
  goals: HifiGoal[];
  cards: HifiOptimizerCard[];
  stats: { evaluated: number; ms: number; pool?: number };
  /** what fails in your design; empty when it passes or when no goal was given */
  curProblems: string[];
  // the fields below are absent when no goal was given
  cur?: HifiPricedMetrics | null;
  curCurve?: [number, number][] | null;
  goalMissing?: string | null;
}

// ---- PA design (lib/pa) ----

/** The subwoofer's vent layouts. `vslot1` is the single side duct; the rest are the cabinet's `vents`. */
export type PortStyle = VentKind | "vslot1";
/** Sub highpass alignments: Butterworth or Linkwitz-Riley, 24 or 48 dB/oct. */
export type HighpassType = "BW24" | "LR24" | "BW48" | "LR48";
export type PaLayout = "stack" | "pole" | "tower" | "satellite";
/** How the cutlist joins the corners. */
export type CornerJoint = "butt" | "rabbet" | "miter";
export type PlywoodSheetKind = "4x8" | "5x5";

/** A plywood sheet size in inches. */
export interface PlywoodSheet {
  w: number;
  h: number;
  name: string;
}

/** A nominal panel size, by id (`PANEL_NOMINAL_NAMES`): what the design pages pick. */
export type PanelNominal = keyof typeof PANEL_NOMINAL_NAMES;

/** The measured thickness of each nominal size, inches, as the Cutlist page keeps it; a size absent here is at its default. */
export type PanelExactIn = Partial<Record<PanelNominal, number>>;

/** One material at a nominal size: its default exact thickness and its weight at that thickness (lb/ft²). */
export interface PanelStockMaterial {
  t: number;
  lb: number;
}

/** A nominal panel size in the catalog: its imperial and metric sizes, and each material's default thickness and weight. */
export type PanelStock = { in: number; mm: number } & Record<PanelMaterial, PanelStockMaterial>;

/**
 * The sub's vent, in inches: the planner keeps every field, whichever layout uses it (`slotH` the slots, `throat` the
 * side ducts, `nt` and `dia` the tubes), and `len` is the duct length in all of them. `div` is the side ducts'
 * dividers' exact thickness (the design's divider size at the Cutlist page's measured thickness, lib/panel); absent,
 * as in saves from before the choice, they are ½″ (`ductDividerIn`).
 */
export interface VentSpec {
  slotH: number;
  nt: number;
  dia: number;
  throat: number;
  len: number;
  div?: number;
}

/** A set of round port tubes from stock pipe: how many, and each one's inside diameter in inches. */
export type PortTubeSet = Pick<VentSpec, "nt" | "dia">;

/**
 * Stock pipe a tube size is cut from: `dia` the size the planner models (the nominal inside diameter, in), the pipe's
 * measured inside and outside diameters (in), and a stick's length (ft) and price from a US vendor.
 */
export interface PortPipe {
  dia: number;
  idIn: number;
  odIn: number;
  stickFt: number;
  price: number;
  src: string;
  note: string;
}

/** A 90° elbow for a tube size: its price from a US vendor, or null where none sells one (the gap is in `note`). */
export interface PortElbow {
  dia: number;
  price: number | null;
  src: string | null;
  note: string;
}

/**
 * The PA design the planner snapshots and the optimizer works on: driver and box ids, dimensions in inches, crossovers in Hz,
 * amp watts and balance in dB. The fields after `layout` are looks and cutlist choices; the optimizer leaves them alone.
 */
export interface PaDesignConfig {
  format?: string;
  /** driver, box and horn ids from `lib/data` */
  sub: string;
  mid: string;
  midBox?: string;
  cd: string;
  horn: string;
  cabinet?: string;
  portStyle: PortStyle;
  /** the sub box's outside size */
  cDim: Dims3;
  cVent: VentSpec;
  /** sub highpass, Hz */
  hpf: number;
  hpType: HighpassType;
  ampW: number;
  /** peak port air speed allowed, m/s */
  portMax: number;
  /** the mid box's outside size */
  mDim: Dims3;
  /** side, top, bottom and back plywood, inches: the exact thickness of `panel` (lib/panel) */
  wall: number;
  /** the walls' nominal size; absent in designs saved before the sizes (their `wall` names it) */
  panel?: PanelNominal;
  /** the side ducts' dividers' nominal size (their exact thickness is `cVent.div`); absent in older saves: ½″ */
  divider?: PanelNominal;
  /** how far the baffles sit behind the frame front, inches */
  inset: number;
  /** how both boxes are braced; absent: the default for the plywood (`defaultBraceStyle`) */
  braceStyle?: BraceStyleId;
  /** how both boxes' backs are fixed; absent: screwed (`DEFAULT_BACK_JOINT`) */
  backJoint?: BackJointId;
  /** sub to mid and mid to horn crossovers, Hz */
  xoLo: number;
  xoHi: number;
  /** each crossover's Linkwitz-Riley order (4 = LR24, 8 = LR48); saves from before the setting load as LR24 */
  xoLoOrder: CrossoverOrder;
  xoHiOrder: CrossoverOrder;
  mAmpW: number;
  /** the music balance: how far the mid band's level sits below the sub's, dB (a level, not an angle; the saved key keeps its old name) */
  tilt: number;
  hfAmpW: number;
  /** the music balance: how far the horn band's level sits below the mid's, dB (a level, not an angle; the saved key keeps its old name) */
  hfTilt: number;
  layout: PaLayout;
  /** each box's handles and their offsets (lib/pa/hardware); absent in older saves: the defaults (`DEFAULT_PA`) */
  hardware?: PaHardware;
  baffleColor?: string;
  /** a paint color (hex) for the horn body over its catalog finish; absent: the finish (older saves have none) */
  hornColor?: string;
  /** what holds a driver bolted straight to its horn on the mid box's lid; absent in older saves: the aluminum plate */
  hornMount?: HornMountId;
  /** a `FinishId`, or a paint color as a hex string (`SwatchPicker` offers both) */
  cabFinish?: string;
  spacerH?: number;
  joint?: CornerJoint;
  /** saw kerf, inches */
  kerf?: number;
  /** edge trim on each factory edge, inches */
  trim?: number;
  grain?: GrainSettings;
  waterfall?: boolean;
  offcut?: OffcutShape;
  cuts?: CutStyle;
  /** the Cutlist page's measured thickness of each nominal size */
  exactIn?: PanelExactIn;
  summary?: string;
}

/** One point of a vented-box response: raw box SPL, system SPL with the highpass, cone excursion (mm, peak) and port air speed (m/s, peak). */
export interface VentedPoint {
  f: number;
  raw: number;
  spl: number;
  xmm: number;
  vel: number;
  /** the phase of `raw` (the box alone), radians, unwrapped; only with the model's `phase` option */
  rawPhase?: number;
}

export interface VentedBoxModel {
  curve: VentedPoint[];
  Fb: number;
  f3: number;
  f3Box: number;
  ref: number;
  spl30: number;
  spl35: number;
  spl45: number;
  peakVel: number;
  peakVelF: number;
  peakX: number;
  peakXF: number;
  xmaxPct: number;
}

/** A model point with the box's phase: what a model run with its `phase` option gives. */
export type PhasedPoint<P extends VentedPoint | SealedPoint> = P & { rawPhase: number };

/** A box model run with its `phase` option (see `phasedCurve`). */
export type PhasedModel<M extends VentedBoxModel | SealedBoxModel> = Omit<M, "curve"> & {
  curve: PhasedPoint<M["curve"][number]>[];
};

/** One point of a sealed-box response (no port). */
export interface SealedPoint {
  f: number;
  raw: number;
  spl: number;
  xmm: number;
  /** the phase of `raw` (the box alone, no crossover), radians, unwrapped; only with the model's `phase` option */
  rawPhase?: number;
}

export interface SealedBoxModel {
  curve: SealedPoint[];
  Fc: number;
  Qtc: number;
  f3: number;
  ref: number;
  peakX: number;
}

/**
 * A driver as an acoustic circuit (lib/acoustics/driverCircuit), in the box models' terms: a pressure source Pg behind
 * Ras + Rae + j(ωMas − 1/(ωCas)). Mechanical values are seen through the cone's area Sd: a mass or resistance divides
 * by Sd², a compliance multiplies by it. Symbols are Thiele and Small's.
 */
export interface DriverCircuit {
  /** the cone's effective area, m² */
  Sd: number;
  /** the moving mass with its air load, as on the datasheet, kg */
  Mms: number;
  /** the moving mass as acoustic mass, kg/m⁴ (less any front air load the caller's radiation load carries) */
  Mas: number;
  /** the suspension's compliance as acoustic compliance, m³/Pa */
  Cas: number;
  /** the suspension's mechanical loss (from Qms) as acoustic resistance, Pa·s/m³ */
  Ras: number;
  /** the voice coil's electrical damping as acoustic resistance, Bl²/(Re·Sd²), Pa·s/m³ */
  Rae: number;
  /** the amplifier's drive as a pressure source, V·Bl/(Re·Sd), Pa */
  Pg: number;
}

/** A vented box's losses as resistances (lib/acoustics/driverCircuit ventResistances), in Small's symbols. */
export interface VentResistances {
  /** the box's leakage, a resistance in parallel with its air, Pa·s/m³ */
  Ral: number;
  /** the vent's friction and turbulence, a resistance in series with its air mass, Pa·s/m³ */
  Rap: number;
}

/** A complex number, the one type the planner's complex math uses (lib/acoustics/complex). */
export interface Complex {
  /** the real part */
  re: number;
  /** the imaginary part */
  im: number;
}

/**
 * A 2 × 2 complex matrix, row by row: [[A, B], [C, D]] as [A, B, C, D]. As an acoustic two-port's transfer matrix it
 * gives the input's pressure and volume velocity from the output's: p₁ = A·p₂ + B·U₂, U₁ = C·p₂ + D·U₂.
 */
export type Matrix2 = readonly [Complex, Complex, Complex, Complex];

/** A horn segment's flare law: "con" conical, "exp" exponential (constants/hornEngine HORN_PROFILE). */
export type HornProfile = (typeof HORN_PROFILE)[keyof typeof HORN_PROFILE];

/** The solid angle a horn mouth radiates into, in units of π (constants/hornEngine RADIATION_ANGLE_NAMES). */
export type RadiationAngle = 2 | 1 | 0.5;

/**
 * One horn segment, throat side first, in Hornresp's units: areas in cm², length in cm. Equal areas make a straight
 * duct whatever the profile.
 */
export interface HornSegment {
  profile: HornProfile;
  /** the area at the segment's throat end, cm² (Hornresp's S1, S2, … for each segment's start) */
  s1: number;
  /** the area at the segment's mouth end, cm² (Hornresp's S2, S3, …) */
  s2: number;
  /** the segment's length along its axis, cm (Hornresp's L12, L23, …) */
  length: number;
}

/** A rear-chamber vent: a straight duct from the chamber to its exit. */
export interface HornPort {
  /** the total open area, cm² (all openings together; Hornresp's Ap) */
  area: number;
  /**
   * the vent's length, cm: its physical length plus the inner end's correction (Hornresp's Lpt with its end correction
   * off). The exit's radiation load adds the outer end's. With the radiation load off (the box models' mode) nothing
   * adds it, so pass the full effective length there: physical length plus both end corrections.
   */
  length: number;
  /**
   * a slot's opening, cm: one opening's sides (`area` is all of them together). Its exit takes the rectangle's end
   * correction, smaller than a round exit's of the same area. Several openings count as apart, each with its own
   * correction; slots split only by a fin radiate as one wider opening, so give that one. Absent: round.
   */
  slot?: { width: number; height: number };
}

/** A horn box's rear chamber: its net air, L, and its vent; sealed when the vent is null. */
export interface HornRearChamber {
  /** the chamber's net air, L (Hornresp's Vrc) */
  liters: number;
  port: HornPort | null;
}

/**
 * A front-loaded horn box as the horn engine (lib/acoustics/hornModel) takes it: the driver, a throat chamber, the
 * horn's segments and a sealed or vented rear chamber. No segments make a direct radiator (the mouth is the cone).
 */
export interface HornDesign {
  /** one driver's Thiele/Small parameters, as the box models take them (its voice coil's inductance with them) */
  driver: BoxModelTS;
  /**
   * how many of that driver share the throat, wired in parallel, each on the full voltage (Hornresp's Nd); 1 for one.
   * Each cone keeps its own air load.
   */
  drivers: number;
  /** identical boxes side by side, mouths touching: they load as one mouth `count` times the area */
  count: number;
  /** the air between the cone and the throat, L (Hornresp's Vtc); 0 for none */
  throatChamber: number;
  /** the horn, throat first; empty for a direct radiator */
  segments: readonly HornSegment[];
  rear: HornRearChamber;
  /** the solid angle the mouth radiates into, in units of π: 2 is half space */
  angle: RadiationAngle;
  /** how far the vent's exit sits behind the mouth's plane, cm: the path offset in the sum */
  portOffset: number;
}

/** One point of a horn model's response, before any crossover. */
export interface HornPoint {
  /** frequency, Hz */
  f: number;
  /** SPL at 1 m in the design's solid angle, all boxes together, dB: on axis, each source a point source */
  spl: number;
  /**
   * SPL at 1 m as Hornresp shows it, dB: each source's radiated power spread evenly over the solid angle (no
   * directivity). It equals `spl` while the mouth is small against the wavelength; above that it falls below by the
   * mouth's directivity index. Equal to `spl` with the radiation load off.
   */
  powerSpl: number;
  /** the phase of the summed pressure, radians, unwrapped */
  phase: number;
  /** group delay of the summed pressure, ms */
  delay: number;
  /** each cone's excursion ("x" in mm), peak, mm */
  xmm: number;
  /** air speed in the vent, m/s, peak; 0 when sealed */
  portSpeed: number;
  /** air speed at the horn's throat (the cone's face for a direct radiator), m/s, peak */
  throatSpeed: number;
  /** one driver's electrical impedance Ze (magnitude), ohms, of the `drivers` in parallel, its coil's inductance included */
  ze: number;
}

/** A horn model's result (lib/acoustics/hornModel). */
export interface HornModel {
  /** one point per frequency asked for */
  curve: HornPoint[];
  /** Fb: the rear chamber and vent's tuning on their own (where the vent's reactance cancels the chamber's), Hz; null when sealed */
  fb: number | null;
}

/** What stops a PA box's drive level, for the whole band or a sine at one frequency (no radiator). */
export type SubLimitWho = Exclude<LimitId, "radiator">;

/** The sub's music limit: the drive level (volts and watts into 8 ohm) where the first of port, cone, driver and amp gives out. */
export interface SubLimits {
  who: SubLimitWho;
  V: number;
  W: number;
  vel: number;
  xPct: number;
  spl30: number;
  spl35: number;
  spl45: number;
}

/** The most a sine can play at one frequency, and what stops it. */
export interface PaMaxPoint {
  f: number;
  spl: number;
  who: SubLimitWho;
}

/** The vent as the model uses it: openings, total area (in²), length (in), end correction (in), hydraulic diameter (in) and a description. */
/** How many 90° elbows a round port tube takes to fit its box (lib/tubeFold). */
export type ElbowCount = 0 | 1 | 2;

export interface VentGeometry {
  n: number;
  area: number;
  len: number;
  ec: number;
  dh: number;
  /** round tubes: the elbows each takes to fit (0 straight) */
  elbows?: ElbowCount;
  desc: string;
}

/** The sub's vent as the 3D view draws it, from the design's vent spec: duct height, tube count, tube radius, tube length, throat and the side ducts' dividers' thickness (all inches). */
export interface PaPortGeometry {
  ductH: number;
  nPorts: number;
  portR: number;
  tubeLen: number;
  throat: number;
  divider: number;
}

/** What `subGeometry` needs: boxes, plywood, vent and layout. */
export interface SubGeometryConfig {
  subBox: Dims3;
  midDims: Dims3;
  wall: number;
  inset: number;
  portStyle: PortStyle;
  cVent: VentSpec;
  layout: PaLayout;
  /** absent: the plywood's default (`defaultBraceStyle`) */
  braceStyle?: BraceStyleId;
  /** absent: screwed (`DEFAULT_BACK_JOINT`) */
  backJoint?: BackJointId;
  /** an optimizer's search: the braces' wood by its cursory estimate (braceWoodEstimate), not the rule */
  braceEstimate?: boolean;
  /** the boxes' handles and plates, whose recesses take volume (lib/pa/hardware); absent: none */
  hardware?: PaHardware;
}

/** `subSystem` adds the highpass, the amp and the port air speed limit. */
export interface SubSystemConfig extends SubGeometryConfig {
  hpf: number;
  hpType: HighpassType;
  ampW: number;
  portMax: number;
  /** the sub-to-mid crossover, for a curve that shows the lowpass skirt (the planner's chart); the optimizer's screening leaves it out */
  xoLo?: number;
  /** give the model's points the box's phase (the coverage map's); the optimizer leaves it off */
  phase?: boolean;
}

/** The sub's vent and volumes, without the model. */
export interface SubGeometry {
  port: VentGeometry;
  grossL: number;
  ductL: number;
  woodL: number;
  /** the liters the hardware's recesses take (lib/pa/hardware) */
  recessL: number;
  netL: number;
  Fb: number;
}

/** What a sub always has: its vent, volumes and the amp's peak voltage. */
export interface SubSystemBase {
  port: VentGeometry;
  grossL: number;
  ductL: number;
  woodL: number;
  /** the liters the hardware's recesses take (lib/pa/hardware) */
  recessL: number;
  netL: number;
  AMP_V: number;
}

/** A sub with no model: the driver has no T/S, or the box or vent is degenerate (no net volume, no port area, port length at or under 0). */
export interface SubSystemUnmodeled extends SubSystemBase {
  mdl: null;
  lim: null;
}

/** A sub with its vented-box model and the music limit that comes from it. */
export interface SubSystemModeled extends SubSystemBase {
  mdl: VentedBoxModel;
  lim: SubLimits;
}

/** `subSystem`: check `mdl` and `lim` narrows with it. */
export type SubSystem = SubSystemUnmodeled | SubSystemModeled;

export interface MidSystemConfig
  extends
    Pick<SubGeometryConfig, "braceEstimate" | "hardware">,
    Pick<PaDesignConfig, "xoLoOrder" | "xoHiOrder" | "braceStyle" | "backJoint"> {
  /** the tower's mid chamber is part of the sub's cabinet and takes no braces of its own; absent: a box of its own */
  layout?: PaLayout;
  midDims: Dims3;
  wall: number;
  inset: number;
  xoLo: number;
  xoHi: number;
  mAmpW: number;
  /** give the model's points the box's phase (the coverage map's); the optimizer leaves it off */
  phase?: boolean;
}

/** What a mid always has: voltages and the sealed box's volumes. */
export interface MidSystemBase {
  V: number;
  grossL: number;
  disp: number;
  /** the liters the hardware's recesses take (lib/pa/hardware) */
  recessL: number;
  netL: number;
  effL: number;
  vTherm: number;
  useV: number;
  /** under Qtc 0.5, the net volume, L, that gives Qtc 0.5, when a box the driver fits can be that small (midSmallerBoxNetL); else null */
  smallerBoxNetL: number | null;
}

/** A mid with no model (the driver has no T/S): no response and no limit curve. */
export interface MidSystemUnmodeled extends MidSystemBase {
  mdl: null;
  max: null;
}

/** A mid with its sealed-box model and the most it can play at each frequency. */
export interface MidSystemModeled extends MidSystemBase {
  mdl: SealedBoxModel;
  max: PaMaxPoint[];
}

/** `midSystem`: check `mdl` and `max` narrows with it. */
export type MidSystem = MidSystemUnmodeled | MidSystemModeled;

/** The compression driver on its horn: power available, the cap, and the response from the crossover up. */
export interface HornResponse {
  /** the compression driver's spec the response was built from */
  hf: CompressionHf;
  curve: FrequencyPoint[];
  /** watts the driver sees: the lower of the amp and the program rating */
  P: number;
  pAmp: number;
  pProg: number;
  /** power derating for a crossover below the frequency the AES rating assumes (1 = none) */
  derate: number;
  imp: number;
  /** "thermal" when the program rating, not the amp, sets `P` */
  who: Extract<LimitId, "amp" | "thermal">;
  /** dB at 1 m for the power in `P`, before the filters */
  flat: number;
}

export type FillBoxType = "vented" | "sealed";

/** A fill's round port. */
export interface FillPort {
  n: number;
  dia: number;
  len: number;
}

/** The Fills page's design, as the planner holds it. */
export interface FillDesignState {
  driver: FillDriver;
  boxType: FillBoxType;
  boxDims: Dims3;
  portSpec: FillPort;
  /** the highpass to the subs, Hz */
  highpassHz: number;
  /** the highpass's slope: LR24 (4) or LR48 (8) */
  highpassOrder: CrossoverOrder;
  /** per box, rated into 8 Ω */
  ampWatts: number;
  maxPortAirSpeedMs: number;
}

export interface FillSystemConfig {
  boxType: FillBoxType;
  /** the box's outside size, inches */
  dim: Dims3;
  port: FillPort;
  /** the highpass to the subs, Hz */
  hp: number;
  /** the highpass's slope: LR24 (4) or LR48 (8) */
  hpOrder: CrossoverOrder;
  ampW: number;
  portMax: number;
}

/** What every modeled fill has, whichever box. */
export interface FillSystemBase {
  V: number;
  gross: number;
  pArea: number;
  disp: number;
  net: number;
  eff: number;
  max: PaMaxPoint[];
  sens: number;
  f3: number;
  pad: number;
  /** amp watts at which the HF reaches its program rating; null for a fill without an HF section */
  hfLimW: number | null;
  lb: number;
  portLimited: boolean;
}

/** A ported fill: the vented-box model, no sealed one. */
export interface FillSystemVented extends FillSystemBase {
  boxType: Extract<FillBoxType, "vented">;
  vM: VentedBoxModel;
  sM: null;
}

/** A sealed fill (stuffed): the closed-box model, no vented one. */
export interface FillSystemSealed extends FillSystemBase {
  boxType: Extract<FillBoxType, "sealed">;
  vM: null;
  sM: SealedBoxModel;
}

/** `fillSystem`'s result: check `boxType`, or `vM` or `sM`, and the other model's type follows. */
export type FillSystem = FillSystemVented | FillSystemSealed;

// ---- Speaker spec (lib/speaker) ----
//
// One model for any box (`SpeakerSpec`), for boxes in a fixed relationship (`StackSpec`) and for a placed space
// (`SpaceSpec`): docs/speaker-designer-plan.md, L1 and L4.
// Sizes are in inches, as the design pages have them, except a horn's segments, which keep the horn engine's
// (Hornresp's) cm and cm².

/** Each driver kind's catalog part: `SpeakerDriver.driverId` names a row of that kind's table (lib/data). */
export interface SpeakerDriverParts {
  sub: SubDriver;
  mid: MidDriver;
  compression: CompressionDriver;
  woofer: HifiWoofer;
  /** a dome, ribbon, compression tweeter, AMT or bullet (a super tweeter) */
  tweeter: HifiTweeter;
  coaxial: FillDriver;
}

/** A driver's kind, by id (`DRIVER_KIND`): the catalog table its id is in. */
export type DriverKind = keyof SpeakerDriverParts;

/**
 * A speaker's band, by id: any number of bands, each with its own name (`SpeakerBand.name`). The read adapters use
 * `SPEAKER_BAND`'s ids; the Speaker page gives a new band a generated one. Drivers name their bands by id.
 */
export type BandId = string;

/** A band the read adapters give, by id (`SPEAKER_BAND`, its name in `SPEAKER_BAND_NAMES`). */
export type AdapterBandId = keyof typeof SPEAKER_BAND;

/** Where a horn sits, by id (`HORN_PLACEMENT`): in the baffle, or freestanding on the box top. */
export type HornPlacement = (typeof HORN_PLACEMENT)[keyof typeof HORN_PLACEMENT];

/** A catalog horn on a driver (a compression driver, a Hi-fi tweeter on a waveguide): the horn's own datasheet. */
export interface HornAttachment {
  hornId: Horn["id"];
  placement: HornPlacement;
  /** what holds the driver on the lid; null where no mount applies (lib/pa/hornMount `takesHornMount`) */
  mount: HornMountId | null;
}

/** A point on a face, in: each use says where it is measured from. */
export interface FacePoint {
  xIn: number;
  yIn: number;
}

/** A panel a vent can be cut into (`PANEL`): the baffle, or the back. */
export type VentPanel = Extract<RadiatorPanel, "baffle" | "back">;

/**
 * Where a vent sits on its chamber, as a driver entry's position: its panel, and its group's center, `xIn` across from
 * the chamber's center line (+ toward the inside of a pair, seen from the front on the back panel too) and `yIn` up
 * from the chamber's bottom.
 */
export interface VentPosition extends FacePoint {
  panel: VentPanel;
}

/** What every driver entry has, whatever its kind. */
interface SpeakerDriverBase {
  count: number;
  /**
   * the group's center: on the baffle, `xIn` across from the center line (+ toward the inside of a pair) and `yIn` up
   * from the chamber's bottom; for a horn on the top, `yIn` back from the baffle's front
   */
  position: FacePoint;
  /** the bands that feed it: one, or a coaxial's two (its woofer's band, then its HF's) */
  bands: readonly BandId[];
  /** the catalog horn it drives; null for none (a cone, a dome, a coaxial, a ribbon on its own plate) */
  horn: HornAttachment | null;
}

/** One driver, or `count` alike at one spot, in a chamber; its id names a row of its kind's table. */
export type SpeakerDriver = {
  [K in DriverKind]: SpeakerDriverBase & { kind: K; driverId: SpeakerDriverParts[K]["id"] };
}[DriverKind];

/** Side ducts up the front edges of the baffle (the PA sub's `vslots` and `vslot1`): the throat and length of each. */
export interface SideDuctPort extends Pick<VentSpec, "throat" | "len" | "div"> {
  shape: (typeof PORT_SHAPE)["duct"];
  n: 1 | 2;
}

/**
 * Round tubes, with the PA sub's details where they are its tubes: `flared` ends (the PA tube rule: the flares, the
 * neighboring mouths, a wall facing the inner mouth, the sub driver's depth as the stop; lib/pa/tubes
 * subTubeEndCorrection), in the baffle's `corners` round a centered driver (`round4`) or in a row along the bottom.
 * Without `flared`, the Hi-fi round port rule: the tubes can then take a `position`, where the row sits (its center),
 * on the baffle or the back; absent, the Hi-fi rule's place, centered along the baffle's bottom (lib/hifi/boxLayout
 * roundPortSpots). Flared tubes keep the PA layout: their place is part of the PA tube rule.
 */
export type SpeakerRoundPort = RoundPort &
  (
    | { flared?: false; corners?: never; position?: VentPosition }
    | { flared: true; corners?: boolean; position?: never }
  );

/**
 * A slot, with the PA sub's letterbox details where it is one: `fins` dividers of the wall's thickness across it, its
 * mouth on the floor, running from the frame front, `folded` up the back wall when too long to run straight (the PA
 * slot rule: lib/pa/calc ventGeometry). Without `fins`, the Hi-fi slot rule.
 */
export interface SpeakerSlotPort extends SlotPort {
  fins?: number;
  folded?: boolean;
}

/**
 * A vented chamber's port: round tubes or slots (the Hi-fi kinds, with the PA's details where set), or side ducts.
 * `len` is the path length: a folded port is its path. A slot's `w` is its width; absent, the box sets it (the slot
 * runs the full width).
 */
export type SpeakerPort = SpeakerRoundPort | SpeakerSlotPort | SideDuctPort;

/**
 * A chamber's vent, by its kind (`VENT_KIND`). A vented chamber's `maxSpeedMs` is the most air speed its vent takes,
 * m/s (sine peak): the PA design's setting (more for flared tubes, as the PA takes them), the Hi-fi's or the fill's.
 */
export type ChamberVent =
  | { kind: Extract<HifiBoxKind, "sealed"> }
  | {
      kind: Extract<HifiBoxKind, "vented">;
      port: SpeakerPort;
      maxSpeedMs: PaDesignConfig["portMax"];
    }
  | {
      kind: Extract<HifiBoxKind, "radiator">;
      radiators: RadiatorSelection;
      /**
       * where the radiators sit (the stack's center), on the baffle or the back; absent: the Hi-fi rule's place,
       * stacked up the back from its bottom (lib/hifi/boxLayout radiatorSpots on `RADIATOR_PANEL`)
       */
      position?: VentPosition;
    };

/**
 * How a horn's drivers drive its path (`HORN_DRIVE`).
 * - Front: the cones' fronts at the throat (through the throat chamber), their rears into the chamber.
 * - Back: the fronts radiate from the baffle, the rears drive the throat through the throat chamber (a Lowther-style
 *   back-loaded horn).
 * - Tapped: the front and the rear each at a segment boundary, 0 the throat and `segments.length` the mouth.
 */
export type HornDrive =
  | { kind: (typeof HORN_DRIVE)["front"] }
  | { kind: (typeof HORN_DRIVE)["back"] }
  | { kind: (typeof HORN_DRIVE)["tapped"]; frontTap: number; rearTap: number };

/**
 * How a horn's path runs in the box (`HORN_PATH`). A folded path (a bass bin) has the same segments as a straight one;
 * its fold layout, for the cutlist and the 3D view, comes later (horn engine plan, phase 3).
 */
export type HornPath = (typeof HORN_PATH)[keyof typeof HORN_PATH];

/**
 * A horn built into the box: the horn engine's throat chamber, segments and vent offset (`HornDesign`). The chamber's
 * own net air and vent are the horn's rear chamber.
 */
export interface SpeakerHorn extends Pick<HornDesign, "throatChamber" | "segments" | "portOffset"> {
  drive: HornDrive;
  path: HornPath;
  /**
   * the mouth's center on the baffle, `xIn` across from the chamber's center line and `yIn` up from its bottom, as a
   * driver's position: a back-loaded horn's mouth is apart from the drivers on the baffle, and a folded path can end
   * anywhere on it. Absent: centered on the chamber's clear face.
   */
  mouthPosition?: FacePoint;
}

/** How a chamber's drivers meet the air (`CHAMBER_LOAD`): straight, or through a horn built into the box. */
export type ChamberLoad =
  | { kind: (typeof CHAMBER_LOAD)["direct"] }
  | { kind: (typeof CHAMBER_LOAD)["horn"]; horn: SpeakerHorn };

/** One air space of a cabinet: where it sits, its size and air, its vent, its load and its drivers. */
export interface SpeakerChamber {
  /** its lower-left corner in the cabinet's front view, in from the cabinet's lower-left */
  at: FacePoint;
  /**
   * its outside size as its own box. Two chambers that touch share one wall: the partition is the lower chamber's top
   * wall (or the left chamber's right wall), inside that chamber's size; the other chamber has no wall of its own
   * there (lib/speaker/chamberAir `chamberClearFace`).
   */
  dims: Dims3;
  /**
   * its net air, L, set for shapes the box models can't work out (a horn's rear chamber, the wedges beside a flare);
   * null: the models work it out from `dims`
   */
  netLiters: number | null;
  /**
   * how much more air the stuffing makes the box act like, %: the Hi-fi engine stuffs a sealed box 10%, the PA its
   * mids and the Fills page its sealed boxes 15%; 0 for none. The model applies it to every chamber alike (a horn's
   * rear chamber too).
   */
  stuffingPct: number;
  vent: ChamberVent;
  load: ChamberLoad;
  drivers: readonly SpeakerDriver[];
}

/** A cabinet's panels: the nominal size, the material and the exact thickness the models use. */
export interface SpeakerPanel {
  nominal: PanelNominal;
  material: PanelMaterial;
  thicknessIn: PaDesignConfig["wall"];
}

/** How a cabinet's shell is built, by id (`CABINET_CONSTRUCTION`, its name in `CABINET_CONSTRUCTION_NAMES`). */
export type CabinetConstruction = (typeof CABINET_CONSTRUCTION)[keyof typeof CABINET_CONSTRUCTION];

/** A cabinet's top shape, by id (`CABINET_TOP`). */
export type CabinetTop = (typeof CABINET_TOP)[keyof typeof CABINET_TOP];

/** Why an arched top is drawn and cut flat, by id (`ARCH_BLOCK`). */
export type ArchBlock = (typeof ARCH_BLOCK)[keyof typeof ARCH_BLOCK];

/**
 * A cabinet: its chambers, panels and shape, and its bracing as the PA boxes take it: the style (ribs, window braces or
 * both), how the back is fixed (glued or screwed), and the target every panel's first mode should clear.
 */
export interface SpeakerCabinet extends Required<Pick<PaDesignConfig, "backJoint">> {
  /** the bracing style, or none: the panels unbraced */
  braceStyle: SpeakerBraceStyle;
  chambers: readonly SpeakerChamber[];
  panel: SpeakerPanel;
  /** every panel's first mode should clear it, Hz: the PA boxes' PA_PANEL_TARGET_HZ by default (lib/pa/bracing) */
  braceTargetHz: number;
  /**
   * how the shell is built: the PA's frame, its baffle set back by `insetIn`, or the Hi-fi's flush box, its baffle over
   * the whole front
   */
  construction: CabinetConstruction;
  /**
   * the top's shape: flat, or arched, a semicircle the full width of the cabinet over its top chamber (the PA tower's,
   * lib/pa/tower `towerSpec`)
   */
  top: CabinetTop;
  /** how far the frame's baffle sits behind its front, in; 0 flush. A flush box has none (`baffleInsetIn`). */
  insetIn: PaDesignConfig["inset"];
  /** the baffle edges' roundover radius, in; 0 sharp */
  roundoverIn: HifiDesignState["roundoverIn"];
  /** the kick-back: the baffle tilted back so the axis points this far up, degrees */
  tiltDeg: NonNullable<HifiConfig["tiltDeg"]>;
  /**
   * the PA boxes' hardware (lib/pa/hardware): these handles, the input dish with its two jacks, and the horn's binding
   * posts on a chamber whose horn stands on its top; in each shell's lowest chamber. Null: none (the Hi-fi box).
   */
  hardware: BoxHandles | null;
}

/** A filter's alignment and slope: Butterworth or Linkwitz-Riley at 24 or 48 dB/oct, or first order (a capacitor). */
export type FilterType = HighpassType | typeof FIRST_ORDER_FILTER;

/** A filter: its corner, Hz, and its type. */
export interface BandFilter {
  hz: number;
  type: FilterType;
}

/**
 * A band of a speaker. Its filters are the box's own: the crossover inside the box and its protection (a subsonic).
 * A crossover to another box (the sub) is the stack's (`StackMember.crossover`).
 */
export interface SpeakerBand {
  id: BandId;
  /** what the user calls it: "Sub", "Low mid", "Horn" */
  name: string;
  highpass: BandFilter | null;
  lowpass: BandFilter | null;
  /**
   * against the speaker's other bands, dB: a pad (0 or less), or a DSP's gain where the Hi-fi level match lifts a tweeter
   * quieter than its woofer
   */
  levelDb: number;
  /**
   * active: its filters run in the front end and it has an amp channel of its own; passive: a network in the box, on
   * a channel it shares (`SpaceChannel.bands`), as a super tweeter on the HF channel through a capacitor
   */
  drive: HifiDrive;
  /**
   * the power of the amp channel that drives it, W into 8 Ω: its own channel's when active; when passive, the channel
   * it shares (the same figure as the band it shares it with). The limits read it (lib/speaker/speakerLimits).
   */
  ampW: SpaceAmp["watts"];
}

/** Any single box: its cabinet, drivers, bands and look. */
export interface SpeakerSpec {
  id: string;
  name: string;
  cabinet: SpeakerCabinet;
  bands: readonly SpeakerBand[];
  /**
   * the input range: the filters the front end puts ahead of the box on every band (the crossover to a sub). Not part
   * of the box; the Speaker page models the speaker with it (`speakerResponse`'s and `speakerLimits`' feed). In a stack,
   * the member's crossover takes its place (`StackMember.crossover`).
   */
  input: Pick<SpeakerBand, "highpass" | "lowpass">;
  look: Pick<PaDesignConfig, "cabFinish" | "baffleColor" | "hornColor">;
}

/** A spec's identity, as a read adapter takes it. */
export type SpecIdentity = Pick<SpeakerSpec, "id" | "name">;

/** A speaker read from one design, by id (`SPEAKER_PART`): it names the speaker's id and name. */
export type SpeakerPart = (typeof SPEAKER_PART)[keyof typeof SPEAKER_PART];

/** The PA design as the planner holds it: every field set (a save can lack the later ones). */
export type PaPlannerDesign = PaDesignConfig &
  Required<Pick<PaDesignConfig, "panel" | "hornMount" | "spacerH" | "hardware">>;

/**
 * Where a member stands in its stack, in: from the stack's origin (the middle of its base, at its front), or from the
 * member it stands on (an earlier one: its center line, its top and its front).
 */
export interface StackPose {
  /** across: its center line from the origin's (or the one under it), + to the right seen from the front */
  xIn: number;
  /** up: its bottom above the stack's base, or above the top of the member it stands on (a gap, a spacer, a stand) */
  yIn: number;
  /** back: its front behind the stack's front (or the front of the one under it) */
  zIn: number;
  /** the member it stands on, as an index into the stack's members (an earlier one); null: the stack's base */
  on: number | null;
  /**
   * its tilt in the stack, degrees, + up: turned about its bottom front edge (a top angled down on its sub), added to
   * its cabinet's kick-back (`SpeakerCabinet.tiltDeg`). What stands on it doesn't follow it.
   */
  pitchDeg: number;
}

/** One speaker in a stack: where it stands, and what the front end does to its feed. */
export interface StackMember {
  speakerId: SpeakerSpec["id"];
  pose: StackPose;
  /** a mirror image of the speaker (a tweeter offset to the other side) */
  mirror: boolean;
  /** the crossover between boxes on its feed (to the sub, to the tops): the speaker's input range in the stack */
  crossover: SpeakerSpec["input"];
  /** the front end's level, against the stack's other members, dB */
  levelDb: number;
  /** the front end's delay, ms, or the stack's own alignment (lib/speaker/stackResponse) */
  delayMs: number | typeof AUTO_DELAY;
}

/**
 * Speakers in a fixed relationship (a sub, a mid-bass box and a horn): their places, the crossovers between them, their
 * delays and levels. It says what each box needs; the Space assigns the hardware that does it.
 */
export interface StackSpec {
  id: string;
  name: string;
  members: readonly StackMember[];
  notes: string;
}

/** An amplifier in a space: its catalog model where one is picked, and its power per channel, W. */
export interface SpaceAmp {
  id: string;
  model: AmpId | null;
  watts: number;
}

/** One amp channel a placement takes: the member it feeds (0 for a speaker alone) and that member's bands. */
export interface SpaceChannel {
  amp: SpaceAmp["id"];
  channel: number;
  member: number;
  /** the bands it feeds: one active band, or every band of a passive network */
  bands: readonly BandId[];
}

/** What a space places, by id (`SPACE_ITEM`): a stack, or a speaker alone on its own input range. */
export type SpaceItemKind = (typeof SPACE_ITEM)[keyof typeof SPACE_ITEM];

/**
 * Where a placed stack or speaker points, degrees: its yaw on the floor from straight down the room (+ turns toward +x,
 * a toe-in or pan) and its pitch (+ up). The one aim model: a member's tilt in its stack (`StackPose.pitchDeg`) and its
 * cabinet's kick-back (`SpeakerCabinet.tiltDeg`) add to the pitch (lib/speaker/spaceLayout).
 */
export interface SpaceAim {
  yawDeg: number;
  pitchDeg: number;
}

/**
 * A stack or a speaker placed in a space: its spot on the floor (its base's front center, ft), the lift under it (a
 * plinth, a stand), its aim, a mirror image, what the front end does to its feed, and the amp channels it takes.
 */
export interface SpacePlacement extends FloorPoint {
  item:
    | { kind: typeof SPACE_ITEM.stack; id: StackSpec["id"] }
    | { kind: typeof SPACE_ITEM.speaker; id: SpeakerSpec["id"] };
  /** the gap under it, in: a plinth, a stand, or 0 */
  liftIn: number;
  aim: SpaceAim;
  mirror: boolean;
  /**
   * a left and right pair: the earlier placement (an index) this one is the mirror image of across the room's center
   * line; its item, spot, lift and aim follow that one's, x and yaw turned over, the image mirrored. Null: placed on its
   * own.
   */
  follows: number | null;
  /** the front end's level on its feed, against the space's other placements, dB (a fill under the mains) */
  levelDb: number;
  /** the front end's delay on its feed, ms (a fill waiting for the mains) */
  delayMs: number;
  channels: readonly SpaceChannel[];
}

/** How a front end processes, by id (`FRONT_END_KIND`): fixed analog cards, or a DSP. */
export type FrontEndKind = (typeof FRONT_END_KIND)[keyof typeof FRONT_END_KIND];

/** The processing ahead of the amps: the stacks' crossovers, delays and levels run in it, analog or digital. */
export interface SpaceFrontEnd {
  kind: FrontEndKind;
  /** the DSP unit (`DSP_UNITS`), where a digital front end names one */
  dspId: DspUnit["id"] | null;
}

/** Which part of a driver entry radiates, by id (`DRIVER_PART`): its cone or its HF section. */
export type DriverPart = (typeof DRIVER_PART)[keyof typeof DRIVER_PART];

/** The floor the space's level stats count: a rectangle, its center and its size, ft. */
export interface ListeningArea extends FloorPoint {
  widthFt: number;
  lengthFt: number;
}

/** Where a space plays: the room, the listener (a probe), the listening area and the level it should get. */
export interface SpaceVenue {
  room: CoverageRoom;
  listener: FloorPoint;
  /** the ear's height above the floor, ft: the map and the levels are worked out there */
  earFt: CoverageLayout["earFt"];
  area: ListeningArea;
  /**
   * the level the listening area's average should get, dB SPL, the same in every band: the space is turned down to it,
   * never past its limit
   */
  targetDb: CoverageLayout["targetDb"];
}

/** Stacks and speakers placed in a real space, with the hardware that drives them (docs/speaker-designer-plan.md, L4b). */
export interface SpaceSpec {
  id: string;
  name: string;
  placements: readonly SpacePlacement[];
  amps: readonly SpaceAmp[];
  /** null: none (passive speakers straight off the amps) */
  frontEnd: SpaceFrontEnd | null;
  venue: SpaceVenue;
}

/** One design read in all three layers (lib/speaker read adapters): its speakers, its stack, and its space. */
export interface DesignLayers {
  speakers: readonly SpeakerSpec[];
  stack: StackSpec;
  space: SpaceSpec;
}

/** Why a chamber has no horn-engine design yet, by id (`HORN_ENGINE_GAP`). */
export type HornEngineGap = (typeof HORN_ENGINE_GAP)[keyof typeof HORN_ENGINE_GAP];

/** A chamber as the horn engine takes it, or why it can't yet. */
export type HornDesignResult = { ok: true; design: HornDesign } | { ok: false; gap: HornEngineGap };

/** Why the speaker model leaves out a chamber or a driver (`SPEAKER_MODEL_GAP`, or the horn engine's gap). */
export type SpeakerModelGap =
  | (typeof SPEAKER_MODEL_GAP)[keyof typeof SPEAKER_MODEL_GAP]
  | HornEngineGap;

/** The filters ahead of a speaker on every band: its input range (in a stack, its member's crossover). */
export type SpeakerFeed = SpeakerSpec["input"];

/** One band of a speaker as the speaker model works it out: its drivers through its filters and level. */
export interface SpeakerBandResponse {
  id: BandId;
  curve: FrequencyPoint[];
  /** its pressure at each of the curve's frequencies, with its phase (a stack sums its members' bands with it) */
  pressure: Complex[];
  /** its passband level, dB: the mean of its curve where it is within 3 dB of its highest point */
  passbandDb: number;
}

/** One chamber as the speaker model works it out. */
export interface SpeakerChamberResponse {
  /** the air the box model takes, L: `SpeakerChamber.netLiters`, or worked out from the size */
  netLiters: number;
  /** the vent's or radiators' tuning, Hz; null when sealed or not modeled */
  fb: number | null;
  /** a sealed chamber's Qtc (its stuffing counted); null otherwise */
  qtc: number | null;
  /** what the model leaves out in this chamber, if anything */
  gaps: readonly SpeakerModelGap[];
  /**
   * its cones' drive at each of the response's frequencies, at `SPEAKER_RESPONSE_VOLTS` and before the band's filters;
   * null when its cones aren't modeled (or it has none). The limits scale it (lib/speaker/speakerLimits).
   */
  drive: ChamberDrivePoint[] | null;
}

/**
 * A chamber's cones at one frequency (sine peaks): each cone's excursion, mm, the vent's air speed, m/s, and the
 * radiators' travel, mm, where the box has a vent or radiators.
 */
export type ChamberDrivePoint = Pick<WooferPoint, "xmm"> & { vel?: number; prx?: number };

/**
 * A speaker's response (lib/speaker/speakerResponse `speakerResponse`): on axis at 1 m in half space, at
 * `SPEAKER_RESPONSE_VOLTS` on every band, the bands summed with their phase.
 */
export interface SpeakerResponse {
  sum: FrequencyPoint[];
  /** the bands a modeled driver feeds, in the spec's order */
  bands: SpeakerBandResponse[];
  /** one per chamber, in the spec's order */
  chambers: SpeakerChamberResponse[];
  /** what the model leaves out across the bands: a band (or the feed) whose filter corner isn't a positive frequency */
  gaps: readonly SpeakerModelGap[];
}

/** One frequency of a speaker at its limit: the level where the first limit gives out, dB at 1 m, and which limit. */
export type SpeakerMaxPoint = FrequencyPoint & { who: LimitId };

/**
 * One band at its limits (lib/speaker/speakerLimits): its drivers at the amp's full power, through the band's filters,
 * up to the first of cone travel, port air speed, radiator travel, the program rating (thermal) and the amp.
 */
export interface SpeakerBandLimits {
  id: BandId;
  /** the drivers' voltage with the amp at full power, V RMS: the amp's, through a passive band's pad */
  driveVolts: number;
  /** the band alone, a sine at each of the response's frequencies, at its first limit */
  max: SpeakerMaxPoint[];
  /**
   * the band's level for music, dB at 1 m: one drive for the whole band, set where the band first meets a limit
   * (`who`, at `whoHz`), on its passband level
   */
  musicDb: number;
  who: LimitId;
  whoHz: number;
}

/** A level against a limit at the amp's full power, before any limit acts: the peak and its frequency, and the limit. */
export interface LimitPeak {
  peak: number;
  hz: number;
  limit: number;
}

/**
 * One chamber's cones at the amp's full power through their band's filters (lib/speaker/speakerLimits): the cone's
 * excursion against Xmax, mm; the vent's air speed against its limit, m/s; the radiators' travel against theirs, mm;
 * and the drive's power against the cones' program rating, W.
 */
export interface SpeakerChamberLimits {
  band: BandId;
  excursion: LimitPeak;
  /** null without a vent */
  port: LimitPeak | null;
  /** null without radiators */
  radiator: LimitPeak | null;
  /** the drive's power into 8 Ω, W, and the cones' program rating (2 × AES), W */
  driveW: number;
  programW: number;
}

/** A datasheet driver (a compression driver, a tweeter, a coaxial's HF) at its power limit. */
export interface SpeakerDriverPower {
  band: BandId;
  driver: SpeakerDriver;
  /** the power it takes, W, into its impedance `imp`, Ω: the amp's or its program rating (`who`), derated below its rating's frequency */
  watts: number;
  imp: number;
  who: Extract<LimitId, "amp" | "thermal">;
  /** the program rating's derating at the band's highpass (1 = none) */
  derate: number;
}

/** A speaker at its limits (lib/speaker/speakerLimits `speakerLimits`). */
export interface SpeakerLimits {
  /** the bands the response models, in its order */
  bands: SpeakerBandLimits[];
  /** one per chamber, in the spec's order; null where its cones aren't modeled */
  chambers: (SpeakerChamberLimits | null)[];
  /** each datasheet driver with a published HF section, in the spec's order */
  drivers: SpeakerDriverPower[];
  /**
   * the speaker with one input for every band, at each frequency where the first band meets its first limit, and which
   * band; empty with no modeled band
   */
  sum: (Omit<SpeakerMaxPoint, "who"> & {
    /** the first limit; outside the input range (the feed below −6 dB), the input range itself when a ceiling on the whole drive sets it */
    who: LimitId | typeof INPUT_RANGE_LIMIT;
    band: BandId;
  })[];
  /** the speaker's level for music, dB at 1 m: its passband level where the first band reaches its music limit */
  musicDb: number | null;
  /** the band that sets it */
  band: BandId | null;
}

/**
 * One member of a stack as the stack model works it out (lib/speaker/stackResponse): its speaker fed through the
 * member's crossover, and the member in the stack at the listening point.
 */
export interface StackMemberResponse {
  /** the speaker as the stack feeds it: its input range is the member's crossover */
  speaker: SpeakerSpec;
  /** the speaker alone, on its own axis at 1 m, through its crossover */
  response: SpeakerResponse;
  /**
   * the member in the stack: with its level and delay, and its bands' paths to the listening point, moved to 1 m (the
   * level at the listening distance plus the spreading loss to it)
   */
  curve: FrequencyPoint[];
  pressure: Complex[];
  /**
   * the delay it plays with, ms: its own, or the stack's alignment worked out; all moved up together where an auto
   * member has to play early
   */
  delayMs: number;
}

/** A stack's response at its listening point, moved to 1 m (lib/speaker/stackResponse `stackResponse`). */
export interface StackResponse {
  sum: FrequencyPoint[];
  /** one per member, in the stack's order; null where the speakers given lack its speaker */
  members: (StackMemberResponse | null)[];
  /** the listening point's height above the stack's base, in: level with the highest band's center */
  listenHeightIn: number;
}

/** A stack at its limits with one input (lib/speaker/stackResponse `stackLimits`). */
export interface StackLimits {
  /**
   * the stack at each frequency where the first member meets its first limit, moved to 1 m as the response; which
   * member, which of its bands and which limit; empty with no modeled member
   */
  sum: (FrequencyPoint & {
    who: SpeakerLimits["sum"][number]["who"];
    member: number;
    band: BandId;
  })[];
  /**
   * one per member: its limits on its crossover, worked out with the crossover ahead of its amps (`stackCrossover`),
   * and the member at the stack's limit
   */
  members: ({ limits: SpeakerLimits; atLimit: FrequencyPoint[] } | null)[];
  /** the stack's level for music, dB at 1 m: its passband level where the first band of a member reaches its music limit */
  musicDb: number | null;
  /** the member and the band that set it */
  member: number | null;
  band: BandId | null;
}

// ---- Bracing ----

/** A horn mount's id (`HORN_MOUNT_NAMES` holds the name it shows). */
export type HornMountId = keyof typeof HORN_MOUNT_NAMES;
/** A bracing style's id (`BRACE_STYLE_NAMES` holds the name it shows). */
export type BraceStyleId = keyof typeof BRACE_STYLE_NAMES;
/** A Speaker cabinet's bracing: a style, or none (`NO_BRACING`). */
export type SpeakerBraceStyle = keyof typeof SPEAKER_BRACE_STYLE_NAMES;
/** A box panel the bracing rule reads, by id (`BRACE_PANEL_NAMES` holds the name it shows). */
export type BracePanelId = keyof typeof BRACE_PANEL_NAMES;
/** A box axis, from the inside corner: x across, y up, z back from the baffle. */
export type BoxAxis = keyof typeof BOX_AXIS_NAMES;

/** A panel's stock as the plate model reads it: thickness (in), weight (lb/ft²) and bending moduli (Pa). */
export interface PlateStock {
  t: number;
  lbPerSqFt: number;
  /** bending modulus along the face grain (the stiffer way), Pa */
  eStrong: number;
  /** bending modulus across the face grain, Pa */
  eWeak: number;
  /** Poisson's ratio for the plate's bending stiffness */
  nu: number;
}

/** How a box's back panel is fixed: glued like the other panels, or screwed on (`BACK_JOINT_NAMES` holds the names). */
export type BackJointId = keyof typeof BACK_JOINT_NAMES;
/** A panel's edge: across its u or v axis, at its start (0) or its end (1). */
export type PanelEdge = "u0" | "u1" | "v0" | "v1";
/**
 * What holds a panel's edge against turning: the panel glued to it there (its stock, and its span away from the joint,
 * in), or null where nothing does (a screwed joint, an open slot mouth): the edge is then hinged.
 */
export type EdgeHold = { stock: PlateStock; span: number } | null;
/**
 * A round hole through a panel (a driver's cutout): its center and radius, in from the panel's corner (in), and the
 * weight hung round its edge (the driver's, kg; absent: none).
 */
export interface PlateHole {
  cx: number;
  cy: number;
  r: number;
  ringKg?: number;
}

/** One panel for the bracing rule: its two in-plane axes and spans (in), its stock, and the supports it already has. */
export interface BracePanel {
  id: BracePanelId;
  u: BoxAxis;
  v: BoxAxis;
  spanU: number;
  spanV: number;
  /** where the panel's own edge sits on the box axes (the baffle starts above a bottom slot), in */
  offU: number;
  offV: number;
  stock: PlateStock;
  /** whether ribs can go on it (not the baffle: a rib can't cross the driver) */
  ribs: boolean;
  /** the axes its ribs may divide (behind a bottom slot only those running with the air); absent: both */
  ribAcross?: readonly BoxAxis[];
  /** the box's own parts that already hold it in a line across each axis (the vent shelf, duct walls), in from its edge */
  fixedU: number[];
  fixedV: number[];
  /**
   * the lines a rib may stop on to clear the vent (its duct parts, however short), across each axis, in from its edge;
   * the supports among them are in `fixedU` / `fixedV` too
   */
  stopU: number[];
  stopV: number[];
  /** what holds each edge against turning; absent: every edge hinged */
  edges?: Record<PanelEdge, EdgeHold>;
  /** screwed on (a removable back): its edges are hinged, and the window braces' rails are screwed to it, unglued */
  loose?: boolean;
  /** the driver's cutout, in panel coordinates (the baffle) */
  hole?: PlateHole;
  /**
   * the duct's fins glued along it over its whole run (a bottom slot's), in from its edge across `across`, `height` tall:
   * supports (in `fixedU` / `fixedV` too) that also hold the end of a rib meeting one in a corner; the other panels'
   * ribs across that axis line up on them where they are as many (C braces)
   */
  fins?: { across: BoxAxis; at: number[]; height: number };
}

/**
 * Ribs on one panel: they divide its `across` axis and sit at `at` (in from its edge); each runs along the panel's other
 * axis from `from` (in from that edge) for `len`. A panel's ribs of different lengths are separate entries.
 */
export interface PanelRibs {
  panel: BracePanelId;
  across: BoxAxis;
  at: number[];
  from: number;
  len: number;
  /** how far they stand off the panel, in (RIB_DEPTHS_IN) */
  depth: number;
}

/** A box-shaped region inside a box, in from its inside corner on each axis (x across, y up, z back from the baffle). */
export type BoxRegion = Record<BoxAxis, readonly [number, number]>;
/**
 * What no brace or rib may enter: the driver's basket and magnet behind the baffle (with its clearance), and the
 * vent's own parts and the air they enclose (ducts, tubes), and the hardware's recesses where the box has them.
 */
export interface BoxKeepOut {
  /** the driver's basket and magnet, as boxes stepping in from the cutout to the motor */
  driver: readonly BoxRegion[];
  vent: readonly BoxRegion[];
  /** the hardware's recesses (handles, input dish, horn posts), each as its fit check takes it (PlacedHardware fit) */
  hardware?: readonly BoxRegion[];
}

/** A strength check's load (`STRENGTH_LOAD_NAMES` holds the words for it). */
export type StrengthLoadId = keyof typeof STRENGTH_LOAD_NAMES;
/** A panel's worst bending stress with its braces and ribs, under the load nearest its limit, Pa (lib/strength). */
export interface PanelStrength {
  load: StrengthLoadId;
  stressPa: number;
  limitPa: number;
}
/**
 * A panel's first plate resonance with its own parts only, and with the braces and ribs, Hz; and its strength where the
 * rule checks it (the PA boxes).
 */
export interface PanelResonance {
  id: BracePanelId;
  bareHz: number;
  hz: number;
  strength?: PanelStrength;
}

/** The bracing rule's choice in counts, as it works: the window braces across each axis and the ribs on each panel. */
export interface BracePlan {
  windows: Record<BoxAxis, number>;
  ribs: Partial<Record<BracePanelId, { across: BoxAxis; n: number; depth: number }>>;
}

/** What the bracing rule picked for a box: the window braces on each axis, the ribs, the resonances and the wood. */
export interface BoxBracing {
  style: BraceStyleId;
  targetHz: number;
  /** each axis' window braces, in from the box's inside corner along it */
  windows: Record<BoxAxis, number[]>;
  /**
   * The window braces across x whose plane crosses the driver (`at`, as in `windows.x`): their front rail is left out
   * over `y` (up from the bottom), so the frame opens to the baffle round the basket and magnet. They hold the top,
   * bottom and back, not the baffle. Null when none does.
   */
  notch: { at: number[]; y: readonly [number, number] } | null;
  ribs: PanelRibs[];
  panels: PanelResonance[];
  /** the braces' and ribs' wood, in³ (window braces count their rails only) */
  windowIn3: number;
  ribIn3: number;
  /** whether every panel clears the target */
  meets: boolean;
}

// ---- Cabinet hardware ----

/**
 * A part bought for a PA box (data/catalog/cabinet-hardware): its Parts Express price and listing, the hole it takes
 * through the panel and the flange round it (w × h as the listing gives them; in), which of the two runs up the panel
 * as it is mounted (`upright`), how deep its recess reaches from the panel's face (in) and its weight (lb). A figure the
 * listing doesn't give is null; `note` names it.
 */
export interface CabinetPart {
  id: string;
  name: string;
  /** the Parts Express part number */
  sku: string;
  /** US dollars, each */
  price: number;
  /** the vendor, part number and month the price was seen */
  src: string;
  url: string;
  /** null: it mounts in another part (a jack in the dish) */
  cutout: { w: number; h: number } | null;
  flange: { w: number; h: number } | null;
  /**
   * which listed dimension, cutout's and flange's alike, runs up the panel as mounted: vertical on a side or the back,
   * front to back on the lid; the other runs across (lib/pa/hardware mountedSize)
   */
  upright: "w" | "h";
  depthIn: number | null;
  lb: number | null;
  /** the screw pattern, where listed */
  screws: string | null;
  note: string;
}
/**
 * A part's shape from its CAD model, as the 3D view draws it (data/meshes, generated by build/step-mesh.mjs):
 * integer vertex positions in `unitMm` steps on the model's own axes, three per vertex, and triangles as three vertex
 * indices each; `min` and `max` are the model's bounds, mm.
 */
export interface PartMesh {
  unitMm: number;
  min: readonly [number, number, number];
  max: readonly [number, number, number];
  positions: readonly number[];
  indices: readonly number[];
}
/**
 * A cabinet part's mesh (build/handle-mesh.mjs), on its axes: x across the part, y up the panel as mounted, z out of
 * the panel, the panel's face at z = 0.
 */
export interface HardwareMesh extends PartMesh {
  /** the recess body's outline under the flange (x and y), mm: the hole the 3D view opens in the panel */
  hole: { min: readonly [number, number]; max: readonly [number, number] };
}
/** A handle model's id (data/catalog/cabinet-hardware HANDLES). */
export type HandleId = (typeof HANDLES)[number]["id"];
/** What a box's handle setting holds: a handle model, or none. */
export type HandleChoice = HandleId | typeof NO_HANDLES;
/** The boxes that take hardware: the sub and the mid (top) box. */
export type HardwareBoxId = Extract<NamedCutBoxId, "sub" | "mid">;
/**
 * A box's handles: the model (two, one each side) and how far they sit from the preset, the box's center of gravity:
 * up (in) and back toward the rear (in).
 */
export interface BoxHandles {
  model: HandleChoice;
  upIn: number;
  backIn: number;
}
/** Each box's handles; the input dish and the horn's posts have fixed places (lib/pa/hardware). */
export type PaHardware = Record<HardwareBoxId, BoxHandles>;
/** What a placed part is (`HARDWARE_KIND_NAMES` words each). */
export type HardwareKind = keyof typeof HARDWARE_KIND_NAMES;
/** What a part can run into (`HARDWARE_OBSTACLE_NAMES` words each). */
export type HardwareObstacle = keyof typeof HARDWARE_OBSTACLE_NAMES;
/** The panels a part goes on. */
export type HardwarePanel = Extract<BracePanelId, "sideL" | "sideR" | "back" | "top">;
/**
 * A part on a box: its panel, its cutout's center on the panel's outside face (`u` along it, `v` up it, in from the
 * box's outside edges: sides back from the front and up from the bottom, the back across from the left and up, the top
 * across from the left and back from the front), the room its recess takes inside (box axes, as BoxRegion) and its liters.
 */
export interface PlacedHardware {
  kind: HardwareKind;
  part: CabinetPart;
  panel: HardwarePanel;
  u: number;
  v: number;
  recess: BoxRegion;
  /** the room the fit check takes behind the panel: the recess, at least a hole's depth (and the posts' assumed cup) */
  fit: BoxRegion;
  liters: number;
  /** what it runs into; empty when it fits */
  hits: HardwareObstacle[];
}
/** A weight inside a box for its center of gravity (lb), at `y` up from its bottom and `z` back from its front (in). */
export interface CogMass {
  lb: number;
  y: number;
  z: number;
}
/** A box's hardware as placed: each part, their recesses' liters, weight (lb) and price ($), every part bought. */
export interface BoxHardwarePlan {
  box: HardwareBoxId;
  parts: PlacedHardware[];
  liters: number;
  lb: number;
  price: number;
  /** each part bought, with its count, for the totals */
  bought: { part: CabinetPart; qty: number }[];
}

// ---- Cutlist ----

/** A cutlist part's stable id (`CUT_PART_NAMES` holds the name it shows). */
export type CutPartId = keyof typeof CUT_PART_NAMES;
/** A named box a cutlist part belongs to, by id (`CUT_BOX_NAMES` holds the name it shows). */
export type NamedCutBoxId = keyof typeof CUT_BOX_NAMES;
/** A Speaker-page chamber's cutlist box, by its place in the cabinet (`chamberCutBox`: "chamber1", "chamber2" …). */
export type ChamberCutBoxId = `chamber${number}`;
/** The box a cutlist part belongs to: a named one, or a Speaker-page chamber (`cutBoxName` gives the name it shows). */
export type CutBoxId = NamedCutBoxId | ChamberCutBoxId;

/** Which of a part's dimensions runs along the grain (the sheet's length): `a`, `b`, or either. */
export type GrainDir = "a" | "b" | "any";
/** The panels whose grain can be set; every other part takes either direction. */
export type GrainPanel = Extract<CutPartId, "side" | "topBottom" | "baffle" | "back">;
/** The grain direction of each settable panel. */
export type GrainSettings = Record<GrainPanel, GrainDir>;
/** Grain presets: wrap (sides vertical, top/bottom across, baffle and back vertical), horizontal, or none (MDF). */
export type GrainPreset = "wrap" | "horizontal" | "none";
/** How sheets are cut: whatever gives the fewest sheets, or full-length rips before any crosscut (table saw). */
export type CutStyle = "sheets" | "rips";
/** Which offcut the least-full sheet keeps: a full-length strip or a full-width panel. */
export type OffcutShape = "strip" | "panel";

/** One line of the cutlist: a part of a box, cut `qty` times from `t`-inch ply, `a` by `b` inches. */
export interface CutPart {
  box: CutBoxId;
  part: CutPartId;
  qty: number;
  a: number;
  b: number;
  t: number;
  note: string;
  /** which dimension runs along the grain; absent means either */
  grain?: GrainDir;
  /** a waterfall strip: the panels' lengths along `b`, in cut order */
  pieces?: number[];
}

/** What a bought part is, by id (`PURCHASED_PART_NAMES` holds the name the cutlist shows). */
export type PurchasedPartKind = keyof typeof PURCHASED_PART_NAMES;

/** A part bought for a speaker, as the Cutlist page's purchased parts table and its CSV list it. */
export interface PurchasedPart {
  kind: PurchasedPartKind;
  /** the maker and model, as the catalog names it */
  model: string;
  count: number;
  /** US dollars each; null where no US vendor price is known */
  unit: number | null;
  /** the US vendor the price comes from; null where none is known */
  vendor: string | null;
}

/** What the cutlist needs for a sub and mid pair. */
export interface CutPartsConfig {
  sub: SubDriver;
  mid: MidDriver;
  subBox: Dims3;
  midDims: Dims3;
  wall: number;
  inset: number;
  joint: CornerJoint;
  portStyle: PortStyle;
  cVent: VentSpec;
  layout: PaLayout;
  /** absent: the plywood's default (`defaultBraceStyle`) */
  braceStyle?: BraceStyleId;
  /** absent: screwed (`DEFAULT_BACK_JOINT`) */
  backJoint?: BackJointId;
  /** the sub box's parts only (its volume reads no more): the mid box is left out */
  subOnly?: boolean;
  /** the sub's braces and ribs left out (an optimizer's search counts their wood by estimate instead) */
  noBraces?: boolean;
  /** each box's handles and plates, for the panels' cutout notes; absent: none */
  hardware?: PaHardware;
  /** the tower's horn, which sets its cabinet's height and baffle (lib/pa/tower `towerSpec`); the tower needs it */
  horn?: TowerHorn;
}

/** The panel a Hi-fi box's passive radiators are cut into. */
export type RadiatorPanel = Extract<CutPartId, "baffle" | "back" | "side">;

/** What the Hi-fi cutlist needs: the model's config, the drivers (the tweeter with its waveguide), the joint and the radiators' panel. */
export interface HifiCutPartsConfig {
  cfg: Pick<
    HifiConfig,
    "box" | "dim" | "wall" | "port" | "pr" | "guide" | "roundoverIn" | "tweeterOffsetIn"
  >;
  woofer: HifiWoofer;
  tweeter: HifiTweeter;
  joint: CornerJoint;
  prPanel: RadiatorPanel;
}

/** How the cutlist lays parts on sheets: sheet and stack count, saw kerf and edge trim (inches), grain, waterfall and offcut. */
export interface CutlistSettings {
  sheet: PlywoodSheetKind;
  stacks: number;
  kerf: number;
  /** squared off each factory edge, inches */
  trim: number;
  grain: GrainSettings;
  /** cut each box's sides and top as one side-top-side strip so the grain runs over the top corners */
  waterfall: boolean;
  joint: CornerJoint;
  offcut: OffcutShape;
  cuts: CutStyle;
}

/** The cutlist choices a design saves with itself. */
export type CutlistChoices = Pick<
  CutlistSettings,
  "kerf" | "trim" | "grain" | "waterfall" | "offcut" | "cuts"
>;

/** What a packed rectangle needs: its size and, optionally, which dimension must run along the sheet's length. */
export interface PackRect {
  a: number;
  b: number;
  grain?: GrainDir;
}

/**
 * A part laid on a sheet: its position and the size it was placed at (rotated if need be). `y` and `h` run along the
 * sheet's length, which is the grain; `crossed` marks a grain-locked part that only fit across the grain.
 */
export type PlacedPart<R = CutPart> = R & {
  x: number;
  y: number;
  w: number;
  h: number;
  crossed?: boolean;
};

/** A sheet of ply with the parts on it. */
export interface PackedSheet<R = CutPart> {
  items: PlacedPart<R>[];
}

export interface PackedSheets<R = CutPart> {
  sheets: PackedSheet<R>[];
  /** parts too big for the sheet in either direction */
  tooBig: R[];
}

/** The free piece the least-full sheet keeps, inches: `w` across the sheet, `h` along it, from (`x`, `y`). */
export interface Offcut {
  sheet: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The big cuts on sheets: full-length rips, full-width crosscuts, and the widest piece crosscut (inches). */
export interface CutStats {
  rips: number;
  crosscuts: number;
  widestCrosscut: number;
}

/** One ply thickness laid out: its sheets, parts that don't fit, the offcut kept and the cuts. */
export interface CutlistGroup extends PackedSheets {
  t: number;
  offcut: Offcut | null;
  cuts: CutStats;
  /** with rip-first cutting, the sheets the layout would need without it; null otherwise */
  fewestSheets: number | null;
}

/** What the cutlist worker takes: one stack's parts and the settings; `countsOnly` skips the offcut and rip-first comparison. */
export interface CutlistRequest {
  parts: CutPart[];
  settings: CutlistSettings;
  countsOnly?: boolean;
}

/** The cutlist laid out for the given settings. */
export interface CutlistLayout {
  /** the table's rows, per stack, after waterfall strips replace their panels */
  parts: CutPart[];
  /** parts left off the sheets: cut them from offcuts */
  fromOffcut: CutPart[];
  groups: CutlistGroup[];
  /** waterfall strips that didn't fit, and why */
  notes: string[];
}

// ---- Warning chips (lib/pa/chips) ----

export type ChipSeverity = "ok" | "warn" | "bad";
/** The sections that carry checks: the PA stack's sub, mid and horn, the fills, the Hi-fi speaker and the Speaker page. */
export type ChipSection = keyof typeof CHIP_IDS;
/** A check's stable id (`CHIP_IDS`), of one section or of any. */
export type ChipId<S extends ChipSection = ChipSection> = (typeof CHIP_IDS)[S][number];
/** A check on a design: a severity, a short title, a sentence of detail and the check's id (code matches the id, never the words). */
export type Chip<I extends ChipId = ChipId> = [
  severity: ChipSeverity,
  title: string,
  detail: string,
  id: I,
];

export interface SubChipsInput {
  subSize: SubSize;
  /** the driver's mounting depth, in, where its datasheet gives it (the tubes' elbows route behind it) */
  subDepthIn: SubDriver["depthIn"];
  subBox: Dims3;
  portStyle: PortStyle;
  cVent: VentSpec;
  /** plywood thickness */
  PT: number;
  inset: PaDesignConfig["inset"];
  subLbLoaded: number;
  lim: Pick<SubLimits, "who" | "W">;
  /** frequency of the peak excursion, Hz */
  peakXF: number;
  aes: number;
  ampW: number;
}

export interface MidChipsInput {
  midSize: MidSize;
  midDims: Dims3;
  Qtc: number;
  f3: number;
  peakX: number;
  xoLo: number;
  smallerBoxNetL: MidSystemBase["smallerBoxNetL"];
  /** the tower's mid chamber: the sub's footprint sets it */
  isTower: boolean;
  ts: Pick<ThieleSmall, "Xmax" | "aes">;
  /** amp volts, the volts the driver can use, and the thermal limit in volts */
  V: number;
  useV: number;
  vTherm: number;
  mAmpW: number;
  /** the sub at its music limit at the crossover, dB; null where the sub has no model */
  subMusicAtXo: number | null;
  /** how far the mid band's level sits below the sub's (the music balance), dB */
  midBelowSubDb: number;
  /** the mid's own limit at the crossover; null when `subMusicAtXo` is */
  midAtXo: Pick<PaMaxPoint, "spl" | "who"> | null;
}

export interface HornChipsInput {
  hf: Pick<CompressionHf, "minXo" | "aes" | "aesXo">;
  hz: Partial<Pick<HornHf, "minXo" | "lowHz" | "covH">>;
  horn: Pick<Horn, "name"> & { size: Pick<Dims3, "w"> };
  xoHi: number;
  hornModel: Pick<HornResponse, "who" | "pAmp" | "imp" | "pProg" | "derate">;
  hfAmpW: number;
  /** the mid at its limit at the horn crossover, dB; null where the mid has no model */
  midAtXoHi: number | null;
  /** how far the horn band's level sits below the mid's (the music balance), dB */
  hornBelowMidDb: number;
  /** the horn's level at the crossover, dB; null where the horn has no model */
  hornAtXo: number | null;
  /** the mid's beamwidth at the crossover in degrees, null where it has no model */
  midBeam: number | null;
  /** the horn's pattern-control frequency in Hz, null where its coverage isn't known */
  fK: number | null;
}

export interface FillChipsInput {
  drv: Pick<FillDriver, "size">;
  dim: Dims2;
  /** the vented box's tuning, or null for a sealed box */
  Fb: number | null;
  /** the sealed box's Qtc, or null for a vented box */
  Qtc: number | null;
  hp: number;
  hpOrder: FillSystemConfig["hpOrder"];
  portLimited: boolean;
  portMax: number;
  f3: number;
  hf: Pick<FillHf, "aes"> | null;
  hfLimW: number | null;
  ampW: number;
  pad: number;
}

// ---- PA dispersion (lib/pa/dispersion) ----

/** Where a driver sits in the stack, in inches above the floor, and its cone area in cm². */
export interface StackDriver {
  zIn: number;
  Sd: number;
}

/** The stack the dispersion model sums: sub (optional), mid and horn, the horn's coverage in degrees and mouth size in inches. */
export interface PaStackGeometry {
  sub: StackDriver | null;
  mid: StackDriver;
  horn: { zIn: number; covH: number; covV: number; wIn: number; hIn: number };
  xoLo: number;
  xoHi: number;
  /** each crossover's Linkwitz-Riley order (4 = LR24, 8 = LR48) */
  orderLo: CrossoverOrder;
  orderHi: CrossoverOrder;
}

// ---- coverage map (lib/pa/coverage) ----

/** A side of the room. front: the wall behind the stacks. */
export type RoomSide = "front" | "back" | "left" | "right";

/** A surface the room's material is set for: the four sides and the ceiling (the floor is hard, or the crowd). */
export type RoomSurface = RoomSide | "ceiling";

/** What a side or the ceiling is made of (lib/pa/roomAcoustics has each one's absorption); "open" reflects nothing. */
export type RoomMaterial = "concrete" | "drywall" | "wood" | "glass" | "curtain" | "open";

/** A value in each octave band the absorption tables give, 125 Hz–4 kHz (`OCTAVE_HZ` in data/acoustics). */
export type OctaveRow = readonly [number, number, number, number, number, number];

/** The dance floor: empty (a hard floor), or full of people, who absorb the top end of the floor bounce. */
export type FloorCrowd = "empty" | "full";

/** The room the map covers, in feet: a rectangular box, each side and the ceiling of its own material. */
export interface CoverageRoom {
  widthFt: number;
  lengthFt: number;
  /** floor to ceiling */
  ceilingFt: number;
  materials: Record<RoomSurface, RoomMaterial>;
  crowd: FloorCrowd;
  /** no walls or ceiling at all, and a softer ground */
  outdoors: boolean;
}

/** A spot on the floor in feet: x across from the center line, y down the room from the front wall. */
export interface FloorPoint {
  x: number;
  y: number;
}

/** A box on the floor, and its aim in degrees from straight down the room (+ turns toward +x). */
export interface FloorPlacement extends FloorPoint {
  aim: number;
}

/** A box the map draws and sums: a stack, or one of the center pair of subs. */
export interface CoverageBox extends FloorPlacement {
  kind: "stack" | "sub";
  label: string;
}

/** What the map averages: a named band, or one frequency (`freqHz`) summed with phase. */
export type CoverageBand = "sub" | "kick" | "mid" | "high" | "one";

/**
 * Where the coverage map's target level is measured: at the listener, as the audience's average (the floor the stats
 * count), or 1 m in front of the stacks.
 */
export type CoverageLevelRef = "listener" | "audience" | "stacks";

/** The coverage page's old level setting, read only from layouts saved before `targetDb` and `levelRef`. */
export type CoverageLevelMode = "limit" | "listener";

/** The subs in their stacks, both together in the middle, or one sub alone in the middle. */
export type SubPlacement = "stacks" | "center" | "single";

/** The coverage page's layout: room, where the stacks (and subs) stand, the listener, the band. */
export interface CoverageLayout {
  room: CoverageRoom;
  stacks: [left: FloorPlacement, right: FloorPlacement];
  subs: SubPlacement;
  /** where the center subs stand (the pair's midpoint, or the one sub), used when `subs` is "center" or "single" */
  cluster: FloorPoint;
  /** move and aim the stacks as a mirror image of each other */
  mirror: boolean;
  band: CoverageBand;
  freqHz: number;
  /** the target level in the sub band, dB SPL (the other bands follow the music balance) */
  targetDb: number;
  /** where the target is measured: the system is turned down until it gets the target there, never past its limit */
  levelRef: CoverageLevelRef;
  earFt: number;
  listener: FloorPoint;
}

/**
 * Each band's output at 1 m on axis, through its crossover, dB SPL against frequency: the planner's curves. The sub's
 * and mid's carry their own phase (the box's, and the sub's highpass's); the crossovers' phase comes from the stack.
 */
export interface CoverageLevels {
  sub: PhasePoint[] | null;
  mid: PhasePoint[];
  horn: FrequencyPoint[];
}

/** The planner's music balance: its crossovers, and how much less the mid band needs than the sub and the horn than the mid. */
export type MusicBalance = Pick<PaDesignConfig, "xoLo" | "xoHi" | "tilt" | "hfTilt">;

/** Each band's level after balancing, and how far each was turned down to get there, dB (0 or less). */
export interface BalancedLevels {
  levels: CoverageLevels;
  pads: Record<"sub" | "mid" | "horn", number>;
}

/** The stack the map places: the dispersion model's stack, its footprint and the mid box's width, inches. */
export interface CoverageStack extends PaStackGeometry {
  footprint: Pick<Dims3, "w" | "d">;
  /** the mid box's width, for its baffle step (the tower's is the sub's footprint) */
  midW: Dims3["w"];
  /** the sub's DSP delay against the tops, ms (negative: the tops wait) */
  subDelayMs: number;
}

/** Level across the floor: `cols` × `rows` cells, row by row from the front wall, dB SPL. */
export interface CoverageGrid {
  cols: number;
  rows: number;
  db: Float32Array;
}

/**
 * A grid as the map draws it: the room it covers and the target it is compared against, both as of the request it was
 * computed for, so an older grid still on show while the next one computes stays consistent with itself.
 */
export interface CoverageGridView {
  grid: CoverageGrid;
  room: Pick<CoverageRoom, "widthFt" | "lengthFt">;
  /** what a grid level is compared against: the grid's band target less the gain (the grid is at the limit), dB */
  target: number;
  /** the system's gain for this grid, dB, added to a grid level for the absolute level */
  gain: number;
  /** the level reference's level at the limit for this grid, dB (null when it can't be worked out) */
  atLimit: number | null;
}

/** What the floor map's worker computes from: the stack and its levels, where the boxes stand, the band, the grid size. */
export interface CoverageRequest {
  stack: CoverageStack;
  levels: CoverageLevels;
  layout: Pick<
    CoverageLayout,
    "room" | "stacks" | "subs" | "cluster" | "band" | "freqHz" | "earFt"
  >;
  cols: number;
}

/** How much of the floor reaches the target, leaving out the space right in front of the boxes. */
export interface CoverageStats {
  /** share of the floor at or above target − 3 dB, and − 6 dB, 0–1 */
  within3: number;
  within6: number;
  /** level spread between the 10th and 90th percentile, dB */
  spread: number;
}

// ---- PA optimizer (lib/pa/optimize) ----

/** The goals, as the planner's buttons name them. */
export type PaGoal = "cheaper" | "lighter" | "lower" | "louder";
/** The room sizes the optimizer sets its output target from: square feet, or outdoors. */
export type PaRoom = 500 | 750 | 1000 | "outdoor";

/** The optimizer locks that are on/off switches (a box dimension has its own mode: `subDim`, `midDim`). */
export type PaLockKey =
  | "sub"
  | "mid"
  | "cd"
  | "horn"
  | "vent"
  | "hpf"
  | "xoLo"
  | "xoHi"
  | "ampW"
  | "mAmpW"
  | "hfAmpW";

export interface PaOptimizerLocks extends Partial<Record<PaLockKey, boolean>> {
  subDim?: Partial<Record<keyof Dims3, DimensionLockMode>>;
  midDim?: Partial<Record<keyof Dims3, DimensionLockMode>>;
}

/** The PA optimizer locks as the page holds them. */
export type PaPlannerLocks = OptimizerLocks<PaLockKey, "subDim" | "midDim">;

/** The optimizer's inputs on the page: the room, the heaviest box and the budget, and the goals in tap order. */
export interface PaOptimizerInputState {
  room: PaRoom;
  maxLb: number;
  budget: number;
  goals: PaGoal[];
}

/** What `startOptimizerSearch` takes: input fields to change for this run, or the click event when it is used as a handler. */
export type PaSearchOverrides = Partial<PaOptimizerInputState> & { nativeEvent?: Event };

/** Which PA search a run is: the quick one that improves on your design (`improve`), or the exact one over its stated grid (`full`). */
export type PaRunMode = "improve" | "full";

/** The fields an older saved design can lack; the optimizer fills these in. */
export type PaDefaultedField =
  | "xoLo"
  | "xoHi"
  | "xoLoOrder"
  | "xoHiOrder"
  | "tilt"
  | "hfTilt"
  | "ampW"
  | "mAmpW"
  | "hfAmpW"
  | "hpType"
  | "portMax"
  | "wall"
  | "inset"
  | "layout";

/** The design the optimizer starts from: the planner's snapshot, possibly an older one. */
export interface PaOptimizerCurrent
  extends Omit<PaDesignConfig, PaDefaultedField>, Partial<Pick<PaDesignConfig, PaDefaultedField>> {}

export interface PaOptimizerInput {
  cur: PaOptimizerCurrent;
  room?: PaRoom;
  /** the heaviest box allowed, lb */
  maxLb: number;
  /** the most the drivers may cost per stack, dollars */
  budget: number;
  /** in tap order; the first ranks the designs */
  goals?: readonly PaGoal[];
  /** one goal, from before several could be stacked */
  goal?: PaGoal;
  locks?: PaOptimizerLocks;
  /** the cutlist's sheet and stack count, so the cards' sheet counts match the Cutlist tab */
  cutlist?: Pick<CutlistSettings, "sheet" | "stacks">;
}

/** The fields a result card sets; everything else (finish, colors, layout, balance) stays as the page has it. */
export type PaOptimizedField =
  | "sub"
  | "mid"
  | "cd"
  | "horn"
  | "cDim"
  | "cVent"
  | "portStyle"
  | "hpf"
  | "mDim"
  | "wall"
  | "xoLo"
  | "xoHi"
  | "ampW"
  | "mAmpW"
  | "hfAmpW";
export type PaOptimizedFields = Pick<PaDesignConfig, PaOptimizedField>;

/** A design as the planner evaluates it: cost, weight, output, limits and the chips for each section. */
export interface PaEvaluation {
  /** drivers per stack: sub, mid and compression driver */
  price: number;
  /** false when a driver has no published price */
  priceKnown: boolean;
  hornPrice: number;
  /** the loaded sub box, lb */
  subLb: number;
  /** the loaded mid box, lb; in the tower its cabinet over the sub box as carried (towerUpperLoadedLb) */
  midLb: number;
  /** the heaviest single lift, lb (heaviestLiftLb): in the tower the whole cabinet */
  heaviest: number;
  /** the sub's clean music-limit level, 40 to 90 Hz, dB */
  out: number;
  spl45: number;
  spl35: number;
  /** the sub's maximum-output curve averaged over the sub-bass band (SUB_BASS_BAND_HZ), dB */
  subBass: number;
  f3: number;
  Fb: number;
  who: SubLimitWho;
  limW: number;
  netL: number;
  qtc: number;
  midF3: number;
  /** dB the mid has to spare over what the sub needs at the crossover; negative = runs out first */
  midGap: number;
  hornGap: number | null;
  mismatch: boolean;
  port: VentGeometry;
  chips: { sub: Chip<ChipId<"sub">>[]; mid: Chip<ChipId<"mid">>[]; horn: Chip<ChipId<"horn">>[] };
  /** the sub's clean level for the card's chart, [Hz, dB] points from 20 to 200 Hz */
  curve: [number, number][];
}

export interface PaMetricsSummary {
  price: number;
  heaviest: number;
  out: number;
  spl45: number;
  subBass: number;
  f3: number;
  Fb: number;
  who: SubLimitWho;
}

/** A card's change from the current design. */
export interface PaMetricsDelta {
  price: number;
  heaviest: number;
  out: number;
  subBass: number;
  f3: number;
}

/**
 * The tower's cabinet over the sub's footprint (lib/pa/tower `towerSpec`), heights in inches up from the cabinet's
 * bottom: the 3D view, the cutlist, the weights and the cards' front view all read it.
 */
export interface TowerSpec {
  /** a semicircular top the full width of the cabinet (a round horn narrower than the cabinet) */
  archTop: boolean;
  /** the horn section's height over the mid chamber */
  hornSectionH: number;
  /** what the mid chamber and the horn section add over the sub box */
  extH: number;
  /** the cabinet's outer height: the sub box and `extH` */
  height: number;
  /** the internal partitions' top faces: the sub/mid floor, the mid/horn floor */
  partitions: readonly number[];
  /** the mid driver's center */
  midCenter: number;
  /** the horn's center */
  hornCenter: number;
}

/** What the tower's cabinet reads of its horn: the section's height, the arched top and the baffle's cutout. */
export type TowerHorn = Pick<Horn, "id" | "profile" | "rect" | "size">;

/** What a card's front-view drawing needs. */
export interface PaBoxGeometry {
  sub: Dims3;
  mid: Dims3;
  /** the tower's cabinet; null in the other layouts */
  tower: TowerSpec | null;
  horn: Dims2 | null;
  subSize: SubSize;
  midSize: MidSize;
  portStyle: PortStyle;
  cVent: VentSpec;
  wall: number;
}

export interface PaOptimizerCard {
  label: string;
  why: string;
  /** which card it is (first, fix, closest, smallest or an alternative's goal): code reads this, never the label */
  slot: CardSlot<PaGoal>;
  config: PaDesignConfig;
  metrics: PaMetricsSummary;
  delta: PaMetricsDelta | null;
  names: { sub: string; mid: string; cd: string; horn: string };
  /** the vent in words */
  vent: string;
  /** what stops the sub's music level */
  limitedBy: string;
  /** the planner's warnings on this design (its sub, mid and horn chips that aren't ok) */
  warnings: Chip<ChipId<"sub" | "mid" | "horn">>[];
  /**
   * the mid's Qtc and the sheets of ply each thickness needs (thickest first) from the quick packing; `parts` (one
   * stack) and `cutlist` let the card ask the worker for the exact counts the Cutlist tab shows
   */
  build: {
    qtc: number;
    sheets: { t: number; n: number }[];
    parts: CutPart[];
    cutlist: CutlistSettings;
  };
  /** what differs from the current design: "sub driver", "vent" ... */
  changed: ChangeName[];
  priceKnown: boolean;
  curve: [number, number][];
  geom: PaBoxGeometry;
}

/** A change to the limits that would let the search find a card. */
export interface PaNearMissOption {
  text: string;
  set: Partial<Pick<PaOptimizerInput, "maxLb" | "budget">>;
}

/** No card fits: the closest design, why it fails and what loosening would help. */
export interface PaNearMiss {
  options: PaNearMissOption[];
  closest: PaOptimizerCard | null;
  /** the closest design is your design as it is (the banner says so) */
  closestIsYours: boolean;
  blocking: string[];
}

export interface PaOptimizerResult {
  /** the output the cards aim for, dB, and what the room alone needs */
  target: number;
  need: number;
  curM: PaMetricsSummary | null;
  curProblems: string[];
  cur: { curve: [number, number][]; geom: PaBoxGeometry } | null;
  cards: PaOptimizerCard[];
  goals: PaGoal[];
  goalMissing: string | null;
  nearMiss: PaNearMiss | null;
  stats: {
    evaluated: number;
    ms: number;
    subs: number;
    combos: number;
    pool: number;
    /** Fully optimize: the most grid rounds one card selection took (lib/pa/optimizeExact PA_EXACT_SLOT_ROUNDS) */
    rounds?: number;
  };
}

/** A check on the PA stack's sub, mid or horn. */
export type PaChipId = ChipId<"sub" | "mid" | "horn">;
/**
 * What a PA design fails, by id: a check's chip, or one of the search's own tests (it can't be modeled, the mid's Qtc,
 * horn and driver exits that differ, a box over the weight limit, drivers over the budget).
 */
export type PaProblemId =
  | PaChipId
  | "unmodeled"
  | "midQtc"
  | "exitMismatch"
  | "overWeight"
  | "overBudget";
/** A problem with a design: its id and its words. */
export interface PaProblem {
  id: PaProblemId;
  text: string;
}
/** The limits a PA design is checked against: the heaviest box, the driver budget and the warnings let through. */
/** The parts the driver comparison swaps: the drivers and the horn (`PaLockKey`s, so each has its lock). */
export type PaDriverPart = Extract<PaLockKey, "sub" | "mid" | "cd" | "horn">;

/** One option in the driver comparison: the part's own price, and the whole design's numbers with it in. */
export interface PaDriverCompareRow {
  id: string;
  name: string;
  /** the part's own price; null when unpublished */
  price: number | null;
  /** your design's part */
  yours: boolean;
  /** the weight it brings, lb: the sub's or mid's box with the driver in it, or the compression driver or horn itself
   * (they add to no box); null when the box can't be modeled */
  lb: number | null;
  /** the design with this part (null: the planner can't model it) */
  m: Pick<
    PaEvaluation,
    "price" | "priceKnown" | "out" | "f3" | "qtc" | "midGap" | "hornGap"
  > | null;
  /** what fails the planner's checks or the optimizer's limits (empty: passes); `yoursToo` when your design fails the
   * same way (whatever you pick, so it doesn't tell the options apart; amounts over a limit and the mid's Qtc differ
   * per option, so those are never marked) */
  problems: (PaProblem & { yoursToo: boolean })[];
}

/** A slider's range and step (an amp slider's steps, with its top). */
export type SliderSpec = AmpSteps & { max: number };

export interface PaProblemLimits {
  maxLb: number;
  budget: number;
  allow?: Set<PaChipId>;
}
/** The numbers the PA goals rank by. */
export interface PaScore {
  price: number;
  heaviest: number;
  out: number;
  f3: number;
}
/** A score plus how many things differ from the current design and how many warnings it has (`w`, once evaluated). */
export interface PaMetric extends PaScore {
  ch: number;
  w?: number;
}
/** A compression driver on a horn, with its level at the crossover. */
export interface PaHornEntry {
  cd: CompressionDriver;
  h: Horn;
  at: number;
  price: number;
  horn: number;
  same: boolean;
  /** the warnings the pair carries at the crossover on its own (no mid in view): `hornOwnWarnings` */
  w: number;
}
/** An evaluated PA design. */
export interface PaPoolEntry {
  c: PaDesignConfig;
  m: PaEvaluation;
  ch: number;
}
/** The PA locks with both box-dimension modes present. */
export interface PaResolvedLocks extends PaOptimizerLocks {
  subDim: Partial<Record<keyof Dims3, DimensionLockMode>>;
  midDim: Partial<Record<keyof Dims3, DimensionLockMode>>;
}
/** The PA card selection's picks from a pool (`selectCards`' result). */
export interface PaChosen {
  cards: SelectedCard<PaPoolEntry, PaGoal>[];
  goalMissing: boolean;
  fixMisses: boolean;
}
/** The PA card selection over the pool, within some limits and at an output target (null: no card). */
export type PaChoose = (L: PaProblemLimits, tgt: number) => PaChosen | null;
/**
 * What the PA search's setup and card rules hand the exact search (lib/pa/optimizeExact): your design and the amps,
 * locks and limits as the search reads them, the target and what each goal keeps, the crossovers, mids and horn pairs,
 * the ranking and comparisons the cards use, and the pool the cards are chosen from.
 */
export interface PaSearchContext {
  cur: PaDesignConfig;
  /** your design at the searched amps */
  base: PaDesignConfig;
  amps: Pick<PaDesignConfig, "ampW" | "mAmpW" | "hfAmpW">;
  locks: PaResolvedLocks;
  lim: Required<PaProblemLimits>;
  goals: PaGoal[];
  target: number;
  keep: Record<PaGoal, Keep>;
  curMet: PaScore | null;
  curFails: boolean;
  xoHis: number[];
  mids: MidDriver[];
  midBoxes: (m: MidDriver, t: number) => (Dims3 | null)[];
  /** per upper crossover, the horn pairs that load there, cheapest first */
  hornTable: Record<number, PaHornEntry[]>;
  /** the alternatives' axes, in the order the cards take them */
  altAxes: PaGoal[];
  obj: Record<PaGoal, (x: PaMetric) => number>;
  beats: Record<PaGoal, (x: PaScore, y: PaScore) => boolean>;
  metric: (p: PaPoolEntry) => PaMetric;
  changes: (c: PaDesignConfig) => number;
  pool: PaPoolEntry[];
}
/**
 * How the exact search plugs into the PA search: it wraps the card selection so the pool holds every design a card
 * could be (adding designs until no design on its grid beats a pick), and says how light a working sub box gets.
 */
export interface PaExactHook {
  close(choose: PaChoose, ctx: PaSearchContext): PaChoose;
  lightestSubLb(): number | null;
}
/** The exact PA search's grid steps (lib/pa/optimizeExact's PA_EXACT_GRID). */
export interface PaExactGrid {
  /** net volumes run from `minNetL` (the planner's floor) up by this share each rung */
  volumeStep: number;
  minNetL: number;
  /** tunings, Hz */
  fb: { from: number; to: number; step: number };
  /** the shortest duct, in: a vent that tunes the box only when shorter isn't used (as the quick search) */
  minDuctIn: number;
}
/**
 * One share of the exact PA search's model step, per sub driver: its place in the searched list and its curves packed
 * by row (see `ROW_HEAD` in lib/pa/optimizeExact).
 */
export interface PaExactScored {
  sub: number;
  rows: Float64Array;
}
/** A job for an exact PA search worker: one share of the model step, or the search on every share. */
export type PaExactJob =
  | { kind: "score"; input: PaOptimizerInput; part: number; parts: number; grid?: PaExactGrid }
  | { kind: "select"; input: PaOptimizerInput; scored: PaExactScored[][] };
export type PaExactJobResult =
  | { kind: "scored"; scored: PaExactScored[] }
  | { kind: "result"; result: PaOptimizerResult };

/** What the page posts to an optimizer's worker; the PA stack's unless another input type is given. */
export interface OptimizerRequest<I = PaOptimizerInput> {
  id: number;
  input: I;
}

/** How far a search has got: designs checked of the total (the total may grow as a search finds more to check), and the best so far on the first goal, in words. */
export interface OptimizerProgress {
  done: number;
  total: number;
  best?: string;
}

/** Where a search sends its progress (an engine calls it now and then, cheaply; it never changes the result). */
export type OptimizerProgressCallback = (p: OptimizerProgress) => void;

/** What a run of an optimizer can be given besides its input: where progress goes, and a signal that cancels it. */
export interface OptimizerRunOptions {
  onProgress?: OptimizerProgressCallback;
  signal?: AbortSignal;
}

/** A box's fields on the search grid (the rest of its config is your design's). */
export interface HifiGridBox {
  box: HifiBoxKind;
  dim: Dims3;
  wall: number;
  port: HifiPort | null;
  pr: PassiveRadiatorChoice | null;
}
/** A box from the box step, as a worker hands it back: its fields, place in the grid, and its numbers per crossover. */
export interface HifiScoredBox extends HifiGridBox {
  key: string;
  /** its place in the grid's order: the woofer's, the box's, and how many vents up from the box's own */
  order: [woofer: number, box: number, vent: number];
  wId: string;
  gross: number;
  ch: number;
  f3: number;
  /**
   * per crossover (null: past the woofer's range), the woofer's clean level at 1 m at the searched power, and the
   * levels the amp alone and the driver alone allow there (a lower power moves the first, never the second)
   */
  levels: ({ wLevel: number; ampDb: number; drvDb: number } | null)[];
  /** the woofer's passband sensitivity at 2.83 V, dB (`HifiSystem.refW`): what a passive network pads the tweeter to */
  refW: number;
}
/** A job for a Hi-fi optimizer worker: one share of the box step, or the rest of the search on every share. */
export type HifiOptimizerJob =
  | {
      kind: "score";
      input: HifiOptimizerInput;
      part: number;
      parts: number;
      /** keep this share in the worker for the select job of the same run, instead of sending it back */
      keep?: string;
    }
  | {
      kind: "select";
      input: HifiOptimizerInput;
      /** the other workers' shares; the share kept for this run joins them (or is scored again if it was lost) */
      scored: HifiScoredBox[][];
      kept?: { run: string; part: number; parts: number };
    };
export type HifiOptimizerJobResult =
  | { kind: "scored"; scored: HifiScoredBox[] }
  | { kind: "result"; result: HifiOptimizerResult };

/** The worker's reply: the result, or the message of what it threw. */
export type OptimizerResponse<R = PaOptimizerResult> =
  | { id: number; out: R }
  | { id: number; error: string };
/** What an optimizer's worker posts for a request: progress any number of times, then its reply. */
export type OptimizerMessage<R = PaOptimizerResult> =
  | { id: number; progress: OptimizerProgress }
  | OptimizerResponse<R>;

// ---- Saved configurations ----

/** What a page hands to `save`: its snapshot of the design, with a one-line `summary` of it; the store adds `name` and `savedAt`. */
export interface SavedConfigData {
  summary?: string;
}

/**
 * A speaker as the library saves it (users/{uid}/speakers): the spec without its id and name, which are the document's
 * id and the save's name.
 */
export interface SavedSpeakerData extends SavedConfigData {
  speaker: Omit<SpeakerSpec, "id" | "name">;
}

/** A stack and the speakers its members name, as the Stack page holds them. */
export type StackDesign = Pick<DesignLayers, "stack" | "speakers">;

/** A space and the stacks and speakers it places, as the Space page holds them. */
export interface SpaceDesign extends Pick<DesignLayers, "space" | "speakers"> {
  stacks: readonly StackSpec[];
}

/**
 * A saved space: the space without its id and name (the document's), and a copy of each stack and speaker it places (by
 * id), so it opens as it was saved.
 */
export interface SavedSpaceData extends SavedConfigData {
  space: Omit<SpaceSpec, "id" | "name">;
  stacks: readonly StackSpec[];
  speakers: readonly SpeakerSpec[];
}

/**
 * A saved stack: the stack without its id and name (the document's), and a copy of each speaker its members name (by
 * the speaker's id), so it opens as it was saved.
 */
export interface SavedStackData extends SavedConfigData {
  stack: Omit<StackSpec, "id" | "name">;
  speakers: readonly SpeakerSpec[];
}

/** A saved configuration as read back: the stored fields plus the document's id. */
export interface SavedConfig {
  id: string;
  name: string;
  /** ms since the epoch */
  savedAt?: number;
  /** the one-line description shown under the picker */
  summary?: string;
  [field: string]: unknown;
}

/** The documents of a snapshot, as the config store reads them. */
export interface ConfigSnapshot {
  docs: { id: string; data(): Record<string, unknown> }[];
}

/** A query on a config collection, chained the way the artifact database and Firestore's compat API do. */
export interface ConfigQuery {
  orderBy(field: string, dir?: "asc" | "desc"): ConfigQuery;
  limit(n: number): ConfigQuery;
  /** returns the unsubscribe function */
  onSnapshot(next: (snap: ConfigSnapshot) => void, error: (e: Error) => void): () => void;
}

/** A config collection: a query, plus `doc(id?)` (a new id when none is given) to write or delete one. */
export interface ConfigCollection extends ConfigQuery {
  doc(id?: string): {
    set(data: Record<string, unknown>): Promise<unknown>;
    delete(): Promise<unknown>;
  };
}

/** The database handle the config store works with: the claude.ai artifact's, or the Firebase adapter's. */
export interface ConfigDb {
  collection(name: string): ConfigCollection;
}

/** The header's theme switch: System (follow the device), Light or Dark. */
export type ThemeChoice = (typeof THEME_CHOICES)[number][0];

/** A theme: the palette in use, picked by the device's setting or the switch. */
export type ThemeName = Exclude<ThemeChoice, typeof THEME_SYSTEM>;
