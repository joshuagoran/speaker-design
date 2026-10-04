// One comparable Xmax for every driver.
// ---------------------------------------------------------------
// Makers publish different quantities under "Xmax". The models compare drivers on one scale, (Hvc − Hg)/2 + Hg/4
// (coil overhang plus a quarter of the gap: B&C, Lavoce and Ciare publish this, and it sits closest to what most
// makers print). The tables keep every published figure as is (`pub`, `Hvc`, `Hg`); this pass adds the comparable
// value as `Xmax` and its band as `xmax`:
//   derived    from Hvc and Hg, exact;
//   converted  from the maker's Xmax and its stated formula (needs Hg unless the formula is already Hg/4), exact;
//   published  a passive radiator's limit, used as is (no motor, so no gap): its linear Xmax, or the mechanical limit
//              where that is all the maker gives (pushing a radiator to it costs noise and distortion, not a coil);
//   estimated  from the maker's figure times the ESTIMATE band, centre in the middle.
import type {
  GapFormula,
  MakerId,
  PassiveRadiator,
  PublishedExcursion,
  RawPassiveRadiator,
  RawTS,
  ThieleSmall,
  XmaxBand,
  XmaxFormula,
} from "../types";
import { MAKER_SEGMENT } from "../data/catalog/makers";
import { keysOf } from "./records";

/** the share of Hg each maker formula adds to the plain overhang */
const GAP_SHARE: Record<GapFormula, number> = {
  plain: 0,
  "hg/4": 1 / 4,
  "hg/3": 1 / 3,
  "hg/3.5": 1 / 3.5,
};
/** The formula is one of the gap formulas (a share of Hg on the plain overhang). */
export const isGapFormula = (f: XmaxFormula): f is GapFormula => Object.hasOwn(GAP_SHARE, f);
/** the comparable scale's share of Hg */
const SCALE_SHARE = GAP_SHARE["hg/4"];

/** One-way Xmax by a maker formula from coil and gap heights, mm. */
export const xmaxByFormula = (formula: GapFormula, Hvc: number, Hg: number) =>
  (Hvc - Hg) / 2 + GAP_SHARE[formula] * Hg;

/** The comparable Xmax from coil and gap heights, mm. */
export const comparableXmax = (Hvc: number, Hg: number) => xmaxByFormula("hg/4", Hvc, Hg);

/**
 * Where the comparable value lies, as multiples of a published figure, when the maker gives no heights. Calibrated on
 * the 72 drivers whose heights are known (comparable / published):
 *   XmaxPro    pro makers that state no method: their peers run 0.83–1.06, median 0.93;
 *   XmaxHifi   hi-fi makers that state no method (Dayton, Peerless, Fostex): hi-fi makers mostly publish the plain
 *              overhang, which reads 1.2–1.3 on this scale (Scan-Speak), so the band spans gap-fraction to plain;
 *   Xvar       B&C's 10 % distortion limit: 0.68–1.13, median 0.84;
 *   travelPP   SB Acoustics' linear travel, peak to peak (= Hvc − Hg): half of it plus a quarter of a 5–6 mm gap.
 */
export const ESTIMATE: Record<
  "XmaxPro" | "XmaxHifi" | "Xvar" | "travelPP",
  readonly [number, number]
> = {
  XmaxPro: [0.85, 1.0],
  XmaxHifi: [0.9, 1.3],
  Xvar: [0.7, 1.1],
  travelPP: [0.55, 0.65],
};

/** Makers whose published Xmax is estimated with the hi-fi band when no heights are known. */
export const HIFI_MAKERS: ReadonlySet<MakerId> = new Set(
  keysOf(MAKER_SEGMENT).filter((m) => MAKER_SEGMENT[m] === "hifi"),
);

const exact = (mm: number, basis: XmaxBand["basis"]): XmaxBand => ({ basis, lo: mm, hi: mm });
const estimate = (mm: number, [lo, hi]: readonly [number, number]): XmaxBand => ({
  basis: "estimated",
  lo: lo * mm,
  hi: hi * mm,
});

/**
 * The comparable Xmax band from the published figures. `maker` picks the estimate band; `who` is the driver's name, for
 * the errors. Throws on a table row that gives no figure.
 */
export function xmaxBandOf(
  ts: { pub: PublishedExcursion; Hvc?: number; Hg?: number },
  maker: MakerId,
  who: string,
): XmaxBand {
  const { pub, Hvc, Hg } = ts;
  if (Hvc != null && Hg != null) return exact(comparableXmax(Hvc, Hg), "derived");
  if (pub.Xmax != null && isGapFormula(pub.formula)) {
    if (pub.formula === "hg/4") return exact(pub.Xmax, "converted");
    // the other formulas convert only with the gap height; the generic bands would move them the wrong way
    if (Hg == null) throw new Error(`${who}: a ${pub.formula} Xmax needs the gap height Hg`);
    return exact(pub.Xmax - (GAP_SHARE[pub.formula] - SCALE_SHARE) * Hg, "converted");
  }
  // Eminence publishes the greater of the plain overhang and the 10 % distortion point, so the plain overhang is at
  // most its figure and the comparable value at most the figure + Hg/4; at least the figure while the distortion
  // point sits within Hg/4 of the overhang (NSW4018-8, whose heights are known: 1.2 mm against Hg/4 = 3.2 mm)
  if (pub.Xmax != null && pub.formula === "overhang-or-x10") {
    if (Hg == null) throw new Error(`${who}: an overhang-or-X10 Xmax needs the gap height Hg`);
    return { basis: "estimated", lo: pub.Xmax, hi: pub.Xmax + SCALE_SHARE * Hg };
  }
  if (pub.Xmax != null)
    return estimate(pub.Xmax, HIFI_MAKERS.has(maker) ? ESTIMATE.XmaxHifi : ESTIMATE.XmaxPro);
  if (pub.Xvar != null) return estimate(pub.Xvar, ESTIMATE.Xvar);
  if (pub.travelPP != null) return estimate(pub.travelPP, ESTIMATE.travelPP);
  throw new Error(`${who}: no excursion figure`);
}

