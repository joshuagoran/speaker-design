// The parts catalog as the app reads it. The tables themselves live in src/data/catalog/ (pure data, one module
// per kind); this module only derives from them: the comparable Xmax, tweeter faceplates, picker sort order and the
// starting parts. Plain data, no React. Dimensions in inches (outer). Verify every driver spec and price against the
// vendor before ordering.
import type {
  BodyStep,
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
  OwnGuide,
  PassiveRadiator,
  RawTS,
  SpeakerSubDriver,
  SubDriver,
  ThieleSmall,
  ThroatMountKind,
  ThroatThread,
  WaveguideSpec,
} from "../types";
import { CABINET_FINISHES, PAINT_SWATCHES } from "../data/catalog/finishes";
import { CD_RAW } from "../data/catalog/compression-drivers";
import { BC10CXN64_RAW, FILL_RAW } from "../data/catalog/fills";
import { HIFI_PASSIVES_RAW } from "../data/catalog/passive-radiators";
import { HIFI_TWEETERS_RAW, SB26STCN_RAW } from "../data/catalog/hifi-tweeters";
import { HIFI_WOOFERS_RAW, SB17NRX_RAW } from "../data/catalog/hifi-woofers";
import { HORN_RAW } from "../data/catalog/horns";
import { BC15NDL76_RAW, F12PR300_RAW, MID_RAW } from "../data/catalog/mids";
import { BC18NBX_RAW, SUB_RAW } from "../data/catalog/subs";
import { PD1850_RAW, SPEAKER_SUB_RAW } from "../data/catalog/speaker-subs";
import { passiveWithXmax, withXmax } from "./xmax";
import { COAX_GAP, COAX_HF_EXIT_IN, COAXIAL_TWEETER_TYPE } from "../constants/coax";
import { BOLT_MOUNT, THREAD_MOUNT } from "../constants/throatMounts";
import { byId } from "./tables";

// Tables the app reads as written.
export { CABINETS } from "../data/catalog/cabinets";
export { N314T } from "../data/catalog/compression-drivers";
export { CABINET_FINISHES, NEAR_BLACK_PAINT, PAINT_SWATCHES } from "../data/catalog/finishes";
export { FORMATS } from "../data/catalog/formats";
export { A460G2_14, ST260 } from "../data/catalog/horns";
export { B15 } from "../data/catalog/mid-boxes";
// Every driver table holds the maker's excursion figures; this adds the comparable Xmax the models read.
const withTsXmax = <D extends { name: string; maker: MakerId; ts: RawTS<ThieleSmall> }>(d: D) => ({
  ...d,
  ts: withXmax(d.ts, d.maker, d.name),
});

export const BC18NBX: SubDriver = withTsXmax(BC18NBX_RAW);
export const SUB_OPTIONS: SubDriver[] = SUB_RAW.map((d) =>
  d === BC18NBX_RAW ? BC18NBX : withTsXmax(d),
);
/** TH18's driver (no US price), and the sub drivers the Speaker page offers: the PA's, then its own. */
export const PD1850: SpeakerSubDriver = withTsXmax(PD1850_RAW);
export const SPEAKER_SUB_OPTIONS: SpeakerSubDriver[] = [
  ...SUB_OPTIONS,
  ...SPEAKER_SUB_RAW.map((d) => (d === PD1850_RAW ? PD1850 : withTsXmax(d))),
];

export const F12PR300: MidDriver = withTsXmax(F12PR300_RAW);
export const BC15NDL76: MidDriver = withTsXmax(BC15NDL76_RAW);
export const MID_OPTIONS: MidDriver[] = MID_RAW.map((d) =>
  d === F12PR300_RAW ? F12PR300 : d === BC15NDL76_RAW ? BC15NDL76 : withTsXmax(d),
);

// Copies, so the sort below leaves the catalog tables as written.
export const CD_OPTIONS: CompressionDriver[] = [...CD_RAW];
/** A horn the PA side offers (its picker, both optimizers, saves): every horn but the Hi-fi-only small waveguides. */
const isPaHorn = (h: Horn) => h.scope !== "hifi";
/** The PA horns. */
export const HORN_OPTIONS: Horn[] = HORN_RAW.filter(isPaHorn);
/** Any catalog horn by id, the Hi-fi-only waveguides included; undefined when there is none (a save's stale id). */
export const hornById = (id: string): Horn | undefined => byId(HORN_RAW, id);

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
/** A paint color as the summaries name it: its swatch's name, lower case, or its hex color when it is a custom one. */
export const paintName = (hex: string) =>
  PAINT_SWATCHES.find(
    ([swatch]) => swatch.toLowerCase() === hex.toLowerCase(),
  )?.[1].toLowerCase() ?? hex;
/** A cabinet finish as the summaries name it: the named finish, or "painted" and the paint's name. */
export const cabinetFinishName = (value: string) =>
  cabinetFinishOf(value)?.name ?? `painted ${paintName(value)}`;

// Pickers list alphabetically.
export const sortedByName = <T extends { name: string }>(arr: readonly T[]): T[] =>
  [...arr].sort((a, b) =>
    a.name.localeCompare(b.name, "en", { numeric: true, sensitivity: "base" }),
  );
[SUB_OPTIONS, MID_OPTIONS, CD_OPTIONS, HORN_OPTIONS].forEach((arr: { name: string }[]) =>
  arr.splice(0, arr.length, ...sortedByName(arr)),
);
/** A horn a hi-fi design offers as a waveguide: a 1-inch throat, with its coverage specs and size. */
const isHifiWaveguide = (h: Horn): h is HifiWaveguide => h.exit === 1 && !!h.hf?.covH && !!h.size;
/** The hi-fi waveguides, from every horn (the Hi-fi-only ones included), A–Z. */
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
/** The tweeter the default hi-fi design starts on, as the table holds it (with its faceplate and dome size). */
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
/** A Hi-fi woofer or tweeter by id, the coaxials' parts included; undefined when there is none (a save's stale id). */
export function hifiDriverById<P extends keyof HifiDriverParts>(
  part: P,
  id: string,
): HifiDriverParts[P] | undefined {
  const table: readonly HifiDriverParts[P][] = HIFI_DRIVER_TABLES[part];
  return byId(table, id);
}
export const HIFI_PASSIVES: readonly PassiveRadiator[] = HIFI_PASSIVES_RAW.map(passiveWithXmax);
// a tweeter's own waveguide (a ribbon's or an AMT's plate, a coaxial's cone) as the model's guide object (flush-mounted)
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
export const passiveRadiatorMassMax = (p: PassiveRadiator): number =>
  Math.round((p.maxAddG ?? 3 * p.Mms) / 5) * 5;
