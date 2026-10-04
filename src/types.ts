import type { Dispatch, SetStateAction } from "react";
import type { CHIP_IDS } from "./constants/chipIds";
import type { CUT_BOX_NAMES, CUT_PART_NAMES } from "./constants/cutParts";
import type { LIMIT_NAMES } from "./constants/limits";
import type { MAKER_NAMES } from "./data/catalog/makers";

// Shapes of the parts catalogue tables in data/catalog/ (lib/data.ts derives the app's view of them).
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
 * driver's `Xmax` is its centre.
 */
export interface XmaxBand {
  basis: XmaxBasis;
  lo: number;
  hi: number;
}

/** The Thiele-Small parameters and ratings every driver table lists. `disp` is the driver's displacement in litres, null where unpublished. */
export interface ThieleSmall {
  Fs: number;
  Qts: number;
  Qes: number;
  Qms: number;
  Vas: number;
  Sd: number;
  /** the comparable one-way excursion the models use, mm: the centre of `xmax` (see `lib/xmax`) */
  Xmax: number;
  xmax: XmaxBand;
  pub: PublishedExcursion;
  /** voice-coil winding height and magnetic gap height, mm, where the maker publishes them */
  Hvc?: number;
  Hg?: number;
  Re: number;
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

/** The Thiele-Small fields the box models read (`boxModel`, `closedBox`, `passiveRadiatorBox`); `closedBox` and `passiveRadiatorBox` leave `Xmax` alone. */
export type BoxModelTS = Pick<ThieleSmall, "Fs" | "Qms" | "Sd" | "Xmax" | "Bl" | "Re" | "Mms">;

/** Subs always list a displacement. */
export interface SubTS extends ThieleSmall {
  disp: number;
}

/** Hi-fi woofers also list inductance, 2.83 V sensitivity and nominal impedance (informational; no model reads them). */
export interface HifiWooferTS extends ThieleSmall {
  Le: number;
  sens: number;
  imp: number;
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
  price: number | null;
  src: string;
  note: string;
}

/** One point of a horn's flare, [radius, depth] in inches. */
export type HornProfilePoint = readonly [radius: number, depth: number];

export interface HornHf {
  covH: number;
  covV: number | null;
  minXo: number | null;
  lowHz: number;
}

export interface Horn {
  id: string;
  lb: number;
  name: string;
  hf?: HornHf;
  /** throat exit in inches */
  exit: number;
  /** the flare drawn in the 3-D view; a horn without one is drawn as a generic flare */
  profile?: readonly HornProfilePoint[];
  scale?: number;
  scaleX?: number;
  scaleY?: number;
  scaleZ?: number;
  /** a rectangular mouth */
  rect?: boolean;
  price: number;
  src: string;
  size: Dims3;
  driver: string;
  xo: string;
  note: string;
}

/** A horn the hi-fi page can use as a waveguide: one with its coverage specs. */
export type HifiWaveguide = Horn & { hf: HornHf };

/** The cabinet's ported-vent kinds. */
export type VentKind = "slots" | "round1" | "round2" | "vslots" | "folded" | "round4";

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

/** The named cabinet finishes; the cabinet's `cabFinish` can also be any paint colour, as a hex string. */
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

/** One line of a rack's parts list: description and price in dollars. */
export type RackItem = [text: string, price: number];

export interface Rack {
  id: string;
  name: string;
  note: string;
  items: RackItem[];
}

/** A crossover / DSP unit as the Notes page's comparison table shows it: one display-text cell per column. */
export type DspUnitRow = readonly [
  unit: string,
  io: string,
  slopes: string,
  limiter: string,
  peqPerOutput: string,
  priceUs: string,
  notes: string,
];

/** One amplifier model of a series: per-channel power, continuous with both channels driven. */
export interface AmpModel {
  id: string;
  /** model name without the brand, as the notes write it (`GXD4`) */
  model: string;
  /** watts per channel into 8 Ω and into 4 Ω */
  w8: number;
  w4: number;
  /** voltage gain, dB */
  gainDb: number;
  /** the speaker-power range its limiter can be set to, watts */
  limiterW: readonly [min: number, max: number];
}

/** An amplifier series and the DSP its models share, as the Notes page and the signal-path drawing describe it. */
export interface AmpSeries {
  brand: string;
  models: readonly AmpModel[];
  /** the DSP's crossover filters, display text */
  filters: string;
  /** the limiter's name and presets, display text */
  limiterModes: string;
  /** what the DSP can't do, display text */
  limits: string;
  /** where the figures come from: the maker's documents */
  src: readonly { name: string; url: string }[];
}

/** A paint colour: [hex, name]. */
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

export interface HifiWoofer {
  id: string;
  size: number;
  lb: number;
  name: string;
  /** who makes it (`MAKER_NAMES`): code reads this, never the start of `name` */
  maker: MakerId;
  price: number;
  src: string;
  ts: HifiWooferTS;
  /** highest usable frequency, Hz */
  fmax: number | null;
  note: string;
}

export type TweeterType = "dome" | "horn-loaded" | "compression" | "ribbon";

export interface TweeterHf {
  sens: number;
  aes: number;
  aesXo: number | null;
  minXo: number | null;
  imp: number;
  fs: number | null;
}

/** A ribbon's own waveguide: coverage in degrees and mouth size in inches. */
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
  /** absent on the ribbons, which come with their own */
  needsWaveguide?: boolean;
  note: string;
  /** radiating diameter in inches for the directivity: the exit, or the mouth of a horn-loaded tweeter */
  domeIn: number;
  ownGuide?: OwnGuide;
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
  /** frequency points for the woofer response (240 when absent) */
  N?: number;
  /** radius of the roundover on the baffle's edges, inches; 0 (sharp) when absent */
  roundoverIn?: number;
  /** how far the tweeter sits off the baffle's centre line, inches, + toward the inside of the pair (mirror-imaged); 0 when absent */
  tweeterOffsetIn?: number;
}

