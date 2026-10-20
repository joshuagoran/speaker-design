// The figures the Notes page quotes about the PA stack's starting design, read from the defaults and the catalog so
// a change of default part, price or rating shows up in the prose. Nothing here names a part itself.
import { DEFAULT_PA } from "./defaults";
import { PANEL_NOMINAL_NAMES, PLYWOOD_MATERIAL } from "../constants/panelSizes";
import { PANEL_NOMINALS, panelIn } from "./build/panel";
import { MAKER_NAMES } from "../data/catalog/makers";
import { subBoxBracing, subWeightLb } from "./acoustics/boxModels";
import { midbandLevelDb } from "./acoustics/driverCircuit";
import { ONE_WATT_VOLTS } from "../constants/speakerSpec";
import { hardwareLb } from "./build/hardware";
import { formatDollars, formatHz } from "./format";
import { crossoverSlopeName } from "../constants/crossovers";

const d = DEFAULT_PA;

/** The default compression driver's name, price and AES rating; throws if its entry loses the price or rating. */
function compressionDriver() {
  const { cd } = d;
  if (!cd.hf || cd.price === null)
    throw new Error(`${cd.name}: the Notes page quotes the default driver's AES rating and price`);
  return { name: cd.name, price: formatDollars(cd.price), aes: cd.hf.aes };
}
export const DEFAULT_CD = compressionDriver();

/** The default horn's name and the print bed it needs in one piece, mm (its mouth, rounded to 10 mm). */
export const DEFAULT_HORN = {
  name: d.horn.name,
  bedMm: Math.round((Math.max(d.horn.size.w, d.horn.size.h) * 25.4) / 10) * 10,
};

/** The default mid-to-horn crossover in words. */
export const DEFAULT_XO_HI = formatHz(d.xoHi);

/** The signal path's crossover line: the default highpass and both crossovers with their slopes. */
export const DEFAULT_CROSSOVERS = `sub HPF ~${d.hpf} Hz ${d.hpType} · sub/mid ${formatHz(d.xoLo)} ${crossoverSlopeName(d.xoLoOrder)} · mid/horn ~${formatHz(d.xoHi)} ${crossoverSlopeName(d.xoHiOrder)}`;

/** The default wall's nominal size in words (¾″). */
export const DEFAULT_WALL = PANEL_NOMINAL_NAMES[d.panel].short;

/**
 * The default sub box's loaded weight on each nominal plywood size the app offers, thickest first, with the braces
 * and ribs the rule puts in at that size (its default style) and its default handles, dish and jacks; and how many of
 * each.
 */
export const DEFAULT_SUB_WEIGHTS = PANEL_NOMINALS.map((n) => {
  const t = panelIn(n, PLYWOOD_MATERIAL);
  const b = subBoxBracing(
    d.cDim,
    t,
    d.inset,
    d.portStyle,
    d.cVent,
    d.sub,
    undefined,
    d.hardware.sub,
    d.backJoint,
  );
  return {
    t: PANEL_NOMINAL_NAMES[n].short,
    lb: Math.round(subWeightLb(d.cDim, t, d.sub.lb, b, hardwareLb(d.hardware, "sub", d.layout))),
    windows: b.windows.x.length + b.windows.y.length + b.windows.z.length,
    ribs: b.ribs.reduce((a, r) => a + r.at.length, 0),
  };
});

/** The default sub's 2.83 V sensitivity from its T/S: its midband level (`midbandLevelDb`). */
function subTsSensitivity(): number {
  if (!d.sub.ts) throw new Error(`${d.sub.name}: the default sub can't be modeled`);
  return midbandLevelDb(d.sub.ts, ONE_WATT_VOLTS);
}

/** The default sub: its name, maker, published sensitivity and mounting depth (where entered) and its T/S sensitivity. */
export const DEFAULT_SUB = {
  name: d.sub.name,
  maker: MAKER_NAMES[d.sub.maker],
  sens: d.sub.sens,
  depthIn: d.sub.depthIn,
  tsSens: subTsSensitivity(),
};
