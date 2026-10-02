// Shapes of the driver, horn, cabinet and fill tables in lib/data.ts.
//
// A spec the vendor does not publish is `null` in the table (the note says so), so it stays in the type as `number | null`.
// A field that only some entries have is optional (`?`).

/** Sub driver diameters in inches; also the keys of a cabinet's `dims`. */
export type SubSize = 15 | 18;
/** Mid driver diameters in inches. */
export type MidSize = 10 | 12 | 15;

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

/** The parameters every modelled woofer has. `disp` is the driver's displacement in litres, null where unpublished. */
export interface DriverTS {
  Fs: number;
  Qes: number;
  Qms: number;
  Vas: number;
  Sd: number;
  Xmax: number;
  Re: number;
  Bl: number;
  Mms: number;
  aes: number;
  disp: number | null;
}

/** Sub and mid drivers also publish Qts. */
export interface BassTS extends DriverTS {
  Qts: number;
}

/** Subs always list a displacement. */
export interface SubTS extends BassTS {
  disp: number;
}

/** Fill coaxials list no Qts. */
export type FillTS = DriverTS;

/** Hi-fi woofers. `Re` and `Mms` can be unpublished (null); the module fills them in from the other parameters when it can. */
export interface HifiWooferTS extends Omit<BassTS, "Re" | "Mms"> {
  Re: number | null;
  Mms: number | null;
  Le: number;
  /** dB at 2.83 V / 1 m */
  sens: number;
  /** nominal impedance, ohms */
  imp: number;
}

// ---- PA stack ----

export interface SubDriver {
  id: string;
  lb: number;
  name: string;
  price: number;
  src: string;
  size: SubSize;
  ts: SubTS;
  note: string;
  /** the default pick, marked with a dot in the picker */
  pick?: boolean;
}

export interface MidDriver {
  id: string;
  size: MidSize;
  lb: number;
  name: string;
  price: number | null;
  src: string;
  ts: BassTS;
  note: string;
  pick?: boolean;
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
  pick?: boolean;
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
  pick?: boolean;
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
  pick?: boolean;
  /** the sub size it suits, when it is for one size only */
  size?: SubSize;
}

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
  price: number | null;
  src: string;
  ts: FillTS;
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
  price: number;
  src: string;
  ts: HifiWooferTS;
  /** highest usable frequency, Hz */
  fmax: number | null;
  note: string;
  pick?: boolean;
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

/**
 * A tweeter's faceplate. The table gives either `diameter` (round) or `w` and `h`; when the module loads it rewrites every
 * entry to `w` and `h`.
 */
export interface Faceplate {
  w?: number;
  h?: number;
  diameter?: number;
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
  /** null where the maker gives no size; the layout then assumes 3.5 in square */
  faceplate?: Faceplate | null;
  /** absent on the ribbons, which come with their own */
  needsWaveguide?: boolean;
  note: string;
  /** radiating diameter in inches for the directivity; set when the module loads */
  domeIn?: number;
  pick?: boolean;
  ownGuide?: OwnGuide;
}

export type XmaxKind = "linear" | "mechanical";

export interface PassiveRadiator {
  id: string;
  name: string;
  size: number;
  Sd: number;
  Mms: number;
  Cms: number;
  Qms: number;
  Fs: number;
  Xmax: number;
  xmaxKind: XmaxKind;
  lb: number | null;
  price: number;
  src: string;
  note: string;
  /** a non-round cone's width and height in inches */
  shape?: Dims2;
  /** the most added mass in grams; the planner allows 3 x Mms when absent */
  maxAddG?: number;
}

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
}

/** Where the drivers sit on the baffle, inches from the box bottom. */
export interface DriverLayout {
  tweeterIn: number;
  wooferIn: number;
  spacingIn: number;
  /** the tweeter's waveguide sits on the box top */
  onTop?: true;
}

/** What limits the woofer's output at a frequency. */
export type WooferLimit = "Xmax" | "port" | "radiator" | "thermal" | "amp";

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

/** The modelled speaker: `hifiSystem`'s result. */
export interface HifiSystem {
  gross: number;
  net: number;
  disp: number;
  pVol: number;
  pArea: number;
  vented: boolean;
  slot: boolean;
  slotW: number | null;
  radiator: boolean;
  Fb: number | null;
  Fp: number | null;
  prFits: boolean;
  Qtc: number | null;
  f3Box: number;
  ref: number;
  refW: number;
  woofer: WooferPoint[];
  wMax: WooferMaxPoint[];
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
  peakVel: number | null;
  V: number;
}

/** A check on the design: a severity, a short title and a sentence of detail. */
export type HifiChip = [severity: "ok" | "warn" | "bad", title: string, detail: string];

/** Where the listener is relative to one speaker: horizontal angle off its axis (rad), ear height above the box bottom (in) and distance (m). */
export interface ListenerGeometry {
  th: number;
  eyeIn: number;
  distM: number;
}

export interface FrequencyPoint {
  f: number;
  spl: number;
}

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

/** The design the optimizer starts from: the page's config with the drivers named by id. */
export interface HifiOptimizerCurrent extends HifiConfig {
  woofer: string;
  tweeter: string;
  tAmpW: number;
}

export interface HifiOptimizerInput {
  cur: HifiOptimizerCurrent;
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
  warnings: string[];
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
  // the fields below are absent when no goal was given
  cur?: HifiMetrics | null;
  curProblems?: string[];
  curCurve?: [number, number][] | null;
  goalMissing?: string | null;
}