/** Where the drivers sit on the baffle, inches from the box bottom. */
export interface DriverLayout {
  tweeterIn: number;
  wooferIn: number;
  spacingIn: number;
  /** the tweeter's waveguide sits on the box top */
  onTop?: true;
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

/** What every modelled Hi-fi speaker has, whatever its box. */
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
  prFits: boolean;
  Fb: number;
  Fp: number;
  peakVel: null;
  Qtc?: undefined;
}

/**
 * The modelled speaker: `hifiSystem`'s result, one variant per box kind. The `?: undefined` fields are the other
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
}

// ---- Hi-fi optimizer (lib/hifi/optimize) ----

export type HifiGoal = "cheaper" | "lighter" | "lower" | "louder";

export type DimensionLockMode = "free" | "exact" | "max";

/** The optimizer locks that are plain on/off switches (a box dimension has its own mode: `dim`). */
export type HifiLockKey = "woofer" | "tweeter" | "box" | "wall" | "xo" | "wAmpW" | "tAmpW";

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
}

/** What a design is scored on: price for the pair in dollars, weight in lb, in-room F3 in Hz and clean level at the seat in dB. */
export interface HifiMetrics {
  gross: number;
  f3: number;
  price: number;
  level: number;
  lb: number;
}

/** The Hi-fi page's design and room, as the planner holds it. */
export interface HifiDesignState {
  woofer: HifiWoofer;
  tweeter: HifiTweeter;
  selectedWaveguide: HifiWaveguide;
  boxType: HifiBoxKind;
  boxDims: Dims3;
  wallThicknessIn: number;
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
  /** tweeter offset from the baffle's centre line, inches, + toward the inside of the pair */
  tweeterOffsetIn: number;
}

