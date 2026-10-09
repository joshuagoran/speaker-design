// The parts catalog as the app reads it. The tables themselves live in src/data/catalog/ (pure data, one module
// per kind); this module only derives from them: the comparable Xmax, tweeter faceplates, picker sort order and the
// starting parts. Plain data, no React. Dimensions in inches (outer). Verify every driver spec and price against the
// vendor before ordering.
import type {
  AmpId,
  AmpModel,
  AmpSeries,
  BodyStep,
  DspUnit,
  DspUnitId,
  RackItem,
  PriceRange,
  RackView,
  CabinetFinish,
  CoaxParts,
  CompressionDriver,
  FillDriver,
  FinishId,
  HifiTweeter,
  HifiTweeterRaw,
  HifiWaveguide,
  HifiWoofer,
  Horn,
  MidDriver,
  MakerId,
  MountAdapter,
  MidSize,
  OwnGuide,
  PassiveRadiator,
  RawTS,
  SubDriver,
  SubSize,
  ThieleSmall,
  ThroatMountKind,
  ThroatThread,
  WaveguideSpec,
} from "../types";
import { CABINET_FINISHES } from "../data/catalog/finishes";
import { CD_RAW } from "../data/catalog/compression-drivers";
import { BC10CXN64_RAW, FILL_RAW } from "../data/catalog/fills";
import { HIFI_PASSIVES_RAW } from "../data/catalog/passive-radiators";
import { HIFI_TWEETERS_RAW, SB26STCN_RAW } from "../data/catalog/hifi-tweeters";
import { HIFI_WOOFERS_RAW, SB17NRX_RAW } from "../data/catalog/hifi-woofers";
import { HORN_RAW } from "../data/catalog/horns";
import { BC15NDL76_RAW, F12PR300_RAW, MID_RAW } from "../data/catalog/mids";
import { BC18NBX_RAW, SUB_RAW } from "../data/catalog/subs";
import { passiveWithXmax, withXmax } from "./xmax";
import { AMP_SERIES } from "../data/catalog/amps";
import { DSP_UNITS } from "../data/catalog/dsp-units";
import { MAINS_RACK, RACKS as RACK_TABLE } from "../data/catalog/racks";
import { CATALOG_TABLE_NAMES } from "../constants/catalogTables";
import { COAX_GAP, COAX_HF_EXIT_IN, COAXIAL_TWEETER_TYPE } from "../constants/coax";
import { MOUNT_ADAPTERS } from "../data/catalog/mount-adapters";
import { BOLT_MOUNT, THREAD_MOUNT } from "../constants/throatMounts";
import { byId, byIdOrThrow } from "./tables";

// Tables the app reads as written.
export { CABINETS } from "../data/catalog/cabinets";
export { N314T } from "../data/catalog/compression-drivers";
export { DSP_UNITS };
export { CABINET_FINISHES, PAINT_SWATCHES } from "../data/catalog/finishes";
export { FORMATS } from "../data/catalog/formats";
export { A460G2_14, ST260, ST260_PROFILE } from "../data/catalog/horns";
export { B15, B18, MID_BOXES } from "../data/catalog/mid-boxes";
export { HORN_AMP_SAFETY_HPF_HZ } from "../data/catalog/racks";
export { MOUNT_ADAPTERS };

// Every driver table holds the maker's excursion figures; this adds the comparable Xmax the models read.
const withTsXmax = <D extends { name: string; maker: MakerId; ts: RawTS<ThieleSmall> }>(d: D) => ({
  ...d,
  ts: withXmax(d.ts, d.maker, d.name),
});

export const BC18NBX: SubDriver = withTsXmax(BC18NBX_RAW);
export const SUB_OPTIONS: SubDriver[] = SUB_RAW.map((d) =>
  d === BC18NBX_RAW ? BC18NBX : withTsXmax(d),
);

export const F12PR300: MidDriver = withTsXmax(F12PR300_RAW);
export const BC15NDL76: MidDriver = withTsXmax(BC15NDL76_RAW);
export const MID_OPTIONS: MidDriver[] = MID_RAW.map((d) =>
  d === F12PR300_RAW ? F12PR300 : d === BC15NDL76_RAW ? BC15NDL76 : withTsXmax(d),
);

/** The sub drivers for a sub size class (15 or 18 in). */
export const subDriversOfSize = (size: SubSize) => SUB_OPTIONS.filter((o) => o.size === size);

