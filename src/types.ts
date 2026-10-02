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