/** The band's centre, the value the models use. */
export const centreOf = (b: Pick<XmaxBand, "lo" | "hi">) => (b.lo + b.hi) / 2;

/** A table's Thiele-Small block with the comparable `Xmax` and its band added; `maker` and `who` as for `xmaxBandOf`. */
export function withXmax<T extends RawTS<ThieleSmall>>(
  ts: T,
  maker: MakerId,
  who: string,
): T & Pick<ThieleSmall, "Xmax" | "xmax"> {
  const xmax = xmaxBandOf(ts, maker, who);
  return { ...ts, Xmax: centreOf(xmax), xmax };
}

/** A passive radiator with its `Xmax`: the linear limit, or the mechanical one where that is all the maker gives. */
export function passiveWithXmax(p: RawPassiveRadiator): PassiveRadiator {
  const lim = p.pub.Xmax ?? p.pub.Xlim;
  if (lim == null) throw new Error(`${p.name}: no excursion figure`);
  return { ...p, Xmax: lim, xmax: exact(lim, "published") };
}

/** A curve at the low and high ends of an Xmax band; null when the band is exact (nothing to shade). */
export function xmaxBandCurves<P>(
  band: Pick<XmaxBand, "lo" | "hi">,
  curveAt: (Xmax: number) => P,
): { lo: P; hi: P } | null {
  return band.lo === band.hi ? null : { lo: curveAt(band.lo), hi: curveAt(band.hi) };
}

const FORMULA_LABEL: Record<XmaxFormula, string> = {
  plain: "plain overhang",
  "hg/4": "Hg/4",
  "hg/3": "Hg/3",
  "hg/3.5": "Hg/3.5",
  "overhang-or-x10": "overhang or X10",
  unstated: "method not published",
};
const mm = (v: number) => `${+v.toFixed(2)}`;

/** The maker's figures in one line, e.g. "Xmax 12 (Hg/3), Xvar 14, Xdamage 24". */
export function publishedText(p: PublishedExcursion): string {
  const parts = [
    p.Xmax != null ? `Xmax ${mm(p.Xmax)} (${FORMULA_LABEL[p.formula]})` : null,
    p.Xvar != null ? `Xvar ${mm(p.Xvar)}` : null,
    p.travelPP != null ? `linear travel ${mm(p.travelPP)} p-p` : null,
    p.Xlim != null ? `Xlim ${mm(p.Xlim)}` : null,
    p.Xdamage != null ? `Xdamage ${mm(p.Xdamage)}` : null,
  ];
  return parts.filter((s) => s != null).join(", ");
}

/** Why a value is an estimate, for its tooltip. */
const estimateWhy = (formula: XmaxFormula, Hg: number | undefined) =>
  formula === "overhang-or-x10"
    ? "Eminence publishes the greater of the plain overhang and the 10 % distortion point, and the gap height but no coil height, so the value lies between its figure and the figure + Hg/4."
    : Hg != null
      ? "The maker publishes the gap height but no coil height and no method."
      : "The maker publishes no coil or gap height and no method.";

/**
 * Two stat rows, [name, value, note, tooltip]: the comparable Xmax the models use and the maker's own figure. Notes stay
 * short (stat-row notes don't wrap); the full list of published figures and the source go in the tooltips.
 */
export function xmaxRows(
  ts: Pick<ThieleSmall, "Xmax" | "xmax" | "pub" | "Hvc" | "Hg">,
): [string, string, string, string][] {
  const { xmax, pub, Hvc, Hg } = ts;
  const est = xmax.basis === "estimated";
  const how =
    xmax.basis === "derived" && Hvc != null && Hg != null
      ? `Hvc ${mm(Hvc)} / Hg ${mm(Hg)}`
      : xmax.basis === "converted"
        ? `from the ${FORMULA_LABEL[pub.formula]} figure`
        : xmax.basis === "published"
          ? "as published"
          : `estimate ${xmax.lo.toFixed(1)}–${xmax.hi.toFixed(1)}`;
  // the maker's own figure, named when it is not an Xmax
  const [kind, value] =
    pub.Xmax != null
      ? ["", pub.Xmax]
      : pub.Xvar != null
        ? ["Xvar ", pub.Xvar]
        : pub.travelPP != null
          ? ["travel p-p ", pub.travelPP]
          : ["Xlim ", pub.Xlim];
  return [
    [
      "Xmax (comparable)",
      `${est ? "≈" : ""}${ts.Xmax.toFixed(1)} mm`,
      how,
      `One scale for every driver: (Hvc − Hg)/2 + Hg/4, which B&C, Lavoce and Ciare publish and most makers' figures sit near. The models use this value.${est ? ` ${estimateWhy(pub.formula, Hg)} The value is the middle of the band; the max-SPL chart shades it.` : ""}`,
    ],
    [
      "Xmax (maker)",
      value != null ? `${kind}${mm(value)} mm` : "—",
      pub.Xmax != null ? FORMULA_LABEL[pub.formula] : "no Xmax published",
      `As the maker publishes it: ${publishedText(pub) || "nothing"}.${pub.src ? ` Source: ${new URL(pub.src).hostname}.` : ""}`,
    ],
  ];
}