/** The mid drivers for a mid size class (10, 12 or 15 in). */
export const midDriversOfSize = (size: MidSize) => MID_OPTIONS.filter((o) => o.size === size);

// Copies, so the sort below leaves the catalog tables as written.
export const CD_OPTIONS: CompressionDriver[] = [...CD_RAW];
/** A horn the PA side offers (its picker, both optimizers, saves): every horn but the Hi-fi-only small waveguides. */
const isPaHorn = (h: Horn) => h.scope !== "hifi";
/** The PA horns. */
export const HORN_OPTIONS: Horn[] = HORN_RAW.filter(isPaHorn);

/** A turned part's length (its steps end to end), in. */
export const stepsLength = (steps: readonly BodyStep[]) =>
  steps.reduce((sum, [, len]) => sum + len, 0);
/** A turned part's largest diameter, in. */
export const stepsDia = (steps: readonly BodyStep[]) => Math.max(...steps.map(([dia]) => dia));
/**
 * A compression driver's outline front to back: its own steps, or, where no photo gives them, a generic body from the
 * published diameter and depth (a full-width front plate, the magnet a little narrower, a smaller rear cap).
 */
export const cdBodySteps = ({
  dia,
  depth,
  steps,
}: CompressionDriver["body"]): readonly BodyStep[] =>
  steps ?? [
    [dia, depth * 0.12],
    [dia * 0.94, depth * 0.68],
    [dia * 0.75, depth * 0.2],
  ];
/** How far a horn reaches behind its mouth: the body and its throat adapter, in. */
export const hornDepth = ({ size, adapter }: Pick<Horn, "size" | "adapter">) =>
  size.d + (adapter ? stepsLength(adapter.steps) : 0);

const isFinishId = (value: string): value is FinishId => Object.hasOwn(CABINET_FINISHES, value);
/** The named finish for a cabinet's `cabFinish`, or undefined when it is a paint color (a hex string). */
export function cabinetFinishOf(value: string): CabinetFinish | undefined {
  return isFinishId(value) ? CABINET_FINISHES[value] : undefined;
}
/** A cabinet finish as the summaries name it: the named finish, or "painted" and the paint's hex color. */
export const cabinetFinishName = (value: string) =>
  cabinetFinishOf(value)?.name ?? `painted ${value}`;

// Pickers list alphabetically.
export const sortedByName = <T extends { name: string }>(arr: readonly T[]): T[] =>
  [...arr].sort((a, b) =>
    a.name.localeCompare(b.name, "en", { numeric: true, sensitivity: "base" }),
  );
[SUB_OPTIONS, MID_OPTIONS, CD_OPTIONS, HORN_OPTIONS].forEach((arr: { name: string }[]) =>
  arr.splice(0, arr.length, ...sortedByName(arr)),
);
/** A horn the Hi-fi page offers as a waveguide: a 1-inch throat, with its coverage specs and size. */
const isHifiWaveguide = (h: Horn): h is HifiWaveguide => h.exit === 1 && !!h.hf?.covH && !!h.size;
/** The Hi-fi page's waveguides, from every horn (the Hi-fi-only ones included), A–Z. */
export const HIFI_WAVEGUIDES: readonly HifiWaveguide[] =
  sortedByName(HORN_RAW).filter(isHifiWaveguide);

export const BC10CXN64: FillDriver = withTsXmax(BC10CXN64_RAW);
export const FILL_OPTIONS: readonly FillDriver[] = FILL_RAW.map((d) =>
  d === BC10CXN64_RAW ? BC10CXN64 : withTsXmax(d),
).sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }));

/** A cone's diameter from its area (Sd, cm²), inches. */
const coneDiaIn = (sdCm2: number) => (2 * Math.sqrt(sdCm2 / Math.PI)) / 2.54;
/**
 * A coaxial from the fill catalogue as the Hi-fi engine takes it, both parts under the coaxial's id:
 * - the woofer: its T/S, LF sensitivity, weight and price (the whole driver's: they count once);
 * - the HF section as a coincident tweeter of type "coaxial": sensitivity, power and impedance from `hf`, its minimum
 *   crossover the recommended one (its AES rating holds down to it), no weight or price of its own, and the woofer's
 *   cone as its conical waveguide at the published coverage (the mouth the cone's diameter).
 * A coaxial without HF data keeps its woofer, with the HF part null; `gaps` names what is missing.
 */
