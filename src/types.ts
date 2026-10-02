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

/** The Thiele-Small parameters and ratings every driver table lists. `disp` is the driver's displacement in litres, null where unpublished. */
export interface ThieleSmall {
  Fs: number;
  Qts: number;
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
  ts: ThieleSmall;
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
export type HifiChip = Chip;

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
  mAmpW: number;
  /** how much less the mid band needs than the sub band, dB */
  tilt: number;
  hfAmpW: number;
  /** how much less the horn band needs than the mid band, dB */
  hfTilt: number;
  layout: PaLayout;
  cutaway?: boolean;
  baffleColor?: string;
  cabFinish?: FinishId;
  spacerH?: number;
  joint?: CornerJoint;
  summary?: string;
}

/** One point of a vented-box response: raw box SPL, system SPL with the highpass, cone excursion (mm, peak) and port air speed (m/s, peak). */
export interface VentedPoint {
  f: number;
  raw: number;
  spl: number;
  xmm: number;
  vel: number;
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

/** One point of a sealed-box response (no port). */
export interface SealedPoint {
  f: number;
  raw: number;
  spl: number;
  xmm: number;
}

export interface SealedBoxModel {
  curve: SealedPoint[];
  Fc: number;
  Qtc: number;
  f3: number;
  ref: number;
  peakX: number;
}

/** What stops a drive level for the whole band. */
export type SubLimitWho =
  | "port air speed"
  | "cone travel (Xmax)"
  | "driver program rating"
  | "amplifier power";

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
  who: "port" | "Xmax" | "thermal" | "amp";
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

export interface SubSystem {
  port: VentGeometry;
  grossL: number;
  ductL: number;
  woodL: number;
  netL: number;
  AMP_V: number;
  mdl: VentedBoxModel | null;
  lim: SubLimits | null;
}

export interface MidSystemConfig {
  midDims: Dims3;
  wall: number;
  inset: number;
  xoLo: number;
  xoHi: number;
  mAmpW: number;
}

export interface MidSystem {
  V: number;
  grossL: number;
  disp: number;
  netL: number;
  effL: number;
  mdl: SealedBoxModel | null;
  vTherm: number;
  max: PaMaxPoint[] | null;
  useV: number;
}

/** The compression driver on its horn: power available, the cap, and the response from the crossover up. */
export interface HornResponse {
  curve: FrequencyPoint[];
  /** watts the driver sees: the lower of the amp and the program rating */
  P: number;
  pAmp: number;
  pProg: number;
  /** power derating for a crossover below the frequency the AES rating assumes (1 = none) */
  derate: number;
  imp: number;
  who: "amp" | "program rating";
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

export interface FillSystem {
  V: number;
  gross: number;
  pArea: number;
  disp: number;
  net: number;
  eff: number;
  vM: VentedBoxModel | null;
  sM: SealedBoxModel | null;
  max: PaMaxPoint[];
  sens: number;
  f3: number;
  pad: number;
  /** amp watts at which the HF reaches its program rating; null for a fill without an HF section */
  hfLimW: number | null;
  lb: number;
  portLimited: boolean;
}

// ---- Cutlist ----

/** One line of the cutlist: a part of a box, cut `qty` times from `t`-inch ply, `a` by `b` inches. */
export interface CutPart {
  box: string;
  part: string;
  qty: number;
  a: number;
  b: number;
  t: number;
  note: string;
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

/** A part laid on a sheet: its position and the size it was placed at (rotated if need be). */
export type PlacedPart<R = CutPart> = R & { x: number; y: number; w: number; h: number };

/** One shelf of a sheet: its top, its height and how far across it is filled. */
export interface SheetRow {
  y: number;
  h: number;
  x: number;
}

/** A sheet of ply with the parts on it; `y` is how far down the last row ends. */
export interface PackedSheet<R = CutPart> {
  rows: SheetRow[];
  items: PlacedPart<R>[];
  y: number;
}

export interface PackedSheets<R = CutPart> {
  sheets: PackedSheet<R>[];
  /** parts too big for the sheet in either direction */
  tooBig: R[];
}

// ---- Warning chips (lib/pa/chips) ----

export type ChipSeverity = "ok" | "warn" | "bad";
/** A check on a design: a severity, a short title and a sentence of detail. */
export type Chip = [severity: ChipSeverity, title: string, detail: string];

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
  order?: CrossoverOrder;
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

/** The fields an older saved design can lack; the optimizer fills these in. */
export type PaDefaultedField =
  | "xoLo"
  | "xoHi"
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
  chips: { sub: Chip[]; mid: Chip[]; horn: Chip[] };
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
  /** the planner's warnings on this design as [title, detail] */
  warnings: [title: string, detail: string][];
  /** the mid's Qtc and the sheets of ply each thickness needs */
  build: { qtc: number; sheets: { t: number; n: number }[] };
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
  | { id: number; out: R; error?: undefined }
  | { id: number; error: string; out?: undefined };

// ---- Saved configurations ----

/** What a page hands to `save`: its snapshot of the design (and a `summary` line); the store adds `name` and `savedAt`. */
export type SavedConfigData = Record<string, unknown>;

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
