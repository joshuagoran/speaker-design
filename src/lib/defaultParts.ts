// The figures the Notes page quotes about the PA stack's starting design, read from the defaults and the catalogue so
// a change of default part, price or rating shows up in the prose. Nothing here names a part itself.
import { DEFAULT_PA } from "./defaults";
import { PANEL_NOMINAL_NAMES, PLYWOOD_MATERIAL } from "../constants/panelSizes";
import { PANEL_NOMINALS, panelIn } from "./panel";
import { MAKER_NAMES } from "../data/catalog/makers";
import { subBoxBracing, subSystem, subWeightLb } from "./pa/calc";
import { hardwareLb } from "./pa/hardware";
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
 * The default sub box's loaded weight on each nominal plywood size the planner offers, thickest first, with the braces
 * and ribs the rule puts in at that size (its default style) and its default handles, dish and jacks, as the planner
 * weighs it; and how many of each.
 */
export const DEFAULT_SUB_WEIGHTS = PANEL_NOMINALS.map((n) => {
  const t = panelIn(n, PLYWOOD_MATERIAL);
  const b = subBoxBracing(d.cDim, t, d.inset, d.portStyle, d.cVent, d.sub, undefined);
  return {
    t: PANEL_NOMINAL_NAMES[n].short,
    lb: Math.round(subWeightLb(d.cDim, t, d.sub.lb, b, hardwareLb(d.hardware, "sub", d.layout))),
    windows: b.windows.x.length + b.windows.y.length + b.windows.z.length,
    ribs: b.ribs.reduce((a, r) => a + r.at.length, 0),
  };
});

/** The default sub's 2.83 V sensitivity from its T/S in the default box, as the PA page's sub section shows it. */
function subTsSensitivity(): number {
  const sys = subSystem(d.sub, d.mid, {
    subBox: d.cDim,
    midDims: d.mDim,
    wall: d.wall,
    inset: d.inset,
    portStyle: d.portStyle,
    cVent: d.cVent,
    hpf: d.hpf,
    hpType: d.hpType,
    ampW: d.ampW,
    portMax: d.portMax,
    layout: d.layout,
    hardware: d.hardware,
    xoLo: d.xoLo,
  });
  if (!sys.mdl) throw new Error(`${d.sub.name}: the default sub can't be modelled`);
  return sys.mdl.ref - 20 * Math.log10(sys.AMP_V / 2.83);
}

/** The default sub: its name, maker, published sensitivity and mounting depth (where entered) and its T/S sensitivity. */
export const DEFAULT_SUB = {
  name: d.sub.name,
  maker: MAKER_NAMES[d.sub.maker],
  sens: d.sub.sens,
  depthIn: d.sub.depthIn,
  tsSens: subTsSensitivity(),
};