export function coaxParts(d: FillDriver): CoaxParts {
  const { hf, ts } = d;
  const cone = coneDiaIn(ts.Sd);
  const woofer: HifiWoofer = {
    id: d.id,
    size: d.size,
    lb: d.lb,
    name: d.name,
    maker: d.maker,
    price: d.price,
    src: d.src,
    ts: { ...ts, sens: d.lfSens },
    // the LF section's own top isn't published: its HF takes over at the crossover
    fmax: null,
    note: d.note,
  };
  if (!hf) return { woofer, tweeter: null, gaps: [COAX_GAP.hf] };
  const tweeter: HifiTweeter = {
    id: d.id,
    lb: 0,
    name: d.name,
    price: 0,
    src: d.src,
    hf: { sens: hf.sens, aes: hf.aes, aesXo: hf.xo, minXo: hf.xo, imp: hf.imp, fs: null },
    type: COAXIAL_TWEETER_TYPE,
    exit: null,
    faceplate: { w: cone, h: cone },
    note: d.note,
    domeIn: COAX_HF_EXIT_IN,
    ...(hf.cov != null && {
      ownGuide: { name: d.name, covH: hf.cov, covV: hf.cov, w: cone, h: cone },
    }),
  };
  const gaps = [
    ...(hf.xo == null ? [COAX_GAP.hfXo] : []),
    ...(hf.cov == null ? [COAX_GAP.hfCov] : []),
  ];
  return { woofer, tweeter, gaps };
}
/** Every fill coaxial as Hi-fi parts, in the fills' (A–Z) order. No picker lists them yet: a design names one by id. */
export const HIFI_COAXES: readonly CoaxParts[] = FILL_OPTIONS.map(coaxParts);
/** The coaxials' woofers, and the HF parts of those that publish one. */
export const HIFI_COAX_WOOFERS: readonly HifiWoofer[] = HIFI_COAXES.map((c) => c.woofer);
export const HIFI_COAX_TWEETERS: readonly HifiTweeter[] = HIFI_COAXES.flatMap((c) =>
  c.tweeter ? [c.tweeter] : [],
);
const COAX_GAPS_BY_ID: ReadonlyMap<string, CoaxParts["gaps"]> = new Map(
  HIFI_COAXES.map((c) => [c.woofer.id, c.gaps]),
);
/** The HF figures a coaxial's maker doesn't publish, by its id; none for any other part. */
export const coaxGaps = (id: string): CoaxParts["gaps"] => COAX_GAPS_BY_ID.get(id) ?? [];

// Give every tweeter a faceplate size and radiating diameter the layout and directivity use.
const withFaceplate = (t: HifiTweeterRaw): HifiTweeter => {
  const fp = t.faceplate;
  const diameter = fp && "diameter" in fp ? fp.diameter : 0;
  return {
    ...t,
    faceplate: !fp
      ? { w: 3.5, h: 3.5 }
      : "diameter" in fp
        ? { w: fp.diameter, h: fp.diameter }
        : fp,
    // radiating diameter for the directivity: the dome, or the horn mouth for a horn-loaded tweeter
    domeIn: t.type === "horn-loaded" ? diameter || 3 : t.exit || 1,
  };
};
/** The tweeter the hi-fi planner starts on, as the table holds it (with its faceplate and dome size). */
export const SB26STCN: HifiTweeter = withFaceplate(SB26STCN_RAW);
export const HIFI_TWEETERS: readonly HifiTweeter[] = HIFI_TWEETERS_RAW.map((t) =>
  t === SB26STCN_RAW ? SB26STCN : withFaceplate(t),
);

export const SB17NRX: HifiWoofer = withTsXmax(SB17NRX_RAW);
export const HIFI_WOOFERS: readonly HifiWoofer[] = HIFI_WOOFERS_RAW.map((d) =>
  d === SB17NRX_RAW ? SB17NRX : withTsXmax(d),
);

