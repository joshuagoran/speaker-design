// The figures the Notes page quotes about the PA stack's starting design, read from the defaults and the catalogue so
// a change of default part, price or rating shows up in the prose. Nothing here names a part itself.
import { DEFAULT_PA } from "./defaults";
import { PLYWOOD_LB_PER_SQ_FT } from "../data/catalog/plywood";
import { MAKER_NAMES } from "../data/catalog/makers";
import { subSystem, subWeightLb } from "./pa/calc";
import { formatDollars, formatInches } from "./format";
import { keysOf } from "./records";
import { crossoverSlopeName } from "../constants/crossovers";

const d = DEFAULT_PA;

/** A crossover frequency in words: 900 Hz, 1.1 kHz. */
const hz = (f: number) => (f >= 1000 ? `${+(f / 1000).toFixed(1)} kHz` : `${f} Hz`);

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
export const DEFAULT_XO_HI = hz(d.xoHi);

/** The signal path's crossover line: the default highpass and both crossovers with their slopes. */
export const DEFAULT_CROSSOVERS = `sub HPF ~${d.hpf} Hz ${d.hpType} · sub/mid ${hz(d.xoLo)} ${crossoverSlopeName(d.xoLoOrder)} · mid/horn ~${hz(d.xoHi)} ${crossoverSlopeName(d.xoHiOrder)}`;

/** The default sub box's loaded weight on each plywood thickness the planner models, thickest first. */
export const DEFAULT_SUB_WEIGHTS = keysOf(PLYWOOD_LB_PER_SQ_FT)
  .map(Number)
  .sort((a, b) => b - a)
  .map((t) => ({ t: formatInches(t), lb: Math.round(subWeightLb(d.cDim, t, d.sub.lb)) }));

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
