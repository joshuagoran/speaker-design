// The parts catalogue as the app reads it. The tables themselves live in src/data/catalog/ (pure data, one module
// per kind); this module only derives from them: the comparable Xmax, tweeter faceplates, picker sort order and the
// starting parts. Plain data, no React. Dimensions in inches (outer). Verify every driver spec and price against the
// vendor before ordering.
import type {
  CabinetFinish,
  CompressionDriver,
  FillDriver,
  FinishId,
  HifiTweeter,
  HifiTweeterRaw,
  HifiWoofer,
  Horn,
  MidDriver,
  MakerId,
  MidSize,
  OwnGuide,
  PassiveRadiator,
  RawTS,
  SubDriver,
  SubSize,
  ThieleSmall,
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

// Tables the app reads as written.
export { CABINETS } from "../data/catalog/cabinets";
export { N314T } from "../data/catalog/compression-drivers";
export { DSP_UNITS } from "../data/catalog/dsp-units";
export { CABINET_FINISHES, PAINT_SWATCHES } from "../data/catalog/finishes";
export { FORMATS } from "../data/catalog/formats";
export { A460G2_14, ST260, ST260_PROFILE } from "../data/catalog/horns";
export { B15, B18, MID_BOXES } from "../data/catalog/mid-boxes";
export { RACKS } from "../data/catalog/racks";

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

// Copies, so the sort below leaves the catalogue tables as written.
export const CD_OPTIONS: CompressionDriver[] = [...CD_RAW];
export const HORN_OPTIONS: Horn[] = [...HORN_RAW];

const isFinishId = (value: string): value is FinishId => Object.hasOwn(CABINET_FINISHES, value);
/** The named finish for a cabinet's `cabFinish`, or undefined when it is a paint colour (a hex string). */
export function cabinetFinishOf(value: string): CabinetFinish | undefined {
  return isFinishId(value) ? CABINET_FINISHES[value] : undefined;
}

// Pickers list alphabetically.
export const sortedByName = <T extends { name: string }>(arr: readonly T[]): T[] =>
  [...arr].sort((a, b) =>
    a.name.localeCompare(b.name, "en", { numeric: true, sensitivity: "base" }),
  );
[SUB_OPTIONS, MID_OPTIONS, CD_OPTIONS, HORN_OPTIONS].forEach((arr: { name: string }[]) =>
  arr.splice(0, arr.length, ...sortedByName(arr)),
);

export const BC10CXN64: FillDriver = withTsXmax(BC10CXN64_RAW);
export const FILL_OPTIONS: readonly FillDriver[] = FILL_RAW.map((d) =>
  d === BC10CXN64_RAW ? BC10CXN64 : withTsXmax(d),
).sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }));

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

export const HIFI_PASSIVES: readonly PassiveRadiator[] = HIFI_PASSIVES_RAW.map(passiveWithXmax);
// a ribbon's own waveguide as the model's guide object (flush-mounted)
export const ownGuideCfg = (
  t: HifiTweeter | null | undefined,
): (OwnGuide & { freestanding: boolean }) | null =>
  t && t.ownGuide ? { ...t.ownGuide, freestanding: false } : null;
export const passiveRadiatorMassMax = (p: PassiveRadiator): number =>
  Math.round((p.maxAddG ?? 3 * p.Mms) / 5) * 5;