/** The Hi-fi driver parts a design, card or save names by id. */
interface HifiDriverParts {
  woofer: HifiWoofer;
  tweeter: HifiTweeter;
}
/** Each part's drivers: its table's, then the coaxials' (a coaxial design names its coaxial as both). */
const HIFI_DRIVER_TABLES: { [P in keyof HifiDriverParts]: readonly HifiDriverParts[P][] } = {
  woofer: [...HIFI_WOOFERS, ...HIFI_COAX_WOOFERS],
  tweeter: [...HIFI_TWEETERS, ...HIFI_COAX_TWEETERS],
};
const HIFI_DRIVER_TABLE_NAMES = {
  woofer: CATALOG_TABLE_NAMES.hifiWoofers,
  tweeter: CATALOG_TABLE_NAMES.hifiTweeters,
} as const satisfies Record<keyof HifiDriverParts, string>;
/** A Hi-fi woofer or tweeter by id, the coaxials' parts included; undefined when there is none (a save's stale id). */
export function hifiDriverById<P extends keyof HifiDriverParts>(
  part: P,
  id: string,
): HifiDriverParts[P] | undefined {
  const table: readonly HifiDriverParts[P][] = HIFI_DRIVER_TABLES[part];
  return byId(table, id);
}
/** The same for an id the tables gave (a card's, the design's own): throws when there is none. */
export function hifiDriverByIdOrThrow<P extends keyof HifiDriverParts>(
  part: P,
  id: string,
): HifiDriverParts[P] {
  const table: readonly HifiDriverParts[P][] = HIFI_DRIVER_TABLES[part];
  return byIdOrThrow(table, id, HIFI_DRIVER_TABLE_NAMES[part]);
}

export const HIFI_PASSIVES: readonly PassiveRadiator[] = HIFI_PASSIVES_RAW.map(passiveWithXmax);
// a tweeter's own waveguide (a ribbon's plate, a coaxial's cone) as the model's guide object (flush-mounted)
export const ownGuideCfg = (
  t: HifiTweeter | null | undefined,
): (OwnGuide & { freestanding: boolean }) | null =>
  t && t.ownGuide ? { ...t.ownGuide, freestanding: false } : null;
/**
 * A picked waveguide (a horn with coverage specs) as the model's guide object: its coverage (V as H when unpublished),
 * mouth, name, lowest crossover and pattern-control limit; a round one stands free on the box top, the full-width
 * rectangle sits in the baffle.
 */
export const waveguideSpecOf = (h: HifiWaveguide): WaveguideSpec => ({
  covH: h.hf.covH,
  covV: h.hf.covV || h.hf.covH,
  w: h.size.w,
  h: h.size.h,
  name: h.name,
  freestanding: !h.rect,
  minXo: h.hf.minXo,
  lowHz: h.hf.lowHz,
  ...(h.mount ? { mount: h.mount } : {}),
});

// ---- Throat mounts: how a compression driver meets its waveguide, and the adapter a mixed pair needs ----

/** A driver's screw-on thread, or null for a bolt-on one. */
const driverThread = ({ mount }: Pick<HifiTweeter, "mount">): ThroatThread | null =>
  mount && "thread" in mount ? mount.thread : null;
/** How a driver meets a horn's throat: screw-on when its mount is a thread, else bolt-on (the default). */
export const driverMountKind = (t: Pick<HifiTweeter, "mount">): ThroatMountKind =>
  driverThread(t) ? THREAD_MOUNT : BOLT_MOUNT;
/** How a horn takes its driver: screw-on when it has a thread, else bolt-on (its throat flange). */
export const hornMountKind = ({ mount }: Pick<WaveguideSpec, "mount">): ThroatMountKind =>
  mount ? THREAD_MOUNT : BOLT_MOUNT;
/**
 * A compression driver on a waveguide: direct when both bolt on or both screw on with the same thread, else through the
 * catalogue's adapter from the driver's mount to the horn's; null when nothing joins them (two different threads, or no
 * adapter between the two kinds: the pair doesn't fit).
 */
export function throatJoin(
  t: Pick<HifiTweeter, "mount">,
  guide: Pick<WaveguideSpec, "mount">,
  adapters: readonly MountAdapter[] = MOUNT_ADAPTERS,
): { adapter: MountAdapter | null } | null {
  const driver = driverMountKind(t),
    horn = hornMountKind(guide);
  if (driver === horn)
    return driver === BOLT_MOUNT || driverThread(t) === guide.mount?.thread
      ? { adapter: null }
      : null;
  const adapter = adapters.find((a) => a.driver === driver && a.horn === horn);
  return adapter ? { adapter } : null;
}
/**
 * What the throat adds to one speaker's cost: the adapter's price when the driver sits on the catalogue waveguide
 * `guide` (null: it doesn't, as a dome or a ribbon on its own) and the pair needs one; 0 for a direct pair or one that
 * doesn't fit; null when the adapter it needs has no US price (the cost can't include it).
 */