/** What the model reads off a design that can be modelled: the system, and the curves and numbers worked out from it. */
export interface HifiSpeakerModel {
  speakerSystem: HifiSystem;
  warningChips: HifiChip[];
  /** both speakers' clean output at the seat, dB */
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

/** The Hi-fi design as the models read it, worked out from the planner's state. */
export interface HifiDesign {
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
  /** the average distance to the seat, at least 1 m */
  seatDistanceM: number;
  /** the same distance in feet, as the page shows it */
  seatDistanceFt: number;
  pairCostUsd: number;
  /** null when the woofer can't be modelled (its parameters aren't published) */
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
export interface SavedHifiConfig extends Omit<HifiCardConfig, "pr"> {
  pr?: RadiatorSelection;
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
  /** tweeter offset, inches, + toward the inside; absent in configs saved before it existed (centred) */
  tweeterOffset?: number;
  summary: string;
}

/** A card's change from the current design. */
export interface HifiMetricsDelta {
  price: number;
  lb: number;
  level: number;
  f3: number;
}

export interface HifiOptimizerCard {
  label: string;
  why: string;
  woofer: string;
  tweeter: string;
  config: HifiCardConfig;
  metrics: HifiMetrics;
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
  changed: string[];
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
  cur?: HifiMetrics | null;
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

/** The panel thicknesses, inches, the catalogue lists a weight for (plywood and MDF). */
export type PanelThickness = 0.75 | 0.5;

/**
 * The sub's vent, in inches: the planner keeps every field, whichever layout uses it (`slotH` the slots, `throat` the
 * side ducts, `nt` and `dia` the tubes), and `len` is the duct length in all of them.
 */
export interface VentSpec {
  slotH: number;
  nt: number;
  dia: number;
  throat: number;
  len: number;
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
  /** side, top, bottom and back plywood, inches */
  wall: number;
  /** how far the baffles sit behind the frame front, inches */
  inset: number;
  /** sub to mid and mid to horn crossovers, Hz */
  xoLo: number;
  xoHi: number;
  /** each crossover's Linkwitz-Riley order (4 = LR24, 8 = LR48); saves from before the setting load as LR24 */
  xoLoOrder: CrossoverOrder;
  xoHiOrder: CrossoverOrder;
  mAmpW: number;
  /** how much less the mid band needs than the sub band, dB */
  tilt: number;
  hfAmpW: number;
  /** how much less the horn band needs than the mid band, dB */
  hfTilt: number;
  layout: PaLayout;
  cutaway?: boolean;
  baffleColor?: string;
  /** a `FinishId`, or a paint colour as a hex string (`SwatchPicker` offers both) */
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
export interface VentGeometry {
  n: number;
  area: number;
  len: number;
  /** absent for round tubes, which take the model's default */
  ec?: number;
  dh: number;
  desc: string;
}

/** The sub's vent as the 3D view draws it, from the design's vent spec: duct height, tube count, tube radius, tube length and throat (all inches). */
export interface PaPortGeometry {
  ductH: number;
  nPorts: number;
  portR: number;
  tubeLen: number;
  throat: number;
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
  netL: number;
  Fb: number;
}

/** What a sub always has: its vent, volumes and the amp's peak voltage. */
export interface SubSystemBase {
  port: VentGeometry;
  grossL: number;
  ductL: number;
  woodL: number;
  netL: number;
  AMP_V: number;
}

/** A sub with no model: the driver has no T/S, or the box or vent is degenerate (no net volume, no port area, port length at or under 0). */
export interface SubSystemUnmodelled extends SubSystemBase {
  mdl: null;
  lim: null;
}

/** A sub with its vented-box model and the music limit that comes from it. */
export interface SubSystemModelled extends SubSystemBase {
  mdl: VentedBoxModel;
  lim: SubLimits;
}

/** `subSystem`: check `mdl` and `lim` narrows with it. */
export type SubSystem = SubSystemUnmodelled | SubSystemModelled;

export interface MidSystemConfig extends Pick<PaDesignConfig, "xoLoOrder" | "xoHiOrder"> {
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
  netL: number;
  effL: number;
  vTherm: number;
  useV: number;
}

/** A mid with no model (the driver has no T/S): no response and no limit curve. */
export interface MidSystemUnmodelled extends MidSystemBase {
  mdl: null;
  max: null;
}

/** A mid with its sealed-box model and the most it can play at each frequency. */
export interface MidSystemModelled extends MidSystemBase {
  mdl: SealedBoxModel;
  max: PaMaxPoint[];
}

/** `midSystem`: check `mdl` and `max` narrows with it. */
export type MidSystem = MidSystemUnmodelled | MidSystemModelled;

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
  /** the highpass to the subs, Hz (LR24) */
  highpassHz: number;
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
  ampW: number;
  portMax: number;
}

/** What every modelled fill has, whichever box. */
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

// ---- Cutlist ----

/** A cutlist part's stable id (`CUT_PART_NAMES` holds the name it shows). */
export type CutPartId = keyof typeof CUT_PART_NAMES;
/** The box a cutlist part belongs to, by id (`CUT_BOX_NAMES` holds the name it shows). */
export type CutBoxId = keyof typeof CUT_BOX_NAMES;

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
/** The sections that carry checks: the PA stack's sub, mid and horn, the fills and the Hi-fi speaker. */
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
  subBox: Dims3;
  portStyle: PortStyle;
  cVent: VentSpec;
  /** plywood thickness */
  PT: number;
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
  ts: Pick<ThieleSmall, "Xmax" | "aes">;
  /** amp volts, the volts the driver can use, and the thermal limit in volts */
  V: number;
  useV: number;
  vTherm: number;
  mAmpW: number;
  /** the sub at its music limit at the crossover, dB; null where the sub has no model */
  subMusicAtXo: number | null;
  tilt: number;
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
  hfTilt: number;
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

/** How loud the system plays: at its limit, or turned down until the listener gets the target. */
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
  levelMode: CoverageLevelMode;
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
  | "wall"
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

/** The fields a result card sets; everything else (finish, colours, layout, balance) stays as the page has it. */
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
  subLb: number;
  midLb: number;
  heaviest: number;
  /** the sub's clean music-limit level, 40 to 90 Hz, dB */
  out: number;
  spl45: number;
  spl35: number;
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
  f3: number;
  Fb: number;
  who: SubLimitWho;
}

/** A card's change from the current design. */
export interface PaMetricsDelta {
  price: number;
  heaviest: number;
  out: number;
  f3: number;
}

/** What a card's front-view drawing needs. */
export interface PaBoxGeometry {
  sub: Dims3;
  mid: Dims3;
  tower: boolean;
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
  changed: string[];
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
  stats: { evaluated: number; ms: number; subs: number; combos: number; pool: number };
}

/** What the page posts to an optimizer's worker; the PA stack's unless another input type is given. */
export interface OptimizerRequest<I = PaOptimizerInput> {
  id: number;
  input: I;
}

/** The worker's reply: the result, or the message of what it threw. */
export type OptimizerResponse<R = PaOptimizerResult> =
  | { id: number; out: R }
  | { id: number; error: string };

// ---- Saved configurations ----

/** What a page hands to `save`: its snapshot of the design, with a one-line `summary` of it; the store adds `name` and `savedAt`. */
export interface SavedConfigData {
  summary?: string;
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