export function throatAdapterPrice(
  t: Pick<HifiTweeter, "mount">,
  guide: Pick<WaveguideSpec, "mount"> | null,
  adapters: readonly MountAdapter[] = MOUNT_ADAPTERS,
): number | null {
  const adapter = guide && throatJoin(t, guide, adapters)?.adapter;
  return adapter ? adapter.price : 0;
}
/**
 * Whether the optimizer offers a driver on this waveguide: it fits, directly or through a priced adapter (the catalogue
 * rule for unpriced parts: the search leaves them out unless you lock them).
 */
export function throatOffered(
  t: Pick<HifiTweeter, "mount">,
  guide: Pick<WaveguideSpec, "mount">,
  adapters: readonly MountAdapter[] = MOUNT_ADAPTERS,
): boolean {
  const join = throatJoin(t, guide, adapters);
  return !!join && (!join.adapter || join.adapter.price != null);
}
export const passiveRadiatorMassMax = (p: PassiveRadiator): number =>
  Math.round((p.maxAddG ?? 3 * p.Mms) / 5) * 5;

// ---- Racks: a line that names a catalog part takes that part's name (and, for an amp, its rating and price) ----

/** An amp by id, with its series (for the brand). */
export function ampById(id: AmpId): { series: AmpSeries; model: AmpModel } {
  for (const series of AMP_SERIES)
    for (const model of series.models) if (model.id === id) return { series, model };
  throw new Error(`${CATALOG_TABLE_NAMES.amps}: no entry with id "${id}"`);
}

/** A DSP unit by id. */
export const dspUnitById = (id: DspUnitId): DspUnit =>
  byIdOrThrow(DSP_UNITS, id, CATALOG_TABLE_NAMES.dspUnits);

/** A single price as a range. */
const exactly = (price: number): PriceRange => ({ lo: price, hi: price });

/** A rack line's words and price. */
function rackLine(item: RackItem): RackView["items"][number] {
  if ("amp" in item) {
    const { series, model } = ampById(item.amp);
    const what = [item.use, item.rating && `${model.w8} W/ch at 8 Ω`, item.note].filter(Boolean);
    return {
      label: `${series.brand} ${model.model} (used) — ${what.join(", ")}`,
      price: exactly(model.usedPrice),
    };
  }
  if ("dsp" in item) {
    const unit = dspUnitById(item.dsp);
    // the id's type admits only priced units; this guards a catalog edit that drops the price
    if (!unit.usedPrice)
      throw new Error(`${CATALOG_TABLE_NAMES.dspUnits}: ${item.dsp} has no used price`);
    return { label: `${unit.row.unit} (used) — ${item.note}`, price: unit.usedPrice };
  }
  const [label, price] = item;
  return { label, price: exactly(price) };
}

/** A price range in dollars: $300–400, or $300 when it is one price. */
export const formatPriceRange = ({ lo, hi }: PriceRange): string =>
  lo === hi ? `$${lo.toLocaleString()}` : `$${lo.toLocaleString()}–${hi.toLocaleString()}`;

/** A rack's total, low to high: the sum of its lines' ranges. */
export const rackTotal = (r: RackView): PriceRange =>
  r.items.reduce((t, i) => ({ lo: t.lo + i.price.lo, hi: t.hi + i.price.hi }), exactly(0));

/** The racks with every line in words. */
export const RACKS: readonly RackView[] = RACK_TABLE.map((r) => ({
  ...r,
  items: r.items.map(rackLine),
}));

/** The DSP units the racks use: the Notes table marks them "(current)". */
export const RACK_DSP_IDS: ReadonlySet<DspUnitId> = new Set(
  RACK_TABLE.flatMap((r) => r.items.flatMap((i) => ("dsp" in i ? [i.dsp] : []))),
);

/** The mains rack's processor, as the signal-path drawing names it. */
export function mainsDsp(): DspUnit {
  for (const i of MAINS_RACK.items) if ("dsp" in i) return dspUnitById(i.dsp);
  throw new Error("racks: the mains rack lists no DSP unit");
}
